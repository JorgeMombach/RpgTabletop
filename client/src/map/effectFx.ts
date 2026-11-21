import type { EffectPreset } from "@rpg/shared";
import { effectTexture, TILE } from "./effectTextures";

/**
 * Efeitos animados no mapa (E24): camadas de ruído que andam em direções diferentes e partículas
 * com brilho aditivo, desenhadas no canvas do Konva. Tudo gerado por código (nada para baixar).
 * Coordenadas em pixels do mapa; tamanhos proporcionais ao quadrado do grid (`cell`).
 * O recorte com borda difusa fica em EffectShape (máscara borrada do formato da área).
 */

type Ctx = CanvasRenderingContext2D;

export interface Box {
  x: number;
  y: number;
  w: number;
  h: number;
}

/** Área do efeito: `box` = retângulo a preencher (com folga para a borda difusa); `inside` = onde nascem partículas. */
export interface FxArea {
  box: Box;
  inside: (x: number, y: number) => boolean;
}

/* ---------- ruído que emenda sem costura ---------- */

const NOISE_SIZE = 256;

function rng(seed: number) {
  return () => {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Ruído de valor periódico (fBm): o ladrilho repete sem emenda. Valores em [0, 1]. */
function periodicNoise(seed: number, octaves: number[]): Float32Array {
  const out = new Float32Array(NOISE_SIZE * NOISE_SIZE);
  const r = rng(seed);
  let amp = 1;
  let total = 0;
  for (const cells of octaves) {
    const lattice = Array.from({ length: cells * cells }, r);
    const at = (i: number, j: number) => lattice[((j + cells) % cells) * cells + ((i + cells) % cells)];
    const step = NOISE_SIZE / cells;
    for (let y = 0; y < NOISE_SIZE; y++) {
      const gy = y / step;
      const j = Math.floor(gy);
      const fy = gy - j;
      const sy = fy * fy * (3 - 2 * fy);
      for (let x = 0; x < NOISE_SIZE; x++) {
        const gx = x / step;
        const i = Math.floor(gx);
        const fx = gx - i;
        const sx = fx * fx * (3 - 2 * fx);
        const top = at(i, j) + (at(i + 1, j) - at(i, j)) * sx;
        const bottom = at(i, j + 1) + (at(i + 1, j + 1) - at(i, j + 1)) * sx;
        out[y * NOISE_SIZE + x] += (top + (bottom - top) * sy) * amp;
      }
    }
    total += amp;
    amp *= 0.5;
  }
  for (let k = 0; k < out.length; k++) out[k] /= total;
  return out;
}

const textures = new Map<string, HTMLCanvasElement>();

/** Ladrilho de ruído colorido: `paint` recebe o valor (0–1) e devolve [r, g, b, a] (0–255). */
function noiseTexture(key: string, seed: number, octaves: number[], paint: (v: number) => [number, number, number, number]) {
  const hit = textures.get(key);
  if (hit) return hit;
  const noise = periodicNoise(seed, octaves);
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = NOISE_SIZE;
  const ctx = canvas.getContext("2d")!;
  const img = ctx.createImageData(NOISE_SIZE, NOISE_SIZE);
  for (let k = 0; k < noise.length; k++) img.data.set(paint(noise[k]), k * 4);
  ctx.putImageData(img, 0, 0);
  textures.set(key, canvas);
  return canvas;
}

const smooth = (a: number, b: number, v: number) => {
  const t = Math.min(1, Math.max(0, (v - a) / (b - a)));
  return t * t * (3 - 2 * t);
};

/** Faixa estreita onde o ruído cruza o meio: linhas finas (reflexos, ondas). */
const ridge = (v: number) => 1 - Math.abs(v * 2 - 1);

/**
 * Ladrilho "andando": repetido, deslocado por (ox, oy), com `tile` px de lado no mapa.
 * `stretch` > 1 alonga na vertical (línguas de fogo); `turn` gira (escuridão rodando).
 */
function drawTiled(
  ctx: Ctx,
  tex: HTMLCanvasElement,
  box: Box,
  tile: number,
  ox: number,
  oy: number,
  alpha: number,
  mode: GlobalCompositeOperation = "source-over",
  stretch = 1,
  turn = 0,
) {
  const pattern = ctx.createPattern(tex, "repeat");
  if (!pattern) return;
  const s = tile / tex.width;
  const cx = box.x + box.w / 2;
  const cy = box.y + box.h / 2;
  pattern.setTransform(
    new DOMMatrix()
      .translateSelf(cx, cy)
      .rotateSelf((turn * 180) / Math.PI)
      .translateSelf(-cx + (ox % tile), -cy + (oy % (tile * stretch)))
      .scaleSelf(s, s * stretch),
  );
  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.globalCompositeOperation = mode;
  ctx.fillStyle = pattern;
  ctx.fillRect(box.x, box.y, box.w, box.h);
  ctx.restore();
}

function fill(ctx: Ctx, box: Box, style: string) {
  ctx.fillStyle = style;
  ctx.fillRect(box.x, box.y, box.w, box.h);
}

/* ---------- partículas ---------- */

const sprites = new Map<string, HTMLCanvasElement>();

/** Brilho redondo (centro forte, borda transparente), desenhado uma vez por cor. */
function glow(r: number, g: number, b: number) {
  const key = `${r},${g},${b}`;
  const hit = sprites.get(key);
  if (hit) return hit;
  const size = 64;
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = size;
  const ctx = canvas.getContext("2d")!;
  const grad = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
  grad.addColorStop(0, `rgba(${r},${g},${b},1)`);
  grad.addColorStop(0.35, `rgba(${r},${g},${b},0.55)`);
  grad.addColorStop(1, `rgba(${r},${g},${b},0)`);
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, size, size);
  sprites.set(key, canvas);
  return canvas;
}

/**
 * Língua de chama: gota com a base redonda embaixo e a ponta fina em cima, centro claro e borda que some. Desenhada
 * uma vez por cor, em pé; quem desenha inclina. A base fica a 70% da altura (o ponto de apoio da chama).
 */
function flameTongue(r: number, g: number, b: number) {
  const key = `tongue:${r},${g},${b}`;
  const hit = sprites.get(key);
  if (hit) return hit;
  const width = 64;
  const height = 96;
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d")!;
  const cx = width / 2;
  const baseY = height * 0.7;
  const radius = width * 0.3;
  // Borda macia: a gota desfocada (sem suporte a filtro, sai só mais nítida).
  ctx.filter = "blur(4px)";
  const grad = ctx.createRadialGradient(cx, baseY, 0, cx, baseY - radius, height * 0.7);
  grad.addColorStop(0, `rgba(${r},${g},${b},1)`);
  grad.addColorStop(0.45, `rgba(${r},${g},${b},0.7)`);
  grad.addColorStop(1, `rgba(${r},${g},${b},0)`);
  ctx.fillStyle = grad;
  ctx.beginPath();
  ctx.moveTo(cx, height * 0.06);
  ctx.bezierCurveTo(cx + radius * 0.35, baseY - radius * 1.6, cx + radius * 1.1, baseY - radius * 0.7, cx + radius, baseY);
  ctx.arc(cx, baseY, radius, 0, Math.PI);
  ctx.bezierCurveTo(cx - radius * 1.1, baseY - radius * 0.7, cx - radius * 0.35, baseY - radius * 1.6, cx, height * 0.06);
  ctx.fill();
  sprites.set(key, canvas);
  return canvas;
}

interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  age: number;
  life: number;
  size: number;
  seed: number;
  /** Raio elétrico: o arco principal e os galhos, cada um uma lista de pontos (x, y, x, y…). */
  bolts?: number[][];
}

/** Uma raiz (ou galho de raiz): pontos relativos ao canto da área, espessura na base e semente do balanço da ponta. */
interface RootPath {
  points: number[];
  width: number;
  seed: number;
}

/** Raízes desenhadas para a área: o corpo parado vai pronto num canvas; só as pontas se mexem. */
interface RootsDrawing {
  w: number;
  h: number;
  color: string;
  paths: RootPath[];
  image: HTMLCanvasElement;
}

/** Estado de cada efeito na tela (partículas vivas, último quadro). */
export interface FxState {
  a: Particle[];
  b: Particle[];
  c: Particle[];
  last: number;
  roots?: RootsDrawing;
  /** Clarão do eletrificado: 1 quando acende, cai até 0 em uma fração de segundo. */
  flash?: number;
}

export function newFxState(): FxState {
  return { a: [], b: [], c: [], last: 0 };
}

/** Ponto aleatório dentro da área (tenta algumas vezes; áreas finas como linhas também funcionam). */
function spawnPoint(area: FxArea): { x: number; y: number } {
  const { box } = area;
  for (let i = 0; i < 16; i++) {
    const p = { x: box.x + Math.random() * box.w, y: box.y + Math.random() * box.h };
    if (area.inside(p.x, p.y)) return p;
  }
  return { x: box.x + box.w / 2, y: box.y + box.h / 2 };
}

/** Quantidade de partículas proporcional à área (em quadrados), com teto para não pesar. */
function budget(area: FxArea, cell: number, perCell: number, max: number) {
  const cells = (area.box.w * area.box.h) / (cell * cell);
  return Math.max(2, Math.min(max, Math.round(cells * perCell)));
}

function step(list: Particle[], dt: number) {
  for (const p of list) {
    p.age += dt;
    p.x += p.vx * dt;
    p.y += p.vy * dt;
  }
  return list.filter((p) => p.age < p.life);
}

/** Mantém `want` partículas vivas, criando novas com `make`. */
function keep(list: Particle[], want: number, make: () => Particle) {
  while (list.length < want) list.push(make());
}

function sprite(ctx: Ctx, img: HTMLCanvasElement, x: number, y: number, w: number, h = w) {
  ctx.drawImage(img, x - w / 2, y - h / 2, w, h);
}

/* ---------- efeitos ---------- */

type Painter = (ctx: Ctx, st: FxState, t: number, dt: number, area: FxArea, cell: number, color: string) => void;

const fire: Painter = (ctx, st, t, dt, area, cell) => {
  const { box } = area;
  // Chão em brasa que pulsa, mais quente no meio.
  fill(ctx, box, `rgba(60, 10, 0, ${0.5 + Math.sin(t * 3.1) * 0.05})`);
  const cx = box.x + box.w / 2;
  const cy = box.y + box.h / 2;
  const core = ctx.createRadialGradient(cx, cy, 0, cx, cy, Math.max(box.w, box.h) / 2);
  core.addColorStop(0, `rgba(255, 150, 40, ${0.35 + Math.sin(t * 7) * 0.05 + Math.sin(t * 13) * 0.04})`);
  core.addColorStop(1, "rgba(255, 80, 0, 0)");
  ctx.save();
  ctx.globalCompositeOperation = "lighter";
  ctx.fillStyle = core;
  ctx.fillRect(box.x, box.y, box.w, box.h);
  ctx.restore();

  // Brasas: rachaduras no chão que acendem e apagam devagar, em duas escalas fora de compasso.
  const cracks = noiseTexture("fire-cracks", 13, [6, 12, 24], (v) => [255, 110 + v * 80, 20, smooth(0.9, 0.985, ridge(v)) * 255]);
  drawTiled(ctx, cracks, box, cell * 3.2, 0, 0, 0.12 + Math.sin(t * 1.7) * 0.07, "lighter");
  drawTiled(ctx, cracks, box, cell * 2.1, cell * 0.6, cell * 0.4, 0.08 + Math.sin(t * 2.3 + 1) * 0.05, "lighter");

  // Calor que ferve no lugar: as camadas rodam devagar em volta de onde estão (visto de cima, fogo não "anda").
  const heat = noiseTexture("fire", 11, [4, 8, 16, 32], (v) => [255, 90 + v * 140, 10 + v * 30, smooth(0.55, 0.9, v) * 255]);
  const flicker = Math.sin(t * 9) * 0.06 + Math.sin(t * 15.7) * 0.04;
  drawTiled(ctx, heat, box, cell * 2.2, Math.sin(t * 0.6) * cell * 0.3, Math.cos(t * 0.5) * cell * 0.3, 0.55 + flicker, "lighter", 1.3);
  drawTiled(ctx, heat, box, cell * 1.4, Math.cos(t * 0.8) * cell * 0.2, -Math.sin(t * 0.7) * cell * 0.25, 0.4 + flicker, "lighter", 1.5);

  // Chamas: línguas que nascem, crescem e encolhem quase no mesmo lugar, balançando com o vento. Por fora a
  // laranja; dentro, menor, a amarela-clara.
  st.a = step(st.a, dt);
  keep(st.a, budget(area, cell, 1.5, 120), () => ({
    ...spawnPoint(area),
    vx: (Math.random() - 0.5) * cell * 0.1,
    vy: -cell * (0.1 + Math.random() * 0.2),
    age: 0,
    life: 0.35 + Math.random() * 0.4,
    size: cell * (0.6 + Math.random() * 0.5),
    seed: Math.random() * 10,
  }));
  const wind = Math.sin(t * 0.4) * 0.15;
  ctx.save();
  ctx.globalCompositeOperation = "lighter";
  for (const p of st.a) {
    const k = p.age / p.life;
    const rise = Math.pow(Math.sin(Math.PI * k), 0.7);
    const width = p.size * (0.85 + Math.sin(t * 11 + p.seed) * 0.12);
    const height = p.size * 1.9 * rise;
    const lean = wind + Math.sin(t * 2.6 + p.seed) * 0.18;
    ctx.save();
    ctx.translate(p.x, p.y);
    ctx.rotate(lean);
    // Brilho na base junta as línguas num fogo só.
    ctx.globalAlpha = rise * 0.25;
    ctx.drawImage(glow(255, 110, 20), -width * 0.6, -width * 0.6, width * 1.2, width * 1.2);
    ctx.globalAlpha = rise * 0.5;
    const outer = k < 0.7 ? flameTongue(255, 120, 20) : flameTongue(200, 45, 10);
    ctx.drawImage(outer, -width / 2, -height * 0.7, width, height);
    ctx.globalAlpha = rise * 0.6;
    ctx.drawImage(flameTongue(255, 230, 150), -width * 0.3, -height * 0.5, width * 0.6, height * 0.6);
    ctx.restore();
  }
  // Fagulhas: saltam para os lados e sobem um pouco, piscando.
  st.b = step(st.b, dt);
  keep(st.b, budget(area, cell, 0.35, 40), () => {
    const angle = Math.random() * Math.PI * 2;
    const speed = cell * (0.3 + Math.random() * 0.5);
    return {
      ...spawnPoint(area),
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed - cell * 0.3,
      age: 0,
      life: 0.6 + Math.random() * 0.8,
      size: cell * (0.06 + Math.random() * 0.06),
      seed: Math.random() * 10,
    };
  });
  for (const p of st.b) {
    ctx.globalAlpha = (1 - p.age / p.life) * (0.6 + Math.sin(t * 20 + p.seed) * 0.4);
    sprite(ctx, glow(255, 200, 90), p.x + Math.sin(t * 3 + p.seed) * cell * 0.15, p.y, p.size * 2);
  }
  ctx.restore();

  // Fumaça escura levada pelo vento por cima das chamas.
  const smoke = noiseTexture("smoke", 71, [3, 6, 12], (v) => [25, 20, 18, smooth(0.5, 0.85, v) * 255]);
  drawTiled(ctx, smoke, box, cell * 5, t * cell * 0.6, -t * cell * 0.9, 0.3);
};

const water: Painter = (ctx, st, t, dt, area, cell) => {
  const { box } = area;
  fill(ctx, box, "rgba(14, 70, 140, 0.55)");
  // Profundidade: manchas escuras que andam devagar.
  const depth = noiseTexture("water-depth", 23, [4, 8, 16], (v) => [6, 30, 75, smooth(0.35, 0.8, v) * 170]);
  drawTiled(ctx, depth, box, cell * 6, t * cell * 0.15, t * cell * 0.08, 0.6);
  // Ondas: faixas de sombra e de luz deslocadas entre si dão relevo à superfície.
  const bands = noiseTexture("water-bands", 41, [4, 8], (v) => [255, 255, 255, smooth(0.6, 0.95, ridge(v)) * 255]);
  drawTiled(ctx, bands, box, cell * 3.5, t * cell * 0.45, t * cell * 0.25, 0.12, "lighter", 0.6);
  const shade = noiseTexture("water-shade", 41, [4, 8], (v) => [0, 20, 50, smooth(0.6, 0.95, ridge(v)) * 255]);
  drawTiled(ctx, shade, box, cell * 3.5, t * cell * 0.45 + cell * 0.12, t * cell * 0.25 + cell * 0.08, 0.35, "source-over", 0.6);
  // Reflexos finos (cáusticas) em sentidos opostos.
  const caustic = noiseTexture("water-caustic", 37, [8, 16, 32], (v) => [200, 235, 255, smooth(0.84, 0.97, ridge(v)) * 255]);
  drawTiled(ctx, caustic, box, cell * 3.2, t * cell * 0.3, t * cell * 0.1, 0.25, "lighter");
  drawTiled(ctx, caustic, box, cell * 2.4, -t * cell * 0.24, t * cell * 0.17, 0.16, "lighter");

  ripples(ctx, st, dt, area, cell, 0.1, 2);
  glints(ctx, st, dt, area, cell, 0.4);
};

/** Anéis de ondulação que abrem e somem (água, poças). */
function ripples(ctx: Ctx, st: FxState, dt: number, area: FxArea, cell: number, perCell: number, rate: number) {
  st.c = step(st.c, dt);
  if (st.c.length < budget(area, cell, perCell, 10) && Math.random() < dt * rate) {
    st.c.push({ ...spawnPoint(area), vx: 0, vy: 0, age: 0, life: 1.6 + Math.random(), size: cell * (0.5 + Math.random() * 0.6), seed: 0 });
  }
  ctx.save();
  ctx.lineWidth = Math.max(1, cell * 0.03);
  for (const p of st.c) {
    const k = p.age / p.life;
    ctx.strokeStyle = `rgba(210, 240, 255, ${(1 - k) * 0.5})`;
    ctx.beginPath();
    ctx.ellipse(p.x, p.y, p.size * k, p.size * k * 0.55, 0, 0, Math.PI * 2);
    ctx.stroke();
  }
  ctx.restore();
}

/** Brilhos que acendem e apagam (sol na água, gelo, orvalho). */
function glints(ctx: Ctx, st: FxState, dt: number, area: FxArea, cell: number, perCell: number, rgb: [number, number, number] = [230, 250, 255]) {
  st.b = step(st.b, dt);
  keep(st.b, budget(area, cell, perCell, 50), () => ({
    ...spawnPoint(area),
    vx: cell * 0.05,
    vy: 0,
    age: 0,
    life: 0.4 + Math.random() * 0.9,
    size: cell * (0.08 + Math.random() * 0.1),
    seed: 0,
  }));
  ctx.save();
  ctx.globalCompositeOperation = "lighter";
  for (const p of st.b) {
    ctx.globalAlpha = Math.sin(Math.PI * (p.age / p.life)) * 0.8;
    sprite(ctx, glow(...rgb), p.x, p.y, p.size * 2);
  }
  ctx.restore();
}

const wet: Painter = (ctx, st, t, dt, area, cell) => {
  const { box } = area;
  // Chão encharcado: só escurece o piso (o mapa continua aparecendo).
  fill(ctx, box, "rgba(10, 18, 28, 0.32)");
  // Poças: manchas que refletem a luz, com um brilho que corre devagar.
  const puddles = noiseTexture("wet-puddles", 83, [6, 12, 24, 48], (v) => [70, 110, 150, smooth(0.54, 0.62, v) * 170]);
  drawTiled(ctx, puddles, box, cell * 2.6, 0, 0, 0.9);
  const sheen = noiseTexture("wet-sheen", 89, [4, 8], (v) => [200, 225, 245, smooth(0.65, 0.9, v) * 255]);
  // Reflexo que corre devagar pelo chão molhado.
  drawTiled(ctx, sheen, box, cell * 5, t * cell * 0.2, t * cell * 0.05, 0.18, "lighter");
  ripples(ctx, st, dt, area, cell, 0.05, 1);
};

/**
 * Arco elétrico de (x1, y1) a (x2, y2): o meio de cada trecho é empurrado de lado, cada vez menos (deslocamento do
 * ponto médio). Sai curvo e irregular, sem cara de zigue-zague de régua.
 */
function arcPoints(x1: number, y1: number, x2: number, y2: number, bend: number, levels: number): number[] {
  if (levels === 0) return [x1, y1, x2, y2];
  const length = Math.hypot(x2 - x1, y2 - y1) || 1;
  const push = (Math.random() - 0.5) * 2 * bend;
  const mx = (x1 + x2) / 2 - ((y2 - y1) / length) * push;
  const my = (y1 + y2) / 2 + ((x2 - x1) / length) * push;
  const first = arcPoints(x1, y1, mx, my, bend * 0.55, levels - 1);
  const second = arcPoints(mx, my, x2, y2, bend * 0.55, levels - 1);
  return [...first, ...second.slice(2)];
}

/** Linha arredondada pelos pontos: curva passando pelos meios dos trechos. */
function smoothLine(ctx: Ctx, points: number[]) {
  ctx.beginPath();
  ctx.moveTo(points[0], points[1]);
  for (let i = 2; i < points.length - 2; i += 2) {
    ctx.quadraticCurveTo(points[i], points[i + 1], (points[i] + points[i + 2]) / 2, (points[i + 1] + points[i + 3]) / 2);
  }
  ctx.lineTo(points[points.length - 2], points[points.length - 1]);
  ctx.stroke();
}

/** Um raio: arco principal entre dois pontos da área e um ou dois galhos curtos saindo do meio dele. */
function makeBolt(area: FxArea, cell: number): Particle {
  const from = spawnPoint(area);
  let to = spawnPoint(area);
  for (let i = 0; i < 6; i++) {
    const distance = Math.hypot(to.x - from.x, to.y - from.y);
    if (distance > cell * 0.8 && distance < cell * 2.2) break;
    to = spawnPoint(area);
  }
  const length = Math.hypot(to.x - from.x, to.y - from.y);
  const main = arcPoints(from.x, from.y, to.x, to.y, length * 0.22, 4);
  const bolts = [main];
  const heading = Math.atan2(to.y - from.y, to.x - from.x);
  const branchCount = 1 + Math.floor(Math.random() * 2);
  for (let i = 0; i < branchCount; i++) {
    const at = 2 * Math.floor((main.length / 2) * (0.3 + Math.random() * 0.4));
    const angle = heading + (Math.random() < 0.5 ? -1 : 1) * (0.5 + Math.random() * 0.4);
    const reach = length * (0.3 + Math.random() * 0.2);
    const sx = main[at];
    const sy = main[at + 1];
    bolts.push(arcPoints(sx, sy, sx + Math.cos(angle) * reach, sy + Math.sin(angle) * reach, reach * 0.25, 3));
  }
  return { ...from, vx: 0, vy: 0, age: 0, life: 0.15 + Math.random() * 0.25, size: 0, seed: Math.random() * 10, bolts };
}

const electric: Painter = (ctx, st, t, dt, area, cell) => {
  const { box } = area;
  fill(ctx, box, "rgba(20, 50, 110, 0.35)");
  // Clarão de vez em quando: acende de uma vez e apaga em ~0,2 s (nunca preso num quadro só).
  st.flash = Math.max(0, (st.flash ?? 0) - dt * 5);
  if (Math.random() < dt * 0.6) st.flash = 1;
  // Carga no chão: anda devagar em volta do lugar e tremula suave (sem pular de posição).
  const charge = noiseTexture("electric", 97, [6, 12, 24], (v) => [120, 200, 255, smooth(0.6, 0.9, v) * 255]);
  const hum = Math.sin(t * 7) * 0.04 + Math.sin(t * 13.3) * 0.03;
  drawTiled(ctx, charge, box, cell * 3, Math.sin(t * 0.5) * cell * 0.4, Math.cos(t * 0.4) * cell * 0.4, 0.28 + hum + st.flash * 0.3, "lighter");
  drawTiled(ctx, charge, box, cell * 2, -Math.cos(t * 0.6) * cell * 0.3, Math.sin(t * 0.55) * cell * 0.3, 0.15 + hum, "lighter");

  // Raios: arcos curvos com galhos, que piscam enquanto vivem; o halo azul some mais devagar que o núcleo branco.
  st.a = step(st.a, dt);
  if (st.a.length < budget(area, cell, 0.25, 14) && Math.random() < dt * 8) st.a.push(makeBolt(area, cell));
  ctx.save();
  ctx.globalCompositeOperation = "lighter";
  ctx.lineJoin = "round";
  ctx.lineCap = "round";
  for (const p of st.a) {
    const k = p.age / p.life;
    const blink = Math.sin(p.age * 70 + p.seed) > -0.3 ? 1 : 0.35;
    const halo = Math.pow(1 - k, 0.5);
    const core = Math.pow(1 - k, 1.5) * blink;
    for (const [index, points] of (p.bolts ?? []).entries()) {
      const thin = index === 0 ? 1 : 0.6;
      ctx.strokeStyle = `rgba(80, 160, 255, ${halo * 0.35})`;
      ctx.lineWidth = cell * 0.16 * thin;
      smoothLine(ctx, points);
      ctx.strokeStyle = `rgba(170, 220, 255, ${core * 0.6})`;
      ctx.lineWidth = cell * 0.07 * thin;
      smoothLine(ctx, points);
      ctx.strokeStyle = `rgba(240, 250, 255, ${core})`;
      ctx.lineWidth = Math.max(1, cell * 0.025 * thin);
      smoothLine(ctx, points);
    }
    // Onde o raio toca o chão, um brilho.
    const main = p.bolts?.[0];
    if (main) {
      ctx.globalAlpha = halo * 0.5;
      for (const end of [0, main.length - 2]) sprite(ctx, glow(150, 210, 255), main[end], main[end + 1], cell * 0.5);
      ctx.globalAlpha = 1;
    }
  }
  ctx.restore();
  glints(ctx, st, dt, area, cell, 0.3, [180, 225, 255]);
};

const fog: Painter = (ctx, _st, t, _dt, area, cell) => {
  const { box } = area;
  fill(ctx, box, "rgba(205, 212, 222, 0.16)");
  const soft = noiseTexture("fog", 51, [3, 6, 12, 24], (v) => [232, 236, 242, smooth(0.3, 0.85, v) * 255]);
  // Três camadas em escalas, direções e "respiração" diferentes: dá volume.
  drawTiled(ctx, soft, box, cell * 7, t * cell * 0.25, t * cell * 0.05, 0.45 + Math.sin(t * 0.5) * 0.08);
  drawTiled(ctx, soft, box, cell * 4.5, -t * cell * 0.18, t * cell * 0.11, 0.35 + Math.sin(t * 0.7 + 1) * 0.08);
  drawTiled(ctx, soft, box, cell * 2.6, t * cell * 0.4, -t * cell * 0.07, 0.22 + Math.sin(t * 0.9 + 2) * 0.06);
};

const steam: Painter = (ctx, st, t, dt, area, cell) => {
  const { box } = area;
  fill(ctx, box, "rgba(235, 240, 245, 0.12)");
  const soft = noiseTexture("fog", 51, [3, 6, 12, 24], (v) => [232, 236, 242, smooth(0.3, 0.85, v) * 255]);
  // Como a névoa, mas subindo e mais rápido.
  drawTiled(ctx, soft, box, cell * 5, Math.sin(t * 0.4) * cell * 0.5, -t * cell * 0.7, 0.4);
  drawTiled(ctx, soft, box, cell * 3, Math.cos(t * 0.5) * cell * 0.4, -t * cell * 1.1, 0.3);
  // Baforadas que crescem e se desfazem.
  st.a = step(st.a, dt);
  keep(st.a, budget(area, cell, 0.4, 40), () => ({
    ...spawnPoint(area),
    vx: (Math.random() - 0.5) * cell * 0.2,
    vy: -cell * (0.4 + Math.random() * 0.4),
    age: 0,
    life: 1.5 + Math.random() * 1.5,
    size: cell * (0.6 + Math.random() * 0.6),
    seed: 0,
  }));
  ctx.save();
  for (const p of st.a) {
    const k = p.age / p.life;
    ctx.globalAlpha = Math.sin(Math.PI * k) * 0.35;
    sprite(ctx, glow(245, 248, 252), p.x, p.y, p.size * (1 + k));
  }
  ctx.restore();
};

const toxic: Painter = (ctx, st, t, dt, area, cell) => {
  const { box } = area;
  fill(ctx, box, "rgba(80, 130, 30, 0.14)");
  const gas = noiseTexture("toxic", 151, [3, 6, 12, 24], (v) => [150, 215, 80, smooth(0.3, 0.85, v) * 255]);
  // Como a névoa, em verde, mais pesada e "respirando" mais rápido.
  drawTiled(ctx, gas, box, cell * 6, t * cell * 0.2, -t * cell * 0.06, 0.45 + Math.sin(t * 0.8) * 0.1);
  drawTiled(ctx, gas, box, cell * 3.5, -t * cell * 0.25, t * cell * 0.1, 0.35 + Math.sin(t * 1.1 + 1) * 0.08);
  drawTiled(ctx, gas, box, cell * 2, t * cell * 0.35, t * cell * 0.15, 0.2);
  // Bolhas que sobem e estouram.
  st.a = step(st.a, dt);
  keep(st.a, budget(area, cell, 0.25, 25), () => ({
    ...spawnPoint(area),
    vx: 0,
    vy: -cell * (0.15 + Math.random() * 0.2),
    age: 0,
    life: 1.5 + Math.random() * 2,
    size: cell * (0.08 + Math.random() * 0.1),
    seed: 0,
  }));
  ctx.save();
  ctx.lineWidth = Math.max(1, cell * 0.02);
  for (const p of st.a) {
    const k = p.age / p.life;
    ctx.strokeStyle = `rgba(200, 250, 140, ${Math.sin(Math.PI * k) * 0.6})`;
    ctx.beginPath();
    ctx.arc(p.x, p.y, p.size * (0.6 + k * 0.6), 0, Math.PI * 2);
    ctx.stroke();
  }
  ctx.restore();
};

const acid: Painter = (ctx, st, t, dt, area, cell) => {
  const { box } = area;
  // Chão sendo corroído: manchas escuras por baixo da poça.
  const eaten = noiseTexture("acid-eaten", 179, [4, 8, 16, 32], (v) => [25, 30, 5, smooth(0.45, 0.8, v) * 210]);
  drawTiled(ctx, eaten, box, cell * 3, 0, 0, 0.55);
  // Poça verde-amarelada que ondula devagar e brilha.
  const pool = noiseTexture("acid-pool", 181, [3, 6, 12], (v) => [150, 200, 30, (0.45 + smooth(0.3, 0.8, v) * 0.4) * 255]);
  drawTiled(ctx, pool, box, cell * 4, Math.sin(t * 0.3) * cell * 0.3, t * cell * 0.05, 0.75);
  const glare = noiseTexture("acid-glare", 191, [4, 8, 16], (v) => [235, 255, 140, smooth(0.93, 0.985, ridge(v)) * 255]);
  drawTiled(ctx, glare, box, cell * 4, t * cell * 0.15, -t * cell * 0.08, 0.16, "lighter");

  // Bolhas que crescem e estouram, com um respingo claro.
  st.a = step(st.a, dt);
  keep(st.a, budget(area, cell, 0.5, 45), () => ({
    ...spawnPoint(area),
    vx: 0,
    vy: 0,
    age: 0,
    life: 0.8 + Math.random() * 1.2,
    size: cell * (0.06 + Math.random() * 0.12),
    seed: 0,
  }));
  ctx.save();
  ctx.lineWidth = Math.max(1, cell * 0.025);
  for (const p of st.a) {
    const k = p.age / p.life;
    const r = p.size * Math.min(1, k * 1.3);
    ctx.globalAlpha = k < 0.85 ? 0.8 : (1 - k) * 5;
    ctx.fillStyle = "rgba(190, 235, 60, 0.55)";
    ctx.strokeStyle = "rgba(240, 255, 170, 0.9)";
    ctx.beginPath();
    ctx.arc(p.x, p.y, r, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
  }
  ctx.restore();

  // Fumaça corrosiva subindo, fina e esverdeada.
  st.b = step(st.b, dt);
  keep(st.b, budget(area, cell, 0.3, 30), () => ({
    ...spawnPoint(area),
    vx: (Math.random() - 0.5) * cell * 0.1,
    vy: -cell * (0.25 + Math.random() * 0.3),
    age: 0,
    life: 1.5 + Math.random() * 1.5,
    size: cell * (0.4 + Math.random() * 0.4),
    seed: 0,
  }));
  ctx.save();
  for (const p of st.b) {
    const k = p.age / p.life;
    ctx.globalAlpha = Math.sin(Math.PI * k) * 0.25;
    sprite(ctx, glow(200, 240, 120), p.x, p.y, p.size * (1 + k));
  }
  ctx.restore();
};

const burnt: Painter = (ctx, st, t, dt, area, cell, color) => {
  const { box } = area;
  // Piso queimado: fuligem por cima do mapa, com manchas mais escuras.
  base(ctx, "burnt", color, box, cell);
  const soot = noiseTexture("soot", 157, [4, 8, 16, 32], (v) => [12, 9, 8, smooth(0.35, 0.8, v) * 230]);
  drawTiled(ctx, soot, box, cell * 3, 0, 0, 0.6);
  // Brasas fracas que acendem e apagam devagar.
  st.a = step(st.a, dt);
  keep(st.a, budget(area, cell, 0.5, 50), () => ({
    ...spawnPoint(area),
    vx: 0,
    vy: 0,
    age: 0,
    life: 2 + Math.random() * 3,
    size: cell * (0.08 + Math.random() * 0.12),
    seed: Math.random() * 10,
  }));
  ctx.save();
  ctx.globalCompositeOperation = "lighter";
  for (const p of st.a) {
    const k = p.age / p.life;
    ctx.globalAlpha = Math.sin(Math.PI * k) * (0.5 + Math.sin(t * 4 + p.seed) * 0.2);
    sprite(ctx, glow(255, 100, 25), p.x, p.y, p.size * 2);
  }
  ctx.restore();
  // Cinza fina levada pelo vento.
  const ash = noiseTexture("ash", 163, [8, 16, 32], (v) => [150, 140, 130, smooth(0.75, 0.95, v) * 200]);
  drawTiled(ctx, ash, box, cell * 2.5, t * cell * 0.3, t * cell * 0.08, 0.25);
};

const mud: Painter = (ctx, st, t, dt, area, cell, color) => {
  const { box } = area;
  base(ctx, "mud", color, box, cell);
  const depth = noiseTexture("mud-depth", 167, [4, 8, 16], (v) => [40, 25, 12, smooth(0.4, 0.85, v) * 200]);
  drawTiled(ctx, depth, box, cell * 3.5, 0, 0, 0.55);
  // Brilho úmido que escorre devagar.
  const sheen = noiseTexture("mud-sheen", 173, [4, 8, 16], (v) => [220, 200, 170, smooth(0.9, 0.98, ridge(v)) * 255]);
  drawTiled(ctx, sheen, box, cell * 4, t * cell * 0.08, t * cell * 0.04, 0.1, "lighter");
  // Bolhas que crescem e estouram.
  st.a = step(st.a, dt);
  if (st.a.length < budget(area, cell, 0.12, 12) && Math.random() < dt * 1.5) {
    st.a.push({ ...spawnPoint(area), vx: 0, vy: 0, age: 0, life: 1.2 + Math.random(), size: cell * (0.1 + Math.random() * 0.12), seed: 0 });
  }
  ctx.save();
  for (const p of st.a) {
    const k = p.age / p.life;
    const r = p.size * Math.min(1, k * 1.4);
    ctx.globalAlpha = k < 0.85 ? 0.7 : (1 - k) * 4.5;
    ctx.fillStyle = "rgba(60, 38, 20, 1)";
    ctx.beginPath();
    ctx.arc(p.x, p.y, r, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "rgba(230, 210, 180, 0.6)";
    ctx.beginPath();
    ctx.arc(p.x - r * 0.3, p.y - r * 0.35, r * 0.3, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
};

/** Textura parada do E19 (graxa, teia…), andando de leve: a base dos efeitos que não são "líquidos". */
function base(ctx: Ctx, preset: EffectPreset, color: string, box: Box, cell: number, ox = 0, oy = 0, alpha = 1) {
  drawTiled(ctx, effectTexture(preset, color), box, cell * 2, ox, oy, alpha);
}

const grease: Painter = (ctx, _st, t, _dt, area, cell, color) => {
  const { box } = area;
  base(ctx, "grease", color, box, cell);
  // Brilho de óleo: faixas coloridas que escorrem devagar.
  const slick = noiseTexture("grease-slick", 101, [3, 6, 12], (v) => {
    const r = ridge(v);
    return [180 + 60 * Math.sin(v * 12), 160 + 60 * Math.sin(v * 12 + 2), 200 + 50 * Math.sin(v * 12 + 4), smooth(0.7, 0.95, r) * 255];
  });
  drawTiled(ctx, slick, box, cell * 4, t * cell * 0.12, t * cell * 0.06, 0.22, "lighter");
};

const web: Painter = (ctx, st, t, dt, area, cell, color) => {
  const { box } = area;
  // Fios balançando de leve, com gotas de orvalho brilhando. Duas camadas de tamanhos diferentes
  // quebram a repetição do desenho.
  base(ctx, "web", color, box, cell * 1.4, Math.sin(t * 0.8) * cell * 0.04, Math.cos(t * 0.6) * cell * 0.03);
  base(ctx, "web", color, box, cell * 2.3, cell * 0.7 + Math.sin(t * 0.6 + 1) * cell * 0.05, cell * 1.1, 0.55);
  glints(ctx, st, dt, area, cell, 0.15, [240, 245, 255]);
};

const plants: Painter = (ctx, _st, t, _dt, area, cell, color) => {
  const { box } = area;
  // Duas camadas de folhas balançando fora de compasso: parece vento.
  base(ctx, "plants", color, box, cell, Math.sin(t * 1.3) * cell * 0.05, 0, 0.9);
  base(ctx, "plants", color, box, cell * 1.3, Math.sin(t * 1.7 + 1) * cell * 0.07 + cell * 0.5, cell * 0.3, 0.5);
  // Luz passando entre as folhas.
  const dapple = noiseTexture("dapple", 113, [4, 8], (v) => [220, 255, 160, smooth(0.65, 0.9, v) * 255]);
  drawTiled(ctx, dapple, box, cell * 4, t * cell * 0.15, 0, 0.12, "lighter");
};

/** A cor do efeito (`#rrggbb`) clareada (`factor` > 1) ou escurecida (< 1). */
function shade(color: string, factor: number, alpha = 1): string {
  const value = parseInt(color.slice(1), 16);
  const channel = (shift: number) => Math.min(255, Math.round(((value >> shift) & 255) * factor));
  return `rgba(${channel(16)}, ${channel(8)}, ${channel(0)}, ${alpha})`;
}

/** Quantos pontos do fim de cada raiz ficam de fora do desenho parado: a ponta que rasteja. */
const ROOT_TIP = 3;

/**
 * Raízes para a área: cada uma nasce num ponto de dentro, serpenteia e se divide em galhos mais finos, até sair da
 * área ou acabar o comprimento. Pontos relativos ao canto do `box` (a área pode andar junto com um token).
 */
function growRoots(area: FxArea, cell: number): RootPath[] {
  const { box } = area;
  const paths: RootPath[] = [];
  const segment = cell * 0.14;
  const grow = (x: number, y: number, angle: number, length: number, width: number, depth: number) => {
    const points = [x - box.x, y - box.y];
    let heading = angle;
    const branchAt = new Set(depth > 0 ? [0.35 + Math.random() * 0.15, 0.6 + Math.random() * 0.15] : []);
    const steps = Math.max(2, Math.round(length / segment));
    for (let i = 1; i <= steps; i++) {
      heading += (Math.random() - 0.5) * 0.6;
      const nx = x + Math.cos(heading) * segment;
      const ny = y + Math.sin(heading) * segment;
      if (!area.inside(nx, ny)) break;
      x = nx;
      y = ny;
      points.push(x - box.x, y - box.y);
      for (const at of branchAt) {
        if (i !== Math.round(steps * at)) continue;
        const side = Math.random() < 0.5 ? -1 : 1;
        grow(x, y, heading + side * (0.6 + Math.random() * 0.5), length * (0.4 + Math.random() * 0.2), width * 0.55, depth - 1);
      }
    }
    // Curta demais para ter corpo e ponta: fica de fora.
    if (points.length >= (ROOT_TIP + 2) * 2) paths.push({ points, width, seed: Math.random() * 10 });
  };
  const count = budget(area, cell, 1.7, 48);
  // Começos espalhados: de quatro pontos sorteados, fica o mais longe dos que já existem (sem bolos nem buracos).
  const starts: { x: number; y: number }[] = [];
  const distance = (point: { x: number; y: number }) => Math.min(Infinity, ...starts.map((other) => Math.hypot(point.x - other.x, point.y - other.y)));
  for (let i = 0; i < count; i++) {
    const candidates = Array.from({ length: 4 }, () => spawnPoint(area));
    const start = candidates.reduce((best, candidate) => (distance(candidate) > distance(best) ? candidate : best));
    starts.push(start);
    grow(start.x, start.y, Math.random() * Math.PI * 2, cell * (0.8 + Math.random() * 0.7), cell * (0.07 + Math.random() * 0.06), 2);
  }
  return paths;
}

/** Traço que afina da base à ponta (segmento a segmento), de `from` a `to` (índices de ponto). */
function taperedStroke(ctx: Ctx, path: RootPath, from: number, to: number, offset: number, scale: number) {
  const total = path.points.length / 2 - 1;
  for (let i = from; i < to; i++) {
    ctx.lineWidth = Math.max(1, path.width * scale * (1 - (i / total) * 0.8));
    ctx.beginPath();
    ctx.moveTo(path.points[i * 2] + offset, path.points[i * 2 + 1] + offset);
    ctx.lineTo(path.points[i * 2 + 2] + offset, path.points[i * 2 + 3] + offset);
    ctx.stroke();
  }
}

/** O corpo parado das raízes (sem as pontas), com sombra, cor do efeito e um risco de luz. Em dobro de resolução. */
function paintRoots(paths: RootPath[], w: number, h: number, color: string, cell: number): HTMLCanvasElement {
  const canvas = document.createElement("canvas");
  const scale = 2;
  canvas.width = Math.max(1, Math.ceil(w * scale));
  canvas.height = Math.max(1, Math.ceil(h * scale));
  const ctx = canvas.getContext("2d")!;
  ctx.scale(scale, scale);
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  const passes: [string, number, number][] = [
    ["rgba(15, 8, 2, 0.55)", cell * 0.05, 1.25],
    [shade(color, 0.75), 0, 1],
    [shade(color, 1.35, 0.7), -cell * 0.015, 0.35],
  ];
  for (const [style, offset, widthScale] of passes) {
    ctx.strokeStyle = style;
    for (const path of paths) taperedStroke(ctx, path, 0, path.points.length / 2 - 1 - ROOT_TIP, offset, widthScale);
  }
  return canvas;
}

const roots: Painter = (ctx, st, t, _dt, area, cell, color) => {
  const { box } = area;
  // Terra revolvida por baixo, parada.
  const soil = noiseTexture("soil", 127, [4, 8, 16], (v) => [40, 26, 12, smooth(0.3, 0.75, v) * 230]);
  drawTiled(ctx, soil, box, cell * 3, 0, 0, 0.7);
  // Raízes novas só quando a área muda de tamanho (ou de cor); andando com um token, as mesmas vão junto.
  let drawing = st.roots;
  if (!drawing || drawing.w !== box.w || drawing.h !== box.h || drawing.color !== color) {
    const paths = drawing && drawing.w === box.w && drawing.h === box.h ? drawing.paths : growRoots(area, cell);
    drawing = { w: box.w, h: box.h, color, paths, image: paintRoots(paths, box.w, box.h, color, cell) };
    st.roots = drawing;
  }
  ctx.drawImage(drawing.image, box.x, box.y, box.w, box.h);
  // Pontas que rastejam: os últimos pontos de cada raiz balançam de lado, mais quanto mais perto da ponta.
  ctx.save();
  ctx.translate(box.x, box.y);
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  for (const path of drawing.paths) {
    const count = path.points.length / 2;
    const first = count - 1 - ROOT_TIP;
    const tip: RootPath = { ...path, points: path.points.slice(first * 2) };
    for (let j = 1; j <= ROOT_TIP; j++) {
      const k = first + j;
      const dx = path.points[k * 2] - path.points[k * 2 - 2];
      const dy = path.points[k * 2 + 1] - path.points[k * 2 - 1];
      const length = Math.hypot(dx, dy) || 1;
      const sway = Math.sin(t * 0.8 + path.seed + j * 0.7) * cell * 0.03 * j;
      tip.points[j * 2] += (-dy / length) * sway;
      tip.points[j * 2 + 1] += (dx / length) * sway;
    }
    // As pontas leem a espessura da raiz inteira: o traço continua afinando de onde o corpo parou.
    const tipPath: RootPath = { ...tip, points: [...path.points.slice(0, first * 2), ...tip.points] };
    ctx.strokeStyle = "rgba(15, 8, 2, 0.55)";
    taperedStroke(ctx, tipPath, first, count - 1, cell * 0.05, 1.25);
    ctx.strokeStyle = shade(color, 0.75);
    taperedStroke(ctx, tipPath, first, count - 1, 0, 1);
  }
  ctx.restore();
};

const ice: Painter = (ctx, st, t, dt, area, cell, color) => {
  const { box } = area;
  base(ctx, "ice", color, box, cell);
  const frost = noiseTexture("frost", 131, [8, 16, 32], (v) => [235, 250, 255, smooth(0.6, 0.9, v) * 200]);
  drawTiled(ctx, frost, box, cell * 3, 0, 0, 0.35);
  // Faixa de brilho atravessando o cristal de tempos em tempos.
  const sweep = ((t * 0.25) % 1.6) - 0.3;
  const x0 = box.x + box.w * sweep;
  const grad = ctx.createLinearGradient(x0 - cell, box.y, x0 + cell, box.y + box.h * 0.3);
  grad.addColorStop(0, "rgba(255,255,255,0)");
  grad.addColorStop(0.5, "rgba(255,255,255,0.22)");
  grad.addColorStop(1, "rgba(255,255,255,0)");
  ctx.save();
  ctx.globalCompositeOperation = "lighter";
  ctx.fillStyle = grad;
  ctx.fillRect(box.x, box.y, box.w, box.h);
  ctx.restore();
  glints(ctx, st, dt, area, cell, 0.35, [235, 250, 255]);
};

const darkness: Painter = (ctx, st, t, dt, area, cell) => {
  const { box } = area;
  fill(ctx, box, "rgba(6, 3, 12, 0.82)");
  // Sombra girando devagar, em dois sentidos.
  const swirl = noiseTexture("darkness", 137, [3, 6, 12], (v) => [40, 20, 70, smooth(0.45, 0.9, v) * 255]);
  drawTiled(ctx, swirl, box, cell * 5, 0, 0, 0.5, "lighter", 1, t * 0.05);
  drawTiled(ctx, swirl, box, cell * 3, cell, cell, 0.35, "lighter", 1, -t * 0.08);
  // Pontinhos roxos à deriva.
  st.a = step(st.a, dt);
  keep(st.a, budget(area, cell, 0.3, 30), () => ({
    ...spawnPoint(area),
    vx: (Math.random() - 0.5) * cell * 0.15,
    vy: (Math.random() - 0.5) * cell * 0.15,
    age: 0,
    life: 2 + Math.random() * 2,
    size: cell * (0.06 + Math.random() * 0.05),
    seed: 0,
  }));
  ctx.save();
  ctx.globalCompositeOperation = "lighter";
  for (const p of st.a) {
    ctx.globalAlpha = Math.sin(Math.PI * (p.age / p.life)) * 0.6;
    sprite(ctx, glow(150, 100, 220), p.x, p.y, p.size * 2);
  }
  ctx.restore();
};

/** Brilho redondo com paradas de cor (raio e cores livres, por isso desenhado na hora). */
function disc(ctx: Ctx, x: number, y: number, r: number, stops: [number, string][]) {
  const g = ctx.createRadialGradient(x, y, 0, x, y, r);
  for (const [o, c] of stops) g.addColorStop(o, c);
  ctx.fillStyle = g;
  ctx.fillRect(x - r, y - r, r * 2, r * 2);
}

/**
 * Luz sagrada (M, no espírito dos Espíritos Guardiões): brilho dourado no meio, riscos de luz girando no chão
 * e seis luzinhas cor de chama rondando perto da borda, com rastro; fagulhas subindo. Em área que não é
 * redonda, a ronda vira uma elipse dentro da caixa (a máscara recorta o formato).
 */
const holy: Painter = (ctx, st, t, dt, area, cell) => {
  const { box } = area;
  const cx = box.x + box.w / 2;
  const cy = box.y + box.h / 2;
  // A caixa inclui a borda difusa: a ronda fica um pouco para dentro, onde a máscara ainda é forte.
  const rx = (box.w / 2) * 0.7;
  const ry = (box.h / 2) * 0.7;
  const r = Math.min(box.w, box.h) / 2;
  const at = (theta: number, k: number) => ({ x: cx + Math.cos(theta) * rx * k, y: cy + Math.sin(theta) * ry * k });
  ctx.save();
  ctx.globalCompositeOperation = "lighter";
  ctx.lineCap = "round";
  // Brilho do meio, respirando.
  const breathe = 0.85 + 0.15 * Math.sin(t * 1.3);
  disc(ctx, cx, cy, r, [
    [0, `rgba(255,240,200,${0.4 * breathe})`],
    [0.35, `rgba(255,214,140,${0.21 * breathe})`],
    [1, "rgba(255,190,90,0)"],
  ]);
  disc(ctx, cx, cy, cell * 0.9, [
    [0, `rgba(255,255,245,${0.45 * breathe})`],
    [1, "rgba(255,240,200,0)"],
  ]);
  // Riscos de luz girando no chão, cada um no seu raio e ritmo, afinando nas pontas (espiral leve para dentro).
  const rand = rng(31);
  for (let i = 0; i < 12; i++) {
    const k0 = (0.3 + rand() * 0.6) / 0.7;
    const len = 0.6 + rand() * 0.9;
    const start = rand() * Math.PI * 2 + t * (0.35 + rand() * 0.35);
    const a = 0.12 + 0.08 * Math.sin(t * 0.9 + i);
    const N = 14;
    for (let s = 0; s < N; s++) {
      const f = Math.sin((Math.PI * (s + 0.5)) / N);
      const p = at(start - (s / N) * len, k0 * (1 - (0.08 * s) / N));
      const q = at(start - ((s + 1) / N) * len, k0 * (1 - (0.08 * (s + 1)) / N));
      ctx.strokeStyle = `rgba(255,220,160,${a * f})`;
      ctx.lineWidth = cell * 0.07 * f;
      ctx.beginPath();
      ctx.moveTo(p.x, p.y);
      ctx.lineTo(q.x, q.y);
      ctx.stroke();
    }
  }
  // As luzinhas: cabeça brilhante e rastro que afina e some.
  for (let i = 0; i < 6; i++) {
    const theta = (i / 6) * Math.PI * 2 + t * 0.8;
    const N = 22;
    const tail = 1.1;
    let prev = at(theta, 1);
    for (let s = 1; s <= N; s++) {
      const f = 1 - s / N;
      const p = at(theta - (s / N) * tail, 1);
      ctx.strokeStyle = `rgba(255,${165 + 75 * f},${70 + 120 * f},${0.9 * f * f})`;
      ctx.lineWidth = cell * (0.02 + 0.13 * f);
      ctx.beginPath();
      ctx.moveTo(prev.x, prev.y);
      ctx.lineTo(p.x, p.y);
      ctx.stroke();
      prev = p;
    }
    const head = at(theta, 1);
    const flick = 0.9 + 0.1 * Math.sin(t * 9 + i);
    disc(ctx, head.x, head.y, cell * 0.55 * flick, [
      [0, "rgba(255,220,150,0.7)"],
      [0.35, "rgba(255,170,70,0.3)"],
      [1, "rgba(255,140,40,0)"],
    ]);
    sprite(ctx, glow(255, 250, 235), head.x, head.y, cell * 0.28);
  }
  // Fagulhas subindo devagar, balançando.
  st.a = step(st.a, dt);
  keep(st.a, budget(area, cell, 0.8, 30), () => ({
    ...spawnPoint(area),
    vx: 0,
    vy: -cell * (0.2 + Math.random() * 0.35),
    age: 0,
    life: 1.8 + Math.random() * 2.2,
    size: cell * (0.03 + Math.random() * 0.04),
    seed: Math.random() * 9,
  }));
  for (const p of st.a) {
    ctx.globalAlpha = Math.sin(Math.PI * (p.age / p.life)) * 0.9;
    sprite(ctx, glow(255, 190, 110), p.x + Math.sin(p.age * 2 + p.seed) * cell * 0.05, p.y, p.size * 6);
  }
  ctx.restore();
};

/** Personalizado: a cor escolhida com uma ondulação suave. */
const custom: Painter = (ctx, _st, t, _dt, area, cell, color) => {
  const { box } = area;
  base(ctx, "custom", color, box, cell);
  const n = parseInt(color.slice(1), 16);
  const rgb: [number, number, number] = [(n >> 16) & 255, (n >> 8) & 255, n & 255];
  const wave = noiseTexture(`custom-${color}`, 149, [4, 8, 16], (v) => [...rgb, smooth(0.5, 0.9, v) * 255]);
  drawTiled(ctx, wave, box, cell * 4, t * cell * 0.2, t * cell * 0.1, 0.35);
};

const PAINTERS: Record<EffectPreset, Painter> = {
  fire,
  water,
  wet,
  electric,
  steam,
  mud,
  burnt,
  toxic,
  acid,
  grease,
  web,
  plants,
  roots,
  fog,
  ice,
  darkness,
  holy,
  custom,
};

/** Desenha um quadro do efeito. */
export function drawFx(ctx: Ctx, preset: EffectPreset, color: string, st: FxState, area: FxArea, cell: number, now: number) {
  const t = now / 1000;
  // Primeiro quadro (ou aba que voltou do segundo plano): sem salto gigante nas partículas.
  const dt = st.last ? Math.min(0.1, t - st.last) : 0;
  st.last = t;
  PAINTERS[preset](ctx, st, t, dt, area, cell, color);
}

export { TILE };
