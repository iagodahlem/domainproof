import { describe, expect, it } from "vitest";
import { generateKeyId, KEY_ID_LENGTH } from "./encoding";

describe("generateKeyId", () => {
  it("produces ids matching the expected alphabet and length", () => {
    const pattern = new RegExp(`^[a-z2-7]{${KEY_ID_LENGTH}}$`);

    for (let i = 0; i < 1000; i++) {
      expect(generateKeyId()).toMatch(pattern);
    }
  });

  it("produces unique ids across many generations", () => {
    const ids = new Set(Array.from({ length: 1000 }, () => generateKeyId()));
    expect(ids.size).toBe(1000);
  });
});
