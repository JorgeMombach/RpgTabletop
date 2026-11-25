import { MAP_TORCH_COLORS, MAP_TORCH_STYLES, type MapTorch, type MapTorchColor, type MapTorchStyle } from "@rpg/shared";

/**
 * Os modelos de fonte de luz (docs/design/luzes.md, tabela aprovada em luzes-teste.html): alcance da luz, jeito de
 * tremer e de onde a luz sai no desenho. O tamanho do desenho fica em `TORCH_CELLS` e a altura da chama em
 * `TORCH_HEIGHT` (sombras).
 */

/** Tremor da luz: chama (tochas, fogueira, velas), pouco (lanterna, lamparina) ou pulso (orbe). */
export type TorchFlicker = "fire" | "soft" | "pulse";

export interface TorchModel {
  /** Alcance da luz em pés (só visual). */
  feet: number;
  flicker: TorchFlicker;
  /** De onde a luz sai, em unidades do desenho (o tamanho dele = 1; y negativo = para cima na tela). */
  light: { x: number; y: number };
}

export const TORCH_MODELS: Record<MapTorchStyle, TorchModel> = {
  stick: { feet: 40, flicker: "fire", light: { x: 0, y: -0.22 } },
  iron: { feet: 40, flicker: "fire", light: { x: 0, y: -0.2 } },
  brazier: { feet: 50, flicker: "fire", light: { x: 0, y: -0.04 } },
  sconce: { feet: 40, flicker: "fire", light: { x: 0, y: 0.17 } },
  campfire: { feet: 60, flicker: "fire", light: { x: 0, y: 0.02 } },
  lantern: { feet: 40, flicker: "soft", light: { x: 0, y: 0.05 } },
  candles: { feet: 20, flicker: "fire", light: { x: 0, y: -0.05 } },
  candelabra: { feet: 30, flicker: "fire", light: { x: 0, y: -0.25 } },
  oilLamp: { feet: 25, flicker: "soft", light: { x: 0.25, y: -0.03 } },
  orb: { feet: 30, flicker: "pulse", light: { x: 0, y: -0.12 } },
};

/** Cor da luz no chão de cada cor (o meio claro da chama da página aprovada); `flame` é a chama de sempre. */
export const TORCH_RGB: Record<MapTorchColor, [number, number, number]> = {
  flame: [1, 0.684, 0.316],
  blue: [0.439, 0.719, 1],
  green: [0.485, 1, 0.556],
  purple: [0.795, 0.518, 1],
  white: [0.878, 0.932, 1],
};

export function torchStyleIndex(style: MapTorchStyle): number {
  return MAP_TORCH_STYLES.indexOf(style);
}

export function torchColorIndex(color: MapTorchColor | undefined): number {
  return MAP_TORCH_COLORS.indexOf(color ?? "flame");
}

/** Direção da arandela em radianos (0 = direita, π/2 = baixo); os outros modelos não giram. */
export function torchFacing(torch: Pick<MapTorch, "style" | "facing">): number {
  return torch.style === "sconce" ? ((torch.facing ?? 0) * Math.PI) / 180 : 0;
}

/**
 * Um ponto do desenho (unidades do desenho) no mapa, em casas a partir da base. A arandela gira: o "para fora da
 * parede" do desenho (+y) vira a direção dela.
 */
export function torchOffset(torch: Pick<MapTorch, "style" | "facing">, cells: number, local: { x: number; y: number }): { x: number; y: number } {
  if (torch.style !== "sconce") return { x: local.x * cells, y: local.y * cells };
  const angle = torchFacing(torch);
  const out = { x: Math.cos(angle), y: Math.sin(angle) };
  const side = { x: -out.y, y: out.x };
  return { x: (local.x * side.x + local.y * out.x) * cells, y: (local.x * side.y + local.y * out.y) * cells };
}
