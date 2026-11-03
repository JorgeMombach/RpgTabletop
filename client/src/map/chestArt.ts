import type { ChestStyle } from "@rpg/shared";

/**
 * Desenho dos baús no mapa (Fase 6), aprovado em protótipo: arca de madeira, baú de ferro e arca ornamentada.
 * Vista de frente, levemente de cima, como as tochas fixas. (x, y) = centro da base; s = tamanho da casa.
 */
type Ctx = CanvasRenderingContext2D;
export type ChestState = "closed" | "locked" | "open" | "empty" | "hidden";

interface Look {
  wood: [string, string, string];
  metal: [string, string, string];
  lid: "dome" | "flat";
  rivets?: boolean;
  gem?: string;
}

const LOOKS: Record<ChestStyle, Look> = {
  wood: { wood: ["#7a4e2a", "#5a3519", "#3d2410"], metal: ["#e3c48e", "#a9844f", "#6e5331"], lid: "dome" },
  iron: { wood: ["#4a3b30", "#352a22", "#221a14"], metal: ["#b8b4ad", "#7d7a74", "#4a4844"], lid: "flat", rivets: true },
  ornate: { wood: ["#4a2a3a", "#341c29", "#20111a"], metal: ["#f0d48a", "#c9a24c", "#7a5a22"], lid: "dome", gem: "#5bc0e6" },
};

function grad(ctx: Ctx, x0: number, y0: number, x1: number, y1: number, stops: string[]) {
  const g = ctx.createLinearGradient(x0, y0, x1, y1);
  stops.forEach((c, i) => g.addColorStop(i / (stops.length - 1), c));
  return g;
}

/** Ouro do baú aberto: posições fixas (o desenho não muda a cada quadro). */
const GOLD: [number, number, number][] = [
  [-0.18, 0, 0.06],
  [-0.05, -0.03, 0.065],
  [0.09, -0.01, 0.06],
  [0.2, 0.01, 0.05],
  [0.02, 0.02, 0.05],
];

export function drawChest(ctx: Ctx, style: ChestStyle, x: number, y: number, s: number, state: ChestState) {
  const st = LOOKS[style];
  const W = s * 0.78;
  const H = s * 0.42;
  const L = s * 0.24;
  const x0 = x - W / 2;
  const yb = y;
  const yt = y - H;
  const m = st.metal;
  const w = st.wood;
  const open = state === "open" || state === "empty";
  ctx.save();
  if (state === "hidden") ctx.globalAlpha = 0.42;
  // Sombra no chão.
  ctx.fillStyle = "rgba(0,0,0,.45)";
  ctx.beginPath();
  ctx.ellipse(x, yb + s * 0.02, W * 0.58, s * 0.07, 0, 0, Math.PI * 2);
  ctx.fill();
  if (open) {
    // Tampa aberta, atrás e inclinada para trás, com as cintas.
    ctx.fillStyle = grad(ctx, 0, yt - L * 1.9, 0, yt, [w[2], w[1]]);
    ctx.beginPath();
    ctx.moveTo(x0 + W * 0.04, yt - L * 0.2);
    ctx.lineTo(x0 + W * 0.1, yt - L * 1.75);
    ctx.lineTo(x0 + W * 0.9, yt - L * 1.75);
    ctx.lineTo(x0 + W * 0.96, yt - L * 0.2);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = m[2];
    ctx.lineWidth = s * 0.02;
    ctx.stroke();
    ctx.strokeStyle = grad(ctx, 0, yt - L * 1.75, 0, yt, [m[0], m[1]]);
    ctx.lineWidth = s * 0.05;
    for (const f of [0.22, 0.78]) {
      ctx.beginPath();
      ctx.moveTo(x0 + W * f, yt - L * 1.72);
      ctx.lineTo(x0 + W * f, yt - L * 0.22);
      ctx.stroke();
    }
    // Boca do baú.
    ctx.fillStyle = "#0e0a08";
    ctx.beginPath();
    ctx.ellipse(x, yt + s * 0.005, W * 0.46, s * 0.075, 0, 0, Math.PI * 2);
    ctx.fill();
    if (state === "open") {
      const glow = ctx.createRadialGradient(x, yt - s * 0.02, 0, x, yt - s * 0.02, W * 0.6);
      glow.addColorStop(0, "rgba(255,214,120,.55)");
      glow.addColorStop(1, "rgba(255,214,120,0)");
      ctx.fillStyle = glow;
      ctx.beginPath();
      ctx.ellipse(x, yt - s * 0.04, W * 0.62, s * 0.2, 0, 0, Math.PI * 2);
      ctx.fill();
      for (const [dx, dy, r] of GOLD) {
        ctx.fillStyle = grad(ctx, 0, yt + dy * s - r * s, 0, yt + dy * s + r * s, ["#fff1b8", "#e0a83a", "#8a5a12"]);
        ctx.beginPath();
        ctx.ellipse(x + dx * s, yt + dy * s, r * s, r * s * 0.55, 0, 0, Math.PI * 2);
        ctx.fill();
      }
    }
  }
  // Corpo, com as tábuas.
  ctx.fillStyle = grad(ctx, 0, yt, 0, yb, [w[0], w[1], w[2]]);
  ctx.fillRect(x0, yt, W, H);
  ctx.strokeStyle = "rgba(0,0,0,.35)";
  ctx.lineWidth = Math.max(1, s * 0.012);
  for (const f of [0.33, 0.66]) {
    ctx.beginPath();
    ctx.moveTo(x0, yt + H * f);
    ctx.lineTo(x0 + W, yt + H * f);
    ctx.stroke();
  }
  if (!open) {
    // Tampa fechada: abaulada ou reta, com as cintas.
    ctx.fillStyle = grad(ctx, 0, yt - L, 0, yt, [w[0], w[1]]);
    ctx.beginPath();
    if (st.lid === "dome") {
      ctx.moveTo(x0, yt);
      ctx.bezierCurveTo(x0, yt - L * 1.25, x0 + W, yt - L * 1.25, x0 + W, yt);
    } else {
      ctx.moveTo(x0, yt);
      ctx.lineTo(x0 + W * 0.04, yt - L * 0.85);
      ctx.lineTo(x0 + W * 0.96, yt - L * 0.85);
      ctx.lineTo(x0 + W, yt);
    }
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = "rgba(0,0,0,.4)";
    ctx.lineWidth = s * 0.015;
    ctx.stroke();
    ctx.strokeStyle = grad(ctx, 0, yt - L, 0, yt, [m[0], m[1]]);
    ctx.lineWidth = s * 0.05;
    for (const f of [0.22, 0.78]) {
      const top = st.lid === "dome" ? yt - L * 0.9 + Math.abs(f - 0.5) * L * 0.5 : yt - L * 0.85;
      ctx.beginPath();
      ctx.moveTo(x0 + W * f, yt);
      ctx.lineTo(x0 + W * f, top);
      ctx.stroke();
    }
  }
  // Borda de metal entre tampa e corpo, cintas do corpo e cantoneiras.
  ctx.fillStyle = grad(ctx, 0, yt - s * 0.02, 0, yt + s * 0.03, [m[0], m[2]]);
  ctx.fillRect(x0 - s * 0.01, yt - s * 0.015, W + s * 0.02, s * 0.045);
  ctx.fillStyle = grad(ctx, 0, yt, 0, yb, [m[0], m[1], m[2]]);
  for (const f of [0.22, 0.78]) ctx.fillRect(x0 + W * f - s * 0.025, yt, s * 0.05, H);
  for (const cx of [x0, x0 + W]) {
    const dir = cx === x0 ? 1 : -1;
    ctx.beginPath();
    ctx.moveTo(cx, yb);
    ctx.lineTo(cx + dir * s * 0.11, yb);
    ctx.lineTo(cx, yb - s * 0.11);
    ctx.closePath();
    ctx.fill();
  }
  ctx.strokeStyle = m[2];
  ctx.lineWidth = s * 0.018;
  ctx.strokeRect(x0, yt, W, H);
  if (st.rivets) {
    ctx.fillStyle = m[0];
    for (const f of [0.22, 0.78])
      for (const g of [0.25, 0.75]) {
        ctx.beginPath();
        ctx.arc(x0 + W * f, yt + H * g, s * 0.012, 0, Math.PI * 2);
        ctx.fill();
      }
  }
  if (st.gem) {
    // Filigrana dourada.
    ctx.strokeStyle = "rgba(240,212,138,.55)";
    ctx.lineWidth = s * 0.01;
    for (const side of [-1, 1]) {
      ctx.beginPath();
      ctx.moveTo(x + side * W * 0.08, yt + H * 0.5);
      ctx.bezierCurveTo(x + side * W * 0.2, yt + H * 0.15, x + side * W * 0.3, yt + H * 0.85, x + side * W * 0.42, yt + H * 0.5);
      ctx.stroke();
    }
  }
  // Fecho (com a pedra, na ornamentada).
  const ly = yt + H * 0.36;
  ctx.fillStyle = grad(ctx, 0, ly - s * 0.05, 0, ly + s * 0.06, [m[0], m[2]]);
  ctx.beginPath();
  ctx.roundRect(x - s * 0.055, ly - s * 0.045, s * 0.11, s * 0.1, s * 0.02);
  ctx.fill();
  if (st.gem) {
    ctx.fillStyle = st.gem;
    ctx.beginPath();
    ctx.arc(x, ly + s * 0.005, s * 0.025, 0, Math.PI * 2);
    ctx.fill();
  } else {
    ctx.fillStyle = "#1a120a";
    ctx.beginPath();
    ctx.arc(x, ly - s * 0.005, s * 0.012, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillRect(x - s * 0.006, ly, s * 0.012, s * 0.03);
  }
  ctx.restore();
  if (state === "locked") drawPadlock(ctx, x + W * 0.44, yb - s * 0.02, s * 0.2);
  if (state === "hidden") {
    // Invisível: o mestre vê meio transparente, com a casa tracejada (como a porta secreta).
    ctx.save();
    ctx.setLineDash([s * 0.08, s * 0.05]);
    ctx.strokeStyle = "#f1e6d0";
    ctx.lineWidth = Math.max(1, s * 0.025);
    ctx.strokeRect(x - s * 0.47, y - s * 0.85, s * 0.94, s * 0.9);
    ctx.restore();
  }
}

/** Cadeado pequeno no canto: legível em qualquer zoom. */
function drawPadlock(ctx: Ctx, x: number, y: number, r: number) {
  ctx.save();
  ctx.fillStyle = "#1a1520";
  ctx.beginPath();
  ctx.arc(x, y - r * 0.5, r * 0.62, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = "#d8b47a";
  ctx.lineWidth = r * 0.16;
  ctx.beginPath();
  ctx.arc(x, y - r * 0.62, r * 0.2, Math.PI, 0);
  ctx.stroke();
  ctx.fillStyle = "#d8b47a";
  ctx.beginPath();
  ctx.roundRect(x - r * 0.3, y - r * 0.62, r * 0.6, r * 0.46, r * 0.08);
  ctx.fill();
  ctx.restore();
}
