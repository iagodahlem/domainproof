import { describe, expect, it } from "vitest";

import { createFixtureFetcher } from "./fixture.js";

const URL = "https://example.com/.well-known/domainproof-challenge";

describe("createFixtureFetcher", () => {
  it("resolves the seeded response for a URL", async () => {
    const fetcher = createFixtureFetcher({
      [URL]: { ok: true, status: 200, body: "domainproof-verify=abc" },
    });

    expect(await fetcher.fetchText(URL)).toEqual({
      ok: true,
      status: 200,
      body: "domainproof-verify=abc",
    });
  });

  it("defaults an unseeded URL to connection_failed", async () => {
    const fetcher = createFixtureFetcher();

    expect(await fetcher.fetchText(URL)).toEqual({
      ok: false,
      reason: "connection_failed",
    });
  });

  it("records every call to fetchText in order", async () => {
    const fetcher = createFixtureFetcher({
      [URL]: { ok: true, status: 200, body: "domainproof-verify=abc" },
    });

    await fetcher.fetchText(URL);
    await fetcher.fetchText("https://other.example.com/.well-known/domainproof-challenge");
    await fetcher.fetchText(URL);

    expect(fetcher.calls).toEqual([
      URL,
      "https://other.example.com/.well-known/domainproof-challenge",
      URL,
    ]);
  });

  it("lets set() make a previously missing URL resolve (pending -> verified)", async () => {
    const fetcher = createFixtureFetcher();

    expect(await fetcher.fetchText(URL)).toEqual({
      ok: false,
      reason: "connection_failed",
    });

    fetcher.set(URL, { ok: true, status: 200, body: "domainproof-verify=abc" });

    expect(await fetcher.fetchText(URL)).toEqual({
      ok: true,
      status: 200,
      body: "domainproof-verify=abc",
    });
  });

  it("lets set() lapse a previously resolving URL (verified -> lapsed)", async () => {
    const fetcher = createFixtureFetcher({
      [URL]: { ok: true, status: 200, body: "domainproof-verify=abc" },
    });

    expect(await fetcher.fetchText(URL)).toEqual({
      ok: true,
      status: 200,
      body: "domainproof-verify=abc",
    });

    fetcher.set(URL, { ok: true, status: 404, body: "" });

    expect(await fetcher.fetchText(URL)).toEqual({ ok: true, status: 404, body: "" });
  });
});
