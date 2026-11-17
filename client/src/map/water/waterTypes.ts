import type { CellRect, TerrainChunks, WaterCurrent } from "@rpg/shared";

/**
 * Água animada (docs/design/agua.md): o que vai para o Worker e o que volta dele, pronto para virar textura WebGL.
 * Os números vêm em meia precisão (`Uint16Array`), o formato das texturas `RG16F`/`RGBA16F`.
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
 * Um grupo de água pronto para a placa de vídeo: `sdfDeep` = distância até a margem (px do campo) e parte funda;
 * `river` = ao longo, de que lado, força e 0. `rocks` = as pedras dentro deste grupo.
 */
export interface WaterGpuField {
  rect: CellRect;
  perCell: number;
  width: number;
  height: number;
  sdfDeep: Uint16Array;
  river: Uint16Array;
  rocks: WaterRock[];
}

export interface WaterResult {
  id: number;
  fields: WaterGpuField[];
}
