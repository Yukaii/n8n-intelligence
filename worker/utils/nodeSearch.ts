// Utilities for searching and fetching n8n nodes

import type { INodeTypeDescription } from "n8n-workflow";

// Type for node search results
export type NodeSearchResult = {
  query: string;
  data: Array<
    Partial<INodeTypeDescription> & {
      filename?: string;
      file_id?: string;
      content?: unknown;
    }
  >;
  error?: string;
};

// Search nodes for given keywords using the provided env
export async function searchNodesForKeywords(
  keywords: string[],
  env: Env,
): Promise<{ searchResults: NodeSearchResult[] }> {
  const combinedQuery = keywords.join(" ");
  console.log("Searching with combined query:", combinedQuery);

  try {
    const results = await env.AI.autorag("n8n-autorag").search({
      query: combinedQuery,
      rewrite_query: false,
      max_num_results: 15,
      ranking_options: { score_threshold: 0.25 },
    });
    console.log("Combined search results received.");
    const data =
      (
        results as {
          data?: Array<
            Partial<INodeTypeDescription> & {
              filename?: string;
              file_id?: string;
              content?: unknown;
            }
          >;
        }
      ).data || [];
    return { searchResults: [{ query: combinedQuery, data }] };
  } catch (e) {
    console.error("Error during combined node search:", combinedQuery, e);
    return {
      searchResults: [{ query: combinedQuery, error: String(e), data: [] }],
    };
  }
}

// Fetch the full node content from storage if available
export async function fetchFullNode(
  item: Partial<INodeTypeDescription> & {
    filename?: string;
    file_id?: string;
    content?: unknown;
  },
  env: Env,
): Promise<
  Partial<INodeTypeDescription> & {
    filename?: string;
    file_id?: string;
    content?: unknown;
  }
> {
  const { filename } = item;
  if (typeof filename === "string" && filename.length > 0) {
    const safeFilename: string = filename;
    try {
      const obj = await env.N8N_NODES.get(safeFilename);
      if (obj) {
        const content = await obj.text();
        if (!content) {
          throw new Error("Empty content from R2");
        }
        return {
          ...item,
          filename: safeFilename,
          content,
        };
      }
    } catch (err) {
      console.error("Error fetching full node from R2 for", safeFilename, err);
    }
  }
  return item;
}
