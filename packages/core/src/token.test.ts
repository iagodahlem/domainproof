import { describe, expect, it } from "vitest";

import { DEFAULT_TOKEN_TTL_MS, generateToken, isExpired, tokensMatch } from "./token";

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
