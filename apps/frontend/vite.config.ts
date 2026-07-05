import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";
import { coverageConfigDefaults } from "vitest/config";

export default defineConfig({
  plugins: [react(), tailwindcss()],
  test: {
    environment: "jsdom",
    setupFiles: ["./test/setup.ts"],
    // Explicit root, matching the backend's test/ convention — tests live in their own
    // top-level directory, never co-located next to the source files they cover.
    include: ["test/**/*.test.{ts,tsx}"],
    coverage: {
      provider: "v8",
      exclude: [...coverageConfigDefaults.exclude, "src/main.tsx"],
    },
  },
});
