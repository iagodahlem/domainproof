import { EventEmitter } from 'node:events'
import { describe, expect, it, vi } from 'vitest'
import { runTlsProbe } from './tls-probe'

class FakeSocket extends EventEmitter {
  destroy = vi.fn()
  getPeerCertificate = vi.fn()
  getProtocol = vi.fn()
  authorized = true
}

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

    const result = await runTlsProbe('example.com', { connect })

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

    const result = await runTlsProbe('down.example', { connect })

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

    const result = await runTlsProbe('slow.example', { connect })

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

    const result = await runTlsProbe('example.com', { connect })

    expect(result).toEqual({
      ok: false,
      reason: 'no_certificate',
      message: 'Server presented no certificate',
    })
  })
})
