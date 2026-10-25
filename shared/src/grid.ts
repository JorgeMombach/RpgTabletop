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

/** Primeira célula livre mais próxima de `start` (busca em anéis). */
export function nearestFreeCell(start: GridPos, occupied: GridPos[], maxRadius = 20): GridPos {
  const taken = new Set(occupied.map((p) => `${p.col},${p.row}`));
  for (let r = 0; r <= maxRadius; r++) {
    for (let dr = -r; dr <= r; dr++) {
      for (let dc = -r; dc <= r; dc++) {
        if (Math.max(Math.abs(dr), Math.abs(dc)) !== r) continue;
        const c = { col: start.col + dc, row: start.row + dr };
        if (!taken.has(`${c.col},${c.row}`)) return c;
      }
    }
  }
  return start;
}
