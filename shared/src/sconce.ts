import type { Wall } from "./types";
import { touchesWall } from "./wallClearance";

/** Até onde (casas) a base da arandela pode estar da parede em que ela fica presa (docs/design/luzes.md). */
export const SCONCE_REACH = 0.3;

/** Há parede (não porta nem janela) perto o bastante para a arandela ficar presa nela. */
export function sconceHasWall(at: { x: number; y: number }, walls: Wall[]): boolean {
  return touchesWall(at, SCONCE_REACH, walls);
}

/** Até onde (casas) do ponteiro a parede segura a prévia da arandela. */
export const SCONCE_SNAP = 0.75;
/** Distância (casas) da base da arandela até o meio da parede (fora da espessura dela). */
const SCONCE_INSET = 0.12;

/**
 * Onde a arandela fica ao clicar perto de uma parede (docs/design/luzes.md): na parede (não porta nem janela) mais
 * perto do ponteiro, até `SCONCE_SNAP`, do lado em que ele está e virada para ele (graus: 0 = direita, 90 = baixo).
 * Longe de qualquer parede, `null`.
 */
export function snapSconce(pointer: { x: number; y: number }, walls: Wall[]): { col: number; row: number; facing: number } | null {
  let best: { distance: number; x: number; y: number; nx: number; ny: number } | null = null;
  for (const wall of walls) {
    if (wall.door || wall.window) continue;
    const dx = wall.to.col - wall.from.col;
    const dy = wall.to.row - wall.from.row;
    const lengthSquared = dx * dx + dy * dy;
    if (lengthSquared === 0) continue;
    const along = Math.max(0, Math.min(1, ((pointer.x - wall.from.col) * dx + (pointer.y - wall.from.row) * dy) / lengthSquared));
    const x = wall.from.col + along * dx;
    const y = wall.from.row + along * dy;
    const distance = Math.hypot(pointer.x - x, pointer.y - y);
    if (distance > SCONCE_SNAP || (best && distance >= best.distance)) continue;
    // a normal da parede, para o lado do ponteiro
    const length = Math.sqrt(lengthSquared);
    let nx = -dy / length;
    let ny = dx / length;
    if ((pointer.x - x) * nx + (pointer.y - y) * ny < 0) {
      nx = -nx;
      ny = -ny;
    }
    best = { distance, x, y, nx, ny };
  }
  if (!best) return null;
  const cent = (value: number) => Math.round(value * 100) / 100 + 0;
  const facing = Math.round((Math.atan2(best.ny, best.nx) * 180) / Math.PI + 360) % 360;
  return { col: cent(best.x + best.nx * SCONCE_INSET), row: cent(best.y + best.ny * SCONCE_INSET), facing };
}
