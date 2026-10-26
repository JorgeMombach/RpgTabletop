import { create } from "zustand";
import type { Area, AreaKind, ClientState, JoinError, MapImagePayload, Role, Ruler } from "@rpg/shared";

export type MapTool = "move" | "ruler" | "area" | "calibrate";

/** Tamanho inicial de cada forma, em pés (os exemplos mais comuns do 5e). */
export const AREA_DEFAULT_FEET: Record<AreaKind, number> = { cone: 15, sphere: 20, cylinder: 20, line: 30, cube: 10 };

export interface Rect {
  x: number;
  y: number;
  width: number;
  height: number;
}

/** Preferências deste navegador (E22): animação dos dados e log destacado. */
const PREFS_KEY = "rpg.dicePrefs";
type DicePrefs = { diceAnim: boolean; logDetached: boolean };

function readPrefs(): DicePrefs {
  try {
    const p = JSON.parse(localStorage.getItem(PREFS_KEY) ?? "{}");
    return { diceAnim: p.diceAnim !== false, logDetached: p.logDetached === true };
  } catch {
    return { diceAnim: true, logDetached: false };
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
  /** Áreas de magia que outras pessoas estão mostrando agora. */
  areas: Record<string, { name: string; area: Area }>;
  /** Forma e tamanho escolhidos na ferramenta de área. */
  areaKind: AreaKind;
  areaFeet: number;
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
  /** Conjurados esperando um clique no mapa (E21): um por clique, com a distância até quem conjurou. */
  placing: { ids: string[]; fromId: string } | null;
}

export const useApp = create<AppStore>(() => ({
  connected: false,
  probedRole: null,
  joining: false,
  joinError: null,
  state: null,
  mapImage: { version: 0, image: null },
  rulers: {},
  areas: {},
  areaKind: "cone",
  areaFeet: AREA_DEFAULT_FEET.cone,
  selectedId: null,
  lastName: "",
  tool: "move",
  calibRect: null,
  viewCenter: { x: 0, y: 0 },
  savedSnapshot: null,
  savedAt: null,
  placing: null,
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
  const { diceAnim, logDetached } = useApp.getState();
  try {
    localStorage.setItem(PREFS_KEY, JSON.stringify({ diceAnim, logDetached }));
  } catch {
    // sem armazenamento (aba anônima…): vale só nesta aba
  }
}

export function select(id: string | null) {
  useApp.setState({ selectedId: id });
}

export function setTool(tool: MapTool) {
  useApp.setState({ tool, calibRect: null, placing: null });
}

/** Conjurados para pôr no mapa com cliques; `null` encerra (os que sobrarem ficam fora do mapa). */
export function setPlacing(placing: AppStore["placing"]) {
  useApp.setState(placing ? { placing, tool: "move", calibRect: null } : { placing: null });
}
