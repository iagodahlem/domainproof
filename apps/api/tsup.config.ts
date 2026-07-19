import { defineConfig } from "tsup";

export default defineConfig({
  entry: ["src/index.ts"],
  format: ["esm"],
  platform: "node",
  target: "node22",
  sourcemap: true,
  clean: true,
  outDir: "dist",
  // Runtime entry point, not a library — no .d.ts output needed.
  dts: false,
  // Workspace packages (e.g. @domainproof/core) export TypeScript source,
  // not a prebuilt dist — they're resolved just-in-time by tsx/tsc/editors
  // in dev, and have nothing on disk for a deployed image to import at
  // runtime. Bundling them into this package's own output is what makes
  // the built dist/ self-contained.
  noExternal: [/^@domainproof\//],
});
