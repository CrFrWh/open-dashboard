import { defineConfig, mergeConfig } from "vitest/config";
import rootConfig from "../../vitest.config";

export default mergeConfig(
  rootConfig,
  defineConfig({
    test: {
      // Package-specific settings
      name: "core-parser",

      // Override root config if needed
      include: ["src/**/*.{test,spec}.{ts,tsx}"],

      // Package-specific coverage
      coverage: {
        include: ["src/**/*.ts"],
        exclude: [
          "src/**/*.d.ts",
          "src/**/*.config.ts",
          "src/**/index.ts", // Entry points usually just re-export
        ],
      },
    },
  })
);
