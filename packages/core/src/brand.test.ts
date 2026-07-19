import { describe, expect, it } from "vitest";

import {
  DEFAULT_BRAND_SLUG,
  RESERVED_BRAND_SLUGS,
  slugFromName,
  validateBrandSlug,
} from "./brand.js";

describe("validateBrandSlug", () => {
  it("accepts the default brand slug", () => {
    expect(validateBrandSlug(DEFAULT_BRAND_SLUG)).toEqual({ ok: true, slug: DEFAULT_BRAND_SLUG });
  });

  it("accepts a simple lowercase slug", () => {
    expect(validateBrandSlug("skylane")).toEqual({ ok: true, slug: "skylane" });
  });

  it("accepts a slug with an internal hyphen", () => {
    expect(validateBrandSlug("sky-lane")).toEqual({ ok: true, slug: "sky-lane" });
  });

  it("normalizes uppercase input to lowercase", () => {
    expect(validateBrandSlug("SkyLane")).toEqual({ ok: true, slug: "skylane" });
  });

  it("trims surrounding whitespace before validating", () => {
    expect(validateBrandSlug("  skylane  ")).toEqual({ ok: true, slug: "skylane" });
  });

  it("accepts a 2-character slug (minimum length)", () => {
    expect(validateBrandSlug("ab")).toEqual({ ok: true, slug: "ab" });
  });

  it("rejects a 1-character slug", () => {
    expect(validateBrandSlug("a")).toEqual({ ok: false, reason: "invalid_format" });
  });

  it("accepts a 32-character slug (maximum length)", () => {
    const slug = `a${"b".repeat(30)}c`;
    expect(slug).toHaveLength(32);
    expect(validateBrandSlug(slug)).toEqual({ ok: true, slug });
  });

  it("rejects a 33-character slug", () => {
    const slug = `a${"b".repeat(31)}c`;
    expect(slug).toHaveLength(33);
    expect(validateBrandSlug(slug)).toEqual({ ok: false, reason: "invalid_format" });
  });

  it("rejects a leading hyphen", () => {
    expect(validateBrandSlug("-skylane")).toEqual({ ok: false, reason: "invalid_format" });
  });

  it("rejects a trailing hyphen", () => {
    expect(validateBrandSlug("skylane-")).toEqual({ ok: false, reason: "invalid_format" });
  });

  it("rejects an empty string", () => {
    expect(validateBrandSlug("")).toEqual({ ok: false, reason: "invalid_format" });
  });

  it("rejects a slug with an underscore", () => {
    expect(validateBrandSlug("sky_lane")).toEqual({ ok: false, reason: "invalid_format" });
  });

  it("rejects a slug with a space", () => {
    expect(validateBrandSlug("sky lane")).toEqual({ ok: false, reason: "invalid_format" });
  });

  for (const reserved of RESERVED_BRAND_SLUGS) {
    it(`rejects the reserved slug "${reserved}"`, () => {
      expect(validateBrandSlug(reserved)).toEqual({ ok: false, reason: "reserved" });
    });

    it(`rejects the reserved slug "${reserved}" regardless of case/whitespace`, () => {
      expect(validateBrandSlug(`  ${reserved.toUpperCase()}  `)).toEqual({
        ok: false,
        reason: "reserved",
      });
    });
  }
});

describe("slugFromName", () => {
  it("derives a hyphenated slug from a two-word name", () => {
    expect(slugFromName("Skylane HR")).toBe("skylane-hr");
  });

  it("folds underscores to hyphens", () => {
    expect(slugFromName("skylane_hr")).toBe("skylane-hr");
  });

  it("strips punctuation and symbols", () => {
    expect(slugFromName("Skylane, Inc.!")).toBe("skylane-inc");
  });

  it("collapses repeated separators into a single hyphen", () => {
    expect(slugFromName("Skylane   --  HR")).toBe("skylane-hr");
  });

  it("returns null for a name that is all emoji/symbols", () => {
    expect(slugFromName("🚀🔥✨")).toBeNull();
  });

  it("returns null for an empty name", () => {
    expect(slugFromName("")).toBeNull();
  });

  it("returns null for a name that derives to a single character", () => {
    expect(slugFromName("A")).toBeNull();
  });

  it("returns null for a name that derives to a reserved slug", () => {
    expect(slugFromName("Acme")).toBeNull();
  });

  it("returns null for a name that derives to a reserved slug via punctuation stripping", () => {
    expect(slugFromName("D.M.A.R.C")).toBeNull();
  });

  it("truncates a very long name to the maximum slug length", () => {
    const longName = "a".repeat(50);
    const result = slugFromName(longName);

    expect(result).not.toBeNull();
    expect(result).toHaveLength(32);
  });

  it("does not leave a trailing hyphen after truncation", () => {
    const longName = `${"a".repeat(31)} b`;
    const result = slugFromName(longName);

    expect(result).not.toBeNull();
    expect(result?.endsWith("-")).toBe(false);
  });
});
