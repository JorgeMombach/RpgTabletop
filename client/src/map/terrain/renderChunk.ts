import { decodeLayer, TERRAIN_CHUNK_CELLS, TERRAIN_CHUNK_SIDE, TERRAIN_FINE, TERRAINS, type TerrainChunks, type TerrainId } from "@rpg/shared";
import { drawDetail, TERRAIN_ART } from "./terrainArt";

/**
 * Desenho de um pedaço do terreno (8 × 8 casas) numa imagem pronta: a mistura é feita uma vez aqui (texturas,
 * detalhe, borda irregular por ruído e borda um pouco escurecida, como pintura à mão), e a tela só desenha a imagem.
 * Os pixels da borda direita e de baixo interpolam com os pontos dos pedaços vizinhos: não há costura entre eles.
 * Onde a soma dos terrenos não chega ao máximo, o pedaço fica transparente (aparece a imagem do mapa ou o couro).
 */

/** Sorteio de 0 a 1 pela posição inteira (só contas de inteiros: é o que pesa no desenho da borda). */
function hash(x: number, y: number): number {
  let h = Math.imul(x, 374761393) + Math.imul(y, 668265263);
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}

function valueNoise(x: number, y: number): number {
  const xi = Math.floor(x);
  const yi = Math.floor(y);
  const xf = x - xi;
  const yf = y - yi;
  const u = xf * xf * (3 - 2 * xf);
  const v = yf * yf * (3 - 2 * yf);
  const a = hash(xi, yi);
  const b = hash(xi + 1, yi);
  const c = hash(xi, yi + 1);
  const d = hash(xi + 1, yi + 1);
  return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
}

/** Ruído em camadas pela posição no mapa (em casas): a borda irregular é a mesma em qualquer pedaço. */
function edgeNoise(x: number, y: number): number {
  let sum = 0;
  let amplitude = 0.5;
  let frequency = 1.82;
  for (let octave = 0; octave < 4; octave++) {
    sum += amplitude * valueNoise(x * frequency, y * frequency);
    frequency *= 2.03;
    amplitude *= 0.5;
  }
  return sum - 0.5;
}

/** O ruído empurra a intensidade em até ±0,21: fora desta faixa a cobertura já está decidida (0 ou 1). */
const NOISE_REACH = 0.21;
const EDGE_LOW = 0.32;
const EDGE_HIGH = 0.6;

const smooth = (value: number) => {
  const t = Math.min(1, Math.max(0, (value - EDGE_LOW) / (EDGE_HIGH - EDGE_LOW)));
  return t * t * (3 - 2 * t);
};

/** Pontos de um lado da grade local: os 32 do pedaço mais o primeiro do vizinho (para interpolar até a borda). */
const LOCAL = TERRAIN_CHUNK_SIDE + 1;

/**
 * Intensidade (0–1) de um terreno nos 33 × 33 pontos que o pedaço usa: os dele, mais a primeira coluna do vizinho
 * da direita, a primeira linha do de baixo e o canto. `null` se o terreno não aparece em nenhum deles.
 */
function localGrid(chunks: TerrainChunks, terrain: TerrainId, cx: number, cy: number): Float32Array | null {
  const parts = [
    [0, 0],
    [1, 0],
    [0, 1],
    [1, 1],
  ].map(([dx, dy]) => {
    const text = chunks[`${cx + dx},${cy + dy}`]?.[terrain];
    return text ? decodeLayer(text) : null;
  });
  if (parts.every((part) => !part)) return null;
  const grid = new Float32Array(LOCAL * LOCAL);
  for (let j = 0; j < LOCAL; j++) {
    for (let i = 0; i < LOCAL; i++) {
      const part = parts[(i === TERRAIN_CHUNK_SIDE ? 1 : 0) + (j === TERRAIN_CHUNK_SIDE ? 2 : 0)];
      if (!part) continue;
      grid[j * LOCAL + i] = part[(j % TERRAIN_CHUNK_SIDE) * TERRAIN_CHUNK_SIDE + (i % TERRAIN_CHUNK_SIDE)] / 255;
    }
  }
  return grid;
}

/** A textura de um terreno do tamanho do pedaço: a aquarela (um ladrilho = 8 casas = o pedaço) mais o detalhe. */
function texturePixels(terrain: TerrainId, cx: number, cy: number, side: number, pixelsPerCell: number, images: Record<string, HTMLImageElement>) {
  const canvas = document.createElement("canvas");
  canvas.width = side;
  canvas.height = side;
  const ctx = canvas.getContext("2d", { willReadFrequently: true })!;
  const art = TERRAIN_ART[terrain];
  ctx.filter = art.filter;
  ctx.drawImage(images[art.image], 0, 0, side, side);
  ctx.filter = "none";
  drawDetail(ctx, art.detail, cx, cy, pixelsPerCell);
  return ctx.getImageData(0, 0, side, side).data;
}

/** `skip`: terrenos que não entram no desenho (a água, quando o WebGL desenha a água animada). */
export function renderChunk(key: string, chunks: TerrainChunks, images: Record<string, HTMLImageElement>, pixelsPerCell: number, skip?: ReadonlySet<TerrainId>): HTMLCanvasElement {
  const [cx, cy] = key.split(",").map(Number);
  const side = TERRAIN_CHUNK_CELLS * pixelsPerCell;
  const layers: { grid: Float32Array; texture: Uint8ClampedArray }[] = [];
  for (const terrain of TERRAINS) {
    if (skip?.has(terrain)) continue;
    const grid = localGrid(chunks, terrain, cx, cy);
    if (grid) layers.push({ grid, texture: texturePixels(terrain, cx, cy, side, pixelsPerCell, images) });
  }
  const canvas = document.createElement("canvas");
  canvas.width = side;
  canvas.height = side;
  const ctx = canvas.getContext("2d")!;
  const out = ctx.createImageData(side, side);
  const values = new Float32Array(layers.length);
  const step = TERRAIN_FINE / pixelsPerCell;
  for (let py = 0; py < side; py++) {
    const fy = (py + 0.5) * step;
    const j = Math.floor(fy);
    const v = fy - j;
    for (let px = 0; px < side; px++) {
      const fx = (px + 0.5) * step;
      const i = Math.floor(fx);
      const u = fx - i;
      const base = j * LOCAL + i;
      let any = false;
      let undecided = false;
      for (let t = 0; t < layers.length; t++) {
        const grid = layers[t].grid;
        const value = (grid[base] * (1 - u) + grid[base + 1] * u) * (1 - v) + (grid[base + LOCAL] * (1 - u) + grid[base + LOCAL + 1] * u) * v;
        values[t] = value;
        if (value > EDGE_LOW - NOISE_REACH) any = true;
        if (value > EDGE_LOW - NOISE_REACH && value < EDGE_HIGH + NOISE_REACH) undecided = true;
      }
      if (!any) continue;
      // Ruído só onde ele decide alguma coisa (a borda de um terreno): no meio de uma área cheia ele não muda nada.
      const noise = undecided ? edgeNoise(cx * TERRAIN_CHUNK_CELLS + (px + 0.5) / pixelsPerCell, cy * TERRAIN_CHUNK_CELLS + (py + 0.5) / pixelsPerCell) * 0.42 : 0;
      const k = (py * side + px) * 4;
      // Mistura em camadas, na ordem dos terrenos (cor pré-multiplicada pela cobertura).
      let red = 0;
      let green = 0;
      let blue = 0;
      let cover = 0;
      for (let t = 0; t < layers.length; t++) {
        const alpha = smooth(values[t] + noise);
        if (alpha <= 0) continue;
        // Borda do terreno um pouco mais escura: lembra o traço de quem pintou à mão.
        const shade = 1 - 0.32 * Math.min(1, alpha * (1 - alpha) * 4);
        const texture = layers[t].texture;
        red = red * (1 - alpha) + texture[k] * shade * alpha;
        green = green * (1 - alpha) + texture[k + 1] * shade * alpha;
        blue = blue * (1 - alpha) + texture[k + 2] * shade * alpha;
        cover = cover * (1 - alpha) + alpha;
      }
      if (cover <= 0) continue;
      out.data[k] = red / cover;
      out.data[k + 1] = green / cover;
      out.data[k + 2] = blue / cover;
      out.data[k + 3] = cover * 255;
    }
  }
  ctx.putImageData(out, 0, 0);
  return canvas;
}
