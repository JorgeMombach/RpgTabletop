import { triangulate, WEATHERS, type WeatherId } from "@rpg/shared";

/**
 * Clima vivendo no mapa (docs/design/clima.md): a conta sem DOM (testada no servidor). O relógio do clima e o acúmulo
 * da cobertura pelo início que o servidor guarda (igual para todos), o vento em casas, quem brilha sozinho e o telhado
 * (os cômodos fechados) em triângulos.
 */

/** Segundos até a cobertura do chão chegar ao máximo. */
export const ACCUMULATE_SECONDS = 120;

/** Pixels da textura do telhado por casa. */
export const ROOF_PER_CELL = 8;

/** Tempo do clima (segundos desde o início) e o acúmulo (0 a 1, vezes a intensidade); relógio adiantado não fica negativo. */
export function weatherClock(startedAt: number, now: number, intensity: number): { time: number; accumulation: number } {
  const time = Math.max(0, (now - startedAt) / 1000);
  return { time, accumulation: Math.min(1, time / ACCUMULATE_SECONDS) * intensity };
}

/** Vento do clima (graus) em casas de lado por casa de queda. */
export function windCells(wind: number): number {
  return Math.tan((wind * Math.PI) / 180);
}

/** Número de cada clima no shader (a ordem de `WEATHERS`). */
export const WEATHER_KIND_INDEX = Object.fromEntries(Object.keys(WEATHERS).map((kind, index) => [kind, index])) as Record<WeatherId, number>;

/** Os que brilham sozinhos (por cima da luz da cena). */
export const WEATHER_GLOWS: ReadonlySet<WeatherId> = new Set<WeatherId>(["embers", "fireflies", "magic", "spores"]);

/** Triângulos (pares x, y em casas) dos cômodos fechados: o telhado. */
export function roofTriangles(rooms: number[][]): Float32Array {
  return new Float32Array(rooms.flatMap((room) => triangulate(room)));
}

/**
 * Área da textura do telhado (casas): a caixa dos cômodos mais 1 casa; `null` sem cômodos. Num mapa enorme, corta no
 * lado máximo (`maxSide` px) a partir do canto: o que ficar de fora fica sem telhado.
 */
export function roofArea(points: Float32Array, maxSide: number): { x: number; y: number; cols: number; rows: number } | null {
  if (points.length < 6) return null;
  let [x0, y0, x1, y1] = [Infinity, Infinity, -Infinity, -Infinity];
  for (let index = 0; index + 1 < points.length; index += 2) {
    x0 = Math.min(x0, points[index]);
    y0 = Math.min(y0, points[index + 1]);
    x1 = Math.max(x1, points[index]);
    y1 = Math.max(y1, points[index + 1]);
  }
  const limit = Math.floor(maxSide / ROOF_PER_CELL);
  const x = Math.floor(x0) - 1;
  const y = Math.floor(y0) - 1;
  return { x, y, cols: Math.min(limit, Math.ceil(x1) + 1 - x), rows: Math.min(limit, Math.ceil(y1) + 1 - y) };
}
