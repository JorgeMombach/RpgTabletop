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

/**
 * Tamanho da criatura: quantas casas de lado ela ocupa no grid. Miúdo divide a casa com outros
 * (não bloqueia nem é bloqueado). Ausente = médio.
 */
export const SIZES = { tiny: 1, small: 1, medium: 1, large: 2, huge: 3, gargantuan: 4 } as const;
export type Size = keyof typeof SIZES;

/** Os seis atributos (ids estáveis; o nome mostrado vem da tradução). */
export const ABILITIES = ["str", "dex", "con", "int", "wis", "cha"] as const;
export type Ability = (typeof ABILITIES)[number];
/** Valores dos atributos; o que faltar não foi preenchido (atributos são opcionais). */
export type Abilities = Partial<Record<Ability, number>>;

/** Modificador de um atributo, como no 5e: (valor − 10) ÷ 2, para baixo. 10 → +0; 12 → +1; 20 → +5. Sem teto. */
export function abilityMod(score: number): number {
  return Math.floor((score - 10) / 2);
}

/**
 * Quando um recurso volta: descanso curto (volta também no longo), só no longo, só à mão,
 * no começo da vez de quem tem (ações lendárias) ou rolando um d6 no começo da vez (recarga 5–6).
 */
export type Recharge = "short" | "long" | "none" | "turn" | "dice";

/** Recurso com usos ("Fúria 3/3", "Ki 5/5", "Inspiração de Bardo 4/4"): só contagem, sem regra. */
export interface Resource {
  id: string;
  name: string;
  max: number;
  used: number;
  recharge: Recharge;
  /** Recarga no d6 (`recharge: "dice"`): volta tirando este valor ou mais (5 = "recarga 5–6"). */
  rechargeOn?: number;
}

/** Ataque salvo ("Espada longa: +5 / 1d8+3"): rola com um clique. `bonus` ausente = sem rolagem de ataque (ex.: só dano). */
export interface SavedAttack {
  id: string;
  name: string;
  bonus?: number;
  damage?: string;
}

export interface InventoryItem {
  id: string;
  name: string;
  qty: number;
  note?: string;
}

/** Moedas: platina, ouro, electro, prata e cobre (o padrão do 5e). */
export const COINS = ["pp", "gp", "ep", "sp", "cp"] as const;
export type Coin = (typeof COINS)[number];
export type Coins = Partial<Record<Coin, number>>;

/** O que se gasta na vez (5e): ação, ação bônus, movimento e reação. Só marcação. */
export const TURN_ACTIONS = ["action", "bonus", "move", "reaction"] as const;
export type TurnAction = (typeof TURN_ACTIONS)[number];

export interface DeathSaves {
  successes: number;
  failures: number;
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
  /** Vida temporária: o dano tira dela primeiro. Ausente = nenhuma. Jogadores não recebem a de mob/NPC. */
  tempHp?: number;
  /** Ações já gastas na vez (marcadas por quem joga); zeram no começo da vez dele. */
  turnUsed?: TurnAction[];
  /** Testes contra a morte de quem está com 0 de vida (só marcação; a mesa decide). Zeram ao voltar a ter vida. */
  deathSaves?: DeathSaves;
  /** Bônus de iniciativa (d20 + este valor; desempata a ordem). Com DES preenchida, o formulário propõe o modificador dela. */
  dexMod: number;
  /** Classe de armadura. Ausente = não informada (arquivos antigos); jogadores não recebem a de mob/NPC. */
  ac?: number;
  /** Atributos opcionais; jogadores não recebem os de mob/NPC. */
  abilities?: Abilities;
  /** Ausente = médio. `pos` é a casa de cima à esquerda do espaço que ocupa. */
  size?: Size;
  /** Alcance ou aura em pés (ex.: 10 ft de alcance, aura de 30 ft): círculo leve em volta do token, só visual. */
  aura?: number;
  /** Descrição que todos veem ("dragão ancião de neve, guardião do passo…"). */
  description?: string;
  /** Notas do mestre: só ele vê (o servidor não envia aos jogadores, nem ao dono). */
  gmNotes?: string;
  /** Cor do círculo do alcance/aura; ausente = a cor do token. */
  auraColor?: string;
  avatar?: string;
  color: string;
  pos: GridPos | null;
  initiative: number | null;
  initRoll: number | null;
  spellSlots?: Record<SpellLevel, SpellSlot>;
  spells?: Spell[];
  /** Ficha pessoal: só o dono e o mestre veem (como as magias). */
  resources?: Resource[];
  attacks?: SavedAttack[];
  inventory?: InventoryItem[];
  coins?: Coins;
  conditions: Condition[];
  /** Marca de animal (ícone de pata); o formato continua dizendo o lado (E21). */
  animal?: boolean;
  /** Personagem com visão no escuro: não recebe o lembrete de escuridão (regra da mesa). */
  darkvision?: boolean;
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
  size?: Size;
  color: string;
  avatar?: string;
  /** Descrição pública: vai para os mobs e NPCs criados com o template. */
  description?: string;
  /** Notas do mestre: vão para as notas do mestre dos mobs e NPCs criados com o template. */
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
  /**
   * Quem atrasou a vez neste round: quando chegar a vez dele de novo, o começo do turno (descontar
   * condições e efeitos, zerar as ações) não roda outra vez. Grupo de mobs iguais atrasa junto (vários ids).
   * Não vai no arquivo de sessão.
   */
  delayed?: { ids: string[]; round: number };
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
  /** Combatente que o efeito acompanha (aura, Espíritos Guardiões): a área anda junto quando o token anda. */
  followId?: string;
  /** Estado de antes de "Transformar", se for para voltar a ele quando este acabar (duração ou concentração). */
  revertTo?: EffectState;
}

export const DRAWING_KINDS = ["free", "arrow", "circle"] as const;
/** Traço à mão livre, seta ou círculo. */
export type DrawingKind = (typeof DRAWING_KINDS)[number];

/**
 * Desenho do mestre no mapa (setas, círculos, marcações): fica até ele apagar.
 * Pontos em pixels do mapa (acompanham a imagem, não o grid): x0, y0, x1, y1…;
 * na seta e no círculo, só o começo e o fim (centro e borda).
 */
export interface Drawing {
  id: string;
  kind: DrawingKind;
  points: number[];
  color: string;
  width: number;
  /** Só o mestre vê (anotação de preparo: armadilha, porta secreta). */
  hidden?: boolean;
}

/** Porta numa parede: abre e fecha com um clique; trancada só o mestre abre; secreta só o mestre vê. */
export interface Door {
  open: boolean;
  locked?: boolean;
  secret?: boolean;
}

/**
 * Parede ou porta traçada pelo mestre, de um canto do grid a outro (`col`/`row` contam cantos:
 * o canto de cima à esquerda da casa (c, r) é (c, r)). Só visual: não bloqueia movimento (ADR-06).
 */
export interface Wall {
  id: string;
  from: GridPos;
  to: GridPos;
  door?: Door;
}

/** O que muda de uma cena (mapa) para outra: imagem e grid, mobs, NPCs, efeitos, desenhos, paredes e clima. */
export interface SceneContent {
  map: MapConfig & { image: string | null; imageVersion: number };
  mobs: Combatant[];
  npcs: Combatant[];
  effects: MapEffect[];
  drawings: Drawing[];
  walls: Wall[];
  weather: WeatherState;
}

/** Cena guardada (não ativa): o conteúdo dela e onde cada aliado estava nela. */
export interface StoredScene extends SceneContent {
  allyPos: Record<string, GridPos>;
}

/**
 * Mapa preparado pelo mestre. A cena ativa vive em `battle` (sem `stored`); as outras ficam guardadas
 * e voltam inteiras ao trocar. Aliados, iniciativa zerada e log são da mesa, não da cena.
 */
export interface Scene {
  id: string;
  name: string;
  stored?: StoredScene;
}

/**
 * O que o mestre está mostrando para a mesa (carta, retrato, mapa do tesouro): abre na tela de todos.
 * Fica fora do jogo (não vai no arquivo de sessão) e viaja num evento próprio, por causa da imagem.
 */
export interface Handout {
  id: string;
  title?: string;
  text?: string;
  /** dataURL já reduzido no cliente. */
  image?: string;
}

/**
 * Regras da mesa: opções que o mestre liga. Desligadas, vale o de sempre (movimento livre, ADR-06).
 * O mestre nunca é travado por elas.
 */
export interface TableRules {
  /** Em combate, o jogador só move os próprios tokens na sua vez. */
  moveOnTurn: boolean;
  /** Em combate, o jogador só invoca na sua vez. */
  summonOnTurn: boolean;
  /** Com a luz em Noite ou Luar, avisa quem não tem visão no escuro. Só informa. */
  darkReminder: boolean;
}

export const RULE_KEYS = ["moveOnTurn", "summonOnTurn", "darkReminder"] as const satisfies readonly (keyof TableRules)[];

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
    drawings: Drawing[];
    walls: Wall[];
    weather: WeatherState;
  };
  log: LogEntry[];
  /** Cenas da sessão, na ordem do painel; a ativa é `sceneId` (o conteúdo dela está em `battle`). */
  scenes: Scene[];
  sceneId: string;
  /** Regras da mesa (valem para todas as cenas). */
  rules: TableRules;
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
    drawings: Drawing[];
    walls: Wall[];
    weather: WeatherState;
  };
  log: LogEntry[];
  /** Cena ativa (todos) e a lista de cenas (só o mestre: nome, se tem imagem e quantos mobs). */
  sceneId: string;
  scenes?: { id: string; name: string; hasImage: boolean; mobs: number }[];
  rules: TableRules;
  /** Som da mesa (E25): o mesmo para todos. */
  sound: SoundState;
  /** Só para o mestre: arquivos da pasta de sons (E25); `null` = pasta não configurada. */
  soundLibrary?: string[] | null;
  /** Só para o mestre: endereços para passar aos jogadores. */
  host?: HostInfo;
}
