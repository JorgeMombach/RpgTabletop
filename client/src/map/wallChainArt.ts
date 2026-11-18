import { seeThrough, type LightPoint, type MapConfig, type WallChain, type WallStyle } from "@rpg/shared";
import { WALL_DRAW, wallSeed } from "./wallArt";

/**
 * Desenho das paredes emendadas (docs/design/paredes.md; teste aprovado em `docs/design/paredes-teste.html`): cada
 * cadeia (`wallChains`) vira duas imagens guardadas, em pixels do mapa: a tinta (contorno escuro e sombra) e o corpo
 * (a textura). No mapa, todas as tintas vão antes de todos os corpos, e as emendas somem.
 */

/** Pinta um trecho da cadeia no eixo dele, de `from` a `to` no comprimento da cadeia (px), espessura `t`. */
export type WallPainter = (ctx: CanvasRenderingContext2D, from: number, to: number, t: number, seed: number, cell: number) => void;

/** Desenho de hoje esticado sobre o trecho (recomeça a cada trecho; as texturas contínuas vêm por lotes). */
const legacy =
  (style: WallStyle): WallPainter =>
  (ctx, from, to, t, seed, cell) => {
    ctx.save();
    ctx.translate(from, 0);
    WALL_DRAW[style](ctx, to - from, t, seed, cell);
    ctx.restore();
  };

export const WALL_PAINTERS = {
  stone: legacy("stone"),
  rock: legacy("rock"),
  wood: legacy("wood"),
  brick: legacy("brick"),
  palisade: legacy("palisade"),
  rampart: legacy("rampart"),
  fence: legacy("fence"),
  iron: legacy("iron"),
  barbed: legacy("barbed"),
  hedge: legacy("hedge"),
  lowstone: legacy("lowstone"),
} satisfies Record<WallStyle, WallPainter>;

/** Imagem guardada e onde ela vai no mapa (px do mapa). */
export interface PlacedImage {
  canvas: HTMLCanvasElement;
  x: number;
  y: number;
  width: number;
  height: number;
}

const INK = "#1d1712";
/** O bico da quina vai no máximo até ~3× a meia espessura (quinas muito fechadas não viram espinho). */
const MITER_FLOOR = 0.3;
/** Ponta solta passa um pouco da ponta (como a parede de hoje). */
const FREE_END = 0.12;

type Vec = [number, number];
const add = (a: Vec, b: Vec): Vec => [a[0] + b[0], a[1] + b[1]];
const scale = (a: Vec, k: number): Vec => [a[0] * k, a[1] * k];
const unit = (a: Vec): Vec => {
  const length = Math.hypot(a[0], a[1]) || 1;
  return [a[0] / length, a[1] / length];
};

/** Lados esquerdo e direito de cada ponto, com a quina em ângulo; `half` = meia largura. */
function outline(points: Vec[], chain: WallChain, half: number, t: number) {
  const count = points.length;
  const segments = chain.closed ? count : count - 1;
  const directions: Vec[] = [];
  for (let index = 0; index < segments; index++) directions.push(unit(add(points[(index + 1) % count], scale(points[index], -1))));
  const normal = (direction: Vec): Vec => [-direction[1], direction[0]];
  const left: Vec[] = [];
  const right: Vec[] = [];
  for (let index = 0; index < count; index++) {
    const previous = chain.closed ? directions[(index - 1 + count) % count] : directions[index - 1];
    const next = chain.closed ? directions[index % count] : directions[index];
    let offset: Vec;
    if (previous && next) {
      const bisector = unit(add(normal(previous), normal(next)));
      const along = bisector[0] * normal(next)[0] + bisector[1] * normal(next)[1];
      offset = scale(bisector, half / Math.max(MITER_FLOOR, along));
    } else offset = scale(normal(previous ?? next), half);
    let point = points[index];
    if (!chain.closed && index === 0 && chain.ends[0] === "free") point = add(point, scale(next, -t * FREE_END));
    if (!chain.closed && index === count - 1 && chain.ends[1] === "free") point = add(point, scale(previous, t * FREE_END));
    left.push(add(point, offset));
    right.push(add(point, scale(offset, -1)));
  }
  return { left, right, directions, segments };
}

function outlinePath(left: Vec[], right: Vec[], closed: boolean): Path2D {
  const path = new Path2D();
  const trace = (list: Vec[], start: boolean) => list.forEach((point, index) => (index === 0 && start ? path.moveTo(point[0], point[1]) : path.lineTo(point[0], point[1])));
  if (closed) {
    // Anel: o lado de fora num sentido, o de dentro no outro.
    trace(left, true);
    path.closePath();
    trace([...right].reverse(), true);
    path.closePath();
  } else {
    trace(left, true);
    trace([...right].reverse(), false);
    path.closePath();
  }
  return path;
}

const cache = new Map<string, { ink: PlacedImage | null; body: PlacedImage }>();
const CACHE_MAX = 700;

/**
 * Duas imagens da cadeia (tinta e sombra; corpo), na resolução da escala (degraus de 2^¼, como `wallArt`). Vazadas
 * (cerca, grade…) não têm tinta: um contorno cheio taparia os vãos.
 */
export function chainArt(chain: WallChain, grid: MapConfig, pxPerUnit: number): { ink: PlacedImage | null; body: PlacedImage } {
  const step = Math.pow(2, Math.ceil(Math.log2(Math.max(0.25, pxPerUnit)) * 4) / 4);
  const key = [chain.style, chain.thickness, chain.closed, chain.ends.join(), chain.points.map((point) => `${point.x.toFixed(3)},${point.y.toFixed(3)}`).join(";"), step, grid.cellPx, grid.offsetX, grid.offsetY].join("|");
  const hit = cache.get(key);
  if (hit) {
    cache.delete(key);
    cache.set(key, hit);
    return hit;
  }
  const toPx = (point: LightPoint): Vec => [grid.offsetX + point.x * grid.cellPx, grid.offsetY + point.y * grid.cellPx];
  const points = chain.points.map(toPx);
  const t = chain.thickness * grid.cellPx;
  const open = seeThrough(chain.style);
  // Margens justas (cada imagem custa pela área a cada redesenho): a tinta leva a sombra; o corpo das sólidas fica no
  // contorno (com a quina); nas vazadas, os esteios e portões passam da espessura.
  const pad = t * (open ? 3 : 0.6);
  const inkPad = t * 1.5;
  const xs = points.map((point) => point[0]);
  const ys = points.map((point) => point[1]);
  // A quina em ângulo vai até ~3,3× a meia espessura além do ponto.
  const reach = (margin: number) => margin + (open ? 0 : t * 1.2);
  const boxWith = (margin: number) => ({
    x: Math.min(...xs) - reach(margin),
    y: Math.min(...ys) - reach(margin),
    width: Math.max(...xs) - Math.min(...xs) + reach(margin) * 2,
    height: Math.max(...ys) - Math.min(...ys) + reach(margin) * 2,
  });
  const canvasFor = (box: { x: number; y: number; width: number; height: number }) => {
    const k = Math.min(step, 4096 / Math.max(box.width, box.height));
    const canvas = document.createElement("canvas");
    canvas.width = Math.max(2, Math.ceil(box.width * k));
    canvas.height = Math.max(2, Math.ceil(box.height * k));
    const ctx = canvas.getContext("2d")!;
    ctx.scale(k, k);
    ctx.translate(-box.x, -box.y);
    return { canvas, ctx, k, placed: (): PlacedImage => ({ canvas, ...box }) };
  };

  let ink: PlacedImage | null = null;
  if (!open) {
    const { left, right } = outline(points, chain, t / 2, t);
    const path = outlinePath(left, right, chain.closed);
    const { ctx, k, placed } = canvasFor(boxWith(inkPad));
    ctx.save();
    // A sombra do canvas é em pixels da imagem (não acompanha a escala).
    ctx.shadowColor = "rgba(0,0,0,.55)";
    ctx.shadowBlur = t * 0.6 * k;
    ctx.shadowOffsetY = t * 0.2 * k;
    ctx.fillStyle = INK;
    ctx.fill(path);
    ctx.restore();
    ctx.lineJoin = "round";
    ctx.strokeStyle = INK;
    ctx.lineWidth = t * 0.22;
    ctx.stroke(path);
    ink = placed();
  }

  // Corpo: cada trecho recortado pelo seu quadrilátero (a quina divide os dois trechos) e pintado pelo comprimento.
  const { left, right, directions, segments } = outline(points, chain, open ? pad : t / 2, t);
  const body = canvasFor(boxWith(pad));
  const { ctx } = body;
  const first = chain.points[0];
  const second = chain.points[1] ?? first;
  const seed = wallSeed(first.x, first.y, second.x, second.y);
  const painter = WALL_PAINTERS[chain.style];
  let along = 0;
  for (let index = 0; index < segments; index++) {
    const a = points[index];
    const b = points[(index + 1) % points.length];
    const length = Math.hypot(b[0] - a[0], b[1] - a[1]);
    const next = (index + 1) % left.length;
    const quad = new Path2D();
    for (const point of [left[index], left[next], right[next], right[index]]) quad.lineTo(point[0], point[1]);
    quad.closePath();
    ctx.save();
    ctx.clip(quad);
    ctx.translate(a[0], a[1]);
    ctx.rotate(Math.atan2(directions[index][1], directions[index][0]));
    ctx.translate(-along, 0);
    painter(ctx, along - t * 2, along + length + t * 2, t, seed, grid.cellPx);
    ctx.restore();
    along += length;
  }
  const art = { ink, body: body.placed() };
  cache.set(key, art);
  const oldest = cache.keys().next();
  if (cache.size > CACHE_MAX && !oldest.done) cache.delete(oldest.value);
  return art;
}
