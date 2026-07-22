import { dirname } from 'path'
import { fileURLToPath } from 'url'
import { FlatCompat } from '@eslint/eslintrc'
import eslintConfigPrettier from 'eslint-config-prettier'
import betterTailwindcss from 'eslint-plugin-better-tailwindcss'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

const compat = new FlatCompat({
  baseDirectory: __dirname,
})

/**
 * Catches hardcoded px/rem/em arbitrary values in Tailwind classNames (the
 * `w-[92px]`/`tracking-[0.06em]` shape) so a one-off literal doesn't creep
 * back in once a mapped token utility exists for it. Matches only a
 * utility's own arbitrary value, not an arbitrary breakpoint variant
 * (`max-[780px]:`, part of this design system's own responsive-variant
 * vocabulary) — the negative lookahead skips brackets immediately followed
 * by `:`.
 */
const NO_ARBITRARY_PX_REM_EM = {
  pattern: '\\[[^\\[\\]]*[0-9]+(\\.[0-9]+)?(px|rem|em)[^\\[\\]]*\\](?!:)',
  message:
    'Hardcoded px/rem/em arbitrary value — use a mapped token utility (see tokens.css/theme.css). If genuinely one-off with no token equivalent, disable this rule inline with a comment explaining why.',
}

/**
 * No legitimate colocated usage ever needs the `@/` alias to reach a route's
 * private `_components/`/`_lib/` folder — a route only ever imports its own
 * private folder by relative path (`./_components/x`, `../_components/x`).
 * This catches the easy, common violation (reaching into another route's
 * private folder through the alias) with zero false positives. The harder
 * case — a relative import that climbs out of one route's segment into a
 * sibling's `_components` — isn't cheaply expressible as a path pattern;
 * that's what the `frontend-reviewer` agent's rule 16 exists to catch
 * instead (see `apps/web/ARCHITECTURE.md`'s Enforcement section).
 */
const NO_ALIASED_CROSS_ROUTE_PRIVATE_IMPORTS = {
  group: [
    '@/app/*/_components/**',
    '@/app/**/_components/**',
    '@/app/*/_lib/**',
    '@/app/**/_lib/**',
  ],
  message:
    "A route's private _components/_lib folder is reachable only by relative import from within that route's own segment, never via the @/ alias.",
}

/**
 * Client components consume data through the query layer, not `lib/api`
 * directly — mirrors the api side's "only repository.ts touches the db"
 * shape. Route files (`page.tsx`/`layout.tsx`/`loading.tsx`) are exempt by
 * virtue of this block's `files` glob only matching `components` and a
 * route's own `_components` folder, not the route files that live one
 * level up from `_components`. The `lib/query` layer itself is exempt the
 * same way — it isn't under `components` or `_components`, and wrapping
 * `lib/api` is its job.
 */
const NO_LIB_API_FROM_COMPONENTS = {
  group: ['@/lib/api/*', '@/lib/api'],
  message:
    "Client components call a hook from @/lib/query/*, not @/lib/api directly — that's the query layer's job.",
  // Response-shape types (ProjectSummary, ApiKeyListItem, ...) are the
  // vocabulary the whole component tree passes around as props — only the
  // actual fetch call is the query layer's job, not the types describing
  // its result.
  allowTypeImports: true,
}

const eslintConfig = [
  ...compat.extends('next/core-web-vitals', 'next/typescript'),
  eslintConfigPrettier,
  {
    files: [
      'app/**/*.tsx',
      'app/**/*.ts',
      'components/**/*.tsx',
      'components/**/*.ts',
    ],
    plugins: { 'better-tailwindcss': betterTailwindcss },
    settings: {
      'better-tailwindcss': {
        entryPoint: 'app/globals.css',
      },
    },
    rules: {
      'better-tailwindcss/no-restricted-classes': [
        'error',
        { restrict: [NO_ARBITRARY_PX_REM_EM] },
      ],
    },
  },
  {
    files: ['**/*.ts', '**/*.tsx'],
    rules: {
      'no-restricted-imports': [
        'error',
        { patterns: [NO_ALIASED_CROSS_ROUTE_PRIVATE_IMPORTS] },
      ],
    },
  },
  {
    files: [
      'components/**/*.tsx',
      'components/**/*.ts',
      'app/**/_components/**/*.tsx',
      'app/**/_components/**/*.ts',
    ],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            NO_ALIASED_CROSS_ROUTE_PRIVATE_IMPORTS,
            NO_LIB_API_FROM_COMPONENTS,
          ],
        },
      ],
    },
  },
  {
    // Without an explicit tsconfigRootDir, typescript-eslint falls back to
    // inferring it from the config files evaluated so far in the current
    // process — ambiguous once other packages' configs (which touch
    // tseslint.configs.recommended) have also loaded, and it throws
    // "multiple candidate TSConfigRootDirs".
    files: ['**/*.ts', '**/*.tsx'],
    languageOptions: {
      parserOptions: {
        tsconfigRootDir: import.meta.dirname,
      },
    },
  },
  {
    ignores: [
      'node_modules/**',
      '.next/**',
      'out/**',
      'build/**',
      'next-env.d.ts',
    ],
  },
]

export default eslintConfig
