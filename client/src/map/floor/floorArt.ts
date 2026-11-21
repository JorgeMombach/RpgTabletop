import type { FloorMaterial } from "@rpg/shared";
import type { MessageKey } from "../../i18n";

/**
 * Pisos (docs/design/pisos.md): a cor chapada de cada material, para a amostra do painel e o desenho de reserva sem
 * WebGL 2 (na placa de vídeo, o detalhe da página aprovada `docs/design/pisos-teste.html`).
 */
export const FLOOR_FLAT_COLOR: Record<FloorMaterial, string> = {
  plank: "#8a5a30",
  plankWide: "#6e5236",
  flagstone: "#7c7a74",
  tile: "#a4512f",
  mosaic: "#d8ccb0",
  carpet: "#7a1f22",
};

export const FLOOR_LABEL: Record<FloorMaterial, MessageKey> = {
  plank: "floor.plank",
  plankWide: "floor.plankWide",
  flagstone: "floor.flagstone",
  tile: "floor.tile",
  mosaic: "floor.mosaic",
  carpet: "floor.carpet",
};

/** Materiais em tábuas (o sentido só vale para eles). */
export const PLANK_MATERIALS: readonly FloorMaterial[] = ["plank", "plankWide"];
