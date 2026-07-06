import reactHooks from "eslint-plugin-react-hooks";
import globals from "globals";
import { baseConfig } from "../../eslint.config.mjs";

export default [
  ...baseConfig,
  {
    // eslint-plugin-react-hooks still ships its "recommended-latest" preset in the legacy
    // eslintrc plugins-array shape, so it's rebuilt here in native flat-config form.
    files: ["**/*.tsx", "**/*.ts"],
    plugins: { "react-hooks": reactHooks },
    rules: reactHooks.configs["recommended-latest"].rules,
  },
  {
    files: ["**/*.js", "**/*.ts", "**/*.tsx"],
    languageOptions: {
      globals: globals.browser,
    },
  },
  {
    files: ["src/**/*.ts", "src/**/*.tsx", "test/**/*.ts", "test/**/*.tsx"],
    languageOptions: {
      parserOptions: {
        project: "./tsconfig.json",
        tsconfigRootDir: import.meta.dirname,
      },
    },
  },
];
