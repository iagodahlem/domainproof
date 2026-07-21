import baseConfig from '../../eslint.base.mjs'
import betterTailwindcss from 'eslint-plugin-better-tailwindcss'

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

export default [
  ...baseConfig(import.meta.dirname, [
    {
      group: ['**/apps/*', '**/apps/**', 'apps/*', 'apps/**'],
      message:
        'packages/ui must stay app-agnostic — components are token-only and must never assume auth context or import app internals.',
    },
  ]),
  {
    files: ['src/**/*.tsx', 'src/**/*.ts'],
    plugins: { 'better-tailwindcss': betterTailwindcss },
    settings: {
      'better-tailwindcss': {
        entryPoint: '../../apps/web/app/globals.css',
      },
    },
    rules: {
      'better-tailwindcss/no-restricted-classes': [
        'error',
        { restrict: [NO_ARBITRARY_PX_REM_EM] },
      ],
    },
  },
]
