/**
 * Terreno pintado (criação de mapa, entrega 1): o chão é uma grade fina com 4 pontos por casa, a partir do canto do
 * grid, em unidades de casa (acompanha o grid, como paredes e objetos). Cada ponto guarda, para cada terreno, um
 * byte de intensidade (0–255); a soma dos terrenos num ponto nunca passa de 255 (onde não chega, aparece o que está
 * embaixo: a imagem do mapa ou o couro da mesa). A grade fica em pedaços de 8 × 8 casas, só os pintados, e cada
 * pedaço só com os terrenos presentes. As contas são puras: o servidor aplica as passadas e o cliente mostra a prévia
 * com a mesma função.
 */

/** Terrenos (ids estáveis, vão no arquivo de sessão); o nome mostrado vem da tradução. A ordem é a do desenho. */
export const TERRAINS = ["grass", "grassDry", "dirt", "dirtDark", "stone", "stoneLight", "sand", "water", "waterDark"] as const;
export type TerrainId = (typeof TERRAINS)[number];

/** Pontos da grade por casa (em cada eixo). */
export const TERRAIN_FINE = 4;
/** Casas de lado de um pedaço. */
export const TERRAIN_CHUNK_CELLS = 8;
/** Pontos de lado de um pedaço (32 × 32 = 1024 bytes por terreno). */
export const TERRAIN_CHUNK_SIDE = TERRAIN_FINE * TERRAIN_CHUNK_CELLS;
const CHUNK_BYTES = TERRAIN_CHUNK_SIDE * TERRAIN_CHUNK_SIDE;

/** Um pedaço: cada terreno presente, com os 1024 bytes em base64. */
export type TerrainChunk = Partial<Record<TerrainId, string>>;
/** Pedaços pintados de uma cena, pela chave `"cx,cy"`. */
export type TerrainChunks = Record<string, TerrainChunk>;

/**
 * Uma passada do pincel: terreno (ou borracha), raio em casas, força (0,1–1) e os pontos do traço (`x, y` achatados,
 * em casas). Com `rect`, é um retângulo de canto a canto (em casas, em qualquer ordem) e os pontos não contam.
 */
export interface TerrainStroke {
  terrain: TerrainId | "erase";
  radius: number;
  strength: number;
  points: number[];
  rect?: { from: { x: number; y: number }; to: { x: number; y: number } };
}

export function chunkKey(cx: number, cy: number): string {
  return `${cx},${cy}`;
}

/** Bytes de um terreno num pedaço, em base64 (funciona no Node e no navegador). */
export function encodeLayer(bytes: Uint8Array): string {
  let binary = "";
  for (let i = 0; i < bytes.length; i += 4096) binary += String.fromCharCode(...bytes.subarray(i, i + 4096));
  return btoa(binary);
}

/** Volta os bytes de um terreno; `null` se o texto não for base64 de exatamente 1024 bytes. */
export function decodeLayer(text: string): Uint8Array | null {
  let binary: string;
  try {
    binary = atob(text);
  } catch {
    return null;
  }
  if (binary.length !== CHUNK_BYTES) return null;
  const bytes = new Uint8Array(CHUNK_BYTES);
  for (let i = 0; i < CHUNK_BYTES; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

/** Pedaços abertos para mexer: os bytes de cada terreno, decodificados uma vez por passada. */
type Working = Map<string, Map<TerrainId, Uint8Array>>;

function open(chunks: TerrainChunks, working: Working, key: string): Map<TerrainId, Uint8Array> {
  let layers = working.get(key);
  if (layers) return layers;
  layers = new Map();
  for (const terrain of TERRAINS) {
    const text = chunks[key]?.[terrain];
    const bytes = text ? decodeLayer(text) : null;
    if (bytes) layers.set(terrain, bytes);
  }
  working.set(key, layers);
  return layers;
}

/** Mistura num ponto: o terreno pintado sobe Δ; se a soma passar de 255, os outros cedem na proporção do que têm. */
/** Até onde (fração do raio) o pincel tem a força cheia; daí até a borda do círculo, cai suave. */
export const BRUSH_CORE = 0.75;

/** O que uma passada do pincel já deixou em cada ponto fino ("i,j"): a força entra uma vez por passada. */
export type TerrainStrokeMemory = Map<string, number>;

/** Folga para o canto que cai exatamente num ponto da grade entrar (conta em ponto flutuante). */
const EDGE = 1e-6;

function mixPoint(layers: Map<TerrainId, Uint8Array>, index: number, terrain: TerrainId | "erase", amount: number) {
  if (terrain === "erase") {
    let total = 0;
    for (const bytes of layers.values()) total += bytes[index];
    if (total === 0) return;
    const factor = Math.max(0, total - amount) / total;
    for (const bytes of layers.values()) bytes[index] = Math.floor(bytes[index] * factor);
    return;
  }
  let target = layers.get(terrain);
  if (!target) {
    target = new Uint8Array(CHUNK_BYTES);
    layers.set(terrain, target);
  }
  target[index] = Math.min(255, target[index] + amount);
  let others = 0;
  for (const [id, bytes] of layers) if (id !== terrain) others += bytes[index];
  const excess = target[index] + others - 255;
  if (excess <= 0 || others === 0) return;
  const factor = (others - excess) / others;
  for (const [id, bytes] of layers) if (id !== terrain) bytes[index] = Math.floor(bytes[index] * factor);
}

/**
 * Aplica a passada em `chunks` (muda o objeto) e devolve as chaves dos pedaços que mudaram. Em cada ponto do traço,
 * um carimbo com força cheia até o miolo (`BRUSH_CORE` do raio) e queda suave só na beirada; a passada deposita a força
 * uma vez em cada ponto (o maior carimbo que passou por ele), sem somar a cada carimbo: força 1 cobre de uma vez, e
 * passar de novo carrega mais. `memory` guarda o que esta passada já deixou em cada ponto, para a prévia pintar
 * ponto a ponto com o mesmo resultado da passada inteira. Terreno que ficou todo zero sai do pedaço; pedaço que ficou
 * vazio sai de `chunks`.
 */
export function paintTerrain(chunks: TerrainChunks, stroke: TerrainStroke, memory: TerrainStrokeMemory = new Map()): string[] {
  const working: Working = new Map();
  const { radius, strength, terrain } = stroke;
  const touch = (i: number, j: number, amount: number) => {
    const cx = Math.floor(i / TERRAIN_CHUNK_SIDE);
    const cy = Math.floor(j / TERRAIN_CHUNK_SIDE);
    const key = chunkKey(cx, cy);
    // Borracha num pedaço que nem existe: nada a apagar (e não cria pedaço vazio).
    if (terrain === "erase" && !chunks[key] && !working.has(key)) return;
    const index = (j - cy * TERRAIN_CHUNK_SIDE) * TERRAIN_CHUNK_SIDE + (i - cx * TERRAIN_CHUNK_SIDE);
    mixPoint(open(chunks, working, key), index, terrain, amount);
  };
  if (stroke.rect) {
    // Retângulo: cada ponto de dentro (com a borda) recebe o terreno com a força toda (força 1 cobre por inteiro).
    const { from, to } = stroke.rect;
    const amount = Math.round(strength * 255);
    for (let j = Math.ceil(Math.min(from.y, to.y) * TERRAIN_FINE - EDGE); j <= Math.floor(Math.max(from.y, to.y) * TERRAIN_FINE + EDGE); j++) {
      for (let i = Math.ceil(Math.min(from.x, to.x) * TERRAIN_FINE - EDGE); i <= Math.floor(Math.max(from.x, to.x) * TERRAIN_FINE + EDGE); i++) touch(i, j, amount);
    }
  }
  for (let p = 0; !stroke.rect && p + 1 < stroke.points.length; p += 2) {
    const x = stroke.points[p];
    const y = stroke.points[p + 1];
    for (let j = Math.ceil((y - radius) * TERRAIN_FINE); j <= Math.floor((y + radius) * TERRAIN_FINE); j++) {
      for (let i = Math.ceil((x - radius) * TERRAIN_FINE); i <= Math.floor((x + radius) * TERRAIN_FINE); i++) {
        const d = Math.hypot(i / TERRAIN_FINE - x, j / TERRAIN_FINE - y) / radius;
        if (d >= 1) continue;
        const rim = Math.min(1, Math.max(0, (d - BRUSH_CORE) / (1 - BRUSH_CORE)));
        const target = Math.round(strength * 255 * (1 - rim * rim * (3 - 2 * rim)));
        const point = `${i},${j}`;
        const already = memory.get(point) ?? 0;
        if (target <= already) continue;
        memory.set(point, target);
        touch(i, j, target - already);
      }
    }
  }
  for (const [key, layers] of working) {
    const chunk: TerrainChunk = {};
    for (const [id, bytes] of layers) if (bytes.some((value) => value > 0)) chunk[id] = encodeLayer(bytes);
    if (Object.keys(chunk).length > 0) chunks[key] = chunk;
    else delete chunks[key];
  }
  return [...working.keys()];
}

/** Valores de cada terreno (0–255) no ponto da grade mais perto de `x, y` (em casas); só os maiores que zero. */
export function terrainAt(chunks: TerrainChunks, x: number, y: number): Partial<Record<TerrainId, number>> {
  const i = Math.round(x * TERRAIN_FINE);
  const j = Math.round(y * TERRAIN_FINE);
  const cx = Math.floor(i / TERRAIN_CHUNK_SIDE);
  const cy = Math.floor(j / TERRAIN_CHUNK_SIDE);
  const chunk = chunks[chunkKey(cx, cy)];
  const out: Partial<Record<TerrainId, number>> = {};
  if (!chunk) return out;
  const index = (j - cy * TERRAIN_CHUNK_SIDE) * TERRAIN_CHUNK_SIDE + (i - cx * TERRAIN_CHUNK_SIDE);
  for (const terrain of TERRAINS) {
    const text = chunk[terrain];
    const value = text ? (decodeLayer(text)?.[index] ?? 0) : 0;
    if (value > 0) out[terrain] = value;
  }
  return out;
}

/** Retângulo em pedaços (8 × 8 casas). */
export interface ChunkRect {
  cx: number;
  cy: number;
  cols: number;
  rows: number;
}

/** Os pedaços pintados, num retângulo só (a área que as texturas do terreno cobrem na placa de vídeo). */
export function terrainBounds(chunks: TerrainChunks): ChunkRect | null {
  const keys = Object.keys(chunks);
  if (keys.length === 0) return null;
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (const key of keys) {
    const [cx, cy] = key.split(",").map(Number);
    minX = Math.min(minX, cx);
    minY = Math.min(minY, cy);
    maxX = Math.max(maxX, cx);
    maxY = Math.max(maxY, cy);
  }
  return { cx: minX, cy: minY, cols: maxX - minX + 1, rows: maxY - minY + 1 };
}

/** Pesos dos terrenos no formato das texturas RGBA8: os 4 primeiros de `TERRAINS` em `first`, os 4 últimos em `second`. */
export interface TerrainWeights {
  width: number;
  height: number;
  first: Uint8Array<ArrayBuffer>;
  second: Uint8Array<ArrayBuffer>;
  /** Terrenos 9 a 12 (hoje só a areia, no canal r). */
  third: Uint8Array<ArrayBuffer>;
}

/**
 * Pesos dos terrenos para a placa de vídeo (docs/design/renderizador-chao.md): um texel por ponto fino. Sem `keys`, o
 * retângulo `bounds` inteiro; com `keys`, um bloco de 32 × 32 por pedaço, um embaixo do outro, na ordem das chaves
 * (para subir só o que mudou).
 */
export function terrainWeights(chunks: TerrainChunks, bounds: ChunkRect, keys?: string[]): TerrainWeights {
  const blocks = keys ?? null;
  const width = blocks ? TERRAIN_CHUNK_SIDE : bounds.cols * TERRAIN_CHUNK_SIDE;
  const height = blocks ? blocks.length * TERRAIN_CHUNK_SIDE : bounds.rows * TERRAIN_CHUNK_SIDE;
  const first = new Uint8Array(width * height * 4);
  const second = new Uint8Array(width * height * 4);
  const third = new Uint8Array(width * height * 4);
  const targets = [first, second, third];
  const place = (key: string, originX: number, originY: number) => {
    const chunk = chunks[key];
    if (!chunk) return;
    TERRAINS.forEach((terrain, layer) => {
      const text = chunk[terrain];
      const bytes = text ? decodeLayer(text) : null;
      if (!bytes) return;
      const target = targets[layer >> 2];
      const channel = layer % 4;
      for (let j = 0; j < TERRAIN_CHUNK_SIDE; j++) {
        for (let i = 0; i < TERRAIN_CHUNK_SIDE; i++) {
          const value = bytes[j * TERRAIN_CHUNK_SIDE + i];
          if (value > 0) target[((originY + j) * width + originX + i) * 4 + channel] = value;
        }
      }
    });
  };
  if (blocks) blocks.forEach((key, index) => place(key, 0, index * TERRAIN_CHUNK_SIDE));
  else {
    for (const key of Object.keys(chunks)) {
      const [cx, cy] = key.split(",").map(Number);
      if (cx < bounds.cx || cy < bounds.cy || cx >= bounds.cx + bounds.cols || cy >= bounds.cy + bounds.rows) continue;
      place(key, (cx - bounds.cx) * TERRAIN_CHUNK_SIDE, (cy - bounds.cy) * TERRAIN_CHUNK_SIDE);
    }
  }
  return { width, height, first, second, third };
}
