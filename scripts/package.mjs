// Gera o executável do sistema atual com Node SEA (ADR-11):
//   release/simulador-encontros-<versão>-<win|linux|macos>-<arch>[.exe]
// Cada sistema gera o próprio executável (na CI, uma máquina de cada; ver E11).
import { execFileSync } from "node:child_process";
import { chmodSync, copyFileSync, mkdirSync, readdirSync, readFileSync, rmSync, statSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { inject } from "postject";
import * as ResEdit from "resedit";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const dist = path.join(root, "dist");
const release = path.join(root, "release");
const work = path.join(release, ".sea");

const pkg = JSON.parse(readFileSync(path.join(root, "package.json"), "utf8"));
const version = pkg.version;
const os = { win32: "win", linux: "linux", darwin: "macos" }[process.platform];
if (!os) throw new Error(`Sistema não suportado: ${process.platform}`);
const isWin = process.platform === "win32";
const isMac = process.platform === "darwin";
const exe = path.join(release, `simulador-encontros-${version}-${os}-${process.arch}${isWin ? ".exe" : ""}`);

// Precisa casar com SEA_MANIFEST / SEA_PREFIX em server/src/static.ts.
const MANIFEST = "client-manifest.json";
const PREFIX = "client/";

const step = (label) => console.log(`\n▸ ${label}`);
const mb = (file) => `${(statSync(file).size / 1024 / 1024).toFixed(1)} MB`;

function listFiles(dir, base = dir) {
  return readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
    const full = path.join(dir, e.name);
    return e.isDirectory() ? listFiles(full, base) : [path.relative(base, full).split(path.sep).join("/")];
  });
}

step("build de produção");
execFileSync(process.execPath, [path.join(root, "scripts/build.mjs")], { stdio: "inherit" });

step("preparando o blob do Node SEA (servidor + client embutido)");
rmSync(work, { recursive: true, force: true });
mkdirSync(work, { recursive: true });
const publicDir = path.join(dist, "public");
const files = listFiles(publicDir);
writeFileSync(path.join(work, MANIFEST), JSON.stringify(files));
const seaConfig = {
  main: path.join(dist, "server.cjs"),
  output: path.join(work, "sea-prep.blob"),
  disableExperimentalSEAWarning: true,
  useSnapshot: false,
  useCodeCache: false,
  assets: {
    [MANIFEST]: path.join(work, MANIFEST),
    ...Object.fromEntries(files.map((f) => [PREFIX + f, path.join(publicDir, f)])),
  },
};
const configPath = path.join(work, "sea-config.json");
writeFileSync(configPath, JSON.stringify(seaConfig, null, 2));
execFileSync(process.execPath, ["--experimental-sea-config", configPath], { stdio: "inherit" });
console.log(`  ${files.length} arquivos do client embutidos`);

step(`copiando o Node ${process.version} (${process.platform}-${process.arch})`);
mkdirSync(release, { recursive: true });
rmSync(exe, { force: true });
copyFileSync(process.execPath, exe);

if (isWin) {
  step("ícone e metadados do .exe");
  setWindowsResources(exe);
}
if (isMac) execFileSync("codesign", ["--remove-signature", exe], { stdio: "inherit" });

step("injetando o app no executável");
await inject(exe, "NODE_SEA_BLOB", readFileSync(seaConfig.output), {
  sentinelFuse: "NODE_SEA_FUSE_fce680ab2cc467b6e072b8b5df1996b2",
  ...(isMac && { machoSegmentName: "NODE_SEA" }),
});

// macOS exige assinatura (ad-hoc basta para rodar); Linux precisa do bit de execução.
if (isMac) execFileSync("codesign", ["--sign", "-", exe], { stdio: "inherit" });
if (!isWin) chmodSync(exe, 0o755);

rmSync(work, { recursive: true, force: true });
console.log(`\n✓ ${path.relative(root, exe)} (${mb(exe)})\n`);

/** Troca o ícone do Node pelo do app e grava nome/versão nas propriedades do arquivo. */
function setWindowsResources(file) {
  // ignoreCert: a assinatura do node.exe deixa de valer ao modificar o arquivo.
  const exeObj = ResEdit.NtExecutable.from(readFileSync(file), { ignoreCert: true });
  const res = ResEdit.NtExecutableResource.from(exeObj);

  const icon = ResEdit.Data.IconFile.from(readFileSync(path.join(root, "assets/icon.ico")));
  const groups = ResEdit.Resource.IconGroupEntry.fromEntries(res.entries);
  const targets = groups.length ? groups.map((g) => [g.id, g.lang]) : [[1, 1033]];
  for (const [id, lang] of targets) {
    ResEdit.Resource.IconGroupEntry.replaceIconsForResource(
      res.entries,
      id,
      lang,
      icon.icons.map((i) => i.data),
    );
  }

  const [major, minor, patch] = version.split(/[.-]/).map(Number);
  const info = ResEdit.Resource.VersionInfo.fromEntries(res.entries)[0] ?? ResEdit.Resource.VersionInfo.createEmpty();
  const langs = info.getAllLanguagesForStringValues();
  const lang = langs[0] ?? { lang: 1033, codepage: 1200 };
  info.setFileVersion(major, minor, patch, 0, lang.lang);
  info.setProductVersion(major, minor, patch, 0, lang.lang);
  info.setStringValues(lang, {
    ProductName: "Simulador de Encontros",
    FileDescription: "Simulador de Encontros — servidor da mesa de RPG",
    CompanyName: "Simulador de Encontros",
    LegalCopyright: "",
    InternalName: "simulador-encontros",
    OriginalFilename: path.basename(file),
    ProductVersion: version,
    FileVersion: version,
  });
  info.outputToResourceEntries(res.entries);

  res.outputResource(exeObj);
  writeFileSync(file, Buffer.from(exeObj.generate()));
}
