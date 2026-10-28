import type { GridPos, Wall } from "./types";

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

/** Parede ou porta que bloqueia a passagem: toda parede e porta fechada (inclusive a secreta). */
export function blocks(w: Wall): boolean {
  return !w.door || !w.door.open;
}

type P = { x: number; y: number };

/** Os segmentos se cruzam de verdade (encostar na ponta não conta). */
function crosses(a: P, b: P, c: P, d: P): boolean {
  const o = (p: P, q: P, r: P) => Math.sign((q.x - p.x) * (r.y - p.y) - (q.y - p.y) * (r.x - p.x));
  return o(a, b, c) * o(a, b, d) < 0 && o(c, d, a) * o(c, d, b) < 0;
}

/**
 * Pontos de referência das casas: o centro, deslocado um nadinha. Assim nenhuma linha entre casas passa
 * exatamente pela ponta de uma parede, e uma casa cortada por parede diagonal fica de um lado só.
 */
const NUDGE = { x: 0.5013, y: 0.5071 };

/** Dá para passar da casa `a` para a vizinha `b` sem atravessar nenhuma parede (`walls` já filtradas). */
export function canPass(a: GridPos, b: GridPos, walls: Wall[]): boolean {
  const pa = { x: a.col + NUDGE.x, y: a.row + NUDGE.y };
  const pb = { x: b.col + NUDGE.x, y: b.row + NUDGE.y };
  const minX = Math.min(pa.x, pb.x);
  const maxX = Math.max(pa.x, pb.x);
  const minY = Math.min(pa.y, pb.y);
  const maxY = Math.max(pa.y, pb.y);
  for (const w of walls) {
    // Parede longe: nem testa.
    if (Math.max(w.from.col, w.to.col) < minX || Math.min(w.from.col, w.to.col) > maxX) continue;
    if (Math.max(w.from.row, w.to.row) < minY || Math.min(w.from.row, w.to.row) > maxY) continue;
    if (crosses(pa, pb, { x: w.from.col, y: w.from.row }, { x: w.to.col, y: w.to.row })) return false;
  }
  return true;
}

/**
 * O cômodo de uma casa: todas as casas alcançáveis dela sem atravessar parede ou porta fechada
 * (andando para os lados, não na diagonal). `null` se passar de `max` casas: a área não fecha.
 */
export function roomCells(start: GridPos, walls: Wall[], max: number): GridPos[] | null {
  const solid = walls.filter(blocks);
  const key = (c: GridPos) => `${c.col},${c.row}`;
  const seen = new Set([key(start)]);
  const out: GridPos[] = [start];
  for (let i = 0; i < out.length; i++) {
    const c = out[i];
    for (const [dc, dr] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const n = { col: c.col + dc, row: c.row + dr };
      const k = key(n);
      if (seen.has(k) || !canPass(c, n, solid)) continue;
      seen.add(k);
      out.push(n);
      if (out.length > max) return null;
    }
  }
  return out;
}

/** Casas soltas viram retângulos de uma linha (trechos seguidos juntos), para pintar de uma vez. */
export function cellsToRects(cells: GridPos[]): FogRect[] {
  const byRow = new Map<number, number[]>();
  for (const c of cells) {
    const list = byRow.get(c.row) ?? [];
    list.push(c.col);
    byRow.set(c.row, list);
  }
  const out: FogRect[] = [];
  for (const [row, cols] of byRow) {
    cols.sort((a, b) => a - b);
    let s = cols[0];
    for (let i = 1; i <= cols.length; i++) {
      if (i < cols.length && cols[i] === cols[i - 1] + 1) continue;
      out.push({ col: s, row, w: cols[i - 1] - s + 1, h: 1 });
      s = cols[i];
    }
  }
  return out;
}
