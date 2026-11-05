import { randomUUID } from "node:crypto";
import { emptyFog, LIMITS, type Combatant, type GameState, type Handout, type PublicPlayer, type Role, type SoundState, type LootResults, type CharacterSheet } from "@rpg/shared";
import { defaultWeather } from "./weather";

/** Mob ou NPC removido recentemente, guardado para o "Desfazer". */
export interface RemovedMob {
  mob: Combatant;
  list: "mobs" | "npcs";
  index: number;
  orderIndex: number | null;
  at: number;
  /** Conjurados que saíram junto (E21): o "Desfazer" do conjurador traz todos. */
  summonIds?: string[];
}

export interface ServerPlayer {
  id: string;
  name: string;
  role: Role;
  /** Segredo usado para reconectar; nunca sai do servidor exceto para o próprio dono. */
  token: string;
  sockets: Set<string>;
  /** Veio de um arquivo de sessão (E18): o primeiro jogador que entrar com este nome assume. */
  claimByName?: boolean;
  /** Hora da última rolagem (antispam dos jogadores, E26). */
  lastRollAt?: number;
}

export function createGame(): GameState {
  const sceneId = randomUUID();
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
        // Jogo novo: tapete de couro, o mesmo da tela de entrada. Sem o campo (arquivos antigos) continua madeira.
        tableStyle: "leather",
      },
      mobs: [],
      npcs: [],
      combat: { active: false, round: 0, turnIndex: 0, order: [], turn: 0 },
      rolls: { request: null, reactions: [], outside: "free" },
      effects: [],
      drawings: [],
      walls: [],
      torches: [],
      chests: [],
      props: [],
      weather: defaultWeather(),
      fog: emptyFog(),
    },
    log: [],
    scenes: [{ id: sceneId, name: "Cena 1" }],
    sceneId,
    lootSeconds: 20,
    tables: [],
    clock: null,
    rules: { moveOnTurn: false, summonOnTurn: false, effectOnTurn: false, hideFoeHits: false, darkReminder: false },
  };
}

/** Todo o estado da sessão, em memória (ADR-04). */
export class Store {
  players = new Map<string, ServerPlayer>();
  game: GameState = createGame();
  removedMobs = new Map<string, RemovedMob>();
  /** Último número usado por template ("Goblin 4" → 4), para não repetir nomes. */
  mobCounters = new Map<string, number>();
  /** Som da mesa (E25). Fica fora do jogo: não vai no arquivo de sessão nem some ao limpar o campo. */
  sound: SoundState = { music: null, ambient: null, ambient2: null, volume: { music: 0.6, ambient: 0.5, ambient2: 0.5, sfx: 0.8 } };
  /** Pasta de sons do mestre (E25); `null` = não configurada. */
  soundsDir: string | null = null;
  /** O que o mestre está mostrando para a mesa; a versão sobe a cada mudança (o servidor reenvia a todos). */
  handout: Handout | null = null;
  handoutVersion = 0;
  /** Arquivos de áudio da pasta (lista lida no começo e quando o mestre atualiza). */
  soundLibrary: string[] | null = null;
  /** Antispam dos jogadores (E26); os testes zeram para rolar em sequência. */
  rollCooldownMs: number = LIMITS.rollCooldownMs;
  /** Disputa do loot em andamento (uma por vez; não vai no arquivo). `wants`: lootId → ids de jogadores. */
  lootCount: { chestId: string; endsAt: number; wants: Record<string, string[]> } | null = null;
  /** Resultado da última disputa, para a janela de loot. */
  lootResults: LootResults | null = null;
  /** Testes: duração da contagem em ms (no lugar de `game.lootSeconds`). */
  lootMsOverride: number | null = null;
  /** Ficha de antes de um jogador substituir a do personagem pelo arquivo (Fase 4), para o mestre desfazer. Só em memória. */
  sheetUndo = new Map<string, CharacterSheet>();
  /** Jogo pausado (Passo 7). Fica fora do jogo: não vai no arquivo de sessão. */
  pause: { message: string } | null = null;
  /** Chamar depois de um tempo; o app troca por um que também manda o estado novo a todos. */
  schedule: (ms: number, fn: () => void) => void = (ms, fn) => {
    setTimeout(fn, ms).unref?.();
  };

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

  /** Jogador importado de um arquivo, ainda sem dono, com este nome (E18). */
  findClaimable(name: string): ServerPlayer | undefined {
    const key = name.toLocaleLowerCase("pt-BR");
    for (const p of this.players.values()) {
      if (p.claimByName && p.sockets.size === 0 && p.name.toLocaleLowerCase("pt-BR") === key) return p;
    }
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
