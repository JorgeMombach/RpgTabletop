import type { GridPos, MapConfig } from "@rpg/shared";

// Lugar livre e geometria das grades: as contas ficam no shared (o servidor confere a mesma coisa).
import { freeSpotNear, geometryOf, occupiedCells, type CombatantView, type GridKind, type Size } from "@rpg/shared";

/**
 * Onde `c` entra quando a pessoa aponta a casa `cell` (clique, soltar da lista, centro da visão):
 * a forma dele sobre ali, ou o lugar livre mais perto em que caiba inteiro.
 */
export function placeFor(c: Pick<CombatantView, "id" | "size">, cell: GridPos, all: CombatantView[], kind: GridKind | undefined): GridPos {
  const start = geometryOf(kind).centeredOn(cell, c.size);
  return freeSpotNear(start, occupiedCells(all.filter((o) => o.id !== c.id), kind), c.size, kind);
}

export interface Point {
  x: number;
  y: number;
}

type Grid = Pick<MapConfig, "cellPx" | "offsetX" | "offsetY" | "grid">;

/** Ponto do mundo (pixels da imagem do mapa) em unidades de casa, a partir do canto do grid. */
export function toCellUnits(p: Point, g: Grid): Point {
  return { x: (p.x - g.offsetX) / g.cellPx, y: (p.y - g.offsetY) / g.cellPx };
}

/** Unidades de casa de volta para pixels do mapa. */
export function toWorld(p: Point, g: Grid): Point {
  return { x: g.offsetX + p.x * g.cellPx, y: g.offsetY + p.y * g.cellPx };
}

/** Célula que contém um ponto do mundo (pixels da imagem do mapa). */
export function cellAt(p: Point, g: Grid): GridPos {
  return geometryOf(g.grid).cellAt(toCellUnits(p, g));
}

export function cellCenter(pos: GridPos, g: Grid): Point {
  return toWorld(geometryOf(g.grid).center(pos), g);
}
/**
 * Do centro da casa `pos` ao meio da forma de quem está ali, em pixels. É o mesmo para qualquer `pos` (no hex
 * as direções não dependem da linha), então serve para ir do centro do token de volta à casa ao soltar.
 */
export function shapeOffset(size: Size | undefined, g: Grid): Point {
  const geometry = geometryOf(g.grid);
  const origin = { col: 0, row: 0 };
  const shape = geometry.shapeCenter(origin, size);
  const center = geometry.center(origin);
  return { x: (shape.x - center.x) * g.cellPx, y: (shape.y - center.y) * g.cellPx };
}

/** Meio da forma de quem está em `pos` (onde o token é desenhado), em pixels. */
export function shapeCenterAt(pos: GridPos, size: Size | undefined, g: Grid): Point {
  return toWorld(geometryOf(g.grid).shapeCenter(pos, size), g);
}

export function sameCell(a: GridPos | null, b: GridPos | null): boolean {
  return !!a && !!b && a.col === b.col && a.row === b.row;
}

export function initials(name: string): string {
  const parts = name.trim().split(/\s+/);
  const first = parts[0]?.[0] ?? "?";
  // "Goblin 3" → "G3": o número diferencia mobs iguais.
  const last = parts.length > 1 ? parts[parts.length - 1] : "";
  const second = /^\d+$/.test(last) ? last : (last[0] ?? parts[0]?.[1] ?? "");
  return (first + second).toUpperCase().slice(0, 3);
}
