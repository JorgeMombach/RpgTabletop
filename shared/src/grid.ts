import { SIZES, type GridPos, type Size } from "./types";

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

/** Casas de lado que um tamanho ocupa (ausente = médio, 1). */
export function sizeSpan(size: Size | undefined): number {
  return size ? SIZES[size] : 1;
}

/** Miúdo divide a casa: não bloqueia ninguém nem é bloqueado. */
export function sharesCell(size: Size | undefined): boolean {
  return size === "tiny";
}

/** Casas cobertas por quem está em `pos` (canto de cima à esquerda) com `span` de lado. */
export function footprint(pos: GridPos, span: number): GridPos[] {
  const cells: GridPos[] = [];
  for (let r = 0; r < span; r++) for (let c = 0; c < span; c++) cells.push({ col: pos.col + c, row: pos.row + r });
  return cells;
}

/** Os dois espaços (canto + lado) se sobrepõem? */
export function overlaps(a: GridPos, aSpan: number, b: GridPos, bSpan: number): boolean {
  return a.col < b.col + bSpan && b.col < a.col + aSpan && a.row < b.row + bSpan && b.row < a.row + aSpan;
}

/** Casas ocupadas (que bloqueiam) por estes combatentes: o espaço inteiro de cada um, menos os miúdos. */
export function blockedCells(list: { pos: GridPos | null; size?: Size }[]): GridPos[] {
  return list.flatMap((c) => (c.pos && !sharesCell(c.size) ? footprint(c.pos, sizeSpan(c.size)) : []));
}

/** Canto para quem tem `span` de lado ficar centrado na casa `cell` (onde a pessoa clicou ou soltou). */
export function centeredOn(cell: GridPos, span: number): GridPos {
  const back = Math.floor((span - 1) / 2);
  return { col: cell.col - back, row: cell.row - back };
}

/** Casa do espaço de quem está em `pos` mais perto de `target` (régua mede da borda, não do centro). */
export function nearestCellOf(pos: GridPos, span: number, target: GridPos): GridPos {
  const clamp = (v: number, lo: number) => Math.max(lo, Math.min(lo + span - 1, v));
  return { col: clamp(target.col, pos.col), row: clamp(target.row, pos.row) };
}

/**
 * Lugar livre mais perto de `start` para um espaço de `span` casas de lado (busca em anéis).
 * Miúdo (`shares`) cabe em qualquer casa.
 */
export function nearestFreeSpot(start: GridPos, occupied: GridPos[], span = 1, shares = false, maxRadius = 20): GridPos {
  if (shares) return start;
  const taken = new Set(occupied.map((p) => `${p.col},${p.row}`));
  const fits = (p: GridPos) => footprint(p, span).every((c) => !taken.has(`${c.col},${c.row}`));
  for (let r = 0; r <= maxRadius; r++) {
    for (let dr = -r; dr <= r; dr++) {
      for (let dc = -r; dc <= r; dc++) {
        if (Math.max(Math.abs(dr), Math.abs(dc)) !== r) continue;
        const c = { col: start.col + dc, row: start.row + dr };
        if (fits(c)) return c;
      }
    }
  }
  return start;
}
