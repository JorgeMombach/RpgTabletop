import { TERRAIN_CHUNK_CELLS, type TerrainId } from "@rpg/shared";

/**
 * Arte do terreno pintado: cada terreno é uma aquarela pintada (CC0, Jonas Voland / Voxel Core Lab), com a cor
 * puxada para a paleta do Grimório, mais um detalhe desenhado por cima (folhas, pedrinhas, lajes, reflexos). O
 * detalhe é sorteado com semente pela posição no mapa: não muda ao recarregar nem emenda diferente entre pedaços.
 */
export type DetailKind = "grass" | "dirt" | "stone" | "water";

export interface TerrainArt {
  /** Aquarela de base, em `client/public/terreno/`. */
  image: string;
  /** Ajuste de cor (filtro de canvas). */
  filter: string;
  detail: DetailKind;
}

export const TERRAIN_ART: Record<TerrainId, TerrainArt> = {
  grass: { image: "grass_01", filter: "saturate(0.75) brightness(0.85)", detail: "grass" },
  grassDry: { image: "grass_03", filter: "saturate(0.55) brightness(0.95) sepia(0.45)", detail: "grass" },
  dirt: { image: "dirt_02", filter: "brightness(1.6) saturate(0.9)", detail: "dirt" },
  dirtDark: { image: "dirt_01", filter: "brightness(1.75) saturate(0.7)", detail: "dirt" },
  stone: { image: "stone_02", filter: "brightness(1.9) saturate(0.4)", detail: "stone" },
  stoneLight: { image: "stone_01", filter: "brightness(1.25) saturate(0.35)", detail: "stone" },
  water: { image: "water_01", filter: "saturate(0.7) brightness(0.8) contrast(1.1)", detail: "water" },
  waterDark: { image: "water_03", filter: "saturate(0.6) brightness(0.6) contrast(1.15)", detail: "water" },
};

let loading: Promise<Record<string, HTMLImageElement>> | null = null;

/** As aquarelas, carregadas uma vez (o servidor serve a pasta `terreno/` junto com o app). */
export function loadTerrainImages(): Promise<Record<string, HTMLImageElement>> {
  loading ??= Promise.all(
    [...new Set(Object.values(TERRAIN_ART).map((art) => art.image))].map(
      (name) =>
        new Promise<[string, HTMLImageElement]>((resolve, reject) => {
          const image = new Image();
          image.onload = () => resolve([name, image]);
          image.onerror = () => reject(new Error(`terreno/${name}.webp`));
          image.src = `terreno/${name}.webp`;
        }),
    ),
  ).then((pairs) => Object.fromEntries(pairs));
  return loading;
}

/** Sorteio repetível (semente pela posição). */
function seeded(...parts: number[]): () => number {
  let seed = 2166136261;
  for (const part of parts) seed = Math.imul(seed ^ (part | 0), 16777619) >>> 0;
  seed = (seed % 2147483646) + 1;
  return () => {
    seed = (seed * 16807) % 2147483647;
    return seed / 2147483647;
  };
}

const KIND_SEED: Record<DetailKind, number> = { grass: 11, dirt: 23, stone: 37, water: 51 };

/**
 * Desenha o detalhe do terreno no pedaço `cx, cy` (canvas com a origem no canto do pedaço, `pixelsPerCell` por casa).
 * Inclui o que nasce numa casa de folga em volta, para os traços que passam da borda aparecerem nos dois pedaços.
 */
export function drawDetail(ctx: CanvasRenderingContext2D, kind: DetailKind, cx: number, cy: number, pixelsPerCell: number) {
  const scale = pixelsPerCell / 40;
  const firstCol = cx * TERRAIN_CHUNK_CELLS;
  const firstRow = cy * TERRAIN_CHUNK_CELLS;
  if (kind === "stone") return drawSlabs(ctx, firstCol, firstRow, pixelsPerCell);
  for (let row = firstRow - 1; row <= firstRow + TERRAIN_CHUNK_CELLS; row++) {
    for (let col = firstCol - 1; col <= firstCol + TERRAIN_CHUNK_CELLS; col++) {
      const rand = seeded(KIND_SEED[kind], col, row);
      const at = () => [(col - firstCol + rand()) * pixelsPerCell, (row - firstRow + rand()) * pixelsPerCell] as const;
      if (kind === "grass") {
        for (let n = 0; n < 24; n++) {
          const [x, y] = at();
          const length = (3 + rand() * 6) * scale;
          const lean = (rand() - 0.5) * 4 * scale;
          ctx.strokeStyle = rand() < 0.5 ? "rgba(150,170,90,0.35)" : "rgba(30,45,20,0.4)";
          ctx.lineWidth = (0.8 + rand() * 0.6) * scale;
          ctx.beginPath();
          ctx.moveTo(x, y);
          ctx.quadraticCurveTo(x + lean * 0.4, y - length * 0.6, x + lean, y - length);
          ctx.stroke();
        }
      } else if (kind === "dirt") {
        const pebbles = 6 + (rand() < 0.5 ? 1 : 0);
        for (let n = 0; n < pebbles; n++) {
          const [x, y] = at();
          const radius = (0.8 + rand() * 2.4) * scale;
          ctx.fillStyle = rand() < 0.6 ? "rgba(40,28,18,0.45)" : "rgba(190,160,120,0.35)";
          ctx.beginPath();
          ctx.ellipse(x, y, radius * 1.3, radius, rand() * Math.PI, 0, Math.PI * 2);
          ctx.fill();
        }
        if (rand() < 0.55) {
          let [x, y] = at();
          ctx.strokeStyle = "rgba(30,20,12,0.35)";
          ctx.lineWidth = 0.8 * scale;
          ctx.beginPath();
          ctx.moveTo(x, y);
          for (let step = 0; step < 4; step++) {
            x += (rand() - 0.5) * 14 * scale;
            y += (rand() - 0.5) * 14 * scale;
            ctx.lineTo(x, y);
          }
          ctx.stroke();
        }
      } else {
        const ripples = 1 + (rand() < 0.5 ? 1 : 0);
        ctx.strokeStyle = "rgba(210,230,240,0.18)";
        ctx.lineWidth = scale;
        for (let n = 0; n < ripples; n++) {
          const [x, y] = at();
          const length = (6 + rand() * 14) * scale;
          ctx.beginPath();
          ctx.moveTo(x, y);
          ctx.quadraticCurveTo(x + length / 2, y - 2 * scale, x + length, y);
          ctx.stroke();
        }
      }
    }
  }
}

/**
 * Lajes em fileiras (cada fileira deslocada meia laje), com as juntas e os cantos sorteados pela posição no mapa:
 * junta escura e luz na borda de cima. Sem emenda entre pedaços.
 */
function drawSlabs(ctx: CanvasRenderingContext2D, firstCol: number, firstRow: number, pixelsPerCell: number) {
  const height = 0.72;
  const width = 0.95;
  const toPixels = (x: number, y: number): [number, number] => [(x - firstCol) * pixelsPerCell, (y - firstRow) * pixelsPerCell];
  /** Junta `k` da fileira `row`: onde ela cai na horizontal (com sorteio) e o quanto cada ponta sobe ou desce. */
  const joint = (row: number, k: number) => {
    const rand = seeded(KIND_SEED.stone, row, k);
    return { x: k * width + (row % 2 !== 0 ? width / 2 : 0) + (rand() - 0.5) * 0.36, top: (rand() - 0.5) * 0.1, bottom: (rand() - 0.5) * 0.1 };
  };
  const row0 = Math.floor((firstRow - 1) / height);
  const row1 = Math.ceil((firstRow + TERRAIN_CHUNK_CELLS + 1) / height);
  for (let row = row0; row < row1; row++) {
    const k0 = Math.floor((firstCol - 2) / width);
    const k1 = Math.ceil((firstCol + TERRAIN_CHUNK_CELLS + 2) / width);
    for (let k = k0; k < k1; k++) {
      const left = joint(row, k);
      const right = joint(row, k + 1);
      const y0 = row * height;
      const y1 = y0 + height;
      const quad = [toPixels(left.x, y0 + left.top), toPixels(right.x, y0 + right.top), toPixels(right.x, y1 + right.bottom), toPixels(left.x, y1 + left.bottom)];
      const rand = seeded(KIND_SEED.stone + 1, row, k);
      ctx.beginPath();
      quad.forEach(([x, y], k) => (k ? ctx.lineTo(x, y) : ctx.moveTo(x, y)));
      ctx.closePath();
      ctx.fillStyle = `rgba(${rand() < 0.5 ? "255,240,220" : "0,0,0"},${0.03 + rand() * 0.06})`;
      ctx.fill();
      ctx.strokeStyle = "rgba(15,12,10,0.55)";
      ctx.lineWidth = Math.max(1, pixelsPerCell * 0.04);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(quad[0][0] + 1, quad[0][1] + 1.5);
      ctx.lineTo(quad[1][0] - 1, quad[1][1] + 1.5);
      ctx.strokeStyle = "rgba(255,240,210,0.12)";
      ctx.lineWidth = Math.max(0.6, pixelsPerCell * 0.025);
      ctx.stroke();
    }
  }
}
