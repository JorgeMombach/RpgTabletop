import type { ReliefChunks } from "@rpg/shared";

/** Pedido ao Worker do relevo: a altura destes pedaços (com margem), com o relevo inteiro da cena. */
export interface ReliefJob {
  id: number;
  chunks: ReliefChunks;
  keys: string[];
}

/** Altura e suavidade de um pedaço com margem (`reliefFields`), lado `side`, linha a linha. */
export interface ReliefWindow {
  key: string;
  side: number;
  heights: Float32Array;
  soft: Float32Array;
}

export interface ReliefResult {
  id: number;
  windows: ReliefWindow[];
}
