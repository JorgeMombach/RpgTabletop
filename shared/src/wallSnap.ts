import type { GridPos, Wall } from "./types";

/**
 * Ímã das paredes livres: a ponta solta perto da ponta ou do corpo de uma parede gruda nela, para as paredes
 * emendarem e fecharem o cômodo (no traço livre, duas pontas quase nunca caem no mesmo lugar). Longe de tudo, a
 * ponta fica onde foi solta, em centésimos de casa (como o servidor guarda).
 */

/** Alcance do ímã (casas). */
export const WALL_MAGNET = 0.2;
/** Quanto a ponta passa da linha de uma parede inclinada (casas): some debaixo da espessura dela. */
const OVERSHOOT = 0.03;
/** Seno mínimo do ângulo entre as paredes para passar da linha (abaixo disso, é porta ao longo da parede). */
const MIN_CROSSING_SINE = 0.2;
const EPSILON = 1e-6;

const cent = (value: number) => Math.round(value * 100) / 100;
const cross = (ax: number, ay: number, bx: number, by: number) => ax * by - ay * bx;

interface Magnet {
  point: GridPos;
  /** A parede em cujo corpo a ponta grudou (`null`: grudou numa ponta ou ficou solta). */
  body: Wall | null;
}

function attract(point: GridPos, walls: Wall[], radius: number): Magnet {
  // Primeiro as pontas: grudar ponta com ponta emenda sem toquinho nenhum.
  let nearestEnd: GridPos | null = null;
  let nearest = radius;
  for (const wall of walls) {
    for (const end of [wall.from, wall.to]) {
      const distance = Math.hypot(end.col - point.col, end.row - point.row);
      if (distance <= nearest) {
        nearest = distance;
        nearestEnd = end;
      }
    }
  }
  if (nearestEnd) return { point: { col: nearestEnd.col, row: nearestEnd.row }, body: null };
  // Depois o corpo: o ponto da parede mais perto (fora das pontas).
  let projected: GridPos | null = null;
  let body: Wall | null = null;
  nearest = radius;
  for (const wall of walls) {
    const dx = wall.to.col - wall.from.col;
    const dy = wall.to.row - wall.from.row;
    const lengthSquared = dx * dx + dy * dy;
    if (lengthSquared < EPSILON) continue;
    const along = ((point.col - wall.from.col) * dx + (point.row - wall.from.row) * dy) / lengthSquared;
    if (along <= 0 || along >= 1) continue;
    const col = wall.from.col + dx * along;
    const row = wall.from.row + dy * along;
    const distance = Math.hypot(col - point.col, row - point.row);
    if (distance <= nearest) {
      nearest = distance;
      projected = { col, row };
      body = wall;
    }
  }
  if (projected) return { point: { col: cent(projected.col), row: cent(projected.row) }, body };
  return { point: { col: cent(point.col), row: cent(point.row) }, body: null };
}

/** A parede de `from` a `to` encosta ou cruza `target` (a mesma conta das junções, em `wallJoin`). */
function touches(from: GridPos, to: GridPos, target: Wall): boolean {
  const rx = to.col - from.col;
  const ry = to.row - from.row;
  const sx = target.to.col - target.from.col;
  const sy = target.to.row - target.from.row;
  const denominator = cross(rx, ry, sx, sy);
  if (Math.abs(denominator) < 1e-9) return false;
  const qx = target.from.col - from.col;
  const qy = target.from.row - from.row;
  const along = cross(qx, qy, sx, sy) / denominator;
  const across = cross(qx, qy, rx, ry) / denominator;
  return along > -EPSILON && along < 1 + EPSILON && across > -EPSILON && across < 1 + EPSILON;
}

/**
 * Ponta que grudou no corpo de uma parede inclinada: em centésimos, ela pode ficar um fio antes da linha (e aí não
 * emenda). Nesse caso passa um pouco além, ao longo da parede nova, até cruzar.
 */
function reach(magnet: Magnet, other: GridPos): GridPos {
  const { point, body } = magnet;
  if (!body || touches(other, point, body)) return point;
  const dx = point.col - other.col;
  const dy = point.row - other.row;
  const length = Math.hypot(dx, dy);
  const sx = body.to.col - body.from.col;
  const sy = body.to.row - body.from.row;
  const bodyLength = Math.hypot(sx, sy);
  if (length < EPSILON || bodyLength < EPSILON) return point;
  // Quase paralelas (porta traçada ao longo da parede): fica sobre a linha, sem passar.
  if (Math.abs(cross(dx, dy, sx, sy)) / (length * bodyLength) < MIN_CROSSING_SINE) return point;
  for (let step = 1; step <= 3; step++) {
    const ahead = { col: cent(point.col + (dx / length) * OVERSHOOT * step), row: cent(point.row + (dy / length) * OVERSHOOT * step) };
    if (touches(other, ahead, body)) return ahead;
  }
  return point;
}

/** Uma ponta com ímã (a prévia do traço, enquanto arrasta). */
export function magnetWallPoint(point: GridPos, walls: Wall[], radius = WALL_MAGNET): GridPos {
  return attract(point, walls, radius).point;
}

/** As duas pontas de uma parede livre com ímã, já prontas para emendar nas paredes que tocam. */
export function magnetWallEnds(from: GridPos, to: GridPos, walls: Wall[], radius = WALL_MAGNET): { from: GridPos; to: GridPos } {
  const start = attract(from, walls, radius);
  const end = attract(to, walls, radius);
  return { from: reach(start, end.point), to: reach(end, start.point) };
}
