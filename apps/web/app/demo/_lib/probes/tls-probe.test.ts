import { EventEmitter } from 'node:events'
import { describe, expect, it, vi } from 'vitest'
import { runTlsProbe } from './tls-probe'

class FakeSocket extends EventEmitter {
  destroy = vi.fn()
  getPeerCertificate = vi.fn()
  getProtocol = vi.fn()
  authorized = true
}

// A resolveAll fake standing in for real DNS across every test below, so
// none of them depend on outbound network access — see ssrf-guard.test.ts
// for the guard's own DNS-resolution behavior and blocking rules.
const resolveToPublicAddress = async () => [
  { address: '93.184.216.34', family: 4 },
]

describe('runTlsProbe', () => {
  it('reports protocol, issuer, and days until expiry on success', async () => {
    const socket = new FakeSocket()
    const validTo = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)
    socket.getPeerCertificate.mockReturnValue({
      valid_to: validTo.toUTCString(),
      issuer: { O: "Let's Encrypt" },
    })
    socket.getProtocol.mockReturnValue('TLSv1.3')

    const connect = vi.fn(() => {
      queueMicrotask(() => socket.emit('secureConnect'))
      return socket as unknown as import('node:tls').TLSSocket
    })

    const result = await runTlsProbe('example.com', {
      connect,
      resolveAll: resolveToPublicAddress,
    })

    expect(result.ok).toBe(true)
    if (!result.ok) throw new Error('expected ok result')
    expect(result.protocol).toBe('TLSv1.3')
    expect(result.issuer).toBe("Let's Encrypt")
    expect(result.authorized).toBe(true)
    expect(result.daysUntilExpiry).toBeGreaterThanOrEqual(28)
    expect(result.daysUntilExpiry).toBeLessThanOrEqual(30)
    expect(socket.destroy).toHaveBeenCalled()
  })

  it('reports connection errors as a failure', async () => {
    const socket = new FakeSocket()
    const connect = vi.fn(() => {
      queueMicrotask(() => socket.emit('error', new Error('ECONNREFUSED')))
      return socket as unknown as import('node:tls').TLSSocket
    })

    const result = await runTlsProbe('down.example', {
      connect,
      resolveAll: resolveToPublicAddress,
    })

    expect(result).toEqual({
      ok: false,
      reason: 'connection_error',
      message: 'ECONNREFUSED',
    })
  })

  it('reports a timeout as a failure', async () => {
    const socket = new FakeSocket()
    const connect = vi.fn(() => {
      queueMicrotask(() => socket.emit('timeout'))
      return socket as unknown as import('node:tls').TLSSocket
    })

    const result = await runTlsProbe('slow.example', {
      connect,
      resolveAll: resolveToPublicAddress,
    })

    expect(result).toEqual({
      ok: false,
      reason: 'timeout',
      message: 'TLS handshake timed out',
    })
  })

  it('reports a missing certificate distinctly', async () => {
    const socket = new FakeSocket()
    socket.getPeerCertificate.mockReturnValue({})
    const connect = vi.fn(() => {
      queueMicrotask(() => socket.emit('secureConnect'))
      return socket as unknown as import('node:tls').TLSSocket
    })

    const result = await runTlsProbe('example.com', {
      connect,
      resolveAll: resolveToPublicAddress,
    })

    expect(result).toEqual({
      ok: false,
      reason: 'no_certificate',
      message: 'Server presented no certificate',
    })
  })

  it('refuses to connect when every resolved address is private, without touching the socket', async () => {
    const connect = vi.fn()

    const result = await runTlsProbe('internal.example', {
      connect,
      resolveAll: async () => [{ address: '10.0.0.5', family: 4 }],
    })

    expect(result).toEqual({
      ok: false,
      reason: 'connection_error',
      message: 'Resolved address is not allowed',
    })
    expect(connect).not.toHaveBeenCalled()
  })

  it('refuses a hostname that resolves to the cloud metadata address', async () => {
    const connect = vi.fn()

    const result = await runTlsProbe('metadata.example', {
      connect,
      resolveAll: async () => [{ address: '169.254.169.254', family: 4 }],
    })

    expect(result.ok).toBe(false)
    expect(connect).not.toHaveBeenCalled()
  })

  it('connects to a real hostname that resolves to loopback and is refused (no fake DNS involved)', async () => {
    const connect = vi.fn()

    const result = await runTlsProbe('localhost', { connect })

    expect(result.ok).toBe(false)
    expect(connect).not.toHaveBeenCalled()
  })
})
