import express from "express";
import { randomBytes } from "node:crypto";
import { createServer } from "node:http";
import { Server, type Socket } from "socket.io";
import {
  LIMITS,
  type ActionName,
  type ActionResult,
  type ClientToServerEvents,
  type GridPos,
  type JoinPayload,
  type JoinResult,
  type Ruler,
  type ServerToClientEvents,
  APP_VERSION,
} from "@rpg/shared";
import { handlers } from "./actions";
import type { Handler } from "./actions/types";
import { hostInfo, roleOf, type RoleRules } from "./net";
import { Store, toPublic, type ServerPlayer } from "./store";
import { validArea } from "./validate";
import { ActionError, cleanName } from "./validate";
import { serveClient } from "./static";
import { viewFor } from "./view";

interface SocketData {
  playerId?: string;
}

export type AppServer = Server<ClientToServerEvents, ServerToClientEvents, object, SocketData>;
export type AppSocket = Socket<ClientToServerEvents, ServerToClientEvents, object, SocketData>;

export interface AppOptions {
  port: number;
  maxPlayers: number;
  /** Pasta com o build do client; se não existir, só o socket fica disponível. */
  clientDist?: string;
  /** Chave de mestre (ADR-12); sem ela, uma aleatória é gerada. */
  gmKey?: string;
  /** localhost vira mestre (padrão: sim). */
  gmLoopback?: boolean;
  /** Endereços de convite fixos (ex.: Docker). */
  publicUrls?: string[];
  /** Listar os IPs desta máquina como convite (padrão: sim; no Docker, não). */
  detectAddresses?: boolean;
}

function validRuler(raw: unknown): Ruler | null {
  const r = raw as Ruler | null;
  const ok = (p: GridPos | undefined) =>
    !!p && Number.isInteger(p.col) && Number.isInteger(p.row) && Math.abs(p.col) <= LIMITS.gridCoord && Math.abs(p.row) <= LIMITS.gridCoord;
  return r && ok(r.from) && ok(r.to) ? { from: { col: r.from.col, row: r.from.row }, to: { col: r.to.col, row: r.to.row } } : null;
}

export function createApp(opts: AppOptions) {
  const app = express();
  const httpServer = createServer(app);
  const io: AppServer = new Server(httpServer, {
    // Imagens de mapa e avatares viajam pelo socket.
    maxHttpBufferSize: 10e6,
    // O client do Socket.IO já vai no bundle do front; não servimos o arquivo avulso.
    serveClient: false,
  });
  const store = new Store(opts.maxPlayers);
  const rules: RoleRules = {
    gmKey: opts.gmKey ?? randomBytes(12).toString("base64url"),
    gmLoopback: opts.gmLoopback ?? true,
  };
  const detect = opts.detectAddresses ?? true;
  let host = hostInfo(opts.port, rules.gmKey, opts.publicUrls, detect);
  const startedAt = Date.now();

  // Healthcheck (Docker) e diagnóstico rápido.
  app.get("/healthz", (_req, res) => {
    res.json({
      ok: true,
      version: APP_VERSION,
      uptimeSec: Math.round((Date.now() - startedAt) / 1000),
      players: store.connectedPlayerCount(),
    });
  });

  serveClient(app, opts.clientDist);

  /** Sala com todos os sockets que já entraram na sessão. */
  const SESSION_ROOM = "session";
  let sentImageVersion = 0;

  function mapImage() {
    const { image, imageVersion } = store.game.battle.map;
    return { version: imageVersion, image };
  }

  function broadcast() {
    // A imagem do mapa é pesada: vai à parte e só quando muda (ADR-05).
    if (store.game.battle.map.imageVersion !== sentImageVersion) {
      sentImageVersion = store.game.battle.map.imageVersion;
      io.to(SESSION_ROOM).emit("map:image", mapImage());
    }
    for (const player of store.players.values()) {
      if (player.sockets.size === 0) continue;
      const view = viewFor(store, player, host);
      for (const sid of player.sockets) io.to(sid).emit("state:full", view);
    }
  }

  function detach(socket: AppSocket) {
    const id = socket.data.playerId;
    if (!id) return;
    store.players.get(id)?.sockets.delete(socket.id);
    socket.data.playerId = undefined;
    void socket.leave(SESSION_ROOM);
  }

  function join(socket: AppSocket, payload: JoinPayload): JoinResult {
    const name = cleanName(payload?.name);
    if (!name) return { ok: false, error: "invalid_name" };

    const role = roleOf(socket, rules, payload?.gmKey);
    detach(socket);

    let player: ServerPlayer | undefined;
    if (role === "gm") {
      // Só existe um mestre: toda conexão local assume essa identidade.
      player = store.findGm() ?? store.createPlayer(name, "gm");
    } else {
      const known = payload.sessionToken ? store.findByToken(payload.sessionToken) : undefined;
      if (known?.role === "player") player = known;
      const alreadyOnline = player !== undefined && player.sockets.size > 0;
      if (!alreadyOnline && store.connectedPlayerCount() >= store.maxPlayers) {
        return { ok: false, error: "room_full" };
      }
      player ??= store.createPlayer(name, "player");
    }

    player.name = name;
    player.sockets.add(socket.id);
    socket.data.playerId = player.id;
    void socket.join(SESSION_ROOM);
    if (store.game.battle.map.image) socket.emit("map:image", mapImage());
    return { ok: true, self: toPublic(player), sessionToken: player.token };
  }

  /** Executa uma ação de quem está na sessão; sucesso → broadcast do novo estado. */
  function runAction(socket: AppSocket, name: ActionName, payload: unknown): ActionResult {
    const player = socket.data.playerId ? store.players.get(socket.data.playerId) : undefined;
    if (!player) return { ok: false, error: "Entre na sessão primeiro." };
    const handler = handlers[name] as Handler<ActionName> | undefined;
    if (!handler) return { ok: false, error: "Ação desconhecida." };

    try {
      const ids = handler(store, player, payload as never);
      broadcast();
      return ids ? { ok: true, ids } : { ok: true };
    } catch (err) {
      if (err instanceof ActionError) return { ok: false, error: err.message };
      console.error(`[${name}]`, err);
      return { ok: false, error: "Ação inválida." };
    }
  }

  io.on("connection", (socket: AppSocket) => {
    socket.on("session:probe", (payload, ack) => {
      if (typeof ack === "function") ack({ role: roleOf(socket, rules, payload?.gmKey) });
    });

    socket.on("session:join", (payload, ack) => {
      if (typeof ack !== "function") return;
      const result = join(socket, payload);
      ack(result);
      if (result.ok) broadcast();
    });

    for (const name of Object.keys(handlers) as ActionName[]) {
      // O tipo do evento varia por ação; o handler valida o payload.
      (socket.on as (ev: string, fn: (payload: unknown, ack?: unknown) => void) => void)(name, (payload, ack) => {
        const result = runAction(socket, name, payload);
        if (typeof ack === "function") ack(result);
        else if (!result.ok) socket.emit("toast", { kind: "error", text: result.error });
      });
    }

    // Régua: efêmera, só repassada para os outros (não entra no estado).
    socket.on("ruler:update", (ruler) => {
      const player = socket.data.playerId ? store.players.get(socket.data.playerId) : undefined;
      if (!player) return;
      socket.to(SESSION_ROOM).emit("ruler", { playerId: player.id, name: player.name, ruler: validRuler(ruler) });
    });

    socket.on("area:update", (area) => {
      const player = socket.data.playerId ? store.players.get(socket.data.playerId) : undefined;
      if (!player) return;
      socket.to(SESSION_ROOM).emit("area", { playerId: player.id, name: player.name, area: validArea(area) });
    });

    socket.on("session:leave", () => {
      const playerId = socket.data.playerId;
      detach(socket);
      if (!playerId) return;
      io.to(SESSION_ROOM).emit("ruler", { playerId, name: "", ruler: null });
      io.to(SESSION_ROOM).emit("area", { playerId, name: "", area: null });
      broadcast();
    });

    socket.on("disconnect", () => {
      const playerId = socket.data.playerId;
      detach(socket);
      if (!playerId) return;
      io.to(SESSION_ROOM).emit("ruler", { playerId, name: "", ruler: null });
      io.to(SESSION_ROOM).emit("area", { playerId, name: "", area: null });
      broadcast();
    });
  });

  return {
    app,
    httpServer,
    io,
    store,
    rules,
    get host() {
      return host;
    },
    /** Atualiza a porta real (após o fallback de porta ocupada) nos endereços de convite. */
    setPort(port: number) {
      host = hostInfo(port, rules.gmKey, opts.publicUrls, detect);
    },
    broadcast,
    close: () => new Promise<void>((resolve) => io.close(() => resolve())),
  };
}
