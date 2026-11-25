import type { GridPos, SceneFrame } from "./types";

/**
 * Moldura da cena (docs/design/moldura.md): opcional; a área de jogo vai da casa 0, 0 até `cols` × `rows`, e nada é
 * posto fora dela. As contas em casas (pontos: as mesmas coordenadas das paredes e da luz; casas: as do grid).
 * Sem moldura, tudo vale.
 */

/** O que os pincéis precisam da moldura: só o tamanho. */
export type FrameClip = Pick<SceneFrame, "cols" | "rows">;

/** Ponto da grade fina do terreno (`TERRAIN_FINE` por casa) dentro do recorte; sem recorte, sim. */
export function fineInsideFrame(clip: FrameClip | undefined, i: number, j: number, perCell: number): boolean {
  if (!clip) return true;
  return i >= 0 && j >= 0 && i <= clip.cols * perCell && j <= clip.rows * perCell;
}

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

/**
 * Moldura que abraça a imagem do mapa: as casas inteiras do grid que cabem na imagem (girada e escalada como o mapa a
 * desenha), a partir do canto do grid; entre os limites da moldura.
 */
export function frameSizeForImage(
  image: { width: number; height: number },
  map: { rotation: number; imageScale: number; cellPx: number; offsetX: number; offsetY: number },
  limits: { min: number; max: number },
): { cols: number; rows: number } {
  const turned = map.rotation % 180 !== 0;
  const width = (turned ? image.height : image.width) * map.imageScale;
  const height = (turned ? image.width : image.height) * map.imageScale;
  const fit = (span: number, offset: number) => Math.max(limits.min, Math.min(limits.max, Math.floor((span - offset) / map.cellPx)));
  return { cols: fit(width, map.offsetX), rows: fit(height, map.offsetY) };
}
