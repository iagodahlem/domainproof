import baseConfig, {
  EXTENSIONLESS_IMPORT_PATTERNS,
} from '../../eslint.base.mjs'

const INFRA_ADAPTER_PATTERN = {
  // Both the relative form (any depth of ../) and the @infra/dns|http|auth
  // path-alias form are restricted — an alias is still an import of the
  // same concrete adapter, and shouldn't be a way to quietly route around
  // this rule.
  group: [
    '**/infra/dns/**',
    '**/infra/http/**',
    '**/infra/auth/**',
    '@infra/dns',
    '@infra/dns/**',
    '@infra/http',
    '@infra/http/**',
    '@infra/auth',
    '@infra/auth/**',
  ],
  message:
    'modules/* must depend on a port (DnsResolver, HttpFetcher, SessionVerifier, ...), not a concrete infra adapter. Wire the adapter in app.ts and inject it as an argument.',
}

const INFRA_DB_PATTERN = {
  group: ['**/infra/db/**', '@infra/db', '@infra/db/**'],
  message:
    "Only a module's repository.ts (and its own repository test) may import @infra/db. Services depend on the repository interface instead — see ARCHITECTURE.md's module anatomy.",
}

const MODULES_NO_APIS_PATTERN = {
  // Both the relative form and the @apis/* path-alias form.
  group: ['**/apis/**', '@apis/*', '@apis/**'],
  message:
    "modules/* is plane-agnostic domain logic (services, repositories, ports, pure domain files) — it must not import from apis/. HTTP routing and plane-global middleware live in apis/<plane>/; a module gets consumed by a plane's router.ts, wired together in app.ts.",
}

const NO_APIS_V1_PATTERN = {
  group: ['**/apis/v1/**', '@apis/v1', '@apis/v1/**'],
  message:
    "This plane must not import from apis/v1 — planes don't depend on each other. Share logic through modules/ instead.",
}

const NO_APIS_DASHBOARD_PATTERN = {
  group: ['**/apis/dashboard/**', '@apis/dashboard', '@apis/dashboard/**'],
  message:
    "This plane must not import from apis/dashboard — planes don't depend on each other. Share logic through modules/ instead.",
}

const NO_APIS_FRONTEND_PATTERN = {
  group: ['**/apis/frontend/**', '@apis/frontend', '@apis/frontend/**'],
  message:
    "This plane must not import from apis/frontend — planes don't depend on each other. Share logic through modules/ instead.",
}

// Every group below gets its own full combined pattern list, since flat
// config overrides `no-restricted-imports` per matching block rather than
// merging patterns across blocks — repeating EXTENSIONLESS_IMPORT_PATTERNS
// every time so extensionless enforcement never gets silently dropped for
// a group that also needs a boundary restriction.
export default [
  ...baseConfig(import.meta.dirname),
  {
    // Everything in a module except its repository.ts and its tests: no
    // concrete infra adapter, no @infra/db, and no apis/ — modules are
    // plane-agnostic domain logic (services, ports, pure domain files),
    // consumed by whichever plane(s) need them.
    files: ['src/modules/**/*.ts', 'src/modules/**/*.tsx'],
    ignores: ['src/modules/**/*.test.ts', 'src/modules/**/repository.ts'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            ...EXTENSIONLESS_IMPORT_PATTERNS,
            INFRA_ADAPTER_PATTERN,
            INFRA_DB_PATTERN,
            MODULES_NO_APIS_PATTERN,
          ],
        },
      ],
    },
  },
  {
    // repository.ts: the one file per module allowed to import @infra/db.
    // Still no concrete DNS/HTTP/auth adapter, and still no apis/ — a
    // repository has no more business talking to those than any other
    // module file does.
    files: ['src/modules/**/repository.ts'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            ...EXTENSIONLESS_IMPORT_PATTERNS,
            INFRA_ADAPTER_PATTERN,
            MODULES_NO_APIS_PATTERN,
          ],
        },
      ],
    },
  },
  {
    // Every module test except repository.test.ts: no @infra/db (use a
    // fake implementing the repository/port interface instead), and no
    // apis/ (a module's tests exercise it in isolation, the same way
    // production code does).
    files: ['src/modules/**/*.test.ts', 'src/modules/**/*.test.tsx'],
    ignores: ['src/modules/**/repository.test.ts'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            ...EXTENSIONLESS_IMPORT_PATTERNS,
            INFRA_DB_PATTERN,
            MODULES_NO_APIS_PATTERN,
          ],
        },
      ],
    },
  },
  {
    // No plane depends on any other — domains, keys, etc. share logic
    // through modules/, never by importing across apis/<plane>/.
    files: ['src/apis/dashboard/**/*.ts'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            ...EXTENSIONLESS_IMPORT_PATTERNS,
            NO_APIS_V1_PATTERN,
            NO_APIS_FRONTEND_PATTERN,
          ],
        },
      ],
    },
  },
  {
    files: ['src/apis/v1/**/*.ts'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            ...EXTENSIONLESS_IMPORT_PATTERNS,
            NO_APIS_DASHBOARD_PATTERN,
            NO_APIS_FRONTEND_PATTERN,
          ],
        },
      ],
    },
  },
  {
    files: ['src/apis/frontend/**/*.ts'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            ...EXTENSIONLESS_IMPORT_PATTERNS,
            NO_APIS_DASHBOARD_PATTERN,
            NO_APIS_V1_PATTERN,
          ],
        },
      ],
    },
  },
]
