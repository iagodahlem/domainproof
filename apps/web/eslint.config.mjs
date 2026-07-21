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

const eslintConfig = [
  ...compat.extends('next/core-web-vitals', 'next/typescript'),
  eslintConfigPrettier,
  {
    files: ['app/**/*.tsx', 'app/**/*.ts'],
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
