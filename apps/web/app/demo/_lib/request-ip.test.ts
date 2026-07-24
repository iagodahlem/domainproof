import { describe, expect, it } from 'vitest'
import { clientIpFromHeaders } from './request-ip'

describe('clientIpFromHeaders', () => {
  it('prefers x-vercel-forwarded-for over a client-supplied x-forwarded-for', () => {
    expect(
      clientIpFromHeaders(
        new Headers({
          'x-vercel-forwarded-for': '1.2.3.4',
          'x-forwarded-for': '6.6.6.6',
        }),
      ),
    ).toBe('1.2.3.4')
  })

  it('takes the first hop from x-forwarded-for', () => {
    expect(
      clientIpFromHeaders(
        new Headers({ 'x-forwarded-for': '1.2.3.4, 5.6.7.8' }),
      ),
    ).toBe('1.2.3.4')
  })

  it('falls back to x-real-ip when x-forwarded-for is absent', () => {
    expect(clientIpFromHeaders(new Headers({ 'x-real-ip': '9.9.9.9' }))).toBe(
      '9.9.9.9',
    )
  })

  it('falls back to a constant when neither header is present', () => {
    expect(clientIpFromHeaders(new Headers())).toBe('unknown')
  })
})
