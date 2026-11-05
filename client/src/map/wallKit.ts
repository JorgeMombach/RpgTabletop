import { grain } from "./tokenArt";

/** Peças comuns dos desenhos de parede e portão (`wallArt.ts` e `wallArtMore.ts`). */

/** Aleatório estável por semente: a parede não "treme" a cada redesenho. */
export function rng(seed: number) {
  let s = seed >>> 0 || 1;
  return () => {
    s ^= s << 13;
    s ^= s >>> 17;
    s ^= s << 5;
    return ((s >>> 0) % 10000) / 10000;
  };
}

/** Granulado por cima (pedra, madeira, folhas), em "multiplicar". */
export function textured(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, scale: number, alpha: number) {
  const pattern = ctx.createPattern(grain(), "repeat");
  if (!pattern) return;
  pattern.setTransform(new DOMMatrix().scale(scale));
  ctx.save();
  ctx.globalCompositeOperation = "multiply";
  ctx.globalAlpha = alpha;
  ctx.fillStyle = pattern;
  ctx.fillRect(x, y, w, h);
  ctx.restore();
}

/** Sombra no chão de um desenho: `k` diz quão alto ele é (muro baixo e cerca fazem sombra curta). */
export function shadowed(ctx: CanvasRenderingContext2D, t: number, k: number, draw: () => void) {
  ctx.save();
  ctx.shadowColor = "rgba(0,0,0,.65)";
  ctx.shadowBlur = t * 0.8 * k;
  ctx.shadowOffsetY = t * 0.25 * k;
  draw();
  ctx.restore();
}

export const WOODS = ["#8b5a2b", "#7a4e24", "#94632f", "#6e4520"];
