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

interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  age: number;
  life: number;
  size: number;
  seed: number;
  /** Raio elétrico: os pontos do zigue-zague. */
  path?: number[];
}

/** Estado de cada efeito na tela (partículas vivas, último quadro). */
export interface FxState {
  a: Particle[];
  b: Particle[];
  c: Particle[];
  last: number;
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

  // Calor esticado na vertical, subindo em duas velocidades: línguas de fogo.
  const heat = noiseTexture("fire", 11, [4, 8, 16, 32], (v) => [255, 90 + v * 140, 10 + v * 30, smooth(0.55, 0.9, v) * 255]);
  drawTiled(ctx, heat, box, cell * 2.2, Math.sin(t * 0.7) * cell * 0.3, -t * cell * 2.2, 0.6, "lighter", 2.4);
  drawTiled(ctx, heat, box, cell * 1.4, Math.cos(t * 0.9) * cell * 0.2, -t * cell * 3.4, 0.4, "lighter", 2.8);

  // Chamas: sobem, encolhem e passam de amarelo-claro a vermelho.
  st.a = step(st.a, dt);
  keep(st.a, budget(area, cell, 1.6, 140), () => ({
    ...spawnPoint(area),
    vx: (Math.random() - 0.5) * cell * 0.2,
    vy: -cell * (0.8 + Math.random()),
    age: 0,
    life: 0.5 + Math.random() * 0.7,
    size: cell * (0.55 + Math.random() * 0.5),
    seed: Math.random() * 10,
  }));
  ctx.save();
  ctx.globalCompositeOperation = "lighter";
  for (const p of st.a) {
    const k = p.age / p.life;
    const img = k < 0.3 ? glow(255, 236, 170) : k < 0.65 ? glow(255, 130, 25) : glow(190, 35, 8);
    const w = p.size * (1 - k * 0.6);
    ctx.globalAlpha = Math.sin(Math.PI * Math.min(1, k * 1.2)) * 0.6;
    sprite(ctx, img, p.x + Math.sin(t * 6 + p.seed) * cell * 0.08, p.y - w * 0.5, w, w * 1.7);
  }
  // Fagulhas que sobem balançando.
  st.b = step(st.b, dt);
  keep(st.b, budget(area, cell, 0.35, 40), () => ({
    ...spawnPoint(area),
    vx: 0,
    vy: -cell * (1 + Math.random()),
    age: 0,
    life: 0.8 + Math.random() * 1.2,
    size: cell * (0.06 + Math.random() * 0.06),
    seed: Math.random() * 10,
  }));
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

const electric: Painter = (ctx, st, _t, dt, area, cell) => {
  const { box } = area;
  fill(ctx, box, "rgba(20, 50, 110, 0.35)");
  // Brilho que tremula, com clarões de vez em quando.
  const flash = Math.random() < dt * 1.5 ? 0.35 : 0;
  const charge = noiseTexture("electric", 97, [6, 12, 24], (v) => [120, 200, 255, smooth(0.6, 0.9, v) * 255]);
  drawTiled(ctx, charge, box, cell * 3, Math.random() * cell * 0.2, Math.random() * cell * 0.2, 0.25 + Math.random() * 0.15 + flash, "lighter");

  // Raios: zigue-zagues curtos que estalam e somem em frações de segundo.
  st.a = step(st.a, dt);
  const want = budget(area, cell, 0.25, 14);
  while (st.a.length < want && Math.random() < 0.6) {
    const from = spawnPoint(area);
    const ang = Math.random() * Math.PI * 2;
    const len = cell * (0.8 + Math.random() * 2.2);
    const segs = 6 + Math.floor(Math.random() * 5);
    const path: number[] = [];
    for (let i = 0; i <= segs; i++) {
      const k = i / segs;
      const jitter = i === 0 || i === segs ? 0 : (Math.random() - 0.5) * cell * 0.45;
      path.push(from.x + Math.cos(ang) * len * k - Math.sin(ang) * jitter, from.y + Math.sin(ang) * len * k + Math.cos(ang) * jitter);
    }
    st.a.push({ ...from, vx: 0, vy: 0, age: 0, life: 0.06 + Math.random() * 0.18, size: 0, seed: 0, path });
  }
  ctx.save();
  ctx.globalCompositeOperation = "lighter";
  ctx.lineJoin = "round";
  ctx.lineCap = "round";
  for (const p of st.a) {
    const a = 1 - p.age / p.life;
    const line = () => {
      ctx.beginPath();
      for (let i = 0; i < p.path!.length; i += 2) ctx[i ? "lineTo" : "moveTo"](p.path![i], p.path![i + 1]);
      ctx.stroke();
    };
    ctx.strokeStyle = `rgba(90, 170, 255, ${a * 0.45})`;
    ctx.lineWidth = cell * 0.14;
    line();
    ctx.strokeStyle = `rgba(235, 248, 255, ${a})`;
    ctx.lineWidth = Math.max(1, cell * 0.035);
    line();
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

const roots: Painter = (ctx, _st, t, _dt, area, cell, color) => {
  const { box } = area;
  // Terra revolvida por baixo; raízes "respiram" (se apertam e soltam).
  const soil = noiseTexture("soil", 127, [4, 8, 16], (v) => [40, 26, 12, smooth(0.3, 0.75, v) * 230]);
  drawTiled(ctx, soil, box, cell * 3, 0, 0, 0.7);
  // Duas camadas de raízes (uma maior, deslocada) para cobrir o chão.
  base(ctx, "roots", color, box, cell * (1.2 + Math.sin(t * 0.9) * 0.02), Math.sin(t * 0.5) * cell * 0.03, 0);
  base(ctx, "roots", color, box, cell * 1.9, cell * 0.9, cell * 0.6 + Math.sin(t * 0.4) * cell * 0.03, 0.8);
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
