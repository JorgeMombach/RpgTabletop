import { APP_VERSION } from "@rpg/shared";
import { createApp } from "./app";
import type { Config } from "./config";
import { listenWithFallback } from "./listen";

export interface RunningServer {
  port: number;
  /** Onde o mestre abre a mesa nesta máquina. */
  local: string;
  /** Link de mestre para outro dispositivo (nunca usa localhost). */
  gmLink: string;
  /** Texto com endereços e instruções, para o console. */
  banner: string;
  close: () => Promise<void>;
}

/**
 * Sobe a sessão (ADR-18): usado pela linha de comando, pelo Docker e pelo app Electron.
 * `clientDist` = pasta do front compilado; sem ela (dev) o front vem do Vite.
 */
export async function startServer(config: Config, clientDist?: string): Promise<RunningServer> {
  const app = createApp({
    port: config.port,
    maxPlayers: config.maxPlayers,
    clientDist,
    gmKey: config.gmKey,
    gmLoopback: config.gmLoopback,
    publicUrls: config.publicUrls,
    detectAddresses: config.detectAddresses,
    soundsDir: config.soundsDir,
  });

  let port: number;
  try {
    // Em dev a porta é fixa: o proxy do Vite aponta para ela. Pular para a seguinte faria o Vite falar
    // com outro servidor (ex.: o app do mestre aberto na 3000).
    port = await listenWithFallback(app.httpServer, config.port, config.dev ? 1 : 20);
  } catch (err) {
    if (config.dev) throw new Error(`Porta ${config.port} ocupada. No modo dev ela não muda (é a do proxy do Vite); feche o que estiver nela.`);
    throw new Error(`Não consegui abrir o servidor a partir da porta ${config.port}: ${(err as Error).message}`);
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
    "",
  ];
  if (config.dev) lines.push("  [dev] jogadores acessam pela porta 5173 do Vite", "");

  return { port, local, gmLink, banner: lines.join("\n"), close: () => app.close() };
}
