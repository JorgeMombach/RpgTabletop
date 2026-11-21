import type { ReliefStroke } from "@rpg/shared";
import type { AppStore } from "../../store";

/**
 * A passada do pincel do Relevo: nível e borda, ou (modo Dunas) só a altura das dunas. Fica fora do arquivo do
 * componente (ReliefOptions.tsx) para o recarregamento rápido do Vite não recarregar a página inteira.
 */
export function reliefStrokeOf(brush: AppStore["reliefBrush"], points: number[]): ReliefStroke {
  return { level: brush.level, soft: brush.soft, radius: brush.radius, points, ...(brush.mode === "dunes" && { dune: brush.dune }) };
}
