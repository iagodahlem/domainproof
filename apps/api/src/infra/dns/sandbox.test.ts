import { describe, expect, it } from "vitest";

import { challengeHost, checkTxt, recordValue } from "@domainproof/core";

import {
  createSandboxResolver,
  isSandboxDomain,
  type SandboxChallenge,
  sandboxJourneyFor,
} from "./sandbox";

const CREATED_AT = new Date("2026-01-01T00:00:00.000Z");
const TOKEN = "expectedtoken1234567890abcd";
const BRAND_SLUG = "domainproof";
const RECORD_VALUE = recordValue(TOKEN, BRAND_SLUG);

function clockAt(elapsedMs: number): () => Date {
  return () => new Date(CREATED_AT.getTime() + elapsedMs);
}

function makeChallenge(domain: string): SandboxChallenge {
  return {
    recordHost: challengeHost(domain, BRAND_SLUG),
    recordValue: RECORD_VALUE,
    brandSlug: BRAND_SLUG,
    createdAt: CREATED_AT,
  };
}

describe("isSandboxDomain", () => {
  it("is true for a plain .test domain", () => {
    expect(isSandboxDomain("verified.test")).toBe(true);
  });

  it("is true for a .test domain with a + suffix label", () => {
    expect(isSandboxDomain("pending-then-verified+run1.test")).toBe(true);
  });

  it("is true for a subdomain of a .test domain", () => {
    expect(isSandboxDomain("sub.verified.test")).toBe(true);
  });

  it("is false for a real-world domain", () => {
    expect(isSandboxDomain("example.com")).toBe(false);
  });

  it("is false for input that fails normalization", () => {
    expect(isSandboxDomain("")).toBe(false);
  });
});

describe("sandboxJourneyFor", () => {
  it("parses each known journey from its plain label", () => {
    expect(sandboxJourneyFor("verified.test")).toEqual({ ok: true, journey: "verified" });
    expect(sandboxJourneyFor("pending-then-verified.test")).toEqual({
      ok: true,
      journey: "pending-then-verified",
    });
    expect(sandboxJourneyFor("wrong-value.test")).toEqual({ ok: true, journey: "wrong-value" });
    expect(sandboxJourneyFor("nxdomain.test")).toEqual({ ok: true, journey: "nxdomain" });
    expect(sandboxJourneyFor("flaky.test")).toEqual({ ok: true, journey: "flaky" });
    expect(sandboxJourneyFor("conflict.test")).toEqual({ ok: true, journey: "conflict" });
  });

  it("strips a + suffix to find the journey", () => {
    expect(sandboxJourneyFor("pending-then-verified+run2.test")).toEqual({
      ok: true,
      journey: "pending-then-verified",
    });
  });

  it("treats + suffixed domains sharing a journey as independent, both resolving", () => {
    expect(sandboxJourneyFor("verified+run1.test")).toEqual({ ok: true, journey: "verified" });
    expect(sandboxJourneyFor("verified+run2.test")).toEqual({ ok: true, journey: "verified" });
  });

  it("reports unknown_journey for an unrecognized .test label", () => {
    expect(sandboxJourneyFor("random-name.test")).toEqual({
      ok: false,
      reason: "unknown_journey",
    });
  });

  it("reports not_sandbox for a real-world domain", () => {
    expect(sandboxJourneyFor("example.com")).toEqual({ ok: false, reason: "not_sandbox" });
  });

  it("reports not_sandbox for input that fails normalization", () => {
    expect(sandboxJourneyFor("")).toEqual({ ok: false, reason: "not_sandbox" });
  });
});

describe("createSandboxResolver", () => {
  it("only answers for the challenge's own recordHost, nxdomain otherwise", async () => {
    const challenge = makeChallenge("verified.test");
    const resolver = createSandboxResolver(challenge, clockAt(0));

    expect(await resolver.resolveTxt("some-other-host.example.com")).toEqual({
      ok: false,
      reason: "nxdomain",
    });
  });

  describe("verified journey", () => {
    it("returns the correct record from the first check", async () => {
      const challenge = makeChallenge("verified.test");
      const resolver = createSandboxResolver(challenge, clockAt(0));

      expect(await resolver.resolveTxt(challenge.recordHost)).toEqual({
        ok: true,
        records: [RECORD_VALUE],
      });
    });

    it("stays correct arbitrarily far in the future", async () => {
      const challenge = makeChallenge("verified.test");
      const resolver = createSandboxResolver(challenge, clockAt(10_000_000));

      expect(await resolver.resolveTxt(challenge.recordHost)).toEqual({
        ok: true,
        records: [RECORD_VALUE],
      });
    });
  });

  describe("pending-then-verified journey", () => {
    it.each([
      [0, { ok: false, reason: "nxdomain" }],
      [44_000, { ok: false, reason: "nxdomain" }],
      [45_000, { ok: true, records: [RECORD_VALUE] }],
      [46_000, { ok: true, records: [RECORD_VALUE] }],
    ] satisfies Array<[number, unknown]>)(
      "at %ims elapsed resolves to %j",
      async (elapsedMs, expected) => {
        const challenge = makeChallenge("pending-then-verified.test");
        const resolver = createSandboxResolver(challenge, clockAt(elapsedMs));

        expect(await resolver.resolveTxt(challenge.recordHost)).toEqual(expected);
      },
    );
  });

  describe("wrong-value journey", () => {
    it("always returns a syntactically valid record with a wrong, deterministic token", async () => {
      const challenge = makeChallenge("wrong-value.test");
      const resolver = createSandboxResolver(challenge, clockAt(0));

      const result = await resolver.resolveTxt(challenge.recordHost);
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.records).toHaveLength(1);
        const [record] = result.records;
        expect(record).not.toBe(RECORD_VALUE);
        expect(record?.startsWith("domainproof-verify=")).toBe(true);
      }
    });

    it("returns the same wrong record regardless of elapsed time", async () => {
      const challenge = makeChallenge("wrong-value.test");
      const early = createSandboxResolver(challenge, clockAt(0));
      const late = createSandboxResolver(challenge, clockAt(999_999));

      expect(await early.resolveTxt(challenge.recordHost)).toEqual(
        await late.resolveTxt(challenge.recordHost),
      );
    });
  });

  describe("nxdomain journey", () => {
    it("stays nxdomain forever", async () => {
      const challenge = makeChallenge("nxdomain.test");

      for (const elapsedMs of [0, 45_000, 10_000_000]) {
        const resolver = createSandboxResolver(challenge, clockAt(elapsedMs));
        expect(await resolver.resolveTxt(challenge.recordHost)).toEqual({
          ok: false,
          reason: "nxdomain",
        });
      }
    });
  });

  describe("flaky journey", () => {
    it.each([
      [29_000, { ok: true, records: [RECORD_VALUE] }],
      [30_000, { ok: false, reason: "timeout" }],
      [59_000, { ok: false, reason: "timeout" }],
      [60_000, { ok: true, records: [RECORD_VALUE] }],
    ] satisfies Array<[number, unknown]>)(
      "at %ims elapsed resolves to %j",
      async (elapsedMs, expected) => {
        const challenge = makeChallenge("flaky.test");
        const resolver = createSandboxResolver(challenge, clockAt(elapsedMs));

        expect(await resolver.resolveTxt(challenge.recordHost)).toEqual(expected);
      },
    );
  });

  describe("conflict journey", () => {
    it("resolves the correct record immediately, like verified", async () => {
      const challenge = makeChallenge("conflict.test");
      const resolver = createSandboxResolver(challenge, clockAt(0));

      expect(await resolver.resolveTxt(challenge.recordHost)).toEqual({
        ok: true,
        records: [RECORD_VALUE],
      });
    });
  });

  describe("unknown journey label", () => {
    it("behaves like nxdomain regardless of elapsed time", async () => {
      const challenge = makeChallenge("random-name.test");

      for (const elapsedMs of [0, 45_000, 10_000_000]) {
        const resolver = createSandboxResolver(challenge, clockAt(elapsedMs));
        expect(await resolver.resolveTxt(challenge.recordHost)).toEqual({
          ok: false,
          reason: "nxdomain",
        });
      }
    });
  });

  describe("+ suffix independence", () => {
    it("resolves verified+a.test and verified+b.test independently of each other", async () => {
      const challengeA = makeChallenge("verified+a.test");
      const challengeB = makeChallenge("verified+b.test");
      const resolverA = createSandboxResolver(challengeA, clockAt(0));
      const resolverB = createSandboxResolver(challengeB, clockAt(0));

      expect(await resolverA.resolveTxt(challengeA.recordHost)).toEqual({
        ok: true,
        records: [RECORD_VALUE],
      });
      expect(await resolverB.resolveTxt(challengeB.recordHost)).toEqual({
        ok: true,
        records: [RECORD_VALUE],
      });
      // Each resolver only answers for its own challenge's recordHost.
      expect(await resolverA.resolveTxt(challengeB.recordHost)).toEqual({
        ok: false,
        reason: "nxdomain",
      });
    });
  });

  describe("determinism", () => {
    it("returns the same answer every time for the same clock", async () => {
      const challenge = makeChallenge("flaky.test");
      const resolver = createSandboxResolver(challenge, clockAt(30_000));

      const first = await resolver.resolveTxt(challenge.recordHost);
      const second = await resolver.resolveTxt(challenge.recordHost);
      const third = await resolver.resolveTxt(challenge.recordHost);

      expect(first).toEqual({ ok: false, reason: "timeout" });
      expect(second).toEqual(first);
      expect(third).toEqual(first);
    });
  });
});

describe("checkTxt over a sandbox resolver (full outcome taxonomy from elapsed time)", () => {
  it("verified: found immediately", async () => {
    const challenge = makeChallenge("verified.test");
    const resolver = createSandboxResolver(challenge, clockAt(0));

    expect(await checkTxt(resolver, challenge.recordHost, TOKEN, BRAND_SLUG)).toEqual({ outcome: "found" });
  });

  it("pending-then-verified: not_found before propagation, found after", async () => {
    const challenge = makeChallenge("pending-then-verified.test");

    const before = createSandboxResolver(challenge, clockAt(44_000));
    expect(await checkTxt(before, challenge.recordHost, TOKEN, BRAND_SLUG)).toEqual({
      outcome: "not_found",
    });

    const after = createSandboxResolver(challenge, clockAt(45_000));
    expect(await checkTxt(after, challenge.recordHost, TOKEN, BRAND_SLUG)).toEqual({ outcome: "found" });
  });

  it("wrong-value: wrong_value with the detected fake token", async () => {
    const challenge = makeChallenge("wrong-value.test");
    const resolver = createSandboxResolver(challenge, clockAt(0));

    expect(await checkTxt(resolver, challenge.recordHost, TOKEN, BRAND_SLUG)).toEqual({
      outcome: "wrong_value",
      detected: ["wrongwrongwrongwrongwrongw"],
    });
  });

  it("nxdomain: not_found forever", async () => {
    const challenge = makeChallenge("nxdomain.test");
    const resolver = createSandboxResolver(challenge, clockAt(10_000_000));

    expect(await checkTxt(resolver, challenge.recordHost, TOKEN, BRAND_SLUG)).toEqual({
      outcome: "not_found",
    });
  });

  it("flaky: unreachable in odd windows, found in even windows", async () => {
    const challenge = makeChallenge("flaky.test");

    const oddWindow = createSandboxResolver(challenge, clockAt(30_000));
    expect(await checkTxt(oddWindow, challenge.recordHost, TOKEN, BRAND_SLUG)).toEqual({
      outcome: "unreachable",
    });

    const evenWindow = createSandboxResolver(challenge, clockAt(60_000));
    expect(await checkTxt(evenWindow, challenge.recordHost, TOKEN, BRAND_SLUG)).toEqual({ outcome: "found" });
  });

  it("conflict: found immediately, like verified (claim conflict is enforced elsewhere)", async () => {
    const challenge = makeChallenge("conflict.test");
    const resolver = createSandboxResolver(challenge, clockAt(0));

    expect(await checkTxt(resolver, challenge.recordHost, TOKEN, BRAND_SLUG)).toEqual({ outcome: "found" });
  });

  it("unknown journey: not_found, same as nxdomain", async () => {
    const challenge = makeChallenge("random-name.test");
    const resolver = createSandboxResolver(challenge, clockAt(0));

    expect(await checkTxt(resolver, challenge.recordHost, TOKEN, BRAND_SLUG)).toEqual({
      outcome: "not_found",
    });
  });
});
