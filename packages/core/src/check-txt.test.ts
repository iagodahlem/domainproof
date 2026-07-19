import { describe, expect, it } from "vitest";

import { checkTxt } from "./check-txt.js";
import { createFixtureResolver } from "./resolvers/fixture.js";
import { recordValue } from "./token.js";

const HOST = "_domainproof-challenge.example.com";
const TOKEN = "expectedtoken1234567890abcd";
const OTHER_TOKEN = "someothertoken1234567890abcd";

describe("checkTxt", () => {
  it("returns found for an exact match", async () => {
    const resolver = createFixtureResolver({ [HOST]: [recordValue(TOKEN)] });

    expect(await checkTxt(resolver, HOST, TOKEN)).toEqual({ outcome: "found" });
  });

  it("returns found among unrelated TXT records and a second DomainProof record with a different token", async () => {
    const resolver = createFixtureResolver({
      [HOST]: [
        "v=spf1 include:_spf.google.com ~all",
        recordValue(OTHER_TOKEN),
        recordValue(TOKEN),
        "google-site-verification=abc123",
      ],
    });

    expect(await checkTxt(resolver, HOST, TOKEN)).toEqual({ outcome: "found" });
  });

  it("returns wrong_value with the detected token when none match", async () => {
    const resolver = createFixtureResolver({
      [HOST]: ["v=spf1 include:_spf.google.com ~all", recordValue(OTHER_TOKEN)],
    });

    expect(await checkTxt(resolver, HOST, TOKEN)).toEqual({
      outcome: "wrong_value",
      detected: [OTHER_TOKEN],
    });
  });

  it("caps detected values at 10 entries", async () => {
    const wrongTokens = Array.from({ length: 15 }, (_, i) => `wrong-token-${i}`);
    const resolver = createFixtureResolver({
      [HOST]: wrongTokens.map((token) => recordValue(token)),
    });

    const result = await checkTxt(resolver, HOST, TOKEN);

    expect(result.outcome).toBe("wrong_value");
    if (result.outcome === "wrong_value") {
      expect(result.detected).toHaveLength(10);
      expect(result.detected).toEqual(wrongTokens.slice(0, 10));
    }
  });

  it("tolerates a quoted, whitespace-padded record via parseRecordValue", async () => {
    const resolver = createFixtureResolver({
      [HOST]: [`  " ${recordValue(TOKEN)} "  `],
    });

    expect(await checkTxt(resolver, HOST, TOKEN)).toEqual({ outcome: "found" });
  });

  it("returns not_found for nxdomain", async () => {
    const resolver = createFixtureResolver();

    expect(await checkTxt(resolver, HOST, TOKEN)).toEqual({ outcome: "not_found" });
  });

  it("returns not_found for an empty record set", async () => {
    const resolver = createFixtureResolver({ [HOST]: [] });

    expect(await checkTxt(resolver, HOST, TOKEN)).toEqual({ outcome: "not_found" });
  });

  it("returns not_found when records exist but none parse as ours", async () => {
    const resolver = createFixtureResolver({
      [HOST]: ["v=spf1 include:_spf.google.com ~all", "google-site-verification=abc123"],
    });

    expect(await checkTxt(resolver, HOST, TOKEN)).toEqual({ outcome: "not_found" });
  });

  it("returns unreachable for a timeout", async () => {
    const resolver = createFixtureResolver({ [HOST]: { error: "timeout" } });

    expect(await checkTxt(resolver, HOST, TOKEN)).toEqual({ outcome: "unreachable" });
  });

  it("returns unreachable for a server failure", async () => {
    const resolver = createFixtureResolver({ [HOST]: { error: "server_failure" } });

    expect(await checkTxt(resolver, HOST, TOKEN)).toEqual({ outcome: "unreachable" });
  });

  it("returns found for a branded record checked under the same brand", async () => {
    const resolver = createFixtureResolver({ [HOST]: [recordValue(TOKEN, "skylane")] });

    expect(await checkTxt(resolver, HOST, TOKEN, { brandSlug: "skylane" })).toEqual({
      outcome: "found",
    });
  });

  it("does not match a branded record when checked under the default brand", async () => {
    const resolver = createFixtureResolver({ [HOST]: [recordValue(TOKEN, "skylane")] });

    expect(await checkTxt(resolver, HOST, TOKEN)).toEqual({ outcome: "not_found" });
  });

  it("does not match a default-brand record when checked under another brand", async () => {
    const resolver = createFixtureResolver({ [HOST]: [recordValue(TOKEN)] });

    expect(await checkTxt(resolver, HOST, TOKEN, { brandSlug: "skylane" })).toEqual({
      outcome: "not_found",
    });
  });
});
