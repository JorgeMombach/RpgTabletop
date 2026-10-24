// Linha de comando (`npm start`, `node dist/server.cjs`, Docker). O app do mestre (Electron) usa o mesmo `startServer`.
import { exec } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { ConfigError, HELP, parseConfig, type Config } from "./config";
import { startServer } from "./start";

/** Definido pelo build (esbuild) quando o servidor roda empacotado em `dist/server.cjs`. */
declare const __BUNDLED__: boolean | undefined;

function fatal(message: string): never {
  console.error(`\n  ${message}\n`);
  process.exit(1);
}

function readConfig(): Config {
  try {
    return parseConfig(process.argv.slice(2), process.env);
  } catch (err) {
    if (err instanceof ConfigError) fatal(`${err.message}\n${HELP}`);
    throw err;
  }
}

/** Empacotado: o client fica em `public/` ao lado do server.cjs. Em dev: `client/dist`. */
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
  const config = readConfig();
  if (config.help) {
    console.log(HELP);
    return;
  }

  const server = await startServer(config, config.dev ? undefined : clientDir()).catch((err: Error) => fatal(err.message));
  console.log(server.banner + "  Para encerrar a sessão: Ctrl+C (ou feche esta janela).\n");

  if (!config.dev && config.openBrowser) openBrowser(config.gmLoopback ? server.local : server.gmLink);

  // Encerramento limpo: fecha os sockets e sai; se travar, força em 3 s.
  let closing = false;
  const shutdown = (signal: string) => {
    if (closing) return;
    closing = true;
    console.log(`\n  Encerrando a sessão (${signal})…`);
    setTimeout(() => process.exit(0), 3000).unref();
    void server.close().then(() => process.exit(0));
  };
  for (const sig of ["SIGINT", "SIGTERM", "SIGHUP"] as const) process.on(sig, () => shutdown(sig));
}

main().catch((err: unknown) => fatal(`Erro inesperado: ${err instanceof Error ? (err.stack ?? err.message) : String(err)}`));
