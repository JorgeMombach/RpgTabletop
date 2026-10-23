import type { GridPos } from "./types";

/**
 * Distância em quadrados pela regra padrão do D&D 5e: toda diagonal custa 1 quadrado,
 * então vale o maior deslocamento entre colunas e linhas.
 */
export function cellDistance(a: GridPos, b: GridPos): number {
  return Math.max(Math.abs(a.col - b.col), Math.abs(a.row - b.row));
}

export function feetBetween(a: GridPos, b: GridPos, feetPerCell: number): number {
  return cellDistance(a, b) * feetPerCell;
}
