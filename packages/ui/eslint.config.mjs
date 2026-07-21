import baseConfig from '../../eslint.base.mjs'

export default baseConfig(import.meta.dirname, [
  {
    group: ['**/apps/*', '**/apps/**', 'apps/*', 'apps/**'],
    message:
      'packages/ui must stay app-agnostic — components are token-only and must never assume auth context or import app internals.',
  },
])
