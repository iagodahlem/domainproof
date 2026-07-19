import { randomUUID } from "node:crypto";
import { eq } from "drizzle-orm";
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
import { createApp } from "../../app";
import { createDb, type Database } from "@infra/db/client";
import { accounts } from "@infra/db/schema";

// Drives the real Clerk middleware (not a stub) the same way
// auth/clerk.test.ts does: a locally generated RS256 keypair served as
// the JWKS, with `globalThis.fetch` stubbed so `createRemoteJWKSet` never
// makes a real network call. This exercises the actual auth path the
// production app mounts, rather than a faked "assume authenticated"
// context — chosen over stubbing because these tests are also the only
// coverage of `/v1/keys` wiring end to end (route mounting, project
// resolution, cross-account scoping).
const JWKS_URL = "https://clerk.test/.well-known/jwks.json";
const ISSUER = "https://clerk.test";

const DATABASE_URL =
  process.env.DATABASE_URL ??
  "postgres://domainproof:domainproof@localhost:5432/domainproof";

const db: Database = createDb(DATABASE_URL);
const createdClerkUserIds: string[] = [];

let privateKey: CryptoKey;
let jwk: JWK & { kid: string };

beforeAll(async () => {
  const { privateKey: priv, publicKey } = await generateKeyPair("RS256");
  privateKey = priv;
  jwk = { ...(await exportJWK(publicKey)), kid: "test-key" };
});

async function tokenFor(clerkUserId: string) {
  return new SignJWT({})
    .setProtectedHeader({ alg: "RS256", kid: jwk.kid })
    .setIssuedAt()
    .setIssuer(ISSUER)
    .setSubject(clerkUserId)
    .setExpirationTime("1h")
    .sign(privateKey);
}

function freshClerkUserId() {
  const id = `user_${randomUUID()}`;
  createdClerkUserIds.push(id);
  return id;
}

function buildApp() {
  return createApp({ db, clerkConfig: { jwksUrl: JWKS_URL, issuer: ISSUER } });
}

async function asUser(app: ReturnType<typeof buildApp>, clerkUserId: string, path: string, init: RequestInit = {}) {
  const token = await tokenFor(clerkUserId);
  return app.request(path, {
    ...init,
    headers: {
      ...init.headers,
      Authorization: `Bearer ${token}`,
    },
  });
}

describe("/v1/keys", () => {
  let fetchSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    fetchSpy = vi.spyOn(globalThis, "fetch").mockImplementation(async () => {
      return new Response(JSON.stringify({ keys: [jwk] }), {
        status: 200,
        headers: { "content-type": "application/json" },
      });
    });
  });

  afterEach(async () => {
    fetchSpy.mockRestore();
    while (createdClerkUserIds.length > 0) {
      const clerkUserId = createdClerkUserIds.pop();
      if (clerkUserId) {
        await db.delete(accounts).where(eq(accounts.clerkUserId, clerkUserId));
      }
    }
  });

  it("rejects unauthenticated requests", async () => {
    const app = buildApp();
    const res = await app.request("/v1/keys");
    expect(res.status).toBe(401);
  });

  it("creates, lists, and never returns secret material", async () => {
    const app = buildApp();
    const clerkUserId = freshClerkUserId();

    const createRes = await asUser(app, clerkUserId, "/v1/keys", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ mode: "live", name: "Production" }),
    });
    expect(createRes.status).toBe(201);

    const created = (await createRes.json()) as {
      key: string;
      apiKey: { keyId: string; name: string | null };
    };
    expect(created.key).toMatch(/^dp_live_[a-z2-7]{12}_[a-z2-7]{26}$/);
    expect(created.apiKey.name).toBe("Production");

    const listRes = await asUser(app, clerkUserId, "/v1/keys");
    expect(listRes.status).toBe(200);
    const listBody = (await listRes.json()) as { apiKeys: Array<Record<string, unknown>> };
    expect(listBody.apiKeys).toHaveLength(1);

    const serialized = JSON.stringify(listBody);
    expect(serialized).not.toContain("secretHash");
    expect(serialized).not.toContain(created.key);
    // No 26-char base32 secret substring anywhere in the list response.
    expect(serialized).not.toMatch(/[a-z2-7]{26}/);
  });

  it("rejects a malformed create body", async () => {
    const app = buildApp();
    const clerkUserId = freshClerkUserId();

    const res = await asUser(app, clerkUserId, "/v1/keys", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ mode: "not-a-mode" }),
    });
    expect(res.status).toBe(400);
    const body = (await res.json()) as { error: { code: string } };
    expect(body.error.code).toBe("invalid_request");
  });

  it("revokes a key", async () => {
    const app = buildApp();
    const clerkUserId = freshClerkUserId();

    const createRes = await asUser(app, clerkUserId, "/v1/keys", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ mode: "test" }),
    });
    const created = (await createRes.json()) as { apiKey: { keyId: string } };

    const revokeRes = await asUser(
      app,
      clerkUserId,
      `/v1/keys/${created.apiKey.keyId}/revoke`,
      { method: "POST" },
    );
    expect(revokeRes.status).toBe(200);
    const revoked = (await revokeRes.json()) as { apiKey: { revokedAt: string | null } };
    expect(revoked.apiKey.revokedAt).not.toBeNull();
  });

  it("rotates a key: old dead, new works, same name", async () => {
    const app = buildApp();
    const clerkUserId = freshClerkUserId();

    const createRes = await asUser(app, clerkUserId, "/v1/keys", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ mode: "live", name: "Rotate target" }),
    });
    const created = (await createRes.json()) as {
      key: string;
      apiKey: { keyId: string; name: string | null };
    };

    const rotateRes = await asUser(
      app,
      clerkUserId,
      `/v1/keys/${created.apiKey.keyId}/rotate`,
      { method: "POST" },
    );
    expect(rotateRes.status).toBe(200);
    const rotated = (await rotateRes.json()) as {
      key: string;
      apiKey: { keyId: string; name: string | null };
    };

    expect(rotated.apiKey.name).toBe("Rotate target");
    expect(rotated.apiKey.keyId).not.toBe(created.apiKey.keyId);

    const listRes = await asUser(app, clerkUserId, "/v1/keys");
    const listBody = (await listRes.json()) as {
      apiKeys: Array<{ keyId: string; revokedAt: string | null }>;
    };
    const oldEntry = listBody.apiKeys.find((k) => k.keyId === created.apiKey.keyId);
    const newEntry = listBody.apiKeys.find((k) => k.keyId === rotated.apiKey.keyId);
    expect(oldEntry?.revokedAt).not.toBeNull();
    expect(newEntry?.revokedAt).toBeNull();
  });

  it("404s (not 403) when acting on another account's key", async () => {
    const app = buildApp();
    const ownerId = freshClerkUserId();
    const otherId = freshClerkUserId();

    const createRes = await asUser(app, ownerId, "/v1/keys", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ mode: "test" }),
    });
    const created = (await createRes.json()) as { apiKey: { keyId: string } };

    const revokeAsOther = await asUser(
      app,
      otherId,
      `/v1/keys/${created.apiKey.keyId}/revoke`,
      { method: "POST" },
    );
    expect(revokeAsOther.status).toBe(404);
    const body = (await revokeAsOther.json()) as { error: { code: string } };
    expect(body.error.code).toBe("not_found");

    const rotateAsOther = await asUser(
      app,
      otherId,
      `/v1/keys/${created.apiKey.keyId}/rotate`,
      { method: "POST" },
    );
    expect(rotateAsOther.status).toBe(404);

    // And it's untouched from the owner's perspective.
    const listRes = await asUser(app, ownerId, "/v1/keys");
    const listBody = (await listRes.json()) as {
      apiKeys: Array<{ keyId: string; revokedAt: string | null }>;
    };
    expect(listBody.apiKeys.find((k) => k.keyId === created.apiKey.keyId)?.revokedAt).toBeNull();
  });

  it("returns 404 for an unknown key id", async () => {
    const app = buildApp();
    const clerkUserId = freshClerkUserId();

    const res = await asUser(
      app,
      clerkUserId,
      "/v1/keys/doesnotexist1/revoke",
      { method: "POST" },
    );
    expect(res.status).toBe(404);
  });
});
