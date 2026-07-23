import baseConfig from '../../eslint.base.mjs'

export default baseConfig(import.meta.dirname, [
  {
    group: ['@domainproof/sdk', '@domainproof/core', '@domainproof/ui'],
    message:
      '@domainproof/react must stay self-contained — it talks to the frontend plane directly and ships to consumers who never have these workspace packages installed.',
  },
])
