import type { GridPos, MapConfig } from "@rpg/shared";

// Lugar livre: as contas ficam no shared (o servidor também usa, nos conjurados).
import { blockedCells, centeredOn, nearestFreeSpot, sharesCell, sizeSpan, type CombatantView } from "@rpg/shared";

/**
 * Onde `c` entra quando a pessoa aponta a casa `cell` (clique, soltar da lista, centro da visão):
 * o espaço dele centrado ali, ou o lugar livre mais perto em que caiba inteiro.
 */
export function placeFor(c: Pick<CombatantView, "id" | "size">, cell: GridPos, all: CombatantView[]): GridPos {
  const span = sizeSpan(c.size);
  return nearestFreeSpot(centeredOn(cell, span), blockedCells(all.filter((o) => o.id !== c.id)), span, sharesCell(c.size));
}

export interface Point {
  x: number;
  y: number;
}

type Grid = Pick<MapConfig, "cellPx" | "offsetX" | "offsetY">;

/** Célula que contém um ponto do mundo (pixels da imagem do mapa). */
export function cellAt(p: Point, g: Grid): GridPos {
  return {
    col: Math.floor((p.x - g.offsetX) / g.cellPx),
    row: Math.floor((p.y - g.offsetY) / g.cellPx),
  };
}

export function cellCenter(pos: GridPos, g: Grid): Point {
  return {
    x: g.offsetX + (pos.col + 0.5) * g.cellPx,
    y: g.offsetY + (pos.row + 0.5) * g.cellPx,
  };
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
