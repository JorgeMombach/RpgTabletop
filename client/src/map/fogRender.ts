import { geometryOf, type FogRect, type GridKind, type GridPos } from "@rpg/shared";
import { fbm } from "./fogNoise";

/** O ruído ficou em `fogNoise.ts` (sem DOM); continua saindo daqui para quem já o importava. */
export { fbm };

/**
 * Desenho da névoa de guerra (G): textura de fumaça em camadas e a "máscara" do que se vê, com borda
 * esfumaçada e irregular (a névoa avança um pouco além das casas, em fiapos). Tudo gerado em canvas,
 * sem arquivo para baixar.
 */

/** Lado do ladrilho da textura (px). Repete sem emenda. */
export const FOG_TILE = 256;


export type FogLook = "dark" | "mist";

/** Cores da fumaça: escuridão dos jogadores (tinta com reflexo violeta) e bruma cinza do mestre. */
const LOOKS: Record<FogLook, { lo: [number, number, number]; hi: [number, number, number]; alpha: [number, number] }[]> = {
  // Duas camadas: o fundo denso e os fiapos por cima (derivam em direções diferentes).
  dark: [
    { lo: [6, 5, 9], hi: [30, 24, 40], alpha: [1, 1] },
    { lo: [40, 32, 58], hi: [78, 66, 104], alpha: [0, 0.32] },
  ],
  mist: [
    { lo: [92, 88, 110], hi: [150, 146, 168], alpha: [0.9, 1] },
    { lo: [190, 186, 204], hi: [228, 226, 236], alpha: [0, 0.55] },
  ],
};

const textures = new Map<string, HTMLCanvasElement>();

/** Ladrilho de fumaça de uma camada (0 = fundo, 1 = fiapos). */
export function fogTexture(look: FogLook, layer: 0 | 1): HTMLCanvasElement {
  const key = `${look}:${layer}`;
  const hit = textures.get(key);
  if (hit) return hit;
  const { lo, hi, alpha } = LOOKS[look][layer];
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = FOG_TILE;
  const ctx = canvas.getContext("2d")!;
  const img = ctx.createImageData(FOG_TILE, FOG_TILE);
  // Período em células do ruído: o ladrilho emenda nas bordas.
  const cells = layer === 0 ? 4 : 6;
  for (let y = 0; y < FOG_TILE; y++) {
    for (let x = 0; x < FOG_TILE; x++) {
      let n = fbm((x / FOG_TILE) * cells, (y / FOG_TILE) * cells, layer ? 77 : 13, 4, cells);
      // Fiapos: só as partes mais densas do ruído aparecem.
      if (layer === 1) n = Math.max(0, (n - 0.45) / 0.55);
      const i = (y * FOG_TILE + x) * 4;
      img.data[i] = lo[0] + (hi[0] - lo[0]) * n;
      img.data[i + 1] = lo[1] + (hi[1] - lo[1]) * n;
      img.data[i + 2] = lo[2] + (hi[2] - lo[2]) * n;
      img.data[i + 3] = 255 * (alpha[0] + (alpha[1] - alpha[0]) * n);
    }
  }
  ctx.putImageData(img, 0, 0);
  textures.set(key, canvas);
  return canvas;
}

/** Máscara do que fica limpo: canvas em escala reduzida e onde ele começa no grid. */
export interface FogMask {
  canvas: HTMLCanvasElement;
  col: number;
  row: number;
  /** Pixels da máscara por casa. */
  ppc: number;
}

/** Área (em casas) com o quanto ela "fura" a névoa: 1 = limpo; menos = névoa rala (explorado). */
export interface MaskArea {
  rect: FogRect;
  amount: number;
}

/** Desfoque de caixa em uma direção (feito duas vezes por eixo, fica perto de um desfoque gaussiano). */
function boxBlur(src: Float32Array, dst: Float32Array, w: number, h: number, r: number, horizontal: boolean) {
  const len = horizontal ? w : h;
  const lines = horizontal ? h : w;
  const at = (line: number, i: number) => (horizontal ? line * w + i : i * w + line);
  const span = 2 * r + 1;
  for (let line = 0; line < lines; line++) {
    let sum = 0;
    for (let i = -r; i <= r; i++) sum += src[at(line, Math.min(len - 1, Math.max(0, i)))];
    for (let i = 0; i < len; i++) {
      dst[at(line, i)] = sum / span;
      sum += src[at(line, Math.min(len - 1, i + r + 1))] - src[at(line, Math.max(0, i - r))];
    }
  }
}

/** Maior lado da máscara (px): mapa revelado enorme baixa a resolução em vez de pesar. */
const MAX_SIDE = 1600;
/** Margem em volta das áreas (casas): espaço para a borda esfumaçada. */
const MARGIN = 2;

/**
 * Máscara com borda orgânica: as casas viram manchas desfocadas e a borda ganha ruído (fiapos) e
 * avança um pouco para fora. `cover` = casas sendo cobertas agora (pincelada do mestre).
 */
export function buildMask(areas: MaskArea[], cover: FogRect[], kind?: GridKind): FogMask | null {
  if (areas.length === 0) return null;
  const raster = kind && kind !== "square" ? hexRaster(areas, cover, kind) : squareRaster(areas, cover);
  return finishMask(raster);
}

/** A máscara antes do desfoque: intensidade por pixel (`a`), a partir do canto `c0`, `r0` (em casas). */
interface Raster {
  a: Float32Array;
  w: number;
  h: number;
  c0: number;
  r0: number;
  ppc: number;
}

/** Até 5 px por casa: a borda é desfocada, mais que isso só pesa (a conta trava a tela em aparelho fraco). */
function pixelsPerCell(width: number, height: number): number {
  return Math.max(2, Math.min(5, Math.floor(MAX_SIDE / Math.max(width, height))));
}

/** Casas de cada retângulo (a névoa guarda linhas com intervalos de colunas). */
function cellsOf(rect: FogRect): GridPos[] {
  const out: GridPos[] = [];
  for (let row = rect.row; row < rect.row + rect.h; row++) for (let col = rect.col; col < rect.col + rect.w; col++) out.push({ col, row });
  return out;
}

/**
 * Hex (Passo 16): cada casa vira o hexágono dela, desenhado num canvas auxiliar com a intensidade da área
 * (composição `lighten` = a maior vence, como no quadrado); as casas sendo cobertas vão por cima, em preto. O
 * canvas faz o preenchimento dos polígonos; depois segue o mesmo desfoque e os mesmos fiapos do quadrado.
 */
function hexRaster(areas: MaskArea[], cover: FogRect[], kind: GridKind): Raster {
  const geometry = geometryOf(kind);
  const filled = areas.map(({ rect, amount }) => ({ cells: cellsOf(rect), amount }));
  const covered = cover.flatMap(cellsOf);
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (const { cells } of filled) {
    for (const cell of cells) {
      const center = geometry.center(cell);
      minX = Math.min(minX, center.x);
      minY = Math.min(minY, center.y);
      maxX = Math.max(maxX, center.x);
      maxY = Math.max(maxY, center.y);
    }
  }
  // Meia casa do centro até a borda do hex, mais a margem da borda esfumaçada.
  const c0 = Math.floor(minX - 1 - MARGIN);
  const r0 = Math.floor(minY - 1 - MARGIN);
  const width = Math.ceil(maxX + 1 + MARGIN) - c0;
  const height = Math.ceil(maxY + 1 + MARGIN) - r0;
  const ppc = pixelsPerCell(width, height);
  const w = width * ppc;
  const h = height * ppc;
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d", { willReadFrequently: true })!;
  ctx.setTransform(ppc, 0, 0, ppc, -c0 * ppc, -r0 * ppc);
  const trace = (cells: GridPos[]) => {
    ctx.beginPath();
    for (const cell of cells) {
      const corners = geometry.polygon(cell);
      ctx.moveTo(corners[0].x, corners[0].y);
      for (const corner of corners.slice(1)) ctx.lineTo(corner.x, corner.y);
      ctx.closePath();
    }
  };
  ctx.globalCompositeOperation = "lighten";
  for (const { cells, amount } of filled) {
    const level = Math.round(amount * 255);
    ctx.fillStyle = `rgb(${level}, ${level}, ${level})`;
    trace(cells);
    ctx.fill();
  }
  if (covered.length > 0) {
    ctx.globalCompositeOperation = "source-over";
    ctx.fillStyle = "#000";
    trace(covered);
    ctx.fill();
  }
  const pixels = ctx.getImageData(0, 0, w, h).data;
  const a = new Float32Array(w * h);
  for (let i = 0; i < a.length; i++) a[i] = pixels[i * 4] / 255;
  return { a, w, h, c0, r0, ppc };
}

/** Quadrado: cada retângulo pintado direto no vetor (o caminho de sempre). */
function squareRaster(areas: MaskArea[], cover: FogRect[]): Raster {
  let c0 = Infinity;
  let r0 = Infinity;
  let c1 = -Infinity;
  let r1 = -Infinity;
  for (const { rect } of areas) {
    c0 = Math.min(c0, rect.col);
    r0 = Math.min(r0, rect.row);
    c1 = Math.max(c1, rect.col + rect.w);
    r1 = Math.max(r1, rect.row + rect.h);
  }
  c0 -= MARGIN;
  r0 -= MARGIN;
  c1 += MARGIN;
  r1 += MARGIN;
  const ppc = pixelsPerCell(c1 - c0, r1 - r0);
  const w = (c1 - c0) * ppc;
  const h = (r1 - r0) * ppc;

  const a = new Float32Array(w * h);
  const fill = (r: FogRect, v: number, max: boolean) => {
    const x0 = (r.col - c0) * ppc;
    const y0 = (r.row - r0) * ppc;
    for (let y = Math.max(0, y0); y < Math.min(h, y0 + r.h * ppc); y++) {
      for (let x = Math.max(0, x0); x < Math.min(w, x0 + r.w * ppc); x++) {
        const i = y * w + x;
        a[i] = max ? Math.max(a[i], v) : v;
      }
    }
  };
  for (const { rect, amount } of areas) fill(rect, amount, true);
  for (const r of cover) fill(r, 0, false);
  return { a, w, h, c0, r0, ppc };
}

/** Desfoque e fiapos (iguais nas duas grades); devolve a máscara pronta para desenhar. */
function finishMask({ a, w, h, c0, r0, ppc }: Raster): FogMask {

  // Desfoque: a borda vira uma rampa de mais ou menos meia casa.
  const tmp = new Float32Array(w * h);
  const radius = Math.max(1, Math.round(ppc * 0.35));
  for (let pass = 0; pass < 2; pass++) {
    boxBlur(a, tmp, w, h, radius, true);
    boxBlur(tmp, a, w, h, radius, false);
  }

  // Fiapos: só onde a máscara está mudando (a borda), um ruído empurra para dentro ou para fora,
  // com um leve avanço para fora (a névoa "abre" um pouco além das casas).
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d")!;
  const img = ctx.createImageData(w, h);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const i = y * w + x;
      const v = a[i];
      const gx = a[y * w + Math.min(w - 1, x + 1)] - a[y * w + Math.max(0, x - 1)];
      const gy = a[Math.min(h - 1, y + 1) * w + x] - a[Math.max(0, y - 1) * w + x];
      // Longe da borda não há fiapo: pula o ruído, que é a parte cara (quase todos os pontos caem aqui).
      if (gx === 0 && gy === 0) {
        img.data[i * 4 + 3] = v * 255;
        continue;
      }
      const edge = Math.min(1, Math.hypot(gx, gy) * ppc * 1.6);
      // Coordenadas do mundo (em casas): o ruído não muda quando a máscara cresce ou anda.
      const wx = c0 + x / ppc;
      const wy = r0 + y / ppc;
      const n = fbm(wx * 1.3, wy * 1.3, 5, 3) - 0.5;
      const out = Math.max(0, Math.min(1, v + edge * (n * 0.9 + 0.12)));
      img.data[i * 4 + 3] = out * 255;
    }
  }
  ctx.putImageData(img, 0, 0);
  return { canvas, col: c0, row: r0, ppc };
}
