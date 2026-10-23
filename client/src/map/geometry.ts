import type { GridPos, MapConfig } from "@rpg/shared";

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

export function initials(name: string): string {
  const parts = name.trim().split(/\s+/);
  const first = parts[0]?.[0] ?? "?";
  // "Goblin 3" → "G3": o número diferencia mobs iguais.
  const last = parts.length > 1 ? parts[parts.length - 1] : "";
  const second = /^\d+$/.test(last) ? last : (last[0] ?? parts[0]?.[1] ?? "");
  return (first + second).toUpperCase().slice(0, 3);
}
