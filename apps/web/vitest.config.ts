import { configDefaults, defineConfig } from 'vitest/config'

export default defineConfig({
  // Vite/Vitest doesn't read tsconfig "paths" on its own — resolve.tsconfigPaths
  // is what makes @/* resolve the same way it already does for tsc and Next
  // (same fix as apps/api/vitest.config.ts's @infra/*, @modules/*, @shared/*).
  resolve: {
    tsconfigPaths: true,
  },
  // apps/web's own tsconfig sets `jsx: "preserve"` (Next's compiler does the
  // JSX transform itself), which Vite's oxc-based transform reads as "leave
  // JSX syntax alone" — override it here so the test runner actually
  // transforms JSX, the same way packages/ui's `jsx: "react-jsx"` tsconfig
  // already does implicitly.
  oxc: {
    jsx: { runtime: 'automatic' },
  },
  test: {
    environment: 'jsdom',
    setupFiles: ['./vitest.setup.ts'],
    // Playwright owns e2e/ (run via `test:e2e`) — keep vitest out of it.
    exclude: [...configDefaults.exclude, 'e2e/**'],
  },
})
