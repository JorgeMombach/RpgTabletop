import type { WaterCurrent } from "@rpg/shared";

/**
 * Ferramenta Correnteza (água animada, docs/design/agua.md): contas da linha que o mestre risca, em casas.
 */

/** Distância mínima (casas) entre dois pontos riscados: a linha não depende da velocidade do mouse. */
export const CURRENT_STEP = 0.25;
/** Alcance da borracha de correnteza (casas). */
export const CURRENT_ERASER = 0.4;

/** Reduz a linha a no máximo `maxNumbers` números (pares x, y), mantendo o começo e o fim. */
export function simplifyCurrent(points: number[], maxNumbers: number): number[] {
  const count = points.length / 2;
  const keep = Math.floor(maxNumbers / 2);
  if (count <= keep) return points;
  const out: number[] = [];
  for (let index = 0; index < keep; index++) {
    const source = Math.round((index * (count - 1)) / (keep - 1));
    out.push(points[source * 2], points[source * 2 + 1]);
  }
  return out;
}

/** Distância do ponto (x, y) ao trecho a-b. */
function segmentDistance(x: number, y: number, ax: number, ay: number, bx: number, by: number): number {
  const dx = bx - ax;
  const dy = by - ay;
  const length = dx * dx + dy * dy;
  const t = length > 0 ? Math.max(0, Math.min(1, ((x - ax) * dx + (y - ay) * dy) / length)) : 0;
  return Math.hypot(x - (ax + dx * t), y - (ay + dy * t));
}

/** Linhas que passam a menos de `radius` casas do ponto (o que a borracha toca). */
export function currentsNear(currents: WaterCurrent[], x: number, y: number, radius: number): WaterCurrent[] {
  return currents.filter((current) => {
    for (let k = 0; k + 3 < current.points.length; k += 2) {
      if (segmentDistance(x, y, current.points[k], current.points[k + 1], current.points[k + 2], current.points[k + 3]) <= radius) return true;
    }
    return false;
  });
}
