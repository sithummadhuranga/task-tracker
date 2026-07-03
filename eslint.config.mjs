import js from "@eslint/js";
import tseslint from "typescript-eslint";
import eslintConfigPrettier from "eslint-config-prettier";

/**
 * Shared base config, imported by each app's own eslint.config.mjs and extended
 * with environment-specific globals/plugins (Node vs browser, React, etc.).
 */
export const baseConfig = tseslint.config(
  js.configs.recommended,
  ...tseslint.configs.strictTypeChecked,
  ...tseslint.configs.stylisticTypeChecked,
  eslintConfigPrettier,
  {
    rules: {
      "@typescript-eslint/no-unused-vars": ["error", { argsIgnorePattern: "^_" }],
      "@typescript-eslint/no-non-null-assertion": "error",
      "@typescript-eslint/switch-exhaustiveness-check": "error",
    },
  },
  {
    // Config files (eslint.config.mjs, vite.config.ts, ...) sit outside every tsconfig's
    // "include", so they can never be type-checked — only plain syntax-level linting applies.
    files: ["**/*.config.mjs", "**/*.config.ts"],
    ...tseslint.configs.disableTypeChecked,
  },
  {
    ignores: ["**/dist/**", "**/coverage/**", "**/.turbo/**", "**/node_modules/**"],
  },
);

export default baseConfig;
