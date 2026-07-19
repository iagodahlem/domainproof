import { describe, expect, it } from "vitest";

import { createFixtureResolver } from "./fixture-resolver";

const HOST = "_domainproof-challenge.example.com";

describe("createFixtureResolver", () => {
  it("resolves records for a seeded hostname", async () => {
    const resolver = createFixtureResolver({ [HOST]: ["domainproof-verify=abc"] });

    expect(await resolver.resolveTxt(HOST)).toEqual({
      ok: true,
      records: ["domainproof-verify=abc"],
    });
  });

  it("defaults an unseeded hostname to nxdomain", async () => {
    const resolver = createFixtureResolver();

    expect(await resolver.resolveTxt(HOST)).toEqual({ ok: false, reason: "nxdomain" });
  });

  it("treats an empty record array as no_records", async () => {
    const resolver = createFixtureResolver({ [HOST]: [] });

    expect(await resolver.resolveTxt(HOST)).toEqual({ ok: false, reason: "no_records" });
  });

  it("simulates a timeout via a FixtureError entry", async () => {
    const resolver = createFixtureResolver({ [HOST]: { error: "timeout" } });

    expect(await resolver.resolveTxt(HOST)).toEqual({ ok: false, reason: "timeout" });
  });

  it("simulates a server failure via a FixtureError entry", async () => {
    const resolver = createFixtureResolver({ [HOST]: { error: "server_failure" } });

    expect(await resolver.resolveTxt(HOST)).toEqual({ ok: false, reason: "server_failure" });
  });

  it("simulates nxdomain via a FixtureError entry", async () => {
    const resolver = createFixtureResolver({ [HOST]: { error: "nxdomain" } });

    expect(await resolver.resolveTxt(HOST)).toEqual({ ok: false, reason: "nxdomain" });
  });

  it("records every call to resolveTxt in order", async () => {
    const resolver = createFixtureResolver({ [HOST]: ["domainproof-verify=abc"] });

    await resolver.resolveTxt(HOST);
    await resolver.resolveTxt("other.example.com");
    await resolver.resolveTxt(HOST);

    expect(resolver.calls).toEqual([HOST, "other.example.com", HOST]);
  });

  it("lets set() make a previously nxdomain hostname resolve (pending -> verified)", async () => {
    const resolver = createFixtureResolver();

    expect(await resolver.resolveTxt(HOST)).toEqual({ ok: false, reason: "nxdomain" });

    resolver.set(HOST, ["domainproof-verify=abc"]);

    expect(await resolver.resolveTxt(HOST)).toEqual({
      ok: true,
      records: ["domainproof-verify=abc"],
    });
  });

  it("lets set() lapse a previously resolving hostname (verified -> lapsed)", async () => {
    const resolver = createFixtureResolver({ [HOST]: ["domainproof-verify=abc"] });

    expect(await resolver.resolveTxt(HOST)).toEqual({
      ok: true,
      records: ["domainproof-verify=abc"],
    });

    resolver.set(HOST, []);

    expect(await resolver.resolveTxt(HOST)).toEqual({ ok: false, reason: "no_records" });
  });
});
