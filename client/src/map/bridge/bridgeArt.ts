import type { BridgeKind } from "@rpg/shared";
import type { MessageKey } from "../../i18n";

/** Cor chapada de cada tipo (amostra do painel e desenho sem WebGL 2), tirada da página de teste aprovada. */
export const BRIDGE_FLAT_COLOR: Record<BridgeKind, string> = {
  plank: "#7a5432",
  stone: "#8f8a80",
  rope: "#9a7a4e",
};

/** Cor das tábuas riscadas por cima (desenho sem WebGL 2). */
export const BRIDGE_LINE_COLOR: Record<BridgeKind, string> = {
  plank: "#4a311c",
  stone: "#5f5a52",
  rope: "#5a4128",
};

export const BRIDGE_LABEL: Record<BridgeKind, MessageKey> = {
  plank: "bridge.plank",
  stone: "bridge.stone",
  rope: "bridge.rope",
};
