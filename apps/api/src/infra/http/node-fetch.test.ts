import { describe, expect, it } from "vitest";

import { createNodeFetchFetcher } from "./node-fetch";

const URL = "https://example.com/.well-known/domainproof-challenge";

function abortableStub(): (input: string, init: RequestInit) => Promise<Response> {
  return (_input, init) =>
    new Promise((_resolve, reject) => {
      init.signal?.addEventListener("abort", () => {
        const error = new Error("The operation was aborted");
        error.name = "AbortError";
        reject(error);
      });
    });
}

describe("createNodeFetchFetcher", () => {
  it("returns the body and status on a plain success", async () => {
    const fetchImpl = async () => new Response("domainproof-verify=abc", { status: 200 });
    const fetcher = createNodeFetchFetcher({ fetchImpl });

    expect(await fetcher.fetchText(URL)).toEqual({
      ok: true,
      status: 200,
      body: "domainproof-verify=abc",
    });
  });

  it("reports timeout when the request is aborted", async () => {
    const fetcher = createNodeFetchFetcher({ timeoutMs: 10, fetchImpl: abortableStub() });

    expect(await fetcher.fetchText(URL)).toEqual({ ok: false, reason: "timeout" });
  });

  it("maps a generic connection error to connection_failed", async () => {
    const fetchImpl = async () => {
      throw new Error("connect ECONNREFUSED");
    };
    const fetcher = createNodeFetchFetcher({ fetchImpl });

    expect(await fetcher.fetchText(URL)).toEqual({ ok: false, reason: "connection_failed" });
  });

  it("maps a TLS handshake error to tls_error", async () => {
    const fetchImpl = async () => {
      const error = new Error("certificate has expired");
      (error as { cause?: unknown }).cause = { code: "CERT_HAS_EXPIRED" };
      throw error;
    };
    const fetcher = createNodeFetchFetcher({ fetchImpl });

    expect(await fetcher.fetchText(URL)).toEqual({ ok: false, reason: "tls_error" });
  });

  it("follows a same-host HTTPS redirect", async () => {
    const calls: string[] = [];
    const fetchImpl = async (input: string) => {
      calls.push(input);
      if (input === URL) {
        return new Response(null, {
          status: 302,
          headers: { location: "https://example.com/.well-known/domainproof-challenge-2" },
        });
      }
      return new Response("domainproof-verify=abc", { status: 200 });
    };
    const fetcher = createNodeFetchFetcher({ fetchImpl });

    expect(await fetcher.fetchText(URL)).toEqual({
      ok: true,
      status: 200,
      body: "domainproof-verify=abc",
    });
    expect(calls).toEqual([
      URL,
      "https://example.com/.well-known/domainproof-challenge-2",
    ]);
  });

  it("rejects a redirect to a different host", async () => {
    const calls: string[] = [];
    const fetchImpl = async (input: string) => {
      calls.push(input);
      return new Response(null, {
        status: 302,
        headers: { location: "https://evil.example/.well-known/domainproof-challenge" },
      });
    };
    const fetcher = createNodeFetchFetcher({ fetchImpl });

    expect(await fetcher.fetchText(URL)).toEqual({ ok: false, reason: "connection_failed" });
    expect(calls).toEqual([URL]);
  });

  it("rejects a redirect to a plain-http Location", async () => {
    const calls: string[] = [];
    const fetchImpl = async (input: string) => {
      calls.push(input);
      return new Response(null, {
        status: 302,
        headers: { location: "http://example.com/.well-known/domainproof-challenge" },
      });
    };
    const fetcher = createNodeFetchFetcher({ fetchImpl });

    expect(await fetcher.fetchText(URL)).toEqual({ ok: false, reason: "connection_failed" });
    expect(calls).toEqual([URL]);
  });

  it("rejects a redirect chain longer than 3 hops", async () => {
    let hop = 0;
    const calls: string[] = [];
    const fetchImpl = async (input: string) => {
      calls.push(input);
      hop += 1;
      return new Response(null, {
        status: 302,
        headers: { location: `https://example.com/.well-known/hop-${hop}` },
      });
    };
    const fetcher = createNodeFetchFetcher({ fetchImpl });

    expect(await fetcher.fetchText(URL)).toEqual({ ok: false, reason: "connection_failed" });
    // Initial request + 3 followed redirects = 4 calls; the response to the
    // 4th call is itself a redirect, which is refused without a 5th fetch.
    expect(calls).toHaveLength(4);
  });

  it("rejects a response whose content-length exceeds the cap", async () => {
    const fetchImpl = async () =>
      new Response("short body", {
        status: 200,
        headers: { "content-length": "1000000" },
      });
    const fetcher = createNodeFetchFetcher({ fetchImpl, maxBodyBytes: 100 });

    expect(await fetcher.fetchText(URL)).toEqual({ ok: false, reason: "too_large" });
  });

  it("rejects a response whose actual body exceeds the cap when content-length is absent", async () => {
    const fetchImpl = async () => new Response("x".repeat(1000), { status: 200 });
    const fetcher = createNodeFetchFetcher({ fetchImpl, maxBodyBytes: 100 });

    expect(await fetcher.fetchText(URL)).toEqual({ ok: false, reason: "too_large" });
  });
});
