// shared-types ships raw TypeScript source (no build step), consumed via the pnpm workspace
// symlink under node_modules — it needs to go through ts-jest too, unlike real third-party deps.
/** @type {import("jest").Config} */
export default {
  preset: "ts-jest/presets/default-esm",
  testEnvironment: "node",
  extensionsToTreatAsEsm: [".ts"],
  moduleNameMapper: {
    "^(\\.{1,2}/.*)\\.js$": "$1",
  },
  transform: {
    "^.+\\.ts$": ["ts-jest", { useESM: true }],
  },
  transformIgnorePatterns: ["/node_modules/(?!@task-tracker/)"],
  testMatch: ["<rootDir>/test/**/*.test.ts"],
  setupFiles: ["<rootDir>/test/setup-env.js"],
  coverageProvider: "v8",
  collectCoverageFrom: ["src/**/*.ts", "!src/generated/**"],
};
