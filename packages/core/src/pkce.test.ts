import { createHash } from 'node:crypto'
import { describe, expect, it } from 'vitest'

import { codeChallengeFromVerifier, generateCodeVerifier } from './pkce'

describe('generateCodeVerifier', () => {
  it('produces unpadded base64url-alphabet verifiers', () => {
    for (let i = 0; i < 100; i++) {
      expect(generateCodeVerifier()).toMatch(/^[A-Za-z0-9_-]+$/)
    }
  })

  it('produces unique verifiers across many generations', () => {
    const verifiers = new Set(
      Array.from({ length: 1000 }, () => generateCodeVerifier()),
    )
    expect(verifiers.size).toBe(1000)
  })
})

describe('codeChallengeFromVerifier', () => {
  it('is deterministic for the same verifier', () => {
    const verifier = generateCodeVerifier()

    expect(codeChallengeFromVerifier(verifier)).toBe(
      codeChallengeFromVerifier(verifier),
    )
  })

  it('matches the RFC 7636 S256 definition (BASE64URL(SHA256(verifier)))', () => {
    const verifier = 'a-fixed-test-verifier-value'
    const expected = createHash('sha256').update(verifier).digest('base64url')

    expect(codeChallengeFromVerifier(verifier)).toBe(expected)
  })

  it('produces different challenges for different verifiers', () => {
    expect(codeChallengeFromVerifier('verifier-one')).not.toBe(
      codeChallengeFromVerifier('verifier-two'),
    )
  })
})
