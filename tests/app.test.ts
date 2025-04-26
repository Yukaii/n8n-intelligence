import { describe, it, expect } from 'bun:test'
// Controller functions are no longer exported; integration tests only

const PORT = Bun.env.PORT || 5173

function makeRequest(path: string, options: RequestInit = {}) {
  return fetch(`http://localhost:${PORT}${path}`, options)
}

describe('API Integration (Cloudflare Worker style)', () => {
  it('GET /nodes returns default nodes', async () => {
    const res = await makeRequest('/nodes')
    expect(res.status).toBe(200)
    const data = await res.json()
    expect(Array.isArray(data) || typeof data === 'object').toBe(true)
  })

  it('POST /generate-workflow returns 400 on missing prompt', async () => {
    const res = await makeRequest('/generate-workflow', { method: 'POST', body: JSON.stringify({}) })
    expect(res.status).toBe(400)
    const data = await res.json() as any
    expect(data.error).toBeDefined()
  })

  it('POST /generate-workflow returns 200 on valid prompt', async () => {
    console.log('Running test for POST /generate-workflow')
    // Valid prompt (minimal, may still error if backend requires more setup)
    const res = await makeRequest('/generate-workflow', {
      method: 'POST',
      body: JSON.stringify({ prompt: 'Create a simple workflow' }),
      headers: { 'Content-Type': 'application/json' }
    })
    // Accept either 200 (success)
    expect(res.status).toBe(200)
    const data = await res.json() as any
    expect(data).toBeDefined()
  }, 10 * 1000)

  it('GET /search returns error on missing query', async () => {
    const res = await makeRequest('/search')
    expect(res.status).toBe(400)
    const data = await res.json() as any
    expect(data.error).toBeDefined()
  })

  it('GET /search returns results for sample query', async () => {
    const res = await makeRequest('/search?q=How%20do%20I%20train%20a%20llama%20to%20deliver%20coffee%3F&k=2')
    expect(res.status).toBe(200)
    const data = await res.json() as any
    expect(data).toBeDefined()
    // Optionally check for expected structure, e.g. expect(Array.isArray(data.results) || typeof data === 'object').toBe(true)
  })
})
