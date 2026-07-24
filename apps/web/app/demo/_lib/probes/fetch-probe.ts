const DEFAULT_TIMEOUT_MS = 8_000
// Bounds how much of the body tech-fingerprint.ts reads looking for markup
// hints (__NEXT_DATA__, a generator meta tag, ...) — those all show up near
// the top of the document, so there's no reason to buffer an entire page.
const MAX_BODY_SAMPLE_BYTES = 20_000
const USER_AGENT = 'SitegradeBot/1.0 (+https://domainproof.dev/demo)'

export interface FetchProbeSuccess {
  ok: true
  status: number
  headers: Headers
  timingMs: number
  finalUrl: string
  bodySample: string
  setCookies: string[]
}

export interface FetchProbeFailure {
  ok: false
  reason: 'timeout' | 'network_error'
  message: string
}

export type FetchProbeResult = FetchProbeSuccess | FetchProbeFailure

export interface FetchProbeOptions {
  timeoutMs?: number
  fetchImpl?: typeof fetch
}

async function readBodySample(res: Response): Promise<string> {
  const reader = res.body?.getReader()
  if (!reader) {
    return ''
  }

  const decoder = new TextDecoder()
  let received = 0
  let text = ''
  try {
    while (received < MAX_BODY_SAMPLE_BYTES) {
      const { done, value } = await reader.read()
      if (done || !value) {
        break
      }
      const remaining = MAX_BODY_SAMPLE_BYTES - received
      const chunk =
        value.byteLength > remaining ? value.subarray(0, remaining) : value
      received += chunk.byteLength
      text += decoder.decode(chunk, { stream: true })
    }
  } finally {
    await reader.cancel().catch(() => undefined)
  }
  return text
}

/** One HTTPS GET against `https://<domain>/`, shared by every check that needs response headers, timing, or a body sample — one round trip instead of one per check. */
export async function runFetchProbe(
  domain: string,
  options: FetchProbeOptions = {},
): Promise<FetchProbeResult> {
  const fetchImpl = options.fetchImpl ?? fetch
  const timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), timeoutMs)
  const startedAt = performance.now()

  try {
    const res = await fetchImpl(`https://${domain}/`, {
      redirect: 'follow',
      signal: controller.signal,
      headers: { 'User-Agent': USER_AGENT },
    })
    const timingMs = Math.round(performance.now() - startedAt)
    const bodySample = await readBodySample(res)

    return {
      ok: true,
      status: res.status,
      headers: res.headers,
      timingMs,
      finalUrl: res.url,
      bodySample,
      setCookies: res.headers.getSetCookie?.() ?? [],
    }
  } catch (err) {
    return {
      ok: false,
      reason: controller.signal.aborted ? 'timeout' : 'network_error',
      message: err instanceof Error ? err.message : String(err),
    }
  } finally {
    clearTimeout(timer)
  }
}
