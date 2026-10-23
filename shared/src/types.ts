// Modelo de dados compartilhado entre servidor e cliente (ver SPEC.md §4).

export type Role = "gm" | "player";

export interface PublicPlayer {
  id: string;
  name: string;
  role: Role;
  connected: boolean;
}

export type SpellLevel = 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9;

export interface SpellSlot {
  max: number;
  used: number;
}

export interface Spell {
  id: string;
  name: string;
  /** 0 = truque. */
  level: number;
  note?: string;
}

export const SPELL_LEVELS: SpellLevel[] = [1, 2, 3, 4, 5, 6, 7, 8, 9];

export interface GridPos {
  col: number;
  row: number;
}

export interface Combatant {
  id: string;
  name: string;
  type: "ally" | "mob";
  /** Jogador dono (aliados). */
  ownerId?: string;
  templateId?: string;
  hp: number;
  hpMax: number;
  /** Usado só na iniciativa. */
  dexMod: number;
  avatar?: string;
  color: string;
  pos: GridPos | null;
  initiative: number | null;
  initRoll: number | null;
  spellSlots?: Record<SpellLevel, SpellSlot>;
  spells?: Spell[];
}

/** Como um combatente chega ao cliente: jogadores não recebem a vida dos mobs. */
export type CombatantView = Omit<Combatant, "hp" | "hpMax"> & {
  hp?: number;
  hpMax?: number;
};

export interface MobTemplate {
  id: string;
  name: string;
  hpMax: number;
  dexMod: number;
  color: string;
  avatar?: string;
  notes?: string;
}

export interface MapConfig {
  showGrid: boolean;
  cellPx: number;
  offsetX: number;
  offsetY: number;
  feetPerCell: number;
}

export interface CombatState {
  active: boolean;
  round: number;
  turnIndex: number;
  order: string[];
}

export type RollMode = "normal" | "adv" | "dis";

export type RollTerm =
  | {
      kind: "dice";
      sign: 1 | -1;
      count: number;
      faces: number;
      rolls: number[];
      /** Com vantagem/desvantagem: índice do dado que valeu (o outro é descartado). */
      keptIndex?: number;
    }
  | { kind: "const"; sign: 1 | -1; value: number };

export interface RollResult {
  /** Expressão normalizada, ex.: "2d6+1d4+3". */
  expr: string;
  mode: RollMode;
  terms: RollTerm[];
  total: number;
}

export interface LogEntry {
  id: string;
  ts: number;
  authorId: string;
  author: string;
  text: string;
  hidden?: boolean;
  /** Contexto da rolagem, ex.: "Iniciativa · Thorin". */
  label?: string;
  roll?: RollResult;
}

/** Estado do jogo mantido em memória no servidor (sem jogadores). */
export interface GameState {
  templates: MobTemplate[];
  allies: Combatant[];
  battle: {
    map: MapConfig & { image: string | null; imageVersion: number };
    mobs: Combatant[];
    combat: CombatState;
  };
  log: LogEntry[];
}

export interface HostInfo {
  port: number;
  addresses: { label: string; url: string }[];
}

/** Estado já filtrado para um cliente específico. */
export interface ClientState {
  self: PublicPlayer;
  players: PublicPlayer[];
  maxPlayers: number;
  templates: MobTemplate[];
  allies: Combatant[];
  battle: {
    /** A imagem do mapa vai num evento separado (`map:image`). */
    map: MapConfig & { imageVersion: number; hasImage: boolean };
    mobs: CombatantView[];
    combat: CombatState;
  };
  log: LogEntry[];
  /** Só para o mestre: endereços para passar aos jogadores. */
  host?: HostInfo;
}
