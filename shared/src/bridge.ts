import type { LightPoint } from "./light";

/**
 * Pontes (docs/design/pontes.md): peças do mapa postas de margem a margem, com as pontas em casas (a linha do meio do
 * tabuleiro), largura de 1 a 3 casas e um de três tipos. Só visuais (ADR-06).
 */

export const BRIDGE_KINDS = ["plank", "stone", "rope"] as const;
export type BridgeKind = (typeof BRIDGE_KINDS)[number];
export type BridgeWidth = 1 | 2 | 3;

export interface Bridge {
  id: string;
  from: LightPoint;
  to: LightPoint;
  width: BridgeWidth;
  kind: BridgeKind;
}

const cent = (value: number) => Math.round(value * 100) / 100;

/**
 * Ponta da ponte sob o ponteiro: na meia casa (meio das casas e linhas), para a ponte de largura 1 ou 3 correr no meio
 * das casas e a de 2 sobre a linha; livre (Shift), em centésimos, como o servidor guarda.
 */
export function snapBridgeEnd(point: LightPoint, free: boolean): LightPoint {
  if (free) return { x: cent(point.x), y: cent(point.y) };
  return { x: Math.round(point.x * 2) / 2, y: Math.round(point.y * 2) / 2 };
}

/** Comprimento da ponte, de ponta a ponta (casas). */
export function bridgeLength(bridge: Pick<Bridge, "from" | "to">): number {
  return Math.hypot(bridge.to.x - bridge.from.x, bridge.to.y - bridge.from.y);
}

/**
 * A ponte cujo tabuleiro contém o ponto; onde se cruzam, a que o desenho põe por cima: a placa de vídeo desenha um
 * tipo depois do outro (tábuas, pedra, corda), e dentro do mesmo tipo a última da lista. `null` se nenhuma.
 */
export function bridgeAt(bridges: Bridge[], point: LightPoint): Bridge | null {
  const drawOrder = bridges.map((bridge, index) => ({ bridge, rank: BRIDGE_KINDS.indexOf(bridge.kind) * bridges.length + index }));
  drawOrder.sort((first, second) => second.rank - first.rank);
  for (const { bridge } of drawOrder) {
    const length = bridgeLength(bridge);
    if (length <= 0) continue;
    const alongX = (bridge.to.x - bridge.from.x) / length;
    const alongY = (bridge.to.y - bridge.from.y) / length;
    const offsetX = point.x - bridge.from.x;
    const offsetY = point.y - bridge.from.y;
    const along = offsetX * alongX + offsetY * alongY;
    const across = Math.abs(offsetX * -alongY + offsetY * alongX);
    if (along >= 0 && along <= length && across <= bridge.width / 2) return bridge;
  }
  return null;
}

/** Folga do tabuleiro sobre a água (em níveis do relevo), por tipo: a ponte fica um pouco acima da água. */
export const BRIDGE_WATER_LIFT: Record<BridgeKind, number> = { plank: 0.3, stone: 0.55, rope: 0.12 };

/**
 * Altura do tabuleiro sobre o chão embaixo dele, em níveis do relevo (a unidade da sombra do penhasco): a rampa entre
 * as pontas menos o chão ali, nunca negativa (num morro no meio, a ponte acompanha o chão); sobre a água, mais a folga
 * do tipo. A mesma regra roda no shader (bridgeShader.ts).
 */
export function bridgeDeckHeight(rampLevel: number, groundLevel: number, overWater: boolean, kind: BridgeKind): number {
  return Math.max(0, rampLevel - groundLevel) + (overWater ? BRIDGE_WATER_LIFT[kind] : 0);
}
