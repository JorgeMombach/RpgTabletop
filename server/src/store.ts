import { randomUUID } from "node:crypto";
import type { Combatant, GameState, PublicPlayer, Role } from "@rpg/shared";

/** Mob ou NPC removido recentemente, guardado para o "Desfazer". */
export interface RemovedMob {
  mob: Combatant;
  list: "mobs" | "npcs";
  index: number;
  orderIndex: number | null;
  at: number;
}

export interface ServerPlayer {
  id: string;
  name: string;
  role: Role;
  /** Segredo usado para reconectar; nunca sai do servidor exceto para o próprio dono. */
  token: string;
  sockets: Set<string>;
}

export function createGame(): GameState {
  return {
    templates: [],
    allies: [],
    battle: {
      map: {
        image: null,
        imageVersion: 0,
        showGrid: true,
        cellPx: 50,
        offsetX: 0,
        offsetY: 0,
        feetPerCell: 5,
        rotation: 0,
        imageScale: 1,
      },
      mobs: [],
      npcs: [],
      combat: { active: false, round: 0, turnIndex: 0, order: [], turn: 0 },
      rolls: { request: null, reactions: [] },
    },
    log: [],
  };
}

/** Todo o estado da sessão, em memória (ADR-04). */
export class Store {
  players = new Map<string, ServerPlayer>();
  game: GameState = createGame();
  removedMobs = new Map<string, RemovedMob>();
  /** Último número usado por template ("Goblin 4" → 4), para não repetir nomes. */
  mobCounters = new Map<string, number>();

  constructor(readonly maxPlayers: number) {}

  createPlayer(name: string, role: Role): ServerPlayer {
    const player: ServerPlayer = {
      id: randomUUID(),
      name,
      role,
      token: randomUUID(),
      sockets: new Set(),
    };
    this.players.set(player.id, player);
    return player;
  }

  findGm(): ServerPlayer | undefined {
    for (const p of this.players.values()) if (p.role === "gm") return p;
  }

  findByToken(token: string): ServerPlayer | undefined {
    for (const p of this.players.values()) if (p.token === token) return p;
  }

  connectedPlayerCount(): number {
    let n = 0;
    for (const p of this.players.values()) if (p.role === "player" && p.sockets.size > 0) n++;
    return n;
  }
}

export function toPublic(p: ServerPlayer): PublicPlayer {
  return { id: p.id, name: p.name, role: p.role, connected: p.sockets.size > 0 };
}
