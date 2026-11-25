import { reliefAt, type ReliefChunks } from "./relief";
import { chunkKey, decodeLayer, isWaterTerrain, TERRAIN_CHUNK_SIDE, TERRAIN_FINE, TERRAINS, type TerrainChunks, type TerrainId } from "./terrain";
import type { WaterCurrent } from "./types";

/**
 * Água animada (docs/design/agua.md): contas puras que o cliente roda fora do quadro (Web Worker) quando a água pintada
 * ou as linhas de correnteza mudam. Daqui saem as texturas do shader: a distância até a margem e as coordenadas do rio.
 */

/** Retângulo em casas. */
export interface CellRect {
  col: number;
  row: number;
  cols: number;
  rows: number;
}

/**
 * Campo de um grupo de água: `perCell` pixels por casa a partir do canto do retângulo. `sdf` em pixels do campo
 * (+ dentro da água pintada, − fora); `deep` de 0 a 1, quanto daquela água é *Água funda*.
 */
export interface WaterField {
  rect: CellRect;
  perCell: number;
  width: number;
  height: number;
  sdf: Float32Array;
  deep: Float32Array;
  /** Parte de mar da água (0 a 1) por pixel (docs/design/mar.md). */
  sea: Float32Array;
  /** Tipo de costa nos pixels de terra junto ao mar (`SHORE_*`); 0 no resto. */
  shore: Uint8Array<ArrayBuffer>;
}

/** Tipos de costa do mar: nada, praia (areia, terra batida), pedra (pedra ou relevo mais alto), margem (o resto). */
export const SHORE_NONE = 0;
export const SHORE_BEACH = 1;
export const SHORE_ROCK = 2;
export const SHORE_BANK = 3;

/** Terrenos de praia e de costa de pedra. */
const BEACH_TERRAINS: ReadonlySet<TerrainId> = new Set<TerrainId>(["sand", "packedEarth"]);
const ROCK_TERRAINS: ReadonlySet<TerrainId> = new Set<TerrainId>(["stone", "stoneLight"]);
/** Até onde (casas) o mar continua além da pintura, onde não há nada pintado (a borda aberta). */
const SEA_OPEN_CELLS = 2;

/** Ponto fino conta como água com mais da metade de água (rasa + funda). */
const WATER_THRESHOLD = 127;

/** Um ponto fino: água rasa, funda e mar (0–255), a terra que domina (ou `null`) e se há alguma pintura. */
interface FinePoint {
  shallow: number;
  deep: number;
  sea: number;
  land: TerrainId | null;
  painted: boolean;
}

/** As camadas de cada pedaço, decodificadas uma vez por conta. */
function fineReader(chunks: TerrainChunks) {
  const cache = new Map<string, Map<TerrainId, Uint8Array> | null>();
  const layersOf = (key: string) => {
    if (!cache.has(key)) {
      const chunk = chunks[key];
      const layers = new Map<TerrainId, Uint8Array>();
      if (chunk) {
        for (const terrain of TERRAINS) {
          const text = chunk[terrain];
          const bytes = text ? decodeLayer(text) : null;
          if (bytes) layers.set(terrain, bytes);
        }
      }
      cache.set(key, layers.size > 0 ? layers : null);
    }
    return cache.get(key) ?? null;
  };
  const empty: FinePoint = { shallow: 0, deep: 0, sea: 0, land: null, painted: false };
  /** O ponto fino (i, j). */
  return (i: number, j: number): FinePoint => {
    const cx = Math.floor(i / TERRAIN_CHUNK_SIDE);
    const cy = Math.floor(j / TERRAIN_CHUNK_SIDE);
    const layers = layersOf(chunkKey(cx, cy));
    if (!layers) return empty;
    const index = (j - cy * TERRAIN_CHUNK_SIDE) * TERRAIN_CHUNK_SIDE + (i - cx * TERRAIN_CHUNK_SIDE);
    let land: TerrainId | null = null;
    let landMost = 0;
    let painted = false;
    for (const [terrain, bytes] of layers) {
      const value = bytes[index];
      if (value === 0) continue;
      painted = true;
      if (!isWaterTerrain(terrain) && value > landMost) {
        landMost = value;
        land = terrain;
      }
    }
    return { shallow: layers.get("water")?.[index] ?? 0, deep: layers.get("waterDark")?.[index] ?? 0, sea: layers.get("sea")?.[index] ?? 0, land, painted };
  };
}

const overlaps = (a: CellRect, b: CellRect) => a.col < b.col + b.cols && b.col < a.col + a.cols && a.row < b.row + b.rows && b.row < a.row + a.rows;

function union(a: CellRect, b: CellRect): CellRect {
  const col = Math.min(a.col, b.col);
  const row = Math.min(a.row, b.row);
  return { col, row, cols: Math.max(a.col + a.cols, b.col + b.cols) - col, rows: Math.max(a.row + a.rows, b.row + b.rows) - row };
}

/**
 * Retângulos (em casas) em volta de cada grupo de água pintada, com `margin` casas de folga: o shader e as contas só
 * trabalham ali, então um mapa grande com um lago num canto não paga pelo resto. Grupos cujos retângulos se tocam
 * viram um só.
 */
export function waterBounds(chunks: TerrainChunks, margin: number): CellRect[] {
  const cells = new Set<string>();
  for (const [key, chunk] of Object.entries(chunks)) {
    if (!chunk.water && !chunk.waterDark && !chunk.sea) continue;
    const [cx, cy] = key.split(",").map(Number);
    const shallow = chunk.water ? decodeLayer(chunk.water) : null;
    const deep = chunk.waterDark ? decodeLayer(chunk.waterDark) : null;
    const sea = chunk.sea ? decodeLayer(chunk.sea) : null;
    for (let index = 0; index < TERRAIN_CHUNK_SIDE * TERRAIN_CHUNK_SIDE; index++) {
      if ((shallow?.[index] ?? 0) + (deep?.[index] ?? 0) + (sea?.[index] ?? 0) <= WATER_THRESHOLD) continue;
      const i = cx * TERRAIN_CHUNK_SIDE + (index % TERRAIN_CHUNK_SIDE);
      const j = cy * TERRAIN_CHUNK_SIDE + Math.floor(index / TERRAIN_CHUNK_SIDE);
      cells.add(`${Math.floor(i / TERRAIN_FINE)},${Math.floor(j / TERRAIN_FINE)}`);
    }
  }
  // Grupos de casas vizinhas (inclusive na diagonal).
  const rects: CellRect[] = [];
  const seen = new Set<string>();
  for (const start of cells) {
    if (seen.has(start)) continue;
    seen.add(start);
    const queue = [start];
    let minCol = Infinity;
    let minRow = Infinity;
    let maxCol = -Infinity;
    let maxRow = -Infinity;
    while (queue.length > 0) {
      const [col, row] = (queue.pop() ?? "").split(",").map(Number);
      minCol = Math.min(minCol, col);
      minRow = Math.min(minRow, row);
      maxCol = Math.max(maxCol, col);
      maxRow = Math.max(maxRow, row);
      for (let dy = -1; dy <= 1; dy++) {
        for (let dx = -1; dx <= 1; dx++) {
          const next = `${col + dx},${row + dy}`;
          if (cells.has(next) && !seen.has(next)) {
            seen.add(next);
            queue.push(next);
          }
        }
      }
    }
    rects.push({ col: minCol - margin, row: minRow - margin, cols: maxCol - minCol + 1 + margin * 2, rows: maxRow - minRow + 1 + margin * 2 });
  }
  // Retângulos que se tocam viram um só (até não sobrar nenhum par).
  let merged = true;
  while (merged) {
    merged = false;
    for (let a = 0; a < rects.length && !merged; a++) {
      for (let b = a + 1; b < rects.length && !merged; b++) {
        if (!overlaps(rects[a], rects[b])) continue;
        rects[a] = union(rects[a], rects[b]);
        rects.splice(b, 1);
        merged = true;
      }
    }
  }
  return rects;
}

/** Quadrado da distância em uma dimensão (Felzenszwalb e Huttenlocher), em `out`. */
function distance1d(source: Float64Array, count: number, out: Float64Array, ridges: Int32Array, bounds: Float64Array) {
  let k = 0;
  ridges[0] = 0;
  bounds[0] = -Infinity;
  bounds[1] = Infinity;
  for (let q = 1; q < count; q++) {
    let crossing = (source[q] + q * q - (source[ridges[k]] + ridges[k] * ridges[k])) / (2 * q - 2 * ridges[k]);
    while (crossing <= bounds[k]) {
      k--;
      crossing = (source[q] + q * q - (source[ridges[k]] + ridges[k] * ridges[k])) / (2 * q - 2 * ridges[k]);
    }
    k++;
    ridges[k] = q;
    bounds[k] = crossing;
    bounds[k + 1] = Infinity;
  }
  k = 0;
  for (let q = 0; q < count; q++) {
    while (bounds[k + 1] < q) k++;
    out[q] = (q - ridges[k]) * (q - ridges[k]) + source[ridges[k]];
  }
}

/** Distância exata até o pixel mais perto em que `isTarget` vale; sem nenhum, `fallback`. */
function exactDistance(isTarget: (index: number) => boolean, width: number, height: number, fallback: number): Float64Array {
  const BIG = 1e20;
  const grid = new Float64Array(width * height);
  for (let index = 0; index < grid.length; index++) grid[index] = isTarget(index) ? 0 : BIG;
  const longest = Math.max(width, height);
  const line = new Float64Array(longest);
  const result = new Float64Array(longest);
  const ridges = new Int32Array(longest);
  const bounds = new Float64Array(longest + 1);
  for (let x = 0; x < width; x++) {
    for (let y = 0; y < height; y++) line[y] = grid[y * width + x];
    distance1d(line, height, result, ridges, bounds);
    for (let y = 0; y < height; y++) grid[y * width + x] = result[y];
  }
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) line[x] = grid[y * width + x];
    distance1d(line, width, result, ridges, bounds);
    for (let x = 0; x < width; x++) grid[y * width + x] = result[x] >= BIG / 2 ? fallback : Math.sqrt(result[x]);
  }
  return grid;
}

/**
 * Distância com sinal até a margem, exata, em pixels: + dentro (`inside` = 1), − fora, com meio pixel de ajuste (a
 * margem passa entre os pixels). Sem margem nenhuma (tudo água ou nada), vale a soma dos lados, com o sinal certo.
 */
export function signedDistance(inside: Uint8Array, width: number, height: number): Float32Array {
  const fallback = width + height;
  const toOutside = exactDistance((index) => inside[index] === 0, width, height, fallback);
  const toInside = exactDistance((index) => inside[index] === 1, width, height, fallback);
  const sdf = new Float32Array(width * height);
  for (let index = 0; index < sdf.length; index++) sdf[index] = inside[index] ? toOutside[index] - 0.5 : -(toInside[index] - 0.5);
  return sdf;
}

/**
 * Meia largura da água em volta de cada pixel (docs/design/estruturas-ajustes.md): a maior distância até a margem num
 * quadrado de lado `2·radius + 1` em volta, em pixels do campo; longe de qualquer água, 0. Vale também logo fora da
 * margem (o shader treme a borda e conta um pouco de fora como água). No rio fino dá a meia largura dele;
 * perto da margem de um rio largo, pelo menos o raio (o barranco fica cheio). Filtro de máximo separável (linhas, depois
 * colunas) em tempo linear (van Herk/Gil-Werman): num campo de 2048 px e raio de 40, o ingênuo travaria o Worker.
 */
export function waterHalfWidth(sdf: Float32Array, width: number, height: number, radius: number): Float32Array {
  const reach = Math.max(0, Math.round(radius));
  const rows = new Float32Array(width * height);
  // a linha com `reach` zeros de cada lado: a janela tem sempre o tamanho do bloco e cobre no máximo dois blocos
  const padded = Math.max(width, height) + 2 * reach;
  const before = new Float32Array(padded);
  const after = new Float32Array(padded);
  const line = new Float32Array(padded);
  /** Máximo deslizante de `count` valores lidos de `read`, escritos com `write` (fora do campo conta como 0). */
  const slide = (count: number, read: (index: number) => number, write: (index: number, value: number) => void) => {
    const block = 2 * reach + 1;
    const total = count + 2 * reach;
    line.fill(0, 0, total);
    for (let index = 0; index < count; index++) line[index + reach] = Math.max(0, read(index));
    // dentro de cada bloco: o máximo desde o começo do bloco (before) e até o fim dele (after)
    for (let start = 0; start < total; start += block) {
      const end = Math.min(total, start + block) - 1;
      before[start] = line[start];
      for (let index = start + 1; index <= end; index++) before[index] = Math.max(before[index - 1], line[index]);
      after[end] = line[end];
      for (let index = end - 1; index >= start; index--) after[index] = Math.max(after[index + 1], line[index]);
    }
    // a janela do valor `index` vai de `index` a `index + 2·reach` na linha completada
    for (let index = 0; index < count; index++) write(index, Math.max(after[index], before[index + 2 * reach]));
  };
  for (let y = 0; y < height; y++) {
    slide(width, (x) => sdf[y * width + x], (x, value) => (rows[y * width + x] = value));
  }
  const out = new Float32Array(width * height);
  for (let x = 0; x < width; x++) {
    slide(height, (y) => rows[y * width + x], (y, value) => (out[y * width + x] = value));
  }
  return out;
}

/**
 * Campo de um grupo de água: a quantidade de água (rasa + funda) dos pontos finos do terreno, interpolada em cada
 * pixel; mais da metade = dentro. `deep` = parte funda dessa água.
 */
export function waterField(chunks: TerrainChunks, rect: CellRect, perCell: number, relief?: ReliefChunks): WaterField {
  const read = fineReader(chunks);
  const fineCols = rect.cols * TERRAIN_FINE + 2;
  const fineRows = rect.rows * TERRAIN_FINE + 2;
  const firstI = rect.col * TERRAIN_FINE;
  const firstJ = rect.row * TERRAIN_FINE;
  const amount = new Float32Array(fineCols * fineRows);
  const darkness = new Float32Array(fineCols * fineRows);
  const seaFine = new Float32Array(fineCols * fineRows);
  const seaMask = new Float32Array(fineCols * fineRows);
  const open = new Uint8Array(fineCols * fineRows);
  const landKind = new Uint8Array(fineCols * fineRows);
  for (let j = 0; j < fineRows; j++) {
    for (let i = 0; i < fineCols; i++) {
      const point = read(firstI + i, firstJ + j);
      const index = j * fineCols + i;
      amount[index] = (point.shallow + point.deep + point.sea) / 255;
      darkness[index] = point.deep / 255;
      seaFine[index] = point.sea / 255;
      seaMask[index] = point.sea > WATER_THRESHOLD ? 1 : 0;
      open[index] = point.painted ? 0 : 1;
      // a costa pelo lado de terra: relevo mais alto vira penhasco (pedra)
      const raised = relief ? reliefAt(relief, firstI + i, firstJ + j).level > 0 : false;
      landKind[index] = raised || (point.land && ROCK_TERRAINS.has(point.land)) ? SHORE_ROCK : point.land && BEACH_TERRAINS.has(point.land) ? SHORE_BEACH : point.land ? SHORE_BANK : SHORE_NONE;
    }
  }
  // Borda aberta (docs/design/mar.md): perto do mar, o que não tem pintura nenhuma também é mar (sem margem).
  // (+2 pontos finos: o mar chega até a beira do campo, sem um anel de "terra" na folga que viraria costa)
  const nearSea = waterHalfWidth(seaMask, fineCols, fineRows, SEA_OPEN_CELLS * TERRAIN_FINE + 2);
  for (let index = 0; index < open.length; index++) {
    if (open[index] === 1 && nearSea[index] > 0) {
      amount[index] = 1;
      seaFine[index] = 1;
    }
  }
  const width = rect.cols * perCell;
  const height = rect.rows * perCell;
  const inside = new Uint8Array(width * height);
  const deep = new Float32Array(width * height);
  const sea = new Float32Array(width * height);
  const shore = new Uint8Array(width * height);
  for (let py = 0; py < height; py++) {
    const fy = ((py + 0.5) / perCell) * TERRAIN_FINE;
    const j0 = Math.floor(fy);
    const ty = fy - j0;
    for (let px = 0; px < width; px++) {
      const fx = ((px + 0.5) / perCell) * TERRAIN_FINE;
      const i0 = Math.floor(fx);
      const tx = fx - i0;
      const a = j0 * fineCols + i0;
      const b = a + fineCols;
      const mix = (values: Float32Array) =>
        (values[a] * (1 - tx) + values[a + 1] * tx) * (1 - ty) + (values[b] * (1 - tx) + values[b + 1] * tx) * ty;
      const total = mix(amount);
      const index = py * width + px;
      inside[index] = total > 0.5 ? 1 : 0;
      deep[index] = total > 0.01 ? Math.min(1, mix(darkness) / total) : 0;
      sea[index] = total > 0.01 ? Math.min(1, mix(seaFine) / total) : 0;
      // costa: terra a até 2 casas do mar, pelo ponto fino mais perto
      if (inside[index] === 0) {
        const nearest = Math.min(fineRows - 1, Math.round(fy)) * fineCols + Math.min(fineCols - 1, Math.round(fx));
        if (nearSea[nearest] > 0) shore[index] = landKind[nearest];
      }
    }
  }
  // Dentro do mar, perto da costa (2 casas), o tipo da costa mais perto: é ali que a onda quebra e sobe na areia.
  // Se mais de um tipo chega, pedra ganha de praia, e praia de margem.
  const reachPx = SEA_OPEN_CELLS * perCell;
  const spread = (kind: number) => {
    const mask = new Float32Array(width * height);
    for (let index = 0; index < mask.length; index++) mask[index] = shore[index] === kind ? 1 : 0;
    return waterHalfWidth(mask, width, height, reachPx);
  };
  const rockNear = spread(SHORE_ROCK);
  const beachNear = spread(SHORE_BEACH);
  const bankNear = spread(SHORE_BANK);
  for (let index = 0; index < shore.length; index++) {
    if (inside[index] === 0 || sea[index] <= 0.5) continue;
    shore[index] = rockNear[index] > 0 ? SHORE_ROCK : beachNear[index] > 0 ? SHORE_BEACH : bankNear[index] > 0 ? SHORE_BANK : SHORE_NONE;
  }
  return { rect, perCell, width, height, sdf: signedDistance(inside, width, height), deep, sea, shore };
}

interface Segment {
  ax: number;
  ay: number;
  dx: number;
  dy: number;
  length: number;
  /** Quanto da linha veio antes deste trecho (px do campo). */
  before: number;
  /** Comprimento da linha inteira (px do campo). */
  total: number;
}

/** Fim da linha: daqui em diante a correnteza perde força (o rio se abre no lago). */
const FADE_FROM = 0.82;
/** A linha manda até 1,3 × a meia largura do rio ali, e some nos 30% seguintes. */
const REACH = 1.3;
const FALLOFF = 0.3;

/**
 * Coordenadas do rio, RGBA por pixel do campo: ao longo da linha (px, contínuo de trecho em trecho), de que lado dela
 * (px, com sinal), força (0 a 1) e 0. Só a água conta (`sdf` > 0); a linha num trecho em terra não manda em nada.
 * Água sem linha por perto fica com força 0 (lago).
 */
export function riverField(field: WaterField, currents: WaterCurrent[]): Float32Array<ArrayBuffer> {
  const { width, height, perCell, rect, sdf } = field;
  const out = new Float32Array(width * height * 4);
  const sdfAt = (x: number, y: number) => {
    const px = Math.min(width - 1, Math.max(0, Math.round(x)));
    const py = Math.min(height - 1, Math.max(0, Math.round(y)));
    return sdf[py * width + px];
  };
  // Trechos de cada linha em pixels do campo, com quanto cada um alcança (pela largura da água por onde passa).
  const segments: (Segment & { reach: number })[] = [];
  for (const current of currents) {
    const points: [number, number][] = [];
    for (let k = 0; k + 1 < current.points.length; k += 2) points.push([(current.points[k] - rect.col) * perCell - 0.5, (current.points[k + 1] - rect.row) * perCell - 0.5]);
    let total = 0;
    for (let k = 0; k + 1 < points.length; k++) total += Math.hypot(points[k + 1][0] - points[k][0], points[k + 1][1] - points[k][1]);
    if (total <= 0) continue;
    let before = 0;
    for (let k = 0; k + 1 < points.length; k++) {
      const [ax, ay] = points[k];
      const [bx, by] = points[k + 1];
      const length = Math.hypot(bx - ax, by - ay);
      if (length <= 0) continue;
      let widest = 0;
      for (let step = 0; step <= 4; step++) widest = Math.max(widest, sdfAt(ax + ((bx - ax) * step) / 4, ay + ((by - ay) * step) / 4));
      if (widest > 0) segments.push({ ax, ay, dx: bx - ax, dy: by - ay, length, before, total, reach: widest * REACH * (1 + FALLOFF) });
      before += length;
    }
  }
  if (segments.length === 0) return out;
  // Baldes de 2 casas: cada pixel só olha os trechos que podem alcançá-lo.
  const bucket = perCell * 2;
  const bucketCols = Math.ceil(width / bucket);
  const bucketRows = Math.ceil(height / bucket);
  const buckets: number[][] = Array.from({ length: bucketCols * bucketRows }, () => []);
  segments.forEach((segment, index) => {
    const left = Math.min(segment.ax, segment.ax + segment.dx) - segment.reach;
    const right = Math.max(segment.ax, segment.ax + segment.dx) + segment.reach;
    const top = Math.min(segment.ay, segment.ay + segment.dy) - segment.reach;
    const bottom = Math.max(segment.ay, segment.ay + segment.dy) + segment.reach;
    for (let by = Math.max(0, Math.floor(top / bucket)); by <= Math.min(bucketRows - 1, Math.floor(bottom / bucket)); by++) {
      for (let bx = Math.max(0, Math.floor(left / bucket)); bx <= Math.min(bucketCols - 1, Math.floor(right / bucket)); bx++) buckets[by * bucketCols + bx].push(index);
    }
  });
  for (let py = 0; py < height; py++) {
    for (let px = 0; px < width; px++) {
      const index = py * width + px;
      if (sdf[index] <= 0) continue;
      const candidates = buckets[Math.floor(py / bucket) * bucketCols + Math.floor(px / bucket)];
      let best = Infinity;
      let along = 0;
      let across = 0;
      let halfWidth = 0;
      let total = 1;
      for (const segmentIndex of candidates) {
        const segment = segments[segmentIndex];
        const t = Math.max(0, Math.min(1, ((px - segment.ax) * segment.dx + (py - segment.ay) * segment.dy) / (segment.length * segment.length)));
        const projX = segment.ax + segment.dx * t;
        const projY = segment.ay + segment.dy * t;
        const distance = Math.hypot(px - projX, py - projY);
        if (distance >= best) continue;
        const there = sdfAt(projX, projY);
        if (there <= 0) continue;
        best = distance;
        along = segment.before + segment.length * t;
        across = ((px - segment.ax) * segment.dy - (py - segment.ay) * segment.dx) / segment.length;
        halfWidth = Math.max(there, perCell * 0.5);
        total = segment.total;
      }
      if (best === Infinity) continue;
      const reach = halfWidth * REACH;
      let strength = best <= reach ? 1 : Math.max(0, 1 - (best - reach) / (reach * FALLOFF));
      const progress = along / total;
      if (progress > FADE_FROM) strength *= 1 - Math.min(1, (progress - FADE_FROM) / (1 - FADE_FROM)) * 0.9;
      out[index * 4] = along;
      out[index * 4 + 1] = across;
      out[index * 4 + 2] = strength;
    }
  }
  return out;
}

/**
 * Pixels por casa de um grupo de água: `preferred`, mas sem passar de `maxSide` pixels de lado (um rio enorme fica
 * com menos detalhe em vez de estourar a memória e o tamanho de textura dos celulares).
 */
export function fieldScale(rect: CellRect, preferred: number, maxSide: number): number {
  return Math.min(preferred, maxSide / rect.cols, maxSide / rect.rows);
}

const halfFloatView = new Float32Array(1);
const halfBitsView = new Uint32Array(halfFloatView.buffer);

/**
 * Número para meia precisão (IEEE 754 binary16, o formato das texturas `RG16F`), arredondando para o mais perto. Grande
 * demais vira o maior finito; pequeno demais, zero.
 */
export function toHalfFloat(value: number): number {
  halfFloatView[0] = value;
  const bits = halfBitsView[0];
  const sign = (bits >>> 16) & 0x8000;
  const exponent = ((bits >>> 23) & 0xff) - 127 + 15;
  const mantissa = bits & 0x7fffff;
  if (exponent <= 0) return sign;
  if (exponent >= 31) return sign | 0x7bff;
  // O bit logo abaixo do último guardado decide o arredondamento (o "vai um" pode subir o expoente, e tudo bem).
  const rounded = ((exponent << 10) | (mantissa >>> 13)) + ((mantissa >>> 12) & 1);
  return sign | Math.min(rounded, 0x7bff);
}
