// App do mestre (Electron, ADR-18) do sistema atual em release/.
//   node scripts/package.mjs          → empacota (Windows: .exe portátil; macOS: .dmg; Linux: .AppImage)
//   node scripts/package.mjs --run    → só compila e abre o app (teste local, sem empacotar)
// Cada sistema gera o próprio pacote (a CI roda nos três).
import { execSync } from "node:child_process";
import { copyFileSync, mkdirSync, readFileSync, rmSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { build as esbuild } from "esbuild";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const desktop = path.join(root, "desktop");
const out = path.join(desktop, "dist");
const { version } = JSON.parse(readFileSync(path.join(root, "package.json"), "utf8"));
const run = process.argv.includes("--run");

function step(label) {
  console.log(`\n▸ ${label}`);
}

step("client + servidor (scripts/build.mjs)");
execSync("node scripts/build.mjs", { cwd: root, stdio: "inherit" });

step("app do mestre (esbuild → desktop/dist)");
rmSync(out, { recursive: true, force: true });
mkdirSync(out, { recursive: true });
const common = {
  bundle: true,
  platform: "node",
  target: "node22",
  format: "cjs",
  // O próprio Electron e as dependências opcionais do `ws` ficam de fora.
  external: ["electron", "bufferutil", "utf-8-validate"],
  define: { "import.meta.url": "__import_meta_url" },
  banner: { js: 'const __import_meta_url = require("node:url").pathToFileURL(__filename).href;' },
  legalComments: "none",
  logLevel: "warning",
};
await esbuild({ ...common, entryPoints: [path.join(desktop, "src/main.ts")], outfile: path.join(out, "main.cjs") });
// O preload roda isolado (sandbox): só pode usar `require("electron")`, então vai sem o banner de `import.meta`.
await esbuild({
  ...common,
  define: {},
  banner: {},
  entryPoints: [path.join(desktop, "src/preload.ts")],
  outfile: path.join(out, "preload.cjs"),
});
copyFileSync(path.join(desktop, "src/splash.html"), path.join(out, "splash.html"));

if (run) {
  step("abrindo o app (Ctrl+C encerra)");
  execSync("npx electron .", { cwd: desktop, stdio: "inherit" });
  process.exit(0);
}

step(`empacotando v${version} (electron-builder → release/)`);
const { build } = await import("electron-builder");
const assets = path.join(root, "assets");
await build({
  projectDir: desktop,
  publish: "never",
  config: {
    appId: "io.github.jorgemombach.jamalstabletop",
    productName: "Jamal's Tabletop",
    copyright: "Jorge Mombach",
    directories: { output: path.join(root, "release"), buildResources: assets },
    // Tudo já vem empacotado pelo esbuild: nada de node_modules no app. O front vai dentro do app.asar (e não
    // solto em resources/): o .exe portátil extrai o app numa pasta fixa de %TEMP% e, se aberto de novo com o app
    // já aberto, apaga dela tudo que não está em uso. O app.asar fica travado enquanto o app roda; arquivos soltos
    // sumiam e a mesa quebrava (ex.: a imagem do mapa não carregava mais).
    files: ["dist/**/*", "package.json", { from: path.join(root, "dist/public"), to: "public" }],
    extraMetadata: { version, author: "Jorge Mombach", productName: "Jamal's Tabletop" },
    npmRebuild: false,
    // Windows e Linux: binário sem apóstrofo (jamals-tabletop). No Mac fica o nome do app: lá `executableName`
    // também renomeia o pacote (.app), e o README manda o usuário procurar "Jamal's Tabletop.app".
    win: { target: [{ target: "portable", arch: ["x64"] }], icon: path.join(assets, "icon.ico"), executableName: "jamals-tabletop" },
    portable: {
      artifactName: "jamals-tabletop-${version}-win-x64.${ext}",
      // Aparece enquanto extrai (alguns segundos): sem ela parecia que o clique não tinha funcionado e a pessoa
      // abria de novo. Com ela, abrir com o app já aberto avisa em vez de extrair por cima em silêncio.
      splashImage: path.join(assets, "splash.bmp"),
    },
    // Sem assinatura (identity null): o Gatekeeper pede "botão direito → Abrir" na primeira vez (ver README).
    mac: { target: [{ target: "dmg", arch: ["arm64"] }], icon: path.join(assets, "icon.png"), category: "public.app-category.games", identity: null },
    dmg: { artifactName: "jamals-tabletop-${version}-macos-arm64.${ext}", title: "${productName} ${version}" },
    linux: { target: [{ target: "AppImage", arch: ["x64"] }], icon: path.join(assets, "icon.png"), category: "Game", executableName: "jamals-tabletop" },
    appImage: { artifactName: "jamals-tabletop-${version}-linux-x64.${ext}" },
  },
});
console.log("\n✓ pacote em release/\n");
