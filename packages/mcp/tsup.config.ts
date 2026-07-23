import { defineConfig } from 'tsup'

export default defineConfig({
  // Two entries: `index.ts` is the library surface (`createServer`, the
  // HTTP transport) a host like apps/api imports; `cli.ts` is the
  // stdio/npx bin — tsup preserves its shebang and marks the output
  // executable.
  entry: ['src/index.ts', 'src/cli.ts'],
  format: ['esm'],
  platform: 'node',
  target: 'node22',
  dts: true,
  sourcemap: true,
  clean: true,
  outDir: 'dist',
})
