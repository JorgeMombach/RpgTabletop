// Contrato dos eventos Socket.IO (ver SPEC.md §6).
import type { ClientState, EffectPreset, GridPos, MapConfig, PublicPlayer, Role, RollKind, RollMode } from "./types";

export interface JoinPayload {
  name: string;
  sessionToken?: string;
  /** Chave de mestre recebida pelo link `?gm=` (ADR-12). */
  gmKey?: string;
}

export type JoinError = "invalid_name" | "room_full";

export type JoinResult =
  | { ok: true; self: PublicPlayer; sessionToken: string }
  | { ok: false; error: JoinError };

export interface Toast {
  kind: "info" | "error";
  text: string;
}

/** Dados editáveis de um combatente (mob ou aliado). */
export interface CombatantInput {
  name: string;
  hpMax: number;
  dexMod: number;
  color?: string;
  /** dataURL já reduzido no cliente; `null` remove o avatar. */
  avatar?: string | null;
}

/** Régua em células (as pontas ficam no centro dos quadrados). */
export interface Ruler {
  from: GridPos;
  to: GridPos;
}

export interface RulerBroadcast {
  playerId: string;
  name: string;
  ruler: Ruler | null;
}

/** Formas de área do D&D 5e (E17). */
export type AreaKind = "cone" | "sphere" | "cylinder" | "line" | "cube";

/**
 * Área de magia, efêmera como a régua. Origem em células (múltiplos de 0,5: centro ou canto de
 * um quadrado), direção em radianos (0 = para a direita) e tamanho em pés: raio da esfera/cilindro,
 * comprimento do cone/linha, lado do cubo.
 */
export interface Area {
  kind: AreaKind;
  origin: { col: number; row: number };
  angle: number;
  feet: number;
}

export interface AreaBroadcast {
  playerId: string;
  name: string;
  area: Area | null;
}

export interface MapImagePayload {
  version: number;
  image: string | null;
}

export type GridInput = Partial<Pick<MapConfig, "showGrid" | "cellPx" | "offsetX" | "offsetY" | "rotation" | "imageScale">>;

export interface TemplateInput extends CombatantInput {
  /** Presente = edição; ausente = criação. */
  id?: string;
  notes?: string;
}

/** Payload de cada ação que altera o estado. Toda ação responde com `ActionResult`. */
export interface ActionPayloads {
  "template:upsert": TemplateInput;
  "template:remove": { id: string };
  "mob:addFromTemplate": { templateId: string; qty: number };
  "mob:add": CombatantInput;
  /** Remove um mob ou NPC (o "Desfazer" vale para os dois). */
  "mob:remove": { id: string };
  "mob:restore": { id: string };
  "npc:add": CombatantInput;
  /** Um NPC com os dados do template (sem número no nome). */
  "npc:addFromTemplate": { templateId: string };
  "ally:create": CombatantInput;
  "ally:remove": { id: string };
  "combatant:update": { id: string } & Partial<CombatantInput>;
  "hp:change": { id: string; delta: number };
  "hp:set": { id: string; value: number };
  "hp:full": { id: string };
  /**
   * `hidden` e `asId` só valem para o mestre (rolagem oculta; rolar como um combatente).
   * Com combate ativo, jogador só rola na própria vez, num pedido do mestre ou na reação (E16).
   */
  "dice:roll": { expr: string; mode?: RollMode; hidden?: boolean; asId?: string | null; kind?: RollKind; crit?: boolean };
  /** Mestre: pede uma rolagem fora da vez; `playerIds` vazio = todos os jogadores. */
  "roll:request": { label: string; playerIds: string[] };
  "roll:cancel": Record<string, never>;
  /** Jogador: usa a reação do round (libera rolar até o turno mudar). */
  "reaction:use": Record<string, never>;
  "battle:setMap": { image: string | null };
  "battle:grid": GridInput;
  /** `pos: null` tira o token do mapa. */
  "token:move": { id: string; pos: GridPos | null };
  /** Rola d20 + mod. DES para um combatente. */
  "init:roll": { id: string };
  /** Mestre: rola para todos os mobs; `grouped` = uma rolagem por template. */
  "init:rollMobs": { grouped?: boolean };
  /** Valor digitado (dado físico); `null` tira da ordem. */
  "init:set": { id: string; value: number | null };
  /** Mestre: reordenação manual (desempate). */
  "init:move": { id: string; toIndex: number };
  /** Mestre: zera todas as iniciativas, rola mobs e NPCs e pausa o combate até os jogadores rolarem. */
  "init:rerollAll": { grouped?: boolean };
  "combat:start": Record<string, never>;
  "combat:next": Record<string, never>;
  "combat:prev": Record<string, never>;
  /** Encerra o combate: zera round e iniciativas, mantém os combatentes. */
  "combat:end": Record<string, never>;
  /** Slots de um nível: máximo e/ou usados. Só aliados. */
  "slot:set": { id: string; level: number; max?: number; used?: number };
  /** Todos os slots disponíveis de novo. */
  "slots:restore": { id: string };
  /** Vida cheia + slots recuperados (o jogador decide quando). */
  "ally:restoreAll": { id: string };
  "spell:add": { id: string; name: string; level: number; note?: string };
  "spell:remove": { id: string; spellId: string };
  /** `rounds` ausente ou `null` = sem duração (fica até alguém tirar). */
  "condition:add": { id: string; name: string; rounds?: number | null };
  "condition:remove": { id: string; conditionId: string };
  /**
   * Fixa uma área como efeito no mapa (E19). Jogador: `casterId` tem que ser um personagem dele.
   * `concentration` exige conjurador e dá a ele a condição *Concentração*, se ainda não tiver.
   */
  "effect:add": {
    name: string;
    preset: EffectPreset;
    color?: string;
    area: Area;
    casterId?: string | null;
    rounds?: number | null;
    concentration?: boolean;
  };
  "effect:toggle": { id: string; active: boolean };
  "effect:remove": { id: string };
  /**
   * Limpa o campo para a próxima batalha: tira mapa, mobs, NPCs, iniciativa e posições.
   * Mantém jogadores, aliados (vida/slots/magias), grid e log; templates se `keepTemplates`.
   */
  "battle:clear": { keepTemplates: boolean };
}

export type ActionName = keyof ActionPayloads;

export type ActionResult = { ok: true; ids?: string[] } | { ok: false; error: string };

type ActionEvents = {
  [K in ActionName]: (payload: ActionPayloads[K], ack?: (res: ActionResult) => void) => void;
};

export type ClientToServerEvents = ActionEvents & {
  /** Pergunta qual papel esta conexão receberia (loopback = mestre). */
  "session:probe": (payload: { gmKey?: string }, ack: (res: { role: Role }) => void) => void;
  "session:join": (payload: JoinPayload, ack: (res: JoinResult) => void) => void;
  /** Efêmero: repassado aos outros, não fica no estado. */
  "ruler:update": (ruler: Ruler | null) => void;
  /** Efêmero, como a régua. */
  "area:update": (area: Area | null) => void;
  /** Sai da sessão (fica offline). A identidade continua: voltar com o mesmo token recupera o personagem. */
  "session:leave": () => void;
};

export interface ServerToClientEvents {
  "state:full": (state: ClientState) => void;
  /** A imagem do mapa vai separada do estado e só quando muda. */
  "map:image": (payload: MapImagePayload) => void;
  ruler: (payload: RulerBroadcast) => void;
  area: (payload: AreaBroadcast) => void;
  toast: (toast: Toast) => void;
}

export const NAME_MAX_LENGTH = 32;

export const LIMITS = {
  hpMax: { min: 1, max: 9999 },
  initiative: { min: -20, max: 60 },
  /** Slots por nível de magia (D&D 5e chega a 4; folga para regras da casa). */
  slotMax: 9,
  spells: 100,
  spellName: 60,
  spellNote: 200,
  dexMod: { min: -10, max: 20 },
  /** Quantidade de mobs criados de uma vez a partir de um template. */
  qty: { min: 1, max: 30 },
  notes: 500,
  conditionName: 32,
  /** Condições por combatente. */
  conditions: 12,
  conditionRounds: { min: 1, max: 100 },
  rollLabel: 32,
  effectName: 32,
  /** Efeitos no mapa ao mesmo tempo. */
  effects: 40,
  dice: {
    exprLength: 100,
    terms: 20,
    /** Total de dados numa rolagem. */
    count: 200,
    faces: { min: 2, max: 1000 },
    constant: 10000,
  },
  /** Entradas mantidas no log compartilhado. */
  logSize: 200,
  /** Tamanho máximo do dataURL (caracteres). */
  mapImageChars: 8_000_000,
  avatarChars: 300_000,
  /** Lado máximo da imagem do mapa e do avatar após redução no cliente. */
  mapImageSide: 4096,
  avatarSide: 128,
  cellPx: { min: 8, max: 400 },
  imageScale: { min: 0.1, max: 10 },
  areaFeet: { min: 5, max: 500 },
  /** Limite de coordenada de célula (evita tokens perdidos no infinito). */
  gridCoord: 10_000,
} as const;

export const DICE = [4, 6, 8, 10, 12, 20, 100] as const;
