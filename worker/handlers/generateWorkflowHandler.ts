import OpenAI from "openai";
import type { Context } from "hono";
import { env } from "hono/adapter";
import { streamSSE } from "hono/streaming";
import { getAuth } from "@hono/clerk-auth";
import { Redis } from "@upstash/redis/cloudflare";
import { prompt } from "../utils/prompt";
import { extractKeywordsFromPrompt } from "../utils/keyword";
import {
  searchNodesForKeywords,
  fetchFullNode,
  type NodeSearchResult,
} from "../utils/nodeSearch";
import { generateWorkflowWithAI } from "../utils/workflow";
import type { INodeTypeDescription } from "n8n-workflow";
import { QUOTA_LIMIT, QUOTA_WINDOW_SEC } from "../utils/quota";

async function checkQuota(c: Context, userId: string) {
  const redis = new Redis({
    url: c.env.UPSTASH_REDIS_REST_URL,
    token: c.env.UPSTASH_REDIS_REST_TOKEN,
  });
  const quotaKey = `quota:${userId}`;
  const quotaRaw = await redis.get(quotaKey);
  let quota: number;
  let reset: number | null = null;
  if (quotaRaw === null) {
    await redis.set(quotaKey, QUOTA_LIMIT - 1, { ex: QUOTA_WINDOW_SEC });
    quota = QUOTA_LIMIT - 1;
    reset = Date.now() + QUOTA_WINDOW_SEC * 1000;
  } else {
    quota = Number(quotaRaw);
    if (Number.isNaN(quota)) quota = 0;
    if (quota <= 0) {
      const ttl = await redis.ttl(quotaKey);
      reset = Date.now() + (ttl > 0 ? ttl * 1000 : 0);
      return { allowed: false, remaining: 0, reset };
    }
    quota = Number(await redis.decr(quotaKey));
    const ttl = await redis.ttl(quotaKey);
    reset = Date.now() + (ttl > 0 ? ttl * 1000 : 0);
  }
  return { allowed: true, remaining: quota, reset };
}

// Changed to use streamSSE for progress reporting
export async function generateWorkflowHandler(c: Context) {
  const auth = getAuth(c);

  if (!auth?.userId) {
    c.status(403);
    return c.json({
      message: "You are not logged in.",
    });
  }

  const quotaResult = await checkQuota(c, auth.userId);
  if (!quotaResult.allowed) {
    c.status(429);
    return c.json({
      message: "Quota exceeded. Please wait for reset.",
      remaining: 0,
      reset: quotaResult.reset,
    });
  }

  let streamClosed = false;

  return streamSSE(c, async (stream) => {
    stream.onAbort(() => {
      console.log("Stream aborted by client.");
      streamClosed = true;
    });

    type ProgressPayload = {
      step: string;
      status: string;
      message?: string;
      data?: unknown;
    };
    type ResultPayload = {
      workflow: unknown;
      keywords: string[];
      searchResults: NodeSearchResult[];
      nodes: Array<{ file_id?: string; filename?: string; content: unknown }>;
    };
    type ErrorPayload = {
      error: string;
      details?: unknown;
    };

    const writeProgress = getWriteProgress(stream, () => streamClosed);
    const writeResult = getWriteResult(stream, () => streamClosed);
    const writeError = getWriteError(
      stream,
      () => streamClosed,
      () => {
        streamClosed = true;
      },
    );

    type StreamSSEType = Parameters<Parameters<typeof streamSSE>[1]>[0];

    function getWriteProgress(stream: StreamSSEType, isClosed: () => boolean) {
      return async (
        step: string,
        status: string,
        message?: string,
        data?: unknown,
      ) => {
        if (isClosed()) return;
        const payload: ProgressPayload = { step, status, message, data };
        await stream.writeSSE({
          event: "progress",
          data: JSON.stringify(payload),
          id: String(Date.now()),
        });
      };
    }

    function getWriteResult(stream: StreamSSEType, isClosed: () => boolean) {
      return async (resultData: ResultPayload) => {
        if (isClosed()) return;
        await stream.writeSSE({
          event: "result",
          data: JSON.stringify(resultData),
          id: String(Date.now()),
        });
      };
    }

    function getWriteError(
      stream: StreamSSEType,
      isClosed: () => boolean,
      setClosed: () => void,
    ) {
      return async (errorMsg: string, details?: unknown) => {
        if (isClosed()) return;
        const payload: ErrorPayload = { error: errorMsg, details };
        console.error("Workflow Generation Error:", errorMsg, details);
        await stream.writeSSE({
          event: "error",
          data: JSON.stringify(payload),
          id: String(Date.now()),
        });
        await stream.close();
        setClosed();
      };
    }

    try {
      const body = await c.req.json<{
        prompt?: string;
        endpoint?: string;
        token?: string;
      }>();
      if (!body.prompt) {
        await writeError("Prompt is required");
        return;
      }
      const userPrompt = body.prompt;

      const openai = new OpenAI({
        apiKey: env<{ OPENAI_API_KEY: string }>(c).OPENAI_API_KEY,
      });

      await writeProgress(
        "extract_keywords",
        "started",
        "Extracting keywords...",
      );
      let keywords: string[];
      try {
        keywords = await extractKeywordsFromPrompt(openai, userPrompt);
        await writeProgress(
          "extract_keywords",
          "completed",
          "Keywords extracted.",
          { keywords },
        );
      } catch (err: unknown) {
        await writeError(
          "Failed to extract keywords",
          err instanceof Error ? err.message : String(err),
        );
        return;
      }

      await writeProgress(
        "search_nodes",
        "started",
        "Searching for relevant nodes...",
      );
      let searchResults: NodeSearchResult[];
      try {
        const searchResult = await searchNodesForKeywords(keywords, c.env);
        searchResults = searchResult.searchResults;
        const rawResultCount = searchResults[0]?.data?.length || 0;
        await writeProgress(
          "search_nodes",
          "completed",
          `Found ${rawResultCount} potential node matches.`,
          { rawCount: rawResultCount },
        );
      } catch (err: unknown) {
        await writeError(
          "Failed to search nodes",
          err instanceof Error ? err.message : String(err),
        );
        return;
      }

      await writeProgress(
        "fetch_nodes",
        "started",
        "Fetching full node details...",
      );
      const combinedResultsData = searchResults[0]?.data || [];
      let allNodesFetched: Array<
        Partial<INodeTypeDescription> & {
          filename?: string;
          file_id?: string;
          content?: unknown;
        }
      >;
      try {
        allNodesFetched = await Promise.all(
          combinedResultsData.map(
            (
              item: Partial<INodeTypeDescription> & {
                filename?: string;
                file_id?: string;
                content?: unknown;
              },
            ) => fetchFullNode(item, c.env),
          ),
        );
      } catch (err: unknown) {
        await writeError(
          "Failed during node fetching",
          err instanceof Error ? err.message : String(err),
        );
        return;
      }

      const uniqueNodesFull = Array.from(
        new Set(
          allNodesFetched.map((node) => node?.file_id).filter((id) => id),
        ),
      )
        .map((id) => allNodesFetched.find((node) => node?.file_id === id))
        .filter(
          (
            node,
          ): node is Partial<INodeTypeDescription> & {
            filename?: string;
            file_id?: string;
            content?: unknown;
          } => !!node,
        );

      await writeProgress(
        "fetch_nodes",
        "completed",
        `Fetched and deduplicated ${uniqueNodesFull.length} unique nodes.`,
      );

      await writeProgress("parse_nodes", "started", "Parsing node content...");
      const nodes = parseNodeContents(uniqueNodesFull);
      await writeProgress("parse_nodes", "completed", "Node content parsed.");

      function parseNodeContents(
        nodes: Array<
          Partial<INodeTypeDescription> & {
            filename?: string;
            file_id?: string;
            content?: unknown;
          }
        >,
      ): Array<{ file_id?: string; filename?: string; content: unknown }> {
        return nodes.map(
          (node): { file_id?: string; filename?: string; content: unknown } => {
            const { file_id, filename, content } = node;
            let parsedContent: unknown = content;
            try {
              if (typeof content === "string" && content.trim() !== "") {
                parsedContent = JSON.parse(content);
              } else if (typeof content === "object" && content !== null) {
                parsedContent = content;
              }
            } catch (error) {
              console.warn(
                "Non-JSON content encountered for node:",
                filename,
                error,
              );
              parsedContent = content;
            }
            return { file_id, filename, content: parsedContent };
          },
        );
      }

      await writeProgress(
        "generate_workflow",
        "started",
        "Generating final workflow...",
      );
      let workflow: unknown;
      try {
        workflow = await generateWorkflowWithAI(
          openai,
          prompt,
          nodes,
          userPrompt,
        );
        await writeProgress(
          "generate_workflow",
          "completed",
          "Workflow generation complete.",
        );
      } catch (err) {
        const errorDetails =
          err && typeof err === "object" && "details" in err
            ? (err as { details?: unknown }).details
            : String(err);
        const errorMsg =
          err && typeof err === "object" && "error" in err
            ? (err as { error?: string }).error
            : "Failed to generate workflow";
        await writeError(errorMsg ?? "", errorDetails);
        return;
      }

      await writeResult({ workflow, keywords, searchResults, nodes });
    } catch (err: unknown) {
      await writeError(
        "An unexpected error occurred",
        err instanceof Error ? err.message : String(err),
      );
    } finally {
      if (!streamClosed) {
        await stream.close();
        streamClosed = true;
      }
    }
  });
}
