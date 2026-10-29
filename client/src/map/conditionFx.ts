/**
 * Partículas de algumas condições em volta do token (L6), além do medalhão: bolhas no envenenado, estrelas no
 * atordoado, corações no enfeitiçado e "Z" no inconsciente. Cada desenho é função só do tempo (sem estado),
 * centrado no token e proporcional ao raio `r`; o token chama a cada quadro enquanto tiver uma delas.
 */

type Fx = (ctx: CanvasRenderingContext2D, r: number, t: number) => void;

const frac = (x: number) => x - Math.floor(x);
/** Número fixo em [0, 1) por partícula (o mesmo a cada quadro). */
const rnd = (i: number, k: number) => frac(Math.sin(i * 127.1 + k * 311.7) * 43758.5453);
/** Entra e sai suave ao longo da vida `u` (0 a 1). */
const fade = (u: number, a = 0.15, b = 0.2) => Math.min(1, u / a, (1 - u) / b);

/** Envenenado: bolhas verdes que sobem de dentro do token, balançando, e estouram num anelzinho. */
const poison: Fx = (ctx, r, t) => {
  const N = 6;
  for (let i = 0; i < N; i++) {
    const P = 1.6 + rnd(i, 1) * 0.8;
    const u = frac(t / P + i / N);
    const x = r * (-0.55 + rnd(i, 2) * 1.1) + Math.sin(u * 7 + i) * r * 0.07;
    const y = r * (0.45 - u * 1.75);
    const s = r * (0.1 + rnd(i, 3) * 0.08) * (0.7 + u * 0.6);
    if (u > 0.86) {
      // Estouro: um anel que abre e some.
      const k = (u - 0.86) / 0.14;
      ctx.globalAlpha = 0.8 * (1 - k);
      ctx.strokeStyle = "#b6f07a";
      ctx.lineWidth = r * 0.025;
      ctx.beginPath();
      ctx.arc(x, y, s * (1 + k * 1.2), 0, Math.PI * 2);
      ctx.stroke();
      continue;
    }
    ctx.globalAlpha = fade(u, 0.12, 0.05);
    const g = ctx.createRadialGradient(x - s * 0.3, y - s * 0.3, s * 0.1, x, y, s);
    g.addColorStop(0, "rgba(214,255,160,.55)");
    g.addColorStop(0.7, "rgba(110,190,60,.35)");
    g.addColorStop(1, "rgba(60,120,30,.6)");
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(x, y, s, 0, Math.PI * 2);
    ctx.fill();
    // Contorno escuro por fora e claro por dentro: a bolha aparece em qualquer retrato.
    ctx.strokeStyle = "rgba(16,40,8,.75)";
    ctx.lineWidth = r * 0.045;
    ctx.stroke();
    ctx.strokeStyle = "#c4f58a";
    ctx.lineWidth = r * 0.022;
    ctx.stroke();
    ctx.fillStyle = "rgba(255,255,255,.85)";
    ctx.beginPath();
    ctx.arc(x - s * 0.35, y - s * 0.35, s * 0.22, 0, Math.PI * 2);
    ctx.fill();
  }
};

function starPath(ctx: CanvasRenderingContext2D, x: number, y: number, rr: number, rot: number) {
  ctx.beginPath();
  for (let k = 0; k < 10; k++) {
    const a = rot + (k * Math.PI) / 5 - Math.PI / 2;
    const d = k % 2 ? rr * 0.45 : rr;
    ctx.lineTo(x + Math.cos(a) * d, y + Math.sin(a) * d);
  }
  ctx.closePath();
}

/** Atordoado: três estrelinhas girando numa órbita achatada em cima da cabeça (as de trás menores e apagadas). */
const stun: Fx = (ctx, r, t) => {
  const cy = -r;
  const rx = r * 0.58;
  const ry = r * 0.17;
  const stars = [0, 1, 2]
    .map((i) => {
      const a = t * ((2 * Math.PI) / 1.5) + (i * 2 * Math.PI) / 3;
      return { a, depth: Math.sin(a) };
    })
    .sort((p, q) => p.depth - q.depth);
  // Rastro da órbita, bem fraco.
  ctx.globalAlpha = 0.25;
  ctx.strokeStyle = "#ffe27a";
  ctx.lineWidth = r * 0.02;
  ctx.beginPath();
  ctx.ellipse(0, cy, rx, ry, 0, 0, Math.PI * 2);
  ctx.stroke();
  ctx.lineJoin = "round";
  for (const { a, depth } of stars) {
    const x = Math.cos(a) * rx;
    const y = cy + Math.sin(a) * ry;
    const k = 0.75 + depth * 0.25;
    ctx.globalAlpha = 0.55 + (0.45 * (depth + 1)) / 2;
    starPath(ctx, x, y, r * 0.2 * k, t * 4 + a);
    ctx.fillStyle = "#ffe27a";
    ctx.strokeStyle = "#7a4e0a";
    ctx.lineWidth = r * 0.03;
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = "rgba(255,255,240,.9)";
    ctx.beginPath();
    ctx.arc(x - r * 0.025, y - r * 0.03, r * 0.035 * k, 0, Math.PI * 2);
    ctx.fill();
  }
};

function heartPath(ctx: CanvasRenderingContext2D, x: number, y: number, s: number) {
  ctx.beginPath();
  ctx.moveTo(x, y + s * 0.85);
  ctx.bezierCurveTo(x - s * 1.25, y + s * 0.05, x - s * 0.75, y - s * 0.95, x, y - s * 0.35);
  ctx.bezierCurveTo(x + s * 0.75, y - s * 0.95, x + s * 1.25, y + s * 0.05, x, y + s * 0.85);
  ctx.closePath();
}

/** Enfeitiçado: corações que sobem dos lados da cabeça, balançando, crescem e somem. */
const charm: Fx = (ctx, r, t) => {
  const N = 4;
  ctx.lineJoin = "round";
  for (let i = 0; i < N; i++) {
    const u = frac(t / 2.2 + i / N);
    const side = i % 2 ? 1 : -1;
    const x = side * r * (0.35 + rnd(i, 4) * 0.35) + Math.sin(u * 5 + i * 2) * r * 0.12;
    const y = -r * (0.35 + u * 1.05);
    const s = r * (0.15 + u * 0.1);
    ctx.globalAlpha = fade(u, 0.15, 0.3);
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(Math.sin(u * 6 + i) * 0.25);
    ctx.translate(-x, -y);
    heartPath(ctx, x, y, s);
    const g = ctx.createLinearGradient(x, y - s, x, y + s);
    g.addColorStop(0, "#ff9cc0");
    g.addColorStop(1, "#d23c74");
    ctx.fillStyle = g;
    ctx.strokeStyle = "#5e1230";
    ctx.lineWidth = r * 0.028;
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = "rgba(255,255,255,.75)";
    ctx.beginPath();
    ctx.ellipse(x - s * 0.38, y - s * 0.28, s * 0.16, s * 0.1, -0.6, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }
};

/** Inconsciente: "Z" que saem do token subindo na diagonal, cada um maior que o anterior. */
const sleep: Fx = (ctx, r, t) => {
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.lineJoin = "round";
  for (let i = 0; i < 3; i++) {
    const u = frac(t / 2.4 + i / 3);
    const x = r * (0.3 + u * 0.75) + Math.sin(u * 6) * r * 0.06;
    const y = -r * (0.45 + u * 0.95);
    const s = r * (0.22 + u * 0.24);
    ctx.globalAlpha = fade(u, 0.15, 0.35);
    ctx.font = `700 ${s}px Cinzel, serif`;
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(-0.15 + u * 0.15);
    ctx.strokeStyle = "#1c2140";
    ctx.lineWidth = s * 0.22;
    ctx.strokeText("Z", 0, 0);
    ctx.fillStyle = "#e3e9ff";
    ctx.fillText("Z", 0, 0);
    ctx.restore();
  }
};

/** Condições (pelo nome da lista padrão) que têm partículas. */
const FX: Record<string, Fx> = { Envenenado: poison, Atordoado: stun, Enfeitiçado: charm, Inconsciente: sleep };

/** As condições da lista que têm partículas, sem repetir, na ordem da lista. */
export function conditionFxOf(names: string[]): string[] {
  return [...new Set(names.filter((n) => n in FX))];
}

/** Desenha as partículas dessas condições no tempo `t` (segundos), com o centro do token na origem. */
export function drawConditionFx(ctx: CanvasRenderingContext2D, names: string[], r: number, t: number) {
  for (const n of names) {
    ctx.save();
    FX[n](ctx, r, t);
    ctx.restore();
  }
}
