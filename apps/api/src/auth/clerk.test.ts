import { Hono } from "hono";
import { exportJWK, generateKeyPair, SignJWT, type JWK } from "jose";
import {
  afterEach,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vitest";
import { createClerkAuthMiddleware } from "./clerk.js";

const JWKS_URL = "https://clerk.test/.well-known/jwks.json";
const ISSUER = "https://clerk.test";

let privateKey: CryptoKey;
let jwk: JWK & { kid: string };

beforeAll(async () => {
  const { privateKey: priv, publicKey } = await generateKeyPair("RS256");
  privateKey = priv;
  jwk = { ...(await exportJWK(publicKey)), kid: "test-key" };
});

async function signToken(overrides: {
  issuer?: string;
  expiresIn?: string;
  subject?: string | undefined;
  omitSubject?: boolean;
} = {}) {
  const builder = new SignJWT({})
    .setProtectedHeader({ alg: "RS256", kid: jwk.kid })
    .setIssuedAt()
    .setIssuer(overrides.issuer ?? ISSUER)
    .setExpirationTime(overrides.expiresIn ?? "1h");

  if (!overrides.omitSubject) {
    builder.setSubject(overrides.subject ?? "user_123");
  }

  return builder.sign(privateKey);
}

function buildApp(config: { jwksUrl?: string; issuer?: string }) {
  const app = new Hono();
  app.get("/protected", createClerkAuthMiddleware(config), (c) => {
    return c.json({ clerkUserId: c.get("clerkUserId") });
  });
  return app;
}

describe("createClerkAuthMiddleware", () => {
  let fetchSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    // Stub the global fetch jose's createRemoteJWKSet uses internally, so
    // the JWKS is served from a locally generated keypair with no real
    // network call ever happening.
    fetchSpy = vi.spyOn(globalThis, "fetch").mockImplementation(async () => {
      return new Response(JSON.stringify({ keys: [jwk] }), {
        status: 200,
        headers: { "content-type": "application/json" },
      });
    });
  });

  afterEach(() => {
    fetchSpy.mockRestore();
  });

  it("returns 500 with a clear error code when unconfigured", async () => {
    const app = buildApp({});
    const res = await app.request("/protected");

    expect(res.status).toBe(500);
    const body = (await res.json()) as { error: { code: string } };
    expect(body.error.code).toBe("auth_not_configured");
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("returns 401 when the Authorization header is missing", async () => {
    const app = buildApp({ jwksUrl: JWKS_URL, issuer: ISSUER });
    const res = await app.request("/protected");

    expect(res.status).toBe(401);
    const body = (await res.json()) as { error: { code: string } };
    expect(body.error.code).toBe("unauthorized");
  });

  it("returns 401 when the Authorization header is malformed", async () => {
    const app = buildApp({ jwksUrl: JWKS_URL, issuer: ISSUER });
    const res = await app.request("/protected", {
      headers: { Authorization: "Basic abc123" },
    });

    expect(res.status).toBe(401);
  });

  it("returns 401 for an expired token", async () => {
    const app = buildApp({ jwksUrl: JWKS_URL, issuer: ISSUER });
    const token = await signToken({ expiresIn: "-10s" });

    const res = await app.request("/protected", {
      headers: { Authorization: `Bearer ${token}` },
    });

    expect(res.status).toBe(401);
  });

  it("returns 401 for a token with the wrong issuer", async () => {
    const app = buildApp({ jwksUrl: JWKS_URL, issuer: ISSUER });
    const token = await signToken({ issuer: "https://not-clerk.test" });

    const res = await app.request("/protected", {
      headers: { Authorization: `Bearer ${token}` },
    });

    expect(res.status).toBe(401);
  });

  it("returns 401 for a token missing a subject claim", async () => {
    const app = buildApp({ jwksUrl: JWKS_URL, issuer: ISSUER });
    const token = await signToken({ omitSubject: true });

    const res = await app.request("/protected", {
      headers: { Authorization: `Bearer ${token}` },
    });

    expect(res.status).toBe(401);
  });

  it("passes and sets the clerk user id for a valid token", async () => {
    const app = buildApp({ jwksUrl: JWKS_URL, issuer: ISSUER });
    const token = await signToken({ subject: "user_abc" });

    const res = await app.request("/protected", {
      headers: { Authorization: `Bearer ${token}` },
    });

    expect(res.status).toBe(200);
    const body = (await res.json()) as { clerkUserId: string };
    expect(body.clerkUserId).toBe("user_abc");
  });
});
