import { describe, expect, it } from 'vitest'
import { signPayload, verifySignature } from './signing'

// Fixed inputs, computed once and pinned here as a regression check on the
// signing algorithm itself (HMAC-SHA256 over `${timestamp}.${body}`, hex,
// `sha256=`-prefixed) — a passing test here means the scheme documented in
// README.md still matches what the code actually produces.
const SECRET = 'whsec_test_secret'
const TIMESTAMP = '1700000000'
const BODY = '{"id":"evt_1","type":"domain.verified","data":{}}'
const EXPECTED_SIGNATURE =
  'sha256=cb1afc32a4ad6de9c43c5ee59ce5100a9e3e90da3361b529d539c2b02f3b56a9'

describe('signPayload', () => {
  it('matches the pinned vector for a fixed secret/timestamp/body', () => {
    expect(signPayload(SECRET, TIMESTAMP, BODY)).toBe(EXPECTED_SIGNATURE)
  })

  it('is deterministic for the same inputs', () => {
    expect(signPayload(SECRET, TIMESTAMP, BODY)).toBe(
      signPayload(SECRET, TIMESTAMP, BODY),
    )
  })

  it('changes if the body changes', () => {
    expect(signPayload(SECRET, TIMESTAMP, BODY)).not.toBe(
      signPayload(SECRET, TIMESTAMP, `${BODY}x`),
    )
  })

  it('changes if the timestamp changes', () => {
    expect(signPayload(SECRET, TIMESTAMP, BODY)).not.toBe(
      signPayload(SECRET, '1700000001', BODY),
    )
  })

  it('changes if the secret changes', () => {
    expect(signPayload(SECRET, TIMESTAMP, BODY)).not.toBe(
      signPayload('whsec_other_secret', TIMESTAMP, BODY),
    )
  })
})

describe('verifySignature', () => {
  it('accepts a signature produced by signPayload', () => {
    const signature = signPayload(SECRET, TIMESTAMP, BODY)
    expect(verifySignature(SECRET, TIMESTAMP, BODY, signature)).toBe(true)
  })

  it('rejects a signature for the wrong secret', () => {
    const signature = signPayload('whsec_other_secret', TIMESTAMP, BODY)
    expect(verifySignature(SECRET, TIMESTAMP, BODY, signature)).toBe(false)
  })

  it('rejects a tampered body', () => {
    const signature = signPayload(SECRET, TIMESTAMP, BODY)
    expect(verifySignature(SECRET, TIMESTAMP, `${BODY}x`, signature)).toBe(
      false,
    )
  })

  it('rejects a malformed signature without throwing', () => {
    expect(verifySignature(SECRET, TIMESTAMP, BODY, 'not-a-signature')).toBe(
      false,
    )
  })
})
