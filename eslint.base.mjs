import js from "@eslint/js";
import tseslint from "typescript-eslint";

/**
 * Shared flat ESLint config for packages/* stub packages.
 * Each package's eslint.config.mjs calls this with its own directory
 * so typescript-eslint can resolve the package's tsconfig for type-aware linting.
 */
export default function baseConfig(dirname) {
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
    },
  );
}
