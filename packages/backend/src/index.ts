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

// Define the environment type
type Bindings = {
  AI: AiBinding;
  OPENAI_API_KEY: string;
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

async function generateWorkflowHandler(c: Context<{ Bindings: Bindings }>) {
  const body = await c.req.json<{ prompt?: string; endpoint?: string; token?: string }>()
  if (!body.prompt) {
    return c.json({ error: 'Prompt is required' }, 400)
  }
  try {
    // Initialize OpenAI client within the handler to access env vars
    const openai = new OpenAI({ apiKey: c.env.OPENAI_API_KEY })

    // Retrieve node definitions
    const nodes = await fetchNodes(body.endpoint, body.token)
    // Build AI prompt
    const systemMsg = `${prompt}\n\nUse only these node definitions: ${JSON.stringify(nodes)}`
    const userMsg = body.prompt
    // Call OpenAI
    const completion = await openai.chat.completions.create({
      model: 'gpt-4.1-mini',
      messages: [{ role: 'system', content: systemMsg }, { role: 'user', content: userMsg }],
      temperature: 0
    })
    const content = completion.choices?.[0]?.message?.content || ''
    let workflow: unknown
    try {
      workflow = JSON.parse(content)
    } catch (parseErr) {
      return c.json({ error: 'Invalid JSON from AI', details: String(parseErr), content }, 500)
    }
    return c.json({ workflow })
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
  // Use Cloudflare AI vector search via bindings
  try {
    const results = await c.env.AI.autorag('n8n-autorag').search({
      query,
      rewrite_query: false,
      max_num_results: topK,
      ranking_options: {
        score_threshold: 0.3,
      },
    });
    return c.json(results)
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err)
    // Check if the error is related to the AI binding
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
