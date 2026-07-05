/// <reference types="vitest/config" />
import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

export default defineConfig({
  plugins: [react(), tailwindcss()],
  test: {
    environment: "jsdom",
    setupFiles: ["./test/setup.ts"],
    // Explicit root, matching the backend's test/ convention — tests live in their own
    // top-level directory, never co-located next to the source files they cover.
    include: ["test/**/*.test.{ts,tsx}"],
  },
});
