import { METALS, rivet, shade } from "./tokenArt";
import { rng, shadowed, textured, WOODS } from "./wallKit";

/**
 * Desenhos de parede e portão do cenário (docs/design/cenario.md, protótipo aprovado em 2026-11-03), no mesmo kit
 * do `wallArt.ts`. Cada um no próprio eixo, de (0, 0) até (L, 0), espessura `t`; `cell` (lado da casa) dá o
 * passo dos esteios. Tijolo, paliçada e muralha bloqueiam a visão; os outros deixam ver.
 */

/** Madeira com luz de cima: tábua, esteio ou tronco cortado de lado. */
function woodFill(ctx: CanvasRenderingContext2D, y0: number, h: number, tone: string) {
  const g = ctx.createLinearGradient(0, y0, 0, y0 + h);
  g.addColorStop(0, shade(tone, 0.22));
  g.addColorStop(1, shade(tone, -0.35));
  ctx.fillStyle = g;
}

const BRICKS = ["#9a4a32", "#8a3f2a", "#a5553a", "#7d3a26", "#93492f"];
const FIELD = ["#8f887a", "#7d766a", "#9c9484", "#6f685c", "#a59d8e"];
const LEAVES = ["#3f6b32", "#4a7a38", "#355c2a", "#55863f"];

/** Esteio quadrado de madeira, visto de cima, com um prego (cercas, arame). */
function post(ctx: CanvasRenderingContext2D, x: number, s: number, tone = "#6e4520") {
  const p = new Path2D();
  p.roundRect(x - s / 2, -s / 2, s, s, s * 0.18);
  shadowed(ctx, s, 1.2, () => {
    ctx.fillStyle = shade(tone, -0.4);
    ctx.fill(p);
  });
  const g = ctx.createRadialGradient(x - s * 0.15, -s * 0.15, s * 0.05, x, 0, s * 0.7);
  g.addColorStop(0, shade(tone, 0.25));
  g.addColorStop(1, shade(tone, -0.35));
  ctx.fillStyle = g;
  ctx.fill(p);
  // Anéis do topo cortado.
  ctx.strokeStyle = "rgba(30,15,4,.45)";
  ctx.lineWidth = s * 0.06;
  ctx.beginPath();
  ctx.arc(x, 0, s * 0.22, 0, Math.PI * 2);
  ctx.stroke();
  ctx.strokeStyle = "#1a0c04";
  ctx.lineWidth = s * 0.08;
  ctx.stroke(p);
}

// ---------- paredes que bloqueiam a visão ----------

/** Tijolo: três fiadas de tijolos desencontrados (aparelho comum), argamassa clara, tons de barro. */
export function brickWall(ctx: CanvasRenderingContext2D, L: number, t: number, seed: number) {
  const r = rng(seed);
  const base = new Path2D();
  base.rect(-t * 0.1, -t / 2, L + t * 0.2, t);
  shadowed(ctx, t, 1, () => {
    ctx.fillStyle = "#b9ab94";
    ctx.fill(base);
  });
  ctx.save();
  ctx.clip(base);
  ctx.fillStyle = "#b9ab94";
  ctx.fill(base);
  const rows = 3;
  const h = t / rows;
  const w = h * 2.1;
  const gap = t * 0.05;
  for (let row = 0; row < rows; row++) {
    const y0 = -t / 2 + row * h;
    for (let x = -t * 0.1 - (row % 2 ? w / 2 : 0); x < L + t * 0.2; x += w) {
      const tone = BRICKS[Math.floor(r() * BRICKS.length)];
      const brick = new Path2D();
      brick.roundRect(x + gap / 2, y0 + gap / 2, w - gap, h - gap, h * 0.12);
      woodFill(ctx, y0, h, tone);
      ctx.fill(brick);
      ctx.fillStyle = "rgba(255,230,200,.18)";
      ctx.fillRect(x + gap, y0 + gap * 0.7, w - gap * 2, h * 0.14);
    }
  }
  textured(ctx, -t, -t, L + 2 * t, 2 * t, t / 40, 0.5);
  ctx.restore();
  ctx.strokeStyle = "#2a1a12";
  ctx.lineWidth = t * 0.05;
  ctx.stroke(base);
}

/** Paliçada: troncos em pé vistos de cima, lado a lado: casca, anéis e a ponta afiada a machado. */
export function palisadeWall(ctx: CanvasRenderingContext2D, L: number, t: number, seed: number) {
  const r = rng(seed);
  const d = t * 1.25;
  const n = Math.max(2, Math.round((L + d * 0.6) / (d * 0.86)));
  const step = (L + d * 0.4) / n;
  const logs: [number, number, number][] = [];
  for (let i = 0; i <= n; i++) logs.push([-d * 0.2 + i * step + (r() - 0.5) * d * 0.08, (r() - 0.5) * t * 0.12, (d / 2) * (0.85 + r() * 0.25)]);
  for (const [x, y, rr] of logs) {
    shadowed(ctx, t, 1.3, () => {
      ctx.fillStyle = "#2a1608";
      ctx.beginPath();
      ctx.arc(x, y, rr, 0, Math.PI * 2);
      ctx.fill();
    });
  }
  for (const [x, y, rr] of logs) {
    // Casca escura, miolo claro com anéis e a ponta afiada (um X de cortes no topo).
    ctx.fillStyle = "#33200e";
    ctx.beginPath();
    ctx.arc(x, y, rr, 0, Math.PI * 2);
    ctx.fill();
    const tone = WOODS[Math.floor(r() * WOODS.length)];
    const g = ctx.createRadialGradient(x - rr * 0.3, y - rr * 0.3, rr * 0.1, x, y, rr * 0.8);
    g.addColorStop(0, shade(tone, 0.3));
    g.addColorStop(1, shade(tone, -0.2));
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(x, y, rr * 0.7, 0, Math.PI * 2);
    ctx.fill();
    ctx.save();
    ctx.clip();
    textured(ctx, x - rr, y - rr, rr * 2, rr * 2, t / 40, 0.5);
    ctx.restore();
    ctx.strokeStyle = "rgba(70,40,15,.55)";
    ctx.lineWidth = t * 0.035;
    for (const k of [0.32, 0.55]) {
      ctx.beginPath();
      ctx.arc(x, y, rr * k, 0, Math.PI * 2);
      ctx.stroke();
    }
    // Ponta afiada a machado: facetas do miolo até o centro, a de cima à esquerda mais clara (luz).
    const facets = 5 + Math.floor(r() * 2);
    const a0 = r() * Math.PI;
    for (let k = 0; k < facets; k++) {
      const a1 = a0 + (k * Math.PI * 2) / facets;
      const a2 = a0 + ((k + 1) * Math.PI * 2) / facets;
      const mid = (a1 + a2) / 2;
      const lit = (Math.cos(mid - (Math.PI * 5) / 4) + 1) / 2;
      ctx.fillStyle = `rgba(${lit > 0.5 ? "255,235,200" : "30,15,4"},${Math.abs(lit - 0.5) * 0.5})`;
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.arc(x, y, rr * 0.7, a1, a2);
      ctx.closePath();
      ctx.fill();
    }
    ctx.strokeStyle = "rgba(40,22,8,.55)";
    ctx.lineWidth = t * 0.03;
    for (let k = 0; k < facets; k++) {
      const a1 = a0 + (k * Math.PI * 2) / facets;
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.lineTo(x + Math.cos(a1) * rr * 0.7, y + Math.sin(a1) * rr * 0.7);
      ctx.stroke();
    }
    ctx.strokeStyle = "#1a0c04";
    ctx.lineWidth = t * 0.06;
    ctx.beginPath();
    ctx.arc(x, y, rr, 0, Math.PI * 2);
    ctx.stroke();
  }
}

/** Muralha: passadiço de pedra larga com ameias (blocos salientes) na borda de fora. */
export function rampartWall(ctx: CanvasRenderingContext2D, L: number, t: number, seed: number) {
  const r = rng(seed);
  const T = t * 1.8;
  const body = new Path2D();
  body.rect(-t * 0.2, -T / 2, L + t * 0.4, T);
  shadowed(ctx, t, 1.6, () => {
    ctx.fillStyle = "#3a352e";
    ctx.fill(body);
  });
  ctx.save();
  ctx.clip(body);
  // Lajes do passadiço.
  const g = ctx.createLinearGradient(0, -T / 2, 0, T / 2);
  g.addColorStop(0, "#9c9484");
  g.addColorStop(1, "#6f685c");
  ctx.fillStyle = g;
  ctx.fillRect(-t, -T, L + 2 * t, 2 * T);
  ctx.strokeStyle = "rgba(30,26,20,.5)";
  ctx.lineWidth = t * 0.04;
  for (let x = -t * 0.2 + r() * T; x < L + t; x += T * (0.7 + r() * 0.5)) {
    ctx.beginPath();
    ctx.moveTo(x, -T / 2);
    ctx.lineTo(x, T / 2);
    ctx.stroke();
  }
  ctx.beginPath();
  ctx.moveTo(-t, 0);
  ctx.lineTo(L + t, 0);
  ctx.stroke();
  textured(ctx, -t, -T, L + 2 * t, 2 * T, t / 30, 0.55);
  ctx.restore();
  ctx.strokeStyle = "#1a1612";
  ctx.lineWidth = t * 0.06;
  ctx.stroke(body);
  // Ameias: blocos altos (mais claros, com sombra) alternando com vãos.
  const mw = T * 0.55;
  for (let x = -t * 0.1; x + mw <= L + t * 0.3; x += mw * 2) {
    const m = new Path2D();
    m.roundRect(x, -T / 2 - t * 0.12, mw, T * 0.36, t * 0.06);
    shadowed(ctx, t, 1.4, () => {
      ctx.fillStyle = "#2a2622";
      ctx.fill(m);
    });
    const mg = ctx.createLinearGradient(0, -T / 2, 0, -T / 2 + T * 0.36);
    mg.addColorStop(0, "#aea591");
    mg.addColorStop(1, "#6f685c");
    ctx.fillStyle = mg;
    ctx.fill(m);
    ctx.save();
    ctx.clip(m);
    textured(ctx, x, -T / 2 - t * 0.12, mw, T * 0.36, t / 30, 0.55);
    ctx.restore();
    ctx.strokeStyle = "#1a1612";
    ctx.lineWidth = t * 0.05;
    ctx.stroke(m);
  }
}

// ---------- paredes que deixam ver ----------

/** Cerca de madeira: esteios a cada casa e duas réguas pregadas entre eles (dá para ver entre as réguas). */
export function fenceWall(ctx: CanvasRenderingContext2D, L: number, t: number, seed: number, cell: number) {
  const r = rng(seed);
  const rail = t * 0.32;
  for (const y of [-t * 0.3, t * 0.3]) {
    const p = new Path2D();
    p.roundRect(-t * 0.1, y - rail / 2, L + t * 0.2, rail, rail * 0.3);
    shadowed(ctx, t, 0.7, () => {
      ctx.fillStyle = "#2a1608";
      ctx.fill(p);
    });
    woodFill(ctx, y - rail / 2, rail, WOODS[Math.floor(r() * WOODS.length)]);
    ctx.fill(p);
    ctx.strokeStyle = "#1a0c04";
    ctx.lineWidth = t * 0.04;
    ctx.stroke(p);
  }
  const posts = Math.max(1, Math.round(L / cell));
  for (let i = 0; i <= posts; i++) post(ctx, (L * i) / posts, t * 0.95);
}

/** Grade de ferro: travessa fina e as barras em pé (vistas de cima, pontos com brilho), colunas nas pontas. */
export function ironFenceWall(ctx: CanvasRenderingContext2D, L: number, t: number, _seed: number, cell: number) {
  const iron = METALS.iron;
  ctx.save();
  ctx.shadowColor = "rgba(0,0,0,.6)";
  ctx.shadowBlur = t * 0.5;
  ctx.shadowOffsetY = t * 0.2;
  ctx.strokeStyle = "#2b2d33";
  ctx.lineWidth = t * 0.22;
  ctx.lineCap = "round";
  ctx.beginPath();
  ctx.moveTo(0, 0);
  ctx.lineTo(L, 0);
  ctx.stroke();
  ctx.restore();
  ctx.strokeStyle = "#6c6f76";
  ctx.lineWidth = t * 0.07;
  ctx.beginPath();
  ctx.moveTo(0, -t * 0.04);
  ctx.lineTo(L, -t * 0.04);
  ctx.stroke();
  const bars = Math.max(3, Math.round(L / (t * 1.4)));
  for (let i = 1; i < bars; i++) rivet(ctx, (L * i) / bars, 0, t * 0.2, iron);
  // Colunas de ferro (com uma bola em cima) a cada casa.
  const cols = Math.max(1, Math.round(L / cell));
  for (let i = 0; i <= cols; i++) {
    const x = (L * i) / cols;
    const p = new Path2D();
    p.roundRect(x - t * 0.4, -t * 0.4, t * 0.8, t * 0.8, t * 0.12);
    shadowed(ctx, t, 1.2, () => {
      ctx.fillStyle = "#1c1d21";
      ctx.fill(p);
    });
    const g = ctx.createLinearGradient(0, -t * 0.4, 0, t * 0.4);
    g.addColorStop(0, "#8a8d94");
    g.addColorStop(1, "#2b2d33");
    ctx.fillStyle = g;
    ctx.fill(p);
    ctx.strokeStyle = "#111114";
    ctx.lineWidth = t * 0.05;
    ctx.stroke(p);
    rivet(ctx, x, 0, t * 0.24, iron);
  }
}

/** Arame farpado: estacas finas e três fios ondulados entre elas, com farpas (pequenos X) pelo caminho. */
export function barbedWall(ctx: CanvasRenderingContext2D, L: number, t: number, seed: number, cell: number) {
  const r = rng(seed);
  for (const [k, dy] of [
    [0, -t * 0.32],
    [1, 0],
    [2, t * 0.32],
  ] as const) {
    const amp = t * 0.08;
    const ph = r() * Math.PI * 2;
    const path = new Path2D();
    path.moveTo(0, dy);
    for (let x = 0; x <= L; x += t * 0.25) path.lineTo(x, dy + Math.sin(x / (t * 0.6) + ph) * amp);
    ctx.save();
    ctx.shadowColor = "rgba(0,0,0,.55)";
    ctx.shadowBlur = t * 0.3;
    ctx.shadowOffsetY = t * 0.15;
    ctx.strokeStyle = "#3a3c42";
    ctx.lineWidth = t * 0.09;
    ctx.stroke(path);
    ctx.restore();
    ctx.strokeStyle = k === 1 ? "#a7aab1" : "#8f939b";
    ctx.lineWidth = t * 0.045;
    ctx.stroke(path);
    // Farpas.
    ctx.strokeStyle = "#c9ccd1";
    ctx.lineWidth = t * 0.04;
    for (let x = t * 0.4 + r() * t * 0.4; x < L - t * 0.2; x += t * (0.9 + r() * 0.4)) {
      const y = dy + Math.sin(x / (t * 0.6) + ph) * amp;
      const s = t * 0.13;
      ctx.beginPath();
      ctx.moveTo(x - s, y - s);
      ctx.lineTo(x + s, y + s);
      ctx.moveTo(x + s, y - s);
      ctx.lineTo(x - s, y + s);
      ctx.stroke();
    }
  }
  const posts = Math.max(1, Math.round(L / cell));
  for (let i = 0; i <= posts; i++) post(ctx, (L * i) / posts, t * 0.7, "#5a3a1c");
}

/**
 * Sebe: folhagem em camadas, sem contorno de "bola". Primeiro a mancha escura (com a sombra no chão), depois
 * tufos médios em vários verdes puxados para cima e à esquerda (luz) e, por fim, pontinhos claros de folha.
 */
export function hedgeWall(ctx: CanvasRenderingContext2D, L: number, t: number, seed: number) {
  const r = rng(seed);
  const R = t * 0.9;
  const tufts: [number, number, number][] = [];
  for (let x = -R * 0.3; x < L + R * 0.3; x += R * (0.32 + r() * 0.18)) tufts.push([x, (r() - 0.5) * t * 0.7, R * (0.5 + r() * 0.35)]);
  // Mancha de base: escura, com a sombra.
  const base = new Path2D();
  for (const [x, y, rr] of tufts) {
    base.moveTo(x + rr, y);
    base.arc(x, y, rr, 0, Math.PI * 2);
  }
  shadowed(ctx, t, 1.3, () => {
    ctx.fillStyle = "#1e3318";
    ctx.fill(base);
  });
  ctx.save();
  ctx.clip(base);
  // Tufos médios: mais claros quanto mais para cima e à esquerda (luz), sem borda.
  for (let k = 0; k < tufts.length * 4; k++) {
    const [x, y, rr] = tufts[Math.floor(r() * tufts.length)];
    const a = r() * Math.PI * 2;
    const d = r() * rr * 0.7;
    const cx = x + Math.cos(a) * d;
    const cy = y + Math.sin(a) * d;
    const lit = Math.max(0, Math.min(1, 0.5 - (cy - y) / (rr * 2) - (cx - x) / (rr * 4)));
    ctx.fillStyle = shade(LEAVES[Math.floor(r() * LEAVES.length)], -0.35 + lit * 0.5);
    ctx.beginPath();
    ctx.arc(cx, cy, rr * (0.28 + r() * 0.2), 0, Math.PI * 2);
    ctx.fill();
  }
  // Pontinhos de folha (claros por cima, escuros entre os tufos).
  for (let k = 0; k < tufts.length * 10; k++) {
    const [x, y, rr] = tufts[Math.floor(r() * tufts.length)];
    const a = r() * Math.PI * 2;
    const d = r() * rr;
    ctx.fillStyle = r() < 0.55 ? "rgba(170,205,120,.5)" : "rgba(15,30,10,.45)";
    ctx.beginPath();
    ctx.arc(x + Math.cos(a) * d, y + Math.sin(a) * d, rr * (0.06 + r() * 0.07), 0, Math.PI * 2);
    ctx.fill();
  }
  textured(ctx, -t, -t * 2, L + 2 * t, t * 4, t / 40, 0.35);
  ctx.restore();
}

/** Muro baixo de pedra solta: pedras arredondadas de tamanhos diferentes numa fileira, sombra curta. */
export function lowStoneWall(ctx: CanvasRenderingContext2D, L: number, t: number, seed: number) {
  const r = rng(seed);
  const stones: { x: number; y: number; rx: number; ry: number; a: number; tone: string }[] = [];
  for (let x = -t * 0.1; x < L + t * 0.1; ) {
    const rx = t * (0.38 + r() * 0.3);
    stones.push({ x: x + rx, y: (r() - 0.5) * t * 0.4, rx, ry: t * (0.32 + r() * 0.22), a: (r() - 0.5) * 0.6, tone: FIELD[Math.floor(r() * FIELD.length)] });
    x += rx * (1.55 + r() * 0.3);
  }
  for (const s of stones) {
    shadowed(ctx, t, 0.7, () => {
      ctx.fillStyle = "#2a2622";
      ctx.beginPath();
      ctx.ellipse(s.x, s.y, s.rx, s.ry, s.a, 0, Math.PI * 2);
      ctx.fill();
    });
  }
  for (const s of stones) {
    const p = new Path2D();
    p.ellipse(s.x, s.y, s.rx, s.ry, s.a, 0, Math.PI * 2);
    const g = ctx.createRadialGradient(s.x - s.rx * 0.35, s.y - s.ry * 0.45, s.rx * 0.1, s.x, s.y, s.rx * 1.1);
    g.addColorStop(0, shade(s.tone, 0.25));
    g.addColorStop(1, shade(s.tone, -0.4));
    ctx.fillStyle = g;
    ctx.fill(p);
    ctx.save();
    ctx.clip(p);
    textured(ctx, s.x - s.rx, s.y - s.ry, s.rx * 2, s.ry * 2, t / 30, 0.5);
    ctx.restore();
    ctx.strokeStyle = "#1a1612";
    ctx.lineWidth = t * 0.05;
    ctx.stroke(p);
  }
}

// ---------- portões (folha no eixo: dobradiça em 0, vão até L) ----------

/** Portão de cerca: moldura de tábuas com a tábua em diagonal (o "Z"), fino, dá para ver através. */
export function fenceGate(ctx: CanvasRenderingContext2D, L: number, t: number, seed: number) {
  const r = rng(seed);
  const w = t * 0.36;
  const x0 = t * 0.4;
  const x1 = L - t * 0.4;
  const pieces: [number, number, number, number][] = [
    [x0, -t * 0.3, x1, -t * 0.3],
    [x0, t * 0.3, x1, t * 0.3],
    [x0, t * 0.3, x1, -t * 0.3],
  ];
  for (const [ax, ay, bx, by] of pieces) {
    const len = Math.hypot(bx - ax, by - ay);
    ctx.save();
    ctx.translate(ax, ay);
    ctx.rotate(Math.atan2(by - ay, bx - ax));
    const p = new Path2D();
    p.roundRect(0, -w / 2, len, w, w * 0.25);
    shadowed(ctx, t, 0.7, () => {
      ctx.fillStyle = "#2a1608";
      ctx.fill(p);
    });
    woodFill(ctx, -w / 2, w, WOODS[Math.floor(r() * WOODS.length)]);
    ctx.fill(p);
    ctx.strokeStyle = "#1a0c04";
    ctx.lineWidth = t * 0.04;
    ctx.stroke(p);
    ctx.restore();
  }
  rivet(ctx, x1 - t * 0.2, 0, t * 0.1, METALS.iron);
}

/** Portão de ferro: moldura e barras de ferro, com um ferrolho; mais pesado que a grade. */
export function ironGate(ctx: CanvasRenderingContext2D, L: number, t: number) {
  const x0 = t * 0.4;
  const x1 = L - t * 0.4;
  const frame = new Path2D();
  frame.roundRect(x0, -t * 0.32, x1 - x0, t * 0.64, t * 0.1);
  ctx.save();
  ctx.shadowColor = "rgba(0,0,0,.6)";
  ctx.shadowBlur = t * 0.5;
  ctx.shadowOffsetY = t * 0.2;
  ctx.strokeStyle = "#2b2d33";
  ctx.lineWidth = t * 0.2;
  ctx.stroke(frame);
  ctx.restore();
  ctx.strokeStyle = "#7d8088";
  ctx.lineWidth = t * 0.07;
  ctx.stroke(frame);
  const bars = Math.max(3, Math.round((x1 - x0) / (t * 1.1)));
  for (let i = 1; i < bars; i++) rivet(ctx, x0 + ((x1 - x0) * i) / bars, 0, t * 0.17, METALS.iron);
  ctx.fillStyle = "#3a3b40";
  ctx.fillRect(x1 - t * 0.5, -t * 0.12, t * 0.35, t * 0.24);
}

/** Pilar de pedra ou esteio de madeira nas pontas do portão (a cerca usa o esteio dela). */
export function gatePost(ctx: CanvasRenderingContext2D, x: number, t: number, kind: "wood" | "iron") {
  if (kind === "wood") return post(ctx, x, t * 1.1);
  const p = new Path2D();
  p.roundRect(x - t * 0.45, -t * 0.45, t * 0.9, t * 0.9, t * 0.12);
  shadowed(ctx, t, 1.2, () => {
    ctx.fillStyle = "#1c1d21";
    ctx.fill(p);
  });
  const g = ctx.createLinearGradient(0, -t * 0.45, 0, t * 0.45);
  g.addColorStop(0, "#8a8d94");
  g.addColorStop(1, "#2b2d33");
  ctx.fillStyle = g;
  ctx.fill(p);
  ctx.strokeStyle = "#111114";
  ctx.lineWidth = t * 0.05;
  ctx.stroke(p);
  rivet(ctx, x, 0, t * 0.26, METALS.iron);
}
