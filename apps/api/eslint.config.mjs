import baseConfig, { EXTENSIONLESS_IMPORT_PATTERNS } from "../../eslint.base.mjs";

export default [
  ...baseConfig(import.meta.dirname),
  {
    // `modules/*` owns domain rules, services, and routes — it depends on
    // core and its own module, never on a concrete infra adapter (see
    // ARCHITECTURE.md's dependency rules). Infra is wired in app.ts (the
    // composition root) and injected into modules as an argument.
    //
    // This block re-declares `no-restricted-imports` (flat config doesn't
    // merge rule values across matching config objects, it overrides), so
    // it repeats the extensionless-import patterns alongside the
    // module-specific ones below.
    //
    // Scoped to non-test files: tests under modules/ legitimately spin up
    // a real db client (infra/db) as test setup, which isn't the "domain
    // logic reaching into infra" this rule exists to catch.
    files: ["src/modules/**/*.ts"],
    ignores: ["src/modules/**/*.test.ts"],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          patterns: [
            ...EXTENSIONLESS_IMPORT_PATTERNS,
            {
              // Both the relative form (any depth of ../) and the
              // @infra/dns|http path-alias form are restricted — an alias
              // is still an import of the same concrete adapter, and
              // shouldn't be a way to quietly route around this rule.
              group: [
                "**/infra/dns/**",
                "**/infra/http/**",
                "@infra/dns",
                "@infra/dns/**",
                "@infra/http",
                "@infra/http/**",
              ],
              message:
                "modules/* must depend on core's DnsResolver/HttpFetcher ports, not a concrete infra adapter. Wire the adapter in app.ts and inject it as an argument.",
            },
          ],
        },
      ],
    },
  },
];
