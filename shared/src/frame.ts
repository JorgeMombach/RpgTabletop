import type { GridPos, SceneFrame } from "./types";

/**
 * Moldura da cena (docs/design/moldura.md): opcional; a área de jogo vai da casa 0, 0 até `cols` × `rows`, e nada é
 * posto fora dela. As contas em casas (pontos: as mesmas coordenadas das paredes e da luz; casas: as do grid).
 * Sem moldura, tudo vale.
 */

/** O ponto (casas) está dentro da moldura (na borda conta como dentro). */
export function pointInsideFrame(frame: SceneFrame | undefined, x: number, y: number): boolean {
  if (!frame) return true;
  return x >= 0 && y >= 0 && x <= frame.cols && y <= frame.rows;
}

/** Todos os pontos (casas) dentro da moldura. */
export function pointsInsideFrame(frame: SceneFrame | undefined, points: { x: number; y: number }[]): boolean {
  return points.every((point) => pointInsideFrame(frame, point.x, point.y));
}

/** Todas as casas dentro da moldura (um token grande ocupa várias). */
export function cellsInsideFrame(frame: SceneFrame | undefined, cells: GridPos[]): boolean {
  if (!frame) return true;
  return cells.every((cell) => cell.col >= 0 && cell.row >= 0 && cell.col < frame.cols && cell.row < frame.rows);
}
