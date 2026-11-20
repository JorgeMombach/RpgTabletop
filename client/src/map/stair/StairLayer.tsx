import { snapBridgeEnd, stairPath, stairPointAt, type LightPoint, type MapConfig, type Stair } from "@rpg/shared";
import { useState } from "react";
import { Circle, Group, Layer, Line } from "react-konva";
import { t } from "../../i18n";
import { toast } from "../../notify";
import { updateStair } from "../mapHistory";
import { STAIR_FLAT_COLOR, STAIR_LINE_COLOR, stairSizeOk } from "./stairArt";

type Grid = Pick<MapConfig, "cellPx" | "offsetX" | "offsetY">;
type StairShapeData = Omit<Stair, "id">;

/** Passo (casas) das amostras do contorno do caminho e dos degraus riscados. */
const OUTLINE_STEP = 0.1;
const FLAT_STEP = 0.3;
/** Meia largura da escada de mão e passo das travessas (casas), como no desenho da placa de vídeo. */
const LADDER_HALF = 0.2;
const RUNG_STEP = 0.28;
/** Degraus do caracol e o raio do pilar (fração do raio). */
const SPIRAL_STEPS = 12;
const SPIRAL_PILLAR = 0.2;

const toPixels = (grid: Grid) => (point: LightPoint): [number, number] => [grid.offsetX + point.x * grid.cellPx, grid.offsetY + point.y * grid.cellPx];

/** Ponto e direção da linha do meio em `u` (direção pela diferença entre dois pontos vizinhos). */
function frameAt(path: ReturnType<typeof stairPath>, u: number): { point: LightPoint; side: LightPoint } {
  const point = stairPointAt(path, u);
  const ahead = stairPointAt(path, Math.min(path.length, u + 0.01));
  const behind = stairPointAt(path, Math.max(0, u - 0.01));
  const size = Math.hypot(ahead.x - behind.x, ahead.y - behind.y) || 1;
  return { point, side: { x: -(ahead.y - behind.y) / size, y: (ahead.x - behind.x) / size } };
}

/** Contorno da escada em pixels do mapa: a faixa do caminho, o círculo do caracol ou o retângulo da de mão. */
function outline(stair: StairShapeData, grid: Grid): number[] {
  const px = toPixels(grid);
  const [first, second] = stair.points;
  if (stair.shape === "spiral") {
    const radius = stair.width / 2;
    const out: number[] = [];
    for (let index = 0; index < 48; index++) {
      const angle = (index / 48) * Math.PI * 2;
      out.push(...px({ x: first.x + Math.cos(angle) * radius, y: first.y + Math.sin(angle) * radius }));
    }
    return out;
  }
  if (stair.shape === "ladder") {
    const size = Math.hypot(second.x - first.x, second.y - first.y) || 1;
    const sideX = (-(second.y - first.y) / size) * LADDER_HALF;
    const sideY = ((second.x - first.x) / size) * LADDER_HALF;
    return [
      ...px({ x: first.x + sideX, y: first.y + sideY }),
      ...px({ x: second.x + sideX, y: second.y + sideY }),
      ...px({ x: second.x - sideX, y: second.y - sideY }),
      ...px({ x: first.x - sideX, y: first.y - sideY }),
    ];
  }
  const path = stairPath(stair.points);
  const half = stair.width / 2;
  const left: number[] = [];
  const right: [number, number][] = [];
  const count = Math.max(1, Math.ceil(path.length / OUTLINE_STEP));
  for (let index = 0; index <= count; index++) {
    const { point, side } = frameAt(path, (index / count) * path.length);
    left.push(...px({ x: point.x + side.x * half, y: point.y + side.y * half }));
    right.push(px({ x: point.x - side.x * half, y: point.y - side.y * half }));
  }
  return [...left, ...right.reverse().flat()];
}

/** Riscos do desenho chapado: degraus de través no caminho, raios no caracol, trilhos e travessas na de mão. */
function flatLines(stair: StairShapeData, grid: Grid): number[][] {
  const px = toPixels(grid);
  const [first, second] = stair.points;
  const lines: number[][] = [];
  if (stair.shape === "spiral") {
    const radius = stair.width / 2;
    const start = Math.atan2(second.y - first.y, second.x - first.x);
    for (let index = 0; index < SPIRAL_STEPS; index++) {
      const angle = start + (index / SPIRAL_STEPS) * Math.PI * 2 * 0.88;
      const direction = { x: Math.cos(angle), y: Math.sin(angle) };
      lines.push([...px({ x: first.x + direction.x * radius * SPIRAL_PILLAR, y: first.y + direction.y * radius * SPIRAL_PILLAR }), ...px({ x: first.x + direction.x * radius, y: first.y + direction.y * radius })]);
    }
    return lines;
  }
  if (stair.shape === "ladder") {
    const size = Math.hypot(second.x - first.x, second.y - first.y) || 1;
    const along = { x: (second.x - first.x) / size, y: (second.y - first.y) / size };
    const side = { x: -along.y * LADDER_HALF * 0.8, y: along.x * LADDER_HALF * 0.8 };
    lines.push([...px({ x: first.x + side.x, y: first.y + side.y }), ...px({ x: second.x + side.x, y: second.y + side.y })]);
    lines.push([...px({ x: first.x - side.x, y: first.y - side.y }), ...px({ x: second.x - side.x, y: second.y - side.y })]);
    for (let distance = RUNG_STEP / 2; distance < size; distance += RUNG_STEP) {
      const middle = { x: first.x + along.x * distance, y: first.y + along.y * distance };
      lines.push([...px({ x: middle.x + side.x, y: middle.y + side.y }), ...px({ x: middle.x - side.x, y: middle.y - side.y })]);
    }
    return lines;
  }
  const path = stairPath(stair.points);
  const half = stair.width / 2;
  for (let u = FLAT_STEP; u < path.length; u += FLAT_STEP) {
    const { point, side } = frameAt(path, u);
    lines.push([...px({ x: point.x + side.x * half, y: point.y + side.y * half }), ...px({ x: point.x - side.x * half, y: point.y - side.y * half })]);
  }
  return lines;
}

/**
 * Escadas no Konva (docs/design/escadas.md): sem WebGL 2, o desenho chapado (`flat`); com a ferramenta Escada, a
 * prévia enquanto desenha e a escolhida com alças nos pontos (arrastar move, na meia casa ou livre com Shift; botão
 * direito tira o ponto do caminho, mínimo 2).
 */
export function StairLayer({
  stairs,
  grid,
  scale,
  flat,
  editing,
  selectedId,
  draft,
}: {
  stairs: Stair[];
  grid: Grid;
  scale: number;
  flat: boolean;
  editing: boolean;
  selectedId: string | null;
  draft: StairShapeData | null;
}) {
  // Ponto sendo arrastado pela alça (a prévia segue o mouse; ao soltar vai para o servidor).
  const [moving, setMoving] = useState<{ id: string; index: number; at: LightPoint } | null>(null);
  const selected = editing ? (stairs.find((stair) => stair.id === selectedId) ?? null) : null;
  const shown = (stair: Stair): Stair =>
    moving && moving.id === stair.id ? { ...stair, points: stair.points.map((point, index) => (index === moving.index ? moving.at : point)) } : stair;
  const toCells = (x: number, y: number): LightPoint => ({ x: (x - grid.offsetX) / grid.cellPx, y: (y - grid.offsetY) / grid.cellPx });
  const px = toPixels(grid);
  if (!flat && !editing) return null;
  return (
    <Layer listening={editing}>
      {flat &&
        stairs.map((raw) => {
          const stair = shown(raw);
          return (
            <Group key={stair.id} listening={false}>
              <Line points={outline(stair, grid)} closed fill={STAIR_FLAT_COLOR[stair.material]} stroke={STAIR_LINE_COLOR[stair.material]} strokeWidth={1.5 / scale} />
              {flatLines(stair, grid).map((points, index) => (
                <Line key={index} points={points} stroke={STAIR_LINE_COLOR[stair.material]} strokeWidth={1 / scale} opacity={0.75} />
              ))}
            </Group>
          );
        })}
      {draft && draft.points.length >= 2 && (
        <Line points={outline(draft, grid)} closed fill="rgba(216,180,122,0.18)" stroke="#d8b47a" strokeWidth={2 / scale} dash={[6 / scale, 4 / scale]} listening={false} />
      )}
      {draft && draft.shape === "path" && (
        <>
          <Line points={draft.points.flatMap((point) => px(point))} stroke="#d8b47a" strokeWidth={1.5 / scale} listening={false} />
          {draft.points.map((point, index) => (
            <Circle key={index} x={px(point)[0]} y={px(point)[1]} radius={4 / scale} fill="#d8b47a" listening={false} />
          ))}
        </>
      )}
      {selected && (
        <>
          <Line points={outline(shown(selected), grid)} closed stroke="#d8b47a" strokeWidth={2 / scale} dash={[6 / scale, 4 / scale]} listening={false} />
          {shown(selected).points.map((point, index) => (
            <Circle
              key={index}
              name="stair-handle"
              x={px(point)[0]}
              y={px(point)[1]}
              radius={7 / scale}
              fill="#d8b47a"
              stroke="#2a1608"
              strokeWidth={1.5 / scale}
              draggable
              onDragMove={(event) => {
                const node = event.target;
                const at = snapBridgeEnd(toCells(node.x(), node.y()), event.evt.shiftKey);
                node.position({ x: px(at)[0], y: px(at)[1] });
                setMoving({ id: selected.id, index, at });
              }}
              onDragEnd={(event) => {
                const at = snapBridgeEnd(toCells(event.target.x(), event.target.y()), event.evt.shiftKey);
                setMoving(null);
                const points = selected.points.map((old, which) => (which === index ? at : old));
                if (stairSizeOk(selected.shape, points)) void updateStair(selected, { points });
                else toast({ kind: "error", text: t("stair.tooShort") });
              }}
              onContextMenu={(event) => {
                event.evt.preventDefault();
                if (selected.shape !== "path" || selected.points.length <= 2) return;
                const points = selected.points.filter((_, which) => which !== index);
                if (stairSizeOk(selected.shape, points)) void updateStair(selected, { points });
                else toast({ kind: "error", text: t("stair.tooShort") });
              }}
            />
          ))}
        </>
      )}
    </Layer>
  );
}
