import type { MapTorchStyle } from "@rpg/shared";

/**
 * Desenho das tochas fixas no mapa, aprovado em protótipo: fincada, de ferro e braseiro. `(x, y)` é a base,
 * o ponto do mapa onde a tocha está; `s` é a altura de referência. Mesma chama em camadas do selo da tocha.
 */

type Ctx = CanvasRenderingContext2D;

/** Tremulação suave e diferente para cada tocha (soma de senos com a fase da tocha). */
export function flicker(t: number, seed: number): number {
  return Math.sin(t * 7.3 + seed) * 0.5 + Math.sin(t * 13.1 + seed * 2.7) * 0.3 + Math.sin(t * 23.7 + seed * 5.1) * 0.2;
}

function flame(ctx: Ctx, x: number, y: number, h: number, w: number, lean: number) {
  const layers: [number, string][] = [
    [1, "#e2551f"],
    [0.72, "#f59a2c"],
    [0.42, "#fff1b8"],
  ];
  for (const [k, color] of layers) {
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.bezierCurveTo(x - w * k, y - h * k * 0.05, x - w * k * 0.9, y - h * k * 0.55, x + lean * k, y - h * k);
    ctx.bezierCurveTo(x + w * k * 0.9, y - h * k * 0.55, x + w * k, y - h * k * 0.05, x, y);
    ctx.closePath();
    ctx.fillStyle = color;
    ctx.fill();
  }
}

function halo(ctx: Ctx, x: number, y: number, r: number, a: number) {
  const g = ctx.createRadialGradient(x, y, 0, x, y, r);
  g.addColorStop(0, `rgba(255,190,100,${a})`);
  g.addColorStop(1, "rgba(255,120,40,0)");
  ctx.save();
  ctx.globalCompositeOperation = "lighter";
  ctx.fillStyle = g;
  ctx.fillRect(x - r, y - r, r * 2, r * 2);
  ctx.restore();
}

function sparks(ctx: Ctx, x: number, y: number, s: number, t: number, seed: number) {
  for (let i = 0; i < 5; i++) {
    const p = (t * (0.55 + i * 0.09) + seed + i * 0.37) % 1;
    ctx.fillStyle = `rgba(255,${190 - p * 80},90,${(1 - p) * 0.95})`;
    ctx.beginPath();
    ctx.arc(x + Math.sin(p * 9 + i * 2 + seed) * s * 0.14, y - p * s * 0.75, s * 0.022 * (1 - p * 0.5), 0, Math.PI * 2);
    ctx.fill();
  }
}

function shadow(ctx: Ctx, x: number, y: number, s: number) {
  const g = ctx.createRadialGradient(x, y, 0, x, y, s * 0.32);
  g.addColorStop(0, "rgba(0,0,0,.55)");
  g.addColorStop(1, "rgba(0,0,0,0)");
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(1, 0.4);
  ctx.translate(-x, -y);
  ctx.fillStyle = g;
  ctx.fillRect(x - s, y - s, s * 2, s * 2);
  ctx.restore();
}

/** Cabo de madeira inclinado, cabeça enrolada em pano. */
function stick(ctx: Ctx, x: number, y: number, s: number, t: number, seed: number) {
  const f = flicker(t, seed);
  const tilt = 0.14;
  const L = s * 0.62;
  const w = s * 0.075;
  shadow(ctx, x, y, s);
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(tilt);
  const g = ctx.createLinearGradient(-w, 0, w, 0);
  g.addColorStop(0, "#3c2412");
  g.addColorStop(0.45, "#8a5a2c");
  g.addColorStop(1, "#2c190b");
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.moveTo(-w * 0.55, 0);
  ctx.lineTo(w * 0.55, 0);
  ctx.lineTo(w, -L);
  ctx.lineTo(-w, -L);
  ctx.closePath();
  ctx.fill();
  ctx.strokeStyle = "rgba(30,16,6,.7)";
  ctx.lineWidth = s * 0.008;
  ctx.beginPath();
  ctx.moveTo(-w * 0.15, -L * 0.1);
  ctx.lineTo(-w * 0.3, -L * 0.8);
  ctx.moveTo(w * 0.25, -L * 0.25);
  ctx.lineTo(w * 0.35, -L * 0.7);
  ctx.stroke();
  const hw = w * 1.65;
  const hh = s * 0.17;
  const cy = -L - hh * 0.2;
  ctx.fillStyle = "#4a3320";
  ctx.beginPath();
  ctx.ellipse(0, cy, hw, hh * 0.72, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = "#7c5a34";
  ctx.lineWidth = s * 0.017;
  for (let i = -1; i <= 2; i++) {
    ctx.beginPath();
    ctx.moveTo(-hw * 0.95, cy + i * hh * 0.3 + hh * 0.1);
    ctx.quadraticCurveTo(0, cy + i * hh * 0.3 + hh * 0.34, hw * 0.95, cy + i * hh * 0.3 - hh * 0.1);
    ctx.stroke();
  }
  ctx.restore();
  const hx = x + Math.sin(tilt) * (L + s * 0.06);
  const hy = y - Math.cos(tilt) * (L + s * 0.06);
  halo(ctx, hx, hy - s * 0.12, s * 0.42, 0.55);
  flame(ctx, hx, hy, s * 0.42 * (1 + f * 0.09), s * 0.145, f * s * 0.035);
  sparks(ctx, hx, hy - s * 0.2, s, t, seed);
}

/** Cabo escuro com anéis de bronze e um cesto de ferro com brasas. */
function iron(ctx: Ctx, x: number, y: number, s: number, t: number, seed: number) {
  const f = flicker(t, seed);
  const L = s * 0.56;
  const w = s * 0.05;
  shadow(ctx, x, y, s);
  const g = ctx.createLinearGradient(x - w, 0, x + w, 0);
  g.addColorStop(0, "#15121a");
  g.addColorStop(0.45, "#55505e");
  g.addColorStop(1, "#110e15");
  ctx.fillStyle = g;
  ctx.fillRect(x - w, y - L, w * 2, L);
  for (const k of [0.18, 0.62]) {
    const b = ctx.createLinearGradient(x - w * 1.5, 0, x + w * 1.5, 0);
    b.addColorStop(0, "#6e5331");
    b.addColorStop(0.45, "#e6c88e");
    b.addColorStop(1, "#6e5331");
    ctx.fillStyle = b;
    ctx.fillRect(x - w * 1.5, y - L * k - s * 0.018, w * 3, s * 0.036);
  }
  const top = y - L;
  const cw = s * 0.15;
  const ch = s * 0.17;
  const em = ctx.createRadialGradient(x, top - ch * 0.5, 0, x, top - ch * 0.5, cw);
  em.addColorStop(0, "#ffd27a");
  em.addColorStop(0.55, "#e2551f");
  em.addColorStop(1, "#5a1c0a");
  ctx.fillStyle = em;
  ctx.beginPath();
  ctx.moveTo(x - cw * 0.5, top);
  ctx.lineTo(x + cw * 0.5, top);
  ctx.lineTo(x + cw * 0.92, top - ch);
  ctx.lineTo(x - cw * 0.92, top - ch);
  ctx.closePath();
  ctx.fill();
  ctx.lineCap = "round";
  ctx.strokeStyle = "#1c1820";
  ctx.lineWidth = s * 0.024;
  for (const k of [-1, -0.34, 0.34, 1]) {
    ctx.beginPath();
    ctx.moveTo(x + k * cw * 0.5, top);
    ctx.lineTo(x + k * cw, top - ch);
    ctx.stroke();
  }
  ctx.strokeStyle = "#3a3540";
  ctx.lineWidth = s * 0.03;
  ctx.beginPath();
  ctx.moveTo(x - cw, top - ch);
  ctx.lineTo(x + cw, top - ch);
  ctx.stroke();
  halo(ctx, x, top - ch - s * 0.1, s * 0.42, 0.55);
  flame(ctx, x, top - ch * 0.75, s * 0.42 * (1 + f * 0.09), s * 0.135, f * s * 0.035);
  sparks(ctx, x, top - ch - s * 0.1, s, t, seed);
}

/** Tigela de ferro com brasas, vista de cima como o mapa. */
function brazier(ctx: Ctx, x: number, y: number, s: number, t: number, seed: number) {
  const f = flicker(t, seed);
  const r = s * 0.3;
  const cy = y - s * 0.3;
  const full = Math.PI * 2;
  ctx.fillStyle = "rgba(0,0,0,.45)";
  ctx.beginPath();
  ctx.arc(x + s * 0.02, cy + s * 0.04, r * 1.12, 0, full);
  ctx.fill();
  ctx.fillStyle = "#26222c";
  for (let i = 0; i < 3; i++) {
    const a = -Math.PI / 2 + (i * full) / 3 + Math.PI / 3;
    ctx.beginPath();
    ctx.arc(x + Math.cos(a) * r * 1.02, cy + Math.sin(a) * r * 1.02, r * 0.16, 0, full);
    ctx.fill();
  }
  const rim = ctx.createLinearGradient(x - r, cy - r, x + r, cy + r);
  rim.addColorStop(0, "#d8b47a");
  rim.addColorStop(0.5, "#6e5331");
  rim.addColorStop(1, "#a9844f");
  ctx.fillStyle = rim;
  ctx.beginPath();
  ctx.arc(x, cy, r, 0, full);
  ctx.fill();
  ctx.fillStyle = "#1d1a22";
  ctx.beginPath();
  ctx.arc(x, cy, r * 0.87, 0, full);
  ctx.fill();
  const em = ctx.createRadialGradient(x, cy, 0, x, cy, r * 0.8);
  em.addColorStop(0, "#fff0b0");
  em.addColorStop(0.35, "#ff9a30");
  em.addColorStop(0.75, "#b5350f");
  em.addColorStop(1, "#3c120a");
  ctx.fillStyle = em;
  ctx.beginPath();
  ctx.arc(x, cy, r * 0.79, 0, full);
  ctx.fill();
  ctx.fillStyle = "rgba(30,14,10,.8)";
  for (let i = 0; i < 9; i++) {
    const a = i * 2.4 + seed;
    const d = r * (0.28 + (i % 4) * 0.13);
    ctx.beginPath();
    ctx.ellipse(x + Math.cos(a) * d, cy + Math.sin(a) * d, r * 0.1, r * 0.07, a, 0, full);
    ctx.fill();
  }
  halo(ctx, x, cy - s * 0.08, s * 0.5, 0.5 + f * 0.06);
  flame(ctx, x, cy + r * 0.12, s * 0.48 * (1 + f * 0.09), s * 0.17, f * s * 0.04);
  sparks(ctx, x, cy - s * 0.15, s, t, seed);
}

const DRAW: Record<MapTorchStyle, typeof stick> = { stick, iron, brazier };

export function drawMapTorch(ctx: Ctx, style: MapTorchStyle, x: number, y: number, s: number, t: number, seed: number) {
  DRAW[style](ctx, x, y, s, t, seed);
}
