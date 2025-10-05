import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    // Global settings
    globals: true,

    // Coverage configuration
    coverage: {
      provider: "v8",
      reporter: ["text", "json", "html", "lcov"],
      exclude: [
        "node_modules/",
        "dist/",
        "**/*.d.ts",
        "**/*.config.*",
        "**/mockData/**",
        "apps/demo/**",
        ".husky/**",
      ],
      // Require minimum coverage
      thresholds: {
        lines: 70,
        functions: 70,
        branches: 70,
        statements: 70,
      },
    },

    // Test file patterns
    include: [
      "packages/**/*.{test,spec}.{ts,tsx}",
      "shared/**/*.{test,spec}.{ts,tsx}",
    ],
    exclude: ["node_modules", "dist", ".husky", "apps/demo"],

    // Timeout for tests
    testTimeout: 10000,

    // Environment
    environment: "node",
  },
});
