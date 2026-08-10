import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    coverage: {
      provider: "v8",
      reporter: ["text", "html", "json-summary"],
      include: [
        "src/app/page.tsx",
        "src/app/_components/**/*.tsx",
        "src/app/api/subscribe/route.ts",
        "src/app/confirm/route.ts",
      ],
      exclude: ["**/*.test.ts", "**/*.test.tsx"],
      thresholds: {
        branches: 80,
        functions: 80,
        lines: 80,
        statements: 80,
      },
    },
  },
});
