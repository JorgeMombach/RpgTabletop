import { Circle, Group, Line, Text } from "react-konva";
import type { Area, AreaKind, MapConfig } from "@rpg/shared";
import type { Point } from "./geometry";

export const AREA_LABEL: Record<AreaKind, string> = {
  cone: "Cone",
  sphere: "Esfera",
  cylinder: "Cilindro",
  line: "Linha",
  cube: "Cubo",
};

/** O que o número em pés mede em cada forma. */
export const AREA_MEASURE: Record<AreaKind, string> = {
  cone: "comprimento",
  sphere: "raio",
  cylinder: "raio",
  line: "comprimento (5 ft de largura)",
  cube: "lado",
};

/** Largura da linha no 5e. */
const LINE_WIDTH_FT = 5;

type Grid = Pick<MapConfig, "cellPx" | "offsetX" | "offsetY" | "feetPerCell">;

/** Ponto do mundo para a origem da área (células, com meio quadrado de precisão). */
export function areaOrigin(p: Point, g: Grid): { col: number; row: number } {
  return {
    col: Math.round(((p.x - g.offsetX) / g.cellPx) * 2) / 2,
    row: Math.round(((p.y - g.offsetY) / g.cellPx) * 2) / 2,
  };
}

function originPoint(a: Area, g: Grid): Point {
  return { x: g.offsetX + a.origin.col * g.cellPx, y: g.offsetY + a.origin.row * g.cellPx };
}

/**
 * Contorno da forma em pixels do mapa, seguindo o 5e: cone com a largura igual à distância da
 * origem; linha de 5 ft de largura; cubo com a origem no meio de uma face. Esfera/cilindro = círculo.
 */
export function areaPolygon(a: Area, g: Grid): number[] {
  const o = originPoint(a, g);
  const px = (a.feet / g.feetPerCell) * g.cellPx;
  const d = { x: Math.cos(a.angle), y: Math.sin(a.angle) };
  const n = { x: -d.y, y: d.x };
  const at = (along: number, side: number) => [o.x + d.x * along + n.x * side, o.y + d.y * along + n.y * side];
  switch (a.kind) {
    case "cone":
      return [o.x, o.y, ...at(px, px / 2), ...at(px, -px / 2)];
    case "line": {
      const w = ((LINE_WIDTH_FT / g.feetPerCell) * g.cellPx) / 2;
      return [...at(0, w), ...at(px, w), ...at(px, -w), ...at(0, -w)];
    }
    case "cube":
      return [...at(0, px / 2), ...at(px, px / 2), ...at(px, -px / 2), ...at(0, -px / 2)];
    default:
      return [];
  }
}

export function AreaShape({ area, grid, scale, label, color }: { area: Area; grid: Grid; scale: number; label?: string; color: string }) {
  const o = originPoint(area, grid);
  const round = area.kind === "sphere" || area.kind === "cylinder";
  const radius = (area.feet / grid.feetPerCell) * grid.cellPx;
  const fs = 14 / scale;
  const style = {
    fill: `${color}33`,
    stroke: color,
    strokeWidth: 2 / scale,
    // Cilindro tracejado para diferenciar da esfera (vista de cima é o mesmo círculo).
    dash: area.kind === "cylinder" ? [10 / scale, 6 / scale] : undefined,
  };
  const text = `${AREA_LABEL[area.kind]} ${area.feet} ft${label ? ` (${label})` : ""}`;

  return (
    <Group listening={false}>
      {round ? <Circle x={o.x} y={o.y} radius={radius} {...style} /> : <Line points={areaPolygon(area, grid)} closed {...style} />}
      <Circle x={o.x} y={o.y} radius={4 / scale} fill={color} />
      <Text
        x={o.x + 8 / scale}
        y={o.y - fs * 1.6}
        text={text}
        fontSize={fs}
        fontStyle="bold"
        fill="#ffffff"
        stroke="#000000"
        strokeWidth={3 / scale}
        fillAfterStrokeEnabled
      />
    </Group>
  );
}
