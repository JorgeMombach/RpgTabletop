import type { TableStyle } from "@rpg/shared";
import { fbm } from "./fogRender";
import { grain, shade } from "./tokenArt";

/**
 * A mesa em volta do mapa (L5): o que aparece fora da imagem, em ladrilhos que repetem. Madeira escura (tábuas
 * largas com veios e nós), tapete de couro (granulado) ou ardósia (placas de pedra azulada). Gerados uma vez.
 */

function rng(seed: number) {
  let s = seed >>> 0 || 1;
  return () => {
    s ^= s << 13;
    s ^= s >>> 17;
    s ^= s << 5;
    return ((s >>> 0) % 10000) / 10000;
  };
}

function multiplyGrain(g: CanvasRenderingContext2D, w: number, h: number, alpha: number) {
  const pattern = g.createPattern(grain(), "repeat");
  if (!pattern) return;
  g.save();
  g.globalCompositeOperation = "multiply";
  g.globalAlpha = alpha;
  g.fillStyle = pattern;
  g.fillRect(0, 0, w, h);
  g.restore();
}

/** Tábuas largas na horizontal (5 por ladrilho de 512 px), veios ondulados, nós e emendas. */
function wood(): HTMLCanvasElement {
  const W = 512;
  const c = document.createElement("canvas");
  c.width = c.height = W;
  const g = c.getContext("2d")!;
  const r = rng(7);
  const ph = W / 5;
  const tones = ["#4a2c16", "#53321a", "#3f2512", "#5a3820", "#472a15"];
  for (let i = 0; i < 5; i++) {
    const y0 = i * ph;
    // Começa antes do ladrilho e termina depois: a tábua que passa da borda volta do outro lado.
    let x = -r() * 200;
    while (x < W) {
      const w = 220 + r() * 260;
      const tone = tones[Math.floor(r() * tones.length)];
      for (const dx of [0, -W, W]) {
        const lg = g.createLinearGradient(0, y0, 0, y0 + ph);
        lg.addColorStop(0, shade(tone, 0.12));
        lg.addColorStop(1, shade(tone, -0.25));
        g.fillStyle = lg;
        g.fillRect(x + dx, y0, w, ph);
      }
      g.strokeStyle = "rgba(15,7,2,.35)";
      g.lineWidth = 1.2;
      for (let k = 0; k < 7; k++) {
        const yy = y0 + ph * (0.1 + 0.8 * r());
        const amp = 2 + r() * 4;
        const f = 0.01 + r() * 0.02;
        const p0 = r() * 6;
        g.beginPath();
        for (let xx = x; xx <= x + w; xx += 6) {
          const yv = yy + Math.sin(xx * f + p0) * amp;
          if (xx === x) g.moveTo(xx, yv);
          else g.lineTo(xx, yv);
        }
        g.stroke();
      }
      if (r() < 0.35) {
        const kx = x + w * (0.2 + 0.6 * r());
        const ky = y0 + ph * (0.3 + 0.4 * r());
        const kg = g.createRadialGradient(kx, ky, 1, kx, ky, 12);
        kg.addColorStop(0, "rgba(10,4,0,.7)");
        kg.addColorStop(1, "rgba(10,4,0,0)");
        g.fillStyle = kg;
        g.beginPath();
        g.ellipse(kx, ky, 14, 7, 0, 0, Math.PI * 2);
        g.fill();
      }
      g.fillStyle = "rgba(0,0,0,.6)";
      g.fillRect(x + w - 1.5, y0, 3, ph);
      x += w;
    }
    g.fillStyle = "rgba(0,0,0,.65)";
    g.fillRect(0, y0 + ph - 2, W, 3);
    g.fillStyle = "rgba(255,220,180,.06)";
    g.fillRect(0, y0 + 1, W, 2);
  }
  multiplyGrain(g, W, W, 0.35);
  return c;
}

/** Couro marrom escuro: granulado fino, poros e manchas largas (o ruído repete na borda do ladrilho). */
function leather(): HTMLCanvasElement {
  const N = 256;
  const c = document.createElement("canvas");
  c.width = c.height = N;
  const g = c.getContext("2d")!;
  const img = g.createImageData(N, N);
  for (let y = 0; y < N; y++) {
    for (let x = 0; x < N; x++) {
      const big = fbm(x / 32, y / 32, 3, 4, N / 32);
      const fine = fbm(x / 2, y / 2, 9, 3, N / 2);
      const pores = fbm(x / 4, y / 4, 13, 3, N / 4);
      const v = 0.55 + (big - 0.5) * 0.5 + (fine - 0.5) * 0.25 - (pores > 0.62 ? 0.08 : 0);
      const i = (y * N + x) * 4;
      img.data[i] = 70 * v + 20;
      img.data[i + 1] = 42 * v + 12;
      img.data[i + 2] = 26 * v + 8;
      img.data[i + 3] = 255;
    }
  }
  g.putImageData(img, 0, 0);
  return c;
}

/** Ardósia: placas grandes escuras e azuladas, juntas escuras, veios claros finos. */
function slate(): HTMLCanvasElement {
  const N = 400;
  const c = document.createElement("canvas");
  c.width = c.height = N;
  const g = c.getContext("2d")!;
  const r = rng(5);
  const s = 200;
  for (let y = 0; y < N; y += s) {
    for (let x = 0; x < N; x += s) {
      const t = 28 + r() * 10;
      g.fillStyle = `rgb(${t},${t + 3},${t + 8})`;
      g.fillRect(x, y, s, s);
      g.strokeStyle = "rgba(0,0,0,.7)";
      g.lineWidth = 3;
      g.strokeRect(x + 1.5, y + 1.5, s - 3, s - 3);
      g.strokeStyle = "rgba(255,255,255,.05)";
      g.lineWidth = 1;
      g.strokeRect(x + 3, y + 3, s - 6, s - 6);
    }
  }
  multiplyGrain(g, N, N, 0.6);
  g.save();
  g.globalCompositeOperation = "screen";
  g.globalAlpha = 0.25;
  g.strokeStyle = "#8a96a8";
  g.lineWidth = 0.8;
  for (let k = 0; k < 14; k++) {
    g.beginPath();
    let x = r() * N;
    let y = r() * N;
    g.moveTo(x, y);
    for (let j = 0; j < 8; j++) {
      x += (r() - 0.5) * 40;
      y += (r() - 0.3) * 30;
      g.lineTo(x, y);
    }
    g.stroke();
  }
  g.restore();
  return c;
}

const MAKERS: Record<TableStyle, () => HTMLCanvasElement> = { wood, leather, slate };
const tiles = new Map<TableStyle, HTMLCanvasElement>();

/** Ladrilho da mesa (gerado uma vez por estilo). */
export function tableTile(style: TableStyle): HTMLCanvasElement {
  let tile = tiles.get(style);
  if (!tile) tiles.set(style, (tile = MAKERS[style]()));
  return tile;
}

/** Tamanho do ladrilho em casas do grid: a madeira tem tábuas de ~1,2 casa; a ardósia, placas de 3 casas. */
export const TILE_CELLS: Record<TableStyle, number> = { wood: 6, leather: 5, slate: 6 };
