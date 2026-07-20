import { defineConfig } from 'vitest/config'

// Vite/Vitest doesn't read tsconfig "paths" on its own — resolve.tsconfigPaths
// is what makes @infra/*, @modules/*, and @shared/* resolve the same way
// they already do for tsc, tsup, and tsx (which all read tsconfig.json's
// paths natively).
export default defineConfig({
  resolve: {
    tsconfigPaths: true,
  },
})
