import { describe, expect, it } from "vitest";

import {
  DEFAULT_TOKEN_TTL_MS,
  RECORD_VALUE_PREFIX,
  generateToken,
  isExpired,
  parseRecordValue,
  recordValue,
  recordValuePrefix,
  tokensMatch,
} from "./token.js";

describe("generateToken", () => {
  it("produces tokens matching the expected alphabet and length", () => {
    for (let i = 0; i < 1000; i++) {
      expect(generateToken()).toMatch(/^[a-z2-7]{26}$/);
    }
  });

  it("produces unique tokens across many generations", () => {
    const tokens = new Set(Array.from({ length: 1000 }, () => generateToken()));
    expect(tokens.size).toBe(1000);
  });
});

describe("recordValue / parseRecordValue", () => {
  it("round-trips a generated token", () => {
    const token = generateToken();
    const value = recordValue(token);

    expect(value).toBe(`${RECORD_VALUE_PREFIX}${token}`);
    expect(parseRecordValue(value)).toEqual({ ok: true, token });
  });

  it("tolerates surrounding whitespace", () => {
    const token = generateToken();
    const result = parseRecordValue(`  ${recordValue(token)}  \n`);

    expect(result).toEqual({ ok: true, token });
  });

  it("tolerates enclosing double quotes", () => {
    const token = generateToken();
    const result = parseRecordValue(`"${recordValue(token)}"`);

    expect(result).toEqual({ ok: true, token });
  });

  it("tolerates whitespace inside enclosing quotes", () => {
    const token = generateToken();
    const result = parseRecordValue(`  " ${recordValue(token)} "  `);

    expect(result).toEqual({ ok: true, token });
  });

  it("rejects values missing the prefix", () => {
    expect(parseRecordValue("some-other-value=abc")).toEqual({ ok: false });
  });

  it("rejects a case-mismatched prefix", () => {
    expect(parseRecordValue("Domainproof-Verify=abc")).toEqual({ ok: false });
  });

  it("rejects a bare prefix with no token", () => {
    expect(parseRecordValue(RECORD_VALUE_PREFIX)).toEqual({ ok: false });
  });

  it("rejects an empty string", () => {
    expect(parseRecordValue("")).toEqual({ ok: false });
  });

  it("builds a brand-specific prefix", () => {
    expect(recordValuePrefix("skylane")).toBe("skylane-verify=");
  });

  it("round-trips a branded token under its own brand", () => {
    const token = generateToken();
    const value = recordValue(token, "skylane");

    expect(value).toBe(`skylane-verify=${token}`);
    expect(parseRecordValue(value, "skylane")).toEqual({ ok: true, token });
  });

  it("does not match a branded record under the default brand", () => {
    const token = generateToken();
    const value = recordValue(token, "skylane");

    expect(parseRecordValue(value)).toEqual({ ok: false });
  });

  it("does not match a default-brand record under a different brand", () => {
    const token = generateToken();
    const value = recordValue(token);

    expect(parseRecordValue(value, "skylane")).toEqual({ ok: false });
  });
});

describe("tokensMatch", () => {
  it("returns true for identical tokens", () => {
    const token = generateToken();

    expect(tokensMatch(token, token)).toBe(true);
  });

  it("returns false for different tokens of the same length", () => {
    expect(tokensMatch("a".repeat(26), "b".repeat(26))).toBe(false);
  });

  it("returns false for tokens of different lengths", () => {
    expect(tokensMatch("short", "a much longer candidate value")).toBe(false);
  });
});

describe("isExpired", () => {
  const createdAt = new Date("2026-01-01T00:00:00.000Z");

  it("is not expired before the ttl elapses", () => {
    const now = new Date(createdAt.getTime() + DEFAULT_TOKEN_TTL_MS - 1);

    expect(isExpired(createdAt, now)).toBe(false);
  });

  it("is expired exactly at the ttl boundary", () => {
    const now = new Date(createdAt.getTime() + DEFAULT_TOKEN_TTL_MS);

    expect(isExpired(createdAt, now)).toBe(true);
  });

  it("is expired after the ttl elapses", () => {
    const now = new Date(createdAt.getTime() + DEFAULT_TOKEN_TTL_MS + 1);

    expect(isExpired(createdAt, now)).toBe(true);
  });

  it("supports a custom ttl", () => {
    const ttlMs = 1000;

    expect(isExpired(createdAt, new Date(createdAt.getTime() + 999), ttlMs)).toBe(false);
    expect(isExpired(createdAt, new Date(createdAt.getTime() + 1000), ttlMs)).toBe(true);
  });
});
