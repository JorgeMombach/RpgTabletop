import { create } from "zustand";
import type { ClientState, JoinError, MapImagePayload, Role, Ruler } from "@rpg/shared";

export interface ToastItem {
  id: number;
  kind: "info" | "error";
  text: string;
  action?: { label: string; run: () => void };
}

export type MapTool = "move" | "ruler" | "calibrate";

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
  /** Combatente aberto no painel "Selecionado" (local, não sincroniza). */
  selectedId: string | null;
  tool: MapTool;
  /** Retângulo desenhado pelo mestre na calibração (pixels do mapa). */
  calibRect: Rect | null;
  /** Centro da visão atual do mapa, em pixels do mapa. */
  viewCenter: { x: number; y: number };
  toasts: ToastItem[];
}

export const useApp = create<AppStore>(() => ({
  connected: false,
  probedRole: null,
  joining: false,
  joinError: null,
  state: null,
  mapImage: { version: 0, image: null },
  rulers: {},
  selectedId: null,
  tool: "move",
  calibRect: null,
  viewCenter: { x: 0, y: 0 },
  toasts: [],
}));

export function select(id: string | null) {
  useApp.setState({ selectedId: id });
}

export function setTool(tool: MapTool) {
  useApp.setState({ tool, calibRect: null });
}

let toastSeq = 0;

export function toast(item: Omit<ToastItem, "id">, ttlMs = 6000) {
  const id = ++toastSeq;
  useApp.setState((s) => ({ toasts: [...s.toasts, { ...item, id }] }));
  setTimeout(() => dismissToast(id), ttlMs);
}

export function dismissToast(id: number) {
  useApp.setState((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) }));
}
