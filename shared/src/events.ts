// Contrato dos eventos Socket.IO (ver SPEC.md §6).
import type { Abilities, Ability, ClientState, Coins, Drawing, Recharge, Size, TurnAction, EffectPreset, GameState, GridPos, MapConfig, PublicPlayer, Role, LightId, OutsideRolls, RollKind, RollMode, SoundChannel, SoundSource, WeatherId } from "./types";

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
  /** Bônus de iniciativa. */
  dexMod: number;
  /** Classe de armadura; `null` apaga. */
  ac?: number | null;
  /** Atributos preenchidos (os que faltarem ficam vazios); `{}` apaga todos. */
  abilities?: Abilities;
  /** Tamanho (padrão: médio). */
  size?: Size;
  color?: string;
  /** dataURL já reduzido no cliente; `null` remove o avatar. */
  avatar?: string | null;
  /** Marca de animal (E21). */
  animal?: boolean;
  /** Mob ou NPC já criado oculto (E21; ignorado em aliados). */
  hidden?: boolean;
}

/** Régua em células (as pontas ficam no centro dos quadrados). */
export interface Ruler {
  from: GridPos;
  to: GridPos;
}

/** Ping no mapa: ponto em células (com fração), efêmero, para todos verem por uns segundos. */
export interface MapPoint {
  col: number;
  row: number;
}

export interface PingBroadcast {
  playerId: string;
  name: string;
  at: MapPoint;
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
  "mob:addFromTemplate": { templateId: string; qty: number; hidden?: boolean };
  "mob:add": CombatantInput;
  /** Remove um mob ou NPC (o "Desfazer" vale para os dois). */
  "mob:remove": { id: string };
  "mob:restore": { id: string };
  "npc:add": CombatantInput;
  /** Um NPC com os dados do template (sem número no nome). */
  "npc:addFromTemplate": { templateId: string; hidden?: boolean };
  /**
   * Conjura `qty` combatentes do lado de `summonerId` (E21): quem controla o conjurador controla os conjurados.
   * `near` (padrão): com o conjurador no mapa, aparecem nas casas livres mais perto dele; `false` = fora do mapa,
   * para quem conjurou escolher onde (alcance da magia: o app não limita).
   */
  "summon:add": CombatantInput & {
    summonerId: string;
    qty: number;
    concentration?: boolean;
    /** Duração em rounds; ausente ou `null` = sem duração. */
    rounds?: number | null;
    near?: boolean;
  };
  /** Oculta ou revela um mob/NPC (E21). Revelar com a iniciativa em andamento rola a dele. */
  "combatant:setHidden": { id: string; hidden: boolean };
  "ally:create": CombatantInput;
  "ally:remove": { id: string };
  "combatant:update": { id: string } & Partial<CombatantInput>;
  "hp:change": { id: string; delta: number };
  "hp:set": { id: string; value: number };
  "hp:full": { id: string };
  /** Vida temporária: o valor novo substitui o anterior (não soma); 0 apaga. */
  "hp:temp": { id: string; value: number };
  /** Marca os testes contra a morte (0 a 3 cada) de quem está com 0 de vida. */
  "death:set": { id: string; successes: number; failures: number };
  /** Alcance/aura em pés em volta do token; null apaga. */
  "aura:set": { id: string; feet: number | null };
  /**
   * `hidden` e `asId` só valem para o mestre (rolagem oculta; rolar como um combatente).
   * Com combate ativo, jogador só rola na própria vez, num pedido do mestre ou na reação (E16).
   */
  "dice:roll": { expr: string; mode?: RollMode; hidden?: boolean; asId?: string | null; kind?: RollKind; crit?: boolean; check?: Ability; death?: boolean };
  /** Mestre: pede uma rolagem fora da vez; `playerIds` vazio = todos os jogadores. */
  "roll:request": { label: string; playerIds: string[] };
  "roll:cancel": Record<string, never>;
  /** Mestre: rolagens dos jogadores fora de combate (livres, só com pedido ou travadas). */
  "roll:outside": { mode: OutsideRolls };
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
  /** Quem está na vez (dono ou mestre) encerra a própria vez: o turno avança como no Próximo turno. */
  "combat:pass": Record<string, never>;
  /** Quem está na vez passa a agir depois de `afterId` (que ainda vai agir neste round). */
  "combat:delay": { afterId: string };
  /** Marca ou desmarca uma ação gasta na vez. */
  "turn:use": { id: string; what: TurnAction; used: boolean };
  /** Slots de um nível: máximo e/ou usados. Só aliados. */
  "slot:set": { id: string; level: number; max?: number; used?: number };
  /** Todos os slots disponíveis de novo. */
  "slots:restore": { id: string };
  /** Vida cheia + slots recuperados (o jogador decide quando). */
  "ally:restoreAll": { id: string };
  "spell:add": { id: string; name: string; level: number; note?: string };
  "spell:remove": { id: string; spellId: string };
  /** Recurso com usos: sem `resourceId` cria; com, edita. */
  "resource:upsert": { id: string; resourceId?: string; name: string; max: number; recharge: Recharge; rechargeOn?: number };
  /** Gasta (`delta` > 0) ou recupera (`delta` < 0) usos. */
  "resource:use": { id: string; resourceId: string; delta: number };
  "resource:remove": { id: string; resourceId: string };
  /** Descanso: curto recupera os recursos de descanso curto; longo recupera tudo (vida, slots, recursos) e zera a vida temporária. */
  rest: { id: string; kind: "short" | "long" };
  "attack:upsert": { id: string; attackId?: string; name: string; bonus?: number | null; damage?: string };
  "attack:remove": { id: string; attackId: string };
  "item:upsert": { id: string; itemId?: string; name: string; qty: number; note?: string };
  "item:remove": { id: string; itemId: string };
  /** Moedas: substitui as quantidades (vazio = 0). */
  "coins:set": { id: string; coins: Coins };
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
  /**
   * Muda o estado de um efeito (E24): mesma área, outro tipo (ex.: Graxa → Fogo, Água → Eletrificado).
   * Qualquer um pode transformar um efeito ligado (é a magia de quem transforma); quem transforma passa a
   * controlar o efeito. `revert` = quando o novo estado acabar, volta ao de antes em vez de sumir.
   */
  "effect:transform": {
    id: string;
    preset: EffectPreset;
    name?: string;
    color?: string;
    casterId?: string | null;
    rounds?: number | null;
    concentration?: boolean;
    revert?: boolean;
  };
  "effect:toggle": { id: string; active: boolean };
  /** Mestre: toca em loop num canal (troca o que estava tocando). */
  "sound:play": { channel: SoundChannel; source: SoundSource };
  "sound:stop": { channel: SoundChannel };
  /** Mestre: volume do canal para a mesa toda (0–1). Cada pessoa ainda tem o próprio volume geral. */
  "sound:volume": { channel: SoundChannel | "sfx"; value: number };
  /** Mestre: relê a pasta de sons (arquivos copiados direto para lá). */
  "sound:refresh": Record<string, never>;
  /** Mestre: clima e luz do mapa (E26); só os campos enviados mudam. `kind: null` = sem clima. */
  "weather:set": { kind?: WeatherId | null; intensity?: number; wind?: number; light?: LightId };
  "effect:remove": { id: string };
  /**
   * Limpa o campo para a próxima batalha: tira mapa, mobs, NPCs, iniciativa e posições.
   * Mantém jogadores, aliados (vida/slots/magias), grid e log; templates se `keepTemplates`.
   */
  "battle:clear": { keepTemplates: boolean };
  /** Mestre: desenho no mapa (traço, seta, círculo). */
  "draw:add": Omit<Drawing, "id">;
  "draw:remove": { id: string };
  /** Mestre: apaga todos os desenhos. */
  "draw:clear": Record<string, never>;
  /** Mestre: parede (ou porta, fechada) de um canto do grid a outro. */
  "wall:add": { from: GridPos; to: GridPos; door?: boolean };
  "wall:remove": { id: string };
  /** Mestre: cena nova, vazia (mesmo grid da atual); não troca para ela. */
  "scene:add": { name: string };
  "scene:rename": { id: string; name: string };
  /** Mestre: guarda a cena atual e carrega a outra. Só fora de combate (a iniciativa zera). */
  "scene:switch": { id: string };
  /** Mestre: apaga uma cena guardada (a ativa não). */
  "scene:remove": { id: string };
  /** Mestre: apaga todas as paredes e portas. */
  "wall:clear": Record<string, never>;
  /** Abrir/fechar: qualquer um, se não estiver trancada (nem for secreta). Trancar e secreta: só o mestre. */
  "door:set": { id: string; open?: boolean; locked?: boolean; secret?: boolean };
}

/** Identifica o arquivo de sessão do app (E18). */
export const SESSION_FILE_APP = "jamals-tabletop";
/** Versão do formato do arquivo: sobe quando o formato muda de um jeito que versões antigas não leem. */
// 2 (2.8): cenas guardadas. A 2.7 leria o arquivo e perderia as outras cenas sem avisar.
export const SESSION_FILE_FORMAT = 2;

/**
 * Sessão salva em arquivo (ADR-17, E18). Os jogadores vão só com id e nome: quem entrar com o mesmo
 * nome reencontra o personagem. Tokens de sessão e a chave de mestre nunca vão para o arquivo.
 */
export interface SessionFile {
  app: typeof SESSION_FILE_APP;
  format: number;
  appVersion: string;
  savedAt: string;
  players: { id: string; name: string; role: Role }[];
  /** Último número usado por template ("Goblin 4"), para a numeração continuar. */
  mobCounters: Record<string, number>;
  game: GameState;
}

export type SessionExportResult = { ok: true; file: SessionFile } | { ok: false; error: string };

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
  /** Efêmero: "olhem aqui" no mapa, para todos (inclusive quem pingou). */
  "map:ping": (at: MapPoint) => void;
  /** Sai da sessão (fica offline). A identidade continua: voltar com o mesmo token recupera o personagem. */
  "session:leave": () => void;
  /** Mestre: estado atual em formato de arquivo (E18). */
  "session:export": (ack: (res: SessionExportResult) => void) => void;
  /** Mestre: substitui o estado atual pelo do arquivo (validado inteiro antes). */
  "session:import": (file: unknown, ack: (res: ActionResult) => void) => void;
  /** Mestre: efeito sonoro para todos, uma vez (E25). Não fica no estado. */
  "sound:sfx": (source: SoundSource, ack: (res: ActionResult) => void) => void;
  /** Mestre: adiciona um arquivo de áudio à pasta de sons (E25). */
  "sound:upload": (file: { name: string; data: ArrayBuffer }, ack: (res: ActionResult) => void) => void;
};

export interface ServerToClientEvents {
  "state:full": (state: ClientState) => void;
  /** A imagem do mapa vai separada do estado e só quando muda. */
  "map:image": (payload: MapImagePayload) => void;
  ruler: (payload: RulerBroadcast) => void;
  area: (payload: AreaBroadcast) => void;
  ping: (payload: PingBroadcast) => void;
  toast: (toast: Toast) => void;
  /** Efeito sonoro de uma vez, para todos (E25). */
  "sound:sfx": (source: SoundSource) => void;
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
  /** Ficha: recursos, ataques salvos e inventário. */
  resources: 20,
  resourceMax: 99,
  attacks: 30,
  items: 100,
  itemQty: 9999,
  coins: 9_999_999,
  dexMod: { min: -10, max: 20 },
  /** Classe de armadura e valor de atributo: sem teto de regra, só um limite de sanidade. */
  ac: { min: 0, max: 99 },
  abilityScore: { min: 1, max: 99 },
  aura: { min: 5, max: 300 },
  /** Quantidade de mobs criados de uma vez a partir de um template. */
  qty: { min: 1, max: 30 },
  notes: 500,
  conditionName: 32,
  /** Condições por combatente. */
  conditions: 12,
  conditionRounds: { min: 1, max: 100 },
  rollLabel: 32,
  /** Jogador: intervalo mínimo entre rolagens (antispam, E26). O mestre não tem. */
  rollCooldownMs: 1500,
  weatherIntensity: { min: 0.2, max: 1 },
  weatherWind: { min: -60, max: 60 },
  effectName: 32,
  /** Efeitos no mapa ao mesmo tempo. */
  effects: 40,
  /** Desenhos do mestre no mapa ao mesmo tempo, números por desenho (x e y) e espessura do traço. */
  drawings: 150,
  drawingNumbers: 1200,
  drawingWidth: { min: 1, max: 24 },
  /** Coordenada máxima (pixels do mapa) de um ponto de desenho. */
  drawingCoord: 100_000,
  /** Cenas na sessão e tamanho do nome. */
  scenes: 20,
  sceneName: 40,
  /** Paredes e portas no mapa e comprimento máximo de cada uma (em casas). */
  walls: 600,
  wallLength: 200,
  /** Arquivo de som (E25): cabe no limite do socket (50 MB) com folga. */
  soundBytes: 40 * 1024 * 1024,
  soundName: 120,
  soundLibrary: 500,
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
