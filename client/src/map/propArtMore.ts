import { METALS, rivet, shade } from "./tokenArt";
import { plank, type R } from "./propArt";
import { rng, shadowed, textured, WOODS } from "./wallKit";

/**
 * Segunda leva de objetos do cenário (docs/design/cenario.md), no mesmo kit da primeira (`propArt.ts`): vistos de
 * cima, em volta de (0, 0), `c` = lado da casa já com o tamanho; a semente decide a variação.
 */

const STONE = ["#9c9484", "#8f887a", "#a59d8e", "#7d766a"];

/** Laje ou bloco de pedra com topo mais claro, granulado e aresta escura. */
function slab(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, tone: string, shadowK: number, round = 0.06) {
  const p = new Path2D();
  p.roundRect(x, y, w, h, Math.min(w, h) * round);
  shadowed(ctx, Math.min(w, h), shadowK, () => {
    ctx.fillStyle = shade(tone, -0.6);
    ctx.fill(p);
  });
  const g = ctx.createLinearGradient(x, y, x + w * 0.4, y + h);
  g.addColorStop(0, shade(tone, 0.25));
  g.addColorStop(1, shade(tone, -0.25));
  ctx.fillStyle = g;
  ctx.fill(p);
  ctx.save();
  ctx.clip(p);
  textured(ctx, x, y, w, h, Math.min(w, h) / 40, 0.5);
  ctx.restore();
  ctx.strokeStyle = "#1a1612";
  ctx.lineWidth = Math.min(w, h) * 0.04;
  ctx.stroke(p);
  return p;
}

/** Chama de vela vista de cima: brilho quente e o pavio claro. */
function candle(ctx: CanvasRenderingContext2D, x: number, y: number, s: number) {
  const g = ctx.createRadialGradient(x, y, 0, x, y, s * 3);
  g.addColorStop(0, "rgba(255,210,120,.55)");
  g.addColorStop(1, "rgba(255,170,60,0)");
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.arc(x, y, s * 3, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = "#efe6cf";
  ctx.beginPath();
  ctx.arc(x, y, s, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = "#ffcf6a";
  ctx.beginPath();
  ctx.arc(x, y, s * 0.45, 0, Math.PI * 2);
  ctx.fill();
}

/** Saco de estopa amarrado, visto de cima: corpo arredondado, a boca torcida e o cordão. */
function sack(ctx: CanvasRenderingContext2D, r: R, x: number, y: number, s: number, angle: number) {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(angle);
  const body = new Path2D();
  body.ellipse(0, 0, s * 0.5, s * 0.38, 0, 0, Math.PI * 2);
  shadowed(ctx, s, 1.1, () => {
    ctx.fillStyle = "#3a2a14";
    ctx.fill(body);
  });
  const tone = ["#b39466", "#a3865a", "#c2a375"][Math.floor(r() * 3)];
  const g = ctx.createRadialGradient(-s * 0.15, -s * 0.12, s * 0.05, 0, 0, s * 0.55);
  g.addColorStop(0, shade(tone, 0.2));
  g.addColorStop(1, shade(tone, -0.35));
  ctx.fillStyle = g;
  ctx.fill(body);
  ctx.save();
  ctx.clip(body);
  // Trama da estopa.
  ctx.strokeStyle = "rgba(60,40,15,.18)";
  ctx.lineWidth = s * 0.02;
  for (let k = -6; k <= 6; k++) {
    ctx.beginPath();
    ctx.moveTo(k * s * 0.08, -s);
    ctx.lineTo(k * s * 0.08, s);
    ctx.stroke();
  }
  textured(ctx, -s, -s, s * 2, s * 2, s / 30, 0.35);
  ctx.restore();
  ctx.strokeStyle = "#2a1a08";
  ctx.lineWidth = s * 0.04;
  ctx.stroke(body);
  // Boca amarrada (na ponta do saco).
  ctx.fillStyle = shade(tone, -0.1);
  ctx.beginPath();
  ctx.ellipse(s * 0.5, 0, s * 0.14, s * 0.1, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = "#5a3a1c";
  ctx.lineWidth = s * 0.05;
  ctx.beginPath();
  ctx.moveTo(s * 0.4, -s * 0.1);
  ctx.lineTo(s * 0.4, s * 0.1);
  ctx.stroke();
  ctx.restore();
}

// ---------- os objetos ----------

/**
 * Estátua: pedestal chanfrado e uma figura de pedra vista de cima, em três tipos que leem de longe: cavaleiro com a
 * espada de ponta para baixo, figura de manto e capuz com cajado, e anjo de asas abertas. A sombra comprida, em
 * forma de pessoa de pé, sai do pedestal na diagonal: é ela que diz "isto é alto". Pedra desgastada, sem musgo.
 */
export function statue(ctx: CanvasRenderingContext2D, c: number, seed: number) {
  const r = rng(seed);
  const tone = STONE[Math.floor(r() * STONE.length)];
  const kind = Math.floor(r() * 3); // 0 cavaleiro, 1 manto, 2 anjo
  const s = c * 0.9;
  const ink = "#1a1612";

  // Sombra comprida no chão: uma pessoa de pé deitada na diagonal (para baixo e à direita), mais clara na ponta.
  ctx.save();
  ctx.rotate(Math.PI / 4);
  const shadow = ctx.createLinearGradient(0, 0, 0, s * 1.6);
  shadow.addColorStop(0, "rgba(12,6,16,.5)");
  shadow.addColorStop(1, "rgba(12,6,16,.12)");
  ctx.fillStyle = shadow;
  ctx.beginPath();
  ctx.moveTo(-s * 0.2, 0);
  ctx.lineTo(-s * 0.24, s * 0.9);
  ctx.quadraticCurveTo(-s * 0.3, s * 1.0, -s * 0.18, s * 1.08);
  ctx.lineTo(s * 0.18, s * 1.08);
  ctx.quadraticCurveTo(s * 0.3, s * 1.0, s * 0.24, s * 0.9);
  ctx.lineTo(s * 0.2, 0);
  ctx.closePath();
  ctx.fill();
  ctx.beginPath();
  ctx.ellipse(0, s * 1.24, s * 0.13, s * 0.16, 0, 0, Math.PI * 2);
  ctx.fill();
  if (kind === 2) {
    // Asas também fazem sombra.
    for (const side of [-1, 1]) {
      ctx.beginPath();
      ctx.moveTo(side * s * 0.2, s * 0.85);
      ctx.quadraticCurveTo(side * s * 0.7, s * 0.8, side * s * 0.55, s * 1.25);
      ctx.lineTo(side * s * 0.18, s * 1.05);
      ctx.closePath();
      ctx.fill();
    }
  }
  ctx.restore();

  // Pedestal: topo claro e chanfro em volta, cada lado com a sua luz.
  const half = s * 0.42;
  const bevel = s * 0.08;
  shadowed(ctx, s, 1.4, () => {
    ctx.fillStyle = shade(tone, -0.6);
    ctx.fillRect(-half, -half, half * 2, half * 2);
  });
  const sides: [number, [number, number][]][] = [
    [0.3, [[-half, -half], [half, -half], [half - bevel, -half + bevel], [-half + bevel, -half + bevel]]],
    [-0.35, [[half, -half], [half, half], [half - bevel, half - bevel], [half - bevel, -half + bevel]]],
    [-0.5, [[half, half], [-half, half], [-half + bevel, half - bevel], [half - bevel, half - bevel]]],
    [0.15, [[-half, half], [-half, -half], [-half + bevel, -half + bevel], [-half + bevel, half - bevel]]],
  ];
  for (const [k, pts] of sides) {
    ctx.fillStyle = shade(tone, k);
    ctx.beginPath();
    pts.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y)));
    ctx.closePath();
    ctx.fill();
  }
  const top = half - bevel;
  ctx.fillStyle = shade(tone, 0.05);
  ctx.fillRect(-top, -top, top * 2, top * 2);
  ctx.save();
  ctx.beginPath();
  ctx.rect(-half, -half, half * 2, half * 2);
  ctx.clip();
  textured(ctx, -half, -half, half * 2, half * 2, s / 40, 0.55);
  // Desgaste: duas rachas finas.
  ctx.strokeStyle = "rgba(20,16,12,.45)";
  ctx.lineWidth = s * 0.012;
  for (let k = 0; k < 2; k++) {
    const x = (r() - 0.5) * top * 1.6;
    ctx.beginPath();
    ctx.moveTo(x, top);
    ctx.lineTo(x + (r() - 0.5) * s * 0.15, top - s * 0.12);
    ctx.lineTo(x + (r() - 0.5) * s * 0.2, top - s * 0.22);
    ctx.stroke();
  }
  ctx.restore();
  ctx.strokeStyle = ink;
  ctx.lineWidth = s * 0.025;
  ctx.strokeRect(-half, -half, half * 2, half * 2);

  // Figura (de frente para baixo do mapa), mais clara que o pedestal, com contorno firme.
  const light = shade(tone, 0.35);
  const mid = shade(tone, 0.12);
  const dark = shade(tone, -0.2);
  const fill = (path: Path2D, x: number, y: number, rr: number) => {
    const g = ctx.createRadialGradient(x - rr * 0.4, y - rr * 0.45, rr * 0.1, x, y, rr * 1.1);
    g.addColorStop(0, light);
    g.addColorStop(0.6, mid);
    g.addColorStop(1, dark);
    ctx.fillStyle = g;
    ctx.fill(path);
    ctx.strokeStyle = ink;
    ctx.lineWidth = s * 0.018;
    ctx.stroke(path);
  };
  const oy = -s * 0.04;
  // A figura ocupa o pedestal inteiro (asas e espada passam da borda): de cima, estátua lê pelo tamanho.
  ctx.save();
  ctx.scale(1.6, 1.6);
  ctx.save();
  ctx.shadowColor = "rgba(0,0,0,.55)";
  ctx.shadowBlur = s * 0.06;
  ctx.shadowOffsetY = s * 0.03;
  if (kind === 2) {
    // Asas abertas: de cada lado, um leque de penas compridas (das de trás, mais longas, para as da frente).
    for (const side of [-1, 1]) {
      for (let f = 0; f < 4; f++) {
        const ang = -Math.PI / 2 + side * (0.55 + f * 0.32);
        const len = s * (0.4 - f * 0.05);
        const x0 = side * s * 0.13;
        const y0 = oy - s * 0.04;
        const feather = new Path2D();
        feather.ellipse(x0 + Math.cos(ang) * len * 0.5, y0 + Math.sin(ang) * len * 0.5, len * 0.5, s * 0.055, ang, 0, Math.PI * 2);
        fill(feather, x0 + Math.cos(ang) * len * 0.45, y0 + Math.sin(ang) * len * 0.45, len * 0.5);
      }
    }
  }
  // Ombros: manto caindo para trás (para cima), mais largo que o corpo.
  const body = new Path2D();
  body.moveTo(-s * 0.2, oy + s * 0.06);
  body.quadraticCurveTo(-s * 0.24, oy - s * 0.12, -s * 0.12, oy - s * 0.17);
  body.lineTo(s * 0.12, oy - s * 0.17);
  body.quadraticCurveTo(s * 0.24, oy - s * 0.12, s * 0.2, oy + s * 0.06);
  body.quadraticCurveTo(0, oy + s * 0.13, -s * 0.2, oy + s * 0.06);
  body.closePath();
  fill(body, 0, oy - s * 0.04, s * 0.22);
  // Braços para a frente, mãos juntas à frente do peito.
  const hands = { x: 0, y: oy + s * 0.14 };
  for (const side of [-1, 1]) {
    const arm = new Path2D();
    arm.moveTo(side * s * 0.18, oy - s * 0.02);
    arm.quadraticCurveTo(side * s * 0.2, oy + s * 0.1, hands.x + side * s * 0.03, hands.y);
    arm.lineTo(hands.x + side * s * 0.01, hands.y - s * 0.05);
    arm.quadraticCurveTo(side * s * 0.12, oy + s * 0.04, side * s * 0.11, oy - s * 0.02);
    arm.closePath();
    fill(arm, side * s * 0.15, oy + s * 0.06, s * 0.1);
  }
  ctx.restore();
  // O que segura: espada (ponta para baixo, a cruz bem visível) ou cajado com a esfera.
  if (kind === 0 || kind === 2) {
    const blade = new Path2D();
    blade.moveTo(-s * 0.025, hands.y + s * 0.03);
    blade.lineTo(s * 0.025, hands.y + s * 0.03);
    blade.lineTo(s * 0.012, hands.y + s * 0.3);
    blade.lineTo(0, hands.y + s * 0.34);
    blade.lineTo(-s * 0.012, hands.y + s * 0.3);
    blade.closePath();
    fill(blade, 0, hands.y + s * 0.15, s * 0.1);
    const guard = new Path2D();
    guard.roundRect(-s * 0.1, hands.y + s * 0.005, s * 0.2, s * 0.035, s * 0.012);
    fill(guard, 0, hands.y, s * 0.1);
  } else {
    const staff = new Path2D();
    staff.roundRect(-s * 0.018, hands.y - s * 0.02, s * 0.036, s * 0.34, s * 0.015);
    fill(staff, 0, hands.y + s * 0.12, s * 0.12);
    const orb = new Path2D();
    orb.arc(0, hands.y + s * 0.36, s * 0.06, 0, Math.PI * 2);
    fill(orb, 0, hands.y + s * 0.36, s * 0.06);
  }
  // Cabeça: elmo (cavaleiro), capuz (manto) ou cabelo (anjo).
  const head = new Path2D();
  if (kind === 1) {
    head.moveTo(-s * 0.12, oy - s * 0.02);
    head.quadraticCurveTo(-s * 0.13, oy - s * 0.2, 0, oy - s * 0.21);
    head.quadraticCurveTo(s * 0.13, oy - s * 0.2, s * 0.12, oy - s * 0.02);
    head.quadraticCurveTo(0, oy + s * 0.05, -s * 0.12, oy - s * 0.02);
    head.closePath();
  } else head.arc(0, oy - s * 0.07, s * 0.1, 0, Math.PI * 2);
  ctx.save();
  ctx.shadowColor = "rgba(0,0,0,.5)";
  ctx.shadowBlur = s * 0.05;
  ctx.shadowOffsetY = s * 0.025;
  fill(head, 0, oy - s * 0.08, s * 0.11);
  ctx.restore();
  ctx.strokeStyle = "rgba(20,16,12,.5)";
  ctx.lineWidth = s * 0.012;
  if (kind === 0) {
    // Crista do elmo.
    ctx.beginPath();
    ctx.moveTo(0, oy - s * 0.17);
    ctx.lineTo(0, oy + s * 0.02);
    ctx.stroke();
  } else if (kind === 2) {
    // Cabelo: mechas.
    for (let k = -2; k <= 2; k++) {
      ctx.beginPath();
      ctx.moveTo(k * s * 0.03, oy - s * 0.15);
      ctx.quadraticCurveTo(k * s * 0.045, oy - s * 0.07, k * s * 0.035, oy - s * 0.01);
      ctx.stroke();
    }
  }
  ctx.restore();
}

/** Osso comprido: haste com as pontas em nó. */
function bone(ctx: CanvasRenderingContext2D, x: number, y: number, len: number, w: number, angle: number) {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(angle);
  const p = new Path2D();
  p.roundRect(-len / 2, -w / 2, len, w, w / 2);
  for (const sx of [-1, 1])
    for (const sy of [-1, 1]) {
      p.moveTo(sx * len * 0.5 + w * 0.55, sy * w * 0.45);
      p.arc(sx * len * 0.5, sy * w * 0.45, w * 0.55, 0, Math.PI * 2);
    }
  shadowed(ctx, w * 2, 0.6, () => {
    ctx.fillStyle = "#3a3428";
    ctx.fill(p);
  });
  ctx.fillStyle = "#ddd3bb";
  ctx.fill(p);
  ctx.strokeStyle = "rgba(60,50,35,.7)";
  ctx.lineWidth = w * 0.15;
  ctx.stroke(p);
  ctx.restore();
}

/** Ossos: uma caveira e ossos espalhados (às vezes costelas), cor de marfim. */
export function bones(ctx: CanvasRenderingContext2D, c: number, seed: number) {
  const r = rng(seed);
  const n = 3 + Math.floor(r() * 4);
  for (let k = 0; k < n; k++) bone(ctx, (r() - 0.5) * c * 0.7, (r() - 0.5) * c * 0.7, c * (0.22 + r() * 0.18), c * 0.05, r() * Math.PI);
  if (r() < 0.6) {
    // Costelas: arcos.
    ctx.strokeStyle = "#d4c9b0";
    ctx.lineWidth = c * 0.03;
    const x = (r() - 0.5) * c * 0.4;
    const y = (r() - 0.5) * c * 0.4;
    for (let k = 0; k < 4; k++) {
      ctx.beginPath();
      ctx.arc(x, y + k * c * 0.06, c * 0.14, Math.PI * 1.15, Math.PI * 1.85);
      ctx.stroke();
    }
  }
  // Caveira, vista de cima e um pouco de frente.
  const sx = (r() - 0.5) * c * 0.4;
  const sy = (r() - 0.5) * c * 0.4;
  ctx.save();
  ctx.translate(sx, sy);
  ctx.rotate((r() - 0.5) * 1.2);
  const s = c * 0.13;
  shadowed(ctx, s * 2, 0.8, () => {
    ctx.fillStyle = "#3a3428";
    ctx.beginPath();
    ctx.ellipse(0, 0, s, s * 1.1, 0, 0, Math.PI * 2);
    ctx.fill();
  });
  const g = ctx.createRadialGradient(-s * 0.3, -s * 0.4, s * 0.1, 0, 0, s * 1.1);
  g.addColorStop(0, "#f2ead6");
  g.addColorStop(1, "#b5aa90");
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.ellipse(0, 0, s, s * 1.1, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = "#241e16";
  for (const ex of [-1, 1]) {
    ctx.beginPath();
    ctx.ellipse(ex * s * 0.38, s * 0.35, s * 0.24, s * 0.2, 0, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.beginPath();
  ctx.moveTo(0, s * 0.6);
  ctx.lineTo(-s * 0.1, s * 0.8);
  ctx.lineTo(s * 0.1, s * 0.8);
  ctx.closePath();
  ctx.fill();
  ctx.strokeStyle = "rgba(60,50,35,.7)";
  ctx.lineWidth = s * 0.1;
  ctx.beginPath();
  ctx.ellipse(0, 0, s, s * 1.1, 0, 0, Math.PI * 2);
  ctx.stroke();
  ctx.restore();
}

/** Altar: laje de pedra sobre um degrau, com velas; às vezes um pano por cima, às vezes manchas de sangue. */
export function altar(ctx: CanvasRenderingContext2D, c: number, seed: number) {
  const r = rng(seed);
  const tone = STONE[Math.floor(r() * STONE.length)];
  const w = c * (1.3 + r() * 0.25);
  const h = c * 0.7;
  // Degrau: a mesma pedra, mais escura (tom a partir do #hex).
  slab(ctx, -w / 2 - c * 0.1, -h / 2 - c * 0.1, w + c * 0.2, h + c * 0.2, "#6f685c", 0.8);
  slab(ctx, -w / 2, -h / 2, w, h, tone, 1.6);
  const deco = r();
  if (deco < 0.4) {
    // Pano no meio, com franja.
    const cloth = ["#7a1f2a", "#2e3d7a", "#5a2a6e"][Math.floor(r() * 3)];
    ctx.fillStyle = cloth;
    ctx.fillRect(-w * 0.18, -h / 2 - c * 0.04, w * 0.36, h + c * 0.08);
    ctx.fillStyle = "#d8b47a";
    ctx.fillRect(-w * 0.18, -h / 2 - c * 0.04, w * 0.36, c * 0.03);
    ctx.fillRect(-w * 0.18, h / 2 + c * 0.01, w * 0.36, c * 0.03);
  } else if (deco < 0.7) {
    for (let k = 0; k < 4; k++) {
      ctx.fillStyle = `rgba(110,10,15,${0.5 + r() * 0.3})`;
      ctx.beginPath();
      ctx.ellipse((r() - 0.5) * w * 0.5, (r() - 0.5) * h * 0.5, c * (0.05 + r() * 0.08), c * (0.04 + r() * 0.06), r() * 3, 0, Math.PI * 2);
      ctx.fill();
    }
  }
  const candles = 2 + Math.floor(r() * 3);
  for (let k = 0; k < candles; k++) candle(ctx, (k % 2 ? 1 : -1) * w * (0.32 + r() * 0.1), (k < 2 ? -1 : 1) * h * (0.22 + r() * 0.1), c * 0.035);
}

/** Barraca: lona em duas águas com a cumeeira, estacas e cordas nos cantos e a porta aberta numa ponta. */
export function tent(ctx: CanvasRenderingContext2D, c: number, seed: number) {
  const r = rng(seed);
  const w = c * (1.7 + r() * 0.3);
  const h = c * (1.25 + r() * 0.2);
  const canvas = ["#c9b48a", "#8a9a5b", "#9a4a3a", "#b8b0a0"][Math.floor(r() * 4)];
  // Cordas e estacas.
  ctx.strokeStyle = "#a08860";
  ctx.lineWidth = c * 0.015;
  for (const [x, y] of [
    [-1, -1],
    [1, -1],
    [-1, 1],
    [1, 1],
  ]) {
    ctx.beginPath();
    ctx.moveTo((x * w) / 2, (y * h) / 2);
    ctx.lineTo((x * w) / 2 + x * c * 0.18, (y * h) / 2 + y * c * 0.18);
    ctx.stroke();
    ctx.fillStyle = "#4a2e14";
    ctx.beginPath();
    ctx.arc((x * w) / 2 + x * c * 0.18, (y * h) / 2 + y * c * 0.18, c * 0.025, 0, Math.PI * 2);
    ctx.fill();
  }
  const body = new Path2D();
  body.rect(-w / 2, -h / 2, w, h);
  shadowed(ctx, c, 2.4, () => {
    ctx.fillStyle = "#2a2014";
    ctx.fill(body);
  });
  // Duas águas: a de cima pega luz, a de baixo fica na sombra.
  for (const [y0, k] of [
    [-h / 2, 0.2],
    [0, -0.25],
  ] as const) {
    const g = ctx.createLinearGradient(0, y0, 0, y0 + h / 2);
    g.addColorStop(0, shade(canvas, k + (y0 < 0 ? -0.05 : 0.05)));
    g.addColorStop(1, shade(canvas, k - (y0 < 0 ? -0.08 : 0.12)));
    ctx.fillStyle = g;
    ctx.fillRect(-w / 2, y0, w, h / 2);
  }
  ctx.save();
  ctx.clip(body);
  textured(ctx, -w / 2, -h / 2, w, h, c / 40, 0.35);
  // Costuras da lona.
  ctx.strokeStyle = "rgba(40,30,15,.25)";
  ctx.lineWidth = c * 0.012;
  for (let k = 1; k < 4; k++) {
    ctx.beginPath();
    ctx.moveTo(-w / 2 + (k * w) / 4, -h / 2);
    ctx.lineTo(-w / 2 + (k * w) / 4, h / 2);
    ctx.stroke();
  }
  ctx.restore();
  // Cumeeira e a porta (aba aberta numa ponta).
  ctx.strokeStyle = "#5a3a1c";
  ctx.lineWidth = c * 0.04;
  ctx.beginPath();
  ctx.moveTo(-w / 2 - c * 0.04, 0);
  ctx.lineTo(w / 2 + c * 0.04, 0);
  ctx.stroke();
  ctx.fillStyle = "#1a140c";
  ctx.beginPath();
  ctx.moveTo(w / 2, -h * 0.28);
  ctx.lineTo(w / 2 - c * 0.22, 0);
  ctx.lineTo(w / 2, h * 0.28);
  ctx.closePath();
  ctx.fill();
  ctx.strokeStyle = "#2a2014";
  ctx.lineWidth = c * 0.03;
  ctx.stroke(body);
}

/** Carroça: caixa de tábuas com as bordas, duas rodas dos lados, os varais na frente e carga variada. */
export function cart(ctx: CanvasRenderingContext2D, c: number, seed: number) {
  const r = rng(seed);
  const w = c * 1.5;
  const h = c * 0.85;
  // Rodas (vistas de cima: tiras escuras dos lados).
  for (const y of [-1, 1]) {
    ctx.fillStyle = "#2a1a0c";
    ctx.beginPath();
    ctx.roundRect(-c * 0.32, (y * h) / 2 - (y < 0 ? c * 0.12 : 0), c * 0.64, c * 0.12, c * 0.05);
    ctx.fill();
    rivet(ctx, 0, (y * h) / 2 + (y < 0 ? -c * 0.06 : c * 0.06), c * 0.035, METALS.iron);
  }
  // Varais na frente.
  ctx.strokeStyle = "#5a3a1c";
  ctx.lineWidth = c * 0.05;
  for (const y of [-0.3, 0.3]) {
    ctx.beginPath();
    ctx.moveTo(w / 2, y * h);
    ctx.lineTo(w / 2 + c * 0.55, y * h * 0.7);
    ctx.stroke();
  }
  const bed = new Path2D();
  bed.roundRect(-w / 2, -h / 2, w, h, c * 0.04);
  shadowed(ctx, c, 1.6, () => {
    ctx.fillStyle = "#2a1608";
    ctx.fill(bed);
  });
  const tone = WOODS[Math.floor(r() * WOODS.length)];
  ctx.save();
  ctx.clip(bed);
  for (let k = 0; k < 5; k++) {
    const y0 = -h / 2 + (k * h) / 5;
    const g = ctx.createLinearGradient(0, y0, 0, y0 + h / 5);
    g.addColorStop(0, shade(tone, 0.12));
    g.addColorStop(1, shade(tone, -0.28));
    ctx.fillStyle = g;
    ctx.fillRect(-w / 2, y0, w, h / 5);
    ctx.fillStyle = "rgba(20,10,2,.5)";
    ctx.fillRect(-w / 2, y0 + h / 5 - c * 0.008, w, c * 0.016);
  }
  textured(ctx, -w / 2, -h / 2, w, h, c / 40, 0.3);
  ctx.restore();
  ctx.strokeStyle = shade(tone, -0.45);
  ctx.lineWidth = c * 0.07;
  ctx.stroke(bed);
  // Carga: sacos, barris pequenos ou feno.
  const load = r();
  if (load < 0.35) for (let k = 0; k < 3; k++) sack(ctx, r, -w * 0.25 + k * w * 0.22, (r() - 0.5) * h * 0.3, c * 0.38, (r() - 0.5) * 0.8);
  else if (load < 0.65) {
    for (let k = 0; k < 4; k++) {
      const x = -w * 0.28 + (k % 2) * w * 0.3;
      const y = (Math.floor(k / 2) - 0.5) * h * 0.42;
      ctx.fillStyle = "#6e4520";
      ctx.beginPath();
      ctx.arc(x, y, c * 0.15, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = "#3a3b40";
      ctx.lineWidth = c * 0.025;
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(x, y, c * 0.1, 0, Math.PI * 2);
      ctx.stroke();
    }
  } else if (load < 0.9) {
    // Feno: monte amarelado com fiapos.
    ctx.fillStyle = "#c9a94e";
    ctx.beginPath();
    ctx.ellipse(-c * 0.05, 0, w * 0.4, h * 0.34, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = "rgba(120,90,30,.6)";
    ctx.lineWidth = c * 0.012;
    for (let k = 0; k < 30; k++) {
      const x = -c * 0.05 + (r() - 0.5) * w * 0.7;
      const y = (r() - 0.5) * h * 0.55;
      const a = r() * Math.PI;
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.lineTo(x + Math.cos(a) * c * 0.12, y + Math.sin(a) * c * 0.12);
      ctx.stroke();
    }
  }
}

/** Poço: aro de pedras em volta da água escura (com reflexo), a trave por cima e às vezes o balde. */
export function well(ctx: CanvasRenderingContext2D, c: number, seed: number) {
  const r = rng(seed);
  const R1 = c * 0.48;
  const R0 = c * 0.3;
  shadowed(ctx, c, 1.4, () => {
    ctx.fillStyle = "#2a2622";
    ctx.beginPath();
    ctx.arc(0, 0, R1, 0, Math.PI * 2);
    ctx.fill();
  });
  // Pedras do aro, uma a uma.
  const n = 12;
  for (let k = 0; k < n; k++) {
    const a1 = (k / n) * Math.PI * 2 + 0.03;
    const a2 = ((k + 1) / n) * Math.PI * 2 - 0.03;
    const tone = STONE[Math.floor(r() * STONE.length)];
    const mid = (a1 + a2) / 2;
    const lit = (-Math.cos(mid) * 0.7 - Math.sin(mid) * 0.7 + 1) / 2;
    ctx.fillStyle = shade(tone, -0.35 + lit * 0.5);
    ctx.beginPath();
    ctx.arc(0, 0, R1, a1, a2);
    ctx.arc(0, 0, R0, a2, a1, true);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = "#1a1612";
    ctx.lineWidth = c * 0.015;
    ctx.stroke();
  }
  // Água: escura no fundo, um reflexo claro.
  const g = ctx.createRadialGradient(-R0 * 0.3, -R0 * 0.3, 0, 0, 0, R0);
  g.addColorStop(0, "#2f5a6e");
  g.addColorStop(1, "#0c1a22");
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.arc(0, 0, R0, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = "rgba(200,230,240,.35)";
  ctx.lineWidth = c * 0.015;
  ctx.beginPath();
  ctx.arc(0, 0, R0 * 0.6, Math.PI * 1.1, Math.PI * 1.5);
  ctx.stroke();
  // Trave com o sarilho, de lado a lado.
  ctx.save();
  ctx.rotate((r() - 0.5) * 0.8);
  plank(ctx, r, R1 * 2.3, c * 0.09, "#6e4520", 1.8);
  if (r() < 0.6) {
    ctx.fillStyle = "#5a3a1c";
    ctx.beginPath();
    ctx.arc(R0 * 0.2, c * 0.12, c * 0.07, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = "#3a3b40";
    ctx.lineWidth = c * 0.015;
    ctx.stroke();
  }
  ctx.restore();
}

/** Estante: móvel comprido de madeira, com as divisórias e os livros vistos de cima (lombadas coloridas). */
export function shelf(ctx: CanvasRenderingContext2D, c: number, seed: number) {
  const r = rng(seed);
  const w = c * 1.6;
  const h = c * 0.42;
  const box = new Path2D();
  box.rect(-w / 2, -h / 2, w, h);
  shadowed(ctx, c, 2.2, () => {
    ctx.fillStyle = "#2a1608";
    ctx.fill(box);
  });
  const tone = WOODS[Math.floor(r() * WOODS.length)];
  ctx.fillStyle = shade(tone, -0.35);
  ctx.fill(box);
  // Livros: blocos finos em pé, de cores e alturas diferentes, com vãos.
  const BOOKS = ["#7a1f2a", "#2e3d7a", "#3f6b32", "#8a6a2e", "#5a2a6e", "#6e4520", "#a39570"];
  const sections = 3;
  for (let s = 0; s < sections; s++) {
    let x = -w / 2 + (s * w) / sections + c * 0.04;
    const end = -w / 2 + ((s + 1) * w) / sections - c * 0.04;
    while (x < end - c * 0.04) {
      if (r() < 0.12) {
        x += c * 0.06;
        continue;
      }
      const bw = c * (0.04 + r() * 0.04);
      const bh = h * (0.6 + r() * 0.3);
      const col = BOOKS[Math.floor(r() * BOOKS.length)];
      ctx.fillStyle = shade(col, -0.1 + r() * 0.2);
      ctx.fillRect(x, -bh / 2, Math.min(bw, end - x), bh);
      ctx.fillStyle = "rgba(255,240,200,.25)";
      ctx.fillRect(x, -bh / 2, Math.min(bw, end - x), bh * 0.12);
      x += bw + c * 0.006;
    }
  }
  // Moldura e divisórias.
  ctx.strokeStyle = shade(tone, 0.05);
  ctx.lineWidth = c * 0.05;
  ctx.stroke(box);
  for (let s = 1; s < sections; s++) {
    ctx.beginPath();
    ctx.moveTo(-w / 2 + (s * w) / sections, -h / 2);
    ctx.lineTo(-w / 2 + (s * w) / sections, h / 2);
    ctx.stroke();
  }
  ctx.strokeStyle = "#1a0c04";
  ctx.lineWidth = c * 0.015;
  ctx.strokeRect(-w / 2 - c * 0.025, -h / 2 - c * 0.025, w + c * 0.05, h + c * 0.05);
}

/** Cama: estrado de madeira, colchão, travesseiro e a coberta (cor sorteada) com dobras. */
export function bed(ctx: CanvasRenderingContext2D, c: number, seed: number) {
  const r = rng(seed);
  const w = c * 0.9;
  const h = c * 1.6;
  const frame = new Path2D();
  frame.roundRect(-w / 2, -h / 2, w, h, c * 0.04);
  shadowed(ctx, c, 1.5, () => {
    ctx.fillStyle = "#2a1608";
    ctx.fill(frame);
  });
  const tone = WOODS[Math.floor(r() * WOODS.length)];
  ctx.fillStyle = shade(tone, -0.1);
  ctx.fill(frame);
  ctx.strokeStyle = "#1a0c04";
  ctx.lineWidth = c * 0.03;
  ctx.stroke(frame);
  // Colchão e travesseiro.
  ctx.fillStyle = "#e6dcc4";
  ctx.beginPath();
  ctx.roundRect(-w / 2 + c * 0.06, -h / 2 + c * 0.06, w - c * 0.12, h - c * 0.12, c * 0.05);
  ctx.fill();
  ctx.fillStyle = "#f4ecd8";
  ctx.beginPath();
  ctx.roundRect(-w * 0.32, -h / 2 + c * 0.12, w * 0.64, c * 0.28, c * 0.1);
  ctx.fill();
  ctx.strokeStyle = "rgba(120,100,70,.4)";
  ctx.lineWidth = c * 0.012;
  ctx.stroke();
  // Coberta, com a dobra de cima mais clara e dobras na diagonal.
  const blanket = ["#7a1f2a", "#2e3d7a", "#3f6b32", "#8a6a2e", "#5a2a6e"][Math.floor(r() * 5)];
  const top = -h / 2 + c * (0.48 + r() * 0.12);
  const g = ctx.createLinearGradient(-w / 2, top, w / 2, h / 2);
  g.addColorStop(0, shade(blanket, 0.15));
  g.addColorStop(1, shade(blanket, -0.3));
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.roundRect(-w / 2 + c * 0.04, top, w - c * 0.08, h / 2 - top - c * 0.04, c * 0.05);
  ctx.fill();
  ctx.fillStyle = shade(blanket, 0.3);
  ctx.fillRect(-w / 2 + c * 0.04, top, w - c * 0.08, c * 0.08);
  ctx.strokeStyle = "rgba(0,0,0,.25)";
  ctx.lineWidth = c * 0.015;
  for (let k = 0; k < 3; k++) {
    const y = top + c * 0.2 + r() * (h / 2 - top - c * 0.3);
    ctx.beginPath();
    ctx.moveTo(-w / 2 + c * 0.08, y);
    ctx.quadraticCurveTo(0, y + (r() - 0.5) * c * 0.15, w / 2 - c * 0.08, y + (r() - 0.5) * c * 0.1);
    ctx.stroke();
  }
}

/** Sacos: dois a quatro sacos de estopa amontoados. */
export function sacks(ctx: CanvasRenderingContext2D, c: number, seed: number) {
  const r = rng(seed);
  const n = 2 + Math.floor(r() * 3);
  for (let k = 0; k < n; k++) sack(ctx, r, (r() - 0.5) * c * 0.45, (r() - 0.5) * c * 0.45, c * (0.42 + r() * 0.1), r() * Math.PI * 2);
}

/** Cogumelos: um tufo de chapéus redondos (vermelhos com pintas, ou pardos), de tamanhos diferentes. */
export function mushrooms(ctx: CanvasRenderingContext2D, c: number, seed: number) {
  const r = rng(seed);
  const red = r() < 0.5;
  const n = 3 + Math.floor(r() * 5);
  const caps: [number, number, number][] = [];
  for (let k = 0; k < n; k++) caps.push([(r() - 0.5) * c * 0.5, (r() - 0.5) * c * 0.5, c * (0.05 + r() * 0.07)]);
  caps.sort((a, b) => a[1] - b[1]);
  for (const [x, y, s] of caps) {
    shadowed(ctx, s * 2, 0.8, () => {
      ctx.fillStyle = "#2a1a10";
      ctx.beginPath();
      ctx.arc(x, y, s, 0, Math.PI * 2);
      ctx.fill();
    });
    const base = red ? "#b8322e" : "#9a7650";
    const g = ctx.createRadialGradient(x - s * 0.35, y - s * 0.4, s * 0.1, x, y, s);
    g.addColorStop(0, shade(base, 0.35));
    g.addColorStop(1, shade(base, -0.35));
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(x, y, s, 0, Math.PI * 2);
    ctx.fill();
    if (red) {
      ctx.fillStyle = "#f4ecd8";
      for (let k = 0; k < 4; k++) {
        ctx.beginPath();
        ctx.arc(x + (r() - 0.5) * s * 1.1, y + (r() - 0.5) * s * 1.1, s * 0.12, 0, Math.PI * 2);
        ctx.fill();
      }
    }
    ctx.strokeStyle = "rgba(40,20,10,.6)";
    ctx.lineWidth = s * 0.1;
    ctx.beginPath();
    ctx.arc(x, y, s, 0, Math.PI * 2);
    ctx.stroke();
  }
}

/** Flores: um canteiro de capim com florzinhas de uma ou duas cores. */
export function flowers(ctx: CanvasRenderingContext2D, c: number, seed: number) {
  const r = rng(seed);
  const COLORS = ["#c94a8a", "#e8d47a", "#f2ece0", "#7a6ad8", "#e07a4a"];
  const a = COLORS[Math.floor(r() * COLORS.length)];
  const b = COLORS[Math.floor(r() * COLORS.length)];
  // Capim: tufinhos de folhas finas.
  for (let k = 0; k < 26; k++) {
    const x = (r() - 0.5) * c * 0.8;
    const y = (r() - 0.5) * c * 0.8;
    if (Math.hypot(x, y) > c * 0.42) continue;
    ctx.strokeStyle = ["#2c5a2d", "#43803a", "#5a8a3a"][Math.floor(r() * 3)];
    ctx.lineWidth = c * 0.02;
    for (let l = 0; l < 4; l++) {
      const ang = -Math.PI / 2 + (r() - 0.5) * 1.6;
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.lineTo(x + Math.cos(ang) * c * 0.08, y + Math.sin(ang) * c * 0.08);
      ctx.stroke();
    }
  }
  // Flores: cinco pétalas e o miolo.
  for (let k = 0; k < 9; k++) {
    const x = (r() - 0.5) * c * 0.7;
    const y = (r() - 0.5) * c * 0.7;
    if (Math.hypot(x, y) > c * 0.38) continue;
    const s = c * (0.025 + r() * 0.02);
    ctx.fillStyle = r() < 0.6 ? a : b;
    for (let p = 0; p < 5; p++) {
      const ang = (p / 5) * Math.PI * 2;
      ctx.beginPath();
      ctx.arc(x + Math.cos(ang) * s, y + Math.sin(ang) * s, s * 0.75, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.fillStyle = "#e8b83a";
    ctx.beginPath();
    ctx.arc(x, y, s * 0.55, 0, Math.PI * 2);
    ctx.fill();
  }
}

/** Ponte de tábuas: tábuas atravessadas no comprimento, presas em duas vigas, com postes e corda dos lados. */
export function bridge(ctx: CanvasRenderingContext2D, c: number, seed: number) {
  const r = rng(seed);
  const len = c * 3;
  const w = c * 0.9;
  shadowed(ctx, c, 1.8, () => {
    ctx.fillStyle = "#2a1608";
    ctx.fillRect(-len / 2, -w / 2, len, w);
  });
  // Vigas por baixo (aparecem nas bordas).
  ctx.fillStyle = "#3e2712";
  ctx.fillRect(-len / 2, -w / 2 - c * 0.03, len, c * 0.08);
  ctx.fillRect(-len / 2, w / 2 - c * 0.05, len, c * 0.08);
  // Tábuas atravessadas, uma falta às vezes.
  const n = 14;
  for (let k = 0; k < n; k++) {
    if (r() < 0.06) continue;
    const x = -len / 2 + (k + 0.5) * (len / n);
    ctx.save();
    ctx.translate(x + (r() - 0.5) * c * 0.02, 0);
    ctx.rotate(Math.PI / 2 + (r() - 0.5) * 0.06);
    plank(ctx, r, w * (0.95 + r() * 0.1), (len / n) * 0.88, WOODS[Math.floor(r() * WOODS.length)], 0.3);
    ctx.restore();
  }
  // Postes e corda dos dois lados.
  for (const y of [-1, 1]) {
    ctx.strokeStyle = "#b39466";
    ctx.lineWidth = c * 0.03;
    ctx.beginPath();
    ctx.moveTo(-len / 2, (y * w) / 2);
    for (let k = 0; k <= 4; k++) ctx.quadraticCurveTo(-len / 2 + (k - 0.5) * (len / 4), (y * w) / 2 + y * c * 0.04, -len / 2 + k * (len / 4), (y * w) / 2);
    ctx.stroke();
    for (let k = 0; k <= 4; k++) {
      const x = -len / 2 + k * (len / 4);
      ctx.fillStyle = "#4a2e14";
      ctx.beginPath();
      ctx.arc(x, (y * w) / 2, c * 0.06, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = "#1a0c04";
      ctx.lineWidth = c * 0.015;
      ctx.stroke();
    }
  }
}

