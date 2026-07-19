import { describe, expect, it } from "vitest";

import { main } from "./index";

describe("main", () => {
  it("runs without throwing", () => {
    expect(() => main()).not.toThrow();
  });
});
