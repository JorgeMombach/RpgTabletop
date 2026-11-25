import type { CellRect, TerrainChunks, WaterCurrent } from "@rpg/shared";

/**
 * Água animada (docs/design/agua.md): o que vai para o Worker e o que volta dele, pronto para virar textura WebGL.
 * Distância e parte funda vêm em meia precisão (`Uint16Array`, textura `RG16F`); o rio, em precisão cheia (`RGBA32F`).
 */

/** Pedra no rio (objeto *Pedras* ou *Pedregulho* com o centro na água), em casas. */
export interface WaterRock {
  col: number;
  row: number;
  radius: number;
}

export interface WaterJob {
  id: number;
  chunks: TerrainChunks;
  currents: WaterCurrent[];
  rocks: WaterRock[];
  perCell: number;
}

/**
 * Um grupo de água pronto para a placa de vídeo: `sdfDeep` = distância até a margem (px do campo), parte funda e meia
 * largura da água em volta (casas, até 2; docs/design/estruturas-ajustes.md), em meia precisão (RGBA, A sem uso);
 * `river` = ao longo, de que lado, força e 0. `rocks` = as pedras dentro deste grupo.
 */
export interface WaterGpuField {
  rect: CellRect;
  perCell: number;
  width: number;
  height: number;
  sdfDeep: Uint16Array;
  river: Float32Array;
  rocks: WaterRock[];
}

export interface WaterResult {
  id: number;
  fields: WaterGpuField[];
}
