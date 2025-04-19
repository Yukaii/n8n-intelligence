import { Hono } from 'hono'
import OpenAI from 'openai'
import type { Context } from 'hono'
// @ts-ignore
import prompt from './prompt.md?raw'
import defaultNodes from './defaultNodes.json'
import { renderer } from './renderer'

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

// Helper to fetch nodes from user n8n instance or default list
async function fetchNodes(endpoint?: string, token?: string): Promise<any> {
  if (endpoint && token) {
    const res = await fetch(`${endpoint}/rest/nodes`, { headers: { Authorization: `Bearer ${token}` } });
    if (!res.ok) throw new Error(`n8n responded ${res.status}`)
    return await res.json();
  }

  return defaultNodes;
}

// Controller functions adapted for Hono routes
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
    // Assuming the response format forces JSON, parsing should be more reliable
    const responseContent = keywordResp.choices?.[0]?.message?.content;
    if (!responseContent) {
      throw new Error('No content received from OpenAI for keyword extraction.');
    }
    // Parse the JSON response content
    const parsedJson = JSON.parse(responseContent);

    // Expect the response to be an object like { "keywords": [...] } due to the schema
    if (parsedJson && Array.isArray(parsedJson.keywords)) {
      keywords = parsedJson.keywords;
    } else {
      // If the expected structure isn't found, log an error and throw
      console.error("Unexpected JSON structure for keywords:", parsedJson);
      throw new Error('Keywords extracted are not in the expected {keywords: [...]} format.');
    }

    // Optional: Validate that all items in the array are strings
    if (!keywords.every(kw => typeof kw === 'string')) {
      console.error("Not all items in the extracted keywords array are strings:", keywords);
      throw new Error('Keywords array contains non-string elements.');
    }

  } catch (e) {
    console.error("Failed to parse keywords JSON:", e, "Raw content:", keywordResp.choices?.[0]?.message?.content);
    // Fallback or re-throw depending on desired behavior
    throw new Error(`Failed to extract or parse keywords: ${e instanceof Error ? e.message : String(e)}`);
  }
  return keywords;
}

async function searchNodesForKeywords(keywords: string[], env: Bindings): Promise<{ combinedNodes: any[], searchResults: any[] }> {
  const seenNodeIds = new Set<string>();
  const combinedNodes: any[] = [];
  console.log("Searching for keywords:", keywords);

  const promises = keywords.map(async (keyword) => {
    try {
      console.log("Searching for keyword:", keyword);
      const results = await env.AI.autorag('n8n-autorag').search({
        query: keyword,
        rewrite_query: false,
        max_num_results: 10,
        ranking_options: { score_threshold: 0.3 },
      });
      console.log('Search results for keyword ends:', keyword);
      const data = (results as any).data || [];
      // Fetch all node files in parallel for this keyword
      await Promise.all(
        data.map(async (item: any) => {
          const filename = item.filename;
          let fileContent = null;
          try {
            const obj = await env.N8N_NODES.get(filename);
            if (obj) {
              try {
                fileContent = await obj.json();
              } catch (err) {
                console.error("Error parsing JSON for node file:", filename, err);
                fileContent = { error: 'Failed to parse JSON' };
              }
            }
          } catch (err) {
            console.error("Error fetching node file:", filename, err);
          }
          if (fileContent && fileContent.name && !seenNodeIds.has(fileContent.name)) {
            seenNodeIds.add(fileContent.name);
            combinedNodes.push(fileContent);
          }
        })
      );
      return { keyword, data };
    } catch (e) {
      console.error("Error during search for keyword:", keyword, e);
      return { keyword, error: String(e) };
    }
  });

  const searchResults = await Promise.all(promises);
  return { combinedNodes, searchResults };
}

async function generateWorkflowWithAI(openai: OpenAI, prompt: string, nodes: any, combinedNodes: any[], userPrompt: string): Promise<any> {
  const systemMsg = `${prompt}\n\nUse only these node definitions: ${JSON.stringify(nodes)}\nRelevant nodes from search: ${JSON.stringify(combinedNodes)}`;
  const userMsg = userPrompt;
  const completion = await openai.chat.completions.create({
    model: 'gpt-4.1-mini',
    messages: [{ role: 'system', content: systemMsg }, { role: 'user', content: userMsg }],
    temperature: 0,
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

async function generateWorkflowHandler(c: Context<{ Bindings: Bindings }>) {
  const body = await c.req.json<{ prompt?: string; endpoint?: string; token?: string }>()
  if (!body.prompt) {
    return c.json({ error: 'Prompt is required' }, 400)
  }

  try {
    const openai = new OpenAI({ apiKey: import.meta.env.VITE_OPENAI_API_KEY })
    // Step 1: Extract search keywords from the prompt using OpenAI
    let keywords: string[];
    try {
      keywords = await extractKeywordsFromPrompt(openai, body.prompt);
    } catch (err) {
      console.error("Keyword extraction error:", err);
      return c.json({ error: 'Failed to extract keywords' }, 500);
    }

    // Step 2: For each keyword, perform autorag search and collect nodes
    let combinedNodes: any[], searchResults: any[];
    try {
      const searchResult = await searchNodesForKeywords(keywords, c.env);
      combinedNodes = searchResult.combinedNodes;
      searchResults = searchResult.searchResults;
    } catch (err) {
      console.error("Node search error:", err);
      return c.json({ error: 'Failed to search nodes' }, 500);
    }

    // Step 3: Retrieve node definitions (from user instance or default)
    const nodes = await fetchNodes(body.endpoint, body.token);

    // Step 4: Build AI prompt for workflow generation and call OpenAI
    let workflow: unknown;
    try {
      workflow = await generateWorkflowWithAI(openai, prompt, nodes, combinedNodes, body.prompt);
    } catch (err: any) {
      return c.json(err, 500);
    }

    return c.json({ workflow, keywords, searchResults });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err)
    return c.json({ error: msg }, 500)
  }
}

async function searchHandler(c: Context<{ Bindings: Bindings }>) {
  const query = c.req.query('q')
  const kParam = c.req.query('k')
  const topK = kParam ? Number.parseInt(kParam) : 3
  if (!query) {
    return c.json({ error: 'Query parameter q is required' }, 400)
  }
  try {
    const results = await c.env.AI.autorag('n8n-autorag').search({
      query,
      rewrite_query: false,
      max_num_results: topK,
      ranking_options: {
        score_threshold: 0.3,
      },
    });

    // Expecting results.data to be an array of vector search results
    const data = (results as any).data || [];
    const combined = [];
    for (const item of data) {
      const filename = item.filename;
      let fileContent = null;
      try {
        const obj = await c.env.N8N_NODES.get(filename);
        if (obj) {
          try {
            fileContent = await obj.json();
          } catch (jsonErr) {
            // If .json() fails, try .text() for debugging
            const text = await obj.text();
            fileContent = { error: 'Failed to parse JSON', raw: text };
          }
        } else {
          fileContent = { error: 'File not found in R2 bucket' };
        }
      } catch (e) {
        fileContent = { error: 'Failed to fetch or parse file', details: String(e) };
      }
      combined.push({
        ...item,
        file_content: fileContent,
      });
    }
    console.log("Search results:", combined);
    return c.json({
      ...results,
      combined,
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

// Define routes
app.get('/nodes', getNodesHandler)
app.post('/generate-workflow', generateWorkflowHandler)
app.get('/search', searchHandler)

app.use(renderer)
app.get('/', (c) => {
  return c.render(<h1>Hello!</h1>)
})

// Export the Hono app in the Cloudflare Worker format
export default app
