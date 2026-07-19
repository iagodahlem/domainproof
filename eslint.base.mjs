import js from "@eslint/js";
import tseslint from "typescript-eslint";

/**
 * Shared flat ESLint config for packages/* stub packages (and apps/api).
 * Each package's eslint.config.mjs calls this with its own directory so
 * typescript-eslint can resolve the package's tsconfig for type-aware
 * linting, plus any package-specific `no-restricted-imports` patterns
 * layered on top of the repo-wide ones below.
 */

/**
 * Enforces extensionless relative imports repo-wide. This monorepo builds
 * buildable packages (core, api, sdk, cli, mcp) with tsup/esbuild under
 * `moduleResolution: "bundler"`, not tsc under NodeNext resolution — a
 * `.js` suffix on a relative specifier is stale copy-paste from the old
 * setup, not something the toolchain requires or expects anymore.
 */
export const EXTENSIONLESS_IMPORT_PATTERNS = [
  {
    group: ["*.js", "**/*.js"],
    message:
      "Relative imports must be extensionless (this repo builds with tsup under bundler module resolution, not NodeNext) — drop the .js suffix.",
  },
];

export default function baseConfig(dirname, extraRestrictedImportPatterns = []) {
  return tseslint.config(
    {
      ignores: ["dist/**", "node_modules/**"],
    },
    js.configs.recommended,
    ...tseslint.configs.recommended,
    {
      files: ["src/**/*.ts"],
      languageOptions: {
        parserOptions: {
          projectService: true,
          tsconfigRootDir: dirname,
        },
      },
      rules: {
        "no-restricted-imports": [
          "error",
          {
            patterns: [...EXTENSIONLESS_IMPORT_PATTERNS, ...extraRestrictedImportPatterns],
          },
        ],
      },
    },
  );
}
