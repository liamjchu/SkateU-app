import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const target = join(
  root,
  "node_modules/expo/node_modules/@expo/cli/build/src/start/server/BundlerDevServer.js"
);

if (!existsSync(target)) {
  process.exit(0);
}

const before =
  "this.tunnel = (0, _env.envIsWebcontainer)() ? new _AsyncWsTunnel.AsyncWsTunnel(this.projectRoot, port) : new _AsyncNgrok.AsyncNgrok(this.projectRoot, port);";
const after =
  "this.tunnel = new _AsyncWsTunnel.AsyncWsTunnel(this.projectRoot, port);";

const source = readFileSync(target, "utf8");
if (source.includes(before)) {
  writeFileSync(target, source.replace(before, after));
}
