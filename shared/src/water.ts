import { chunkKey, decodeLayer, TERRAIN_CHUNK_SIDE, TERRAIN_FINE, type TerrainChunks } from "./terrain";
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
}

/** Ponto fino conta como água com mais da metade de água (rasa + funda). */
const WATER_THRESHOLD = 127;

/** Bytes de água rasa e funda de cada pedaço, decodificados uma vez por conta. */
function fineReader(chunks: TerrainChunks) {
  const cache = new Map<string, { shallow: Uint8Array | null; deep: Uint8Array | null } | null>();
  const layersOf = (key: string) => {
    if (!cache.has(key)) {
      const chunk = chunks[key];
      const shallow = chunk?.water ? decodeLayer(chunk.water) : null;
      const deep = chunk?.waterDark ? decodeLayer(chunk.waterDark) : null;
      cache.set(key, shallow || deep ? { shallow, deep } : null);
    }
    return cache.get(key) ?? null;
  };
  /** Água rasa e funda (0–255) no ponto fino (i, j). */
  return (i: number, j: number): [number, number] => {
    const cx = Math.floor(i / TERRAIN_CHUNK_SIDE);
    const cy = Math.floor(j / TERRAIN_CHUNK_SIDE);
    const layers = layersOf(chunkKey(cx, cy));
    if (!layers) return [0, 0];
    const index = (j - cy * TERRAIN_CHUNK_SIDE) * TERRAIN_CHUNK_SIDE + (i - cx * TERRAIN_CHUNK_SIDE);
    return [layers.shallow?.[index] ?? 0, layers.deep?.[index] ?? 0];
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
    if (!chunk.water && !chunk.waterDark) continue;
    const [cx, cy] = key.split(",").map(Number);
    const shallow = chunk.water ? decodeLayer(chunk.water) : null;
    const deep = chunk.waterDark ? decodeLayer(chunk.waterDark) : null;
    for (let index = 0; index < TERRAIN_CHUNK_SIDE * TERRAIN_CHUNK_SIDE; index++) {
      if ((shallow?.[index] ?? 0) + (deep?.[index] ?? 0) <= WATER_THRESHOLD) continue;
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
 * Campo de um grupo de água: a quantidade de água (rasa + funda) dos pontos finos do terreno, interpolada em cada
 * pixel; mais da metade = dentro. `deep` = parte funda dessa água.
 */
export function waterField(chunks: TerrainChunks, rect: CellRect, perCell: number): WaterField {
  const read = fineReader(chunks);
  const fineCols = rect.cols * TERRAIN_FINE + 2;
  const fineRows = rect.rows * TERRAIN_FINE + 2;
  const firstI = rect.col * TERRAIN_FINE;
  const firstJ = rect.row * TERRAIN_FINE;
  const amount = new Float32Array(fineCols * fineRows);
  const darkness = new Float32Array(fineCols * fineRows);
  for (let j = 0; j < fineRows; j++) {
    for (let i = 0; i < fineCols; i++) {
      const [shallow, deep] = read(firstI + i, firstJ + j);
      amount[j * fineCols + i] = (shallow + deep) / 255;
      darkness[j * fineCols + i] = deep / 255;
    }
  }
  const width = rect.cols * perCell;
  const height = rect.rows * perCell;
  const inside = new Uint8Array(width * height);
  const deep = new Float32Array(width * height);
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
    }
  }
  return { rect, perCell, width, height, sdf: signedDistance(inside, width, height), deep };
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
export function riverField(field: WaterField, currents: WaterCurrent[]): Float32Array {
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
