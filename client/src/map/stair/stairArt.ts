import { LIMITS, stairPath, stairSizeProblem, type LightPoint, type Stair, type StairMaterial, type StairShape } from "@rpg/shared";
import { t, type MessageKey } from "../../i18n";

/** Cor chapada de cada material (amostra do painel e desenho sem WebGL 2), tirada da página de teste aprovada. */
export const STAIR_FLAT_COLOR: Record<StairMaterial, string> = {
  stone: "#8f8a80",
  wood: "#7a5432",
};

/** Cor dos degraus riscados por cima (desenho sem WebGL 2). */
export const STAIR_LINE_COLOR: Record<StairMaterial, string> = {
  stone: "#5f5a52",
  wood: "#4a311c",
};

export const STAIR_SHAPE_LABEL: Record<StairShape, MessageKey> = {
  path: "stair.path",
  spiral: "stair.spiral",
  ladder: "stair.ladder",
};

export const STAIR_MATERIAL_LABEL: Record<StairMaterial, MessageKey> = {
  stone: "stair.stone",
  wood: "stair.wood",
};

const cent = (value: number) => Math.round(value * 100) / 100;

/**
 * Os pontos da escada escolhida ao trocar de formato no painel: caracol e de mão usam o pé e o topo (o caracol, o pé
 * como centro e a direção do topo); a de mão fica entre 1 e 4 casas, e o caminho com pelo menos 1 casa.
 */
export function pointsForShape(stair: Stair, shape: StairShape): LightPoint[] {
  const first = stair.points[0];
  const last = stair.points[stair.points.length - 1];
  const span = Math.hypot(last.x - first.x, last.y - first.y);
  const direction = span > 0 ? { x: (last.x - first.x) / span, y: (last.y - first.y) / span } : { x: 0, y: -1 };
  const toward = (length: number): LightPoint => ({ x: cent(first.x + direction.x * length), y: cent(first.y + direction.y * length) });
  if (shape === "spiral") return [first, spiralEdge(first, last, stair.width)];
  if (shape === "ladder") return [first, toward(Math.min(4, Math.max(1, span)))];
  if (stair.shape === "path") return stair.points;
  return stairPath([first, last]).length >= 1 ? [first, last] : [first, toward(1)];
}

/**
 * A borda do caracol: no raio (meia largura), na direção de `toward` a partir do centro (a direção dá o primeiro
 * degrau); sem direção (o mesmo ponto), para a direita. Em centésimos, como o servidor guarda.
 */
export function spiralEdge(center: LightPoint, toward: LightPoint, width: number): LightPoint {
  const span = Math.hypot(toward.x - center.x, toward.y - center.y);
  const [dx, dy] = span > 0 ? [(toward.x - center.x) / span, (toward.y - center.y) / span] : [1, 0];
  return { x: cent(center.x + dx * (width / 2)), y: cent(center.y + dy * (width / 2)) };
}

/** Folga (casas) além da meia largura em que o clique ainda acrescenta um ponto no trecho. */
const INSERT_REACH = 0.25;

/**
 * Pontos da escada com caminho depois de um clique em `at` (já encaixado): entra entre os dois pontos do trecho mais
 * perto, se o clique cai na faixa dele (meia largura mais uma folga) e não repete um ponto vizinho. `null` se não cabe
 * (fora da faixa ou já com `maxPoints`).
 */
export function insertStairPoint(points: LightPoint[], width: number, at: LightPoint, maxPoints: number): LightPoint[] | null {
  if (points.length >= maxPoints) return null;
  let best: { index: number; distance: number } | null = null;
  for (let index = 0; index + 1 < points.length; index++) {
    const from = points[index];
    const to = points[index + 1];
    const lengthSquared = (to.x - from.x) ** 2 + (to.y - from.y) ** 2;
    if (lengthSquared <= 0) continue;
    const t = ((at.x - from.x) * (to.x - from.x) + (at.y - from.y) * (to.y - from.y)) / lengthSquared;
    if (t <= 0 || t >= 1) continue;
    const distance = Math.hypot(at.x - (from.x + (to.x - from.x) * t), at.y - (from.y + (to.y - from.y) * t));
    if (distance <= width / 2 + INSERT_REACH && (!best || distance < best.distance)) best = { index, distance };
  }
  if (!best) return null;
  const same = (point: LightPoint) => point.x === at.x && point.y === at.y;
  if (same(points[best.index]) || same(points[best.index + 1])) return null;
  return [...points.slice(0, best.index + 1), at, ...points.slice(best.index + 1)];
}

/**
 * O aviso da ferramenta quando a escada seria recusada pelo tamanho (a regra do servidor, `stairSizeProblem`):
 * curta demais ou longa demais, com o máximo do formato. `null` = cabe.
 */
export function stairSizeWarning(shape: StairShape, points: LightPoint[]): string | null {
  const problem = stairSizeProblem(shape, points);
  if (!problem) return null;
  if (problem === "short") return t("stair.tooShort");
  return t("stair.tooLong", { n: shape === "ladder" ? LIMITS.ladderLength.max : LIMITS.stairLength.max });
}
