import { seeThrough, type Wall } from "./types";

/**
 * Luz (docs/design/luz.md): geometria pura, em casas. O que segura a luz é o mesmo que segura a visão (parede e porta
 * fechada, inclusive secreta); porta aberta deixa passar; as vazadas (cerca, grade, arame, sebe, muro baixo) não seguram
 * a luz das tochas e fazem sombra de sol curta.
 */

export interface Segment {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  seeThrough: boolean;
}

export interface LightPoint {
  x: number;
  y: number;
}

/** Pontos do círculo do alcance (sem paredes, o recorte é ele). */
const CIRCLE_POINTS = 48;
/** Desvio dos raios que passam rente à ponta de uma parede: um de cada lado, para a luz contornar a quina. */
const CORNER_NUDGE = 0.0001;
/** Sombra de sol de uma parede vazada, em relação à de uma parede cheia. */
const SEE_THROUGH_SHADOW = 1 / 3;
/** Folga da origem da luz para a parede que ela não pode atravessar (casas). */
const WALL_GAP = 0.02;

/**
 * Trechos que seguram (ou marcam) a luz: paredes, portas fechadas e janelas fechadas; abertas ficam de fora. A janela
 * fechada segura inteira, qualquer que seja o desenho da parede (a persiana é dela).
 */
export function lightBlockers(walls: Wall[]): Segment[] {
  return walls
    .filter((wall) => !wall.door?.open && !(wall.window && !wall.window.closed))
    .map((wall) => ({ x1: wall.from.col, y1: wall.from.row, x2: wall.to.col, y2: wall.to.row, seeThrough: !wall.window && seeThrough(wall.style) }));
}

/** Distância ao longo do raio (origem + direção × t) até o trecho, ou Infinity se não cruza. */
function rayHit(origin: LightPoint, dx: number, dy: number, segment: Segment): number {
  const sx = segment.x2 - segment.x1;
  const sy = segment.y2 - segment.y1;
  const denominator = dx * sy - dy * sx;
  if (Math.abs(denominator) < 1e-12) return Infinity;
  const qx = segment.x1 - origin.x;
  const qy = segment.y1 - origin.y;
  const t = (qx * sy - qy * sx) / denominator;
  const u = (qx * dy - qy * dx) / denominator;
  return t > 1e-9 && u >= 0 && u <= 1 ? t : Infinity;
}

/**
 * Leva a origem da luz de `from` até `to` sem atravessar parede sólida: com parede no caminho, para um tico antes dela.
 * A chama da tocha fixa fica acima da base no desenho; encostada numa parede, a luz tem que sair do lado da base.
 */
export function stopAtWall(from: LightPoint, to: LightPoint, blockers: Segment[]): LightPoint {
  const length = Math.hypot(to.x - from.x, to.y - from.y);
  if (length < 1e-9) return to;
  const dx = (to.x - from.x) / length;
  const dy = (to.y - from.y) / length;
  let distance = Infinity;
  for (const segment of blockers) if (!segment.seeThrough) distance = Math.min(distance, rayHit(from, dx, dy, segment));
  if (distance > length) return to;
  const stop = Math.max(0, distance - WALL_GAP);
  return { x: from.x + dx * stop, y: from.y + dy * stop };
}

/** Paredes que podem mudar o recorte de uma luz: as que chegam ao alcance (pelo meio e metade do comprimento, com folga). */
export function blockersNear(origin: LightPoint, reach: number, blockers: Segment[]): Segment[] {
  return blockers.filter((segment) => {
    const length = Math.hypot(segment.x2 - segment.x1, segment.y2 - segment.y1);
    const midX = (segment.x1 + segment.x2) / 2;
    const midY = (segment.y1 + segment.y2) / 2;
    return Math.hypot(midX - origin.x, midY - origin.y) <= reach + length / 2 + 0.5;
  });
}

/**
 * O que a luz alcança, como polígono (pares x, y): raios em volta da origem, cada um até a parede mais perto ou até o
 * alcance. Além do círculo, raios rentes às pontas das paredes (para a sombra sair com a quina certa).
 */
export function lightPolygon(origin: LightPoint, reach: number, blockers: Segment[]): number[] {
  const solid = blockers.filter((segment) => !segment.seeThrough);
  const angles: number[] = [];
  for (let index = 0; index < CIRCLE_POINTS; index++) angles.push((index / CIRCLE_POINTS) * Math.PI * 2);
  for (const segment of solid) {
    for (const [x, y] of [
      [segment.x1, segment.y1],
      [segment.x2, segment.y2],
    ]) {
      if (Math.hypot(x - origin.x, y - origin.y) > reach * 1.5) continue;
      const angle = Math.atan2(y - origin.y, x - origin.x);
      angles.push(angle - CORNER_NUDGE, angle, angle + CORNER_NUDGE);
    }
  }
  const normalized = angles.map((angle) => (angle + Math.PI * 2) % (Math.PI * 2)).sort((a, b) => a - b);
  const polygon: number[] = [];
  for (const angle of normalized) {
    const dx = Math.cos(angle);
    const dy = Math.sin(angle);
    let distance = reach;
    for (const segment of solid) distance = Math.min(distance, rayHit(origin, dx, dy, segment));
    polygon.push(origin.x + dx * distance, origin.y + dy * distance);
  }
  return polygon;
}

/**
 * Sombra do sol (ou da lua) de cada parede: o quadrilátero entre a parede e ela deslocada `length` casas na direção da
 * sombra (a parede tem altura). Vazada: um terço do comprimento.
 */
export function sunShadows(blockers: Segment[], direction: LightPoint, length: number): number[][] {
  return blockers.map((segment) => {
    const reach = segment.seeThrough ? length * SEE_THROUGH_SHADOW : length;
    const dx = direction.x * reach;
    const dy = direction.y * reach;
    return [segment.x1, segment.y1, segment.x2, segment.y2, segment.x2 + dx, segment.y2 + dy, segment.x1 + dx, segment.y1 + dy];
  });
}

/** Ponto dentro do polígono (pares x, y), pela regra par-ímpar. */
function insidePolygon(point: LightPoint, polygon: number[]): boolean {
  let inside = false;
  for (let index = 0, previous = polygon.length - 2; index < polygon.length; previous = index, index += 2) {
    const [x1, y1, x2, y2] = [polygon[index], polygon[index + 1], polygon[previous], polygon[previous + 1]];
    if (y1 > point.y !== y2 > point.y && point.x < ((x2 - x1) * (point.y - y1)) / (y2 - y1) + x1) inside = !inside;
  }
  return inside;
}

/**
 * Sol pela janela (docs/design/paredes.md): retângulo de cada janela aberta para dentro do cômodo, na direção da
 * sombra, do comprimento `length` (a sombra de uma parede). Só quando o sol está do lado de fora: dentro do cômodo de
 * um lado e fora de qualquer cômodo do outro.
 */
export function windowSunPatches(windows: Segment[], rooms: number[][], direction: LightPoint, length: number): number[][] {
  const probe = 0.05;
  const inRoom = (point: LightPoint) => rooms.some((room) => insidePolygon(point, room));
  const patches: number[][] = [];
  for (const window of windows) {
    const middle = { x: (window.x1 + window.x2) / 2, y: (window.y1 + window.y2) / 2 };
    const inward = { x: middle.x + direction.x * probe, y: middle.y + direction.y * probe };
    const outward = { x: middle.x - direction.x * probe, y: middle.y - direction.y * probe };
    if (!inRoom(inward) || inRoom(outward)) continue;
    const dx = direction.x * length;
    const dy = direction.y * length;
    patches.push([window.x1, window.y1, window.x2, window.y2, window.x2 + dx, window.y2 + dy, window.x1 + dx, window.y1 + dy]);
  }
  return patches;
}
