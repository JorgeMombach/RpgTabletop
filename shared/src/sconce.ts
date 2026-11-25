import type { Wall } from "./types";
import { touchesWall } from "./wallClearance";

/** Até onde (casas) a base da arandela pode estar da parede em que ela fica presa (docs/design/luzes.md). */
export const SCONCE_REACH = 0.3;

/** Há parede (não porta nem janela) perto o bastante para a arandela ficar presa nela. */
export function sconceHasWall(at: { x: number; y: number }, walls: Wall[]): boolean {
  return touchesWall(at, SCONCE_REACH, walls);
}
