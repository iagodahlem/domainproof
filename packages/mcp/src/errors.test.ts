import { describe, expect, it } from 'vitest'
import { DomainProofApiError } from '@domainproof/sdk'
import { describeError } from './errors'

describe('describeError', () => {
  it('gives an actionable message for an invalid api key', () => {
    const error = new DomainProofApiError(
      'invalid_api_key',
      'Invalid API key',
      401,
    )
    expect(describeError(error)).toMatch(/dashboard/i)
  })

  it('gives an actionable message for a not-found domain, pointing to list_domains', () => {
    const error = new DomainProofApiError('not_found', 'Domain not found', 404)
    expect(describeError(error)).toMatch(/list_domains/)
  })

  it('gives an actionable message for a rate-limited request', () => {
    const error = new DomainProofApiError(
      'rate_limited',
      'Too many requests',
      429,
    )
    expect(describeError(error)).toMatch(/wait/i)
  })

  it('gives an actionable message for a network error', () => {
    const error = new DomainProofApiError('network_error', 'fetch failed', 0)
    expect(describeError(error)).toMatch(/DOMAINPROOF_BASE_URL/)
  })

  it('falls back to the api-provided message for codes without an override', () => {
    const error = new DomainProofApiError(
      'domain_already_claimed',
      'This domain is already claimed for this project.',
      409,
    )
    expect(describeError(error)).toBe(
      'This domain is already claimed for this project.',
    )
  })
})
