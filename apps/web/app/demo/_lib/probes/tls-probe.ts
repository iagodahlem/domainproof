import * as tls from 'node:tls'

const DEFAULT_TIMEOUT_MS = 8_000
const MS_PER_DAY = 24 * 60 * 60 * 1000

// A certificate's issuer O/CN can legally be multi-valued (an array) per
// Node's PeerCertificate typing, even though it's virtually always a single
// string in practice — take the first value rather than joining, since a
// summary line has no good way to render more than one anyway.
function firstValue(field: string | string[] | undefined): string | undefined {
  if (Array.isArray(field)) return field[0]
  return field
}

export interface TlsProbeSuccess {
  ok: true
  protocol: string | null
  issuer: string
  validTo: string
  daysUntilExpiry: number
  authorized: boolean
}

export interface TlsProbeFailure {
  ok: false
  reason: 'timeout' | 'connection_error' | 'no_certificate'
  message: string
}

export type TlsProbeResult = TlsProbeSuccess | TlsProbeFailure

export interface TlsProbeOptions {
  timeoutMs?: number
  connect?: typeof tls.connect
}

/**
 * Opens a raw TLS connection to inspect the certificate DomainProof's own
 * verification flow never needs to look at: protocol version, issuer, and
 * days until expiry. `rejectUnauthorized: false` is deliberate — an
 * untrusted/expired cert is exactly the thing this check exists to report,
 * so the handshake has to succeed far enough to read it rather than
 * throwing before `httpsTlsCheck` gets a chance to grade it.
 */
export function runTlsProbe(
  domain: string,
  options: TlsProbeOptions = {},
): Promise<TlsProbeResult> {
  const connectImpl = options.connect ?? tls.connect
  const timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS

  return new Promise((resolve) => {
    let settled = false
    const socket = connectImpl({
      host: domain,
      port: 443,
      servername: domain,
      timeout: timeoutMs,
      rejectUnauthorized: false,
    })

    function finish(result: TlsProbeResult) {
      if (settled) return
      settled = true
      socket.destroy()
      resolve(result)
    }

    socket.once('timeout', () =>
      finish({
        ok: false,
        reason: 'timeout',
        message: 'TLS handshake timed out',
      }),
    )
    socket.once('error', (err: Error) =>
      finish({ ok: false, reason: 'connection_error', message: err.message }),
    )
    socket.once('secureConnect', () => {
      const cert = socket.getPeerCertificate()
      if (!cert || Object.keys(cert).length === 0) {
        finish({
          ok: false,
          reason: 'no_certificate',
          message: 'Server presented no certificate',
        })
        return
      }

      const validTo = new Date(cert.valid_to)
      const daysUntilExpiry = Math.round(
        (validTo.getTime() - Date.now()) / MS_PER_DAY,
      )

      finish({
        ok: true,
        protocol: socket.getProtocol(),
        issuer:
          firstValue(cert.issuer?.O) ??
          firstValue(cert.issuer?.CN) ??
          'Unknown issuer',
        validTo: validTo.toISOString(),
        daysUntilExpiry,
        authorized: socket.authorized,
      })
    })
  })
}
