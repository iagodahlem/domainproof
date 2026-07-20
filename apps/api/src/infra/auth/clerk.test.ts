import { exportJWK, generateKeyPair, SignJWT, type JWK } from 'jose'
import {
  afterEach,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from 'vitest'
import { createClerkSessionVerifier } from './clerk'

const JWKS_URL = 'https://clerk.test/.well-known/jwks.json'
const ISSUER = 'https://clerk.test'

let privateKey: CryptoKey
let jwk: JWK & { kid: string }

beforeAll(async () => {
  const { privateKey: priv, publicKey } = await generateKeyPair('RS256')
  privateKey = priv
  jwk = { ...(await exportJWK(publicKey)), kid: 'test-key' }
})

async function signToken(
  overrides: {
    issuer?: string
    expiresIn?: string
    subject?: string | undefined
    omitSubject?: boolean
  } = {},
) {
  const builder = new SignJWT({})
    .setProtectedHeader({ alg: 'RS256', kid: jwk.kid })
    .setIssuedAt()
    .setIssuer(overrides.issuer ?? ISSUER)
    .setExpirationTime(overrides.expiresIn ?? '1h')

  if (!overrides.omitSubject) {
    builder.setSubject(overrides.subject ?? 'user_123')
  }

  return builder.sign(privateKey)
}

describe('createClerkSessionVerifier', () => {
  let fetchSpy: ReturnType<typeof vi.spyOn>

  beforeEach(() => {
    // Stub the global fetch jose's createRemoteJWKSet uses internally, so
    // the JWKS is served from a locally generated keypair with no real
    // network call ever happening.
    fetchSpy = vi.spyOn(globalThis, 'fetch').mockImplementation(async () => {
      return new Response(JSON.stringify({ keys: [jwk] }), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      })
    })
  })

  afterEach(() => {
    fetchSpy.mockRestore()
  })

  it('returns invalid_or_expired for an expired token', async () => {
    const verifier = createClerkSessionVerifier({
      jwksUrl: JWKS_URL,
      issuer: ISSUER,
    })
    const token = await signToken({ expiresIn: '-10s' })

    expect(await verifier.verify(token)).toEqual({
      ok: false,
      reason: 'invalid_or_expired',
    })
  })

  it('returns invalid_or_expired for a token with the wrong issuer', async () => {
    const verifier = createClerkSessionVerifier({
      jwksUrl: JWKS_URL,
      issuer: ISSUER,
    })
    const token = await signToken({ issuer: 'https://not-clerk.test' })

    expect(await verifier.verify(token)).toEqual({
      ok: false,
      reason: 'invalid_or_expired',
    })
  })

  it('returns invalid_or_expired for a malformed token', async () => {
    const verifier = createClerkSessionVerifier({
      jwksUrl: JWKS_URL,
      issuer: ISSUER,
    })

    expect(await verifier.verify('not-a-jwt')).toEqual({
      ok: false,
      reason: 'invalid_or_expired',
    })
  })

  it('returns missing_subject for a token with no subject claim', async () => {
    const verifier = createClerkSessionVerifier({
      jwksUrl: JWKS_URL,
      issuer: ISSUER,
    })
    const token = await signToken({ omitSubject: true })

    expect(await verifier.verify(token)).toEqual({
      ok: false,
      reason: 'missing_subject',
    })
  })

  it('returns the subject as the user id for a valid token', async () => {
    const verifier = createClerkSessionVerifier({
      jwksUrl: JWKS_URL,
      issuer: ISSUER,
    })
    const token = await signToken({ subject: 'user_abc' })

    expect(await verifier.verify(token)).toEqual({
      ok: true,
      claims: { userId: 'user_abc' },
    })
  })
})
