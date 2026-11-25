import { cellsInsideFrame, geometryOf, pointsInsideFrame, type GridPos, type Size } from "@rpg/shared";
import type { Store } from "../store";
import { fail } from "../validate";

/**
 * Moldura da cena (docs/design/moldura.md): com ela ligada, nada é posto fora. Pontos em casas (paredes, pontes,
 * escadas, objetos, tochas, efeitos); casas do grid (tokens, baús). Sem moldura, tudo vale.
 */
export function requirePointsInFrame(store: Store, points: { x: number; y: number }[]) {
  if (!pointsInsideFrame(store.game.battle.map.frame, points)) fail("Fora da moldura.");
}

/** Todas as casas que o token (ou o baú) ocupa, dentro da moldura. */
export function requireTokenInFrame(store: Store, pos: GridPos, size: Size | undefined) {
  const { map } = store.game.battle;
  if (!map.frame) return;
  if (!cellsInsideFrame(map.frame, geometryOf(map.grid).footprint(pos, size))) fail("Fora da moldura.");
}

/** Pontos de um desenho (px do mapa) em casas. */
export function requireDrawingInFrame(store: Store, points: number[]) {
  const { map } = store.game.battle;
  if (!map.frame) return;
  const cells: { x: number; y: number }[] = [];
  for (let index = 0; index + 1 < points.length; index += 2) cells.push({ x: (points[index] - map.offsetX) / map.cellPx, y: (points[index + 1] - map.offsetY) / map.cellPx });
  requirePointsInFrame(store, cells);
}

/** Pontos achatados (x0, y0, x1, y1…) em casas. */
export function flatPoints(points: number[]): { x: number; y: number }[] {
  const out: { x: number; y: number }[] = [];
  for (let index = 0; index + 1 < points.length; index += 2) out.push({ x: points[index], y: points[index + 1] });
  return out;
}
