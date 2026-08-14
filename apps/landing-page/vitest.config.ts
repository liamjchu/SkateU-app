import path from "node:path";
import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

const root = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  root,
  test: {
    dir: path.join(root, "src"),
    include: ["**/*.test.ts", "**/*.test.tsx"],
    setupFiles: [path.join(root, "src/test/setup.ts")],
    environment: "node",
    coverage: {
      provider: "v8",
      reporter: ["text", "html", "json-summary"],
      include: [
        "src/app/page.tsx",
        "src/app/_components/**/*.tsx",
        "src/app/api/subscribe/route.ts",
        "src/app/confirm/page.tsx",
        "src/lib/confirm-subscription.ts",
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
