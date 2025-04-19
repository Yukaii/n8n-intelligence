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

  it('POST /generate-workflow returns error on missing prompt', async () => {
    const res = await makeRequest('/generate-workflow', { method: 'POST', body: JSON.stringify({}) })
    expect(res.status).toBe(400)
    const data = await res.json()
    expect(data.error).toBeDefined()
  })

  it('GET /search returns error on missing query', async () => {
    const res = await makeRequest('/search')
    expect(res.status).toBe(400)
    const data = await res.json()
    expect(data.error).toBeDefined()
  })
})
