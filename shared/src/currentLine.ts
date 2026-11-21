import type { WaterCurrent } from "./types";

/**
 * Continuar uma linha de correnteza (água animada, docs/design/agua.md): o mestre começa o traço perto de uma ponta
 * de uma linha que já existe e os pontos novos entram nela, em vez de virar outra linha.
 */

/** Qual ponta da linha: o começo (de onde a água vem) ou o fim (para onde ela vai). */
export type CurrentEnd = "start" | "end";

/** A ponta de linha mais perto de (x, y), até `radius` casas; `null` se não há (o meio da linha não conta). */
export function currentEndNear(currents: WaterCurrent[], x: number, y: number, radius: number): { id: string; end: CurrentEnd } | null {
  let nearest: { id: string; end: CurrentEnd } | null = null;
  let best = radius;
  for (const current of currents) {
    const { points } = current;
    if (points.length < 4) continue;
    const ends: [CurrentEnd, number, number][] = [
      ["start", points[0], points[1]],
      ["end", points[points.length - 2], points[points.length - 1]],
    ];
    for (const [end, endX, endY] of ends) {
      const distance = Math.hypot(endX - x, endY - y);
      if (distance <= best) {
        best = distance;
        nearest = { id: current.id, end };
      }
    }
  }
  return nearest;
}

/**
 * Os pontos da linha com os novos emendados na ponta: no fim, na ordem do traço; no começo, invertidos (o traço sai
 * do começo rio acima, e a água continua correndo no mesmo sentido).
 */
export function extendCurrent(points: number[], end: CurrentEnd, added: number[]): number[] {
  if (end === "end") return [...points, ...added];
  const reversed: number[] = [];
  for (let index = added.length - 2; index >= 0; index -= 2) reversed.push(added[index], added[index + 1]);
  return [...reversed, ...points];
}
