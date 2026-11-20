import type { BridgeWidth } from "./bridge";
import type { LightPoint } from "./light";

/**
 * Escadas (docs/design/escadas.md): peças do mapa em casas, só visuais (ADR-06). Três formatos:
 * - *path*: caminho clique a clique (pé → topo, linha do meio), com as viradas arredondadas;
 * - *spiral*: caracol, centro e borda (a direção dá o primeiro degrau), largura = diâmetro;
 * - *ladder*: escada de mão, pé e topo.
 * No relevo a escada segue o chão; onde ele quase não varia, fica "solta" e sobe até um corte ou desce até um alçapão.
 */

export const STAIR_SHAPES = ["path", "spiral", "ladder"] as const;
export type StairShape = (typeof STAIR_SHAPES)[number];
export const STAIR_MATERIALS = ["stone", "wood"] as const;
export type StairMaterial = (typeof STAIR_MATERIALS)[number];
/** Para onde vai a escada solta (sem relevo embaixo), a partir do pé. */
export type StairExit = "up" | "down";

export interface Stair {
  id: string;
  shape: StairShape;
  points: LightPoint[];
  width: BridgeWidth;
  material: StairMaterial;
  exit: StairExit;
}

/** Trecho do caminho: reto ou arco (ângulo inicial e giro com sinal, em radianos); `start` = u (casas) onde começa. */
export type StairPrim =
  | { kind: "line"; from: LightPoint; to: LightPoint; start: number }
  | { kind: "arc"; center: LightPoint; radius: number; angle: number; sweep: number; start: number };

/** Caminho pronto: os trechos, o comprimento (casas) e o primeiro ponto (o lugar, mesmo sem comprimento). */
export interface StairPath {
  prims: StairPrim[];
  length: number;
  origin: LightPoint;
}

/** Lance (`steps` > 0) ou patamar (`steps` = 0), de `from` a `to` (u, casas), do nível `fromLevel` ao `toLevel`. */
export interface StairSegment {
  from: number;
  to: number;
  fromLevel: number;
  toLevel: number;
  steps: number;
}

/** Raio das viradas (casas), cortado para caber em 45% de cada trecho. */
export const STAIR_CORNER = 0.9;
/** Degraus por nível de relevo e casas de lance por nível (mais deitado que o penhasco: cava em cima, constrói embaixo). */
export const STAIR_STEPS_PER_LEVEL = 10;
export const STAIR_FLIGHT_PER_LEVEL = 2.2;
/** Abaixo dessa variação de altura (níveis) em todo o caminho, a escada é solta. */
export const STAIR_LOOSE_BELOW = 0.25;
/** Comprimento de um degrau da escada solta (casas). */
const LOOSE_STEP = 0.4;
/** Amostragem do chão ao longo da linha (casas); inclinação mínima de um lance (níveis por casa). */
const SAMPLE = 0.02;
const MIN_SLOPE = 0.05;
/** Buracos menores que isso (amostras: 0,3 casa) emendam; folga em cada ponta do lance (amostras: 0,06 casa). */
const GAP_SAMPLES = 15;
const PAD_SAMPLES = 3;
/** Viradas menores que isso (radianos) são retas; maiores que π menos isso são de volta (canto vivo). */
const TURN_EPSILON = 0.01;

const distance = (from: LightPoint, to: LightPoint) => Math.hypot(to.x - from.x, to.y - from.y);
const along = (from: LightPoint, direction: LightPoint, amount: number): LightPoint => ({
  x: from.x + direction.x * amount,
  y: from.y + direction.y * amount,
});

/**
 * O caminho da escada: retas entre os pontos e, em cada virada, um arco de raio `STAIR_CORNER` (cortado para caber).
 * Pontos repetidos são ignorados; numa volta completa (180°) o canto fica vivo. A mesma conta da página de teste.
 */
export function stairPath(points: LightPoint[]): StairPath {
  const origin = points[0] ?? { x: 0, y: 0 };
  const clean: LightPoint[] = [];
  for (const point of points) {
    if (!Number.isFinite(point.x) || !Number.isFinite(point.y)) continue;
    const last = clean[clean.length - 1];
    if (!last || distance(last, point) > 1e-4) clean.push(point);
  }
  const prims: StairPrim[] = [];
  let length = 0;
  const line = (from: LightPoint, to: LightPoint) => {
    const size = distance(from, to);
    if (size <= 1e-6) return;
    prims.push({ kind: "line", from, to, start: length });
    length += size;
  };
  let current = clean[0];
  for (let index = 1; index < clean.length; index++) {
    const previous = clean[index - 1];
    const corner = clean[index];
    const next = clean[index + 1];
    if (!next) {
      line(current, corner);
      break;
    }
    const firstLength = distance(previous, corner);
    const secondLength = distance(corner, next);
    const first = { x: (corner.x - previous.x) / firstLength, y: (corner.y - previous.y) / firstLength };
    const second = { x: (next.x - corner.x) / secondLength, y: (next.y - corner.y) / secondLength };
    const cross = first.x * second.y - first.y * second.x;
    const turn = Math.acos(Math.max(-1, Math.min(1, first.x * second.x + first.y * second.y)));
    if (turn < TURN_EPSILON || turn > Math.PI - TURN_EPSILON) {
      line(current, corner);
      current = corner;
      continue;
    }
    const tanHalf = Math.tan(turn / 2);
    const radius = Math.min(STAIR_CORNER, (0.45 * firstLength) / tanHalf, (0.45 * secondLength) / tanHalf);
    const trim = radius * tanHalf;
    const arcStart = along(corner, first, -trim);
    line(current, arcStart);
    const side = Math.sign(cross);
    const center = along(arcStart, { x: -first.y, y: first.x }, side * radius);
    prims.push({
      kind: "arc",
      center,
      radius,
      angle: Math.atan2(arcStart.y - center.y, arcStart.x - center.x),
      sweep: side * turn,
      start: length,
    });
    length += radius * turn;
    current = along(corner, second, trim);
  }
  return { prims, length, origin: clean[0] ?? origin };
}

/** Comprimento de um trecho (casas). */
function primLength(prim: StairPrim): number {
  return prim.kind === "line" ? distance(prim.from, prim.to) : prim.radius * Math.abs(prim.sweep);
}

/** Ponto da linha do meio em `u` casas a partir do pé (preso entre 0 e o comprimento). */
export function stairPointAt(path: StairPath, u: number): LightPoint {
  if (path.prims.length === 0) return path.origin;
  let prim = path.prims[0];
  for (const candidate of path.prims) if (candidate.start <= u) prim = candidate;
  const offset = Math.max(0, Math.min(primLength(prim), u - prim.start));
  if (prim.kind === "line") {
    const size = distance(prim.from, prim.to);
    return along(prim.from, { x: (prim.to.x - prim.from.x) / size, y: (prim.to.y - prim.from.y) / size }, offset);
  }
  const angle = prim.angle + Math.sign(prim.sweep) * (offset / prim.radius);
  return { x: prim.center.x + prim.radius * Math.cos(angle), y: prim.center.y + prim.radius * Math.sin(angle) };
}

/** Altura do chão ao longo da linha, a cada `SAMPLE` casa (NaN vira 0). */
function sampleGround(path: StairPath, groundAt: (x: number, y: number) => number): number[] {
  const count = Math.max(1, Math.ceil(path.length / SAMPLE));
  const heights: number[] = [];
  for (let index = 0; index <= count; index++) {
    const point = stairPointAt(path, Math.min(path.length, index * SAMPLE));
    const height = groundAt(point.x, point.y);
    heights.push(Number.isFinite(height) ? height : 0);
  }
  return heights;
}

/** Escada solta: a altura do chão varia menos de `STAIR_LOOSE_BELOW` nível em todo o caminho. */
export function stairLoose(path: StairPath, groundAt: (x: number, y: number) => number): boolean {
  const heights = sampleGround(path, groundAt);
  return Math.max(...heights) - Math.min(...heights) < STAIR_LOOSE_BELOW;
}

/**
 * Perfil da escada: lances e patamares cobrindo o caminho de ponta a ponta. No relevo, segue o chão: cada trecho que
 * sobe ou desce (sem trocar de sentido; buracos curtos emendam) vira um lance de degraus iguais, com pelo menos
 * `STAIR_FLIGHT_PER_LEVEL` casas por nível, crescendo igual dos dois lados; o resto é patamar. Solta: um lance só, do
 * chão no pé até um nível acima (`up`) ou abaixo (`down`).
 */
export function stairProfile(path: StairPath, groundAt: (x: number, y: number) => number, exit: StairExit): StairSegment[] {
  const { length } = path;
  if (length <= 1e-6) return [];
  const heights = sampleGround(path, groundAt);
  if (Math.max(...heights) - Math.min(...heights) < STAIR_LOOSE_BELOW) {
    const base = heights[0];
    return [{ from: 0, to: length, fromLevel: base, toLevel: base + (exit === "up" ? 1 : -1), steps: Math.max(2, Math.round(length / LOOSE_STEP)) }];
  }
  const count = heights.length - 1;
  // Trechos inclinados [primeira, última amostra), cada um num sentido só.
  const runs: { first: number; last: number; sign: number }[] = [];
  for (let index = 0; index < count; index++) {
    const slope = (heights[index + 1] - heights[index]) / SAMPLE;
    if (Math.abs(slope) < MIN_SLOPE) continue;
    const sign = Math.sign(slope);
    const previous = runs[runs.length - 1];
    if (previous && previous.sign === sign && index - previous.last < GAP_SAMPLES) previous.last = index + 1;
    else runs.push({ first: index, last: index + 1, sign });
  }
  const segments: StairSegment[] = [];
  let u = 0;
  let level = runs.length > 0 ? heights[Math.max(0, runs[0].first - PAD_SAMPLES)] : heights[0];
  for (const run of runs) {
    const target = heights[Math.min(count, run.last + PAD_SAMPLES)];
    const steps = Math.round(Math.abs(target - level) * STAIR_STEPS_PER_LEVEL);
    if (steps === 0) continue;
    let from = Math.max(u, (run.first - PAD_SAMPLES) * SAMPLE);
    let to = Math.min(length, (run.last + PAD_SAMPLES) * SAMPLE);
    const want = Math.abs(target - level) * STAIR_FLIGHT_PER_LEVEL;
    if (to - from < want) {
      const grow = (want - (to - from)) / 2;
      from = Math.max(u, from - grow);
      to = Math.min(length, to + grow);
    }
    if (to - from < SAMPLE) {
      // sem lugar (colado no lance anterior ou no fim): o degrau vai para o lance anterior, se for no mesmo sentido
      const previous = segments[segments.length - 1];
      if (previous && previous.steps > 0 && Math.sign(previous.toLevel - previous.fromLevel) === Math.sign(target - level)) {
        previous.toLevel = target;
        previous.steps = Math.round(Math.abs(target - previous.fromLevel) * STAIR_STEPS_PER_LEVEL);
        level = target;
      }
      continue;
    }
    if (from > u) segments.push({ from: u, to: from, fromLevel: level, toLevel: level, steps: 0 });
    segments.push({ from, to, fromLevel: level, toLevel: target, steps });
    u = to;
    level = target;
  }
  if (u < length) segments.push({ from: u, to: length, fromLevel: level, toLevel: level, steps: 0 });
  return segments;
}

/**
 * Distância (casas) de um ponto até um trecho do caminho, na faixa dele (de lado); fora da faixa, infinita: as pontas da
 * escada são retas, e nas viradas o arco cobre a emenda.
 */
function primDistance(prim: StairPrim, point: LightPoint): number {
  if (prim.kind === "line") {
    const size = distance(prim.from, prim.to);
    const t = ((point.x - prim.from.x) * (prim.to.x - prim.from.x) + (point.y - prim.from.y) * (prim.to.y - prim.from.y)) / (size * size);
    if (t < 0 || t > 1) return Infinity;
    return distance(point, { x: prim.from.x + (prim.to.x - prim.from.x) * t, y: prim.from.y + (prim.to.y - prim.from.y) * t });
  }
  const angle = Math.atan2(point.y - prim.center.y, point.x - prim.center.x);
  const turned = ((((angle - prim.angle) * Math.sign(prim.sweep)) % (2 * Math.PI)) + 2 * Math.PI) % (2 * Math.PI);
  if (turned > Math.abs(prim.sweep)) return Infinity;
  return Math.abs(distance(point, prim.center) - prim.radius);
}

/** Meia largura da escada de mão (casas) para o clique. */
const LADDER_HALF = 0.25;

/** A escada contém o ponto: caminho pela distância à linha; caracol pelo círculo; de mão pelo retângulo de 0,5. */
function stairContains(stair: Stair, point: LightPoint): boolean {
  const [first, second] = stair.points;
  if (!first) return false;
  if (stair.shape === "spiral") return distance(first, point) <= stair.width / 2;
  if (stair.shape === "ladder") {
    if (!second) return false;
    const size = distance(first, second);
    if (size <= 0) return false;
    const alongX = (second.x - first.x) / size;
    const alongY = (second.y - first.y) / size;
    const offsetX = point.x - first.x;
    const offsetY = point.y - first.y;
    const position = offsetX * alongX + offsetY * alongY;
    return position >= 0 && position <= size && Math.abs(offsetX * -alongY + offsetY * alongX) <= LADDER_HALF;
  }
  const path = stairPath(stair.points);
  return path.prims.some((prim) => primDistance(prim, point) <= stair.width / 2);
}

/**
 * A escada sob o ponto; onde se cruzam, a que o desenho põe por cima: a placa de vídeo desenha um formato depois do
 * outro (caminho, caracol, de mão), e dentro do mesmo formato a última da lista. `null` se nenhuma.
 */
export function stairAt(stairs: Stair[], point: LightPoint): Stair | null {
  const drawOrder = stairs.map((stair, index) => ({ stair, rank: STAIR_SHAPES.indexOf(stair.shape) * stairs.length + index }));
  drawOrder.sort((first, second) => second.rank - first.rank);
  for (const { stair } of drawOrder) if (stairContains(stair, point)) return stair;
  return null;
}
