import { createRequire } from "node:module";
import type { Config } from "tailwindcss";

type ModuleLoader = {
  _resolveFilename: (
    request: string,
    parent: unknown,
    isMain: boolean,
    options?: unknown,
  ) => string;
};

const require = createRequire(import.meta.url);
const moduleLoader = require("module") as ModuleLoader;
const resolveFilename = moduleLoader._resolveFilename;
const nativewindPresetStub = require.resolve("./nativewind-preset-stub.cjs");
const mobileTailwindConfigPath = ["..", "..", "tailwind.config.js"].join("/");

let mobileTailwindConfig: Config;
try {
  moduleLoader._resolveFilename = (request, parent, isMain, options) =>
    request === "nativewind/preset"
      ? nativewindPresetStub
      : resolveFilename(request, parent, isMain, options);
  mobileTailwindConfig = require(mobileTailwindConfigPath) as Config;
} finally {
  moduleLoader._resolveFilename = resolveFilename;
}

const config = {
  content: ["./src/app/**/*.{js,ts,jsx,tsx,mdx}"],
  presets: [mobileTailwindConfig],
} satisfies Config;

export default config;
