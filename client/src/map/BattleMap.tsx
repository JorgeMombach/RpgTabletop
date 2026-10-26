import { useCallback, useEffect, useLayoutEffect, useRef, useState, type DragEvent as ReactDragEvent } from "react";
// Group/Text do Mantine renomeados: os nomes colidem com os do react-konva.
import { ActionIcon, Button, Divider, Group as MGroup, NumberInput, Paper, SegmentedControl, Text as MText, Tooltip } from "@mantine/core";
import { IconCloudOff, IconHandStop, IconPin, IconRuler2, IconSparkles } from "@tabler/icons-react";
import type Konva from "konva";
import { Circle, Group, Image as KImage, Layer, Line, Rect, Shape, Stage, Text } from "react-konva";
import { cellDistance, LIMITS, type GridPos, type Area, type AreaKind, type ClientState, type CombatantView, type MapConfig, type Ruler } from "@rpg/shared";
import { act } from "../actions";
import { socket } from "../socket";
import { AREA_DEFAULT_FEET, select, setDicePrefs, setPlacing, setTool, useApp } from "../store";
import { allCombatants } from "../format";
import { FixEffectModal } from "../components/FixEffectModal";
import { cellAt, cellCenter, nearestFreeCell, sameCell, type Point } from "./geometry";
import { AREA_LABEL, AREA_MEASURE, AreaShape, areaOrigin } from "./AreaShape";
import { EffectShape } from "./EffectShape";
import { Token } from "./Token";
import { useImage } from "./useImage";
import { WeatherOverlay } from "./WeatherOverlay";

/** Tipo usado ao arrastar um combatente da lista para o mapa. */
export const DRAG_MIME = "application/x-combatant";

const MIN_SCALE = 0.1;
const MAX_SCALE = 6;

interface View {
  x: number;
  y: number;
  scale: number;
}

/**
 * Posição da imagem girada (sentido horário) e escalada para ocupar [0, largura] × [0, altura]
 * do mapa a partir da origem: o grid e os tokens não se mexem (E17).
 */
function imageLayout(image: HTMLImageElement, rotation: number, scale: number) {
  const w = image.width * scale;
  const h = image.height * scale;
  const at: Record<number, Point> = { 0: { x: 0, y: 0 }, 90: { x: h, y: 0 }, 180: { x: w, y: h }, 270: { x: 0, y: w } };
  const turned = rotation % 180 !== 0;
  return { ...(at[rotation] ?? at[0]), w, h, bounds: { width: turned ? h : w, height: turned ? w : h } };
}

export function BattleMap({ state }: { state: ClientState }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const stageRef = useRef<Konva.Stage>(null);
  const [size, setSize] = useState({ width: 0, height: 0 });
  const [view, setView] = useState<View>({ x: 40, y: 40, scale: 1 });
  const [shiftHeld, setShiftHeld] = useState(false);
  const [myRuler, setMyRuler] = useState<Ruler | null>(null);
  const [myArea, setMyArea] = useState<Area | null>(null);
  const [fixing, setFixing] = useState(false);
  const calibStart = useRef<Point | null>(null);

  const { tool, selectedId, hoverId, rulers, areas, areaKind, areaFeet, calibRect, mapImage, placing } = useApp();
  // Pôr conjurados no mapa (E21): casa sob o mouse, para a régua até quem conjurou.
  const [hoverCell, setHoverCell] = useState<GridPos | null>(null);
  const image = useImage(mapImage.image);
  const grid = state.battle.map;
  const layout = image ? imageLayout(image, grid.rotation, grid.imageScale) : null;
  const gm = state.self.role === "gm";
  const rulerMode = !placing && (tool === "ruler" || (tool === "move" && shiftHeld));
  // Próximo da fila que já chegou no estado e está fora do mapa (a resposta da ação pode vir antes do estado).
  const placingNext = placing
    ? placing.ids.map((id) => allCombatants(state).find((c) => c.id === id)).find((c) => c && !c.pos)
    : undefined;
  const placingLeft = placing ? placing.ids.filter((id) => allCombatants(state).some((c) => c.id === id && !c.pos)).length : 0;
  const placingFrom = placing ? allCombatants(state).find((c) => c.id === placing.fromId) : undefined;

  // Esc encerra a colocação: quem sobrou fica fora do mapa (dá para arrastar da lista depois).
  useEffect(() => {
    if (!placing) return;
    const esc = (e: KeyboardEvent) => e.key === "Escape" && setPlacing(null);
    window.addEventListener("keydown", esc);
    return () => window.removeEventListener("keydown", esc);
  }, [placing]);

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
    const { width, height } = imageLayout(image, grid.rotation, grid.imageScale).bounds;
    const scale = Math.min(size.width / width, size.height / height) * 0.95;
    setView({
      scale,
      x: (size.width - width * scale) / 2,
      y: (size.height - height * scale) / 2,
    });
  }, [image, size.width, size.height, grid.rotation, grid.imageScale]);

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

  // Área de magia: fica no mapa depois de soltar o mouse, até trocar de ferramenta ou apertar Esc.
  const areaRef = useRef<Area | null>(null);
  const areaDragging = useRef(false);
  function updateArea(next: Area | null) {
    const prev = areaRef.current;
    if (!next && !prev) return;
    if (next && prev && JSON.stringify(next) === JSON.stringify(prev)) return;
    areaRef.current = next;
    setMyArea(next);
    socket.emit("area:update", next);
  }

  useEffect(() => {
    if (tool !== "area") updateArea(null);
  }, [tool]);

  // Trocar forma ou tamanho atualiza a área que já está no mapa.
  useEffect(() => {
    const a = areaRef.current;
    if (a) updateArea({ ...a, kind: areaKind, feet: areaFeet });
  }, [areaKind, areaFeet]);

  useEffect(() => {
    const esc = (e: KeyboardEvent) => e.key === "Escape" && updateArea(null);
    window.addEventListener("keydown", esc);
    return () => window.removeEventListener("keydown", esc);
  }, []);

  /** Direção da origem até o ponteiro, em passos de 1° (evita mandar mudança mínima a cada pixel). */
  function angleTo(a: Area, p: Point): number {
    const o = { x: grid.offsetX + a.origin.col * grid.cellPx, y: grid.offsetY + a.origin.row * grid.cellPx };
    if (Math.hypot(p.x - o.x, p.y - o.y) < grid.cellPx / 4) return a.angle;
    const step = Math.PI / 180;
    return Math.round(Math.atan2(p.y - o.y, p.x - o.x) / step) * step;
  }

  function onMouseDown(e: Konva.KonvaEventObject<MouseEvent>) {
    if (e.evt.button !== 0) return;
    // Clique sem mover o mouse antes: garante que o Konva saiba onde está o ponteiro.
    stageRef.current?.setPointersPositions(e.evt);
    const p = worldPointer();
    if (!p) return;
    if (placing && placingNext) {
      const occupied = allCombatants(state).flatMap((c) => (c.pos && c.id !== placingNext.id ? [c.pos] : []));
      const rest = placing.ids.filter((id) => id !== placingNext.id);
      void act("token:move", { id: placingNext.id, pos: nearestFreeCell(cellAt(p, grid), occupied) }).then((r) => {
        if (r.ok) setPlacing(rest.length ? { ...placing, ids: rest } : null);
      });
      return;
    }
    // Todos já estão no mapa (ex.: arrastados da lista): a colocação acabou.
    if (placing) setPlacing(null);
    if (tool === "calibrate") {
      calibStart.current = p;
      useApp.setState({ calibRect: { x: p.x, y: p.y, width: 0, height: 0 } });
    } else if (tool === "area") {
      areaDragging.current = true;
      updateArea({ kind: areaKind, origin: areaOrigin(p, grid), angle: areaRef.current?.angle ?? 0, feet: areaFeet });
    } else if (rulerMode) {
      const cell = cellAt(p, grid);
      updateRuler({ from: cell, to: cell });
    }
  }

  function onMouseMove() {
    const p = worldPointer();
    if (!p) return;
    if (placing) {
      const cell = cellAt(p, grid);
      setHoverCell((h) => (sameCell(h, cell) ? h : cell));
      return;
    }
    if (tool === "calibrate" && calibStart.current) {
      const s = calibStart.current;
      useApp.setState({
        calibRect: { x: Math.min(s.x, p.x), y: Math.min(s.y, p.y), width: Math.abs(p.x - s.x), height: Math.abs(p.y - s.y) },
      });
    } else if (tool === "area" && areaDragging.current && areaRef.current) {
      const a = areaRef.current;
      // Esfera e cilindro: arrastar move o centro; as outras formas giram em volta da origem.
      const round = a.kind === "sphere" || a.kind === "cylinder";
      updateArea(round ? { ...a, origin: areaOrigin(p, grid) } : { ...a, angle: angleTo(a, p) });
    } else if (rulerRef.current) {
      updateRuler({ from: rulerRef.current.from, to: cellAt(p, grid) });
    }
  }

  function onMouseUp() {
    calibStart.current = null;
    areaDragging.current = false;
    updateRuler(null);
  }

  function onDrop(e: ReactDragEvent<HTMLDivElement>) {
    const id = e.dataTransfer.getData(DRAG_MIME);
    const stage = stageRef.current;
    if (!id || !stage) return;
    e.preventDefault();
    stage.setPointersPositions(e.nativeEvent);
    const p = stage.getRelativePointerPosition();
    if (!p) return;
    // Soltar da lista é "colocar": se a casa estiver ocupada, vai para a livre mais perto.
    const occupied = allCombatants(state).flatMap((c) => (c.pos && c.id !== id ? [c.pos] : []));
    void act("token:move", { id, pos: nearestFreeCell(cellAt(p, grid), occupied) });
  }

  // Aliados por cima (desenhados por último).
  const tokens = [...state.battle.mobs, ...state.battle.npcs, ...state.allies].filter((c) => c.pos);
  const combat = state.battle.combat;
  const activeId = combat.active ? combat.order[combat.turnIndex] : null;
  const canMove = (c: CombatantView) => gm || (c.type === "ally" && c.ownerId === state.self.id);
  // Por cima de todos: o token com o mouse em cima e, abaixo dele, o selecionado. Assim o nome
  // (que aparece em cima do token) nunca fica escondido atrás do vizinho (E26).
  const rank = (c: CombatantView) => (c.id === hoverId ? 2 : c.id === selectedId ? 1 : 0);
  tokens.sort((a, b) => rank(a) - rank(b));

  return (
    <div
      ref={containerRef}
      className={`battle-map tool-${rulerMode || placing ? "ruler" : tool}`}
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
          draggable={tool === "move" && !shiftHeld && !placing}
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
            if (e.target === e.target.getStage() && tool === "move" && !placing) select(null);
          }}
        >
          <Layer listening={false}>
            {image && layout && (
              <KImage image={image} x={layout.x} y={layout.y} width={layout.w} height={layout.h} rotation={grid.rotation} />
            )}
            {grid.showGrid && <GridLines grid={grid} view={view} size={size} onImage={!!image} />}
          </Layer>

          {/* Efeitos no mapa: acima da imagem e do grid, abaixo dos tokens (E19). */}
          <Layer listening={false}>
            {state.battle.effects.map((e) => (
              <EffectShape
                key={e.id}
                effect={e}
                grid={grid}
                scale={view.scale}
                casterName={e.casterId ? allCombatants(state).find((c) => c.id === e.casterId)?.name : undefined}
              />
            ))}
          </Layer>

          <Layer>
            {tokens.map((c) => (
              <Token
                key={c.id}
                c={c}
                grid={grid}
                selected={c.id === selectedId}
                active={c.id === activeId}
                draggable={canMove(c) && tool === "move" && !shiftHeld && !placing}
                onSelect={() => select(c.id)}
                onMove={async (pos) => (await act("token:move", { id: c.id, pos })).ok}
              />
            ))}
          </Layer>

          <Layer listening={false}>
            {Object.entries(areas).map(([pid, a]) => (
              <AreaShape key={pid} area={a.area} grid={grid} scale={view.scale} label={a.name} color="#5ba3e6" />
            ))}
            {myArea && <AreaShape area={myArea} grid={grid} scale={view.scale} color="#d8b47a" />}
          </Layer>

          <Layer listening={false}>
            {Object.entries(rulers).map(([pid, r]) => (
              <RulerShape key={pid} ruler={r.ruler} grid={grid} scale={view.scale} label={r.name} color="#5ba3e6" />
            ))}
            {myRuler && <RulerShape ruler={myRuler} grid={grid} scale={view.scale} color="#d8b47a" />}
            {placing && hoverCell && (
              // Distância até quem conjurou; sem ele no mapa, só a casa.
              <RulerShape ruler={{ from: placingFrom?.pos ?? hoverCell, to: hoverCell }} grid={grid} scale={view.scale} label={placingNext?.name} color="#d8b47a" />
            )}
            {calibRect && (
              <Rect
                {...calibRect}
                stroke="#d8b47a"
                strokeWidth={2 / view.scale}
                dash={[8 / view.scale, 4 / view.scale]}
                fill="#d8b47a22"
              />
            )}
          </Layer>
        </Stage>
      )}

      {/* Clima e luz (E26): por cima do mapa e dos tokens, abaixo da barra e dos avisos. */}
      <WeatherOverlay weather={state.battle.weather} />

      <MapToolbar
        tool={tool}
        gm={gm}
        weather={!!state.battle.weather.kind}
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
      {placing && placingNext && (
        <Paper className="map-hint top" px="md" py="sm" shadow="md">
          <MText size="sm" c="bronze.4" ta="center">
            Clique onde aparece <strong>{placingNext.name}</strong>
            {placingLeft > 1 && ` (faltam ${placingLeft})`}
            {placingFrom?.pos ? `; a régua mede a distância até ${placingFrom.name}` : ""}. Esc deixa o resto fora do mapa.
          </MText>
        </Paper>
      )}
      {tool === "area" && <AreaOptions canFix={!!myArea} onFix={() => setFixing(true)} />}
      {fixing && myArea && (
        <FixEffectModal
          state={state}
          area={myArea}
          onClose={() => setFixing(false)}
          onFixed={() => {
            setFixing(false);
            updateArea(null);
          }}
        />
      )}
      {tool === "calibrate" && (
        <Paper className="map-hint top" px="md" py="sm" shadow="md">
          <MText size="sm" c="bronze.4" ta="center">
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
  weather,
  onZoom,
  onFit,
}: {
  tool: string;
  gm: boolean;
  weather: boolean;
  onZoom: (factor: number) => void;
  onFit: () => void;
}) {
  const reduceFx = useApp((s) => s.reduceFx);
  return (
    <Paper className="map-toolbar" p={4} shadow="md" radius="md">
      <MGroup gap={4} wrap="nowrap">
        <Tooltip label="Mover tokens e a visão do mapa">
          <Button variant={tool === "move" ? "filled" : "subtle"} color={tool === "move" ? undefined : "gray"} leftSection={<IconHandStop size={14} />} onClick={() => setTool("move")}>
            Mover
          </Button>
        </Tooltip>
        <Tooltip label="Medir distância em pés (ou segure Shift e arraste)">
          <Button
            variant={tool === "ruler" ? "filled" : "subtle"}
            color={tool === "ruler" ? undefined : "gray"}
            onClick={() => setTool(tool === "ruler" ? "move" : "ruler")}
            leftSection={<IconRuler2 size={14} />}
          >
            Régua
          </Button>
        </Tooltip>
        <Tooltip label="Mostrar a área de uma magia para todos (cone, esfera, cilindro, linha, cubo)">
          <Button
            variant={tool === "area" ? "filled" : "subtle"}
            color={tool === "area" ? undefined : "gray"}
            onClick={() => setTool(tool === "area" ? "move" : "area")}
            leftSection={<IconSparkles size={14} />}
          >
            Área
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
        {weather && (
          <Tooltip label={reduceFx ? "Clima completo (só neste navegador)" : "Reduzir o clima: menos partículas e sem clarão (só neste navegador)"}>
            <ActionIcon
              variant={reduceFx ? "filled" : "subtle"}
              color={reduceFx ? undefined : "gray"}
              onClick={() => setDicePrefs({ reduceFx: !reduceFx })}
              aria-label="Reduzir o clima"
              aria-pressed={reduceFx}
            >
              <IconCloudOff size={16} />
            </ActionIcon>
          </Tooltip>
        )}
      </MGroup>
    </Paper>
  );
}

const AREA_KINDS: AreaKind[] = ["cone", "sphere", "cylinder", "line", "cube"];

/** Forma e tamanho da área (ferramenta Área). */
function AreaOptions({ canFix, onFix }: { canFix: boolean; onFix: () => void }) {
  const { areaKind, areaFeet } = useApp();
  return (
    <Paper className="map-options" p="xs" shadow="md" radius="md">
      <MGroup gap="xs" wrap="nowrap" align="flex-end">
        <SegmentedControl
          size="xs"
          data={AREA_KINDS.map((k) => ({ value: k, label: AREA_LABEL[k] }))}
          value={areaKind}
          onChange={(v) => useApp.setState({ areaKind: v as AreaKind, areaFeet: AREA_DEFAULT_FEET[v as AreaKind] })}
          aria-label="Forma da área"
        />
        <Tooltip label={`Em pés: ${AREA_MEASURE[areaKind]}`}>
          <NumberInput
            w={84}
            min={LIMITS.areaFeet.min}
            max={LIMITS.areaFeet.max}
            step={5}
            allowDecimal={false}
            allowNegative={false}
            clampBehavior="blur"
            suffix=" ft"
            value={areaFeet}
            onChange={(v) => {
              const n = Number(v);
              if (Number.isInteger(n) && n >= LIMITS.areaFeet.min && n <= LIMITS.areaFeet.max) useApp.setState({ areaFeet: n });
            }}
            aria-label={`Tamanho em pés (${AREA_MEASURE[areaKind]})`}
          />
        </Tooltip>
      </MGroup>
      <MGroup gap="xs" wrap="nowrap" justify="space-between" mt={4}>
        <MText size="xs" c="dimmed">
          Clique para pôr a origem e arraste para apontar. Esc apaga.
        </MText>
        <Tooltip label="Deixa a área no mapa (graxa, teia, fogo…), com duração e concentração">
          <Button size="compact-xs" disabled={!canFix} leftSection={<IconPin size={12} />} onClick={onFix} style={{ flex: "none" }}>
            Fixar como efeito
          </Button>
        </Tooltip>
      </MGroup>
    </Paper>
  );
}
