/** Ruído de valor em JavaScript (sem DOM): a fumaça da névoa, a mesa, a arte dos tokens e o ruído pronto da névoa na placa. */

/** Ruído de valor com semente, contínuo: o mesmo ponto do mundo dá sempre o mesmo valor (a borda não treme). */
function hash(x: number, y: number, seed: number): number {
  let h = Math.imul(x, 374761393) ^ Math.imul(y, 668265263) ^ Math.imul(seed, 2147483647);
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}

const smooth = (t: number) => t * t * (3 - 2 * t);

/** Ruído suave em [0, 1]. `period` > 0 faz o ruído repetir (para o ladrilho emendar). */
function valueNoise(x: number, y: number, seed: number, period = 0): number {
  const x0 = Math.floor(x);
  const y0 = Math.floor(y);
  const fx = smooth(x - x0);
  const fy = smooth(y - y0);
  const w = (n: number) => (period ? ((n % period) + period) % period : n);
  const v = (ix: number, iy: number) => hash(w(ix), w(iy), seed);
  const a = v(x0, y0) + (v(x0 + 1, y0) - v(x0, y0)) * fx;
  const b = v(x0, y0 + 1) + (v(x0 + 1, y0 + 1) - v(x0, y0 + 1)) * fx;
  return a + (b - a) * fy;
}

/** Várias oitavas somadas: nuvem com detalhe grande e pequeno. */
export function fbm(x: number, y: number, seed: number, octaves: number, period = 0): number {
  let sum = 0;
  let amp = 0.5;
  let norm = 0;
  let f = 1;
  for (let i = 0; i < octaves; i++) {
    sum += amp * valueNoise(x * f, y * f, seed + i * 101, period ? period * f : 0);
    norm += amp;
    amp *= 0.5;
    f *= 2;
  }
  return sum / norm;
}
