import { seeThrough, straightenChain, wallSeed, type LightPoint, type MapConfig, type WallChain, type WallStyle } from "@rpg/shared";
import { WALL_DRAW } from "./wallArt";

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

/**
 * Tira guardada de um trecho, no eixo dele (como a parede de antes: a área é a do comprimento, não a do cômodo). No
 * mapa: `translate(x, y)`, `rotate(angle)` e `drawImage(canvas, left, top, width, height)`. `bounds` = caixa no mapa.
 */
export interface StripImage {
  canvas: HTMLCanvasElement;
  x: number;
  y: number;
  angle: number;
  left: number;
  top: number;
  width: number;
  height: number;
  bounds: { x: number; y: number; width: number; height: number };
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

/**
 * Lados esquerdo e direito de cada ponto, com a quina em ângulo; `half` = meia largura. Ponta solta passa um pouco;
 * ponta numa quina de desenhos diferentes passa `extend` (meia espessura da outra), para o canto não ficar com dente.
 */
function outline(points: Vec[], chain: WallChain, half: number, t: number, cell: number) {
  const count = points.length;
  const segments = chain.closed ? count : count - 1;
  const directions: Vec[] = [];
  for (let index = 0; index < segments; index++) directions.push(unit(add(points[(index + 1) % count], scale(points[index], -1))));
  const normal = (direction: Vec): Vec => [-direction[1], direction[0]];
  const reach = (end: 0 | 1) => (chain.ends[end] === "free" ? t * FREE_END : chain.extend[end] * cell);
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
    if (!chain.closed && index === 0) point = add(point, scale(next, -reach(0)));
    if (!chain.closed && index === count - 1) point = add(point, scale(previous, reach(1)));
    left.push(add(point, offset));
    right.push(add(point, scale(offset, -1)));
  }
  return { left, right, directions, segments };
}

/** Tira mais longa que isso (px do mapa) vira pedaços: fica nítida de perto e só o pedaço na tela é desenhado. */
const MAX_PIECE = 1024;

/** Imagens guardadas, com um teto de pixels somados (saem primeiro as mais antigas, como as de outro degrau de zoom). */
const cache = new Map<string, { ink: StripImage[]; body: StripImage[]; pixels: number }>();
const PIXEL_BUDGET = 32_000_000;
let cachedPixels = 0;

/**
 * Tiras de cada trecho da cadeia: tinta e sombra; corpo. Na resolução da escala (degraus de 2^¼, como `wallArt`).
 * Vazadas (cerca, grade…) não têm tinta: um contorno cheio taparia os vãos.
 */
export function chainArt(chain: WallChain, grid: MapConfig, pxPerUnit: number): { ink: StripImage[]; body: StripImage[] } {
  const step = Math.pow(2, Math.ceil(Math.log2(Math.max(0.25, pxPerUnit)) * 4) / 4);
  const key = [chain.style, chain.thickness, chain.closed, chain.ends.join(), chain.extend.join(), chain.points.map((point) => `${point.x.toFixed(3)},${point.y.toFixed(3)}`).join(";"), step, grid.cellPx, grid.offsetX, grid.offsetY].join("|");
  const hit = cache.get(key);
  if (hit) {
    cache.delete(key);
    cache.set(key, hit);
    return hit;
  }
  const toPx = (point: LightPoint): Vec => [grid.offsetX + point.x * grid.cellPx, grid.offsetY + point.y * grid.cellPx];
  const points = straightenChain(chain.points, chain.closed).map(toPx);
  const t = chain.thickness * grid.cellPx;
  const open = seeThrough(chain.style);
  const first = chain.points[0];
  const second = chain.points[1] ?? first;
  const seed = wallSeed(first.x, first.y, second.x, second.y);
  const painter = WALL_PAINTERS[chain.style];
  const solid = outline(points, chain, t / 2, t, grid.cellPx);
  // Nas vazadas, os esteios e portões passam da espessura: recorte largo.
  const wide = open ? outline(points, chain, t * 3, t, grid.cellPx) : solid;
  const inkPad = t * 1.5;
  const ink: StripImage[] = [];
  const body: StripImage[] = [];
  let pixels = 0;
  let along = 0;

  /** Tira do trecho `index`, desenhada no eixo dele (origem no começo do trecho, comprimento em x); `quad` no mapa. */
  const strip = (index: number, quad: Vec[], margin: number, draw: (ctx: CanvasRenderingContext2D, local: Vec[], k: number) => void): StripImage => {
    const a = points[index];
    const angle = Math.atan2(solid.directions[index][1], solid.directions[index][0]);
    const cos = Math.cos(-angle);
    const sin = Math.sin(-angle);
    const local = quad.map((point): Vec => {
      const dx = point[0] - a[0];
      const dy = point[1] - a[1];
      return [dx * cos - dy * sin, dx * sin + dy * cos];
    });
    const xs = local.map((point) => point[0]);
    const ys = local.map((point) => point[1]);
    const left = Math.min(...xs) - margin;
    const top = Math.min(...ys) - margin;
    const width = Math.max(...xs) - Math.min(...xs) + margin * 2;
    const height = Math.max(...ys) - Math.min(...ys) + margin * 2;
    const k = Math.min(step, 4096 / Math.max(width, height));
    const canvas = document.createElement("canvas");
    canvas.width = Math.max(2, Math.ceil(width * k));
    canvas.height = Math.max(2, Math.ceil(height * k));
    pixels += canvas.width * canvas.height;
    const ctx = canvas.getContext("2d");
    if (ctx) {
      ctx.scale(k, k);
      ctx.translate(-left, -top);
      draw(ctx, local, k);
    }
    // Caixa no mapa: os quatro cantos da tira, girados de volta.
    const corners = [
      [left, top],
      [left + width, top],
      [left, top + height],
      [left + width, top + height],
    ].map(([x, y]): Vec => [a[0] + x * Math.cos(angle) - y * Math.sin(angle), a[1] + x * Math.sin(angle) + y * Math.cos(angle)]);
    const bx = corners.map((point) => point[0]);
    const by = corners.map((point) => point[1]);
    const bounds = { x: Math.min(...bx), y: Math.min(...by), width: Math.max(...bx) - Math.min(...bx), height: Math.max(...by) - Math.min(...by) };
    return { canvas, x: a[0], y: a[1], angle, left, top, width, height, bounds };
  };
  const pathOf = (local: Vec[]) => {
    const path = new Path2D();
    for (const point of local) path.lineTo(point[0], point[1]);
    path.closePath();
    return path;
  };

  for (let index = 0; index < solid.segments; index++) {
    const next = (index + 1) % solid.left.length;
    const end = points[(index + 1) % points.length];
    const length = Math.hypot(end[0] - points[index][0], end[1] - points[index][1]);
    const angle = Math.atan2(solid.directions[index][1], solid.directions[index][0]);
    // Pedaço `piece` de `count` do quadrilátero do trecho (cortes iguais nos dois lados).
    const count = Math.max(1, Math.ceil(length / MAX_PIECE));
    const lerp = (from: Vec, to: Vec, f: number): Vec => [from[0] + (to[0] - from[0]) * f, from[1] + (to[1] - from[1]) * f];
    const pieceOf = (shape: typeof solid, piece: number): Vec[] => {
      const [f0, f1] = [piece / count, (piece + 1) / count];
      return [lerp(shape.left[index], shape.left[next], f0), lerp(shape.left[index], shape.left[next], f1), lerp(shape.right[index], shape.right[next], f1), lerp(shape.right[index], shape.right[next], f0)];
    };
    for (let piece = 0; piece < count && !open; piece++) {
      ink.push(
        strip(index, pieceOf(solid, piece), inkPad, (ctx, local, k) => {
          const path = pathOf(local);
          ctx.save();
          // A sombra do canvas é em pixels da tira e não gira com ela: o deslocamento vai girado (no mapa, para baixo).
          ctx.shadowColor = "rgba(0,0,0,.55)";
          ctx.shadowBlur = t * 0.6 * k;
          ctx.shadowOffsetX = t * 0.2 * k * Math.sin(angle);
          ctx.shadowOffsetY = t * 0.2 * k * Math.cos(angle);
          ctx.fillStyle = INK;
          ctx.fill(path);
          ctx.restore();
          ctx.lineJoin = "round";
          ctx.strokeStyle = INK;
          ctx.lineWidth = t * 0.22;
          ctx.stroke(path);
        }),
      );
    }
    const start = along;
    for (let piece = 0; piece < count; piece++) {
      body.push(
        strip(index, pieceOf(wide, piece), 1, (ctx, local) => {
          ctx.clip(pathOf(local));
          ctx.translate(-start, 0);
          painter(ctx, start - t * 2, start + length + t * 2, t, seed, grid.cellPx);
        }),
      );
    }
    along += length;
  }
  const art = { ink, body, pixels };
  cache.set(key, art);
  cachedPixels += pixels;
  for (const [oldKey, old] of cache) {
    if (cachedPixels <= PIXEL_BUDGET || cache.size <= 1) break;
    cache.delete(oldKey);
    cachedPixels -= old.pixels;
  }
  return art;
}
