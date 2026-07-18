import { describe, expect, it } from "vitest";

import { DOMAIN_STATUSES } from "./index.js";

describe("DOMAIN_STATUSES", () => {
  it("contains 'verified'", () => {
    expect(DOMAIN_STATUSES).toContain("verified");
  });
});
