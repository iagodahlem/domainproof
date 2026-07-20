import { describe, expect, it } from "vitest";
import { generateKeyId } from "./encoding";
import { formatApiKey, parseApiKey } from "./parse";

const SECRET = "a".repeat(26);

describe("parseApiKey", () => {
  it("parses a well-formed test-mode key", () => {
    const keyId = generateKeyId();
    const result = parseApiKey(`dp_test_${keyId}_${SECRET}`);

    expect(result).toEqual({
      ok: true,
      value: { mode: "test", keyId, secret: SECRET },
    });
  });

  it("parses a well-formed live-mode key", () => {
    const keyId = generateKeyId();
    const result = parseApiKey(`dp_live_${keyId}_${SECRET}`);

    expect(result).toEqual({
      ok: true,
      value: { mode: "live", keyId, secret: SECRET },
    });
  });

  it("rejects a key with the wrong prefix", () => {
    const keyId = generateKeyId();
    expect(parseApiKey(`sk_live_${keyId}_${SECRET}`)).toEqual({ ok: false });
  });

  it("rejects an unknown mode", () => {
    const keyId = generateKeyId();
    expect(parseApiKey(`dp_staging_${keyId}_${SECRET}`)).toEqual({
      ok: false,
    });
  });

  it("rejects too few segments", () => {
    expect(parseApiKey("dp_test_onlyonesegment")).toEqual({ ok: false });
  });

  it("rejects too many segments", () => {
    const keyId = generateKeyId();
    expect(parseApiKey(`dp_test_${keyId}_${SECRET}_extra`)).toEqual({
      ok: false,
    });
  });

  it("rejects a key id of the wrong length", () => {
    expect(parseApiKey(`dp_test_short_${SECRET}`)).toEqual({ ok: false });
  });

  it("rejects a key id with characters outside the base32 alphabet", () => {
    const badKeyId = "ABCDEFGHIJKL"; // uppercase, 12 chars
    expect(parseApiKey(`dp_test_${badKeyId}_${SECRET}`)).toEqual({
      ok: false,
    });
  });

  it("rejects a secret of the wrong length", () => {
    const keyId = generateKeyId();
    expect(parseApiKey(`dp_test_${keyId}_tooshort`)).toEqual({ ok: false });
  });

  it("rejects a secret with characters outside the base32 alphabet", () => {
    const keyId = generateKeyId();
    const badSecret = "1".repeat(26); // "1" and "0" aren't in the alphabet
    expect(parseApiKey(`dp_test_${keyId}_${badSecret}`)).toEqual({
      ok: false,
    });
  });

  it("rejects an empty string", () => {
    expect(parseApiKey("")).toEqual({ ok: false });
  });

  it("never throws on arbitrary garbage input", () => {
    const inputs = ["", "___", "dp__", "dp_test__", "🙂".repeat(40), "\n\t "];

    for (const input of inputs) {
      expect(() => parseApiKey(input)).not.toThrow();
    }
  });
});

describe("formatApiKey / parseApiKey round trip", () => {
  it("round-trips a generated key", () => {
    const keyId = generateKeyId();
    const value = { mode: "live" as const, keyId, secret: SECRET };

    const formatted = formatApiKey(value);
    expect(parseApiKey(formatted)).toEqual({ ok: true, value });
  });
});
