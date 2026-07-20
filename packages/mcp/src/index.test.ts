import { describe, expect, it } from "vitest";

import { SERVER_NAME } from "./index";

describe("SERVER_NAME", () => {
  it("is 'domainproof'", () => {
    expect(SERVER_NAME).toBe("domainproof");
  });
});
