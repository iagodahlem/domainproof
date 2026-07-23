import baseConfig from '../../eslint.base.mjs'

export default [
  ...baseConfig(import.meta.dirname),
  {
    // The only file allowed to import @modelcontextprotocol/sdk's deep,
    // .js-suffixed subpaths directly — see src/mcp-sdk.ts's doc comment.
    files: ['src/mcp-sdk.ts'],
    rules: {
      'no-restricted-imports': 'off',
    },
  },
]
