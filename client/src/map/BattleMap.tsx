import { useCallback, useEffect, useLayoutEffect, useRef, useState, type DragEvent as ReactDragEvent } from "react";
// Group/Text do Mantine renomeados: os nomes colidem com os do react-konva.
import { ActionIcon, Button, Divider, Group as MGroup, Paper, Text as MText, Tooltip } from "@mantine/core";
import type Konva from "konva";
import { Circle, Group, Image as KImage, Layer, Line, Rect, Shape, Stage, Text } from "react-konva";
import { cellDistance, type ClientState, type CombatantView, type MapConfig, type Ruler } from "@rpg/shared";
import { act } from "../actions";
import { socket } from "../socket";
import { select, setTool, useApp } from "../store";
import { cellAt, cellCenter, sameCell, type Point } from "./geometry";
import { Token } from "./Token";
import { useImage } from "./useImage";

/** Tipo usado ao arrastar um combatente da lista para o mapa. */
export const DRAG_MIME = "application/x-combatant";

const MIN_SCALE = 0.1;
const MAX_SCALE = 6;

interface View {
  x: number;
  y: number;
  scale: number;
}

export function BattleMap({ state }: { state: ClientState }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const stageRef = useRef<Konva.Stage>(null);
  const [size, setSize] = useState({ width: 0, height: 0 });
  const [view, setView] = useState<View>({ x: 40, y: 40, scale: 1 });
  const [shiftHeld, setShiftHeld] = useState(false);
  const [myRuler, setMyRuler] = useState<Ruler | null>(null);
  const calibStart = useRef<Point | null>(null);

  const { tool, selectedId, rulers, calibRect, mapImage } = useApp();
  const image = useImage(mapImage.image);
  const grid = state.battle.map;
  const gm = state.self.role === "gm";
  const rulerMode = tool === "ruler" || (tool === "move" && shiftHeld);

  // Tamanho do palco acompanha o painel.
  useLayoutEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const ro = new ResizeObserver(([entry]) => {
      setSize({ width: entry.contentRect.width, height: entry.contentRect.height });
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // Shift segurado = régua temporária.
  useEffect(() => {
    const down = (e: KeyboardEvent) => e.key === "Shift" && setShiftHeld(true);
    const up = (e: KeyboardEvent) => e.key === "Shift" && setShiftHeld(false);
    const blur = () => setShiftHeld(false);
    window.addEventListener("keydown", down);
    window.addEventListener("keyup", up);
    window.addEventListener("blur", blur);
    return () => {
      window.removeEventListener("keydown", down);
      window.removeEventListener("keyup", up);
      window.removeEventListener("blur", blur);
    };
  }, []);

  // Centro da visão, usado pelo "Colocar no mapa".
  useEffect(() => {
    if (!size.width) return;
    useApp.setState({
      viewCenter: { x: (size.width / 2 - view.x) / view.scale, y: (size.height / 2 - view.y) / view.scale },
    });
  }, [view, size]);

  const fit = useCallback(() => {
    if (!size.width) return;
    if (!image) {
      setView({ x: 40, y: 40, scale: 1 });
      return;
    }
    const scale = Math.min(size.width / image.width, size.height / image.height) * 0.95;
    setView({
      scale,
      x: (size.width - image.width * scale) / 2,
      y: (size.height - image.height * scale) / 2,
    });
  }, [image, size.width, size.height]);

  // Mapa novo: enquadra a imagem inteira.
  const fittedFor = useRef<HTMLImageElement | null>(null);
  useEffect(() => {
    if (image && size.width && fittedFor.current !== image) {
      fittedFor.current = image;
      fit();
    }
  }, [image, size.width, fit]);

  function zoomAt(point: Point, factor: number) {
    setView((v) => {
      const scale = Math.max(MIN_SCALE, Math.min(MAX_SCALE, v.scale * factor));
      const world = { x: (point.x - v.x) / v.scale, y: (point.y - v.y) / v.scale };
      return { scale, x: point.x - world.x * scale, y: point.y - world.y * scale };
    });
  }

  function worldPointer(): Point | null {
    return stageRef.current?.getRelativePointerPosition() ?? null;
  }

  // Ref espelha a régua para os handlers de mouse não dependerem do último render.
  const rulerRef = useRef<Ruler | null>(null);
  function updateRuler(next: Ruler | null) {
    const prev = rulerRef.current;
    if (!next && !prev) return;
    const changed = !next || !prev || !sameCell(prev.from, next.from) || !sameCell(prev.to, next.to);
    if (!changed) return;
    rulerRef.current = next;
    setMyRuler(next);
    socket.emit("ruler:update", next);
  }

  function onMouseDown(e: Konva.KonvaEventObject<MouseEvent>) {
    if (e.evt.button !== 0) return;
    const p = worldPointer();
    if (!p) return;
    if (tool === "calibrate") {
      calibStart.current = p;
      useApp.setState({ calibRect: { x: p.x, y: p.y, width: 0, height: 0 } });
    } else if (rulerMode) {
      const cell = cellAt(p, grid);
      updateRuler({ from: cell, to: cell });
    }
  }

  function onMouseMove() {
    const p = worldPointer();
    if (!p) return;
    if (tool === "calibrate" && calibStart.current) {
      const s = calibStart.current;
      useApp.setState({
        calibRect: { x: Math.min(s.x, p.x), y: Math.min(s.y, p.y), width: Math.abs(p.x - s.x), height: Math.abs(p.y - s.y) },
      });
    } else if (rulerRef.current) {
      updateRuler({ from: rulerRef.current.from, to: cellAt(p, grid) });
    }
  }

  function onMouseUp() {
    calibStart.current = null;
    updateRuler(null);
  }

  function onDrop(e: ReactDragEvent<HTMLDivElement>) {
    const id = e.dataTransfer.getData(DRAG_MIME);
    const stage = stageRef.current;
    if (!id || !stage) return;
    e.preventDefault();
    stage.setPointersPositions(e.nativeEvent);
    const p = stage.getRelativePointerPosition();
    if (p) void act("token:move", { id, pos: cellAt(p, grid) });
  }

  // Aliados por cima (desenhados por último).
  const tokens = [...state.battle.mobs, ...state.battle.npcs, ...state.allies].filter((c) => c.pos);
  const combat = state.battle.combat;
  const activeId = combat.active ? combat.order[combat.turnIndex] : null;
  const canMove = (c: CombatantView) => gm || (c.type === "ally" && c.ownerId === state.self.id);
  // Tokens selecionados ficam por cima.
  tokens.sort((a, b) => Number(a.id === selectedId) - Number(b.id === selectedId));

  return (
    <div
      ref={containerRef}
      className={`battle-map tool-${rulerMode ? "ruler" : tool}`}
      onDragOver={(e) => {
        if (e.dataTransfer.types.includes(DRAG_MIME)) e.preventDefault();
      }}
      onDrop={onDrop}
    >
      {size.width > 0 && (
        <Stage
          ref={stageRef}
          width={size.width}
          height={size.height}
          x={view.x}
          y={view.y}
          scaleX={view.scale}
          scaleY={view.scale}
          draggable={tool === "move" && !shiftHeld}
          onDragMove={(e) => {
            if (e.target === e.target.getStage()) setView((v) => ({ ...v, x: e.target.x(), y: e.target.y() }));
          }}
          onWheel={(e) => {
            e.evt.preventDefault();
            const pointer = e.target.getStage()?.getPointerPosition();
            if (pointer) zoomAt(pointer, e.evt.deltaY < 0 ? 1.12 : 1 / 1.12);
          }}
          onMouseDown={onMouseDown}
          onMouseMove={onMouseMove}
          onMouseUp={onMouseUp}
          onMouseLeave={onMouseUp}
          onClick={(e) => {
            if (e.target === e.target.getStage() && tool === "move") select(null);
          }}
        >
          <Layer listening={false}>
            {image && <KImage image={image} />}
            {grid.showGrid && <GridLines grid={grid} view={view} size={size} onImage={!!image} />}
          </Layer>

          <Layer>
            {tokens.map((c) => (
              <Token
                key={c.id}
                c={c}
                grid={grid}
                selected={c.id === selectedId}
                active={c.id === activeId}
                draggable={canMove(c) && tool === "move" && !shiftHeld}
                onSelect={() => select(c.id)}
                onMove={async (pos) => (await act("token:move", { id: c.id, pos })).ok}
              />
            ))}
          </Layer>

          <Layer listening={false}>
            {Object.entries(rulers).map(([pid, r]) => (
              <RulerShape key={pid} ruler={r.ruler} grid={grid} scale={view.scale} label={r.name} color="#5ba3e6" />
            ))}
            {myRuler && <RulerShape ruler={myRuler} grid={grid} scale={view.scale} color="#d4a24c" />}
            {calibRect && (
              <Rect
                {...calibRect}
                stroke="#d4a24c"
                strokeWidth={2 / view.scale}
                dash={[8 / view.scale, 4 / view.scale]}
                fill="#d4a24c22"
              />
            )}
          </Layer>
        </Stage>
      )}

      <MapToolbar
        tool={tool}
        gm={gm}
        onZoom={(f) => zoomAt({ x: size.width / 2, y: size.height / 2 }, f)}
        onFit={fit}
      />

      {!image && tokens.length === 0 && (
        <Paper className="map-hint" px="md" py="sm" shadow="md">
          <MText size="sm" c="dimmed" ta="center">
            {gm
              ? "Suba a imagem do mapa no painel Mapa, ou use só o grid. Arraste aliados e mobs da lista para cá."
              : "Aguardando o mestre montar o campo. Arraste seu personagem da lista para o mapa."}
          </MText>
        </Paper>
      )}
      {tool === "calibrate" && (
        <Paper className="map-hint top" px="md" py="sm" shadow="md">
          <MText size="sm" c="gold.4" ta="center">
            Arraste um retângulo sobre um ou mais quadrados do mapa.
          </MText>
        </Paper>
      )}
    </div>
  );
}

function GridLines({
  grid,
  view,
  size,
  onImage,
}: {
  grid: MapConfig;
  view: View;
  size: { width: number; height: number };
  onImage: boolean;
}) {
  return (
    <Shape
      sceneFunc={(ctx) => {
        // Só desenha as linhas visíveis: o grid é "infinito".
        const x0 = -view.x / view.scale;
        const y0 = -view.y / view.scale;
        const x1 = x0 + size.width / view.scale;
        const y1 = y0 + size.height / view.scale;
        const { cellPx, offsetX, offsetY } = grid;
        if ((x1 - x0) / cellPx + (y1 - y0) / cellPx > 800) return;

        ctx.beginPath();
        for (let x = offsetX + Math.floor((x0 - offsetX) / cellPx) * cellPx; x <= x1; x += cellPx) {
          ctx.moveTo(x, y0);
          ctx.lineTo(x, y1);
        }
        for (let y = offsetY + Math.floor((y0 - offsetY) / cellPx) * cellPx; y <= y1; y += cellPx) {
          ctx.moveTo(x0, y);
          ctx.lineTo(x1, y);
        }
        ctx.strokeStyle = onImage ? "rgba(0,0,0,0.45)" : "rgba(255,255,255,0.09)";
        ctx.lineWidth = 1 / view.scale;
        ctx.stroke();
      }}
    />
  );
}

function RulerShape({
  ruler,
  grid,
  scale,
  label,
  color,
}: {
  ruler: Ruler;
  grid: MapConfig;
  scale: number;
  label?: string;
  color: string;
}) {
  const a = cellCenter(ruler.from, grid);
  const b = cellCenter(ruler.to, grid);
  const cells = cellDistance(ruler.from, ruler.to);
  const feet = cells * grid.feetPerCell;
  const fs = 14 / scale;
  const text = `${feet} ft · ${cells} ${cells === 1 ? "quadrado" : "quadrados"}${label ? ` (${label})` : ""}`;

  return (
    <Group>
      <Rect
        x={grid.offsetX + ruler.to.col * grid.cellPx}
        y={grid.offsetY + ruler.to.row * grid.cellPx}
        width={grid.cellPx}
        height={grid.cellPx}
        fill={`${color}33`}
      />
      <Line points={[a.x, a.y, b.x, b.y]} stroke={color} strokeWidth={3 / scale} dash={[10 / scale, 6 / scale]} />
      <Circle x={a.x} y={a.y} radius={5 / scale} fill={color} />
      <Circle x={b.x} y={b.y} radius={5 / scale} fill={color} />
      <Text
        x={b.x + 10 / scale}
        y={b.y - fs * 1.6}
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

function MapToolbar({
  tool,
  gm,
  onZoom,
  onFit,
}: {
  tool: string;
  gm: boolean;
  onZoom: (factor: number) => void;
  onFit: () => void;
}) {
  return (
    <Paper className="map-toolbar" p={4} shadow="md" radius="md">
      <MGroup gap={4} wrap="nowrap">
        <Tooltip label="Mover tokens e a visão do mapa">
          <Button variant={tool === "move" ? "filled" : "subtle"} color={tool === "move" ? undefined : "gray"} onClick={() => setTool("move")}>
            ✋ Mover
          </Button>
        </Tooltip>
        <Tooltip label="Medir distância em pés (ou segure Shift e arraste)">
          <Button
            variant={tool === "ruler" ? "filled" : "subtle"}
            color={tool === "ruler" ? undefined : "gray"}
            onClick={() => setTool(tool === "ruler" ? "move" : "ruler")}
          >
            📏 Régua
          </Button>
        </Tooltip>
        {gm && tool === "calibrate" && <Button onClick={() => setTool("move")}>Cancelar calibração</Button>}
        <Divider orientation="vertical" mx={2} />
        <Tooltip label="Afastar">
          <ActionIcon onClick={() => onZoom(1 / 1.25)} aria-label="Afastar">
            −
          </ActionIcon>
        </Tooltip>
        <Tooltip label="Aproximar">
          <ActionIcon onClick={() => onZoom(1.25)} aria-label="Aproximar">
            +
          </ActionIcon>
        </Tooltip>
        <Tooltip label="Enquadrar o mapa inteiro">
          <Button variant="subtle" color="gray" onClick={onFit}>
            Ajustar
          </Button>
        </Tooltip>
      </MGroup>
    </Paper>
  );
}
