import { chunkKey, decodeLayer, encodeLayer, TERRAIN_CHUNK_SIDE, TERRAIN_FINE } from "./terrain";
import type { WeatherState } from "./types";
import { fineInsideFrame, type FrameClip } from "./frame";

/**
 * Relevo (docs/design/relevo.md): na mesma grade fina do terreno (4 pontos por casa, pedaços de 8 × 8 casas), cada
 * ponto guarda um nível de −2 a +3 (0 = chão) e o tipo de borda: escarpa (penhasco de rocha) ou suave (morro, monte).
 * Só visual: não muda régua, visão nem névoa. Um byte por ponto: `(nível + 2) | (suave ? 8 : 0)`; pedaço que ficou
 * todo "chão escarpa" sai (sem pedaço = chão).
 */

export const RELIEF_LEVELS = { min: -2, max: 3 };
/** Pedaços com relevo de uma cena, pela chave `"cx,cy"`: os 1024 bytes em base64. */
export type ReliefChunks = Record<string, string>;

/**
 * Uma passada do pincel: nível e tipo pintados, raio em casas e os pontos do traço (`x, y` achatados, em casas). Com
 * `dune` (0 apaga, 1 a 3), a passada pinta só a altura das dunas e deixa o nível e o tipo como estavam.
 */
export interface ReliefStroke {
  level: number;
  soft: boolean;
  dune?: number;
  radius: number;
  points: number[];
}

export interface ReliefPoint {
  level: number;
  soft: boolean;
  /** Altura das dunas: 0 (sem) a 3. */
  dune: number;
}

/** Dunas (docs/design/relevo.md, etapa 3; teste aprovado em docs/design/chao-hd-teste.html). */
export const RELIEF_DUNE = {
  max: 3,
  /** Altura da onda (níveis) na duna de altura 2. */
  amplitude: 0.55,
};

const SOFT_BIT = 8;
const DUNE_SHIFT = 4;
const DUNE_MASK = 3 << DUNE_SHIFT;
/** O byte do chão (nível 0, escarpa): o que vale onde não há pedaço. */
export const RELIEF_GROUND = 2;

export function encodeReliefPoint(point: ReliefPoint): number {
  return (point.level + 2) | (point.soft ? SOFT_BIT : 0) | (point.dune << DUNE_SHIFT);
}

export function decodeReliefPoint(value: number): ReliefPoint {
  return { level: (value & 7) - 2, soft: (value & SOFT_BIT) !== 0, dune: (value & DUNE_MASK) >> DUNE_SHIFT };
}

/** Byte válido: nível de −2 a +3, com ou sem o bit de suave, altura das dunas de 0 a 3, e nada mais. */
export function validReliefByte(value: number): boolean {
  const level = (value & 7) - 2;
  return (value & ~(7 | SOFT_BIT | DUNE_MASK)) === 0 && level >= RELIEF_LEVELS.min && level <= RELIEF_LEVELS.max;
}

/** Nível e tipo no ponto da grade fina `fineX, fineY` (4 por casa). */
export function reliefAt(chunks: ReliefChunks, fineX: number, fineY: number): ReliefPoint {
  const cx = Math.floor(fineX / TERRAIN_CHUNK_SIDE);
  const cy = Math.floor(fineY / TERRAIN_CHUNK_SIDE);
  const text = chunks[chunkKey(cx, cy)];
  const bytes = text ? decodeLayer(text) : null;
  if (!bytes) return decodeReliefPoint(RELIEF_GROUND);
  return decodeReliefPoint(bytes[(fineY - cy * TERRAIN_CHUNK_SIDE) * TERRAIN_CHUNK_SIDE + (fineX - cx * TERRAIN_CHUNK_SIDE)]);
}

/**
 * Aplica a passada em `chunks` (muda o objeto) e devolve as chaves dos pedaços que mudaram: todo ponto da grade
 * dentro do raio de algum ponto do traço fica com o nível e o tipo pintados (pincel duro: o patamar tem borda).
 */
export function paintRelief(chunks: ReliefChunks, stroke: ReliefStroke, clip?: FrameClip): string[] {
  const dunes = stroke.dune !== undefined;
  // O que a passada troca no byte: só a duna, ou só o nível e o tipo (o resto fica).
  const value = dunes ? (stroke.dune ?? 0) << DUNE_SHIFT : encodeReliefPoint({ level: stroke.level, soft: stroke.soft, dune: 0 });
  const kept = dunes ? ~DUNE_MASK & 0xff : DUNE_MASK;
  const working = new Map<string, Uint8Array>();
  for (let p = 0; p + 1 < stroke.points.length; p += 2) {
    const x = stroke.points[p];
    const y = stroke.points[p + 1];
    for (let j = Math.ceil((y - stroke.radius) * TERRAIN_FINE); j <= Math.floor((y + stroke.radius) * TERRAIN_FINE); j++) {
      for (let i = Math.ceil((x - stroke.radius) * TERRAIN_FINE); i <= Math.floor((x + stroke.radius) * TERRAIN_FINE); i++) {
        if (Math.hypot(i / TERRAIN_FINE - x, j / TERRAIN_FINE - y) >= stroke.radius) continue;
        // moldura da cena: o pincel não pinta fora
        if (!fineInsideFrame(clip, i, j, TERRAIN_FINE)) continue;
        const cx = Math.floor(i / TERRAIN_CHUNK_SIDE);
        const cy = Math.floor(j / TERRAIN_CHUNK_SIDE);
        const key = chunkKey(cx, cy);
        let bytes = working.get(key);
        if (!bytes) {
          // Aplainar (ou tirar duna) onde nem há relevo: nada a mudar (e não cria pedaço).
          if ((dunes ? value === 0 : value === RELIEF_GROUND) && !chunks[key]) continue;
          bytes = (chunks[key] ? decodeLayer(chunks[key]) : null) ?? new Uint8Array(TERRAIN_CHUNK_SIDE * TERRAIN_CHUNK_SIDE).fill(RELIEF_GROUND);
          working.set(key, bytes);
        }
        const at = (j - cy * TERRAIN_CHUNK_SIDE) * TERRAIN_CHUNK_SIDE + (i - cx * TERRAIN_CHUNK_SIDE);
        bytes[at] = (bytes[at] & kept) | value;
      }
    }
  }
  for (const [key, bytes] of working) {
    if (bytes.every((byte) => byte === RELIEF_GROUND)) delete chunks[key];
    else chunks[key] = encodeLayer(bytes);
  }
  return [...working.keys()];
}

// ---------- Altura (docs/design/relevo.md; teste aprovado em docs/design/relevo-teste.html) ----------

/** Altura grossa: 8 pontos por casa (o detalhe fino é do shader). */
export const RELIEF_PER_CELL = 8;
/**
 * Casas de margem em volta do pedaço: a face suave de vários níveis e a sombra alcançam até aqui. 12 (antes 8): a
 * sombra de um patamar de 2+ níveis no entardecer cabe sem acabar numa linha reta; o pedaço custa ~1,4× e a pincelada
 * refaz os pedaços até 2 de distância (no Worker).
 */
export const RELIEF_MARGIN = 12;
/** Casas de face por nível: escarpa (penhasco de rocha, do lado de baixo da borda) e suave (rampa centrada na borda). */
export const RELIEF_FACE = { cliff: 1.15, soft: 2.5 };
/** Suavização da encosta suave (desvio, em casas): apaga as "dobras" da distância até uma borda irregular. */
const SOFT_BLUR = 0.4;

/**
 * Distância exata (Felzenszwalb) de cada ponto da grade até o ponto marcado (≠ 0) mais perto, em pontos da grade. O
 * chanfro de 8 direções deixaria as encostas octogonais.
 */
export function distanceField(mask: Uint8Array, width: number, height: number): Float32Array {
  const far = 1e12;
  const squared = new Float64Array(width * height);
  for (let index = 0; index < squared.length; index++) squared[index] = mask[index] ? 0 : far;
  const size = Math.max(width, height);
  const f = new Float64Array(size);
  const v = new Int32Array(size);
  const z = new Float64Array(size + 1);
  // Envelope inferior das parábolas de uma linha (o algoritmo clássico), de `start` em passos de `stride`.
  const line = (start: number, stride: number, count: number) => {
    for (let q = 0; q < count; q++) f[q] = squared[start + q * stride];
    let k = 0;
    v[0] = 0;
    z[0] = -Infinity;
    z[1] = Infinity;
    for (let q = 1; q < count; q++) {
      if (f[q] >= far && f[v[k]] >= far) continue;
      let s = (f[q] + q * q - (f[v[k]] + v[k] * v[k])) / (2 * q - 2 * v[k]);
      while (s <= z[k]) {
        k--;
        s = (f[q] + q * q - (f[v[k]] + v[k] * v[k])) / (2 * q - 2 * v[k]);
      }
      k++;
      v[k] = q;
      z[k] = s;
      z[k + 1] = Infinity;
    }
    k = 0;
    for (let q = 0; q < count; q++) {
      while (z[k + 1] < q) k++;
      const d = q - v[k];
      squared[start + q * stride] = d * d + f[v[k]];
    }
  };
  for (let y = 0; y < height; y++) line(y * width, 1, width);
  for (let x = 0; x < width; x++) line(x, width, height);
  const out = new Float32Array(width * height);
  for (let index = 0; index < out.length; index++) out[index] = Math.sqrt(squared[index]);
  return out;
}

const ease = (t: number) => t * t * (3 - 2 * t);

/**
 * Altura (em níveis) do pedaço `key` com margem: ((8 + 2·margem)·8 + 1)² valores, linha a linha, a partir do canto
 * (cx·8 − margem, cy·8 − margem) em casas, 8 por casa. Escarpa: cada patamar desce para o vizinho baixo numa face de
 * 1,15 casa do lado de baixo da borda, (d / 1,15)^0,85. Suave: rampa de 2,5 casas centrada na borda pintada
 * (smoothstep), suavizada no fim. A borda irregular (ruído) fica no shader.
 */
export function reliefHeights(chunks: ReliefChunks, key: string): Float32Array {
  return reliefFields(chunks, key).heights;
}

/** Altura (como `reliefHeights`) e, em cada ponto, o quanto a encosta é suave (0 a 1): onde é suave não há rocha. */
export function reliefFields(chunks: ReliefChunks, key: string): { heights: Float32Array; soft: Float32Array } {
  const [cx, cy] = key.split(",").map(Number);
  const cells = TERRAIN_CHUNK_SIDE / TERRAIN_FINE;
  const side = (cells + 2 * RELIEF_MARGIN) * RELIEF_PER_CELL + 1;
  const originX = cx * cells - RELIEF_MARGIN;
  const originY = cy * cells - RELIEF_MARGIN;
  const count = side * side;
  // Nível e tipo de cada ponto: do ponto da grade fina mais perto (empate para o de baixo, igual nos dois eixos).
  // A janela em pontos finos começa em (originX·4, originY·4); cada ponto da altura pega o fino `g >> 1`.
  const fineSide = (side >> 1) + 1;
  const fineOriginX = originX * TERRAIN_FINE;
  const fineOriginY = originY * TERRAIN_FINE;
  const fineValues = new Uint8Array(fineSide * fineSide).fill(RELIEF_GROUND);
  for (let ccy = Math.floor(fineOriginY / TERRAIN_CHUNK_SIDE); ccy <= Math.floor((fineOriginY + fineSide - 1) / TERRAIN_CHUNK_SIDE); ccy++) {
    for (let ccx = Math.floor(fineOriginX / TERRAIN_CHUNK_SIDE); ccx <= Math.floor((fineOriginX + fineSide - 1) / TERRAIN_CHUNK_SIDE); ccx++) {
      const text = chunks[chunkKey(ccx, ccy)];
      const bytes = text ? decodeLayer(text) : null;
      if (!bytes) continue;
      for (let j = 0; j < TERRAIN_CHUNK_SIDE; j++) {
        const fy = ccy * TERRAIN_CHUNK_SIDE + j - fineOriginY;
        if (fy < 0 || fy >= fineSide) continue;
        for (let i = 0; i < TERRAIN_CHUNK_SIDE; i++) {
          const fx = ccx * TERRAIN_CHUNK_SIDE + i - fineOriginX;
          if (fx >= 0 && fx < fineSide) fineValues[fy * fineSide + fx] = bytes[j * TERRAIN_CHUNK_SIDE + i];
        }
      }
    }
  }
  const level = new Int8Array(count);
  const soft = new Uint8Array(count);
  for (let gy = 0; gy < side; gy++) {
    for (let gx = 0; gx < side; gx++) {
      const point = decodeReliefPoint(fineValues[(gy >> 1) * fineSide + (gx >> 1)]);
      level[gy * side + gx] = point.level;
      soft[gy * side + gx] = point.soft ? 1 : 0;
    }
  }
  const height = new Float32Array(count);
  const softWeight = new Float32Array(count);
  let low = RELIEF_LEVELS.max;
  let high = RELIEF_LEVELS.min;
  for (let index = 0; index < count; index++) {
    height[index] = level[index];
    low = Math.min(low, level[index]);
    high = Math.max(high, level[index]);
  }
  // Distâncias na grade fina (4 por casa: a do pincel, sem perder nada) e esticadas com interpolação para os 8 por
  // casa da altura: 4 vezes menos pontos na conta mais cara.
  const fineCount = fineSide * fineSide;
  const fineLevel = new Int8Array(fineCount);
  const fineSoft = new Uint8Array(fineCount);
  for (let index = 0; index < fineCount; index++) {
    const point = decodeReliefPoint(fineValues[index]);
    fineLevel[index] = point.level;
    fineSoft[index] = point.soft ? 1 : 0;
  }
  const mask = new Uint8Array(fineCount);
  /** Distância (em casas) até os pontos finos marcados por `member`; `null` se nenhum ponto é marcado. */
  const distanceTo = (member: (index: number) => boolean): ((gx: number, gy: number) => number) | null => {
    let any = false;
    for (let index = 0; index < fineCount; index++) {
      mask[index] = member(index) ? 1 : 0;
      if (mask[index]) any = true;
    }
    if (!any) return null;
    const field = distanceField(mask, fineSide, fineSide);
    return (gx, gy) => {
      const x0 = gx >> 1;
      const y0 = gy >> 1;
      const x1 = Math.min(fineSide - 1, x0 + (gx & 1));
      const y1 = Math.min(fineSide - 1, y0 + (gy & 1));
      const value = (field[y0 * fineSide + x0] + field[y0 * fineSide + x1] + field[y1 * fineSide + x0] + field[y1 * fineSide + x1]) / 4;
      return value / TERRAIN_FINE;
    };
  };
  for (let k = low + 1; k <= high; k++) {
    // Escarpa: distância até a região ≥ k de escarpa.
    const cliff = distanceTo((index) => fineLevel[index] >= k && !fineSoft[index]);
    if (cliff) {
      for (let gy = 0; gy < side; gy++) {
        for (let gx = 0; gx < side; gx++) {
          const index = gy * side + gx;
          if (level[index] >= k) continue;
          const t = cliff(gx, gy) / RELIEF_FACE.cliff;
          if (t < 1) height[index] = Math.max(height[index], k - Math.pow(t, 0.85));
        }
      }
    }
    // Suave: distância com sinal (para fora, até a região ≥ k suave; para dentro, até o que está abaixo de k).
    const outside = distanceTo((index) => fineLevel[index] >= k && fineSoft[index] === 1);
    if (!outside) continue;
    const inside = distanceTo((index) => fineLevel[index] < k);
    for (let gy = 0; gy < side; gy++) {
      for (let gx = 0; gx < side; gx++) {
        const index = gy * side + gx;
        const member = level[index] >= k && soft[index] === 1;
        const signed = member ? (inside ? inside(gx, gy) : RELIEF_MARGIN * 4) : -outside(gx, gy);
        const t = 0.5 + signed / RELIEF_FACE.soft;
        if (t <= 0) continue;
        const value = k - 1 + ease(Math.min(1, t));
        if (member ? level[index] === k : value > height[index]) {
          height[index] = value;
          softWeight[index] = 1;
        }
      }
    }
  }
  const smoothed = smoothSoft(height, softWeight, side);
  addDunes(smoothed, fineValues, fineSide, side, originX, originY);
  return smoothed;
}

/** Ruído de valor determinístico pela posição no mapa (casas): a mesma onda em qualquer janela. */
function latticeHash(x: number, y: number): number {
  let h = Math.imul(x, 374761393) + Math.imul(y, 668265263);
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}
function valueNoise(x: number, y: number): number {
  const x0 = Math.floor(x);
  const y0 = Math.floor(y);
  const fx = x - x0;
  const fy = y - y0;
  const ux = fx * fx * (3 - 2 * fx);
  const uy = fy * fy * (3 - 2 * fy);
  const a = latticeHash(x0, y0);
  const b = latticeHash(x0 + 1, y0);
  const c = latticeHash(x0, y0 + 1);
  const d = latticeHash(x0 + 1, y0 + 1);
  return a + (b - a) * ux + (c - a) * uy + (a - b - c + d) * ux * uy;
}

/** Onda das dunas (0 a 1) no ponto do mapa (casas): crista mais aguda que o vale, direção variando de leve. */
export function duneWave(x: number, y: number): number {
  const phase = (x * 0.79 + y * 0.33) * 0.55 + valueNoise(x * 0.15, y * 0.15) * 5;
  return Math.pow(0.5 + 0.5 * Math.sin(phase), 1.6);
}

/** Meia largura (casas) de cada média móvel que amacia a altura das dunas (borda sem degrau). */
const DUNE_BLUR = 1.25;

/**
 * Soma a ondulação das dunas na altura (e marca como encosta suave: sem rocha), só dentro da área pintada. A altura
 * pintada (0 a 3) é amaciada na grade fina por duas médias móveis em cada eixo; a duna cresce de zero na borda até a
 * altura cheia para dentro (sem degrau) e nunca passa da área pintada (não tira a rocha do penhasco vizinho nem
 * sombreia a água ao lado).
 */
function addDunes(fields: { heights: Float32Array; soft: Float32Array }, fineValues: Uint8Array, fineSide: number, side: number, originX: number, originY: number) {
  const fineCount = fineSide * fineSide;
  let amount = new Float32Array(fineCount);
  const painted = new Float32Array(fineCount);
  let any = false;
  for (let index = 0; index < fineCount; index++) {
    const dune = (fineValues[index] & DUNE_MASK) >> DUNE_SHIFT;
    amount[index] = dune / 2;
    painted[index] = dune > 0 ? 1 : 0;
    if (dune > 0) any = true;
  }
  if (!any) return;
  const radius = Math.round(DUNE_BLUR * TERRAIN_FINE);
  const box = (source: Float32Array<ArrayBuffer>, horizontal: boolean): Float32Array<ArrayBuffer> => {
    const out = new Float32Array(fineCount);
    for (let y = 0; y < fineSide; y++) {
      for (let x = 0; x < fineSide; x++) {
        let sum = 0;
        for (let offset = -radius; offset <= radius; offset++) {
          const sx = horizontal ? Math.min(fineSide - 1, Math.max(0, x + offset)) : x;
          const sy = horizontal ? y : Math.min(fineSide - 1, Math.max(0, y + offset));
          sum += source[sy * fineSide + sx];
        }
        out[y * fineSide + x] = sum / (radius * 2 + 1);
      }
    }
    return out;
  };
  amount = box(box(box(box(amount, true), false), true), false);
  // Quanto da vizinhança é duna (1 no meio da área, 1/2 na borda reta): a rampa vai de 1/2 a 1, para dentro.
  const coverage = box(box(box(box(painted, true), false), true), false);
  for (let index = 0; index < fineCount; index++) {
    const inside = Math.min(1, Math.max(0, coverage[index] * 2 - 1));
    amount[index] = painted[index] > 0 && coverage[index] > 0 ? (amount[index] / coverage[index]) * inside : 0;
  }
  const { heights, soft } = fields;
  for (let gy = 0; gy < side; gy++) {
    for (let gx = 0; gx < side; gx++) {
      // Ponto da altura -> grade fina (2 pontos da altura por ponto fino), com interpolação.
      const fx = Math.min(fineSide - 1, gx / 2);
      const fy = Math.min(fineSide - 1, gy / 2);
      const x0 = Math.floor(fx);
      const y0 = Math.floor(fy);
      const x1 = Math.min(fineSide - 1, x0 + 1);
      const y1 = Math.min(fineSide - 1, y0 + 1);
      const tx = fx - x0;
      const ty = fy - y0;
      const top = amount[y0 * fineSide + x0] * (1 - tx) + amount[y0 * fineSide + x1] * tx;
      const bottom = amount[y1 * fineSide + x0] * (1 - tx) + amount[y1 * fineSide + x1] * tx;
      const strength = top * (1 - ty) + bottom * ty;
      // Ponto da altura fora da área pintada (o fino mais perto, como o nível): sem duna.
      if (strength <= 0 || painted[(gy >> 1) * fineSide + (gx >> 1)] === 0) continue;
      const index = gy * side + gx;
      heights[index] += duneWave(originX + gx / RELIEF_PER_CELL, originY + gy / RELIEF_PER_CELL) * RELIEF_DUNE.amplitude * strength;
      soft[index] = Math.max(soft[index], Math.min(1, strength * 4));
    }
  }
}

/**
 * Desfoque gaussiano separável só onde a altura veio do suave (a escarpa fica intacta): numa caixa em volta da
 * encosta suave, misturando pelo peso desfocado (a passagem do suave para a escarpa também fica sem degrau).
 */
function smoothSoft(height: Float32Array, weight: Float32Array, side: number): { heights: Float32Array; soft: Float32Array } {
  let minX = side;
  let minY = side;
  let maxX = -1;
  let maxY = -1;
  for (let y = 0; y < side; y++) {
    for (let x = 0; x < side; x++) {
      if (weight[y * side + x] === 0) continue;
      minX = Math.min(minX, x);
      maxX = Math.max(maxX, x);
      minY = Math.min(minY, y);
      maxY = Math.max(maxY, y);
    }
  }
  if (maxX < 0) return { heights: height, soft: weight };
  const sigma = SOFT_BLUR * RELIEF_PER_CELL;
  const radius = Math.ceil(sigma * 2.5);
  const kernel = new Float32Array(radius * 2 + 1);
  let total = 0;
  for (let index = 0; index < kernel.length; index++) total += kernel[index] = Math.exp(-((index - radius) ** 2) / (2 * sigma * sigma));
  for (let index = 0; index < kernel.length; index++) kernel[index] /= total;
  // Caixa de trabalho: a encosta e o alcance do desfoque (o que fica fora não muda).
  const x0 = Math.max(0, minX - radius * 2);
  const x1 = Math.min(side - 1, maxX + radius * 2);
  const y0 = Math.max(0, minY - radius * 2);
  const y1 = Math.min(side - 1, maxY + radius * 2);
  const clampX = (x: number) => (x < 0 ? 0 : x >= side ? side - 1 : x);
  const pass = (source: Float32Array, horizontal: boolean): Float32Array => {
    const out = new Float32Array(source);
    for (let y = y0; y <= y1; y++) {
      for (let x = x0; x <= x1; x++) {
        let sum = 0;
        if (horizontal) {
          const row = y * side;
          if (x - radius >= 0 && x + radius < side) for (let offset = 0; offset < kernel.length; offset++) sum += source[row + x - radius + offset] * kernel[offset];
          else for (let offset = 0; offset < kernel.length; offset++) sum += source[row + clampX(x - radius + offset)] * kernel[offset];
        } else if (y - radius >= 0 && y + radius < side) {
          for (let offset = 0; offset < kernel.length; offset++) sum += source[(y - radius + offset) * side + x] * kernel[offset];
        } else {
          for (let offset = 0; offset < kernel.length; offset++) sum += source[clampX(y - radius + offset) * side + x] * kernel[offset];
        }
        out[y * side + x] = sum;
      }
    }
    return out;
  };
  const smooth = pass(pass(height, true), false);
  const reach = pass(pass(weight, true), false);
  const out = new Float32Array(height);
  const soft = new Float32Array(height.length);
  for (let y = y0; y <= y1; y++) {
    for (let x = x0; x <= x1; x++) {
      const index = y * side + x;
      const k = Math.min(1, reach[index] * 2);
      out[index] = height[index] + (smooth[index] - height[index]) * k;
      soft[index] = k;
    }
  }
  return { heights: out, soft };
}

/** Pedaços cujo desenho muda quando `changed` muda: eles e os vizinhos até a margem (um pedaço em volta). */
export function reliefAffected(changed: string[]): string[] {
  const out = new Set<string>();
  const reach = Math.ceil(RELIEF_MARGIN / (TERRAIN_CHUNK_SIDE / TERRAIN_FINE));
  for (const key of changed) {
    const [cx, cy] = key.split(",").map(Number);
    for (let dy = -reach; dy <= reach; dy++) for (let dx = -reach; dx <= reach; dx++) out.add(chunkKey(cx + dx, cy + dy));
  }
  return [...out];
}

// ---------- Poeira das dunas (docs/design/relevo.md, etapa 3; teste aprovado em docs/design/dunas-poeira-teste.html) ----------

/** Climas que levantam poeira das dunas: 1 = vento (sutil), 2 = tempestade de areia (forte); 0 = nada. */
export function duneDustLevel(weather: WeatherState | null): 0 | 1 | 2 {
  if (!weather?.kind) return 0;
  if (weather.kind === "sand") return 2;
  return weather.kind === "leaves" || weather.kind === "blizzard" || weather.kind === "storm" ? 1 : 0;
}

/**
 * Onde há dunas, na grade fina (4 pontos por casa), num retângulo de pedaços, com uma borda de um texel vazio em volta
 * (fora dela a leitura repete a borda: nada): 0 sem duna, 255 na duna de altura 3. O primeiro texel é o ponto fino
 * `(cx · 32 − 1, cy · 32 − 1)`.
 */
export interface DuneMask {
  cx: number;
  cy: number;
  cols: number;
  rows: number;
  data: Uint8Array<ArrayBuffer>;
}

/** Lado máximo da máscara das dunas (pontos da grade fina): 4096 = 1024 casas, textura que qualquer placa aceita. */
export const DUNE_MASK_MAX_SIDE = 4096;

/** A máscara das dunas do relevo; `null` sem nenhuma duna (ou com elas espalhadas além de `DUNE_MASK_MAX_SIDE`). */
export function duneMask(chunks: ReliefChunks): DuneMask | null {
  const withDunes: [number, number, Uint8Array][] = [];
  for (const [key, text] of Object.entries(chunks)) {
    const bytes = decodeLayer(text);
    if (!bytes || !bytes.some((byte) => (byte & DUNE_MASK) !== 0)) continue;
    const [cx, cy] = key.split(",").map(Number);
    withDunes.push([cx, cy, bytes]);
  }
  if (withDunes.length === 0) return null;
  const cx = Math.min(...withDunes.map(([x]) => x));
  const cy = Math.min(...withDunes.map(([, y]) => y));
  const cols = Math.max(...withDunes.map(([x]) => x)) - cx + 1;
  const rows = Math.max(...withDunes.map(([, y]) => y)) - cy + 1;
  // Dunas muito longe umas das outras: a máscara cobriria a caixa inteira entre elas. Acima do teto, sem poeira.
  if (cols * TERRAIN_CHUNK_SIDE + 2 > DUNE_MASK_MAX_SIDE || rows * TERRAIN_CHUNK_SIDE + 2 > DUNE_MASK_MAX_SIDE) return null;
  const width = cols * TERRAIN_CHUNK_SIDE + 2;
  const data = new Uint8Array(width * (rows * TERRAIN_CHUNK_SIDE + 2));
  for (const [x, y, bytes] of withDunes) {
    for (let j = 0; j < TERRAIN_CHUNK_SIDE; j++) {
      for (let i = 0; i < TERRAIN_CHUNK_SIDE; i++) {
        const dune = (bytes[j * TERRAIN_CHUNK_SIDE + i] & DUNE_MASK) >> DUNE_SHIFT;
        data[((y - cy) * TERRAIN_CHUNK_SIDE + j + 1) * width + (x - cx) * TERRAIN_CHUNK_SIDE + i + 1] = dune * 85;
      }
    }
  }
  return { cx, cy, cols, rows, data };
}

/**
 * Altura do relevo (níveis) em qualquer ponto do mapa (casas): a bilinear do mesmo campo de `reliefHeights`, com os
 * pedaços guardados (cada um calculado na primeira leitura). Fora do alcance do relevo, 0. Para quem precisa da altura
 * no processador (o perfil das escadas, o pé dos objetos). `cache`: alturas já calculadas para estes mesmos pedaços
 * (`ReliefHeights` guarda entre traços).
 */
export function reliefSampler(chunks: ReliefChunks, cache = new Map<string, Float32Array | null>()): (x: number, y: number) => number {
  const cells = TERRAIN_CHUNK_SIDE / TERRAIN_FINE;
  const side = (cells + 2 * RELIEF_MARGIN) * RELIEF_PER_CELL + 1;
  const reach = Math.ceil(RELIEF_MARGIN / cells);
  const present = new Set(Object.keys(chunks));
  const heightsOf = (cx: number, cy: number): Float32Array | null => {
    const key = chunkKey(cx, cy);
    const known = cache.get(key);
    if (known !== undefined) return known;
    // só calcula se algum pedaço com relevo alcança este (a face e a margem chegam a um pedaço de distância)
    let near = false;
    for (let dy = -reach; dy <= reach && !near; dy++) for (let dx = -reach; dx <= reach && !near; dx++) near = present.has(chunkKey(cx + dx, cy + dy));
    const heights = near ? reliefHeights(chunks, key) : null;
    cache.set(key, heights);
    return heights;
  };
  return (x, y) => {
    if (present.size === 0 || !Number.isFinite(x) || !Number.isFinite(y)) return 0;
    const cx = Math.floor(x / cells);
    const cy = Math.floor(y / cells);
    const heights = heightsOf(cx, cy);
    if (!heights) return 0;
    const gx = (x - (cx * cells - RELIEF_MARGIN)) * RELIEF_PER_CELL;
    const gy = (y - (cy * cells - RELIEF_MARGIN)) * RELIEF_PER_CELL;
    const x0 = Math.min(side - 2, Math.floor(gx));
    const y0 = Math.min(side - 2, Math.floor(gy));
    const fx = gx - x0;
    const fy = gy - y0;
    const at = (i: number, j: number) => heights[j * side + i];
    const top = at(x0, y0) + (at(x0 + 1, y0) - at(x0, y0)) * fx;
    const bottom = at(x0, y0 + 1) + (at(x0 + 1, y0 + 1) - at(x0, y0 + 1)) * fx;
    return top + (bottom - top) * fy;
  };
}

/**
 * Alturas do relevo guardadas entre traços (docs/design/desempenho.md): a altura de um pedaço leva de 7 a ~35 ms, e
 * quem lê a altura a cada mudança do relevo (o pé dos objetos, as escadas) refazia todas no processador, travando o
 * mapa. Aqui um traço não recalcula nada: fica a altura de antes até o Worker do relevo entregar a dos pedaços
 * afetados (`accept`, o mesmo cálculo e o mesmo alcance de `reliefAffected`). Só pedaço nunca lido é calculado na hora.
 */
export class ReliefHeights {
  private readonly cache = new Map<string, Float32Array | null>();

  /** A altura em qualquer ponto para `chunks`, com as alturas guardadas. */
  sampler(chunks: ReliefChunks): (x: number, y: number) => number {
    return reliefSampler(chunks, this.cache);
  }

  /** A altura de um pedaço calculada pelo Worker do relevo. */
  accept(key: string, heights: Float32Array) {
    this.cache.set(key, heights);
  }

  /** Esquece tudo (troca de cena, relevo apagado): o próximo pedaço lido é calculado do zero. */
  clear() {
    this.cache.clear();
  }
}

