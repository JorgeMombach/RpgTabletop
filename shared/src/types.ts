// Modelo de dados compartilhado entre servidor e cliente (ver SPEC.md §4).
import type { Area } from "./events";

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

/** Os seis atributos (ids estáveis; o nome mostrado vem da tradução). */
export const ABILITIES = ["str", "dex", "con", "int", "wis", "cha"] as const;
export type Ability = (typeof ABILITIES)[number];
/** Valores dos atributos; o que faltar não foi preenchido (atributos são opcionais). */
export type Abilities = Partial<Record<Ability, number>>;

/** Modificador de um atributo, como no 5e: (valor − 10) ÷ 2, para baixo. 10 → +0; 12 → +1; 20 → +5. Sem teto. */
export function abilityMod(score: number): number {
  return Math.floor((score - 10) / 2);
}

export interface Combatant {
  id: string;
  name: string;
  type: CombatantType;
  /** Jogador dono (aliados). */
  ownerId?: string;
  templateId?: string;
  hp: number;
  hpMax: number;
  /** Bônus de iniciativa (d20 + este valor; desempata a ordem). Com DES preenchida, o formulário propõe o modificador dela. */
  dexMod: number;
  /** Classe de armadura. Ausente = não informada (arquivos antigos); jogadores não recebem a de mob/NPC. */
  ac?: number;
  /** Atributos opcionais; jogadores não recebem os de mob/NPC. */
  abilities?: Abilities;
  avatar?: string;
  color: string;
  pos: GridPos | null;
  initiative: number | null;
  initRoll: number | null;
  spellSlots?: Record<SpellLevel, SpellSlot>;
  spells?: Spell[];
  conditions: Condition[];
  /** Marca de animal (ícone de pata); o formato continua dizendo o lado (E21). */
  animal?: boolean;
  /** Mob ou NPC oculto (furtividade, sala escura): só o mestre recebe; fora da iniciativa até ser revelado (E21). */
  hidden?: boolean;
  /** Conjurado (familiar, esqueleto…): quem conjurou. Fica do lado dele e com o mesmo controle (E21). */
  summonerId?: string;
  /** Conjurado que some quando o conjurador perde a Concentração. */
  summonConcentration?: boolean;
  /** Rounds que faltam (conta no início do turno de quem conjurou, como os efeitos); ausente = sem duração. */
  summonRounds?: number;
}

/** Como um combatente chega ao cliente: jogadores não recebem vida, CA nem atributos de mobs e NPCs. */
export type CombatantView = Omit<Combatant, "hp" | "hpMax"> & {
  hp?: number;
  hpMax?: number;
};

export interface MobTemplate {
  id: string;
  name: string;
  hpMax: number;
  dexMod: number;
  ac?: number;
  abilities?: Abilities;
  color: string;
  avatar?: string;
  notes?: string;
  /** Mobs e NPCs criados com o template já vêm com a marca de animal. */
  animal?: boolean;
}

export interface MapConfig {
  showGrid: boolean;
  cellPx: number;
  offsetX: number;
  offsetY: number;
  feetPerCell: number;
  /** Rotação da imagem (0, 90, 180 ou 270 graus, sentido horário). O grid e os tokens não giram. */
  rotation: number;
  /** Escala da imagem (1 = tamanho original), para casar os quadrados do desenho com o grid. */
  imageScale: number;
}

export interface CombatState {
  active: boolean;
  round: number;
  turnIndex: number;
  order: string[];
  /** Conta cada troca de turno (iniciar, próximo, anterior): identifica "este turno" para pedidos e reações. */
  turn: number;
}

/** Pedido do mestre para jogadores rolarem fora da vez (ex.: "Resistência DES"). Cada um rola uma vez. */
export interface RollRequest {
  id: string;
  label: string;
  playerIds: string[];
  /** Quem já rolou. */
  done: string[];
}

/** Reação usada por um jogador: 1 por round; libera a rolagem só durante o turno em que foi usada. */
export interface ReactionUse {
  playerId: string;
  round: number;
  turn: number;
}

/**
 * Rolagens dos jogadores fora de combate (E26): livres, só com pedido do mestre ou travadas.
 * Em combate vale a trava por turno de sempre.
 */
export type OutsideRolls = "free" | "request" | "locked";

export interface RollsState {
  request: RollRequest | null;
  reactions: ReactionUse[];
  outside: OutsideRolls;
}

/** Bloco de rolagem usado no combate (E16). */
export type RollKind = "attack" | "damage";

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
  /**
   * Personagem que rolou: o combatente escolhido pelo mestre ou o personagem do jogador.
   * O log mostra "Personagem (autor)" (E26); o autor do mestre é sempre "Mestre".
   */
  as?: string;
  /** Cor de quem rolou (token do combatente), usada nos dados 3D (E22); ausente = bronze do mestre. */
  color?: string;
  kind?: RollKind;
  /** Dano de crítico (dados dobrados). */
  crit?: boolean;
  /** Turno do combate em que a rolagem aconteceu, para o log agrupar. */
  turn?: { seq: number; round: number; name: string };
}

/** Efeitos predefinidos (cada um tem textura própria no mapa); "custom" = só a cor escolhida. */
export const EFFECT_PRESETS = {
  fire: { label: "Fogo", color: "#ff6a1a" },
  water: { label: "Água", color: "#3b8fd9" },
  wet: { label: "Solo molhado", color: "#4a6b8a" },
  electric: { label: "Eletrificado", color: "#7fd4ff" },
  steam: { label: "Vapor", color: "#e8eef2" },
  mud: { label: "Lama", color: "#6b4a2b" },
  burnt: { label: "Chão chamuscado", color: "#3a2a22" },
  toxic: { label: "Gás tóxico", color: "#8fd14f" },
  acid: { label: "Ácido", color: "#b6e03a" },
  grease: { label: "Graxa", color: "#5a4a32" },
  web: { label: "Teia", color: "#e6e6e6" },
  plants: { label: "Plantas", color: "#3f9a3a" },
  roots: { label: "Raízes", color: "#8a5a32" },
  fog: { label: "Névoa", color: "#c9d1d9" },
  ice: { label: "Gelo", color: "#9fdcf0" },
  darkness: { label: "Escuridão", color: "#1a1424" },
  custom: { label: "Personalizado", color: "#d4a24c" },
} as const;

export type EffectPreset = keyof typeof EFFECT_PRESETS;

/**
 * Mudanças de estado mais comuns (E24), sugeridas primeiro em "Transformar". Qualquer outra também vale:
 * o app não aplica regra (ADR-06), só mostra.
 */
export const EFFECT_TRANSITIONS: Partial<Record<EffectPreset, EffectPreset[]>> = {
  grease: ["fire"],
  web: ["fire"],
  plants: ["fire"],
  roots: ["fire"],
  ice: ["wet", "water"],
  water: ["electric", "ice", "steam", "mud"],
  wet: ["electric", "ice", "steam", "mud"],
  mud: ["wet", "ice"],
  fire: ["burnt", "steam", "wet"],
  toxic: ["fog"],
  acid: ["toxic", "wet"],
  electric: ["water", "wet"],
  steam: ["fog", "wet"],
};

/** O que muda numa transformação (e o que volta com "volta a ser o anterior"). */
export interface EffectState {
  name: string;
  preset: EffectPreset;
  color: string;
  ownerId: string;
  casterId: string | null;
  rounds: number | null;
  concentration: boolean;
}

/**
 * Efeito persistente no mapa (E19): uma área que fica até acabar a duração, alguém remover
 * ou, se for de concentração, o conjurador perder a *Concentração*.
 */
export interface MapEffect {
  id: string;
  name: string;
  preset: EffectPreset;
  color: string;
  area: Area;
  /** Jogador que criou (quem pode mexer, além do mestre). */
  ownerId: string;
  /** Combatente que conjurou: a duração desconta no turno dele. Sem conjurador = no início de cada round. */
  casterId: string | null;
  rounds: number | null;
  concentration: boolean;
  /** Desligado = fica guardado, mas só o mestre vê. */
  active: boolean;
  /** Estado de antes de "Transformar", se for para voltar a ele quando este acabar (duração ou concentração). */
  revertTo?: EffectState;
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
    rolls: RollsState;
    effects: MapEffect[];
    weather: WeatherState;
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
/**
 * Sons gerados pelo próprio app (E25), sem arquivo: ambientes em loop e efeitos de uma vez.
 * O id é o que viaja; o nome aparece para o mestre.
 */
export const GEN_SOUNDS = {
  ambient: {
    rain: "Chuva",
    storm: "Tempestade",
    wind: "Vento",
    campfire: "Fogueira",
    cave: "Caverna (gotas)",
    sea: "Mar",
    stream: "Riacho",
    night: "Noite (grilos)",
    dungeon: "Masmorra",
    heartbeat: "Batimento cardíaco",
  },
  sfx: {
    thunder: "Trovão",
    explosion: "Explosão",
    sword: "Golpe de espada",
    bell: "Sino",
    gong: "Gongo",
    drum: "Tambores",
    arrow: "Flecha",
    magic: "Magia",
    zap: "Raio elétrico",
    coins: "Moedas",
  },
} as const;

export type GenAmbientId = keyof typeof GEN_SOUNDS.ambient;
export type GenSfxId = keyof typeof GEN_SOUNDS.sfx;

/** De onde vem o som: arquivo da biblioteca do mestre ou gerado pelo app. */
export type SoundSource = { kind: "file"; name: string } | { kind: "gen"; id: GenAmbientId | GenSfxId };

/** Canais que ficam tocando (em loop). Efeitos (`sfx`) tocam uma vez e não ficam no estado. */
export type SoundChannel = "music" | "ambient";

export interface SoundTrack {
  source: SoundSource;
  /** Hora do servidor (ms) em que começou: quem entra depois começa no mesmo ponto. */
  startedAt: number;
}

/** O que a mesa está ouvindo (E25). Só o mestre muda; volumes de 0 a 1, aplicados para todos. */
export interface SoundState {
  music: SoundTrack | null;
  ambient: SoundTrack | null;
  volume: { music: number; ambient: number; sfx: number };
}

/**
 * Clima sobre o mapa inteiro (E26), escolhido pelo mestre e visto por todos. O id é o que viaja.
 * `sound`: ambiente gerado (E25) sugerido no painel para combinar com o clima.
 */
export const WEATHERS = {
  rain: { label: "Chuva", group: "Água e frio", sound: "rain" },
  heavyRain: { label: "Chuva forte", group: "Água e frio", sound: "rain" },
  // Tempestade e granizo sugerem a chuva: o trovão vem com os relâmpagos do clima, no mesmo instante para todos.
  storm: { label: "Tempestade (relâmpagos)", group: "Água e frio", sound: "rain" },
  hail: { label: "Granizo", group: "Água e frio", sound: "rain" },
  snow: { label: "Neve", group: "Água e frio", sound: "wind" },
  blizzard: { label: "Nevasca", group: "Água e frio", sound: "wind" },
  fog: { label: "Névoa", group: "Ar", sound: null },
  leaves: { label: "Vento com folhas", group: "Ar", sound: "wind" },
  sand: { label: "Tempestade de areia", group: "Ar", sound: "wind" },
  ash: { label: "Cinzas caindo", group: "Fogo e terra", sound: "campfire" },
  embers: { label: "Brasas subindo", group: "Fogo e terra", sound: "campfire" },
  heat: { label: "Calor (miragem)", group: "Fogo e terra", sound: null },
  fireflies: { label: "Vagalumes", group: "Mágico e sombrio", sound: "night" },
  magic: { label: "Luzes mágicas", group: "Mágico e sombrio", sound: null },
  spores: { label: "Esporos", group: "Mágico e sombrio", sound: "cave" },
  petals: { label: "Pétalas", group: "Mágico e sombrio", sound: "wind" },
  bloodRain: { label: "Chuva de sangue", group: "Mágico e sombrio", sound: "rain" },
} as const satisfies Record<string, { label: string; group: string; sound: GenAmbientId | null }>;

export type WeatherId = keyof typeof WEATHERS;

/** Luz da cena (E26), separada do clima e combinável com ele. */
export const LIGHTS = { day: "Dia", dusk: "Entardecer", night: "Noite", moon: "Luar" } as const;
export type LightId = keyof typeof LIGHTS;

export interface WeatherState {
  kind: WeatherId | null;
  /** 0,2 a 1: quantidade de partículas, densidade da névoa… */
  intensity: number;
  /** Direção do vento em graus: 0 = cai reto; negativo = para a esquerda; positivo = para a direita. */
  wind: number;
  light: LightId;
  /** Hora do servidor em que o clima começou: semente dos relâmpagos, iguais para todos. */
  startedAt: number;
}

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
    rolls: RollsState;
    effects: MapEffect[];
    weather: WeatherState;
  };
  log: LogEntry[];
  /** Som da mesa (E25): o mesmo para todos. */
  sound: SoundState;
  /** Só para o mestre: arquivos da pasta de sons (E25); `null` = pasta não configurada. */
  soundLibrary?: string[] | null;
  /** Só para o mestre: endereços para passar aos jogadores. */
  host?: HostInfo;
}
