import { Hono } from 'hono'
import OpenAI from 'openai'
import type { Context } from 'hono'
// @ts-ignore
import prompt from './prompt.md?raw'
import defaultNodes from './defaultNodes.json'

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
  const keywordPrompt = `Extract up to 5 concise search keywords or phrases from the following user prompt for n8n workflow building. Return as a JSON array of strings. Prompt: "${userPrompt}"`;
  const keywordResp = await openai.chat.completions.create({
    model: 'gpt-4.1-mini',
    messages: [{ role: 'system', content: 'You are a helpful assistant.' }, { role: 'user', content: keywordPrompt }],
    temperature: 0,
  });
  let keywords: string[] = [];
  try {
    keywords = JSON.parse(keywordResp.choices?.[0]?.message?.content || '[]');
    if (!Array.isArray(keywords)) throw new Error('Not an array');
  } catch {
    throw new Error('Failed to extract keywords');
  }
  return keywords;
}

async function searchNodesForKeywords(keywords: string[], env: Bindings): Promise<{ combinedNodes: any[], searchResults: any[] }> {
  const searchResults: any[] = [];
  const seenNodeIds = new Set<string>();
  const combinedNodes: any[] = [];
  for (const keyword of keywords) {
    try {
      const results = await env.AI.autorag('n8n-autorag').search({
        query: keyword,
        rewrite_query: false,
        max_num_results: 5,
        ranking_options: { score_threshold: 0.3 },
      });
      const data = (results as any).data || [];
      for (const item of data) {
        const filename = item.filename;
        let fileContent = null;
        try {
          const obj = await env.N8N_NODES.get(filename);
          if (obj) {
            try {
              fileContent = await obj.json();
            } catch {
              fileContent = { error: 'Failed to parse JSON' };
            }
          }
        } catch {}
        if (fileContent && fileContent.name && !seenNodeIds.has(fileContent.name)) {
          seenNodeIds.add(fileContent.name);
          combinedNodes.push(fileContent);
        }
      }
      searchResults.push({ keyword, data });
    } catch (e) {
      searchResults.push({ keyword, error: String(e) });
    }
  }
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
    const openai = new OpenAI({ apiKey: c.env.OPENAI_API_KEY })

    // Step 1: Extract search keywords from the prompt using OpenAI
    let keywords: string[];
    try {
      keywords = await extractKeywordsFromPrompt(openai, body.prompt);
    } catch (err) {
      return c.json({ error: 'Failed to extract keywords' }, 500);
    }

    // Step 2: For each keyword, perform autorag search and collect nodes
    let combinedNodes: any[], searchResults: any[];
    try {
      const searchResult = await searchNodesForKeywords(keywords, c.env);
      combinedNodes = searchResult.combinedNodes;
      searchResults = searchResult.searchResults;
    } catch (err) {
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

// Export the Hono app
export default app
