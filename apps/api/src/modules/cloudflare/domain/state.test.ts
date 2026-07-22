import { describe, expect, it } from 'vitest'
import { STATE_TTL_MS, signState, verifyState } from './state'

const SECRET = 'test-client-secret'
const PAYLOAD = { frontendToken: 'ftok_abc', codeVerifier: 'verifier_xyz' }

describe('signState / verifyState', () => {
  it('round-trips a payload signed and verified with the same secret', () => {
    const state = signState(PAYLOAD, SECRET)

    const result = verifyState(state, SECRET)

    expect(result).toEqual({ ok: true, payload: PAYLOAD })
  })

  it('rejects a state signed with a different secret', () => {
    const state = signState(PAYLOAD, SECRET)

    const result = verifyState(state, 'a-different-secret')

    expect(result).toEqual({ ok: false, reason: 'invalid' })
  })

  it('rejects a tampered payload even if the signature segment is untouched', () => {
    const state = signState(PAYLOAD, SECRET)
    const [, signature] = state.split('.')
    const tamperedPayload = Buffer.from(
      JSON.stringify({ ...PAYLOAD, frontendToken: 'attacker-controlled' }),
    ).toString('base64url')

    const result = verifyState(`${tamperedPayload}.${signature}`, SECRET)

    expect(result).toEqual({ ok: false, reason: 'invalid' })
  })

  it('rejects a malformed state with no signature separator', () => {
    const result = verifyState('not-a-valid-state', SECRET)

    expect(result).toEqual({ ok: false, reason: 'invalid' })
  })

  it('rejects garbage that happens to contain a dot', () => {
    const result = verifyState('garbage.moregarbage', SECRET)

    expect(result).toEqual({ ok: false, reason: 'invalid' })
  })

  it('is valid just before the ttl elapses', () => {
    const issuedAt = new Date('2026-01-01T00:00:00.000Z')
    const state = signState(PAYLOAD, SECRET, () => issuedAt)

    const result = verifyState(
      state,
      SECRET,
      () => new Date(issuedAt.getTime() + STATE_TTL_MS - 1),
    )

    expect(result).toEqual({ ok: true, payload: PAYLOAD })
  })

  it('is expired exactly at the ttl boundary', () => {
    const issuedAt = new Date('2026-01-01T00:00:00.000Z')
    const state = signState(PAYLOAD, SECRET, () => issuedAt)

    const result = verifyState(
      state,
      SECRET,
      () => new Date(issuedAt.getTime() + STATE_TTL_MS),
    )

    expect(result).toEqual({ ok: false, reason: 'expired' })
  })
})
