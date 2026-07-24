import { describe, expect, it } from 'vitest'
import { runScan } from './run-scan'

/**
 * Real DNS/TLS/HTTP against a domain we don't control — skipped by default
 * since CI shouldn't fail because example.com changed its headers or a
 * runner has no outbound network. Run explicitly with
 * `RUN_LIVE_NETWORK_TESTS=1 pnpm --filter web test`.
 */
describe.skipIf(!process.env.RUN_LIVE_NETWORK_TESTS)('runScan (live)', () => {
  it('produces a full 9-check report for example.com', async () => {
    const result = await runScan('example.com')

    expect(result.ok).toBe(true)
    if (!result.ok)
      throw new Error(`expected ok outcome, got: ${result.reason}`)
    expect(result.report.checks).toHaveLength(9)
    const tlsCheck = result.report.checks.find((c) => c.id === 'https-tls')
    expect(tlsCheck?.status).not.toBe('fail')
  }, 20_000)
})
