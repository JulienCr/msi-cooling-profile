import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { build } from "esbuild";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const binDir = join(root, "com.juliencr.msi-cooling.sdPlugin", "bin");
mkdirSync(binDir, { recursive: true });

await build({
  entryPoints: [join(root, "src", "plugin.ts")],
  outfile: join(binDir, "plugin.js"),
  bundle: true,
  platform: "node",
  format: "esm",
  target: "node22",
  sourcemap: true,
  legalComments: "none",
  banner: {
    js: "import { createRequire as __createRequire } from 'node:module'; const require = __createRequire(import.meta.url);",
  },
  logLevel: "info",
});

writeFileSync(join(binDir, "package.json"), `${JSON.stringify({ type: "module" })}\n`);
