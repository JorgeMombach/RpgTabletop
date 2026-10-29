import { fbm } from "./fogRender";
import { CONDITION_ICONS, CONDITION_OTHER, DAEMON_SKULL } from "./gameIcons";

/**
 * Kit visual dos tokens (L2): metal com relevo e desgaste, rebites, ouro em relevo e rubis, tudo desenhado
 * no canvas (como a névoa). A moldura "bronze forjado" vale para todos (bronze no aliado, ferro no mob,
 * prata no NPC); o chefe ganha a moldura de carta (ferro escuro, filete de ouro, rubis e caveira). Cada token pronto (moldura + retrato) vira uma imagem
 * guardada: o mapa redesenha muitas vezes por segundo e só copia a imagem. O que anima (halo da vez,
 * tracejado da seleção) é desenhado por cima, ao vivo e leve.
 */

export type FrameKind = "ally" | "mob" | "npc";

interface Metal {
  hi: string;
  mid: string;
  lo: string;
  edge: string;
}

export const METALS: Record<"bronze" | "iron" | "silver" | "gold", Metal> = {
  bronze: { hi: "#f6dfae", mid: "#b98a4c", lo: "#4a3018", edge: "#2a1a0c" },
  iron: { hi: "#c9ccd1", mid: "#6c6f76", lo: "#26272b", edge: "#111114" },
  silver: { hi: "#f2f0ea", mid: "#a8a6a0", lo: "#45443f", edge: "#1c1c1a" },
  gold: { hi: "#fff1c2", mid: "#d6a63c", lo: "#5a3c0c", edge: "#2a1a04" },
};

/** Moldura de cada lado (a forma continua dizendo o lado: círculo, quadrado, hexágono). */
const METAL_OF: Record<FrameKind, Metal> = { ally: METALS.bronze, mob: METALS.iron, npc: METALS.silver };

/** Quanto a arte passa do raio do token (sombra, contas, ornamentos do chefe). */
const EXTENT = { normal: 1.25, boss: 1.35 };

// ---------- formas ----------

/** Contorno do token de raio `r`: círculo (aliado), quadrado arredondado (mob), hexágono (NPC). */
export function framePath(kind: FrameKind, r: number): Path2D {
  const p = new Path2D();
  if (kind === "npc") {
    const R = r * 1.08;
    for (let i = 0; i < 6; i++) {
      const a = -Math.PI / 2 + (i * Math.PI) / 3;
      if (i) p.lineTo(Math.cos(a) * R, Math.sin(a) * R);
      else p.moveTo(Math.cos(a) * R, Math.sin(a) * R);
    }
  } else if (kind === "mob") {
    const k = r * 0.36;
    p.moveTo(-r + k, -r);
    p.arcTo(r, -r, r, r, k);
    p.arcTo(r, r, -r, r, k);
    p.arcTo(-r, r, -r, -r, k);
    p.arcTo(-r, -r, r, -r, k);
  } else {
    p.arc(0, 0, r, 0, Math.PI * 2);
  }
  p.closePath();
  return p;
}

let probe: CanvasRenderingContext2D | null = null;

/** Ponto da borda na direção `a` (para rebites e contas acompanharem quadrado e hexágono). */
function edgePoint(kind: FrameKind, r: number, a: number): [number, number] {
  if (kind === "ally") return [Math.cos(a) * r, Math.sin(a) * r];
  probe ??= document.createElement("canvas").getContext("2d");
  const p = framePath(kind, r);
  let lo = 0;
  let hi = r * 1.6;
  for (let i = 0; i < 16; i++) {
    const m = (lo + hi) / 2;
    if (probe?.isPointInPath(p, Math.cos(a) * m, Math.sin(a) * m)) lo = m;
    else hi = m;
  }
  return [Math.cos(a) * lo, Math.sin(a) * lo];
}

/** Anel entre dois raios (par-ímpar). */
function ringPath(kind: FrameKind, rOut: number, rIn: number): Path2D {
  const p = new Path2D();
  p.addPath(framePath(kind, rOut));
  p.addPath(framePath(kind, rIn));
  return p;
}

// ---------- materiais ----------

let grainTile: HTMLCanvasElement | null = null;

/** Desgaste do metal em tons de cinza: riscos finos (metal escovado) e manchas largas. Multiplicado por cima. */
export function grain(): HTMLCanvasElement {
  if (grainTile) return grainTile;
  const N = 128;
  const c = document.createElement("canvas");
  c.width = c.height = N;
  const g = c.getContext("2d")!;
  const img = g.createImageData(N, N);
  for (let y = 0; y < N; y++) {
    for (let x = 0; x < N; x++) {
      const v = 0.55 + (fbm(x / 2, y / 22, 17, 4, 0) - 0.5) * 0.5 + (fbm(x / 18, y / 18, 24, 4, 0) - 0.5) * 0.6;
      const i = (y * N + x) * 4;
      const k = Math.max(0, Math.min(255, v * 255));
      img.data[i] = img.data[i + 1] = img.data[i + 2] = k;
      img.data[i + 3] = 255;
    }
  }
  g.putImageData(img, 0, 0);
  return (grainTile = c);
}

/** Anel de metal: brilho em cone (metal torneado), luz de cima, desgaste e relevo nas arestas. */
function metalRing(ctx: CanvasRenderingContext2D, kind: FrameKind, rOut: number, rIn: number, m: Metal) {
  const box = rOut * 1.3;
  ctx.save();
  // Sombra no chão.
  ctx.save();
  ctx.shadowColor = "rgba(0,0,0,.65)";
  ctx.shadowBlur = rOut * 0.35;
  ctx.shadowOffsetY = rOut * 0.1;
  ctx.fillStyle = "#000";
  ctx.fill(framePath(kind, rOut));
  ctx.restore();

  ctx.save();
  ctx.clip(ringPath(kind, rOut, rIn), "evenodd");
  const cone = ctx.createConicGradient(-Math.PI / 3, 0, 0);
  const stops: [number, string][] = [
    [0, m.hi],
    [0.12, m.mid],
    [0.25, m.lo],
    [0.38, m.mid],
    [0.5, m.hi],
    [0.62, m.mid],
    [0.75, m.lo],
    [0.88, m.mid],
    [1, m.hi],
  ];
  for (const [o, c] of stops) cone.addColorStop(o, c);
  ctx.fillStyle = cone;
  ctx.fillRect(-box, -box, box * 2, box * 2);
  const light = ctx.createLinearGradient(0, -rOut, 0, rOut);
  light.addColorStop(0, "rgba(255,240,210,.35)");
  light.addColorStop(0.5, "rgba(0,0,0,0)");
  light.addColorStop(1, "rgba(0,0,0,.45)");
  ctx.fillStyle = light;
  ctx.fillRect(-box, -box, box * 2, box * 2);
  ctx.globalCompositeOperation = "multiply";
  ctx.globalAlpha = 0.55;
  const pattern = ctx.createPattern(grain(), "repeat");
  if (pattern) {
    pattern.setTransform(new DOMMatrix().scale(rOut / 70));
    ctx.fillStyle = pattern;
    ctx.fillRect(-box, -box, box * 2, box * 2);
  }
  ctx.restore();

  // Relevo: aresta de fora clara em cima, a de dentro escura em cima (o anel salta).
  const lw = rOut * 0.035;
  const bevel = (path: Path2D, top: string, bottom: string) => {
    const g = ctx.createLinearGradient(0, -rOut, 0, rOut);
    g.addColorStop(0, top);
    g.addColorStop(1, bottom);
    ctx.strokeStyle = g;
    ctx.lineWidth = lw;
    ctx.stroke(path);
  };
  bevel(framePath(kind, rOut - lw / 2), "rgba(255,245,220,.75)", "rgba(0,0,0,.6)");
  bevel(framePath(kind, rIn + lw / 2), "rgba(0,0,0,.7)", "rgba(255,245,220,.45)");
  ctx.strokeStyle = m.edge;
  ctx.lineWidth = lw * 0.8;
  ctx.stroke(framePath(kind, rOut));
  ctx.restore();
}

/** Rebite (ou conta) de metal com brilho de cima à esquerda. */
export function rivet(ctx: CanvasRenderingContext2D, x: number, y: number, rr: number, m: Metal) {
  ctx.save();
  ctx.shadowColor = "rgba(0,0,0,.6)";
  ctx.shadowBlur = rr * 0.8;
  ctx.shadowOffsetY = rr * 0.3;
  const g = ctx.createRadialGradient(x - rr * 0.35, y - rr * 0.4, rr * 0.1, x, y, rr);
  g.addColorStop(0, m.hi);
  g.addColorStop(0.55, m.mid);
  g.addColorStop(1, m.lo);
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.arc(x, y, rr, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

/**
 * Rubi lapidado em losango (mais alto que largo), num engaste de ouro: quatro facetas com luz de cima à
 * esquerda, a mesa clara no meio e um brilho.
 */
function ruby(ctx: CanvasRenderingContext2D, x: number, y: number, s: number) {
  const w = s * 0.62;
  const h = s;
  const diamond = (k: number) => {
    const p = new Path2D();
    p.moveTo(x, y - h * k);
    p.lineTo(x + w * k, y);
    p.lineTo(x, y + h * k);
    p.lineTo(x - w * k, y);
    p.closePath();
    return p;
  };
  // Engaste.
  ctx.save();
  ctx.shadowColor = "rgba(0,0,0,.7)";
  ctx.shadowBlur = s * 0.4;
  ctx.shadowOffsetY = s * 0.12;
  const setting = ctx.createLinearGradient(x, y - h * 1.3, x, y + h * 1.3);
  setting.addColorStop(0, METALS.gold.hi);
  setting.addColorStop(0.5, METALS.gold.mid);
  setting.addColorStop(1, METALS.gold.lo);
  ctx.fillStyle = setting;
  ctx.fill(diamond(1.3));
  ctx.restore();
  ctx.strokeStyle = METALS.gold.edge;
  ctx.lineWidth = s * 0.06;
  ctx.stroke(diamond(1.3));
  // Facetas: cada quarto do losango com um tom (luz de cima à esquerda).
  const top = [x, y - h];
  const right = [x + w, y];
  const bottom = [x, y + h];
  const left = [x - w, y];
  const mid = [x - w * 0.1, y - h * 0.12];
  const facets: [number[], number[], string][] = [
    [left, top, "#ff8a7a"],
    [top, right, "#e0392c"],
    [right, bottom, "#6a0c08"],
    [bottom, left, "#a8180f"],
  ];
  for (const [a, b, color] of facets) {
    ctx.beginPath();
    ctx.moveTo(mid[0], mid[1]);
    ctx.lineTo(a[0], a[1]);
    ctx.lineTo(b[0], b[1]);
    ctx.closePath();
    ctx.fillStyle = color;
    ctx.fill();
  }
  // Arestas das facetas, a mesa e o brilho.
  ctx.strokeStyle = "rgba(255,200,190,.45)";
  ctx.lineWidth = s * 0.04;
  ctx.beginPath();
  for (const p of [top, right, bottom, left]) {
    ctx.moveTo(mid[0], mid[1]);
    ctx.lineTo(p[0], p[1]);
  }
  ctx.stroke();
  ctx.save();
  ctx.shadowColor = "#ff3a20";
  ctx.shadowBlur = s * 0.8;
  ctx.strokeStyle = "rgba(60,4,2,.9)";
  ctx.lineWidth = s * 0.05;
  ctx.stroke(diamond(1));
  ctx.restore();
  ctx.fillStyle = "rgba(255,255,255,.9)";
  ctx.beginPath();
  ctx.ellipse(x - w * 0.32, y - h * 0.38, s * 0.1, s * 0.16, -0.5, 0, Math.PI * 2);
  ctx.fill();
}

const iconPaths = new Map<string, Path2D>();

/**
 * Silhueta do game-icons (512 × 512) pintada em ouro: sombra, faixas de brilho, luz e sombra por dentro
 * da borda e contorno escuro. Relevo e contorno em pixels de tela, para os detalhes finos não sumirem.
 */
function goldPiece(ctx: CanvasRenderingContext2D, d: string, cx: number, cy: number, size: number, rot = 0) {
  let p = iconPaths.get(d);
  if (!p) iconPaths.set(d, (p = new Path2D(d)));
  const k = size / 512;
  const px = 1 / k;
  ctx.save();
  ctx.translate(cx, cy);
  ctx.rotate(rot);
  ctx.scale(k, k);
  ctx.translate(-256, -256);
  ctx.save();
  ctx.shadowColor = "rgba(0,0,0,.75)";
  ctx.shadowBlur = 4;
  ctx.shadowOffsetY = 2;
  ctx.fillStyle = "#2a1804";
  ctx.fill(p);
  ctx.restore();
  const g = ctx.createLinearGradient(0, 40, 60, 480);
  g.addColorStop(0, "#fff6d2");
  g.addColorStop(0.22, "#f0c860");
  g.addColorStop(0.45, "#9a6a1c");
  g.addColorStop(0.62, "#e8b850");
  g.addColorStop(0.85, "#5a3a0a");
  g.addColorStop(1, "#9a6a1c");
  ctx.fillStyle = g;
  ctx.fill(p);
  ctx.save();
  ctx.clip(p);
  ctx.lineWidth = 2.4 * px;
  ctx.strokeStyle = "rgba(255,250,225,.7)";
  ctx.translate(-0.8 * px, -1 * px);
  ctx.stroke(p);
  ctx.strokeStyle = "rgba(40,20,0,.6)";
  ctx.translate(1.6 * px, 2 * px);
  ctx.stroke(p);
  ctx.restore();
  ctx.lineWidth = 1.1 * px;
  ctx.strokeStyle = "#2a1804";
  ctx.stroke(p);
  ctx.restore();
}

export function shade(hex: string, k: number): string {
  const n = parseInt(hex.slice(1), 16);
  const f = (c: number) => Math.round(k >= 0 ? c + (255 - c) * k : c * (1 + k));
  return `rgb(${f(n >> 16)},${f((n >> 8) & 255)},${f(n & 255)})`;
}

/** Caveira do Tabler (IconSkull, MIT), 24 × 24: marca de caído. */
const SKULL = [
  "M12 4c4.418 0 8 3.358 8 7.5c0 1.901 -.755 3.637 -2 4.96l0 2.54a1 1 0 0 1 -1 1h-10a1 1 0 0 1 -1 -1v-2.54c-1.245 -1.322 -2 -3.058 -2 -4.96c0 -4.142 3.582 -7.5 8 -7.5",
  "M10 17v3",
  "M14 17v3",
  "M8 11a1 1 0 1 0 2 0a1 1 0 1 0 -2 0",
  "M14 11a1 1 0 1 0 2 0a1 1 0 1 0 -2 0",
].map((d) => new Path2D(d));

function skull(ctx: CanvasRenderingContext2D, s: number) {
  ctx.save();
  ctx.scale(s / 24, s / 24);
  ctx.translate(-12, -12);
  ctx.strokeStyle = "#f3e9d6";
  ctx.lineWidth = 2.2;
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  ctx.shadowColor = "rgba(0,0,0,.8)";
  ctx.shadowBlur = 3;
  for (const p of SKULL) ctx.stroke(p);
  ctx.restore();
}

export interface Portrait {
  color: string;
  avatar: HTMLImageElement | null;
  initials: string;
  down: boolean;
}

/** Retrato recortado na forma: avatar, ou a cor do token com as iniciais. Caído: cinza e escurecido. Vinheta por dentro. */
function portrait(ctx: CanvasRenderingContext2D, kind: FrameKind, r: number, who: Portrait) {
  const box = r * 1.2;
  ctx.save();
  ctx.clip(framePath(kind, r));
  if (who.avatar) {
    ctx.fillStyle = who.color;
    ctx.fillRect(-box, -box, box * 2, box * 2);
    const s = r * 2.15;
    ctx.drawImage(who.avatar, -s / 2, -s / 2, s, s);
  } else {
    const g = ctx.createRadialGradient(-r * 0.3, -r * 0.4, r * 0.1, 0, 0, r * 1.2);
    g.addColorStop(0, shade(who.color, 0.25));
    g.addColorStop(1, shade(who.color, -0.35));
    ctx.fillStyle = g;
    ctx.fillRect(-box, -box, box * 2, box * 2);
    if (!who.down) {
      ctx.fillStyle = "rgba(255,248,235,.95)";
      ctx.font = `700 ${r * 0.7}px Cinzel, serif`;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.shadowColor = "rgba(0,0,0,.5)";
      ctx.shadowBlur = r * 0.1;
      ctx.shadowOffsetY = r * 0.04;
      ctx.fillText(who.initials, 0, r * 0.05);
      ctx.shadowColor = "transparent";
    }
  }
  if (who.down) {
    ctx.globalCompositeOperation = "saturation";
    ctx.fillStyle = "#000";
    ctx.fillRect(-box, -box, box * 2, box * 2);
    ctx.globalCompositeOperation = "source-over";
    ctx.fillStyle = "rgba(20,10,10,.45)";
    ctx.fillRect(-box, -box, box * 2, box * 2);
  }
  const v = ctx.createRadialGradient(0, -r * 0.1, r * 0.55, 0, 0, r * 1.05);
  v.addColorStop(0, "rgba(0,0,0,0)");
  v.addColorStop(1, "rgba(0,0,0,.55)");
  ctx.fillStyle = v;
  ctx.fillRect(-box, -box, box * 2, box * 2);
  ctx.restore();
}

// ---------- molduras ----------

/** Bronze forjado: anel de metal grosso com rebites e a cor do token numa faixa fina por dentro. */
function drawForged(ctx: CanvasRenderingContext2D, kind: FrameKind, R: number, who: Portrait) {
  const metal = METAL_OF[kind];
  const ringW = R * 0.18;
  const band = R * 0.055;
  metalRing(ctx, kind, R, R - ringW, metal);
  ctx.save();
  ctx.clip(ringPath(kind, R - ringW, R - ringW - band), "evenodd");
  ctx.fillStyle = who.color;
  ctx.fillRect(-R, -R, R * 2, R * 2);
  ctx.restore();
  portrait(ctx, kind, R - ringW - band, who);
  const rr = R * 0.045;
  if (kind === "mob") {
    const k = (R - ringW / 2) * 0.86;
    for (const [x, y] of [
      [-k, -k],
      [k, -k],
      [k, k],
      [-k, k],
    ])
      rivet(ctx, x, y, rr, metal);
  } else {
    const n = kind === "ally" ? 8 : 6;
    for (let i = 0; i < n; i++) {
      const [x, y] = edgePoint(kind, R - ringW / 2, -Math.PI / 2 + (i * 2 * Math.PI) / n);
      rivet(ctx, x, y, rr, metal);
    }
  }
  if (who.down) skull(ctx, R * 0.8);
}

/** Peça de metal de forma livre: sombra, metal com luz de cima, desgaste e relevo por dentro da borda. */
function metalShape(ctx: CanvasRenderingContext2D, path: Path2D, m: Metal, R: number, rule: CanvasFillRule = "nonzero") {
  const box = R * 2;
  ctx.save();
  ctx.shadowColor = "rgba(0,0,0,.7)";
  ctx.shadowBlur = R * 0.12;
  ctx.shadowOffsetY = R * 0.05;
  ctx.fillStyle = "#000";
  ctx.fill(path, rule);
  ctx.restore();
  ctx.save();
  ctx.clip(path, rule);
  const g = ctx.createLinearGradient(-R * 0.6, -R * 1.2, R * 0.6, R * 1.2);
  g.addColorStop(0, m.hi);
  g.addColorStop(0.3, m.mid);
  g.addColorStop(0.5, m.lo);
  g.addColorStop(0.7, m.mid);
  g.addColorStop(1, m.lo);
  ctx.fillStyle = g;
  ctx.fillRect(-box, -box, box * 2, box * 2);
  ctx.globalCompositeOperation = "multiply";
  ctx.globalAlpha = 0.5;
  const pattern = ctx.createPattern(grain(), "repeat");
  if (pattern) {
    pattern.setTransform(new DOMMatrix().scale(R / 70));
    ctx.fillStyle = pattern;
    ctx.fillRect(-box, -box, box * 2, box * 2);
  }
  ctx.globalCompositeOperation = "source-over";
  ctx.globalAlpha = 1;
  const lw = R * 0.025;
  ctx.lineWidth = lw * 2;
  ctx.save();
  ctx.translate(-lw * 0.4, -lw * 0.6);
  ctx.strokeStyle = "rgba(255,245,215,.55)";
  ctx.stroke(path);
  ctx.restore();
  ctx.save();
  ctx.translate(lw * 0.4, lw * 0.6);
  ctx.strokeStyle = "rgba(0,0,0,.55)";
  ctx.stroke(path);
  ctx.restore();
  ctx.restore();
  ctx.lineWidth = R * 0.012;
  ctx.strokeStyle = m.edge;
  ctx.stroke(path);
}

/** Filete de ouro em relevo: sombra embaixo, fio de ouro e brilho em cima. */
function goldWire(ctx: CanvasRenderingContext2D, path: Path2D, w: number) {
  ctx.save();
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  const layers: [string, number][] = [
    ["rgba(0,0,0,.7)", 1.9],
    ["#7a5414", 1.3],
    ["#e8c070", 0.8],
  ];
  for (const [color, k] of layers) {
    ctx.strokeStyle = color;
    ctx.lineWidth = w * k;
    ctx.stroke(path);
  }
  ctx.translate(-w * 0.15, -w * 0.2);
  ctx.strokeStyle = "rgba(255,248,220,.85)";
  ctx.lineWidth = w * 0.3;
  ctx.stroke(path);
  ctx.restore();
}

/** Voluta: sai de (x, y) na direção (dx, dy), curva e termina enrolada em espiral para o lado `turn` (±1). */
function scroll(p: Path2D, x: number, y: number, dx: number, dy: number, len: number, turn: number) {
  const nx = -dy * turn;
  const ny = dx * turn;
  const ex = x + dx * len + nx * len * 0.12;
  const ey = y + dy * len + ny * len * 0.12;
  p.moveTo(x, y);
  p.quadraticCurveTo(x + dx * len * 0.6, y + dy * len * 0.6, ex, ey);
  const r0 = len * 0.22;
  const cx = ex + nx * r0;
  const cy = ey + ny * r0;
  const a0 = Math.atan2(ey - cy, ex - cx);
  const steps = 26;
  for (let i = 1; i <= steps; i++) {
    const t = i / steps;
    const a = a0 + turn * t * Math.PI * 2.3;
    const r = r0 * (1 - t * 0.72);
    p.lineTo(cx + Math.cos(a) * r, cy + Math.sin(a) * r);
  }
}

const IRON_DARK: Metal = { hi: "#9a9ca3", mid: "#4a4c54", lo: "#16161a", edge: "#08080a" };

/** Contorno de fora da moldura de chefe: quadrado de quinas pouco arredondadas, com o arco gótico no alto. */
function bossOutline(R: number): Path2D {
  const c = R * 0.18;
  const p = new Path2D();
  p.moveTo(-R + c, -R);
  p.lineTo(-R * 0.3, -R);
  p.quadraticCurveTo(-R * 0.12, -R * 1.02, 0, -R * 1.24);
  p.quadraticCurveTo(R * 0.12, -R * 1.02, R * 0.3, -R);
  p.lineTo(R - c, -R);
  p.quadraticCurveTo(R, -R, R, -R + c);
  p.lineTo(R, R - c);
  p.quadraticCurveTo(R, R, R - c, R);
  p.lineTo(-R + c, R);
  p.quadraticCurveTo(-R, R, -R, R - c);
  p.lineTo(-R, -R + c);
  p.quadraticCurveTo(-R, -R, -R + c, -R);
  p.closePath();
  return p;
}

/** Contorno de fora do token (para o anel da vez e a seleção): o da moldura de chefe, ou a forma do lado. */
export function tokenOutline(kind: FrameKind, boss: boolean, R: number): Path2D {
  return boss ? bossOutline(R) : framePath(kind, R);
}

/**
 * Moldura do chefe, inspirada nas molduras de cartas: o contorno não segue o retrato (o alto sobe num arco
 * gótico com um rubi), base de ferro escuro, filete de ouro que corre a borda e se enrola em volutas nas
 * quinas, rubis lapidados nos lados e a caveira de ouro subindo sobre a borda de baixo (acima da barra de vida).
 * Sempre quadrada, também em NPC chefe.
 */
function drawBoss(ctx: CanvasRenderingContext2D, R: number, who: Portrait) {
  const band = new Path2D();
  band.addPath(bossOutline(R));
  band.addPath(framePath("mob", R * 0.8));
  metalShape(ctx, band, IRON_DARK, R, "evenodd");
  portrait(ctx, "mob", R * 0.8, who);
  ctx.save();
  ctx.lineWidth = R * 0.03;
  ctx.strokeStyle = "#0a0806";
  ctx.stroke(framePath("mob", R * 0.8));
  ctx.restore();
  // Filete contínuo pela borda e volutas nas quatro quinas.
  const m = R * 0.9;
  goldWire(ctx, framePath("mob", m), R * 0.02);
  const curls = new Path2D();
  for (const [sx, sy] of [
    [-1, -1],
    [1, -1],
    [1, 1],
    [-1, 1],
  ]) {
    const turn = sx * sy > 0 ? 1 : -1;
    scroll(curls, sx * m * 0.62, sy * m, sx, 0, R * 0.2, -turn);
    scroll(curls, sx * m, sy * m * 0.62, 0, sy, R * 0.2, turn);
  }
  goldWire(ctx, curls, R * 0.018);
  ruby(ctx, 0, -R * 1.02, R * 0.1);
  ruby(ctx, -m, 0, R * 0.13);
  ruby(ctx, m, 0, R * 0.13);
  goldPiece(ctx, DAEMON_SKULL, 0, R * 0.82, R * 0.52);
  if (who.down) skull(ctx, R * 0.8);
}

// ---------- cache ----------

export interface TokenArtSpec extends Portrait {
  kind: FrameKind;
  boss: boolean;
  /** Raio do token em unidades do mapa. */
  r: number;
}

export interface TokenArt {
  canvas: HTMLCanvasElement;
  /** A imagem cobre de -extent a +extent (unidades do mapa) nos dois eixos. */
  extent: number;
}

const avatarIds = new WeakMap<HTMLImageElement, number>();
let nextAvatarId = 1;
const cache = new Map<string, TokenArt>();
const CACHE_MAX = 240;

/** Fonte das iniciais carregada? Antes disso a imagem não é guardada (sairia com a fonte de reserva). */
const fontReady = () => document.fonts?.check("700 16px Cinzel") ?? true;

/**
 * Token pronto (moldura + retrato) para desenhar com `drawImage`, na resolução de `pxPerUnit` pixels de
 * tela por unidade do mapa. A resolução anda em degraus (2^¼): zoom contínuo não refaz a imagem a cada passo.
 */
export function tokenArt(spec: TokenArtSpec, pxPerUnit: number): TokenArt {
  const step = Math.pow(2, Math.ceil(Math.log2(Math.max(0.25, pxPerUnit)) * 4) / 4);
  let avatarId = 0;
  if (spec.avatar) {
    avatarId = avatarIds.get(spec.avatar) ?? 0;
    if (!avatarId) avatarIds.set(spec.avatar, (avatarId = nextAvatarId++));
  }
  const key = [spec.kind, spec.boss ? 1 : 0, spec.color, avatarId, spec.initials, spec.down ? 1 : 0, spec.r.toFixed(2), step].join("|");
  const hit = cache.get(key);
  if (hit) {
    // Mais usado por último: fica no fim (o mais antigo sai primeiro).
    cache.delete(key);
    cache.set(key, hit);
    return hit;
  }
  const extent = spec.r * (spec.boss ? EXTENT.boss : EXTENT.normal);
  const side = Math.max(8, Math.min(1024, Math.ceil(extent * 2 * step)));
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = side;
  const ctx = canvas.getContext("2d")!;
  const k = side / (extent * 2);
  ctx.translate(side / 2, side / 2);
  ctx.scale(k, k);
  if (spec.boss) drawBoss(ctx, spec.r, spec);
  else drawForged(ctx, spec.kind, spec.r, spec);
  const art = { canvas, extent };
  if (fontReady() || spec.avatar) {
    cache.set(key, art);
    if (cache.size > CACHE_MAX) cache.delete(cache.keys().next().value!);
  }
  return art;
}

// ---------- ao vivo (em volta da imagem) ----------

/** Halo da vez, por baixo do token: sombra escura (contraste até sobre areia) e brilho quente pulsando. */
export function drawTurnHalo(ctx: CanvasRenderingContext2D, R: number, t: number) {
  const k = 0.5 + 0.5 * Math.sin(t * 2.6);
  ctx.save();
  const dark = ctx.createRadialGradient(0, 0, R, 0, 0, R * 1.9);
  dark.addColorStop(0, "rgba(10,6,2,.6)");
  dark.addColorStop(1, "rgba(10,6,2,0)");
  ctx.fillStyle = dark;
  ctx.beginPath();
  ctx.arc(0, 0, R * 1.9, 0, Math.PI * 2);
  ctx.fill();
  const halo = ctx.createRadialGradient(0, 0, R * 0.9, 0, 0, R * 1.7);
  halo.addColorStop(0, `rgba(255,196,80,${0.7 + 0.25 * k})`);
  halo.addColorStop(1, "rgba(255,196,80,0)");
  ctx.fillStyle = halo;
  ctx.beginPath();
  ctx.arc(0, 0, R * 1.7, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

/** Contorno aceso da vez, por cima da moldura (acompanha o contorno dela), com dois arcos de luz girando. */
export function drawTurnRing(ctx: CanvasRenderingContext2D, kind: FrameKind, boss: boolean, R: number, t: number) {
  const edge = tokenOutline(kind, boss, R * 1.1);
  ctx.save();
  ctx.shadowColor = "#ffb84a";
  ctx.shadowBlur = R * 0.45;
  ctx.strokeStyle = "#ffe4a0";
  ctx.lineWidth = R * 0.08;
  ctx.stroke(edge);
  ctx.shadowBlur = R * 0.3;
  for (const off of [0, Math.PI]) {
    const g = ctx.createConicGradient(t * 1.4 + off, 0, 0);
    g.addColorStop(0, "rgba(255,255,240,1)");
    g.addColorStop(0.16, "rgba(255,220,140,0)");
    g.addColorStop(1, "rgba(255,220,140,0)");
    ctx.strokeStyle = g;
    ctx.lineWidth = R * 0.14;
    ctx.stroke(edge);
  }
  ctx.restore();
}

/** Seleção: tracejado claro andando em volta. */
export function drawSelection(ctx: CanvasRenderingContext2D, kind: FrameKind, boss: boolean, R: number, t: number) {
  ctx.save();
  ctx.strokeStyle = "rgba(236,228,212,.95)";
  ctx.lineWidth = R * 0.045;
  ctx.setLineDash([R * 0.18, R * 0.12]);
  ctx.lineDashOffset = -t * R * 0.4;
  ctx.shadowColor = "rgba(0,0,0,.8)";
  ctx.shadowBlur = 3;
  ctx.stroke(tokenOutline(kind, boss, R * 1.13));
  ctx.restore();
}

// ---------- placas de nome (L3) ----------

/** Estilo da placa: o metal acompanha a moldura; pet tem placa menor; chefe tem a fita de pergaminho. */
export type PlateStyle = "ally" | "mob" | "npc" | "pet" | "boss";

const PLATE_METAL: Record<"ally" | "mob" | "npc" | "pet", Metal> = { ally: METALS.bronze, mob: METALS.iron, npc: METALS.silver, pet: METALS.bronze };

/**
 * Placa com o nome, centrada em x = 0 e com o topo em `y`. `u` é o tamanho da letra em unidades do mapa
 * (as medidas do protótipo eram para letra de 11 px). Devolve a altura ocupada.
 */
export function drawNamePlate(ctx: CanvasRenderingContext2D, text: string, style: PlateStyle, y: number, u: number): number {
  if (style === "boss") return drawBossRibbon(ctx, text, y, u * 1.15);
  const k = (style === "pet" ? u * 0.82 : u) / 11;
  const m = PLATE_METAL[style];
  ctx.save();
  ctx.font = `700 ${11 * k}px "Alegreya Sans", sans-serif`;
  const w = ctx.measureText(text).width + (style === "pet" ? 10 : 16) * k;
  const h = (style === "pet" ? 13 : 16) * k;
  const l = -w / 2;
  const plate = new Path2D();
  plate.roundRect(l, y, w, h, 3 * k);
  ctx.shadowColor = "rgba(0,0,0,.7)";
  ctx.shadowBlur = 5 * k;
  ctx.shadowOffsetY = 1.5 * k;
  ctx.fillStyle = "#17131b";
  ctx.fill(plate);
  ctx.shadowColor = "transparent";
  const g = ctx.createLinearGradient(0, y, 0, y + h);
  g.addColorStop(0, m.hi);
  g.addColorStop(0.5, m.mid);
  g.addColorStop(1, m.lo);
  ctx.strokeStyle = g;
  ctx.lineWidth = 1.5 * k;
  ctx.stroke(plate);
  if (style !== "pet") {
    rivet(ctx, l + 4 * k, y + h / 2, 1.6 * k, m);
    rivet(ctx, l + w - 4 * k, y + h / 2, 1.6 * k, m);
  }
  ctx.fillStyle = "#f1e7d3";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(text, 0, y + h / 2 + 0.5 * k);
  ctx.restore();
  return h;
}

/** Escudinho com o número (mobs repetidos: "2" em vez de "Goblin 2"), centrado em x = 0, topo em `y`. */
export function drawNumberShield(ctx: CanvasRenderingContext2D, n: number, y: number, u: number): number {
  const k = u / 11;
  const r = 8 * k;
  const cy = y + r * 0.8;
  ctx.save();
  ctx.shadowColor = "rgba(0,0,0,.7)";
  ctx.shadowBlur = 4 * k;
  const g = ctx.createRadialGradient(-2 * k, cy - 3 * k, 1, 0, cy, r);
  g.addColorStop(0, "#3a3540");
  g.addColorStop(1, "#141018");
  ctx.fillStyle = g;
  const p = new Path2D();
  p.moveTo(-r, cy - r * 0.8);
  p.lineTo(r, cy - r * 0.8);
  p.lineTo(r, cy + r * 0.1);
  p.quadraticCurveTo(r * 0.9, cy + r * 0.8, 0, cy + r * 1.15);
  p.quadraticCurveTo(-r * 0.9, cy + r * 0.8, -r, cy + r * 0.1);
  p.closePath();
  ctx.fill(p);
  ctx.shadowColor = "transparent";
  const sg = ctx.createLinearGradient(0, cy - r, 0, cy + r);
  sg.addColorStop(0, METALS.iron.hi);
  sg.addColorStop(1, METALS.iron.lo);
  ctx.strokeStyle = sg;
  ctx.lineWidth = 1.2 * k;
  ctx.stroke(p);
  ctx.fillStyle = "#f1e7d3";
  ctx.font = `700 ${10 * k}px "Alegreya Sans", sans-serif`;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(String(n), 0, cy + 0.5 * k);
  ctx.restore();
  return r * 1.95;
}

/**
 * Fita de pergaminho do chefe, na estética da moldura dele: rabos dobrados em couro escuro, pergaminho com
 * textura, dois filetes de ouro nas bordas, letra Cinzel em sangue escuro e um rubi pequeno de cada lado.
 */
function drawBossRibbon(ctx: CanvasRenderingContext2D, text: string, y: number, u: number): number {
  const k = u / 11;
  ctx.save();
  ctx.font = `700 ${11 * k}px Cinzel, serif`;
  const tw = ctx.measureText(text).width;
  const w = tw + 34 * k;
  const h = 17 * k;
  const l = -w / 2;
  // Rabos dobrados (atrás), em couro escuro.
  const tail = (x0: number, dir: number) => {
    const p = new Path2D();
    p.moveTo(x0, y + 4 * k);
    p.lineTo(x0 + dir * 11 * k, y + 4 * k);
    p.lineTo(x0 + dir * 6 * k, y + 10.5 * k);
    p.lineTo(x0 + dir * 11 * k, y + 17 * k);
    p.lineTo(x0, y + 17 * k);
    p.closePath();
    const g = ctx.createLinearGradient(0, y + 4 * k, 0, y + 17 * k);
    g.addColorStop(0, "#5a3a22");
    g.addColorStop(1, "#2a160a");
    ctx.fillStyle = g;
    ctx.fill(p);
    ctx.strokeStyle = "#1a0c04";
    ctx.lineWidth = 0.8 * k;
    ctx.stroke(p);
  };
  tail(l + 3 * k, -1);
  tail(l + w - 3 * k, 1);
  // Faixa de pergaminho, com a curvinha de fita.
  const band = new Path2D();
  band.moveTo(l, y);
  band.quadraticCurveTo(0, y + 3.5 * k, l + w, y);
  band.lineTo(l + w, y + h - 3 * k);
  band.quadraticCurveTo(0, y + h + 0.5 * k, l, y + h - 3 * k);
  band.closePath();
  ctx.shadowColor = "rgba(0,0,0,.65)";
  ctx.shadowBlur = 5 * k;
  ctx.shadowOffsetY = 1.5 * k;
  const pg = ctx.createLinearGradient(0, y, 0, y + h);
  pg.addColorStop(0, "#f4e6c4");
  pg.addColorStop(1, "#c8ac78");
  ctx.fillStyle = pg;
  ctx.fill(band);
  ctx.shadowColor = "transparent";
  ctx.save();
  ctx.clip(band);
  ctx.globalCompositeOperation = "multiply";
  ctx.globalAlpha = 0.35;
  const pattern = ctx.createPattern(grain(), "repeat");
  if (pattern) {
    pattern.setTransform(new DOMMatrix().scale(k * 0.6));
    ctx.fillStyle = pattern;
    ctx.fillRect(l, y - 2 * k, w, h + 4 * k);
  }
  ctx.restore();
  // Filetes de ouro acompanhando a curva da fita.
  const edge = (y0: number, bulge: number) => {
    const p = new Path2D();
    p.moveTo(l + 2 * k, y0);
    p.quadraticCurveTo(0, y0 + bulge, l + w - 2 * k, y0);
    return p;
  };
  ctx.lineCap = "round";
  for (const p of [edge(y + 2.2 * k, 3.5 * k), edge(y + h - 4.6 * k, 3.5 * k)]) {
    ctx.strokeStyle = "#7a5414";
    ctx.lineWidth = 1.3 * k;
    ctx.stroke(p);
    ctx.strokeStyle = "#e8c070";
    ctx.lineWidth = 0.7 * k;
    ctx.stroke(p);
  }
  ctx.strokeStyle = "#5a3a1a";
  ctx.lineWidth = 0.8 * k;
  ctx.stroke(band);
  ctx.fillStyle = "#4a120c";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(text, 0, y + h / 2 + 1 * k);
  ruby(ctx, l + 7 * k, y + h / 2 + 0.5 * k, 2.6 * k);
  ruby(ctx, l + w - 7 * k, y + h / 2 + 0.5 * k, 2.6 * k);
  ctx.restore();
  return h + 1 * k;
}

// ---------- condições (L3) ----------

/**
 * Medalhão de condição centrado em (x, y), raio `mr`: disco escuro com aro de bronze e o ícone da condição
 * em pergaminho (ou um texto, como "+2"). Concentração ganha o aro azul (é escolha de quem conjura, não mal).
 */
export function drawConditionMedal(ctx: CanvasRenderingContext2D, x: number, y: number, mr: number, name: string | null, text?: string) {
  ctx.save();
  ctx.translate(x, y);
  ctx.shadowColor = "rgba(0,0,0,.7)";
  ctx.shadowBlur = mr * 0.5;
  ctx.shadowOffsetY = mr * 0.12;
  const disc = ctx.createRadialGradient(-mr * 0.3, -mr * 0.35, mr * 0.1, 0, 0, mr);
  disc.addColorStop(0, "#3a3240");
  disc.addColorStop(1, "#110e14");
  ctx.fillStyle = disc;
  ctx.beginPath();
  ctx.arc(0, 0, mr, 0, Math.PI * 2);
  ctx.fill();
  ctx.shadowColor = "transparent";
  const blue = name === "Concentração";
  const rim = ctx.createLinearGradient(0, -mr, 0, mr);
  rim.addColorStop(0, blue ? "#cfe6ff" : METALS.bronze.hi);
  rim.addColorStop(0.5, blue ? "#4f8fc0" : METALS.bronze.mid);
  rim.addColorStop(1, blue ? "#173a5a" : METALS.bronze.lo);
  ctx.strokeStyle = rim;
  ctx.lineWidth = mr * 0.2;
  ctx.beginPath();
  ctx.arc(0, 0, mr * 0.9, 0, Math.PI * 2);
  ctx.stroke();
  if (text !== undefined) {
    ctx.fillStyle = "#f1e7d3";
    ctx.font = `700 ${mr * 1.05}px "Alegreya Sans", sans-serif`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(text, 0, mr * 0.06);
  } else {
    const d = (name && CONDITION_ICONS[name]) || CONDITION_OTHER;
    let p = iconPaths.get(d);
    if (!p) iconPaths.set(d, (p = new Path2D(d)));
    const side = mr * 1.2;
    ctx.scale(side / 512, side / 512);
    ctx.translate(-256, -256);
    ctx.shadowColor = "rgba(0,0,0,.8)";
    ctx.shadowBlur = 2;
    ctx.fillStyle = "#f1e7d3";
    ctx.fill(p);
  }
  ctx.restore();
}

// ---------- barra de vida (L4) ----------

/** O que a barra mostra agora: a vida que desliza (`shown`), o dano fantasma e o brilho da cura (0 a 1). */
export interface HpBarState {
  shown: number;
  ghost: number;
  flash: number;
  max: number;
  temp: number;
}

/** Faixas de vida (as cores do tema, guia visual): claro, meio e escuro de cada uma. */
const HP_FILL = {
  full: ["#9fd8c2", "#4fae8c", "#24624f"],
  mid: ["#e8d4ab", "#c19a62", "#6e5331"],
  low: ["#e58a8f", "#c94a52", "#6b2a30"],
  boss: ["#ff9a8a", "#b3221c", "#4a0806"],
};

/** Vida, fantasma, vida temporária (escudo listrado), brilho e marcas a cada 25%, dentro da área já recortada. */
function hpFill(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, s: HpBarState, boss: boolean) {
  const total = s.max + s.temp;
  if (total <= 0) return;
  ctx.fillStyle = "rgba(236,228,212,.85)";
  ctx.fillRect(x, y, (w * Math.max(0, s.ghost)) / total, h);
  const ratio = s.max > 0 ? s.shown / s.max : 0;
  const [c0, c1, c2] = boss ? HP_FILL.boss : ratio > 0.5 ? HP_FILL.full : ratio > 0.25 ? HP_FILL.mid : HP_FILL.low;
  const hw = (w * Math.max(0, s.shown)) / total;
  const g = ctx.createLinearGradient(0, y, 0, y + h);
  g.addColorStop(0, c0);
  g.addColorStop(0.4, c1);
  g.addColorStop(1, c2);
  ctx.fillStyle = g;
  ctx.fillRect(x, y, hw, h);
  if (s.temp > 0) {
    const tw = (w * s.temp) / total;
    const sg = ctx.createLinearGradient(0, y, 0, y + h);
    sg.addColorStop(0, "#e2efff");
    sg.addColorStop(1, "#5b86b8");
    ctx.fillStyle = sg;
    ctx.fillRect(x + hw, y, tw, h);
    ctx.save();
    ctx.beginPath();
    ctx.rect(x + hw, y, tw, h);
    ctx.clip();
    ctx.strokeStyle = "rgba(255,255,255,.45)";
    ctx.lineWidth = h * 0.18;
    for (let i = x + hw + h * 0.6; i < x + hw + tw + h; i += h * 0.7) {
      ctx.beginPath();
      ctx.moveTo(i, y);
      ctx.lineTo(i - h, y + h);
      ctx.stroke();
    }
    ctx.restore();
  }
  ctx.fillStyle = "rgba(255,255,255,.28)";
  ctx.fillRect(x, y + h * 0.08, hw, h * 0.28);
  if (s.flash > 0) {
    ctx.fillStyle = `rgba(200,255,220,${s.flash * 0.6})`;
    ctx.fillRect(x, y, hw, h);
  }
  ctx.fillStyle = "rgba(0,0,0,.5)";
  for (let i = 1; i < 4; i++) ctx.fillRect(x + (w * i) / 4 - h * 0.06, y, h * 0.12, h);
  // Calha funda: sombra por dentro, em cima.
  const inner = ctx.createLinearGradient(0, y, 0, y + h);
  inner.addColorStop(0, "rgba(0,0,0,.45)");
  inner.addColorStop(0.3, "rgba(0,0,0,0)");
  ctx.fillStyle = inner;
  ctx.fillRect(x, y, w, h);
}

function bronzeV(ctx: CanvasRenderingContext2D, y0: number, y1: number) {
  const g = ctx.createLinearGradient(0, y0, 0, y1);
  g.addColorStop(0, "#f2e6cd");
  g.addColorStop(0.5, "#c19a62");
  g.addColorStop(1, "#6e5331");
  return g;
}

function diamond(ctx: CanvasRenderingContext2D, x: number, y: number, s: number) {
  ctx.beginPath();
  ctx.moveTo(x, y - s);
  ctx.lineTo(x + s * 0.75, y);
  ctx.lineTo(x, y + s);
  ctx.lineTo(x - s * 0.75, y);
  ctx.closePath();
  ctx.fill();
}

/**
 * Barra de vida do token, centrada em x = 0, com o topo em `y`, largura `w` e altura `h`. Comum: a "pílula
 * forjada leve" (calha funda, fio de bronze, losangos nas pontas). Chefe: placa de ferro escuro com pontas
 * em chanfro, filete de ouro, vida em carmesim e um rubi na ponta.
 */
export function drawHpBar(ctx: CanvasRenderingContext2D, y: number, w: number, h: number, s: HpBarState, boss: boolean) {
  const x = -w / 2;
  ctx.save();
  if (boss) {
    const k = h * 0.9;
    const plate = new Path2D();
    const px = x - h * 0.5;
    const pw = w + h;
    const py = y - h * 0.35;
    const ph = h * 1.7;
    plate.moveTo(px + k, py);
    plate.lineTo(px + pw - k, py);
    plate.lineTo(px + pw, py + ph / 2);
    plate.lineTo(px + pw - k, py + ph);
    plate.lineTo(px + k, py + ph);
    plate.lineTo(px, py + ph / 2);
    plate.closePath();
    metalShape(ctx, plate, IRON_DARK, ph * 2.2);
    const slot = new Path2D();
    slot.roundRect(x + h * 0.4, y, w - h * 0.8, h, h * 0.2);
    ctx.fillStyle = "#070508";
    ctx.fill(slot);
    ctx.save();
    ctx.clip(slot);
    hpFill(ctx, x + h * 0.4, y, w - h * 0.8, h, s, true);
    ctx.restore();
    ctx.lineWidth = h * 0.14;
    ctx.strokeStyle = "#e8c070";
    ctx.stroke(slot);
    ruby(ctx, px + h * 0.15, y + h / 2, h * 0.55);
    ctx.restore();
    return;
  }
  const r = h / 2;
  const pill = new Path2D();
  pill.roundRect(x, y, w, h, r);
  ctx.shadowColor = "rgba(0,0,0,.6)";
  ctx.shadowBlur = h * 0.6;
  ctx.shadowOffsetY = h * 0.15;
  ctx.fillStyle = "#0b090e";
  ctx.fill(pill);
  ctx.shadowColor = "transparent";
  ctx.save();
  ctx.clip(pill);
  const trough = ctx.createLinearGradient(0, y, 0, y + h);
  trough.addColorStop(0, "#050407");
  trough.addColorStop(1, "#1f1b25");
  ctx.fillStyle = trough;
  ctx.fillRect(x, y, w, h);
  hpFill(ctx, x, y, w, h, s, false);
  ctx.restore();
  ctx.strokeStyle = bronzeV(ctx, y, y + h);
  ctx.lineWidth = h * 0.18;
  ctx.stroke(pill);
  ctx.fillStyle = bronzeV(ctx, y - h * 0.4, y + h * 1.4);
  diamond(ctx, x - h * 0.15, y + h / 2, h * 0.75);
  diamond(ctx, x + w + h * 0.15, y + h / 2, h * 0.75);
  ctx.restore();
}
