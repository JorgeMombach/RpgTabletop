import { Arrow, Layer, Line } from "react-konva";
import type { MapConfig, WaterCurrent } from "@rpg/shared";

/**
 * Linhas de correnteza com setas no sentido em que a água corre (água animada). Só aparecem para o mestre com a
 * ferramenta Terreno aberta; para a mesa, só a água correndo. `draft` = a linha sendo riscada agora.
 */

/** Uma setinha a cada tantas casas ao longo da linha. */
const ARROW_EVERY = 3;
const COLOR = "#f2d48a";

type Grid = Pick<MapConfig, "cellPx" | "offsetX" | "offsetY">;

/** Pontos em casas -> pixels do mapa. */
const toMap = (points: number[], grid: Grid) => points.map((value, index) => (index % 2 === 0 ? grid.offsetX : grid.offsetY) + value * grid.cellPx);

/** Setinhas ao longo da linha (em pixels do mapa): pares de pontos curtos, no sentido da linha. */
function arrowsAlong(points: number[], spacing: number): number[][] {
  const arrows: number[][] = [];
  let carried = spacing / 2;
  for (let k = 0; k + 3 < points.length; k += 2) {
    const [ax, ay, bx, by] = [points[k], points[k + 1], points[k + 2], points[k + 3]];
    const length = Math.hypot(bx - ax, by - ay);
    while (carried <= length && length > 0) {
      const t = carried / length;
      const x = ax + (bx - ax) * t;
      const y = ay + (by - ay) * t;
      const ux = (bx - ax) / length;
      const uy = (by - ay) / length;
      arrows.push([x - ux * 4, y - uy * 4, x + ux * 4, y + uy * 4]);
      carried += spacing;
    }
    carried -= length;
  }
  return arrows;
}

export function CurrentLines({ currents, draft, grid, scale }: { currents: WaterCurrent[]; draft: number[] | null; grid: Grid; scale: number }) {
  const lines = draft ? [...currents.map((current) => current.points), draft] : currents.map((current) => current.points);
  const width = 2 / scale;
  return (
    <Layer listening={false}>
      {lines.map((points, index) => {
        const mapPoints = toMap(points, grid);
        return [
          <Line key={`line-${index}`} points={mapPoints} stroke={COLOR} strokeWidth={width} dash={[8 / scale, 6 / scale]} opacity={0.9} lineCap="round" lineJoin="round" />,
          ...arrowsAlong(mapPoints, ARROW_EVERY * grid.cellPx).map((arrow, arrowIndex) => (
            <Arrow key={`arrow-${index}-${arrowIndex}`} points={arrow} stroke={COLOR} fill={COLOR} strokeWidth={width} pointerLength={8 / scale} pointerWidth={8 / scale} />
          )),
        ];
      })}
    </Layer>
  );
}
