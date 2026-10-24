import { exec } from "node:child_process";
import path from "node:path";
import { isSea } from "node:sea";
import { fileURLToPath } from "node:url";
import { APP_VERSION } from "@rpg/shared";
import { createApp } from "./app";
import { ConfigError, HELP, parseConfig, type Config } from "./config";
import { listenWithFallback } from "./listen";

/** Definido pelo build (esbuild) quando o servidor roda empacotado em `dist/server.cjs`. */
declare const __BUNDLED__: boolean | undefined;

/** Rodando como executável (Node SEA, ADR-11), normalmente aberto com dois cliques. */
const asExecutable = (() => {
  try {
    return isSea();
  } catch {
    return false;
  }
})();

/**
 * Erro que impede a sessão de subir. No executável a janela fecharia na hora,
 * sem dar tempo de ler: espera um Enter antes de sair.
 */
async function fatal(message: string): Promise<never> {
  console.error(`\n  ${message}\n`);
  if (asExecutable && process.stdin.isTTY) {
    console.error("  Pressione Enter para fechar.");
    await new Promise((resolve) => process.stdin.once("data", resolve));
  }
  process.exit(1);
}

async function readConfig(): Promise<Config> {
  try {
    return parseConfig(process.argv.slice(2), process.env);
  } catch (err) {
    if (err instanceof ConfigError) return fatal(`${err.message}\n${HELP}`);
    throw err;
  }
}

/** Empacotado: o client fica em `public/` ao lado do server.cjs. Em dev: `client/dist`. No executável vem embutido. */
function clientDir(): string {
  if (process.env.CLIENT_DIR) return path.resolve(process.env.CLIENT_DIR);
  if (typeof __BUNDLED__ !== "undefined") return path.join(__dirname, "public");
  return path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../client/dist");
}

function openBrowser(url: string) {
  const cmd =
    process.platform === "win32"
      ? `start "" "${url}"`
      : process.platform === "darwin"
        ? `open "${url}"`
        : `xdg-open "${url}"`;
  exec(cmd, () => {});
}

async function main() {
  process.title = "Jamal's Tabletop";
  const config = await readConfig();
  if (config.help) {
    console.log(HELP);
    return;
  }

  const app = createApp({
    port: config.port,
    maxPlayers: config.maxPlayers,
    clientDist: config.dev ? undefined : clientDir(),
    gmKey: config.gmKey,
    gmLoopback: config.gmLoopback,
    publicUrls: config.publicUrls,
    detectAddresses: config.detectAddresses,
  });

  let port: number;
  try {
    port = await listenWithFallback(app.httpServer, config.port);
  } catch (err) {
    return fatal(`Não consegui abrir o servidor a partir da porta ${config.port}: ${(err as Error).message}`);
  }
  app.setPort(port);

  const local = config.dev ? "http://localhost:5173" : `http://localhost:${port}`;
  const { addresses } = app.host;
  // Link para outro dispositivo: "localhost" só funciona nesta máquina (e no Docker nem nela),
  // então usa o primeiro endereço de convite (configurado ou detectado).
  const gmLink = `${addresses[0]?.url ?? local}/?gm=${config.gmKey}`;
  const lines = [
    "",
    `  Jamal's Tabletop v${APP_VERSION}`,
    "",
    ...(port !== config.port ? [`  A porta ${config.port} estava ocupada; usando a ${port}.`, ""] : []),
    config.gmLoopback
      ? `  Mestre (esta máquina):  ${local}`
      : "  Mestre: use o link com a chave abaixo (troque host/porta pelo endereço publicado, se for outro)",
    `  Link de mestre (outro dispositivo, não compartilhe): ${gmLink}`,
    "",
    "  Jogadores:",
    ...(addresses.length
      ? addresses.map((a) => `    ${a.url.padEnd(28)} ${a.label}`)
      : ["    (nenhuma interface de rede encontrada; defina PUBLIC_URLS)"]),
    "",
    `  Limite: ${config.maxPlayers} jogadores`,
    asExecutable
      ? "  Deixe esta janela aberta durante o jogo. Fechar a janela encerra a sessão."
      : "  Para encerrar a sessão: Ctrl+C (ou feche esta janela).",
    "",
  ];
  if (config.dev) lines.push("  [dev] jogadores acessam pela porta 5173 do Vite", "");
  console.log(lines.join("\n"));

  if (!config.dev && config.openBrowser) openBrowser(config.gmLoopback ? local : gmLink);

  // Encerramento limpo: fecha os sockets e sai; se travar, força em 3 s.
  let closing = false;
  const shutdown = (signal: string) => {
    if (closing) return;
    closing = true;
    console.log(`\n  Encerrando a sessão (${signal})…`);
    setTimeout(() => process.exit(0), 3000).unref();
    void app.close().then(() => process.exit(0));
  };
  for (const sig of ["SIGINT", "SIGTERM", "SIGHUP"] as const) process.on(sig, () => shutdown(sig));
}

main().catch((err: unknown) => fatal(`Erro inesperado: ${err instanceof Error ? (err.stack ?? err.message) : String(err)}`));
