import { create } from "zustand";
import { useMemo } from "react";
import type { DrawMode } from "./map/DrawingShape";
import type { WallMode } from "./map/WallShape";
import type { FogShape } from "./map/Fog";
import { WALL_THICKNESS, type Area, type AreaKind, type ClientState, type Handout, type JoinError, type MapImagePayload, type MapPoint, type Role, type Ruler } from "@rpg/shared";

/** Quanto tempo um ping fica no mapa. */
export const PING_MS = 2600;

export type MapTool = "move" | "ruler" | "area" | "calibrate" | "draw" | "walls" | "ping" | "fog";

/** Tamanho inicial de cada forma, em pés (os exemplos mais comuns do 5e). */
export const AREA_DEFAULT_FEET: Record<AreaKind, number> = { cone: 15, sphere: 20, cylinder: 20, line: 30, cube: 10 };

export interface Rect {
  x: number;
  y: number;
  width: number;
  height: number;
}

/** Preferências deste navegador: animação dos dados e log destacado (E22); efeitos reduzidos (E26, L6); câmera seguindo a vez (L6). */
const PREFS_KEY = "rpg.dicePrefs";
type DicePrefs = { diceAnim: boolean; logDetached: boolean; reduceFx: boolean; followTurn: boolean };

function readPrefs(): DicePrefs {
  try {
    const p = JSON.parse(localStorage.getItem(PREFS_KEY) ?? "{}");
    return { diceAnim: p.diceAnim !== false, logDetached: p.logDetached === true, reduceFx: p.reduceFx === true, followTurn: p.followTurn === true };
  } catch {
    return { diceAnim: true, logDetached: false, reduceFx: false, followTurn: false };
  }
}

interface AppStore extends DicePrefs {
  connected: boolean;
  /** Papel que esta conexão receberá (antes de entrar). */
  probedRole: Role | null;
  joining: boolean;
  joinError: JoinError | null;
  /** Espelho do estado do servidor, já filtrado para este cliente. */
  state: ClientState | null;
  /** Imagem do mapa (chega separada do estado). */
  mapImage: MapImagePayload;
  /** Réguas que outras pessoas estão medindo agora. */
  rulers: Record<string, { name: string; ruler: Ruler }>;
  /** Pings no mapa dos últimos segundos (de todos, inclusive os meus). */
  pings: { id: number; playerId: string; name: string; at: MapPoint }[];
  /** Áreas de magia que outras pessoas estão mostrando agora. */
  areas: Record<string, { name: string; area: Area }>;
  /** Forma e tamanho escolhidos na ferramenta de área. */
  areaKind: AreaKind;
  areaFeet: number;
  /** Ferramenta de desenho do mestre: formato (ou borracha), cor, espessura e "só eu vejo". */
  drawMode: DrawMode;
  drawColor: string;
  drawWidth: number;
  drawHidden: boolean;
  /** Ferramenta Paredes do mestre: modo e a porta escolhida (para trancar, esconder ou apagar). */
  wallMode: WallMode;
  /** Pontas da parede: nos cantos do grid ou livres (L5). */
  wallSnap: boolean;
  /** Espessura das próximas paredes e portas, em casas (L5). */
  wallThick: number;
  selectedDoorId: string | null;
  /** Ferramenta Névoa do mestre: revelar ou cobrir, pincel ou retângulo, lado do pincel em casas. */
  fogReveal: boolean;
  fogShape: FogShape;
  fogBrush: number;
  /** Combatente aberto no painel "Selecionado" (local, não sincroniza). */
  selectedId: string | null;
  /** Nome usado antes de "Sair", para preencher a tela de entrada. */
  lastName: string;
  tool: MapTool;
  /** Retângulo desenhado pelo mestre na calibração (pixels do mapa). */
  calibRect: Rect | null;
  /** Centro da visão atual do mapa, em pixels do mapa. */
  viewCenter: { x: number; y: number };
  /** Estado da mesa no último salvamento ou carregamento de arquivo (E18); `null` = nunca salvou. */
  savedSnapshot: string | null;
  savedAt: Date | null;
  /**
   * Tokens esperando um clique no mapa: conjurados (E21), um por clique, com a distância até quem conjurou
   * (`fromId`), ou o personagem posto pelo celular (sem `fromId`).
   */
  placing: { ids: string[]; fromId?: string } | null;
  /**
   * Rolagens que ainda estão caindo na animação deste navegador (E26): o log mostra "rolando…"
   * e só revela o resultado quando os dados param.
   */
  rolling: string[];
  /** O log de rolagens está numa janela fora da mesa (outro monitor): a mesa não mostra o log. */
  logOut: boolean;
  /** O que o mestre está mostrando para a mesa (chega à parte, com a imagem) e qual deles esta pessoa já fechou. */
  handout: Handout | null;
  handoutDismissed: string | null;
  /** Combatente com o mouse em cima no mapa: fica por cima dos vizinhos, com o nome visível (E26). */
  hoverId: string | null;
}

export const useApp = create<AppStore>(() => ({
  connected: false,
  probedRole: null,
  joining: false,
  joinError: null,
  state: null,
  mapImage: { version: 0, image: null },
  rulers: {},
  pings: [],
  areas: {},
  areaKind: "cone",
  areaFeet: AREA_DEFAULT_FEET.cone,
  drawMode: "free",
  drawColor: "#d8b47a",
  drawWidth: 6,
  drawHidden: false,
  wallMode: "wall",
  wallSnap: true,
  wallThick: WALL_THICKNESS.default,
  selectedDoorId: null,
  fogReveal: true,
  fogShape: "brush",
  fogBrush: 3,
  selectedId: null,
  lastName: "",
  tool: "move",
  calibRect: null,
  viewCenter: { x: 0, y: 0 },
  savedSnapshot: null,
  savedAt: null,
  placing: null,
  rolling: [],
  hoverId: null,
  logOut: false,
  handout: null,
  handoutDismissed: null,
  ...readPrefs(),
}));

/** Volume geral desta pessoa (E25): só neste navegador, aplicado depois do volume do mestre. */
const VOLUME_KEY = "rpg.volume";

function readVolume(): { volume: number; muted: boolean } {
  try {
    const v = JSON.parse(localStorage.getItem(VOLUME_KEY) ?? "{}");
    return { volume: typeof v.volume === "number" ? Math.min(1, Math.max(0, v.volume)) : 0.8, muted: v.muted === true };
  } catch {
    return { volume: 0.8, muted: false };
  }
}

export const useVolume = create<{ volume: number; muted: boolean }>(() => readVolume());

export function setVolume(patch: Partial<{ volume: number; muted: boolean }>) {
  useVolume.setState(patch);
  try {
    localStorage.setItem(VOLUME_KEY, JSON.stringify(useVolume.getState()));
  } catch {
    // sem armazenamento: vale só nesta aba
  }
}

export function setDicePrefs(patch: Partial<DicePrefs>) {
  useApp.setState(patch);
  const { diceAnim, logDetached, reduceFx, followTurn } = useApp.getState();
  try {
    localStorage.setItem(PREFS_KEY, JSON.stringify({ diceAnim, logDetached, reduceFx, followTurn }));
  } catch {
    // sem armazenamento (aba anônima…): vale só nesta aba
  }
}

export function select(id: string | null) {
  useApp.setState({ selectedId: id });
}

export function setTool(tool: MapTool) {
  useApp.setState({ tool, calibRect: null, placing: null, selectedDoorId: null });
}

/** Conjurados para pôr no mapa com cliques; `null` encerra (os que sobrarem ficam fora do mapa). */
export function setPlacing(placing: AppStore["placing"]) {
  useApp.setState(placing ? { placing, tool: "move", calibRect: null } : { placing: null });
}

/**
 * Combatentes com a rolagem de iniciativa ainda nos dados 3D: o número só aparece quando os dados param
 * (senão o mestre via o resultado antes da animação). Volta uma chave em texto para não renderizar à toa.
 */
export function useInitHeld(): Set<string> {
  const key = useApp((s) =>
    s.rolling.length === 0 || !s.state
      ? ""
      : s.state.log
          .filter((e) => e.subjectId && s.rolling.includes(e.id))
          .map((e) => e.subjectId)
          .join(","),
  );
  return useMemo(() => new Set(key ? key.split(",") : []), [key]);
}
