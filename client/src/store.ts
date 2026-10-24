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

interface AppStore {
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
}));

export function select(id: string | null) {
  useApp.setState({ selectedId: id });
}

export function setTool(tool: MapTool) {
  useApp.setState({ tool, calibRect: null });
}
