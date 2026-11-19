import { memo, useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, type DragEvent as ReactDragEvent } from "react";
// Group/Text do Mantine renomeados: os nomes colidem com os do react-konva.
import { ActionIcon, Button, Divider, Group as MGroup, NumberInput, Paper, SegmentedControl, Text as MText, Tooltip } from "@mantine/core";
import { IconArrowUpRight, IconCloudFog, IconCloudOff, IconCurrentLocation, IconFocusCentered, IconHandFinger, IconHandStop, IconPencil, IconPin, IconRuler2, IconSparkles } from "@tabler/icons-react";
import type Konva from "konva";
import { Circle, Group, Image as KImage, Layer, Line, Rect, Shape, Stage, Text } from "react-konva";
import { brushCells, doorLayouts, floorRoomAt, paintFloor, type FloorChunks, type LightPoint, duneDustLevel, lightBlockers, paintRelief, paintTerrain, type ReliefChunks, type TerrainChunks, cellsToRects, cellsWithCenterIn, geometryOf, isHex, LIMITS, type GridPos, type Area, type AreaKind, type ClientState, type CombatantView, type MapConfig, type MapTorchStyle, type Ruler, type TableStyle, type Wall, type Drawing, type MapProp, type MapTorch, wallRooms } from "@rpg/shared";
import { act } from "../actions";
import { useT } from "../i18n";
import { socket } from "../socket";
import { AREA_DEFAULT_FEET, openSheet, select, setDicePrefs, setPlacing, setTool, useApp, type MapTool } from "../store";
import { allCombatants, currentGroup, turnLocked } from "../format";
import { InitiativeTrack } from "./InitiativeTrack";
import { TokenMenu, type MenuFocus } from "./TokenMenu";
import { typingOrDialog } from "../components/Shortcuts";
import { removeCombatant } from "../commands";
import { DarkReminder } from "./DarkReminder";
import { FixEffectModal } from "../components/FixEffectModal";
import { LootWindow } from "../components/LootWindow";
import { TipTitle } from "../components/TipTitle";
import { CALIBRATE_HINT } from "../components/MapPanel";
import { TerrainLayer } from "./terrain/TerrainLayer";
import { GroundLayer } from "./ground/GroundLayer";
import { GroundRenderer } from "./ground/GroundRenderer";
import { GroundOutputLayer, GroundWallsImage } from "./ground/GroundOutputLayer";
import { useTokenDrag } from "./dragFollow";
import { lightSources, type Dragging } from "./ground/lightSources";
import { GM_FLOOR, SCENE_LIGHT } from "./ground/sceneLight";
import type { LightingInput } from "./ground/lightPass";
import { CurrentLines } from "./water/CurrentLines";
import { CURRENT_ERASER, CURRENT_STEP, currentsNear, simplifyCurrent } from "./water/currentTool";

/** O navegador desenha a água animada (WebGL 2): conferido uma vez. */
const WEBGL_GROUND = GroundRenderer.supported();
/** Nenhuma peça que dá luz sendo arrastada (o mesmo objeto sempre: não redesenha à toa). */
const NO_DRAG: Dragging = { id: null, dx: 0, dy: 0 };
import { useSmallScreen } from "../layout";
import { cellAt, cellCenter, placeFor, sameCell, shapeCenterAt, toCellUnits, toWorld, type Point } from "./geometry";
import { AREA_LABEL, AREA_MEASURE, AreaShape, areaOrigin } from "./AreaShape";
import { AuraShape } from "./AuraShape";
import { DrawingShape, DrawOptions, ERASER_CELLS, type DrawMode } from "./DrawingShape";
import { wallPointAt, wallSpan, WallPreview, WallShape } from "./WallShape";
import { WallChains } from "./WallChains";
import { paintColorOf } from "./PaintOptions";
import { MapPropLayer, propSpot, tokenSpots } from "./MapProps";
import { scatter } from "./scatter";
import { toast } from "../notify";
import { addChest, addCurrent, removeCurrents, addDrawing, addProp, addProps, addTorch, removeProps, addWall, erasePaint, paintCells, paintFloorStroke, paintReliefStroke, paintTerrainStroke, restyleWalls, recordDrawingErase, recordTorchErase, recordWallErase, undo, type UndoScope } from "./mapHistory";
import { reliefStrokeOf } from "./terrain/ReliefOptions";
import { FloorLayer } from "./floor/FloorLayer";
import { floorStrokeOf } from "./floor/FloorOptions";
import { tableTile, TILE_CELLS } from "./tableArt";
import { brushRect, FogLayer, FogOptions, rectBetween, sendFog, type FogDraft } from "./Fog";
import { PingShape } from "./PingShape";
import { EffectShape } from "./EffectShape";
import { EffectTipLayer, hideEffectTip, showEffectTip } from "./EffectTip";
import { Token } from "./Token";
import { useImage } from "./useImage";
import { LastSeenOverlay } from "./LastSeen";
import { screenLights, TorchGlowLayer } from "./Torch";
import { MapTorchLayer, TORCH_DRAG_MIME } from "./MapTorches";
import { ChestEditor, MapChestLayer } from "./MapChests";
import { PauseButton, PauseOverlay, PingOptions } from "./PauseOverlay";
import { ViewAsBanner } from "./ViewAsBanner";
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

/** Tecla de atalho de cada ferramenta (L8), mostrada no tooltip; a lista completa fica na ajuda (`?`). */
export const TOOL_KEYS: Record<string, string> = { move: "V", ruler: "R", area: "Q", ping: "P", draw: "B", walls: "G", torches: "L", chests: "J", props: "O", paint: "E", terrain: "M", relief: "N", floor: "K", fog: "F" };

/** `compact` = tela de celular (E23): barra só com ícones; zoom com pinça. */
/** Velocidade do mapa com W, A, S, D (pixels da tela por segundo). */
const PAN_SPEED = 700;

/** Raio da borracha das paredes, em casas. */
const WALL_ERASER = 0.25;

/** `readOnly` (Passo 11): o mestre vendo como um jogador; só olhar, sem ferramentas nem mexer em nada. */
export function BattleMap({ state, compact = false, readOnly = false }: { state: ClientState; compact?: boolean; readOnly?: boolean }) {
  const t = useT();
  const containerRef = useRef<HTMLDivElement>(null);
  const stageRef = useRef<Konva.Stage>(null);
  const [size, setSize] = useState({ width: 0, height: 0 });
  const [view, setView] = useState<View>({ x: 40, y: 40, scale: 1 });
  const [mapLeft, setMapLeft] = useState(0);
  // O que o canvas enxerga: a área visível mais o pedaço embaixo da coluna da esquerda.
  const stageX = view.x + mapLeft;
  const stageView = useMemo(() => ({ x: stageX, y: view.y, scale: view.scale }), [stageX, view.y, view.scale]);
  const stageSize = useMemo(() => ({ width: size.width + mapLeft, height: size.height }), [size.width, mapLeft, size.height]);
  // Visão atual para efeitos que não devem rodar a cada mudança dela (câmera seguindo a vez).
  const [menu, setMenu] = useState<{ id: string; x: number; y: number; focus?: MenuFocus } | null>(null);
  const viewRef = useRef(view);
  viewRef.current = view;
  const [shiftHeld, setShiftHeld] = useState(false);
  const [myRuler, setMyRuler] = useState<Ruler | null>(null);
  const [myArea, setMyArea] = useState<Area | null>(null);
  const [fixing, setFixing] = useState(false);
  const calibStart = useRef<Point | null>(null);
  // Pinça com dois dedos (E23): distância e centro do último quadro, em pixels da tela.
  const pinch = useRef<{ dist: number; center: Point } | null>(null);

  const { drawMode, drawColor, drawWidth, drawHidden, wallMode, wallSnap, selectedDoorId, wallDrawStyle, fogReveal, fogShape, fogBrush, paintPreset, paintColor, paintErase, paintSize, terrainBrush, reliefBrush, floorBrush, reduceFx } = useApp();
  const selectedPropId = useApp((s) => s.selectedPropId);
  const { tool, selectedId, hoverId, rulers, pings, areas, areaKind, areaFeet, calibRect, mapImage, placing, gathering, terrain, terrainEpoch, relief, reliefEpoch, reliefPreview, floors, floorPreview, groundFailed } = useApp();
  // Celular: o terreno é desenhado com menos pixels por casa (pesa menos).
  const smallScreen = useSmallScreen();
  // Pôr conjurados no mapa (E21): casa sob o mouse, para a régua até quem conjurou.
  const [hoverCell, setHoverCell] = useState<GridPos | null>(null);
  const image = useImage(mapImage.image);
  const grid = state.battle.map;
  const layout = useMemo(() => (image ? imageLayout(image, grid.rotation, grid.imageScale) : null), [image, grid.rotation, grid.imageScale]);
  const gm = state.self.role === "gm";
  // Jogador desenha só setas (e apaga as dele com a borracha).
  const myDrawMode: DrawMode = gm || drawMode === "erase" ? drawMode : "arrow";
  const rulerMode = !placing && (tool === "ruler" || (tool === "move" && shiftHeld));
  // Próximo da fila que já chegou no estado e está fora do mapa (a resposta da ação pode vir antes do estado).
  const placingNext = placing
    ? placing.ids.map((id) => allCombatants(state).find((c) => c.id === id)).find((c) => c && !c.pos)
    : undefined;
  const placingLeft = placing ? placing.ids.filter((id) => allCombatants(state).some((c) => c.id === id && !c.pos)).length : 0;
  const placingFrom = placing ? allCombatants(state).find((c) => c.id === placing.fromId) : undefined;

  // Levar o grupo: Esc desiste (os aliados ficam onde estavam na cena).
  useEffect(() => {
    if (!gathering) return;
    const esc = (e: KeyboardEvent) => e.key === "Escape" && useApp.setState({ gathering: false });
    window.addEventListener("keydown", esc);
    return () => window.removeEventListener("keydown", esc);
  }, [gathering]);

  // Esc encerra a colocação: quem sobrou fica fora do mapa (dá para arrastar da lista depois).
  useEffect(() => {
    // Casa marcada de antes não confirma sozinha o primeiro toque (celular).
    setHoverCell(null);
    if (!placing) return;
    const esc = (e: KeyboardEvent) => e.key === "Escape" && setPlacing(null);
    window.addEventListener("keydown", esc);
    return () => window.removeEventListener("keydown", esc);
  }, [placing]);

  // Tamanho do palco acompanha o painel.
  useLayoutEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    // A tela do mapa começa embaixo da coluna da esquerda (--map-left, do Shell) e vai até a borda da direita:
    // mexer na coluna não move nem redimensiona o canvas, ela só cobre ou descobre um pedaço. `view` continua
    // contando a partir da área visível (é o que os painéis e sobreposições usam), então anda junto com a coluna.
    const leftOf = () => parseFloat(getComputedStyle(el).getPropertyValue("--map-left")) || 0;
    let left = leftOf();
    const ro = new ResizeObserver(([entry]) => {
      const now = leftOf();
      const moved = now - left;
      left = now;
      setMapLeft(now);
      setSize({ width: entry.contentRect.width, height: entry.contentRect.height });
      if (moved !== 0) setView((v) => ({ ...v, x: v.x - moved }));
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // Ctrl+Z (fora de campos de texto): nas ferramentas Paredes, Desenho e Tochas, desfaz o último dela; nas
  // outras, o último que esta pessoa fez no mapa.
  useEffect(() => {
    const scope: UndoScope | undefined = tool === "walls" ? "walls" : tool === "draw" ? "drawings" : tool === "torches" ? "torches" : tool === "chests" ? "chests" : tool === "paint" ? "paint" : tool === "props" ? "props" : tool === "terrain" ? "terrain" : tool === "relief" ? "relief" : tool === "floor" ? "floor" : undefined;
    const down = (e: KeyboardEvent) => {
      if (!(e.ctrlKey || e.metaKey) || e.key.toLowerCase() !== "z" || e.shiftKey) return;
      const el = e.target as HTMLElement | null;
      if (el && (el.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(el.tagName))) return;
      e.preventDefault();
      void undo(scope);
    };
    window.addEventListener("keydown", down);
    return () => window.removeEventListener("keydown", down);
  }, [tool]);

  // Objetos (mestre): Delete apaga o escolhido; Ctrl+C copia e Ctrl+V cola onde está o mouse.
  const lastPoint = useRef<Point | null>(null);
  const propClip = useRef<MapProp | null>(null);
  useEffect(() => {
    if (!gm || tool !== "props") return;
    const down = (e: KeyboardEvent) => {
      if (typingOrDialog(e)) return;
      const { state: s, selectedPropId } = useApp.getState();
      const picked = s?.battle.props.find((p) => p.id === selectedPropId);
      const key = e.key.toLowerCase();
      if ((key === "delete" || key === "backspace") && picked) {
        e.preventDefault();
        void removeProps([picked]);
        useApp.setState({ selectedPropId: null });
      } else if ((e.ctrlKey || e.metaKey) && key === "c" && picked) {
        propClip.current = picked;
      } else if ((e.ctrlKey || e.metaKey) && key === "v" && propClip.current && lastPoint.current && s) {
        e.preventDefault();
        const { id: _, ...copy } = propClip.current;
        const spot = propSpot(lastPoint.current.x, lastPoint.current.y, s.battle.map, false);
        void addProp({ ...copy, ...spot }).then((r) => r.ok && r.ids?.[0] && useApp.setState({ selectedPropId: r.ids[0] }));
      }
    };
    window.addEventListener("keydown", down);
    return () => window.removeEventListener("keydown", down);
  }, [gm, tool]);

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

  // Câmera segue a vez (L6, opção de cada um): a cada troca de turno, o mapa desliza até quem joga agora.
  const followTurn = useApp((s) => s.followTurn);
  const turn = state.battle.combat.turn;
  const activeTokenId = state.battle.combat.active ? currentGroup(state).find((c) => c.pos)?.id : undefined;
  // Desliza a câmera até o token (vez nova, clique na trilha de iniciativa); um deslize novo cancela o anterior.
  const glide = useRef<number>(0);
  function glideTo(c: CombatantView) {
    if (!c.pos) return;
    glideToPoint(shapeCenterAt(c.pos, c.size, grid));
  }
  /** Desliza a câmera até um ponto do mapa (em pixels do mundo), no zoom de agora. */
  function glideToPoint(target: Point) {
    cancelAnimationFrame(glide.current);
    const from = { ...viewRef.current };
    const to = { x: size.width / 2 - target.x * from.scale, y: size.height / 2 - target.y * from.scale };
    if (useApp.getState().reduceFx) return void setView({ ...from, ...to });
    const start = performance.now();
    const step = () => {
      const t = Math.min(1, (performance.now() - start) / 450);
      const e = 1 - (1 - t) * (1 - t);
      setView({ scale: from.scale, x: from.x + (to.x - from.x) * e, y: from.y + (to.y - from.y) * e });
      if (t < 1) glide.current = requestAnimationFrame(step);
    };
    glide.current = requestAnimationFrame(step);
  }
  useEffect(() => {
    if (!followTurn || !activeTokenId || !size.width) return;
    const c = allCombatants(state).find((o) => o.id === activeTokenId);
    if (c) glideTo(c);
    return () => cancelAnimationFrame(glide.current);
    // Só na troca de turno (e ao ligar a opção): não persegue o token enquanto ele anda.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [turn, followTurn, activeTokenId]);

  // "Olhem aqui" do mestre (Passo 7): o mapa desliza até o ping, no zoom de cada um.
  const lookAt = useApp((s) => s.lookAt);
  useEffect(() => {
    if (!lookAt || !size.width) return;
    glideToPoint({ x: grid.offsetX + lookAt.at.col * grid.cellPx, y: grid.offsetY + lookAt.at.row * grid.cellPx });
    // Só a cada pedido novo.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lookAt?.seq]);

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

  // Ping: ferramenta Ping (um toque e volta para Mover), Alt+clique ou botão do meio do mouse.
  // Segurar parado não pinga: brigava com arrastar a visão e os tokens.
  /** Acabou de pingar: o clique que vem junto não tira a seleção. */
  const pinged = useRef(false);
  function sendPing(p: Point, look = false) {
    pinged.current = true;
    socket.emit("map:ping", { col: (p.x - grid.offsetX) / grid.cellPx, row: (p.y - grid.offsetY) / grid.cellPx, ...(look && { look }) });
  }
  // Desenho do mestre: o traço fica só aqui enquanto o botão está apertado; ao soltar vai para todos.
  const strokeRef = useRef<number[] | null>(null);
  const [stroke, setStroke] = useState<number[] | null>(null);
  function finishStroke() {
    // O último trecho (entre o último movimento e o soltar) também entra.
    const end = worldPointer();
    const cur = strokeRef.current;
    const pts = cur && end ? (myDrawMode === "free" ? [...cur, end.x, end.y] : [cur[0], cur[1], end.x, end.y]) : cur;
    strokeRef.current = null;
    setStroke(null);
    if (!pts || myDrawMode === "erase") return;
    const long = myDrawMode === "free" ? pts.length >= 4 : Math.hypot(pts[2] - pts[0], pts[3] - pts[1]) > 4 / view.scale;
    if (long) void addDrawing({ kind: myDrawMode, points: pts, color: drawColor, width: drawWidth, ...(gm && drawHidden && { hidden: true }) });
  }

  // Borracha (M): apaga só por onde passa, como uma borracha de verdade. O caminho vai ao servidor em
  // pedaços enquanto arrasta (o apagado some na hora); nas paredes, a passada inteira vira um passo do Desfazer.
  const { torchStyle, torchErase } = useApp();
  const eraseMode = (tool === "draw" && drawMode === "erase") || (gm && tool === "walls" && wallMode === "erase") || (gm && tool === "torches" && torchErase);
  /** Raio da borracha (pixels do mapa): no desenho, pelo tamanho escolhido; nas paredes, um quarto de casa. */
  const eraserRadius = tool === "walls" || tool === "torches" ? grid.cellPx * WALL_ERASER : Math.max(4 / view.scale, grid.cellPx * (ERASER_CELLS[drawWidth] ?? 0.25));
  const eraserRef = useRef<{ kind: "draw" | "walls" | "torches"; pending: number[]; sent: boolean; timer: number | null; before: { id: string }[]; acts: Promise<unknown>[] } | null>(null);
  const [eraserAt, setEraserAt] = useState<Point | null>(null);
  // Trocar desenho das paredes: mesmo círculo da borracha; as paredes tocadas na passada mudam ao soltar.
  const restyleMode = gm && tool === "walls" && wallMode === "restyle";
  const restyleRef = useRef<Set<string> | null>(null);
  const [restyleIds, setRestyleIds] = useState<Set<string> | null>(null);
  function restyleAt(p: Point) {
    const set = restyleRef.current;
    if (!set) return;
    const r = grid.cellPx * WALL_ERASER;
    let grew = false;
    for (const w of state.battle.walls) {
      if (set.has(w.id)) continue;
      const a = { x: grid.offsetX + w.from.col * grid.cellPx, y: grid.offsetY + w.from.row * grid.cellPx };
      const b = { x: grid.offsetX + w.to.col * grid.cellPx, y: grid.offsetY + w.to.row * grid.cellPx };
      const len2 = (b.x - a.x) ** 2 + (b.y - a.y) ** 2 || 1;
      const k = Math.max(0, Math.min(1, ((p.x - a.x) * (b.x - a.x) + (p.y - a.y) * (b.y - a.y)) / len2));
      if (Math.hypot(p.x - (a.x + (b.x - a.x) * k), p.y - (a.y + (b.y - a.y) * k)) > r) continue;
      set.add(w.id);
      grew = true;
    }
    if (grew) setRestyleIds(new Set(set));
  }
  function finishRestyle() {
    const set = restyleRef.current;
    restyleRef.current = null;
    if (!set || set.size === 0) return setRestyleIds(null);
    // A prévia fica até o servidor responder (sem piscar o desenho antigo).
    void restyleWalls([...set], wallDrawStyle).then(() => setRestyleIds(null));
  }
  useEffect(() => {
    if (!eraseMode && !restyleMode) setEraserAt(null);
  }, [eraseMode, restyleMode]);
  function flushErase() {
    const e = eraserRef.current;
    if (!e) return;
    if (e.timer !== null) window.clearTimeout(e.timer);
    e.timer = null;
    const pts = e.pending;
    // Depois do primeiro envio, um ponto só é o fim do pedaço anterior: nada novo.
    if (pts.length < 2 || (e.sent && pts.length < 4)) return;
    e.sent = true;
    // O próximo pedaço começa onde este acabou (sem falha no caminho).
    e.pending = pts.slice(-2);
    if (e.kind === "draw") {
      const radius = Math.min(LIMITS.eraserRadius.max, Math.max(LIMITS.eraserRadius.min, eraserRadius));
      e.acts.push(act("draw:erase", { points: pts.map((n) => Math.round(n * 2) / 2), radius }));
    } else {
      const cells = pts.map((n, i) => Math.round(((n - (i % 2 ? grid.offsetY : grid.offsetX)) / grid.cellPx) * 100) / 100);
      e.acts.push(act(e.kind === "walls" ? "wall:erase" : "maptorch:erase", { points: cells, radius: WALL_ERASER }));
    }
  }
  function eraseTo(p: Point) {
    const e = eraserRef.current;
    if (!e) return;
    const n = e.pending.length;
    if (n >= 2 && Math.hypot(p.x - e.pending[n - 2], p.y - e.pending[n - 1]) < eraserRadius / 3) return;
    e.pending.push(p.x, p.y);
    if (e.pending.length >= LIMITS.eraserNumbers - 2) flushErase();
    else if (e.timer === null) e.timer = window.setTimeout(flushErase, 60);
  }
  function finishErase() {
    const e = eraserRef.current;
    if (!e) return;
    // O último trecho (entre o último movimento e o soltar) também apaga.
    const end = worldPointer();
    if (end) eraseTo(end);
    flushErase();
    eraserRef.current = null;
    // A passada inteira vira um passo do Desfazer: compara o antes e o depois.
    void Promise.all(e.acts).then(() => {
      const battle = useApp.getState().state?.battle;
      if (!battle) return;
      if (e.kind === "walls") recordWallErase(e.before as Wall[], battle.walls);
      else if (e.kind === "torches") recordTorchErase(e.before as MapTorch[], battle.torches);
      else recordDrawingErase(e.before as Drawing[], battle.drawings);
    });
  }

  // Parede sendo traçada pelo mestre: de canto a canto do grid (ou livre); ao soltar vai para todos.
  const wallRef = useRef<{ from: GridPos; to: GridPos } | null>(null);
  const [wallDraft, setWallDraft] = useState<{ from: GridPos; to: GridPos } | null>(null);
  function finishWall() {
    const w = wallRef.current;
    wallRef.current = null;
    setWallDraft(null);
    if (w && wallSpan(w.from, w.to) >= 0.1) void addWall(w.from, w.to, wallMode === "door" || wallMode === "window" ? wallMode : null, useApp.getState().wallThick, wallDrawStyle ?? undefined);
  }

  // Névoa sendo pintada pelo mestre: aparece na hora; ao soltar vai para o servidor.
  const fogRef = useRef<{ draft: FogDraft; start: GridPos; seen: Set<string> } | null>(null);
  const [fogDraft, setFogDraft] = useState<FogDraft | null>(null);
  function fogAt(cell: GridPos) {
    const f = fogRef.current;
    if (!f) return;
    const geometry = geometryOf(grid.grid);
    if (fogShape === "rect") {
      // Hex (Passo 16): os hexes com o centro entre os dois cantos; no quadrado, o retângulo de sempre.
      f.draft = { ...f.draft, rects: isHex(grid) && grid.grid ? cellsToRects(cellsWithCenterIn(geometry.center(f.start), geometry.center(cell), grid.grid)) : [rectBetween(f.start, cell)] };
    } else {
      const key = `${cell.col},${cell.row}`;
      if (f.seen.has(key)) return;
      f.seen.add(key);
      const brushed = isHex(grid) ? cellsToRects(brushCells(cell, fogBrush, grid.grid)) : [brushRect(cell, fogBrush)];
      f.draft = { ...f.draft, rects: [...f.draft.rects, ...brushed] };
    }
    setFogDraft(f.draft);
  }
  function finishFog() {
    const f = fogRef.current;
    fogRef.current = null;
    if (!f) return;
    // A prévia fica até o servidor responder (sem piscar a névoa de volta).
    void sendFog(f.draft).then(() => setFogDraft(null));
  }
  // Pincel de efeitos (mestre): as casas da pincelada aparecem na hora; ao soltar vão para o servidor.
  const paintRef = useRef<Set<string> | null>(null);
  const [paintDraft, setPaintDraft] = useState<GridPos[] | null>(null);
  const [paintHover, setPaintHover] = useState<GridPos | null>(null);
  function paintAt(cell: GridPos) {
    const seen = paintRef.current;
    if (!seen) return;
    let grew = false;
    // Quadrado: o retângulo do pincel; hex (Passo 16): os hexes em volta (1, 7 ou 19).
    for (const brushed of brushCells(cell, paintSize, grid.grid)) {
      const k = `${brushed.col},${brushed.row}`;
      if (seen.has(k) || seen.size * 2 >= LIMITS.paintNumbers) continue;
      seen.add(k);
      grew = true;
    }
    if (grew) setPaintDraft([...seen].map((k) => ({ col: Number(k.split(",")[0]), row: Number(k.split(",")[1]) })));
  }
  function finishPaint() {
    const seen = paintRef.current;
    paintRef.current = null;
    if (!seen || seen.size === 0) return;
    const cells = [...seen].flatMap((k) => k.split(",").map(Number));
    const sent = paintErase
      ? erasePaint(cells)
      : paintCells(paintPreset, paintColorOf(paintPreset, paintColor), cells, paintPreset === "custom");
    // A prévia fica até o servidor responder (sem piscar).
    void sent.then(() => setPaintDraft(null));
  }

  // Pincel de terreno (mestre): a passada é pintada numa cópia local na hora (a mesma conta do servidor) e vai
  // inteira ao soltar. O contorno do pincel anda sob o mouse sem redesenhar o mapa (mexe direto no Konva).
  const terrainRef = useRef<{ points: number[]; local: TerrainChunks } | null>(null);
  const [terrainPreview, setTerrainPreview] = useState<TerrainChunks | null>(null);
  const terrainCursor = useRef<Konva.Circle>(null);
  function terrainAt(p: Point) {
    const cursor = terrainCursor.current;
    if (cursor) {
      cursor.position(p);
      cursor.visible(true);
      cursor.getLayer()?.batchDraw();
    }
    const draft = terrainRef.current;
    if (!draft) return;
    const { terrain: brushTerrain, ...brushSize } = useApp.getState().terrainBrush;
    if (brushTerrain === "current" || brushTerrain === "currentErase") return;
    const brush = { ...brushSize, terrain: brushTerrain };
    const x = (p.x - grid.offsetX) / grid.cellPx;
    const y = (p.y - grid.offsetY) / grid.cellPx;
    const { points } = draft;
    // Ponto novo só depois de andar um pedaço do raio: a força da passada não depende da velocidade do mouse.
    if (points.length > 0 && Math.hypot(x - points[points.length - 2], y - points[points.length - 1]) < Math.max(0.15, brush.radius * 0.3)) return;
    points.push(x, y);
    paintTerrain(draft.local, { ...brush, points: [x, y] });
    setTerrainPreview({ ...draft.local });
  }
  function finishTerrain() {
    finishCurrent();
    const draft = terrainRef.current;
    terrainRef.current = null;
    const { terrain: brushTerrain, ...brushSize } = useApp.getState().terrainBrush;
    if (!draft || draft.points.length === 0 || brushTerrain === "current" || brushTerrain === "currentErase") return;
    // A prévia fica até o servidor responder (o terreno novo chega antes da resposta: sem piscar).
    void paintTerrainStroke({ ...brushSize, terrain: brushTerrain, points: draft.points }).then(() => setTerrainPreview(null));
  }

  // Pincel de relevo (mestre, docs/design/relevo.md): como o do terreno, a passada é pintada numa cópia local na hora
  // (a mesma conta do servidor; prévia em `reliefPreview`, no estado do app) e vai inteira ao soltar. O contorno do
  // pincel anda sob o mouse sem redesenhar o mapa.
  const reliefRef = useRef<{ points: number[]; local: ReliefChunks } | null>(null);
  const reliefCursor = useRef<Konva.Circle>(null);
  function reliefAt(p: Point) {
    const cursor = reliefCursor.current;
    if (cursor) {
      cursor.position(p);
      cursor.visible(true);
      cursor.getLayer()?.batchDraw();
    }
    const draft = reliefRef.current;
    if (!draft) return;
    const brush = useApp.getState().reliefBrush;
    const x = (p.x - grid.offsetX) / grid.cellPx;
    const y = (p.y - grid.offsetY) / grid.cellPx;
    const { points } = draft;
    if (points.length > 0 && Math.hypot(x - points[points.length - 2], y - points[points.length - 1]) < Math.max(0.15, brush.radius * 0.3)) return;
    points.push(x, y);
    paintRelief(draft.local, reliefStrokeOf(brush, [x, y]));
    useApp.setState({ reliefPreview: { ...draft.local } });
  }
  function finishRelief() {
    const draft = reliefRef.current;
    reliefRef.current = null;
    if (!draft || draft.points.length === 0) return;
    // A prévia fica até o servidor responder (o relevo novo chega antes da resposta: sem piscar).
    void paintReliefStroke(reliefStrokeOf(useApp.getState().reliefBrush, draft.points)).then(() => useApp.setState({ reliefPreview: null }));
  }

  // Piso (mestre, docs/design/pisos.md). Pincel e borracha: como o relevo, a passada vai numa cópia local na hora
  // (prévia em `floorPreview`) e inteira ao soltar. Retângulo: os cantos encaixam na casa (Shift: meia casa), contorno
  // enquanto arrasta. Cômodo: o contorno do lugar fechado sob o mouse e, no clique, a passada.
  const floorRef = useRef<{ points: number[]; local: FloorChunks } | null>(null);
  const floorCursor = useRef<Konva.Circle>(null);
  const [floorRect, setFloorRect] = useState<{ from: LightPoint; to: LightPoint } | null>(null);
  const [floorHover, setFloorHover] = useState<{ key: string; outlines: number[][] } | null>(null);
  const toCells = (p: Point): LightPoint => ({ x: (p.x - grid.offsetX) / grid.cellPx, y: (p.y - grid.offsetY) / grid.cellPx });
  const snapFloor = (at: LightPoint, half: boolean): LightPoint => (half ? { x: Math.round(at.x * 2) / 2, y: Math.round(at.y * 2) / 2 } : { x: Math.round(at.x), y: Math.round(at.y) });
  function floorBrushAt(p: Point) {
    const cursor = floorCursor.current;
    if (cursor) {
      cursor.position(p);
      cursor.visible(true);
      cursor.getLayer()?.batchDraw();
    }
    const draft = floorRef.current;
    if (!draft) return;
    const brush = useApp.getState().floorBrush;
    const { x, y } = toCells(p);
    const { points } = draft;
    if (points.length > 0 && Math.hypot(x - points[points.length - 2], y - points[points.length - 1]) < Math.max(0.1, brush.radius * 0.3)) return;
    points.push(x, y);
    paintFloor(draft.local, floorStrokeOf(brush, { kind: "brush", radius: brush.radius, points: [x, y] }), [], "stone");
    useApp.setState({ floorPreview: { ...draft.local } });
  }
  /** Contorno do lugar fechado sob o mouse (refeito só quando o mouse anda meia casa). */
  function floorHoverAt(p: Point) {
    const at = toCells(p);
    const key = `${Math.floor(at.x * 2)},${Math.floor(at.y * 2)}`;
    if (floorHover?.key === key) return;
    const room = floorRoomAt(state.battle.walls, at, state.battle.map.wallStyle ?? "stone");
    setFloorHover({ key, outlines: room ? [room.outer, ...room.holes] : [] });
  }
  function startFloor(p: Point) {
    const brush = useApp.getState().floorBrush;
    if (brush.mode === "room") {
      void paintFloorStroke(floorStrokeOf(brush, { kind: "room", at: toCells(p) }));
      return;
    }
    if (brush.mode === "rect") {
      const corner = snapFloor(toCells(p), shiftHeld);
      setFloorRect({ from: corner, to: corner });
      return;
    }
    floorRef.current = { points: [], local: { ...useApp.getState().floors } };
    floorBrushAt(p);
  }
  function moveFloor(p: Point) {
    const mode = useApp.getState().floorBrush.mode;
    if (mode === "room") return floorHoverAt(p);
    if (mode === "rect") {
      if (floorRect) setFloorRect({ from: floorRect.from, to: snapFloor(toCells(p), shiftHeld) });
      return;
    }
    floorBrushAt(p);
  }
  function finishFloor() {
    const brush = useApp.getState().floorBrush;
    if (floorRect) {
      const { from, to } = floorRect;
      setFloorRect(null);
      if (from.x !== to.x && from.y !== to.y) void paintFloorStroke(floorStrokeOf(brush, { kind: "rect", from, to }));
      return;
    }
    const draft = floorRef.current;
    floorRef.current = null;
    if (!draft || draft.points.length === 0) return;
    // A prévia fica até o servidor responder (o piso novo chega antes da resposta: sem piscar).
    void paintFloorStroke(floorStrokeOf(brush, { kind: "brush", radius: brush.radius, points: draft.points })).then(() => useApp.setState({ floorPreview: null }));
  }

  // Correnteza (água animada, mestre): risca a linha no sentido em que a água corre; ou, na borracha de correnteza,
  // apaga as linhas tocadas. As linhas aparecem só com a ferramenta Terreno aberta.
  const currentRef = useRef<{ points: number[] } | null>(null);
  const currentErasing = useRef(false);
  /** Linhas já apagadas nesta passada da borracha (o servidor ainda não respondeu: não apaga duas vezes). */
  const currentErased = useRef(new Set<string>());
  const [currentDraft, setCurrentDraft] = useState<number[] | null>(null);
  function currentAt(p: Point) {
    const x = (p.x - grid.offsetX) / grid.cellPx;
    const y = (p.y - grid.offsetY) / grid.cellPx;
    if (currentErasing.current) {
      const touched = currentsNear(useApp.getState().state?.battle.currents ?? [], x, y, CURRENT_ERASER).filter((current) => !currentErased.current.has(current.id));
      for (const current of touched) currentErased.current.add(current.id);
      if (touched.length > 0) void removeCurrents(touched);
      return;
    }
    const draft = currentRef.current;
    if (!draft) return;
    const { points } = draft;
    if (points.length > 0 && Math.hypot(x - points[points.length - 2], y - points[points.length - 1]) < CURRENT_STEP) return;
    points.push(x, y);
    setCurrentDraft([...points]);
  }
  function startCurrent(p: Point, erasing: boolean) {
    currentErasing.current = erasing;
    currentErased.current.clear();
    currentRef.current = erasing ? null : { points: [] };
    currentAt(p);
  }
  function finishCurrent() {
    const draft = currentRef.current;
    currentRef.current = null;
    currentErasing.current = false;
    setCurrentDraft(null);
    if (draft && draft.points.length >= 4) void addCurrent(simplifyCurrent(draft.points, LIMITS.currentNumbers));
  }

  // Pincel de espalhar (ou de apagar objetos): as casas da passada aparecem de leve; ao soltar, vai tudo junto.
  const propBrushRef = useRef<Set<string> | null>(null);
  const [propDraft, setPropDraft] = useState<GridPos[] | null>(null);
  function propBrushAt(cell: GridPos) {
    const seen = propBrushRef.current;
    if (!seen) return;
    let grew = false;
    for (const brushed of brushCells(cell, useApp.getState().scatterSize, grid.grid)) {
      const k = `${brushed.col},${brushed.row}`;
      if (seen.has(k) || seen.size >= 4000) continue;
      seen.add(k);
      grew = true;
    }
    if (grew) setPropDraft([...seen].map((k) => ({ col: Number(k.split(",")[0]), row: Number(k.split(",")[1]) })));
  }
  function finishPropBrush() {
    const seen = propBrushRef.current;
    propBrushRef.current = null;
    if (!seen || seen.size === 0) return;
    const { propMode, scatterSet, scatterDensity } = useApp.getState();
    const all = state.battle.props;
    let sent: Promise<unknown>;
    if (propMode === "erase") {
      // O objeto está no hex (ou quadrado) em que cai o ponto dele.
      const geometry = geometryOf(grid.grid);
      const hit = all.filter((p) => {
        const cell = geometry.cellAt({ x: p.col, y: p.row });
        return seen.has(`${cell.col},${cell.row}`);
      });
      sent = hit.length ? removeProps(hit) : Promise.resolve();
    } else {
      // Até o limite da cena; passou, avisa.
      const room = LIMITS.props - all.length;
      const items = scatter(scatterSet, seen, scatterDensity, all, Math.random, grid.grid).slice(0, Math.max(0, room));
      if (room <= 0) toast({ kind: "error", text: t("props.limit", { n: LIMITS.props }) });
      sent = items.length ? addProps(items) : Promise.resolve();
    }
    // A prévia fica até o servidor responder (sem piscar).
    void sent.then(() => setPropDraft(null));
  }

  /** "Revelar o mapa": todas as casas da imagem. */
  const revealMap =
    image && layout
      ? () => {
          if (isHex(grid) && grid.grid) {
            // Hex: os hexes com o centro na imagem, mais uma casa em volta (as bordas cortadas também aparecem).
            const start = toCellUnits({ x: 0, y: 0 }, grid);
            const end = toCellUnits({ x: layout.bounds.width, y: layout.bounds.height }, grid);
            const cells = cellsWithCenterIn({ x: start.x - 1, y: start.y - 1 }, { x: end.x + 1, y: end.y + 1 }, grid.grid);
            return void sendFog({ reveal: true, rects: cellsToRects(cells) });
          }
          const a = cellAt({ x: 0, y: 0 }, grid);
          const b = cellAt({ x: layout.bounds.width - 0.01, y: layout.bounds.height - 0.01 }, grid);
          void sendFog({ reveal: true, rects: [rectBetween(a, b)] });
        }
      : null;

  /** Clique numa parede ou porta: depende da ferramenta (abrir a porta, escolher, apagar). */
  function onWallClick(w: Wall) {
    // Janela: o mestre escolhe (Paredes › Janela) ou abre e fecha a persiana com um clique (Mover).
    if (w.window) {
      if (!gm) return;
      if (tool === "walls" && wallMode === "window") return useApp.setState({ selectedDoorId: w.id });
      if (tool === "move") void act("window:set", { id: w.id, closed: !w.window.closed });
      return;
    }
    if (!w.door) return;
    if (tool === "walls" && wallMode === "door") return useApp.setState({ selectedDoorId: w.id });
    if (tool === "move" && (gm || !w.door.locked)) void act("door:set", { id: w.id, open: !w.door.open });
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

  // Eventos de ponteiro: valem para mouse, dedo e caneta (E23).
  function onMouseDown(e: Konva.KonvaEventObject<PointerEvent>) {
    // Botão do meio = ping (sem abrir a rolagem automática do navegador).
    if (e.evt.button === 1) {
      e.evt.preventDefault();
      stageRef.current?.setPointersPositions(e.evt);
      const at = worldPointer();
      if (at) sendPing(at);
      return;
    }
    if (e.evt.button !== 0 || pinch.current) return;
    // Clique sem mover o mouse antes: garante que o Konva saiba onde está o ponteiro.
    stageRef.current?.setPointersPositions(e.evt);
    const p = worldPointer();
    // No celular não tem "passar o mouse": tocar no efeito mostra o nome por um instante.
    if (p && e.evt.pointerType === "touch") showEffectTip(state.battle.effects, grid, p, true);
    if (!p) return;
    if (gathering) {
      void act("allies:gather", { at: cellAt(p, grid) }).then((r) => r.ok && useApp.setState({ gathering: false }));
      return;
    }
    if (placing && placingNext) {
      const cell = cellAt(p, grid);
      // Dedo não tem "passar por cima": o primeiro toque mostra a casa (e a régua); tocar de novo nela confirma.
      if (e.evt.pointerType === "touch" && !sameCell(hoverCell, cell)) {
        setHoverCell(cell);
        return;
      }
      const rest = placing.ids.filter((id) => id !== placingNext.id);
      void act("token:move", { id: placingNext.id, pos: placeFor(placingNext, cell, allCombatants(state), grid.grid) }).then((r) => {
        if (r.ok) setPlacing(rest.length ? { ...placing, ids: rest } : null);
      });
      return;
    }
    // Todos já estão no mapa (ex.: arrastados da lista): a colocação acabou.
    if (placing) setPlacing(null);
    pinged.current = false;
    if (e.evt.altKey) return sendPing(p);
    if (tool === "ping") {
      // Só pela ferramenta (não no Alt+clique): o mestre escolhe levar a visão de todos.
      sendPing(p, gm && useApp.getState().pingLook);
      setTool("move");
      return;
    }
    if (eraseMode) {
      eraserRef.current = { kind: tool === "walls" || tool === "torches" ? tool : "draw", pending: [], sent: false, timer: null, before: tool === "walls" ? state.battle.walls : tool === "torches" ? state.battle.torches : state.battle.drawings, acts: [] };
      setEraserAt(p);
      eraseTo(p);
      return;
    }
    if (tool === "chests") {
      // Clicou num baú: abre o editor (no próprio baú). Na casa vazia, põe um e já abre o editor.
      if (e.target.name() === "map-chest") return;
      const cell = cellAt(p, grid);
      void addChest(cell.col, cell.row, useApp.getState().chestStyle).then((r) => r.ok && r.ids?.[0] && useApp.setState({ editingChestId: r.ids[0], newChestId: r.ids[0] }));
      return;
    }
    if (tool === "props" && gm && useApp.getState().propMode !== "place") {
      // Espalhar ou apagar com o pincel: junta as casas da passada; ao soltar, vai tudo de uma vez.
      propBrushRef.current = new Set();
      propBrushAt(cellAt(p, grid));
      return;
    }
    if (tool === "props" && gm) {
      // Clicou num objeto (ou nas alças dele): escolher, arrastar ou mudar tamanho e giro.
      if (e.target.name() === "map-prop" || e.target.findAncestor("Transformer")) return;
      // Com um escolhido, o clique no vazio só tira a escolha; senão, põe o objeto do catálogo (Shift: no centro da casa).
      if (useApp.getState().selectedPropId) return void useApp.setState({ selectedPropId: null });
      const spot = propSpot(p.x, p.y, grid, e.evt.shiftKey);
      void addProp({ kind: useApp.getState().propKind, ...spot, size: 1, rotation: 0 });
      return;
    }
    if (tool === "torches") {
      // Clicou numa tocha: é para arrastar, não para pôr outra em cima.
      if (e.target.name() === "map-torch") return;
      void addTorch((p.x - grid.offsetX) / grid.cellPx, (p.y - grid.offsetY) / grid.cellPx, torchStyle);
      return;
    }
    if (restyleMode) {
      restyleRef.current = new Set();
      restyleAt(p);
      return;
    }
    if (tool === "walls") {
      const c = wallPointAt(p, grid, wallSnap);
      wallRef.current = { from: c, to: c };
      setWallDraft(wallRef.current);
      return;
    }
    if (tool === "fog") {
      if (!state.battle.fog.enabled) return;
      const cell = cellAt(p, grid);
      // Cômodo: um clique revela (ou cobre) até as paredes; o servidor faz a conta.
      if (fogShape === "room") return void act("fog:room", { cell, reveal: fogReveal });
      fogRef.current = { draft: { reveal: fogReveal, rects: [] }, start: cell, seen: new Set() };
      fogAt(cell);
      return;
    }
    if (tool === "relief" && gm) {
      reliefRef.current = { points: [], local: { ...useApp.getState().relief } };
      reliefAt(p);
      return;
    }
    if (tool === "floor" && gm) {
      startFloor(p);
      return;
    }
    if (tool === "terrain" && gm) {
      const mode = useApp.getState().terrainBrush.terrain;
      if (mode === "current" || mode === "currentErase") return startCurrent(p, mode === "currentErase");
      terrainRef.current = { points: [], local: { ...useApp.getState().terrain } };
      terrainAt(p);
      return;
    }
    if (tool === "paint" && gm) {
      paintRef.current = new Set();
      paintAt(cellAt(p, grid));
      return;
    }
    if (tool === "draw") {
      strokeRef.current = myDrawMode === "free" ? [p.x, p.y] : [p.x, p.y, p.x, p.y];
      setStroke(strokeRef.current);
      return;
    }
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

  function onMouseMove(e?: Konva.KonvaEventObject<PointerEvent>) {
    if (pinch.current) return;
    const p = worldPointer();
    if (!p) return;
    lastPoint.current = p;
    // Nome do efeito sob o mouse (o mapa não fica com texto escrito); com o dedo, some sozinho.
    showEffectTip(state.battle.effects, grid, p, e?.evt.pointerType === "touch");
    if (eraseMode) {
      setEraserAt(p);
      eraseTo(p);
      return;
    }
    if (fogRef.current) {
      fogAt(cellAt(p, grid));
      return;
    }
    if (restyleMode) {
      setEraserAt(p);
      restyleAt(p);
      return;
    }
    if (tool === "terrain") {
      if (currentRef.current || currentErasing.current) currentAt(p);
      else terrainAt(p);
      return;
    }
    if (tool === "relief") {
      reliefAt(p);
      return;
    }
    if (tool === "floor") {
      moveFloor(p);
      return;
    }
    if (tool === "paint" || (tool === "props" && useApp.getState().propMode !== "place")) {
      const cell = cellAt(p, grid);
      setPaintHover((h) => (h && sameCell(h, cell) ? h : cell));
      if (tool === "paint") paintAt(cell);
      else propBrushAt(cell);
      return;
    }
    if (wallRef.current) {
      const to = wallPointAt(p, grid, wallSnap);
      if (!sameCell(to, wallRef.current.to)) {
        wallRef.current = { ...wallRef.current, to };
        setWallDraft(wallRef.current);
      }
      return;
    }
    if (strokeRef.current) {
      const s = strokeRef.current;
      if (myDrawMode !== "free") strokeRef.current = [s[0], s[1], p.x, p.y];
      // Ponto novo só depois de andar um pouco (na tela), para o traço não ficar pesado.
      else if (Math.hypot(p.x - s[s.length - 2], p.y - s[s.length - 1]) > 3 / view.scale && s.length < LIMITS.drawingNumbers - 2) strokeRef.current = [...s, p.x, p.y];
      else return;
      setStroke(strokeRef.current);
      return;
    }
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
    finishErase();
    finishStroke();
    finishWall();
    finishFog();
    finishPaint();
    finishTerrain();
    finishRelief();
    finishFloor();
    finishPropBrush();
    finishRestyle();
    calibStart.current = null;
    areaDragging.current = false;
    updateRuler(null);
  }

  // Dois dedos: aproxima/afasta em volta do meio deles e arrasta a visão junto (E23).
  // Ouvido direto no elemento (antes do Konva): com a visão sendo arrastada, o Konva engole o toque.
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const move = (e: TouchEvent) => {
      const t = e.touches;
      const stage = stageRef.current;
      if (t.length !== 2 || !stage) return;
      e.preventDefault();
      if (stage.isDragging()) stage.stopDrag();
      // Segundo dedo no meio de uma régua ou área: a medição para.
      if (!pinch.current) {
        updateRuler(null);
        areaDragging.current = false;
      }
      const box = el.getBoundingClientRect();
      const a = { x: t[0].clientX - box.left, y: t[0].clientY - box.top };
      const b = { x: t[1].clientX - box.left, y: t[1].clientY - box.top };
      const dist = Math.hypot(a.x - b.x, a.y - b.y);
      const center = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
      const last = pinch.current;
      pinch.current = { dist, center };
      if (!last || last.dist === 0) return;
      setView((v) => {
        const scale = Math.max(MIN_SCALE, Math.min(MAX_SCALE, (v.scale * dist) / last.dist));
        const world = { x: (last.center.x - v.x) / v.scale, y: (last.center.y - v.y) / v.scale };
        return { scale, x: center.x - world.x * scale, y: center.y - world.y * scale };
      });
    };
    const end = (e: TouchEvent) => {
      if (e.touches.length < 2) pinch.current = null;
    };
    el.addEventListener("touchmove", move, { capture: true, passive: false });
    el.addEventListener("touchend", end, { capture: true });
    el.addEventListener("touchcancel", end, { capture: true });
    return () => {
      el.removeEventListener("touchmove", move, { capture: true });
      el.removeEventListener("touchend", end, { capture: true });
      el.removeEventListener("touchcancel", end, { capture: true });
    };
  }, []);

  function onDrop(e: ReactDragEvent<HTMLDivElement>) {
    const id = e.dataTransfer.getData(DRAG_MIME);
    const torch = e.dataTransfer.getData(TORCH_DRAG_MIME);
    const stage = stageRef.current;
    if ((!id && !torch) || !stage) return;
    e.preventDefault();
    stage.setPointersPositions(e.nativeEvent);
    const p = stage.getRelativePointerPosition();
    if (!p) return;
    // Desenho de tocha arrastado do seletor: fica exatamente onde foi solto.
    if (torch) return void addTorch((p.x - grid.offsetX) / grid.cellPx, (p.y - grid.offsetY) / grid.cellPx, torch as MapTorchStyle);
    // Soltar da lista é "colocar": se a casa estiver ocupada, vai para a livre mais perto.
    const all = allCombatants(state);
    const c = all.find((o) => o.id === id);
    if (c) void act("token:move", { id, pos: placeFor(c, cellAt(p, grid), all, grid.grid) });
  }

  // Aliados por cima (desenhados por último).
  const tokens = [...state.battle.mobs, ...state.battle.npcs, ...state.allies].filter((c) => c.pos);
  const tokenKey = tokenSpots(tokens);
  // Luz (docs/design/luz.md): com o chão em WebGL, a luz da cena, as sombras e as tochas saem da placa de vídeo.
  const groundLit = WEBGL_GROUND && !groundFailed;
  const torchKey = tokens
    .filter((c) => c.torch)
    .map((c) => `${c.id}:${c.pos?.col},${c.pos?.row},${c.size}`)
    .join("|");
  // Só o arrasto de uma peça que dá luz (tocha ou token com tocha) muda a luz: arrastar outro token não redesenha o mapa.
  const lightIds = groundLit ? new Set([...state.battle.torches.map((torch) => torch.id), ...tokens.filter((c) => c.torch).map((c) => c.id)]) : null;
  const dragging = useTokenDrag((drag) => (drag.id !== null && lightIds?.has(drag.id) ? drag : NO_DRAG));
  const blockers = useMemo(() => lightBlockers(state.battle.walls), [state.battle.walls]);
  // Telhado invisível (docs/design/paredes.md): cômodos com as paredes que este jogador tem (o mestre, todas).
  const roofs = useMemo(
    () => ({
      rooms: wallRooms(state.battle.walls, state.battle.map.wallStyle),
      windows: state.battle.walls.filter((w) => w.window && !w.window.closed).map((w) => ({ x1: w.from.col, y1: w.from.row, x2: w.to.col, y2: w.to.row, seeThrough: false })),
    }),
    [state.battle.walls, state.battle.map.wallStyle],
  );
  const lighting = useMemo<LightingInput | null>(
    () =>
      groundLit
        ? {
            blockers,
            sources: lightSources(tokens, state.battle.torches, grid, dragging, blockers),
            ...roofs,
            scene: state.battle.weather.light,
            // O mestre nunca fica no breu (dá para trabalhar); quem vê como jogador (outra visão) vê o breu deles.
            floor: gm ? GM_FLOOR : null,
          }
        : null,
    // eslint-disable-next-line react-hooks/exhaustive-deps -- `torchKey` resume o que importa dos tokens
    [groundLit, blockers, roofs, state.battle.torches, torchKey, state.battle.weather.light, gm, dragging, grid],
  );
  // Chuva, neve e afins escurecem com a luz da cena (sem sombra de parede); o que brilha sozinho não muda.
  const sceneLight = SCENE_LIGHT[state.battle.weather.light];
  // Poeira das dunas (docs/design/relevo.md, etapa 3): com clima de vento, para o lado do vento do clima.
  const dustLevel = duneDustLevel(state.battle.weather);
  const dustDirection: 1 | -1 = state.battle.weather.wind < 0 ? -1 : 1;
  const dust = useMemo(() => ({ level: dustLevel, direction: dustDirection }), [dustLevel, dustDirection]);
  const weatherDim = Math.min(1, Math.max(0.3, (sceneLight.ambient[0] + sceneLight.ambient[1] + sceneLight.ambient[2] + sceneLight.sun[0] + sceneLight.sun[1] + sceneLight.sun[2]) / 3));
  const plateNumbers = repeatedNumbers(tokens);
  const wallStyle = state.battle.map.wallStyle ?? "stone";
  const doors = doorLayouts(state.battle.walls);
  // Paredes emendadas (docs/design/paredes.md): com a prévia de *Trocar desenho* já aplicada.
  const chainWalls = useMemo(
    () => (restyleIds ? state.battle.walls.map((w) => (restyleIds.has(w.id) ? { ...w, style: wallDrawStyle ?? wallStyle } : w)) : state.battle.walls),
    [state.battle.walls, restyleIds, wallDrawStyle, wallStyle],
  );
  // Grupo de mobs iguais: todos os tokens do grupo ficam marcados como na vez.
  const activeIds = new Set(currentGroup(state).map((c) => c.id));
  // Com a regra "movimento só na vez" ligada, o jogador só arrasta os seus na vez dele.
  const moveLocked = turnLocked(state, "moveOnTurn");
  const canMove = (c: CombatantView) => gm || (c.type === "ally" && c.ownerId === state.self.id && !moveLocked);
  // Por cima de todos: o token com o mouse em cima e, abaixo dele, o selecionado. Assim o nome
  // (que aparece em cima do token) nunca fica escondido atrás do vizinho (E26).
  const rank = (c: CombatantView) => (c.id === hoverId ? 2 : c.id === selectedId ? 1 : 0);
  tokens.sort((a, b) => rank(a) - rank(b));

  // Menu de contexto do token (L8): botão direito ou tocar e segurar.
  const closeMenu = useCallback(() => setMenu(null), []);

  // Atalhos do mapa e do token selecionado (L8; lista na ajuda, `?`). As letras não valem com o foco num campo
  // de texto nem com uma janela ou o menu do token abertos. O servidor confere as permissões de novo.
  // W, A, S, D andam com o mapa enquanto seguradas, em qualquer ferramenta: dá para ir traçando parede sem
  // voltar ao Mover. Velocidade em pixels da tela, então é a mesma em qualquer zoom.
  useEffect(() => {
    if (compact) return;
    const held = new Set<string>();
    let frame = 0;
    let last = 0;
    const step = (now: number) => {
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      const dx = (held.has("a") ? 1 : 0) - (held.has("d") ? 1 : 0);
      const dy = (held.has("w") ? 1 : 0) - (held.has("s") ? 1 : 0);
      // Na diagonal, a mesma velocidade.
      const k = (PAN_SPEED * dt) / (Math.hypot(dx, dy) || 1);
      if (dx || dy) setView((v) => ({ ...v, x: v.x + dx * k, y: v.y + dy * k }));
      frame = held.size > 0 ? requestAnimationFrame(step) : 0;
    };
    const down = (e: KeyboardEvent) => {
      const key = e.key.toLowerCase();
      if (!"wasd".includes(key) || key.length !== 1 || e.ctrlKey || e.metaKey || e.altKey || typingOrDialog(e)) return;
      e.preventDefault();
      held.add(key);
      if (!frame) {
        cancelAnimationFrame(glide.current);
        last = performance.now();
        frame = requestAnimationFrame(step);
      }
    };
    const up = (e: KeyboardEvent) => held.delete(e.key.toLowerCase());
    const blur = () => held.clear();
    window.addEventListener("keydown", down);
    window.addEventListener("keyup", up);
    window.addEventListener("blur", blur);
    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener("keydown", down);
      window.removeEventListener("keyup", up);
      window.removeEventListener("blur", blur);
    };
  }, [compact]);

  const keyCtx = useRef({ tool, selectedId, state, canMove, view, size, fit, zoomAt });
  keyCtx.current = { tool, selectedId, state, canMove, view, size, fit, zoomAt };
  useEffect(() => {
    if (compact || readOnly) return;
    const down = (e: KeyboardEvent) => {
      if (e.ctrlKey || e.metaKey || e.altKey || typingOrDialog(e)) return;
      const { tool, selectedId, state, canMove, view, size, fit, zoomAt } = keyCtx.current;
      const gm = state.self.role === "gm";
      const key = e.key.length === 1 ? e.key.toLowerCase() : e.key;
      const done = () => e.preventDefault();
      // Visão do mapa.
      if (key === "+" || key === "=") return done(), zoomAt({ x: size.width / 2, y: size.height / 2 }, 1.2);
      if (key === "-" || key === "_") return done(), zoomAt({ x: size.width / 2, y: size.height / 2 }, 1 / 1.2);
      if (key === "0") return done(), fit();
      // Ferramentas (repetir a tecla volta para Mover, como no botão).
      const tools: Record<string, MapTool> = { v: "move", r: "ruler", q: "area", p: "ping", b: "draw", ...(gm ? { g: "walls", l: "torches", j: "chests", o: "props", e: "paint", m: "terrain", n: "relief", k: "floor", f: "fog" } : {}) };
      if (tools[key] && !e.repeat) return done(), setTool(tool === tools[key] && key !== "v" ? "move" : tools[key]);
      if (key === "Escape") {
        if (tool !== "move") setTool("move");
        else select(null);
        return;
      }
      // Token selecionado.
      const c = selectedId ? allCombatants(state).find((o) => o.id === selectedId) : undefined;
      if (!c) return;
      const canEdit = gm || (c.type === "ally" && c.ownerId === state.self.id);
      const openMenu = (focus?: MenuFocus) => {
        const rect = containerRef.current?.getBoundingClientRect();
        if (!rect) return;
        const g = state.battle.map;
        // Ao lado do token: a borda direita, na altura de cima dele.
        const radius = (geometryOf(g.grid).drawSpan(c.size) * g.cellPx) / 2;
        const middle = c.pos ? shapeCenterAt(c.pos, c.size, g) : null;
        const world = middle
          ? { x: middle.x + radius, y: middle.y - radius }
          : { x: (size.width / 2 - view.x) / view.scale, y: (size.height / 2 - view.y) / view.scale };
        setMenu({ id: c.id, x: rect.left + view.x + world.x * view.scale, y: rect.top + view.y + world.y * view.scale, focus });
      };
      if (key === "Enter") return done(), openMenu();
      // O resto é de quem edita o token; segurar a tecla só repete o passo das setas.
      if (!canEdit || (e.repeat && !key.startsWith("Arrow"))) return;
      if (key === "x") return done(), openMenu("damage");
      if (key === "c") return done(), openMenu("heal");
      if (key === "k") return done(), openMenu("conditions");
      if (key === "t") return done(), void act("torch:set", { id: c.id, lit: !c.torch });
      if (key === "h" && gm && c.type !== "ally") return done(), void act("combatant:setHidden", { id: c.id, hidden: !c.hidden });
      if (key === "Delete" && (gm || c.type === "ally")) return done(), void removeCombatant(c);
      // Altura e direção (Passo 10): PgUp/PgDn sobe e desce 5 ft; vírgula e ponto giram 45°.
      if (c.pos && (key === "PageUp" || key === "PageDown")) return done(), void act("token:pose", { id: c.id, elevation: (c.elevation ?? 0) + (key === "PageUp" ? 5 : -5) });
      if (c.pos && (key === "," || key === ".")) return done(), void act("token:pose", { id: c.id, facing: (c.facing ?? 0) + (key === "." ? 45 : -45) });
      const step: Record<string, [number, number]> = { ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1] };
      if (step[key] && c.pos && canMove(c)) {
        done();
        const [dc, dr] = step[key];
        void act("token:move", { id: c.id, pos: { col: c.pos.col + dc, row: c.pos.row + dr } });
      }
    };
    window.addEventListener("keydown", down);
    return () => window.removeEventListener("keydown", down);
  }, [compact, readOnly]);

  // Trilha de iniciativa no topo (L7): só no combate e com alguém visível na ordem; os avisos do topo descem.
  const trackShown = state.battle.combat.active && state.battle.combat.order.some((id) => allCombatants(state).some((c) => c.id === id && !c.hidden));

  return (
    <div
      ref={containerRef}
      className={`battle-map tool-${rulerMode || placing || gathering ? "ruler" : tool}${trackShown ? " has-track" : ""}`}
      // Botão do meio é ping: sem a rolagem automática do navegador.
      onMouseDown={(e) => e.button === 1 && e.preventDefault()}
      onDragOver={(e) => {
        if (e.dataTransfer.types.includes(DRAG_MIME) || e.dataTransfer.types.includes(TORCH_DRAG_MIME)) e.preventDefault();
      }}
      onDrop={onDrop}
    >
      {size.width > 0 && (
        <Stage
          ref={stageRef}
          style={{ position: "absolute", top: 0, left: "calc(var(--map-left, 0px) * -1)" }}
          width={stageSize.width}
          height={stageSize.height}
          x={stageX}
          y={view.y}
          scaleX={view.scale}
          scaleY={view.scale}
          draggable={tool === "move" && !shiftHeld && !placing}
          onDragMove={(e) => {
            if (e.target === e.target.getStage()) setView((v) => ({ ...v, x: e.target.x() - mapLeft, y: e.target.y() }));
          }}
          onWheel={(e) => {
            e.evt.preventDefault();
            const pointer = e.target.getStage()?.getPointerPosition();
            if (pointer) zoomAt({ x: pointer.x - mapLeft, y: pointer.y }, e.evt.deltaY < 0 ? 1.12 : 1 / 1.12);
          }}
          onPointerDown={readOnly ? undefined : onMouseDown}
          onPointerMove={onMouseMove}
          onPointerUp={onMouseUp}
          onPointerLeave={() => {
            onMouseUp();
            hideEffectTip();
          }}
          onClick={(e) => {
            if (e.target === e.target.getStage() && tool === "move" && !placing && !pinged.current) select(null);
          }}
          onTap={(e) => {
            if (e.target === e.target.getStage() && tool === "move" && !placing && !pinged.current) select(null);
          }}
        >
          <Layer listening={false}>
            <MemoTable style={state.battle.map.tableStyle ?? "wood"} grid={grid} view={stageView} size={stageSize} bounds={layout?.bounds ?? null} />
            {image && layout && (
              <KImage image={image} x={layout.x} y={layout.y} width={layout.w} height={layout.h} rotation={grid.rotation} />
            )}
            {/* Terreno pintado, desenhado no processador: só sem WebGL 2 (ou com o chão em WebGL falhando). */}
            {(!WEBGL_GROUND || groundFailed) && (
              <TerrainLayer chunks={terrainPreview ?? terrain} grid={grid} pixelsPerCell={smallScreen ? 16 : 32} epoch={terrainEpoch} draft={terrainPreview !== null} />
            )}
            {/* Pisos no processador (cor chapada): só sem WebGL 2. */}
            {(!WEBGL_GROUND || groundFailed) && <FloorLayer chunks={floorPreview ?? floors} grid={grid} />}
          </Layer>

          {/* O chão (docs/design/renderizador-chao.md): terreno e água animada em WebGL, numa camada própria. */}
          {WEBGL_GROUND && (
            <GroundLayer
              chunks={terrainPreview ?? terrain}
              committed={terrain}
              draft={terrainPreview !== null}
              epoch={terrainEpoch}
              currents={state.battle.currents}
              props={state.battle.props}
              grid={grid}
              view={stageView}
              size={stageSize}
              lighting={lighting}
              relief={reliefPreview ?? relief}
              reliefEpoch={reliefEpoch}
              smallScreen={smallScreen}
              walls={chainWalls}
              sceneStyle={wallStyle}
              gm={gm}
              dust={dust}
              floors={floorPreview ?? floors}
            />
          )}

          {/* Borda e grid: por cima do terreno e da água. */}
          <Layer listening={false}>
            {layout && !reduceFx && <MemoEdge bounds={layout.bounds} grid={grid} />}
            {grid.showGrid && <MemoGrid grid={grid} view={stageView} size={stageSize} onImage />}
          </Layer>

          {/* Efeitos no mapa: acima da imagem e do grid, abaixo dos tokens (E19). */}
          <Layer listening={false}>
            {state.battle.effects.map((e) => (
              <EffectShape key={e.id} effect={e} grid={grid} scale={view.scale} />
            ))}
          </Layer>

          {/* Pincel de espalhar objetos: a área da passada (de leve) e o quadrado do pincel. */}
          {gm && tool === "props" && useApp.getState().propMode !== "place" && (
            <Layer listening={false}>
              {propDraft && isHex(grid) && (
                <CellMarks cells={propDraft} grid={grid} fill={useApp.getState().propMode === "erase" ? "#000000" : "#d8b47a"} opacity={useApp.getState().propMode === "erase" ? 0.3 : 0.16} />
              )}
              {!isHex(grid) && propDraft?.map((c) => (
                <Rect
                  key={`${c.col},${c.row}`}
                  x={grid.offsetX + c.col * grid.cellPx}
                  y={grid.offsetY + c.row * grid.cellPx}
                  width={grid.cellPx}
                  height={grid.cellPx}
                  fill={useApp.getState().propMode === "erase" ? "#000000" : "#d8b47a"}
                  opacity={useApp.getState().propMode === "erase" ? 0.3 : 0.16}
                />
              ))}
              {paintHover && isHex(grid) && (
                <CellMarks
                  cells={brushCells(paintHover, useApp.getState().scatterSize, grid.grid)}
                  grid={grid}
                  stroke={useApp.getState().propMode === "erase" ? "#e05a5a" : "#d8b47a"}
                  strokeWidth={1.5 / view.scale}
                  dash={[6 / view.scale, 4 / view.scale]}
                />
              )}
              {paintHover &&
                !isHex(grid) &&
                (() => {
                  const r = brushRect(paintHover, useApp.getState().scatterSize);
                  return (
                    <Rect
                      x={grid.offsetX + r.col * grid.cellPx}
                      y={grid.offsetY + r.row * grid.cellPx}
                      width={r.w * grid.cellPx}
                      height={r.h * grid.cellPx}
                      stroke={useApp.getState().propMode === "erase" ? "#e05a5a" : "#d8b47a"}
                      strokeWidth={1.5 / view.scale}
                      dash={[6 / view.scale, 4 / view.scale]}
                    />
                  );
                })()}
            </Layer>
          )}

          {/* Correnteza da água: as linhas (e a que está sendo riscada), só para o mestre com o Terreno aberto. */}
          {gm && tool === "terrain" && <CurrentLines currents={state.battle.currents} draft={currentDraft} grid={grid} scale={view.scale} />}

          {/* Pincel de terreno: o contorno do pincel sob o mouse (posto direto no Konva, em terrainAt). */}
          {gm && tool === "terrain" && terrainBrush.terrain !== "current" && terrainBrush.terrain !== "currentErase" && (
            <Layer listening={false}>
              <Circle
                ref={terrainCursor}
                visible={false}
                radius={terrainBrush.radius * grid.cellPx}
                stroke={terrainBrush.terrain === "erase" ? "#e05a5a" : "#d8b47a"}
                strokeWidth={1.5 / view.scale}
                dash={[6 / view.scale, 4 / view.scale]}
              />
            </Layer>
          )}

          {/* Piso: o contorno do pincel sob o mouse, o retângulo enquanto arrasta e o lugar fechado sob o mouse. */}
          {gm && tool === "floor" && (
            <Layer listening={false}>
              {(floorBrush.mode === "brush" || floorBrush.mode === "erase") && (
                <Circle ref={floorCursor} visible={false} radius={floorBrush.radius * grid.cellPx} stroke="#b9a27a" strokeWidth={1.5 / view.scale} dash={[6 / view.scale, 4 / view.scale]} />
              )}
              {floorBrush.mode === "rect" && floorRect && (
                <Rect
                  x={grid.offsetX + Math.min(floorRect.from.x, floorRect.to.x) * grid.cellPx}
                  y={grid.offsetY + Math.min(floorRect.from.y, floorRect.to.y) * grid.cellPx}
                  width={Math.abs(floorRect.to.x - floorRect.from.x) * grid.cellPx}
                  height={Math.abs(floorRect.to.y - floorRect.from.y) * grid.cellPx}
                  stroke="#b9a27a"
                  strokeWidth={2 / view.scale}
                  dash={[6 / view.scale, 4 / view.scale]}
                />
              )}
              {floorBrush.mode === "room" &&
                floorHover?.outlines.map((outline, index) => (
                  <Line
                    key={index}
                    points={outline.map((value, at) => (at % 2 === 0 ? grid.offsetX + value * grid.cellPx : grid.offsetY + value * grid.cellPx))}
                    closed
                    stroke={index === 0 ? "#b9a27a" : "#8a7a5c"}
                    strokeWidth={2 / view.scale}
                    dash={[6 / view.scale, 4 / view.scale]}
                  />
                ))}
            </Layer>
          )}

          {/* Pincel de relevo: o contorno do pincel sob o mouse (posto direto no Konva, em reliefAt). */}
          {gm && tool === "relief" && (
            <Layer listening={false}>
              <Circle ref={reliefCursor} visible={false} radius={reliefBrush.radius * grid.cellPx} stroke="#b9a27a" strokeWidth={1.5 / view.scale} dash={[6 / view.scale, 4 / view.scale]} />
            </Layer>
          )}

          {/* Pincel de efeitos: a pincelada antes de ir ao servidor e o quadrado do pincel sob o mouse. */}
          {gm && tool === "paint" && (
            <Layer listening={false}>
              {paintDraft && isHex(grid) && (
                <CellMarks cells={paintDraft} grid={grid} fill={paintErase ? "#000000" : paintColorOf(paintPreset, paintColor)} opacity={paintErase ? 0.35 : 0.45} />
              )}
              {!isHex(grid) && paintDraft?.map((c) => (
                <Rect
                  key={`${c.col},${c.row}`}
                  x={grid.offsetX + c.col * grid.cellPx}
                  y={grid.offsetY + c.row * grid.cellPx}
                  width={grid.cellPx}
                  height={grid.cellPx}
                  fill={paintErase ? "#000000" : paintColorOf(paintPreset, paintColor)}
                  opacity={paintErase ? 0.35 : 0.45}
                />
              ))}
              {paintHover && isHex(grid) && (
                <CellMarks
                  cells={brushCells(paintHover, paintSize, grid.grid)}
                  grid={grid}
                  stroke={paintErase ? "#e05a5a" : "#d8b47a"}
                  strokeWidth={1.5 / view.scale}
                  dash={[6 / view.scale, 4 / view.scale]}
                />
              )}
              {paintHover &&
                !isHex(grid) &&
                (() => {
                  const r = brushRect(paintHover, paintSize);
                  return (
                    <Rect
                      x={grid.offsetX + r.col * grid.cellPx}
                      y={grid.offsetY + r.row * grid.cellPx}
                      width={r.w * grid.cellPx}
                      height={r.h * grid.cellPx}
                      stroke={paintErase ? "#e05a5a" : "#d8b47a"}
                      strokeWidth={1.5 / view.scale}
                      dash={[6 / view.scale, 4 / view.scale]}
                    />
                  );
                })()}
            </Layer>
          )}

          {/* Desenhos (do mestre e setas dos jogadores): acima dos efeitos, abaixo dos tokens. */}
          <Layer listening={false}>
            {state.battle.drawings.map((d) => (
              <DrawingShape key={d.id} d={d} />
            ))}
            {stroke && myDrawMode !== "erase" && <DrawingShape d={{ kind: myDrawMode, points: stroke, color: drawColor, width: drawWidth, hidden: gm && drawHidden }} />}
          </Layer>

          {/* Paredes e portas: acima dos desenhos. Porta abre com um clique (Mover); a ferramenta Paredes escolhe ou apaga.
              Com o chão em WebGL, paredes, portas e janelas vêm da placa de vídeo (docs/design/relevo.md, etapa 2). */}
          <Layer listening={tool === "move" || (gm && tool === "walls")}>
            {groundLit ? <GroundWallsImage view={stageView} size={stageSize} /> : <WallChains walls={chainWalls} grid={grid} sceneStyle={wallStyle} />}
            {state.battle.walls.map((w) => (
              <WallShape
                key={w.id}
                w={w}
                grid={grid}
                gm={gm}
                style={restyleIds?.has(w.id) ? (wallDrawStyle ?? wallStyle) : (w.style ?? wallStyle)}
                layout={doors.get(w.id)}
                selected={w.id === selectedDoorId}
                gpu={groundLit}
                onClick={() => onWallClick(w)}
              />
            ))}
            {wallDraft && wallSpan(wallDraft.from, wallDraft.to) >= 0.1 && <WallPreview from={wallDraft.from} to={wallDraft.to} opening={wallMode === "door" || wallMode === "window" ? wallMode : null} grid={grid} style={wallDrawStyle ?? wallStyle} />}
          </Layer>

          {/* Objetos do cenário que ficam no chão (abaixo dos tokens): a luz das tochas e a névoa passam por cima. */}
          <MapPropLayer props={state.battle.props} grid={grid} scale={view.scale} layer="below" editing={gm && tool === "props"} selectedId={selectedPropId} tokens={tokens} tokenKey={tokenKey} weather={state.battle.weather} />

          {/* Tochas: brilho quente em volta de quem tem tocha acesa. Abaixo da névoa: a luz só aparece
              onde se vê (não "vaza" pela parede para dentro de um cômodo coberto). */}
          {groundLit ? (
            <GroundOutputLayer which="flame" view={stageView} size={stageSize} />
          ) : (
            <TorchGlowLayer tokens={tokens} torches={state.battle.torches} grid={grid} light={state.battle.weather.light} />
          )}
          <MapTorchLayer torches={state.battle.torches} grid={grid} editing={gm && tool === "torches" && !torchErase} fire={!groundLit} />
          <MapChestLayer chests={state.battle.chests} grid={grid} editing={gm && tool === "chests"} clickable={tool === "move" && !placing && !gathering} />

          {/* Névoa de guerra (G): cobre mapa, efeitos, desenhos, paredes e brilho das tochas; os tokens ficam por cima. */}
          <FogLayer fog={state.battle.fog} sight={state.battle.sight} grid={grid} gm={gm} draft={fogDraft} />

          {/* Alcance e aura: abaixo dos tokens. */}
          <Layer listening={false}>
            {tokens.map((c) => (
              <AuraShape key={c.id} c={c} grid={grid} />
            ))}
          </Layer>

          <Layer>
            {tokens.map((c) => (
              <Token
                key={c.id}
                c={c}
                grid={grid}
                selected={c.id === selectedId}
                active={activeIds.has(c.id)}
                plateNumber={plateNumbers.get(c.id)}
                turnKey={state.battle.combat.turn}
                draggable={canMove(c) && tool === "move" && !shiftHeld && !placing && !(state.pause && !gm) && !readOnly}
                onSelect={() => select(c.id)}
                onOpen={() => openSheet(c.id)}
                onMenu={readOnly ? undefined : (x, y) => {
                  select(c.id);
                  setMenu({ id: c.id, x, y });
                }}
                onMove={async (pos) => (await act("token:move", { id: c.id, pos })).ok}
              />
            ))}
          </Layer>

          {/* Copas e o que fica por cima dos tokens (o token passa por baixo; com alguém embaixo, fica meio transparente). */}
          <MapPropLayer props={state.battle.props} grid={grid} scale={view.scale} layer="above" editing={gm && tool === "props"} selectedId={selectedPropId} tokens={tokens} tokenKey={tokenKey} weather={state.battle.weather} />

          {/* Luz da cena, sombras e tochas (docs/design/luz.md): multiplica tudo o que está embaixo; a interface do mapa
              (áreas, régua, pings) fica por cima, legível à noite. */}
          {groundLit && <GroundOutputLayer which="light" view={stageView} size={stageSize} />}

          <Layer listening={false}>
            {Object.entries(areas).map(([pid, a]) => (
              <AreaShape key={pid} area={a.area} grid={grid} scale={view.scale} label={a.name} color="#5ba3e6" />
            ))}
            {myArea && <AreaShape area={myArea} grid={grid} scale={view.scale} color="#d8b47a" />}
          </Layer>

          <Layer listening={false}>
            {pings.map((p) => (
              <PingShape key={p.id} at={p.at} name={p.name} color={p.playerId === state.self.id ? "#d8b47a" : "#5ba3e6"} grid={grid} scale={view.scale} />
            ))}
          </Layer>

          <Layer listening={false}>
            {Object.entries(rulers).map(([pid, r]) => (
              <RulerShape key={pid} ruler={r.ruler} grid={grid} scale={view.scale} label={r.name} color="#5ba3e6" />
            ))}
            {myRuler && <RulerShape ruler={myRuler} grid={grid} scale={view.scale} color="#d8b47a" />}
            {(eraseMode || restyleMode) && eraserAt && (
              <Circle
                x={eraserAt.x}
                y={eraserAt.y}
                radius={eraserRadius}
                stroke="#f1e6d0"
                strokeWidth={1.5 / view.scale}
                dash={[4 / view.scale, 3 / view.scale]}
                fill="rgba(241, 230, 208, 0.1)"
              />
            )}
            {placing && hoverCell && (
              // Distância até quem conjurou; sem ele no mapa, só a casa.
              // Mede da borda de quem conjurou (criatura grande ocupa várias casas).
              <RulerShape
                ruler={{ from: placingFrom?.pos ? geometryOf(grid.grid).nearestCellOf(placingFrom.pos, placingFrom.size, hoverCell) : hoverCell, to: hoverCell }}
                grid={grid}
                scale={view.scale}
                label={placingNext?.name}
                color="#d8b47a"
                cellOnly={!placingFrom?.pos}
              />
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
          <EffectTipLayer effects={state.battle.effects} view={view} width={size.width} casterName={(id) => allCombatants(state).find((c) => c.id === id)?.name} />
        </Stage>
      )}

      {/* Vinheta: bordas da área do mapa escurecidas (luz de cena no centro); some com "Reduzir efeitos". */}
      {!reduceFx && <div className="map-vignette" />}
      {/* Clima e luz (E26): por cima do mapa e dos tokens, abaixo da barra e dos avisos. */}
      <WeatherOverlay weather={state.battle.weather} lights={groundLit ? [] : screenLights(tokens, state.battle.torches, grid, view)} film={!groundLit} dim={groundLit ? weatherDim : 1} />
      {/* Onde o grupo perdeu inimigos de vista ("?" vermelho): por cima da luz do clima, legível à noite. */}
      {state.battle.fog.enabled && state.battle.fog.vision && <LastSeenOverlay marks={state.battle.fog.lastSeen} grid={grid} view={view} gm={gm} />}

      {menu && <TokenMenu key={`${menu.id}-${menu.focus ?? ""}-${menu.x}`} state={state} id={menu.id} x={menu.x} y={menu.y} focus={menu.focus} onClose={closeMenu} />}
      {trackShown && <InitiativeTrack state={state} width={size.width} onFocus={glideTo} />}
      {readOnly && <ViewAsBanner onFit={fit} />}
      {!readOnly && <MapToolbar
        tool={tool}
        gm={gm}
        compact={compact}
        narrow={size.width < 780}
        onZoom={(f) => zoomAt({ x: size.width / 2, y: size.height / 2 }, f)}
        onFit={fit}
        paused={!!state.pause}
      />}
      <PauseOverlay pause={state.pause} gm={gm} />
      {gm && tool === "ping" && <PingOptions />}

      {!image && tokens.length === 0 && (
        <Paper className="map-hint" px="md" py="sm" shadow="md">
          <MText size="sm" c="dimmed" ta="center">
            {gm
              ? t("map.emptyGm")
              : compact
                ? t("map.waitingMobile")
                : t("map.waiting")}
          </MText>
        </Paper>
      )}
      {!gm && (image || tokens.length > 0) && <DarkReminder state={state} />}
      {gathering && (
        <Paper className="map-hint top" px="md" py="sm" shadow="md">
          <MText size="sm" c="bronze.4" ta="center">
            {t(compact ? "gather.tap" : "gather.click")} {!compact && t("gather.esc")}
          </MText>
          <MGroup justify="center" mt={6}>
            <Button size="compact-sm" variant="default" onClick={() => useApp.setState({ gathering: false })}>
              {t("place.cancel")}
            </Button>
          </MGroup>
        </Paper>
      )}
      {placing && placingNext && (
        <Paper className="map-hint top" px="md" py="sm" shadow="md">
          <MText size="sm" c="bronze.4" ta="center">
            {t(compact ? "place.tap" : "place.click", { name: placingNext.name })}
            {placingLeft > 1 && ` ${t("place.left", { n: placingLeft })}`}
            {placingFrom?.pos ? ` ${t("place.ruler", { name: placingFrom.name })}` : ""} {!compact && t("place.esc")}
          </MText>
          {compact && (
            <MGroup justify="center" mt={6}>
              <Button size="compact-sm" variant="default" onClick={() => setPlacing(null)}>
                {t("place.cancel")}
              </Button>
            </MGroup>
          )}
        </Paper>
      )}
      {tool === "area" && <AreaOptions canFix={!!myArea} locked={turnLocked(state, "effectOnTurn")} onFix={() => setFixing(true)} />}
      {tool === "draw" && <DrawOptions drawings={state.battle.drawings} gm={gm} selfId={state.self.id} />}
      {gm && <ChestEditor chests={state.battle.chests} />}
      <LootWindow state={state} />
      {gm && tool === "fog" && <FogOptions fog={state.battle.fog} onRevealMap={revealMap} />}
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
            {t(isHex(grid) ? CALIBRATE_HINT[grid.grid ?? "square"] : "map.calibrateHint")}
          </MText>
        </Paper>
      )}
    </div>
  );
}

/**
 * A mesa em volta do mapa (L5): o ladrilho do estilo da cena cobre a parte visível (acompanha o zoom: o
 * tamanho é em casas) e, com imagem, o mapa ganha uma sombra projetada, como papel pousado na mesa.
 */
function TableShape({ style, grid, view, size, bounds }: { style: TableStyle; grid: MapConfig; view: View; size: { width: number; height: number }; bounds: { width: number; height: number } | null }) {
  return (
    <Shape
      sceneFunc={(kctx) => {
        const ctx = kctx._context;
        const x0 = -view.x / view.scale;
        const y0 = -view.y / view.scale;
        const w = size.width / view.scale;
        const h = size.height / view.scale;
        const tile = tableTile(style);
        const pattern = ctx.createPattern(tile, "repeat");
        if (pattern) {
          const k = (TILE_CELLS[style] * grid.cellPx) / tile.width;
          pattern.setTransform(new DOMMatrix().translate(grid.offsetX, grid.offsetY).scale(k));
          ctx.fillStyle = pattern;
          ctx.fillRect(x0, y0, w, h);
        }
        if (bounds && style === "leather") {
          // Tapete de mestre: costura em volta do mapa.
          const m = grid.cellPx * 0.3;
          ctx.save();
          ctx.setLineDash([grid.cellPx * 0.18, grid.cellPx * 0.12]);
          ctx.lineCap = "round";
          ctx.lineWidth = grid.cellPx * 0.045;
          ctx.strokeStyle = "rgba(0,0,0,.6)";
          ctx.strokeRect(-m, -m + ctx.lineWidth, bounds.width + m * 2, bounds.height + m * 2);
          ctx.strokeStyle = "rgba(226,200,150,.75)";
          ctx.strokeRect(-m, -m, bounds.width + m * 2, bounds.height + m * 2);
          ctx.restore();
        }
        if (bounds) {
          ctx.save();
          ctx.shadowColor = "rgba(0,0,0,.75)";
          ctx.shadowBlur = grid.cellPx * 0.6;
          ctx.shadowOffsetY = grid.cellPx * 0.2;
          ctx.fillStyle = "#000";
          ctx.fillRect(0, 0, bounds.width, bounds.height);
          ctx.restore();
        }
      }}
    />
  );
}

/** Borda do mapa escurecida por dentro (o papel pousado na mesa); some com "Reduzir efeitos". */
function MapEdgeShape({ bounds, grid }: { bounds: { width: number; height: number }; grid: MapConfig }) {
  return (
    <Shape
      sceneFunc={(kctx) => {
        const ctx = kctx._context;
        const { width: W, height: H } = bounds;
        const e = Math.min(grid.cellPx * 0.6, W / 4, H / 4);
        const side = (x: number, y: number, w: number, h: number, gx0: number, gy0: number, gx1: number, gy1: number) => {
          const g = ctx.createLinearGradient(gx0, gy0, gx1, gy1);
          g.addColorStop(0, "rgba(10,6,2,.45)");
          g.addColorStop(1, "rgba(10,6,2,0)");
          ctx.fillStyle = g;
          ctx.fillRect(x, y, w, h);
        };
        side(0, 0, W, e, 0, 0, 0, e);
        side(0, H - e, W, e, 0, H, 0, H - e);
        side(0, 0, e, H, 0, 0, e, 0);
        side(W - e, 0, e, H, W, 0, W - e, 0);
      }}
    />
  );
}

/**
 * Hexes de uma pincelada (Passo 16): a prévia da passada (preenchida) ou o pincel sob o mouse (contorno).
 * No quadrado, o mapa continua desenhando retângulos.
 */
function CellMarks({
  cells,
  grid,
  ...style
}: {
  cells: GridPos[];
  grid: MapConfig;
  fill?: string;
  opacity?: number;
  stroke?: string;
  strokeWidth?: number;
  dash?: number[];
}) {
  return (
    <Shape
      listening={false}
      {...style}
      sceneFunc={(kctx, shape) => {
        const geometry = geometryOf(grid.grid);
        kctx.beginPath();
        for (const cell of cells) {
          const corners = geometry.polygon(cell).map((corner) => toWorld(corner, grid));
          kctx.moveTo(corners[0].x, corners[0].y);
          for (const corner of corners.slice(1)) kctx.lineTo(corner.x, corner.y);
          kctx.closePath();
        }
        kctx.fillStrokeShape(shape);
      }}
    />
  );
}

/** Hexes desenhados por quadro, no máximo (Passo 16); acima disso o grid hex não aparece. */
const HEX_GRID_MAX_CELLS = 12_000;

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
        if (isHex(grid)) {
          // Hex (Passo 16): o contorno de cada hex visível (uma casa de folga nas bordas).
          const geometry = geometryOf(grid.grid);
          const first = cellAt({ x: x0, y: y0 }, grid);
          const last = cellAt({ x: x1, y: y1 }, grid);
          // Desenha hex a hex: com o mapa muito afastado seriam centenas de milhares por quadro (trava o arraste).
          // Como no quadrado, a partir de um tanto o grid some (as casas já nem dão para ver).
          if ((last.col - first.col + 3) * (last.row - first.row + 3) > HEX_GRID_MAX_CELLS) return;
          // Os cantos do hex são os mesmos em volta de qualquer centro: calculados uma vez.
          const origin = geometry.center({ col: 0, row: 0 });
          const around = geometry.polygon({ col: 0, row: 0 }).map((corner) => ({ x: (corner.x - origin.x) * cellPx, y: (corner.y - origin.y) * cellPx }));
          for (let row = first.row - 1; row <= last.row + 1; row++) {
            for (let col = first.col - 1; col <= last.col + 1; col++) {
              const center = cellCenter({ col, row }, grid);
              ctx.moveTo(center.x + around[0].x, center.y + around[0].y);
              for (let corner = 1; corner < around.length; corner++) ctx.lineTo(center.x + around[corner].x, center.y + around[corner].y);
              ctx.closePath();
            }
          }
        } else {
          for (let x = offsetX + Math.floor((x0 - offsetX) / cellPx) * cellPx; x <= x1; x += cellPx) {
            ctx.moveTo(x, y0);
            ctx.lineTo(x, y1);
          }
          for (let y = offsetY + Math.floor((y0 - offsetY) / cellPx) * cellPx; y <= y1; y += cellPx) {
            ctx.moveTo(x0, y);
            ctx.lineTo(x1, y);
          }
        }
        // Linhas escuras: sobre a imagem e sobre a mesa (L5). Com cor escolhida pelo mestre, meio transparente.
        ctx.strokeStyle = !onImage ? "rgba(255,255,255,0.09)" : grid.gridColor ? `${grid.gridColor}80` : "rgba(0,0,0,0.45)";
        ctx.lineWidth = 1 / view.scale;
        ctx.stroke();
      }}
    />
  );
}

/** Hexes cruzados pela linha entre os centros (um ponto por hex de distância, com um empurrão para não cair na divisa). */
function hexesAlong(from: GridPos, to: GridPos, grid: MapConfig): GridPos[] {
  const geometry = geometryOf(grid.grid);
  const steps = geometry.distance(from, to);
  const a = geometry.center(from);
  const b = geometry.center(to);
  const cells: GridPos[] = [];
  for (let step = 0; step <= steps; step++) {
    const along = steps === 0 ? 0 : step / steps;
    cells.push(geometry.cellAt({ x: a.x + (b.x - a.x) * along + 1e-6, y: a.y + (b.y - a.y) * along + 2e-6 }));
  }
  return cells;
}

function RulerShape({
  ruler,
  grid,
  scale,
  label,
  color,
  cellOnly = false,
}: {
  ruler: Ruler;
  grid: MapConfig;
  scale: number;
  label?: string;
  color: string;
  /** Só a casa de destino com o nome, sem medir (colocar no mapa sem ninguém de referência). */
  cellOnly?: boolean;
}) {
  const t = useT();
  const geometry = geometryOf(grid.grid);
  const hex = isHex(grid);
  const a = cellCenter(ruler.from, grid);
  const b = cellCenter(ruler.to, grid);
  const cells = geometry.distance(ruler.from, ruler.to);
  const feet = cells * grid.feetPerCell;
  const fs = 14 / scale;
  const counted = t(hex ? "map.hexes" : "map.squares", { n: cells });
  const text = cellOnly ? (label ?? "") : `${feet} ft · ${counted}${label ? ` (${label})` : ""}`;
  // Hex: realça os hexes por onde a linha passa (no quadrado, só a casa de destino, como sempre).
  const lit = hex && !cellOnly ? hexesAlong(ruler.from, ruler.to, grid) : [ruler.to];

  return (
    <Group>
      {hex ? (
        <Shape
          listening={false}
          fill={`${color}33`}
          sceneFunc={(kctx, shape) => {
            kctx.beginPath();
            for (const cell of lit) {
              const corners = geometry.polygon(cell).map((corner) => toWorld(corner, grid));
              kctx.moveTo(corners[0].x, corners[0].y);
              for (const corner of corners.slice(1)) kctx.lineTo(corner.x, corner.y);
              kctx.closePath();
            }
            kctx.fillShape(shape);
          }}
        />
      ) : (
        <Rect
          x={grid.offsetX + ruler.to.col * grid.cellPx}
          y={grid.offsetY + ruler.to.row * grid.cellPx}
          width={grid.cellPx}
          height={grid.cellPx}
          fill={`${color}33`}
        />
      )}
      {!cellOnly && <Line points={[a.x, a.y, b.x, b.y]} stroke={color} strokeWidth={3 / scale} dash={[10 / scale, 6 / scale]} />}
      {!cellOnly && <Circle x={a.x} y={a.y} radius={5 / scale} fill={color} />}
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
  compact,
  narrow,
  onZoom,
  onFit,
  paused,
}: {
  tool: string;
  gm: boolean;
  /** Jogo pausado (Passo 7): o botão de pausa do mestre vira Retomar. */
  paused: boolean;
  compact: boolean;
  /** Mapa estreito: ferramentas só com ícone. */
  narrow: boolean;
  onZoom: (factor: number) => void;
  onFit: () => void;
}) {
  const t = useT();
  const reduceFx = useApp((s) => s.reduceFx);
  const followTurn = useApp((s) => s.followTurn);
  const followButton = (
    <Tooltip label={t("map.followTurnTip")}>
      <ActionIcon
        size={compact ? "lg" : undefined}
        variant={followTurn ? "filled" : "subtle"}
        color={followTurn ? undefined : "gray"}
        onClick={() => setDicePrefs({ followTurn: !followTurn })}
        aria-label={t("map.followTurn")}
        aria-pressed={followTurn}
      >
        <IconCurrentLocation size={compact ? 18 : 16} />
      </ActionIcon>
    </Tooltip>
  );
  // Reduzir efeitos vale para o clima e para as animações do mapa (L6): fica sempre na barra.
  const reduceButton = (
    <Tooltip label={reduceFx ? t("map.fullFx") : t("map.reduceFxTip")}>
      <ActionIcon
        size={compact ? "lg" : undefined}
        variant={reduceFx ? "filled" : "subtle"}
        color={reduceFx ? undefined : "gray"}
        onClick={() => setDicePrefs({ reduceFx: !reduceFx })}
        aria-label={t("map.reduceFx")}
        aria-pressed={reduceFx}
      >
        <IconCloudOff size={compact ? 18 : 16} />
      </ActionIcon>
    </Tooltip>
  );

  if (compact) {
    // Celular (E23): só ícones, alvos de toque maiores; zoom é com pinça.
    const tools = [
      { id: "move", label: t("map.moveTip"), icon: IconHandStop },
      { id: "ruler", label: t("map.rulerTipMobile"), icon: IconRuler2 },
      { id: "area", label: t("map.areaTipMobile"), icon: IconSparkles },
      { id: "ping", label: t("map.pingTip"), icon: IconHandFinger },
      { id: "draw", label: t("draw.arrowsTip"), icon: IconArrowUpRight },
    ] as const;
    return (
      <Paper className="map-toolbar" p={4} shadow="md" radius="md">
        <MGroup gap={4} wrap="nowrap">
          {tools.map(({ id, label, icon: Icon }) => (
            <Tooltip key={id} label={label}>
              <ActionIcon
                size="lg"
                variant={tool === id ? "filled" : "subtle"}
                color={tool === id ? undefined : "gray"}
                onClick={() => setTool(tool === id && id !== "move" ? "move" : id)}
                aria-label={label}
                aria-pressed={tool === id}
              >
                <Icon size={18} />
              </ActionIcon>
            </Tooltip>
          ))}
          <Divider orientation="vertical" mx={2} />
          <Tooltip label={t("map.fit")}>
            <ActionIcon size="lg" variant="subtle" color="gray" onClick={onFit} aria-label={t("map.fit")}>
              <IconFocusCentered size={18} />
            </ActionIcon>
          </Tooltip>
          {followButton}
          {reduceButton}
        </MGroup>
      </Paper>
    );
  }

  // Mapa estreito (colunas largas): as ferramentas ficam só com o ícone, para a barra caber.
  const tools = [
    { id: "move", text: t("map.move"), label: t("map.moveTip"), icon: IconHandStop },
    { id: "ruler", text: t("map.ruler"), label: t("map.rulerTip"), icon: IconRuler2 },
    { id: "area", text: t("map.area"), label: t("map.areaTip"), icon: IconSparkles },
    { id: "ping", text: t("map.ping"), label: t("map.pingTip"), icon: IconHandFinger },
    gm
      ? ({ id: "draw", text: t("draw.tool"), label: t("draw.toolTip"), icon: IconPencil } as const)
      : ({ id: "draw", text: t("draw.arrows"), label: t("draw.arrowsTip"), icon: IconArrowUpRight } as const),
    ...(gm
      ? ([
          { id: "fog", text: t("fog.tool"), label: t("fog.toolTip"), icon: IconCloudFog },
        ] as const)
      : []),
  ] as const;
  return (
    <Paper className="map-toolbar" p={4} shadow="md" radius="md">
      <MGroup gap={4} wrap="nowrap">
        {tools.map(({ id, text, label, icon: Icon }) => (
          <Tooltip key={id} label={<TipTitle title={text} shortcut={TOOL_KEYS[id]}>{label}</TipTitle>}>
            {narrow ? (
              <ActionIcon
                size="lg"
                variant={tool === id ? "filled" : "subtle"}
                color={tool === id ? undefined : "gray"}
                onClick={() => setTool(tool === id && id !== "move" ? "move" : id)}
                aria-label={text}
                aria-pressed={tool === id}
              >
                <Icon size={16} />
              </ActionIcon>
            ) : (
              <Button
                variant={tool === id ? "filled" : "subtle"}
                color={tool === id ? undefined : "gray"}
                onClick={() => setTool(tool === id && id !== "move" ? "move" : id)}
                leftSection={<Icon size={14} />}
              >
                {text}
              </Button>
            )}
          </Tooltip>
        ))}
        {gm && tool === "calibrate" && <Button onClick={() => setTool("move")}>{t("map.cancelCalibration")}</Button>}
        <Divider orientation="vertical" mx={2} />
        <Tooltip label={t("map.zoomOut")}>
          <ActionIcon onClick={() => onZoom(1 / 1.25)} aria-label={t("map.zoomOut")}>
            −
          </ActionIcon>
        </Tooltip>
        <Tooltip label={t("map.zoomIn")}>
          <ActionIcon onClick={() => onZoom(1.25)} aria-label={t("map.zoomIn")}>
            +
          </ActionIcon>
        </Tooltip>
        <Tooltip label={t("map.fit")}>
          {narrow ? (
            <ActionIcon size="lg" variant="subtle" color="gray" onClick={onFit} aria-label={t("map.fit")}>
              <IconFocusCentered size={16} />
            </ActionIcon>
          ) : (
            <Button variant="subtle" color="gray" onClick={onFit}>
              {t("map.fitShort")}
            </Button>
          )}
        </Tooltip>
        {followButton}
        {reduceButton}
        {gm && <PauseButton paused={paused} size="lg" />}
      </MGroup>
    </Paper>
  );
}

const AREA_KINDS: AreaKind[] = ["cone", "sphere", "cylinder", "line", "cube"];

/** Forma e tamanho da área (ferramenta Área). */
function AreaOptions({ canFix, locked, onFix }: { canFix: boolean; locked: boolean; onFix: () => void }) {
  const t = useT();
  const { areaKind, areaFeet } = useApp();
  return (
    <Paper className="map-options" p="xs" shadow="md" radius="md">
      <MGroup gap="xs" wrap="nowrap" align="flex-end">
        <SegmentedControl
          size="xs"
          data={AREA_KINDS.map((k) => ({ value: k, label: t(AREA_LABEL[k]) }))}
          value={areaKind}
          onChange={(v) => useApp.setState({ areaKind: v as AreaKind, areaFeet: AREA_DEFAULT_FEET[v as AreaKind] })}
          aria-label={t("area.shape")}
        />
        <Tooltip label={t("area.feetOf", { what: t(AREA_MEASURE[areaKind]) })}>
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
            aria-label={t("area.sizeOf", { what: t(AREA_MEASURE[areaKind]) })}
          />
        </Tooltip>
      </MGroup>
      <MGroup gap="xs" wrap="nowrap" justify="space-between" mt={4}>
        <MText size="xs" c="dimmed">
          {t("area.hint")}
        </MText>
        {/* Regra da mesa: fora da vez, `data-disabled` para a dica explicar o porquê. */}
        <Tooltip label={locked ? t("rules.effectLocked") : t("area.fixTip")}>
          <Button
            size="compact-xs"
            disabled={!canFix}
            data-disabled={locked || undefined}
            leftSection={<IconPin size={12} />}
            onClick={() => !locked && onFix()}
            style={{ flex: "none" }}
          >
            {t("area.fix")}
          </Button>
        </Tooltip>
      </MGroup>
    </Paper>
  );
}

/**
 * Mobs repetidos no mapa ("Goblin 1", "Goblin 2"…, numerados pelo servidor): o número de cada um, para a
 * placa mostrar só "2". Mob sozinho com aquele nome-base fica com o nome inteiro.
 */
function repeatedNumbers(tokens: CombatantView[]): Map<string, number> {
  const groups = new Map<string, { id: string; n: number }[]>();
  for (const c of tokens) {
    if (c.type !== "mob" || c.boss) continue;
    const m = /^(.*\S) (\d+)$/.exec(c.name);
    if (!m) continue;
    const list = groups.get(m[1]) ?? [];
    list.push({ id: c.id, n: Number(m[2]) });
    groups.set(m[1], list);
  }
  const out = new Map<string, number>();
  for (const list of groups.values()) if (list.length > 1) for (const { id, n } of list) out.set(id, n);
  return out;
}

// O fundo do mapa só redesenha quando muda (a função de desenho nova a cada render forçaria a camada com a
// imagem inteira a cada envio do servidor, e isso pesa em celular).
const MemoTable = memo(TableShape);
const MemoEdge = memo(MapEdgeShape);
const MemoGrid = memo(GridLines);
