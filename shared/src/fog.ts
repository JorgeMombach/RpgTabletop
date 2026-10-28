import type { GridPos } from "./types";

/**
 * Névoa de guerra (G): casas reveladas, por linha, em intervalos de colunas `[início, fim)` ordenados
 * e sem sobreposição: `{ "3": [0, 5, 8, 10] }` = na linha 3, colunas 0–4 e 8–9. O resto está coberto.
 * Assim um salão inteiro revelado custa poucos números por linha (vai em todo envio de estado).
 */
export interface FogState {
  enabled: boolean;
  revealed: Record<string, number[]>;
}

/** Retângulo de casas: `w` × `h` a partir de `col`, `row`. */
export interface FogRect {
  col: number;
  row: number;
  w: number;
  h: number;
}

export function emptyFog(): FogState {
  return { enabled: false, revealed: {} };
}

/** Junta `[s, e)` aos intervalos (mantendo ordenados e sem sobreposição). */
function addInterval(list: number[], s: number, e: number): number[] {
  const out: number[] = [];
  let placed = false;
  for (let i = 0; i < list.length; i += 2) {
    const a = list[i];
    const b = list[i + 1];
    if (b < s) out.push(a, b);
    else if (a > e) {
      if (!placed) out.push(s, e);
      placed = true;
      out.push(a, b);
    } else {
      // Encosta ou sobrepõe: vira um intervalo só.
      s = Math.min(s, a);
      e = Math.max(e, b);
    }
  }
  if (!placed) out.push(s, e);
  return out;
}

/** Tira `[s, e)` dos intervalos. */
function removeInterval(list: number[], s: number, e: number): number[] {
  const out: number[] = [];
  for (let i = 0; i < list.length; i += 2) {
    const a = list[i];
    const b = list[i + 1];
    if (b <= s || a >= e) out.push(a, b);
    else {
      if (a < s) out.push(a, s);
      if (b > e) out.push(e, b);
    }
  }
  return out;
}

/** Revela (ou cobre) um retângulo de casas. Altera `fog`. */
export function paintFog(fog: FogState, rect: FogRect, reveal: boolean) {
  for (let row = rect.row; row < rect.row + rect.h; row++) {
    const key = String(row);
    const list = fog.revealed[key] ?? [];
    const next = reveal ? addInterval(list, rect.col, rect.col + rect.w) : removeInterval(list, rect.col, rect.col + rect.w);
    if (next.length > 0) fog.revealed[key] = next;
    else delete fog.revealed[key];
  }
}

/** A casa está visível (névoa desligada ou casa revelada). */
export function isRevealed(fog: FogState, col: number, row: number): boolean {
  if (!fog.enabled) return true;
  const list = fog.revealed[String(row)];
  if (!list) return false;
  for (let i = 0; i < list.length; i += 2) if (col >= list[i] && col < list[i + 1]) return true;
  return false;
}

/** Alguma das casas está visível. */
export function anyRevealed(fog: FogState, cells: GridPos[]): boolean {
  return !fog.enabled || cells.some((c) => isRevealed(fog, c.col, c.row));
}

/** As quatro casas em volta de um canto do grid (paredes e origens de área ficam nos cantos ou centros). */
export function cellsAroundPoint(col: number, row: number): GridPos[] {
  const c = Math.floor(col);
  const r = Math.floor(row);
  // Ponto no meio de uma casa: só ela.
  if (col !== c || row !== r) return [{ col: c, row: r }];
  return [
    { col: c - 1, row: r - 1 },
    { col: c, row: r - 1 },
    { col: c - 1, row: r },
    { col: c, row: r },
  ];
}
