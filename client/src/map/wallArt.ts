import type { WallStyle } from "@rpg/shared";
import { grain, METALS, rivet, shade } from "./tokenArt";

/**
 * Paredes e portas desenhadas no canvas (L5), no mesmo kit dos tokens. Cada parede é desenhada no próprio
 * eixo: do ponto (0, 0) até (L, 0), com espessura `t`. Três estilos por cena: pedra lavrada (blocos em duas
 * fiadas), rocha bruta (contorno irregular) e madeira (tábuas e esteios). Parede comum vira imagem guardada;
 * porta é desenhada ao vivo (são poucas e mudam de estado).
 */

/** Aleatório estável por semente: a parede não "treme" a cada redesenho. */
function rng(seed: number) {
  let s = seed >>> 0 || 1;
  return () => {
    s ^= s << 13;
    s ^= s >>> 17;
    s ^= s << 5;
    return ((s >>> 0) % 10000) / 10000;
  };
}

/** Semente a partir das pontas da parede (a mesma parede sai sempre igual, em qualquer tela). */
export function wallSeed(ax: number, ay: number, bx: number, by: number): number {
  let h = 2166136261;
  for (const n of [ax, ay, bx, by]) {
    h ^= Math.round(n * 100);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

function textured(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, scale: number, alpha: number) {
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

function dropShadow(ctx: CanvasRenderingContext2D, path: Path2D, t: number, color: string) {
  ctx.save();
  ctx.shadowColor = "rgba(0,0,0,.7)";
  ctx.shadowBlur = t * 0.8;
  ctx.shadowOffsetY = t * 0.25;
  ctx.fillStyle = color;
  ctx.fill(path);
  ctx.restore();
}

const STONES = ["#9a9284", "#8a8274", "#a59d8e", "#7d766a", "#938a7a", "#b0a796"];

/** Pedra lavrada: duas fiadas de blocos desencontrados, argamassa escura, cada bloco com tom, luz e desgaste. */
function stoneWall(ctx: CanvasRenderingContext2D, L: number, t: number, seed: number) {
  const base = new Path2D();
  base.roundRect(-t * 0.15, -t / 2, L + t * 0.3, t, t * 0.2);
  dropShadow(ctx, base, t, "#2a2622");
  const r = rng(seed);
  const gap = t * 0.07;
  const h = t / 2;
  for (let row = 0; row < 2; row++) {
    let x = -t * 0.12 + (row ? -h * 0.6 : 0);
    while (x < L + t * 0.15) {
      const w = h * (1.1 + r() * 1.3);
      const x0 = Math.max(x, -t * 0.12);
      const x1 = Math.min(x + w, L + t * 0.15);
      if (x1 - x0 > gap * 2) {
        const y0 = -t / 2 + row * h;
        const block = new Path2D();
        block.roundRect(x0 + gap / 2, y0 + gap / 2, x1 - x0 - gap, h - gap, h * 0.18);
        const tone = STONES[Math.floor(r() * STONES.length)];
        const g = ctx.createLinearGradient(0, y0, 0, y0 + h);
        g.addColorStop(0, shade(tone, 0.18));
        g.addColorStop(1, shade(tone, -0.3));
        ctx.fillStyle = g;
        ctx.fill(block);
        ctx.save();
        ctx.clip(block);
        textured(ctx, x0, y0, x1 - x0, h, t / 40, 0.45);
        ctx.restore();
        ctx.strokeStyle = "rgba(255,248,230,.35)";
        ctx.lineWidth = t * 0.04;
        ctx.beginPath();
        ctx.moveTo(x0 + gap, y0 + gap * 0.9);
        ctx.lineTo(x1 - gap, y0 + gap * 0.9);
        ctx.stroke();
      }
      x += w;
    }
  }
}

/** Rocha bruta: contorno irregular dos dois lados, rocha com ruído, rachaduras e aresta clara. */
function rockWall(ctx: CanvasRenderingContext2D, L: number, t: number, seed: number) {
  const r = rng(seed);
  const n = Math.max(6, Math.round(L / (t * 0.45)));
  const top: [number, number][] = [];
  const bot: [number, number][] = [];
  for (let i = 0; i <= n; i++) {
    const x = -t * 0.2 + ((L + t * 0.4) * i) / n;
    top.push([x, -t / 2 - (r() - 0.35) * t * 0.35]);
    bot.push([x, t / 2 + (r() - 0.35) * t * 0.35]);
  }
  const p = new Path2D();
  p.moveTo(top[0][0], top[0][1]);
  for (let i = 1; i < top.length; i++) {
    const [x, y] = top[i];
    const [px, py] = top[i - 1];
    p.quadraticCurveTo(px, py, (px + x) / 2, (py + y) / 2);
  }
  p.lineTo(top[n][0] + t * 0.25, 0);
  for (let i = n; i >= 0; i--) p.lineTo(bot[i][0], bot[i][1]);
  p.lineTo(top[0][0] - t * 0.25, 0);
  p.closePath();
  dropShadow(ctx, p, t, "#3a352e");
  ctx.save();
  ctx.clip(p);
  const g = ctx.createLinearGradient(0, -t, 0, t);
  g.addColorStop(0, "#a49a88");
  g.addColorStop(0.5, "#7b7264");
  g.addColorStop(1, "#4a443a");
  ctx.fillStyle = g;
  ctx.fillRect(-t, -t, L + 2 * t, 2 * t);
  textured(ctx, -t, -t, L + 2 * t, 2 * t, t / 28, 0.7);
  ctx.strokeStyle = "rgba(20,16,12,.55)";
  ctx.lineWidth = t * 0.05;
  for (let i = 0; i < n / 2; i++) {
    const x = r() * L;
    ctx.beginPath();
    ctx.moveTo(x, -t * 0.4);
    ctx.lineTo(x + (r() - 0.5) * t * 0.6, (r() - 0.5) * t * 0.3);
    ctx.lineTo(x + (r() - 0.5) * t * 0.6, t * 0.4);
    ctx.stroke();
  }
  ctx.restore();
  ctx.save();
  ctx.translate(0, -t * 0.03);
  ctx.strokeStyle = "rgba(255,245,225,.35)";
  ctx.lineWidth = t * 0.05;
  ctx.stroke(p);
  ctx.restore();
  ctx.strokeStyle = "#1a1612";
  ctx.lineWidth = t * 0.05;
  ctx.stroke(p);
}

const WOODS = ["#8b5a2b", "#7a4e24", "#94632f", "#6e4520"];

/** Madeira: três tábuas no comprimento com veios e emendas, e esteios (tocos quadrados) a cada trecho, pregados. */
function woodWall(ctx: CanvasRenderingContext2D, L: number, t: number, seed: number) {
  const r = rng(seed);
  const base = new Path2D();
  base.roundRect(-t * 0.1, -t / 2, L + t * 0.2, t, t * 0.1);
  dropShadow(ctx, base, t, "#2a1608");
  ctx.save();
  ctx.clip(base);
  const ph = t / 3;
  for (let i = 0; i < 3; i++) {
    const y0 = -t / 2 + i * ph;
    // Tábuas de comprimentos diferentes: as emendas não ficam alinhadas.
    let x = -t * 0.1 - r() * t;
    while (x < L + t * 0.2) {
      const w = t * (2.5 + r() * 3);
      const tone = WOODS[Math.floor(r() * WOODS.length)];
      const g = ctx.createLinearGradient(0, y0, 0, y0 + ph);
      g.addColorStop(0, shade(tone, 0.2));
      g.addColorStop(1, shade(tone, -0.3));
      ctx.fillStyle = g;
      ctx.fillRect(x, y0, w, ph);
      ctx.strokeStyle = "rgba(40,20,5,.35)";
      ctx.lineWidth = t * 0.025;
      const yy = y0 + ph * (0.35 + r() * 0.3);
      ctx.beginPath();
      ctx.moveTo(x, yy);
      for (let k = x; k < x + w; k += t * 0.4) ctx.lineTo(k, yy + Math.sin(k * 0.7 + seed) * ph * 0.08);
      ctx.stroke();
      ctx.fillStyle = "rgba(20,10,2,.8)";
      ctx.fillRect(x + w - t * 0.03, y0, t * 0.05, ph);
      x += w;
    }
    ctx.fillStyle = "rgba(20,10,2,.75)";
    ctx.fillRect(-t, y0 + ph - t * 0.025, L + 2 * t, t * 0.05);
  }
  textured(ctx, -t, -t, L + 2 * t, 2 * t, t / 36, 0.3);
  ctx.restore();
  // Esteios: tocos quadrados mais escuros, um pouco mais largos que a parede, com pregos.
  const posts = Math.max(1, Math.round(L / (t * 6)));
  for (let i = 0; i <= posts; i++) {
    const x = (L * i) / posts;
    const post = new Path2D();
    post.roundRect(x - t * 0.32, -t * 0.62, t * 0.64, t * 1.24, t * 0.1);
    dropShadow(ctx, post, t * 0.6, "#2a1608");
    const g = ctx.createLinearGradient(0, -t * 0.6, 0, t * 0.6);
    g.addColorStop(0, "#7a4e24");
    g.addColorStop(1, "#3a2410");
    ctx.fillStyle = g;
    ctx.fill(post);
    ctx.strokeStyle = "#1a0c04";
    ctx.lineWidth = t * 0.05;
    ctx.stroke(post);
    rivet(ctx, x, -t * 0.32, t * 0.06, METALS.iron);
    rivet(ctx, x, t * 0.32, t * 0.06, METALS.iron);
  }
}

const WALL_DRAW: Record<WallStyle, (ctx: CanvasRenderingContext2D, L: number, t: number, seed: number) => void> = {
  stone: stoneWall,
  rock: rockWall,
  wood: woodWall,
};

/** Parede pronta (imagem guardada) e quanto ela passa das pontas e da linha, em unidades do mapa. */
export interface WallArt {
  canvas: HTMLCanvasElement;
  pad: number;
}

const cache = new Map<string, WallArt>();
const CACHE_MAX = 700;

/**
 * Parede de comprimento `L` e espessura `t` pronta para `drawImage` no eixo dela (de -pad a L + pad no
 * comprimento, de -pad a +pad na espessura), na resolução de `pxPerUnit` (em degraus de 2^¼, como os tokens).
 */
export function wallArt(style: WallStyle, L: number, t: number, seed: number, pxPerUnit: number): WallArt {
  const step = Math.pow(2, Math.ceil(Math.log2(Math.max(0.25, pxPerUnit)) * 4) / 4);
  const key = [style, L.toFixed(1), t.toFixed(2), seed, step].join("|");
  const hit = cache.get(key);
  if (hit) {
    cache.delete(key);
    cache.set(key, hit);
    return hit;
  }
  const pad = t * 1.6;
  const k = Math.min(step, 4096 / (L + pad * 2));
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(2, Math.ceil((L + pad * 2) * k));
  canvas.height = Math.max(2, Math.ceil(pad * 2 * k));
  const ctx = canvas.getContext("2d")!;
  ctx.scale(k, k);
  ctx.translate(pad, pad);
  WALL_DRAW[style](ctx, L, t, seed);
  const art = { canvas, pad };
  cache.set(key, art);
  if (cache.size > CACHE_MAX) cache.delete(cache.keys().next().value!);
  return art;
}

// ---------- portas ----------

/** Batente nas pontas do vão: pilar de pedra, ou esteio de madeira nas cenas de madeira. */
function jamb(ctx: CanvasRenderingContext2D, x: number, t: number, wood: boolean) {
  const p = new Path2D();
  p.roundRect(x - t * 0.34, -t * 0.82, t * 0.68, t * 1.64, t * 0.14);
  ctx.save();
  ctx.shadowColor = "rgba(0,0,0,.7)";
  ctx.shadowBlur = t * 0.5;
  ctx.shadowOffsetY = t * 0.15;
  const g = ctx.createLinearGradient(0, -t * 0.6, 0, t * 0.6);
  g.addColorStop(0, wood ? "#7a4e24" : "#b0a796");
  g.addColorStop(1, wood ? "#3a2410" : "#5d564a");
  ctx.fillStyle = g;
  ctx.fill(p);
  ctx.restore();
  ctx.strokeStyle = wood ? "#1a0c04" : "#1a1612";
  ctx.lineWidth = t * 0.05;
  ctx.stroke(p);
}

export interface DoorLook {
  open: boolean;
  /** Só o mestre vê estas marcas. */
  locked: boolean;
  secret: boolean;
  /** Escolhida pelo mestre na ferramenta Paredes. */
  selected: boolean;
  /** Para que lado a folha gira ao abrir (+1 ou -1): numa porta dupla, as duas folhas abrem para o mesmo lado. */
  swing: number;
  /** Estilo das paredes da cena (o batente acompanha). */
  style: WallStyle;
}

/** Cadeado do Tabler (IconLock, MIT), 24 × 24. */
const LOCK = [
  "M5 13a2 2 0 0 1 2 -2h10a2 2 0 0 1 2 2v6a2 2 0 0 1 -2 2h-10a2 2 0 0 1 -2 -2v-6z",
  "M11 16a1 1 0 1 0 2 0a1 1 0 0 0 -2 0",
  "M8 11v-4a4 4 0 1 1 8 0v4",
];

/**
 * Porta de madeira vista de cima, no eixo dela (dobradiça em 0, vão até L): tábuas, duas cintas de ferro com
 * rebites e uma argola, entre batentes de pedra. Aberta, a folha gira 80° na dobradiça e um arco pontilhado
 * mostra o caminho. Mestre: trancada com cadeado vermelho; secreta translúcida com contorno violeta tracejado.
 */
export function drawDoor(ctx: CanvasRenderingContext2D, L: number, t: number, seed: number, look: DoorLook) {
  const leafT = t * 1.15;
  const turn = (look.swing * 80 * Math.PI) / 180;
  if (look.open) {
    ctx.save();
    ctx.setLineDash([t * 0.25, t * 0.2]);
    ctx.strokeStyle = "rgba(236,228,212,.35)";
    ctx.lineWidth = t * 0.06;
    ctx.beginPath();
    ctx.arc(0, 0, L - t * 0.3, Math.min(0, turn), Math.max(0, turn));
    ctx.stroke();
    ctx.restore();
  }
  ctx.save();
  if (look.secret) ctx.globalAlpha = 0.55;
  if (look.open) ctx.rotate(turn);
  const leaf = new Path2D();
  leaf.roundRect(t * 0.25, -leafT / 2, L - t * 0.5, leafT, t * 0.08);
  ctx.save();
  ctx.shadowColor = "rgba(0,0,0,.7)";
  ctx.shadowBlur = t * 0.6;
  ctx.shadowOffsetY = t * 0.2;
  ctx.fillStyle = "#3a2410";
  ctx.fill(leaf);
  ctx.restore();
  ctx.save();
  ctx.clip(leaf);
  const r = rng(seed);
  const ph = leafT / 3;
  for (let i = 0; i < 3; i++) {
    const y0 = -leafT / 2 + i * ph;
    const tone = WOODS[Math.floor(r() * 3)];
    const g = ctx.createLinearGradient(0, y0, 0, y0 + ph);
    g.addColorStop(0, shade(tone, 0.2));
    g.addColorStop(1, shade(tone, -0.25));
    ctx.fillStyle = g;
    ctx.fillRect(t * 0.25, y0, L, ph);
    ctx.strokeStyle = "rgba(40,20,5,.35)";
    ctx.lineWidth = t * 0.025;
    const yy = y0 + ph * (0.35 + r() * 0.3);
    ctx.beginPath();
    ctx.moveTo(t * 0.3, yy);
    for (let x = t * 0.3; x < L; x += t * 0.4) ctx.lineTo(x, yy + Math.sin(x * 0.5 + seed) * ph * 0.08);
    ctx.stroke();
    ctx.fillStyle = "rgba(20,10,2,.75)";
    ctx.fillRect(t * 0.25, y0 + ph - t * 0.02, L, t * 0.04);
  }
  for (const f of [0.22, 0.78]) {
    const x = t * 0.25 + (L - t * 0.5) * f;
    const g = ctx.createLinearGradient(x - t * 0.13, 0, x + t * 0.13, 0);
    g.addColorStop(0, "#5a5c62");
    g.addColorStop(0.5, "#9a9ca3");
    g.addColorStop(1, "#3a3b40");
    ctx.fillStyle = g;
    ctx.fillRect(x - t * 0.13, -leafT / 2, t * 0.26, leafT);
    for (const yy of [-leafT * 0.3, 0, leafT * 0.3]) rivet(ctx, x, yy, t * 0.05, METALS.iron);
  }
  ctx.restore();
  // Argola perto da ponta solta (longe da dobradiça).
  ctx.strokeStyle = "#c9ccd1";
  ctx.lineWidth = t * 0.06;
  ctx.beginPath();
  ctx.arc(t * 0.25 + (L - t * 0.5) * 0.88, 0, t * 0.13, 0, Math.PI * 2);
  ctx.stroke();
  ctx.strokeStyle = look.selected ? "#ffffff" : look.locked ? "#c94a52" : look.secret ? "#a58fd6" : "#1a0e04";
  ctx.lineWidth = look.selected || look.locked || look.secret ? t * 0.09 : t * 0.04;
  if (look.secret) ctx.setLineDash([t * 0.3, t * 0.2]);
  ctx.stroke(leaf);
  ctx.restore();
  jamb(ctx, 0, t, look.style === "wood");
  jamb(ctx, L, t, look.style === "wood");
  if (look.locked) {
    ctx.save();
    ctx.translate(L / 2, 0);
    const s = (t * 0.9) / 24;
    ctx.scale(s, s);
    ctx.translate(-12, -12);
    ctx.fillStyle = "rgba(20,8,8,.85)";
    ctx.beginPath();
    ctx.arc(12, 13, 13, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = "#ff8a80";
    ctx.lineWidth = 2;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    for (const d of LOCK) ctx.stroke(new Path2D(d));
    ctx.restore();
  }
}
