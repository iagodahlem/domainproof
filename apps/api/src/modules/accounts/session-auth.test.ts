import { Hono } from "hono";
import { describe, expect, it } from "vitest";
import { createSessionAuthMiddleware } from "./session-auth";
import type { SessionVerifier, SessionVerifyResult } from "./session-verifier";

/**
 * A fake {@link SessionVerifier} implementing the port directly — no real
 * token verification, no crypto, no network. The real verifier's own
 * behavior (JWKS fetch, JWT signature/issuer/expiry/subject checks) is
 * infra concern, tested in `infra/auth/clerk.test.ts`; this file only
 * tests the middleware's job — reading the header, calling the verifier,
 * mapping the result to a response.
 */
function fakeVerifier(results: Record<string, SessionVerifyResult>): SessionVerifier {
  return {
    async verify(token) {
      return results[token] ?? { ok: false, reason: "invalid_or_expired" };
    },
  };
}

function buildApp(verifier: SessionVerifier | undefined) {
  const app = new Hono();
  app.get("/protected", createSessionAuthMiddleware(verifier), (c) => {
    return c.json({ userId: c.get("userId") });
  });
  return app;
}

describe("createSessionAuthMiddleware", () => {
  it("returns 500 with a clear error code when unconfigured", async () => {
    const app = buildApp(undefined);
    const res = await app.request("/protected");

    expect(res.status).toBe(500);
    const body = (await res.json()) as { error: { code: string } };
    expect(body.error.code).toBe("auth_not_configured");
  });

  it("returns 401 when the Authorization header is missing, without calling the verifier", async () => {
    let calls = 0;
    const verifier: SessionVerifier = {
      async verify() {
        calls += 1;
        return { ok: true, claims: { userId: "user_123" } };
      },
    };
    const app = buildApp(verifier);
    const res = await app.request("/protected");

    expect(res.status).toBe(401);
    const body = (await res.json()) as { error: { code: string } };
    expect(body.error.code).toBe("unauthorized");
    expect(calls).toBe(0);
  });

  it("returns 401 when the Authorization header is malformed", async () => {
    const app = buildApp(fakeVerifier({}));
    const res = await app.request("/protected", {
      headers: { Authorization: "Basic abc123" },
    });

    expect(res.status).toBe(401);
  });

  it("returns 401 when the verifier reports invalid_or_expired", async () => {
    const app = buildApp(
      fakeVerifier({ "bad-token": { ok: false, reason: "invalid_or_expired" } }),
    );
    const res = await app.request("/protected", {
      headers: { Authorization: "Bearer bad-token" },
    });

    expect(res.status).toBe(401);
  });

  it("returns 401 when the verifier reports missing_subject", async () => {
    const app = buildApp(
      fakeVerifier({ "no-subject": { ok: false, reason: "missing_subject" } }),
    );
    const res = await app.request("/protected", {
      headers: { Authorization: "Bearer no-subject" },
    });

    expect(res.status).toBe(401);
  });

  it("passes and sets the user id for a token the verifier accepts", async () => {
    const app = buildApp(
      fakeVerifier({
        "good-token": { ok: true, claims: { userId: "user_abc" } },
      }),
    );
    const res = await app.request("/protected", {
      headers: { Authorization: "Bearer good-token" },
    });

    expect(res.status).toBe(200);
    const body = (await res.json()) as { userId: string };
    expect(body.userId).toBe("user_abc");
  });
});
