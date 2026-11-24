import { PROP_DEFAULTS, type PropKind, type Wall } from "./types";

/**
 * Nada em cima de parede, exceto portas e janelas (docs/design/ajustes-rapidos.md): tocha, baú e objeto não podem ter o
 * centro perto demais da linha de uma parede. Mesmas coordenadas da luz (`lightBlockers`): funciona com as paredes
 * livres e no hex. Tokens não passam por aqui (o movimento é livre).
 */

/** Distância mínima (casas) do centro à linha da parede. */
export const WALL_CLEARANCE = { torch: 0.2, chest: 0.3 } as const;

/** Metade do pé do objeto: uma estante encostada na parede, com o centro a meia casa dela, passa. */
export function propClearance(kind: PropKind, size: number): number {
  return PROP_DEFAULTS[kind].foot * size * 0.5;
}

/** O ponto está a menos de `radius` da linha de alguma parede que não é porta nem janela. */
export function touchesWall(point: { x: number; y: number }, radius: number, walls: Wall[]): boolean {
  return walls.some((wall) => !wall.door && !wall.window && distanceToSegment(point, wall) < radius);
}

function distanceToSegment(point: { x: number; y: number }, wall: Wall): number {
  const dx = wall.to.col - wall.from.col;
  const dy = wall.to.row - wall.from.row;
  const lengthSquared = dx * dx + dy * dy;
  const along = lengthSquared === 0 ? 0 : Math.max(0, Math.min(1, ((point.x - wall.from.col) * dx + (point.y - wall.from.row) * dy) / lengthSquared));
  return Math.hypot(point.x - (wall.from.col + along * dx), point.y - (wall.from.row + along * dy));
}
