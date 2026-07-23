import baseConfig from '../../eslint.base.mjs'

export default [
  ...baseConfig(import.meta.dirname, [
    {
      group: ['@domainproof/sdk', '@domainproof/core'],
      message:
        "@domainproof/react must stay self-contained — it talks to the frontend plane directly and ships to consumers who never have these workspace packages installed. (@domainproof/ui is fine — its component source is compiled straight into this package's bundle, see tsup.config.ts.)",
    },
  ]),
  {
    // The CSS build script runs under Node directly (not bundled), so it
    // needs the Node globals every other file here gets from `jsdom`/tsup
    // instead.
    files: ['scripts/**/*.mjs'],
    languageOptions: {
      globals: { process: 'readonly' },
    },
  },
]
