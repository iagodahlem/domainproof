import baseConfig from '../../eslint.base.mjs'

export default baseConfig(import.meta.dirname, [
  {
    group: ['**/apps/*', '**/apps/**', 'apps/*', 'apps/**'],
    message:
      'packages/core is pure domain logic with zero IO — it must never import from apps/. If code here needs something app-specific, that code belongs in apps/api instead.',
  },
])
