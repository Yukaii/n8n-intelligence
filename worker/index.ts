import { Hono } from 'hono';
import OpenAI from 'openai';
import type { Context } from 'hono';
import { env } from 'hono/adapter';
import { streamSSE } from 'hono/streaming';
// @ts-ignore
import { prompt } from './utils/prompt';
import defaultNodes from './data/defaultNodes.json'

// Define the type for the Cloudflare AI binding
interface AutoragSearchOptions {
  query: string;
  rewrite_query?: boolean;
  max_num_results?: number;
  ranking_options?: {
    score_threshold?: number;
  };
}

interface AutoragNamespace {
  search(options: AutoragSearchOptions): Promise<object>;
}

interface AutoragCallable {
  (namespace?: string): AutoragNamespace;
}

interface AiBinding {
  autorag: AutoragCallable;
}

interface R2Bucket {
  get(key: string): Promise<R2ObjectBody | null>;
}
interface R2ObjectBody {
  body: ReadableStream<any> | null;
  text(): Promise<string>;
  json(): Promise<any>;
}

type Bindings = {
  AI: AiBinding;
  OPENAI_API_KEY: string;
  N8N_NODES: R2Bucket;
};

const app = new Hono<{ Bindings: Bindings }>()

async function fetchNodes(endpoint?: string, token?: string): Promise<any> {
  if (endpoint && token) {
    const res = await fetch(`${endpoint}/rest/nodes`, { headers: { Authorization: `Bearer ${token}` } });
    if (!res.ok) throw new Error(`n8n responded ${res.status}`)
    return await res.json();
  }

  return defaultNodes;
}

async function getNodesHandler(c: Context<{ Bindings: Bindings }>) {
  try {
    const endpoint = c.req.query('endpoint')
    const token = c.req.query('token')
    const nodes = await fetchNodes(endpoint, token)
    return c.json(nodes)
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err)
    return c.json({ error: msg }, 500)
  }
}

async function extractKeywordsFromPrompt(openai: OpenAI, userPrompt: string): Promise<string[]> {
  const systemPrompt = `You are an expert at extracting relevant search terms for finding n8n nodes.
Given a user prompt describing an n8n workflow, extract up to 5 concise keywords or phrases that best represent the core actions, services, or data transformations involved.
Focus on terms likely to match n8n node names or functionalities. Avoid generic words.
Return the keywords according to the provided JSON schema.`;

  const keywordResp = await openai.chat.completions.create({
    model: 'gpt-4.1-nano',
    messages: [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userPrompt }
    ],
    response_format: {
      type: "json_schema", // Use json_schema type
      json_schema: {
        name: "keywords_object", // Schema name
        description: "An object containing a list of extracted keywords for n8n node search.",
        schema: { // Define the object schema
          type: "object",
          properties: {
            keywords: {
              type: "array",
              items: { type: "string" },
              description: "Up to 5 relevant keywords or phrases."
            }
          },
          required: ["keywords"], // The 'keywords' property is required
          additionalProperties: false // Disallow extra properties
        },
        strict: true // Enforce the schema strictly
      }
    },
  });

  let keywords: string[] = [];
  try {
    const responseContent = keywordResp.choices?.[0]?.message?.content;
    if (!responseContent) {
      throw new Error('No content received from OpenAI for keyword extraction.');
    }
    const parsedJson = JSON.parse(responseContent);

    if (parsedJson && Array.isArray(parsedJson.keywords)) {
      keywords = parsedJson.keywords;
    } else {
      console.error("Unexpected JSON structure for keywords:", parsedJson);
      throw new Error('Keywords extracted are not in the expected {keywords: [...]} format.');
    }

    if (!keywords.every(kw => typeof kw === 'string')) {
      console.error("Not all items in the extracted keywords array are strings:", keywords);
      throw new Error('Keywords array contains non-string elements.');
    }

  } catch (e) {
    console.error("Failed to parse keywords JSON:", e, "Raw content:", keywordResp.choices?.[0]?.message?.content);
    throw new Error(`Failed to extract or parse keywords: ${e instanceof Error ? e.message : String(e)}`);
  }
  return keywords;
}

// Refactored to perform a single search with combined keywords
async function searchNodesForKeywords(keywords: string[], env: Bindings): Promise<{ searchResults: any[] }> {
  const combinedQuery = keywords.join(' ');
  console.log("Searching with combined query:", combinedQuery);

  try {
    const results = await env.AI.autorag('n8n-autorag').search({
      query: combinedQuery,
      rewrite_query: false, // Keep false for direct keyword search
      max_num_results: 15, // Increased limit for broader search
      ranking_options: { score_threshold: 0.25 }, // Slightly lower threshold
    });
    console.log('Combined search results received.');
    const data = (results as any).data || [];
    // Return in a structure compatible with downstream processing,
    // even though it's a single result set now.
    // We wrap it in an array to maintain the expected structure later.
    return { searchResults: [{ query: combinedQuery, data }] };
  } catch (e) {
    console.error("Error during combined node search:", combinedQuery, e);
    // Return an empty structure or re-throw depending on desired error handling
    return { searchResults: [{ query: combinedQuery, error: String(e), data: [] }] };
  }
}


// Updated to accept full node data again
async function generateWorkflowWithAI(openai: OpenAI, prompt: string, nodes: any[], userPrompt: string): Promise<any> {
  // Use full nodes in the system message
  const systemMsg = `${prompt}\n\nRelevant nodes from search: ${JSON.stringify(nodes)}`;
  const userMsg = userPrompt;
  const completion = await openai.chat.completions.create({
    model: 'gpt-4.1-mini',
    messages: [{ role: 'system', content: systemMsg }, { role: 'user', content: userMsg }],
    temperature: 0,
    response_format: {
      type: "json_object", // Use json_object type
    },
  });
  const content = completion.choices?.[0]?.message?.content || '';
  let workflow: unknown;
  try {
    workflow = JSON.parse(content);
  } catch (parseErr) {
    throw { error: 'Invalid JSON from AI', details: String(parseErr), content };
  }
  return workflow;
}

async function fetchFullNode(item: any, env: Bindings): Promise<any> {
  if (item && item.filename) {
    try {
      const obj = await env.N8N_NODES.get(item.filename);
      if (obj) {
        const content = await obj.text();
        if (!content) {
          throw new Error('Empty content from R2');
        }
        return {
          ...item,
          content,
        };
      }
    } catch (err) {
      console.error("Error fetching full node from R2 for", item.filename, err);
    }
  }
  return item;
}

// Changed to use streamSSE for progress reporting
app.post('/generate-workflow', async (c) => {
  let streamClosed = false; // Flag to prevent writing after close

  return streamSSE(c, async (stream) => {
    // Ensure stream closes if client disconnects
    stream.onAbort(() => {
      console.log('Stream aborted by client.');
      streamClosed = true;
    });

    const writeProgress = async (step: string, status: string, message?: string, data?: any) => {
      if (streamClosed) return;
      const payload = { step, status, message, data };
      await stream.writeSSE({
        event: 'progress',
        data: JSON.stringify(payload),
        id: String(Date.now()), // Add unique ID for potential retry logic
      });
    };

    const writeResult = async (resultData: any) => {
      if (streamClosed) return;
      await stream.writeSSE({
        event: 'result',
        data: JSON.stringify(resultData),
        id: String(Date.now()),
      });
    };

    const writeError = async (errorMsg: string, details?: any) => {
      if (streamClosed) return;
      console.error("Workflow Generation Error:", errorMsg, details);
      await stream.writeSSE({
        event: 'error',
        data: JSON.stringify({ error: errorMsg, details }),
        id: String(Date.now()),
      });
      // Close stream after error
      await stream.close();
      streamClosed = true;
    };

    try {
      const body = await c.req.json<{ prompt?: string; endpoint?: string; token?: string }>();
      if (!body.prompt) {
        await writeError('Prompt is required');
        return;
      }
      const userPrompt = body.prompt;

      const openai = new OpenAI({ apiKey: env<{ OPENAI_API_KEY: string }>(c).OPENAI_API_KEY });

      // 1. Keyword Extraction
      await writeProgress('extract_keywords', 'started', 'Extracting keywords...');
      let keywords: string[];
      try {
        keywords = await extractKeywordsFromPrompt(openai, userPrompt);
        await writeProgress('extract_keywords', 'completed', 'Keywords extracted.', { keywords });
      } catch (err) {
        await writeError('Failed to extract keywords', err instanceof Error ? err.message : String(err));
        return;
      }

      // 2. Node Search
      await writeProgress('search_nodes', 'started', 'Searching for relevant nodes...');
      let searchResults: any[];
      try {
        const searchResult = await searchNodesForKeywords(keywords, c.env);
        searchResults = searchResult.searchResults;
        // We might want to report the number of raw results found
        const rawResultCount = searchResults[0]?.data?.length || 0;
        await writeProgress('search_nodes', 'completed', `Found ${rawResultCount} potential node matches.`, { rawCount: rawResultCount });
      } catch (err) {
        await writeError('Failed to search nodes', err instanceof Error ? err.message : String(err));
        return;
      }

      // 3. Fetch Full Nodes & Deduplicate
      await writeProgress('fetch_nodes', 'started', 'Fetching full node details...');
      const combinedResultsData = searchResults[0]?.data || [];
      let allNodesFetched: any[];
      try {
        allNodesFetched = await Promise.all(
          combinedResultsData.map((item: any) => fetchFullNode(item, c.env))
        );
      } catch (err) {
        await writeError('Failed during node fetching', err instanceof Error ? err.message : String(err));
        return;
      }

      const uniqueNodesFull = Array.from(new Set(allNodesFetched.map((node: any) => node?.file_id).filter(id => id))) // Ensure file_id exists
        .map(id => allNodesFetched.find((node: any) => node?.file_id === id))
        .filter(node => node); // Filter out potential undefined values

      await writeProgress('fetch_nodes', 'completed', `Fetched and deduplicated ${uniqueNodesFull.length} unique nodes.`);

      // 4. Parse Node Content
      await writeProgress('parse_nodes', 'started', 'Parsing node content...');
      const nodes = uniqueNodesFull.map((node: any) => {
        const { file_id, filename, content } = node;
        let parsedContent: any = content;
        try {
          if (typeof content === 'string' && content.trim() !== '') {
            parsedContent = JSON.parse(content);
          } else if (typeof content === 'object' && content !== null) {
            parsedContent = content;
          }
        } catch (error) {
          console.warn("Non-JSON content encountered for node:", filename, error);
          // Keep original string content if JSON parsing fails, AI might handle it
          parsedContent = content;
        }
        return { file_id, filename, content: parsedContent };
      });
      await writeProgress('parse_nodes', 'completed', 'Node content parsed.');


      // 5. Generate Workflow
      await writeProgress('generate_workflow', 'started', 'Generating final workflow...');
      let workflow: unknown;
      try {
        workflow = await generateWorkflowWithAI(openai, prompt, nodes, userPrompt);
        await writeProgress('generate_workflow', 'completed', 'Workflow generation complete.');
      } catch (err: any) {
        const errorDetails = (err && typeof err === 'object' && 'details' in err) ? err.details : String(err);
        const errorMsg = (err && typeof err === 'object' && 'error' in err) ? err.error : 'Failed to generate workflow';
        await writeError(errorMsg, errorDetails);
        return;
      }

      // 6. Send Final Result
      await writeResult({ workflow, keywords, searchResults, nodes }); // Send full nodes back for potential debugging on client

    } catch (err: unknown) {
      // Catch any unexpected errors during the main process
      await writeError('An unexpected error occurred', err instanceof Error ? err.message : String(err));
    } finally {
      // Ensure the stream is closed if not already closed by an error
      if (!streamClosed) {
        await stream.close();
        streamClosed = true;
      }
    }
  });
});

async function searchHandler(c: Context<{ Bindings: Bindings }>) {
  const query = c.req.query('q')
  if (!query) {
    return c.json({ error: 'Query parameter q is required' }, 400)
  }
  try {
    // Use the refactored searchNodesForKeywords. Pass the query as a single-element array.
    const { searchResults } = await searchNodesForKeywords([query], c.env);

    // Process the single result set
    const combinedResultsData = searchResults[0]?.data || [];

    // Fetch full node content for the results
    const combinedFetched = await Promise.all(
      combinedResultsData.map((item: any) => fetchFullNode(item, c.env))
    );

    // Uniqueness by file_id
    const uniqueNodes = Array.from(new Set(combinedFetched.map((node: any) => node.file_id)))
      .map(id => combinedFetched.find((node: any) => node.file_id === id));

    // Map and parse content
    const combined = uniqueNodes.map((node: any) => {
      console.log(node, 'node');
      const { file_id, filename, content } = node;
      let parsedContent: any = content && content[0] && content[0].text;
      try {
        parsedContent = JSON.parse(parsedContent);
      } catch (error) {
        // leave as string if not JSON
        console.error("Error processing node content:", error, filename);
      }
      return { file_id, filename, content: parsedContent };
    });

    return c.json({
      combined,
      searchResults,
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err)
    if (msg.includes('env.AI') || msg.includes('binding')) {
      console.error("AI Binding Error:", err);
      return c.json({ error: "AI binding not configured or accessible.", details: msg }, 500);
    }
    console.error("Search Handler Error:", msg);
    return c.json({ error: msg }, 500)
  }
}

app.get('/nodes', getNodesHandler);
// POST '/generate-workflow' is now defined above using streamSSE
app.get('/search', searchHandler);

export default app;
