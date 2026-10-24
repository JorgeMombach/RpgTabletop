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

/** Condição em um combatente (atordoado, concentração…). O app não aplica efeito (ADR-06). */
export interface Condition {
  id: string;
  name: string;
  /** Rounds restantes; desconta 1 no início do turno de quem tem. `null` = até alguém tirar. */
  rounds: number | null;
}

/** Condições do 5e mais concentração. O campo também aceita texto livre. */
export const CONDITIONS = [
  "Agarrado",
  "Amedrontado",
  "Atordoado",
  "Caído",
  "Cego",
  "Concentração",
  "Contido",
  "Enfeitiçado",
  "Envenenado",
  "Exausto",
  "Incapacitado",
  "Inconsciente",
  "Invisível",
  "Paralisado",
  "Petrificado",
  "Surdo",
];

/** Aliado = de um jogador (ou do mestre); mob = inimigo; NPC = neutro, controlado pelo mestre. */
export type CombatantType = "ally" | "mob" | "npc";

export interface Combatant {
  id: string;
  name: string;
  type: CombatantType;
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
  conditions: Condition[];
}

/** Como um combatente chega ao cliente: jogadores não recebem a vida de mobs e NPCs. */
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
  /** Aviso da mesa (ex.: condição que acabou), sem autor humano. */
  system?: boolean;
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
    /** NPCs neutros: saem ao limpar o campo, como os mobs. */
    npcs: Combatant[];
    combat: CombatState;
  };
  log: LogEntry[];
}

export interface HostInfo {
  port: number;
  addresses: { label: string; url: string }[];
  /** Chave de mestre: só vai para o mestre, para abrir o app como mestre em outro dispositivo. */
  gmKey: string;
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
    npcs: CombatantView[];
    combat: CombatState;
  };
  log: LogEntry[];
  /** Só para o mestre: endereços para passar aos jogadores. */
  host?: HostInfo;
}
