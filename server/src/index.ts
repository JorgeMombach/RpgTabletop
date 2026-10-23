import { exec } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createApp } from "./app";
import { config } from "./config";

const here = path.dirname(fileURLToPath(import.meta.url));
const clientDist = path.resolve(here, "../../client/dist");

const { httpServer, host } = createApp({
  port: config.port,
  maxPlayers: config.maxPlayers,
  clientDist: config.dev ? undefined : clientDist,
});

function openBrowser(url: string) {
  const cmd =
    process.platform === "win32"
      ? `start "" "${url}"`
      : process.platform === "darwin"
        ? `open "${url}"`
        : `xdg-open "${url}"`;
  exec(cmd, () => {});
}

httpServer.on("error", (err: NodeJS.ErrnoException) => {
  if (err.code === "EADDRINUSE") {
    console.error(`\n  A porta ${config.port} já está em uso. Feche o outro servidor ou rode com PORT=<outra porta>.\n`);
    process.exit(1);
  }
  throw err;
});

// Sem host explícito o Node escuta em IPv4 e IPv6 (localhost pode resolver para ::1).
httpServer.listen(config.port, () => {
  const local = config.dev ? "http://localhost:5173" : `http://localhost:${config.port}`;
  const lines = [
    "",
    "  Simulador de Encontros rodando",
    "",
    `  Mestre (esta máquina):  ${local}`,
    "",
    "  Jogadores:",
    ...(host.addresses.length
      ? host.addresses.map((a) => `    ${a.url.padEnd(28)} ${a.label}`)
      : ["    (nenhuma interface de rede encontrada)"]),
    "",
    `  Limite: ${config.maxPlayers} jogadores`,
    "",
  ];
  if (config.dev) lines.push("  [dev] jogadores acessam pela porta 5173 do Vite", "");
  console.log(lines.join("\n"));

  if (!config.dev && config.openBrowser) openBrowser(local);
});
