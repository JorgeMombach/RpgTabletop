import { bridgeLength, snapBridgeEnd, type Bridge, type LightPoint, type MapConfig } from "@rpg/shared";
import { useState } from "react";
import { Circle, Group, Layer, Line } from "react-konva";
import { updateBridge } from "../mapHistory";
import { BRIDGE_FLAT_COLOR, BRIDGE_LINE_COLOR } from "./bridgeArt";

type Grid = Pick<MapConfig, "cellPx" | "offsetX" | "offsetY">;

/** Os quatro cantos do tabuleiro em pixels do mapa (pontas ± meia largura). */
function deckCorners(bridge: Pick<Bridge, "from" | "to" | "width">, grid: Grid): number[] {
  const length = bridgeLength(bridge) || 1;
  const sideX = (-(bridge.to.y - bridge.from.y) / length) * (bridge.width / 2);
  const sideY = ((bridge.to.x - bridge.from.x) / length) * (bridge.width / 2);
  const px = (x: number, y: number) => [grid.offsetX + x * grid.cellPx, grid.offsetY + y * grid.cellPx];
  return [
    ...px(bridge.from.x + sideX, bridge.from.y + sideY),
    ...px(bridge.to.x + sideX, bridge.to.y + sideY),
    ...px(bridge.to.x - sideX, bridge.to.y - sideY),
    ...px(bridge.from.x - sideX, bridge.from.y - sideY),
  ];
}

/** Tábuas riscadas de través, a cada 1/4 de casa (desenho sem WebGL 2). */
function plankLines(bridge: Bridge, grid: Grid): number[][] {
  const length = bridgeLength(bridge);
  const alongX = (bridge.to.x - bridge.from.x) / (length || 1);
  const alongY = (bridge.to.y - bridge.from.y) / (length || 1);
  const sideX = -alongY * (bridge.width / 2);
  const sideY = alongX * (bridge.width / 2);
  const lines: number[][] = [];
  for (let along = 0.25; along < length; along += 0.25) {
    const x = bridge.from.x + alongX * along;
    const y = bridge.from.y + alongY * along;
    lines.push([grid.offsetX + (x + sideX) * grid.cellPx, grid.offsetY + (y + sideY) * grid.cellPx, grid.offsetX + (x - sideX) * grid.cellPx, grid.offsetY + (y - sideY) * grid.cellPx]);
  }
  return lines;
}

/**
 * Pontes no Konva (docs/design/pontes.md): sem WebGL 2, o tabuleiro em cor chapada com as tábuas riscadas
 * (`flat`); com a ferramenta Ponte, a prévia do traço e a escolhida com alças nas pontas (arrastar move a ponta;
 * na meia casa, com Shift livre).
 */
export function BridgeLayer({
  bridges,
  grid,
  scale,
  flat,
  editing,
  selectedId,
  draft,
}: {
  bridges: Bridge[];
  grid: Grid;
  scale: number;
  flat: boolean;
  editing: boolean;
  selectedId: string | null;
  draft: Omit<Bridge, "id"> | null;
}) {
  // Ponta sendo arrastada pela alça (a prévia segue o mouse; ao soltar vai para o servidor).
  const [moving, setMoving] = useState<{ id: string; end: "from" | "to"; at: LightPoint } | null>(null);
  const selected = editing ? bridges.find((bridge) => bridge.id === selectedId) ?? null : null;
  const shown = (bridge: Bridge): Bridge => (moving && moving.id === bridge.id ? { ...bridge, [moving.end]: moving.at } : bridge);
  const toCells = (x: number, y: number): LightPoint => ({ x: (x - grid.offsetX) / grid.cellPx, y: (y - grid.offsetY) / grid.cellPx });
  if (!flat && !editing) return null;
  return (
    <Layer listening={editing}>
      {flat &&
        bridges.map((raw) => {
          const bridge = shown(raw);
          return (
            <Group key={bridge.id} listening={false}>
              <Line points={deckCorners(bridge, grid)} closed fill={BRIDGE_FLAT_COLOR[bridge.kind]} stroke={BRIDGE_LINE_COLOR[bridge.kind]} strokeWidth={1.5 / scale} />
              {plankLines(bridge, grid).map((points, index) => (
                <Line key={index} points={points} stroke={BRIDGE_LINE_COLOR[bridge.kind]} strokeWidth={1 / scale} opacity={0.7} />
              ))}
            </Group>
          );
        })}
      {draft && <Line points={deckCorners(draft, grid)} closed fill="rgba(216,180,122,0.18)" stroke="#d8b47a" strokeWidth={2 / scale} dash={[6 / scale, 4 / scale]} listening={false} />}
      {selected && (
        <>
          <Line points={deckCorners(shown(selected), grid)} closed stroke="#d8b47a" strokeWidth={2 / scale} dash={[6 / scale, 4 / scale]} listening={false} />
          {(["from", "to"] as const).map((end) => {
            const point = shown(selected)[end];
            return (
              <Circle
                key={end}
                name="bridge-handle"
                x={grid.offsetX + point.x * grid.cellPx}
                y={grid.offsetY + point.y * grid.cellPx}
                radius={7 / scale}
                fill="#d8b47a"
                stroke="#2a1608"
                strokeWidth={1.5 / scale}
                draggable
                onDragMove={(event) => {
                  const node = event.target;
                  const at = snapBridgeEnd(toCells(node.x(), node.y()), event.evt.shiftKey);
                  node.position({ x: grid.offsetX + at.x * grid.cellPx, y: grid.offsetY + at.y * grid.cellPx });
                  setMoving({ id: selected.id, end, at });
                }}
                onDragEnd={(event) => {
                  const at = snapBridgeEnd(toCells(event.target.x(), event.target.y()), event.evt.shiftKey);
                  setMoving(null);
                  const next = { ...selected, [end]: at };
                  if (bridgeLength(next) >= 1) void updateBridge(selected, { [end]: at });
                }}
              />
            );
          })}
        </>
      )}
    </Layer>
  );
}
