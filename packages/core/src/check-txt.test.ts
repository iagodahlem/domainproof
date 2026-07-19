import { describe, expect, it } from "vitest";

import { checkTxt } from "./check-txt";
import { recordValue } from "./record";
import { createFixtureResolver } from "./testing/fixture-resolver";

const HOST = "_domainproof-challenge.example.com";
const TOKEN = "expectedtoken1234567890abcd";
const OTHER_TOKEN = "someothertoken1234567890abcd";
const BRAND_SLUG = "domainproof";

describe("checkTxt", () => {
  it("returns found for an exact match", async () => {
    const resolver = createFixtureResolver({ [HOST]: [recordValue(TOKEN, BRAND_SLUG)] });

    expect(await checkTxt(resolver, HOST, TOKEN, BRAND_SLUG)).toEqual({ outcome: "found" });
  });

  it("returns found among unrelated TXT records and a second DomainProof record with a different token", async () => {
    const resolver = createFixtureResolver({
      [HOST]: [
        "v=spf1 include:_spf.google.com ~all",
        recordValue(OTHER_TOKEN, BRAND_SLUG),
        recordValue(TOKEN, BRAND_SLUG),
        "google-site-verification=abc123",
      ],
    });

    expect(await checkTxt(resolver, HOST, TOKEN, BRAND_SLUG)).toEqual({ outcome: "found" });
  });

  it("returns wrong_value with the detected token when none match", async () => {
    const resolver = createFixtureResolver({
      [HOST]: ["v=spf1 include:_spf.google.com ~all", recordValue(OTHER_TOKEN, BRAND_SLUG)],
    });

    expect(await checkTxt(resolver, HOST, TOKEN, BRAND_SLUG)).toEqual({
      outcome: "wrong_value",
      detected: [OTHER_TOKEN],
    });
  });

  it("caps detected values at 10 entries", async () => {
    const wrongTokens = Array.from({ length: 15 }, (_, i) => `wrong-token-${i}`);
    const resolver = createFixtureResolver({
      [HOST]: wrongTokens.map((token) => recordValue(token, BRAND_SLUG)),
    });

    const result = await checkTxt(resolver, HOST, TOKEN, BRAND_SLUG);

    expect(result.outcome).toBe("wrong_value");
    if (result.outcome === "wrong_value") {
      expect(result.detected).toHaveLength(10);
      expect(result.detected).toEqual(wrongTokens.slice(0, 10));
    }
  });

  it("tolerates a quoted, whitespace-padded record via parseRecordValue", async () => {
    const resolver = createFixtureResolver({
      [HOST]: [`  " ${recordValue(TOKEN, BRAND_SLUG)} "  `],
    });

    expect(await checkTxt(resolver, HOST, TOKEN, BRAND_SLUG)).toEqual({ outcome: "found" });
  });

  it("returns not_found for nxdomain", async () => {
    const resolver = createFixtureResolver();

    expect(await checkTxt(resolver, HOST, TOKEN, BRAND_SLUG)).toEqual({ outcome: "not_found" });
  });

  it("returns not_found for an empty record set", async () => {
    const resolver = createFixtureResolver({ [HOST]: [] });

    expect(await checkTxt(resolver, HOST, TOKEN, BRAND_SLUG)).toEqual({ outcome: "not_found" });
  });

  it("returns not_found when records exist but none parse as ours", async () => {
    const resolver = createFixtureResolver({
      [HOST]: ["v=spf1 include:_spf.google.com ~all", "google-site-verification=abc123"],
    });

    expect(await checkTxt(resolver, HOST, TOKEN, BRAND_SLUG)).toEqual({ outcome: "not_found" });
  });

  it("returns unreachable for a timeout", async () => {
    const resolver = createFixtureResolver({ [HOST]: { error: "timeout" } });

    expect(await checkTxt(resolver, HOST, TOKEN, BRAND_SLUG)).toEqual({ outcome: "unreachable" });
  });

  it("returns unreachable for a server failure", async () => {
    const resolver = createFixtureResolver({ [HOST]: { error: "server_failure" } });

    expect(await checkTxt(resolver, HOST, TOKEN, BRAND_SLUG)).toEqual({ outcome: "unreachable" });
  });

  it("returns found for a branded record checked under the same brand", async () => {
    const resolver = createFixtureResolver({ [HOST]: [recordValue(TOKEN, "skylane")] });

    expect(await checkTxt(resolver, HOST, TOKEN, "skylane")).toEqual({
      outcome: "found",
    });
  });

  it("does not match a branded record when checked under a different brand", async () => {
    const resolver = createFixtureResolver({ [HOST]: [recordValue(TOKEN, "skylane")] });

    expect(await checkTxt(resolver, HOST, TOKEN, BRAND_SLUG)).toEqual({ outcome: "not_found" });
  });

  it("does not match a record when checked under a brand other than the one it was published with", async () => {
    const resolver = createFixtureResolver({ [HOST]: [recordValue(TOKEN, BRAND_SLUG)] });

    expect(await checkTxt(resolver, HOST, TOKEN, "skylane")).toEqual({
      outcome: "not_found",
    });
  });
});
