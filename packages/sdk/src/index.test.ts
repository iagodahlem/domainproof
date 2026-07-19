import { describe, expect, it } from "vitest";

import { DomainProof } from "./index";

describe("DomainProof", () => {
  it("stores the api key from the constructor", () => {
    const client = new DomainProof({ apiKey: "dp_test_key" });

    expect(client.apiKey).toBe("dp_test_key");
  });
});
