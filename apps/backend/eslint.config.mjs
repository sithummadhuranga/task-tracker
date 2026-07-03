import globals from "globals";
import { baseConfig } from "../../eslint.config.mjs";

export default [
  ...baseConfig,
  {
    files: ["**/*.js", "**/*.ts"],
    languageOptions: {
      globals: globals.node,
    },
  },
  {
    files: ["src/**/*.ts", "test/**/*.ts"],
    languageOptions: {
      parserOptions: {
        project: "./tsconfig.json",
        tsconfigRootDir: import.meta.dirname,
      },
    },
  },
];
