import { defineConfig } from 'tsup'

export default defineConfig({
  entry: ['src/index.ts'],
  format: ['esm', 'cjs'],
  target: 'es2022',
  dts: true,
  sourcemap: true,
  clean: true,
  outDir: 'dist',
  banner: {
    js: "'use client'",
  },
  // `@domainproof/ui` is private/unpublished — its component source is
  // compiled straight into this package's bundle rather than left as an
  // external import, since consumers never have it installed.
  noExternal: ['@domainproof/ui'],
})
