import { defineConfig } from "vitest/config";

// Deliberately independent of vite.config.ts — that one wraps TanStack
// Start's plugin chain (SSR-only import protection, server/client bundle
// splitting) which isn't meant to run under a test runner. Unit tests here
// only target framework-free logic modules, imported by relative path.
export default defineConfig({
  test: {
    environment: "node",
    include: ["src/**/*.test.ts"],
  },
});
