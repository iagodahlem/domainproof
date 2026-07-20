import baseConfig, { EXTENSIONLESS_IMPORT_PATTERNS } from "../../eslint.base.mjs";

const INFRA_ADAPTER_PATTERN = {
  // Both the relative form (any depth of ../) and the @infra/dns|http|auth
  // path-alias form are restricted — an alias is still an import of the
  // same concrete adapter, and shouldn't be a way to quietly route around
  // this rule.
  group: [
    "**/infra/dns/**",
    "**/infra/http/**",
    "**/infra/auth/**",
    "@infra/dns",
    "@infra/dns/**",
    "@infra/http",
    "@infra/http/**",
    "@infra/auth",
    "@infra/auth/**",
  ],
  message:
    "modules/* must depend on a port (DnsResolver, HttpFetcher, SessionVerifier, ...), not a concrete infra adapter. Wire the adapter in app.ts and inject it as an argument.",
};

const INFRA_DB_PATTERN = {
  group: ["**/infra/db/**", "@infra/db", "@infra/db/**"],
  message:
    "Only a module's repository.ts (and its own repository/route tests) may import @infra/db. Services and routes depend on the repository interface instead — see ARCHITECTURE.md's module anatomy.",
};

// Three non-overlapping file groups under modules/, since flat config
// overrides `no-restricted-imports` per matching block rather than merging
// patterns across blocks — each group below gets exactly the combined
// pattern list it needs, repeating EXTENSIONLESS_IMPORT_PATTERNS every
// time so extensionless enforcement never gets silently dropped for a
// group that also needs an infra restriction.
export default [
  ...baseConfig(import.meta.dirname),
  {
    // Everything in a module except its repository.ts and its tests: no
    // concrete infra adapter, and no @infra/db — this is the "routes and
    // services" layer, which depends only on its module's repository
    // (injected) and, for cross-module calls, another module's service.
    files: ["src/modules/**/*.ts"],
    ignores: ["src/modules/**/*.test.ts", "src/modules/**/repository.ts"],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          patterns: [...EXTENSIONLESS_IMPORT_PATTERNS, INFRA_ADAPTER_PATTERN, INFRA_DB_PATTERN],
        },
      ],
    },
  },
  {
    // repository.ts: the one file per module allowed to import @infra/db.
    // Still no concrete DNS/HTTP/auth adapter — a repository has no more
    // business talking to those than any other module file does.
    files: ["src/modules/**/repository.ts"],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          patterns: [...EXTENSIONLESS_IMPORT_PATTERNS, INFRA_ADAPTER_PATTERN],
        },
      ],
    },
  },
  {
    // Every test except repository.test.ts and routes.test.ts: no
    // @infra/db. Those two are the sanctioned exceptions (repository
    // tests verify real persistence; route tests are deliberate
    // end-to-end wiring coverage that seeds through the real db) — every
    // other test (service.test.ts, api-key.test.ts, ...) uses a fake
    // implementing its module's repository interface instead.
    files: ["src/modules/**/*.test.ts"],
    ignores: ["src/modules/**/repository.test.ts", "src/modules/**/routes.test.ts"],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          patterns: [...EXTENSIONLESS_IMPORT_PATTERNS, INFRA_DB_PATTERN],
        },
      ],
    },
  },
];
