import { Circle, Group, Line, Text } from "react-konva";
import { areaAnchor, type Area, type AreaKind, type MapConfig } from "@rpg/shared";
import { t, type MessageKey } from "../i18n";
import { toCellUnits, type Point } from "./geometry";
import { areaPolygonCells } from "./effects/effectLayout";

export const AREA_LABEL: Record<AreaKind, MessageKey> = {
  cone: "area.cone",
  sphere: "area.sphere",
  cylinder: "area.cylinder",
  line: "area.line",
  cube: "area.cube",
};

/** O que o número em pés mede em cada forma. */
export const AREA_MEASURE: Record<AreaKind, MessageKey> = {
  cone: "area.length",
  sphere: "area.radius",
  cylinder: "area.radius",
  line: "area.lineLength",
  cube: "area.side",
};


type Grid = Pick<MapConfig, "cellPx" | "offsetX" | "offsetY" | "feetPerCell" | "grid">;

/** Ponto do mundo para a origem da área (células, com meio quadrado de precisão). */
export function areaOrigin(p: Point, g: Grid): { col: number; row: number } {
  // Quadrado: meia casa (centro, canto ou meio do lado); hex (Passo 16): centro ou vértice do hex.
  const anchor = areaAnchor(toCellUnits(p, g), g.grid);
  return { col: anchor.x, row: anchor.y };
}

function originPoint(a: Area, g: Grid): Point {
  return { x: g.offsetX + a.origin.col * g.cellPx, y: g.offsetY + a.origin.row * g.cellPx };
}

/**
 * Contorno da forma em pixels do mapa, seguindo o 5e: cone com a largura igual à distância da
 * origem; linha de 5 ft de largura; cubo com a origem no meio de uma face. Esfera/cilindro = círculo.
 */
export function areaPolygon(a: Area, g: Grid): number[] {
  // a conta em casas fica em effectLayout (sem DOM, testada); aqui só vira pixel do mapa
  return areaPolygonCells(a, g.feetPerCell).map((value, index) => (index % 2 === 0 ? g.offsetX + value * g.cellPx : g.offsetY + value * g.cellPx));
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
  const text = `${t(AREA_LABEL[area.kind])} ${area.feet} ft${label ? ` (${label})` : ""}`;

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
