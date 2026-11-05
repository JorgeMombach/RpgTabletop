import type { PropKind } from "@rpg/shared";
import { METALS, rivet, shade } from "./tokenArt";
import { rng, shadowed, textured, WOODS } from "./wallKit";
import { altar, bed, bones, bridge, cart, flowers, mushrooms, sacks, shelf, statue, tent, well } from "./propArtMore";

/**
 * Objetos do cenário vistos de cima (docs/design/cenario.md, passo 2), no mesmo kit das paredes: sombra no chão,
 * luz de cima à esquerda, granulado. Cada um desenhado em volta de (0, 0), em unidades de casa (`c` = lado da
 * casa); a semente decide a variação (duas árvores nunca saem iguais, mas a mesma sai sempre igual).
 */


const ROCK = ["#8f887a", "#7d766a", "#9c9484", "#6f685c", "#a59d8e"];

export type R = () => number;

/** Tons da folhagem, do mais escuro ao mais claro (quatro faixas bem separadas, como na referência aprovada). */
export type Leaves = [string, string, string, string];
export const GREEN: Leaves = ["#1d3a22", "#2c5a2d", "#43803a", "#6aa64b"];
const OLIVE: Leaves = ["#2f3a17", "#4c5f22", "#6f862f", "#9bb246"];
const PINE: Leaves = ["#132a1a", "#1e4226", "#2d5e35", "#4a8048"];

/**
 * Folhagem (copa e arbusto) feita de blocos: cada bloco é um monte de folhinhas giradas, iluminado em cima à esquerda
 * e escuro embaixo à direita; a borda sai recortada porque as folhas da beirada passam um pouco do bloco. A cor de
 * cada folha vem da posição dela no bloco, em quatro tons. Antes, a sombra nítida no chão, deslocada.
 */
export function foliage(ctx: CanvasRenderingContext2D, r: R, radius: number, lobes: number, tones: Leaves, shadowK: number, spread = 0.5) {
  const blobs: [number, number, number][] = [];
  for (let i = 0; i < lobes; i++) {
    const a = (i / lobes) * Math.PI * 2 + r() * 0.6;
    // Um bloco no meio e os outros em volta, afastados: cada um aparece com a sua luz.
    const d = i === 0 ? radius * 0.08 : radius * (spread + r() * 0.18);
    blobs.push([Math.cos(a) * d, Math.sin(a) * d, radius * (i === 0 ? 0.46 + (0.5 - spread) : 0.34 + r() * 0.12)]);
  }
  // Sombra no chão: a silhueta inteira, nítida, deslocada para baixo e à direita (a árvore é alta).
  ctx.save();
  ctx.fillStyle = "rgba(18,8,22,.42)";
  const off = radius * 0.12 * shadowK;
  for (const [x, y, rr] of blobs) {
    ctx.beginPath();
    ctx.arc(x + off, y + off * 1.2, rr * 1.04, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
  // Blocos de baixo à direita primeiro: os de cima à esquerda (mais iluminados) ficam por cima.
  blobs.sort((p, q) => q[0] + q[1] - (p[0] + p[1]));
  const leaf = radius * 0.075;
  for (const [bx, by, br] of blobs) {
    const count = Math.round(((br * br) / (leaf * leaf)) * 1.6);
    // Primeiro um fundo escuro do bloco (fecha os buracos entre as folhas).
    ctx.fillStyle = tones[0];
    ctx.beginPath();
    ctx.arc(bx, by, br * 0.9, 0, Math.PI * 2);
    ctx.fill();
    const pts: [number, number, number][] = [];
    for (let k = 0; k < count; k++) {
      // Mais folhas no meio; as da beirada passam um pouco (borda recortada).
      const a = r() * Math.PI * 2;
      const d = Math.sqrt(r()) * br * 1.08;
      const x = bx + Math.cos(a) * d;
      const y = by + Math.sin(a) * d;
      // Luz do bloco: em cima à esquerda clara, embaixo à direita escura, borda de baixo mais escura ainda.
      const lx = (x - bx) / br;
      const ly = (y - by) / br;
      let v = 0.5 - (lx + ly) * 0.42 - Math.max(0, lx + ly) * 0.15 + (r() - 0.5) * 0.28;
      // A árvore inteira também: blocos de baixo à direita um pouco mais escuros.
      v -= ((bx + by) / radius) * 0.08;
      pts.push([x, y, Math.max(0, Math.min(3, Math.floor(v * 4)))]);
    }
    // Dos tons escuros para os claros: a luz fica por cima.
    pts.sort((p, q) => p[2] - q[2]);
    for (const [x, y, tone] of pts) {
      ctx.fillStyle = tones[tone];
      ctx.beginPath();
      ctx.ellipse(x, y, leaf * (0.8 + r() * 0.5), leaf * (0.5 + r() * 0.3), r() * Math.PI, 0, Math.PI * 2);
      ctx.fill();
    }
  }
}

/**
 * Pedra vista de cima: contorno de 7 a 11 pontas, um topo chato (o mesmo contorno, menor e puxado para a luz) e as
 * laterais entre os dois, cada uma clara ou escura conforme vira para a luz (de cima à esquerda). Granulado,
 * rachas no topo e às vezes musgo.
 */
export function rock(ctx: CanvasRenderingContext2D, r: R, cx: number, cy: number, rad: number, shadowK: number, moss: boolean) {
  const n = 7 + Math.floor(r() * 5);
  const outer: [number, number][] = [];
  const squash = 0.72 + r() * 0.25;
  const turn = r() * Math.PI;
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2 + (r() - 0.5) * 0.35;
    const d = rad * (0.82 + r() * 0.24);
    const x = Math.cos(a) * d;
    const y = Math.sin(a) * d * squash;
    outer.push([cx + x * Math.cos(turn) - y * Math.sin(turn), cy + x * Math.sin(turn) + y * Math.cos(turn)]);
  }
  // Topo: o contorno encolhido em direção a um ponto um pouco acima e à esquerda (o lado iluminado fica estreito).
  const k = 0.55 + r() * 0.12;
  const ox = cx - rad * 0.12;
  const oy = cy - rad * 0.16;
  const inner = outer.map(([x, y]): [number, number] => [ox + (x - cx) * k + (r() - 0.5) * rad * 0.06, oy + (y - cy) * k + (r() - 0.5) * rad * 0.06]);
  const poly = (pts: [number, number][]) => {
    const p = new Path2D();
    pts.forEach(([x, y], i) => (i ? p.lineTo(x, y) : p.moveTo(x, y)));
    p.closePath();
    return p;
  };
  const outline = poly(outer);
  const topFace = poly(inner);
  const tone = ROCK[Math.floor(r() * ROCK.length)];
  shadowed(ctx, rad, shadowK, () => {
    ctx.fillStyle = shade(tone, -0.65);
    ctx.fill(outline);
  });
  for (let i = 0; i < n; i++) {
    const j = (i + 1) % n;
    const mx = (outer[i][0] + outer[j][0]) / 2 - cx;
    const my = (outer[i][1] + outer[j][1]) / 2 - cy;
    const len = Math.hypot(mx, my) || 1;
    const lit = (-(mx / len) * 0.7 - (my / len) * 0.7 + 1) / 2;
    const side = poly([outer[i], outer[j], inner[j], inner[i]]);
    ctx.fillStyle = shade(tone, -0.55 + lit * 0.6);
    ctx.fill(side);
    ctx.strokeStyle = ctx.fillStyle;
    ctx.lineWidth = rad * 0.015;
    ctx.stroke(side);
  }
  const g = ctx.createLinearGradient(ox - rad * 0.5, oy - rad * 0.5, ox + rad * 0.5, oy + rad * 0.5);
  g.addColorStop(0, shade(tone, 0.3));
  g.addColorStop(1, shade(tone, 0.02));
  ctx.fillStyle = g;
  ctx.fill(topFace);
  ctx.save();
  ctx.clip(outline);
  textured(ctx, cx - rad * 1.3, cy - rad * 1.3, rad * 2.6, rad * 2.6, rad / 50, 0.55);
  ctx.restore();
  ctx.save();
  ctx.clip(topFace);
  ctx.strokeStyle = "rgba(25,20,15,.4)";
  ctx.lineWidth = rad * 0.035;
  if (r() < 0.6) {
    ctx.beginPath();
    ctx.moveTo(inner[0][0], inner[0][1]);
    ctx.lineTo(ox + (r() - 0.5) * rad * 0.3, oy + (r() - 0.5) * rad * 0.3);
    ctx.lineTo(inner[Math.floor(n / 2)][0], inner[Math.floor(n / 2)][1]);
    ctx.stroke();
  }
  if (moss) {
    for (let m = 0; m < 16; m++) {
      ctx.fillStyle = r() < 0.5 ? "rgba(95,130,55,.6)" : "rgba(70,100,40,.55)";
      ctx.beginPath();
      ctx.arc(ox + (r() - 0.5) * rad * 0.9, oy + (r() - 0.5) * rad * 0.7, rad * (0.05 + r() * 0.09), 0, Math.PI * 2);
      ctx.fill();
    }
  }
  ctx.restore();
  ctx.strokeStyle = "rgba(255,245,225,.3)";
  ctx.lineWidth = rad * 0.03;
  ctx.stroke(topFace);
  ctx.strokeStyle = "#1a1612";
  ctx.lineWidth = rad * 0.05;
  ctx.lineJoin = "round";
  ctx.stroke(outline);
}

/** Tábua vista de cima (comprimento `w` no eixo x), com veio, nós e pontas escuras. */
export function plank(ctx: CanvasRenderingContext2D, r: R, w: number, h: number, tone: string, shadowK: number) {
  const p = new Path2D();
  p.roundRect(-w / 2, -h / 2, w, h, h * 0.12);
  shadowed(ctx, h * 2, shadowK, () => {
    ctx.fillStyle = "#2a1608";
    ctx.fill(p);
  });
  const g = ctx.createLinearGradient(0, -h / 2, 0, h / 2);
  g.addColorStop(0, shade(tone, 0.22));
  g.addColorStop(1, shade(tone, -0.32));
  ctx.fillStyle = g;
  ctx.fill(p);
  ctx.save();
  ctx.clip(p);
  ctx.strokeStyle = "rgba(40,20,5,.35)";
  ctx.lineWidth = h * 0.06;
  for (let k = 0; k < 2; k++) {
    const yy = -h / 2 + h * (0.25 + k * 0.4 + r() * 0.15);
    ctx.beginPath();
    ctx.moveTo(-w / 2, yy);
    for (let x = -w / 2; x < w / 2; x += h * 0.6) ctx.lineTo(x, yy + Math.sin(x / h + k * 3) * h * 0.08);
    ctx.stroke();
  }
  if (r() < 0.6) {
    ctx.fillStyle = "rgba(50,25,8,.55)";
    ctx.beginPath();
    ctx.ellipse((r() - 0.5) * w * 0.6, (r() - 0.5) * h * 0.3, h * 0.13, h * 0.08, 0, 0, Math.PI * 2);
    ctx.fill();
  }
  textured(ctx, -w / 2, -h / 2, w, h, h / 30, 0.3);
  ctx.restore();
  ctx.strokeStyle = "#1a0c04";
  ctx.lineWidth = h * 0.07;
  ctx.stroke(p);
}

/** Corte de tronco visto de cima: casca, miolo claro, anéis e rachas. */
function woodEnd(ctx: CanvasRenderingContext2D, r: R, cx: number, cy: number, rad: number) {
  ctx.fillStyle = "#3a2412";
  ctx.beginPath();
  ctx.arc(cx, cy, rad, 0, Math.PI * 2);
  ctx.fill();
  const g = ctx.createRadialGradient(cx - rad * 0.2, cy - rad * 0.2, rad * 0.1, cx, cy, rad * 0.8);
  g.addColorStop(0, "#d2a46c");
  g.addColorStop(1, "#9a6c3a");
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.arc(cx, cy, rad * 0.78, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = "rgba(90,52,20,.55)";
  ctx.lineWidth = rad * 0.05;
  for (const k of [0.22, 0.42, 0.62]) {
    ctx.beginPath();
    ctx.arc(cx + (r() - 0.5) * rad * 0.05, cy, rad * k, 0, Math.PI * 2);
    ctx.stroke();
  }
  ctx.strokeStyle = "rgba(50,25,8,.6)";
  ctx.lineWidth = rad * 0.06;
  const a = r() * Math.PI * 2;
  ctx.beginPath();
  ctx.moveTo(cx, cy);
  ctx.lineTo(cx + Math.cos(a) * rad * 0.75, cy + Math.sin(a) * rad * 0.75);
  ctx.stroke();
  ctx.strokeStyle = "#1a0c04";
  ctx.lineWidth = rad * 0.07;
  ctx.beginPath();
  ctx.arc(cx, cy, rad, 0, Math.PI * 2);
  ctx.stroke();
}

/** Caixote: tábuas, moldura e a diagonal, pregos nos cantos. `s` = lado. */
function crateBox(ctx: CanvasRenderingContext2D, r: R, s: number, shadowK: number) {
  const p = new Path2D();
  p.roundRect(-s / 2, -s / 2, s, s, s * 0.05);
  shadowed(ctx, s * 0.6, shadowK, () => {
    ctx.fillStyle = "#2a1608";
    ctx.fill(p);
  });
  const tone = WOODS[Math.floor(r() * WOODS.length)];
  ctx.save();
  ctx.clip(p);
  const n = 4;
  for (let i = 0; i < n; i++) {
    const y0 = -s / 2 + (i * s) / n;
    const g = ctx.createLinearGradient(0, y0, 0, y0 + s / n);
    g.addColorStop(0, shade(tone, 0.25 - i * 0.04));
    g.addColorStop(1, shade(tone, -0.2 - i * 0.04));
    ctx.fillStyle = g;
    ctx.fillRect(-s / 2, y0, s, s / n);
    ctx.fillStyle = "rgba(20,10,2,.6)";
    ctx.fillRect(-s / 2, y0 + s / n - s * 0.012, s, s * 0.024);
  }
  textured(ctx, -s / 2, -s / 2, s, s, s / 40, 0.35);
  ctx.restore();
  // Moldura e a diagonal (tábuas mais escuras por cima).
  const frame = s * 0.13;
  ctx.fillStyle = shade(tone, -0.25);
  ctx.strokeStyle = "#1a0c04";
  ctx.lineWidth = s * 0.025;
  for (const [x, y, w, h] of [
    [-s / 2, -s / 2, s, frame],
    [-s / 2, s / 2 - frame, s, frame],
    [-s / 2, -s / 2, frame, s],
    [s / 2 - frame, -s / 2, frame, s],
  ] as const) {
    ctx.fillRect(x, y, w, h);
    ctx.strokeRect(x, y, w, h);
  }
  ctx.save();
  ctx.rotate(r() < 0.5 ? Math.PI / 4 : -Math.PI / 4);
  ctx.fillRect(-s * 0.62, -frame / 2, s * 1.24, frame);
  ctx.strokeRect(-s * 0.62, -frame / 2, s * 1.24, frame);
  ctx.restore();
  for (const [x, y] of [
    [-1, -1],
    [1, -1],
    [-1, 1],
    [1, 1],
  ])
    rivet(ctx, (x * (s - frame)) / 2, (y * (s - frame)) / 2, s * 0.03, METALS.iron);
  ctx.strokeStyle = "#1a0c04";
  ctx.lineWidth = s * 0.03;
  ctx.stroke(p);
}

// ---------- cada objeto ----------

function tree(ctx: CanvasRenderingContext2D, c: number, seed: number) {
  const r = rng(seed);
  // Às vezes uma árvore de folha mais amarelada ou mais escura (pinheiro-escuro), para a floresta não ficar chapada.
  const pick = r();
  const tones = pick < 0.15 ? OLIVE : pick < 0.32 ? PINE : GREEN;
  foliage(ctx, r, c * (0.95 + r() * 0.25), 5 + Math.floor(r() * 3), tones, 2.2);
}

function bush(ctx: CanvasRenderingContext2D, c: number, seed: number) {
  const r = rng(seed);
  // Arbusto: blocos mais juntos (redondinho e cheio).
  foliage(ctx, r, c * (0.42 + r() * 0.1), 4 + Math.floor(r() * 2), GREEN, 1, 0.3);
  // Às vezes frutinhas ou flores.
  if (r() < 0.4) {
    const col = r() < 0.5 ? "#c94a52" : "#e8d47a";
    for (let k = 0; k < 6; k++) {
      ctx.fillStyle = col;
      ctx.beginPath();
      ctx.arc((r() - 0.5) * c * 0.5, (r() - 0.5) * c * 0.5, c * 0.025, 0, Math.PI * 2);
      ctx.fill();
    }
  }
}

function boulder(ctx: CanvasRenderingContext2D, c: number, seed: number) {
  const r = rng(seed);
  rock(ctx, r, 0, 0, c * (0.5 + r() * 0.12), 1.6, r() < 0.45);
}

function stones(ctx: CanvasRenderingContext2D, c: number, seed: number) {
  const r = rng(seed);
  const n = 3 + Math.floor(r() * 4);
  for (let k = 0; k < n; k++) rock(ctx, r, (r() - 0.5) * c * 0.65, (r() - 0.5) * c * 0.65, c * (0.08 + r() * 0.1), 0.6, false);
}

function log(ctx: CanvasRenderingContext2D, c: number, seed: number) {
  const r = rng(seed);
  const len = c * (1.6 + r() * 0.5);
  const rad = c * (0.2 + r() * 0.06);
  const body = new Path2D();
  body.roundRect(-len / 2, -rad, len, rad * 2, rad * 0.9);
  shadowed(ctx, rad * 2, 1.2, () => {
    ctx.fillStyle = "#2a1608";
    ctx.fill(body);
  });
  const g = ctx.createLinearGradient(0, -rad, 0, rad);
  g.addColorStop(0, "#7a5532");
  g.addColorStop(0.45, "#5a3a1e");
  g.addColorStop(1, "#2e1d0e");
  ctx.fillStyle = g;
  ctx.fill(body);
  ctx.save();
  ctx.clip(body);
  // Casca: riscos no comprimento.
  ctx.strokeStyle = "rgba(20,10,3,.5)";
  ctx.lineWidth = rad * 0.08;
  for (let k = 0; k < 9; k++) {
    const y = -rad + r() * rad * 2;
    const x = -len / 2 + r() * len * 0.7;
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(x + len * (0.15 + r() * 0.25), y + (r() - 0.5) * rad * 0.3);
    ctx.stroke();
  }
  if (r() < 0.5) {
    for (let k = 0; k < 10; k++) {
      ctx.fillStyle = "rgba(95,130,55,.5)";
      ctx.beginPath();
      ctx.arc(-len / 2 + r() * len, -rad * 0.6 + r() * rad * 0.5, rad * (0.1 + r() * 0.15), 0, Math.PI * 2);
      ctx.fill();
    }
  }
  textured(ctx, -len / 2, -rad, len, rad * 2, rad / 20, 0.4);
  ctx.restore();
  ctx.strokeStyle = "#1a0c04";
  ctx.lineWidth = rad * 0.08;
  ctx.stroke(body);
  woodEnd(ctx, r, len / 2 - rad * 0.55, 0, rad * 0.92);
  // Galho quebrado saindo de lado.
  if (r() < 0.6) {
    const x = (r() - 0.3) * len * 0.5;
    const side = r() < 0.5 ? -1 : 1;
    ctx.strokeStyle = "#3e2712";
    ctx.lineWidth = rad * 0.35;
    ctx.lineCap = "round";
    ctx.beginPath();
    ctx.moveTo(x, side * rad * 0.7);
    ctx.lineTo(x + rad * 0.6, side * rad * 1.7);
    ctx.stroke();
    ctx.lineCap = "butt";
  }
}

function stump(ctx: CanvasRenderingContext2D, c: number, seed: number) {
  const r = rng(seed);
  const rad = c * (0.24 + r() * 0.06);
  // Raízes saindo por baixo.
  ctx.strokeStyle = "#3e2712";
  ctx.lineCap = "round";
  const roots = 3 + Math.floor(r() * 3);
  shadowed(ctx, rad, 0.8, () => {
    for (let k = 0; k < roots; k++) {
      const a = (k / roots) * Math.PI * 2 + r() * 0.6;
      ctx.lineWidth = rad * (0.22 + r() * 0.12);
      ctx.beginPath();
      ctx.moveTo(Math.cos(a) * rad * 0.7, Math.sin(a) * rad * 0.7);
      ctx.quadraticCurveTo(Math.cos(a + 0.2) * rad * 1.3, Math.sin(a + 0.2) * rad * 1.3, Math.cos(a + 0.35) * rad * (1.6 + r() * 0.4), Math.sin(a + 0.35) * rad * (1.6 + r() * 0.4));
      ctx.stroke();
    }
  });
  ctx.lineCap = "butt";
  shadowed(ctx, rad * 2, 1.2, () => {
    ctx.fillStyle = "#2a1608";
    ctx.beginPath();
    ctx.arc(0, 0, rad, 0, Math.PI * 2);
    ctx.fill();
  });
  woodEnd(ctx, r, 0, 0, rad);
}

function rubble(ctx: CanvasRenderingContext2D, c: number, seed: number) {
  const r = rng(seed);
  // Poeira no chão, depois cacos de pedra e de tijolo.
  for (let k = 0; k < 5; k++) {
    const x = (r() - 0.5) * c * 0.5;
    const y = (r() - 0.5) * c * 0.5;
    const rr = c * (0.15 + r() * 0.15);
    const g = ctx.createRadialGradient(x, y, 0, x, y, rr);
    g.addColorStop(0, "rgba(120,110,95,.22)");
    g.addColorStop(1, "rgba(120,110,95,0)");
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(x, y, rr, 0, Math.PI * 2);
    ctx.fill();
  }
  const n = 7 + Math.floor(r() * 6);
  for (let k = 0; k < n; k++) {
    const x = (r() - 0.5) * c * 0.8;
    const y = (r() - 0.5) * c * 0.8;
    if (r() < 0.35) {
      ctx.save();
      ctx.translate(x, y);
      ctx.rotate(r() * Math.PI);
      const w = c * (0.12 + r() * 0.08);
      const p = new Path2D();
      p.rect(-w / 2, -w / 4, w, w / 2);
      shadowed(ctx, w, 0.6, () => {
        ctx.fillStyle = shade("#9a4a32", -0.2 + r() * 0.3);
        ctx.fill(p);
      });
      ctx.strokeStyle = "#2a1a12";
      ctx.lineWidth = w * 0.08;
      ctx.stroke(p);
      ctx.restore();
    } else rock(ctx, r, x, y, c * (0.05 + r() * 0.09), 0.6, false);
  }
}

function barrel(ctx: CanvasRenderingContext2D, c: number, seed: number) {
  const r = rng(seed);
  const rad = c * (0.3 + r() * 0.04);
  shadowed(ctx, rad * 2, 1.3, () => {
    ctx.fillStyle = "#2a1608";
    ctx.beginPath();
    ctx.arc(0, 0, rad, 0, Math.PI * 2);
    ctx.fill();
  });
  // Aduelas: fatias em volta, cada uma num tom.
  const n = 12;
  for (let k = 0; k < n; k++) {
    const a1 = (k / n) * Math.PI * 2;
    const a2 = ((k + 1) / n) * Math.PI * 2;
    ctx.fillStyle = shade(WOODS[Math.floor(r() * WOODS.length)], -0.1 + r() * 0.15);
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.arc(0, 0, rad, a1, a2);
    ctx.closePath();
    ctx.fill();
  }
  // Tampa: tábuas atravessadas, dentro do aro.
  ctx.save();
  ctx.beginPath();
  ctx.arc(0, 0, rad * 0.78, 0, Math.PI * 2);
  ctx.clip();
  const tone = WOODS[Math.floor(r() * WOODS.length)];
  for (let k = -2; k <= 2; k++) {
    const g = ctx.createLinearGradient(0, k * rad * 0.32 - rad * 0.16, 0, k * rad * 0.32 + rad * 0.16);
    g.addColorStop(0, shade(tone, 0.28));
    g.addColorStop(1, shade(tone, -0.15));
    ctx.fillStyle = g;
    ctx.fillRect(-rad, k * rad * 0.32 - rad * 0.16, rad * 2, rad * 0.32);
    ctx.fillStyle = "rgba(20,10,2,.55)";
    ctx.fillRect(-rad, k * rad * 0.32 + rad * 0.15, rad * 2, rad * 0.025);
  }
  textured(ctx, -rad, -rad, rad * 2, rad * 2, rad / 20, 0.35);
  ctx.restore();
  // Aros de ferro.
  for (const k of [0.8, 0.99]) {
    ctx.strokeStyle = "#3a3b40";
    ctx.lineWidth = rad * 0.09;
    ctx.beginPath();
    ctx.arc(0, 0, rad * k - rad * 0.045, 0, Math.PI * 2);
    ctx.stroke();
  }
  ctx.strokeStyle = "rgba(200,204,210,.45)";
  ctx.lineWidth = rad * 0.025;
  ctx.beginPath();
  ctx.arc(0, 0, rad * 0.8 - rad * 0.06, Math.PI * 1.05, Math.PI * 1.6);
  ctx.stroke();
  if (r() < 0.6) rivet(ctx, rad * 0.35, rad * 0.2, rad * 0.07, METALS.bronze);
}

function crate(ctx: CanvasRenderingContext2D, c: number, seed: number) {
  const r = rng(seed);
  ctx.rotate((r() - 0.5) * 0.25);
  crateBox(ctx, r, c * (0.68 + r() * 0.08), 1.3);
}

function crates(ctx: CanvasRenderingContext2D, c: number, seed: number) {
  const r = rng(seed);
  const s = c * 0.62;
  // Dois ou três no chão e um em cima (o de cima com sombra maior: está mais alto).
  const base = 2 + Math.floor(r() * 2);
  const spots: [number, number][] = [
    [-s * 0.52, s * 0.3],
    [s * 0.52, s * 0.3],
    [0, -s * 0.55],
  ];
  for (let k = 0; k < base; k++) {
    ctx.save();
    ctx.translate(spots[k][0] + (r() - 0.5) * s * 0.1, spots[k][1] + (r() - 0.5) * s * 0.1);
    ctx.rotate((r() - 0.5) * 0.3);
    crateBox(ctx, r, s, 1.2);
    ctx.restore();
  }
  ctx.save();
  ctx.translate((r() - 0.5) * s * 0.3, (r() - 0.5) * s * 0.2);
  ctx.rotate((r() - 0.5) * 0.5);
  crateBox(ctx, r, s * 0.92, 2.4);
  ctx.restore();
}

function planks(ctx: CanvasRenderingContext2D, c: number, seed: number) {
  const r = rng(seed);
  const n = 3 + Math.floor(r() * 3);
  const w = c * (1.15 + r() * 0.3);
  const h = c * 0.15;
  for (let k = 0; k < n; k++) {
    ctx.save();
    ctx.translate((r() - 0.5) * c * 0.15, (k - n / 2) * h * 0.85 + (r() - 0.5) * h * 0.4);
    ctx.rotate((r() - 0.5) * 0.25);
    plank(ctx, r, w * (0.85 + r() * 0.2), h, WOODS[Math.floor(r() * WOODS.length)], 0.8 + k * 0.2);
    ctx.restore();
  }
}

function table(ctx: CanvasRenderingContext2D, c: number, seed: number) {
  const r = rng(seed);
  const w = c * (1.2 + r() * 0.3);
  const h = c * (0.72 + r() * 0.12);
  const top = new Path2D();
  top.roundRect(-w / 2, -h / 2, w, h, c * 0.05);
  shadowed(ctx, c * 0.5, 1.8, () => {
    ctx.fillStyle = "#2a1608";
    ctx.fill(top);
  });
  ctx.save();
  ctx.clip(top);
  const n = 4;
  const tone = WOODS[Math.floor(r() * WOODS.length)];
  for (let i = 0; i < n; i++) {
    const y0 = -h / 2 + (i * h) / n;
    const g = ctx.createLinearGradient(0, y0, 0, y0 + h / n);
    g.addColorStop(0, shade(tone, 0.25));
    g.addColorStop(1, shade(tone, -0.18));
    ctx.fillStyle = g;
    ctx.fillRect(-w / 2, y0, w, h / n);
    ctx.fillStyle = "rgba(20,10,2,.5)";
    ctx.fillRect(-w / 2, y0 + h / n - c * 0.008, w, c * 0.016);
  }
  textured(ctx, -w / 2, -h / 2, w, h, c / 60, 0.3);
  ctx.restore();
  ctx.strokeStyle = "#1a0c04";
  ctx.lineWidth = c * 0.03;
  ctx.stroke(top);
  // Às vezes, coisas em cima: caneca, prato, vela.
  const items = Math.floor(r() * 3);
  for (let k = 0; k < items; k++) {
    const x = (r() - 0.5) * w * 0.6;
    const y = (r() - 0.5) * h * 0.5;
    const kind = r();
    if (kind < 0.4) {
      ctx.fillStyle = "#c9ccd1";
      ctx.beginPath();
      ctx.arc(x, y, c * 0.14, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = "#9a9ca3";
      ctx.beginPath();
      ctx.arc(x, y, c * 0.095, 0, Math.PI * 2);
      ctx.fill();
    } else if (kind < 0.75) {
      ctx.fillStyle = "#6e4520";
      ctx.beginPath();
      ctx.arc(x, y, c * 0.08, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = "#3a2410";
      ctx.beginPath();
      ctx.arc(x, y, c * 0.055, 0, Math.PI * 2);
      ctx.fill();
    } else {
      ctx.fillStyle = "#efe6cf";
      ctx.beginPath();
      ctx.arc(x, y, c * 0.045, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = "rgba(255,200,90,.55)";
      ctx.beginPath();
      ctx.arc(x, y, c * 0.11, 0, Math.PI * 2);
      ctx.fill();
    }
  }
}

function pillar(ctx: CanvasRenderingContext2D, c: number, seed: number) {
  const r = rng(seed);
  const rad = c * (0.36 + r() * 0.05);
  // Base quadrada, depois o fuste redondo com caneluras, visto de cima.
  const base = new Path2D();
  base.roundRect(-rad * 1.15, -rad * 1.15, rad * 2.3, rad * 2.3, rad * 0.12);
  shadowed(ctx, rad * 2, 2.2, () => {
    ctx.fillStyle = "#2a2622";
    ctx.fill(base);
  });
  const bg = ctx.createLinearGradient(0, -rad * 1.15, 0, rad * 1.15);
  bg.addColorStop(0, "#a59d8e");
  bg.addColorStop(1, "#5d564a");
  ctx.fillStyle = bg;
  ctx.fill(base);
  ctx.save();
  ctx.clip(base);
  textured(ctx, -rad * 1.2, -rad * 1.2, rad * 2.4, rad * 2.4, rad / 30, 0.55);
  ctx.restore();
  ctx.strokeStyle = "#1a1612";
  ctx.lineWidth = rad * 0.06;
  ctx.stroke(base);
  const g = ctx.createRadialGradient(-rad * 0.35, -rad * 0.4, rad * 0.1, 0, 0, rad);
  g.addColorStop(0, "#d2c9b6");
  g.addColorStop(0.7, "#958c7b");
  g.addColorStop(1, "#5d564a");
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.arc(0, 0, rad, 0, Math.PI * 2);
  ctx.fill();
  ctx.save();
  ctx.beginPath();
  ctx.arc(0, 0, rad, 0, Math.PI * 2);
  ctx.clip();
  textured(ctx, -rad, -rad, rad * 2, rad * 2, rad / 30, 0.5);
  ctx.restore();
  // Anéis do capitel: um sulco escuro com a borda de cima clara, e o topo liso.
  for (const k of [0.78, 0.55]) {
    ctx.strokeStyle = "rgba(30,26,20,.45)";
    ctx.lineWidth = rad * 0.07;
    ctx.beginPath();
    ctx.arc(0, 0, rad * k, 0, Math.PI * 2);
    ctx.stroke();
    ctx.strokeStyle = "rgba(255,245,225,.3)";
    ctx.lineWidth = rad * 0.03;
    ctx.beginPath();
    ctx.arc(-rad * 0.02, -rad * 0.03, rad * k - rad * 0.05, Math.PI * 0.9, Math.PI * 1.7);
    ctx.stroke();
  }
  // Às vezes rachado.
  if (r() < 0.35) {
    ctx.strokeStyle = "rgba(20,16,12,.7)";
    ctx.lineWidth = rad * 0.05;
    const a = r() * Math.PI * 2;
    ctx.beginPath();
    ctx.moveTo(Math.cos(a) * rad, Math.sin(a) * rad);
    ctx.lineTo(Math.cos(a) * rad * 0.4 + (r() - 0.5) * rad * 0.3, Math.sin(a) * rad * 0.4);
    ctx.lineTo((r() - 0.5) * rad * 0.2, (r() - 0.5) * rad * 0.2);
    ctx.stroke();
  }
  ctx.strokeStyle = "#1a1612";
  ctx.lineWidth = rad * 0.06;
  ctx.beginPath();
  ctx.arc(0, 0, rad, 0, Math.PI * 2);
  ctx.stroke();
}

const DRAW: Record<PropKind, (ctx: CanvasRenderingContext2D, c: number, seed: number) => void> = {
  tree,
  bush,
  boulder,
  stones,
  log,
  stump,
  rubble,
  barrel,
  crate,
  crates,
  planks,
  table,
  pillar,
  statue,
  bones,
  altar,
  tent,
  cart,
  well,
  shelf,
  bed,
  sacks,
  mushrooms,
  flowers,
  bridge,
};

/** Desenha o objeto em volta de (0, 0); `c` = lado da casa já com o tamanho do objeto. */
export function drawProp(ctx: CanvasRenderingContext2D, kind: PropKind, c: number, seed: number) {
  ctx.save();
  DRAW[kind](ctx, c, seed);
  ctx.restore();
}

/** Até onde o desenho vai a partir do centro, em casas (no tamanho 1), com a sombra: o tamanho da imagem guardada. */
export const PROP_EXTENT: Record<PropKind, number> = {
  tree: 1.65,
  bush: 0.75,
  boulder: 0.95,
  stones: 0.75,
  log: 1.45,
  stump: 0.85,
  rubble: 0.8,
  barrel: 0.6,
  crate: 0.75,
  crates: 1.1,
  planks: 1.0,
  table: 1.05,
  pillar: 0.85,
  statue: 1.55,
  bones: 0.75,
  altar: 1.0,
  tent: 1.45,
  cart: 1.4,
  well: 0.85,
  shelf: 1.0,
  bed: 1.05,
  sacks: 0.75,
  mushrooms: 0.55,
  flowers: 0.55,
  bridge: 1.7,
};

const cache = new Map<string, HTMLCanvasElement>();
const CACHE_MAX = 600;

/**
 * Objeto pronto (imagem guardada), para `drawImage` centrado: `pxPerCell` é quantos pixels de tela vale uma casa
 * do objeto (já com tamanho, zoom e densidade da tela), em degraus de 2^¼ para não refazer a cada zoom.
 */
export function propImage(kind: PropKind, seed: number, pxPerCell: number): HTMLCanvasElement {
  const step = Math.min(512, Math.pow(2, Math.ceil(Math.log2(Math.max(8, pxPerCell)) * 4) / 4));
  const key = `${kind}|${seed}|${step}`;
  const hit = cache.get(key);
  if (hit) {
    cache.delete(key);
    cache.set(key, hit);
    return hit;
  }
  const side = Math.ceil(PROP_EXTENT[kind] * 2 * step);
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = side;
  const ctx = canvas.getContext("2d")!;
  ctx.translate(side / 2, side / 2);
  drawProp(ctx, kind, step, seed);
  cache.set(key, canvas);
  if (cache.size > CACHE_MAX) cache.delete(cache.keys().next().value!);
  return canvas;
}
