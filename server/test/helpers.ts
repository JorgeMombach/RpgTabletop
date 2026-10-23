import type { AddressInfo } from "node:net";
import { after, before, beforeEach } from "node:test";
import { io as connect, type Socket } from "socket.io-client";
import type {
  ActionName,
  ActionPayloads,
  ActionResult,
  ClientState,
  ClientToServerEvents,
  JoinResult,
  ServerToClientEvents,
} from "@rpg/shared";
import { createApp, type AppOptions } from "../src/app";
import { Store } from "../src/store";

export type Client = Socket<ServerToClientEvents, ClientToServerEvents>;

export const MAX = 6;

/** Sobe um servidor por arquivo de teste e zera o estado antes de cada teste. */
export function useServer(options: Partial<AppOptions> = {}) {
  const ctx = {} as { server: ReturnType<typeof createApp>; url: string };
  const clients: Client[] = [];

  async function closeAll() {
    for (const c of clients.splice(0)) c.disconnect();
    await new Promise((r) => setTimeout(r, 50));
  }

  before(async () => {
    ctx.server = createApp({ port: 0, maxPlayers: MAX, ...options });
    await new Promise<void>((resolve) => ctx.server.httpServer.listen(0, resolve));
    ctx.url = `http://localhost:${(ctx.server.httpServer.address() as AddressInfo).port}`;
  });

  after(async () => {
    await closeAll();
    await ctx.server.close();
  });

  beforeEach(async () => {
    await closeAll();
    // Store novo, mas o servidor continua apontando para o mesmo objeto.
    Object.assign(ctx.server.store, new Store(MAX));
  });

  /** Conexão local = mestre; com X-Forwarded-For de outro IP = jogador remoto. */
  function client(remoteIp?: string): Promise<Client> {
    const socket: Client = connect(ctx.url, {
      transports: ["websocket"],
      forceNew: true,
      extraHeaders: remoteIp ? { "x-forwarded-for": remoteIp } : {},
    });
    clients.push(socket);
    return new Promise((resolve, reject) => {
      socket.once("connect", () => resolve(socket));
      socket.once("connect_error", reject);
    });
  }

  return { ctx, client, url: () => ctx.url };
}

export function join(socket: Client, name: string, sessionToken?: string, gmKey?: string): Promise<JoinResult> {
  return socket.timeout(2000).emitWithAck("session:join", { name, sessionToken, gmKey });
}

export function nextState(socket: Client): Promise<ClientState> {
  return new Promise((resolve) => socket.once("state:full", resolve));
}

/** Espera o primeiro estado que satisfaz `pred` (broadcasts anteriores podem chegar antes). */
export function stateWhere(socket: Client, pred: (s: ClientState) => boolean): Promise<ClientState> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error("estado esperado não chegou")), 2000);
    const handler = (s: ClientState) => {
      if (!pred(s)) return;
      clearTimeout(timer);
      socket.off("state:full", handler);
      resolve(s);
    };
    socket.on("state:full", handler);
  });
}

type AckEmitter = { emitWithAck(ev: string, payload: unknown): Promise<ActionResult> };

/** Dispara uma ação e espera o resultado. */
export function act<K extends ActionName>(socket: Client, name: K, payload: ActionPayloads[K]): Promise<ActionResult> {
  return (socket.timeout(2000) as unknown as AckEmitter).emitWithAck(name, payload);
}
