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
  // e2e suites hash/compare real passwords through bcryptjs (pure JS, no native binding) at
  // BCRYPT_COST 12 — a deliberate production security setting, not something to weaken for
  // tests. tasks.e2e.test.ts alone registers/logs in dozens of users, so under load Jest's
  // 5000ms default can be too tight even though nothing is actually hung.
  testTimeout: 15000,
  coverageProvider: "v8",
  collectCoverageFrom: ["src/**/*.ts", "!src/generated/**"],
  // A floor a few points below the current suite (97%+ across the board), not the current
  // number itself — enough headroom that a routine change doesn't fail CI on noise, while
  // still catching a real drop (e.g. a new module landing with no tests at all).
  coverageThreshold: {
    global: { statements: 90, branches: 85, functions: 95, lines: 90 },
  },
};
