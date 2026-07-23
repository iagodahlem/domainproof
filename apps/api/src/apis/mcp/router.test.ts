import { Hono } from 'hono'
import { describe, expect, it } from 'vitest'
import { createMcpRouter } from './router'

const JSONRPC_ACCEPT = 'application/json, text/event-stream'

function buildApp() {
  const app = new Hono()
  app.route('/mcp', createMcpRouter({ version: '0.0.0-test' }))
  return app
}

function initializeRequestBody() {
  return {
    jsonrpc: '2.0',
    id: 1,
    method: 'initialize',
    params: {
      protocolVersion: '2025-06-18',
      capabilities: {},
      clientInfo: { name: 'test-client', version: '0.0.0' },
    },
  }
}

describe('createMcpRouter', () => {
  it('401s a request with no Authorization header, with a message pointing at how to set one', async () => {
    const app = buildApp()

    const res = await app.request('/mcp', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: JSONRPC_ACCEPT,
      },
      body: JSON.stringify(initializeRequestBody()),
    })

    expect(res.status).toBe(401)
    const body = (await res.json()) as {
      error: { code: string; message: string }
    }
    expect(body.error.code).toBe('invalid_api_key')
    expect(body.error.message).toMatch(/Authorization/)
    expect(body.error.message).toMatch(/Bearer/)
  })

  it('401s a malformed Authorization header (no Bearer scheme)', async () => {
    const app = buildApp()

    const res = await app.request('/mcp', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: JSONRPC_ACCEPT,
        Authorization: 'dp_test_abc123',
      },
      body: JSON.stringify(initializeRequestBody()),
    })

    expect(res.status).toBe(401)
  })

  it('401s a Bearer header with no token', async () => {
    const app = buildApp()

    const res = await app.request('/mcp', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: JSONRPC_ACCEPT,
        Authorization: 'Bearer ',
      },
      body: JSON.stringify(initializeRequestBody()),
    })

    expect(res.status).toBe(401)
  })

  it('reaches the MCP transport with a well-formed Authorization header — the initialize handshake never calls the downstream API, so an unvalidated key is enough to prove the wiring', async () => {
    const app = buildApp()

    const res = await app.request('/mcp', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: JSONRPC_ACCEPT,
        Authorization: 'Bearer dp_test_unvalidated',
      },
      body: JSON.stringify(initializeRequestBody()),
    })

    expect(res.status).toBe(200)
    const body = (await res.json()) as {
      result?: { serverInfo?: { name: string; version: string } }
    }
    expect(body.result?.serverInfo).toEqual({
      name: 'domainproof',
      version: '0.0.0-test',
    })
  })
})
