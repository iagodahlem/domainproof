import type { HttpFetcher, HttpFetchResult } from "../fetcher.js";

/**
 * In-memory {@link HttpFetcher} for tests. Never touches real network IO —
 * every answer comes from the `responses` map supplied at creation time
 * (and any later {@link FixtureFetcher.set} calls), mirroring {@link
 * createFixtureResolver} for the DNS side. Scenarios like "the file appears
 * mid-poll" or "the file starts serving a wrong value" are just a mutation
 * between two `fetchText` calls.
 */
export interface FixtureFetcher extends HttpFetcher {
  /**
   * Every URL passed to `fetchText`, in call order. Lets tests assert
   * exactly what was fetched (and how many times) without instrumenting the
   * fetcher themselves.
   */
  readonly calls: string[];

  /**
   * Adds or replaces the fixture entry for `url`. Use this between calls to
   * {@link checkHttp} to simulate a file appearing, changing, or being
   * removed.
   */
  set(url: string, result: HttpFetchResult): void;
}

/**
 * Creates a {@link FixtureFetcher} seeded with `responses`. A URL missing
 * from `responses` (and never added via {@link FixtureFetcher.set}) resolves
 * as `connection_failed` by default — the honest default for "we don't have
 * a fixture entry for this", matching what a real fetcher would report for
 * an unreachable host.
 */
export function createFixtureFetcher(
  responses: Record<string, HttpFetchResult> = {},
): FixtureFetcher {
  const state = new Map<string, HttpFetchResult>(Object.entries(responses));
  const calls: string[] = [];

  async function fetchText(url: string): Promise<HttpFetchResult> {
    calls.push(url);

    const entry = state.get(url);
    if (entry === undefined) {
      return { ok: false, reason: "connection_failed" };
    }

    return entry;
  }

  return {
    calls,
    fetchText,
    set(url: string, result: HttpFetchResult): void {
      state.set(url, result);
    },
  };
}
