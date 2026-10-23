// Build de produção: client (Vite) + servidor num único arquivo (esbuild).
// Saída em dist/: server.cjs e public/ (o client). Roda com `node dist/server.cjs`.
import { execSync } from "node:child_process";
import { cpSync, rmSync, statSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { build } from "esbuild";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const dist = path.join(root, "dist");

function step(label) {
  console.log(`\n▸ ${label}`);
}

rmSync(dist, { recursive: true, force: true });

step("client (Vite)");
execSync("npm run build -w client", { cwd: root, stdio: "inherit" });

step("servidor (esbuild → dist/server.cjs)");
await build({
  entryPoints: [path.join(root, "server/src/index.ts")],
  outfile: path.join(dist, "server.cjs"),
  bundle: true,
  platform: "node",
  target: "node20",
  format: "cjs",
  // Dependências opcionais do `ws` (aceleradores nativos): ficam de fora.
  external: ["bufferutil", "utf-8-validate"],
  define: {
    __BUNDLED__: "true",
    // CJS não tem import.meta; o código só usa isso fora do bundle, mas o esbuild exige um valor.
    "import.meta.url": "__import_meta_url",
  },
  banner: { js: 'const __import_meta_url = require("node:url").pathToFileURL(__filename).href;' },
  legalComments: "none",
  logLevel: "warning",
});

step("copiando client para dist/public");
cpSync(path.join(root, "client/dist"), path.join(dist, "public"), { recursive: true });

const kb = (f) => `${Math.round(statSync(path.join(dist, f)).size / 1024)} KB`;
console.log(`\n✓ dist/server.cjs (${kb("server.cjs")}) + dist/public/`);
console.log("  Rodar: node dist/server.cjs\n");
