import { ActionIcon, Button, Box, Group as MGroup, Text, Tooltip } from "@mantine/core";
import { IconArrowBackUp, IconEraser, IconTrash } from "@tabler/icons-react";
import Konva from "konva";
import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { Circle, Group, Layer, Line, Shape } from "react-konva";
import { MAP_TORCH_COLORS, MAP_TORCH_STYLES, snapSconce, type ActionResult, type MapConfig, type MapTorch, type MapTorchColor, type MapTorchStyle, type Wall } from "@rpg/shared";
import { act } from "../actions";
import { confirmAction } from "../confirm";
import { useT, type MessageKey } from "../i18n";
import { useApp } from "../store";
import { endTokenDrag, useTokenDrag } from "./dragFollow";
import { addTorch, moveTorch, undo, useMapUndo } from "./mapHistory";
import { drawMapTorch } from "./mapTorchArt";
import { torchIconUrl } from "./torchIcons";
import { TORCH_RGB } from "./torchModels";

/** Tipo do arrasto de um desenho de tocha do seletor para o mapa. */
export const TORCH_DRAG_MIME = "application/x-map-torch";

/** Tamanho do desenho, em casas: as tochas, meia casa e pouco (objeto, não token); o braseiro, uma casa. A luz não muda. */
export const TORCH_CELLS: Record<MapTorchStyle, number> = { stick: 0.7, iron: 0.7, brazier: 0.8, sconce: 0.6, campfire: 1, lantern: 0.5, candles: 0.5, candelabra: 0.8, oilLamp: 0.55, orb: 0.6 };

const LABEL: Record<MapTorchStyle, MessageKey> = {
  stick: "torches.stick",
  iron: "torches.iron",
  brazier: "torches.brazier",
  sconce: "torches.sconce",
  campfire: "torches.campfire",
  lantern: "torches.lantern",
  candles: "torches.candles",
  candelabra: "torches.candelabra",
  oilLamp: "torches.oilLamp",
  orb: "torches.orb",
};

const COLOR_LABEL: Record<MapTorchColor, MessageKey> = {
  flame: "torches.color.flame",
  blue: "torches.color.blue",
  green: "torches.color.green",
  purple: "torches.color.purple",
  white: "torches.color.white",
};

/**
 * Põe a fonte escolhida no ponto (casas), na cor escolhida no painel. A arandela gruda na parede mais perto
 * (docs/design/luzes.md); longe de parede, vai o ponto cru e o servidor recusa com o motivo.
 */
export function placeTorch(col: number, row: number, style: MapTorchStyle, walls: Wall[]): Promise<ActionResult> {
  const color = useApp.getState().torchColor;
  if (style !== "sconce") return addTorch(col, row, style, color);
  const at = snapSconce({ x: col, y: row }, walls);
  return at ? addTorch(at.col, at.row, style, color, at.facing) : addTorch(col, row, style, color, 0);
}

/** Fase da tremulação de cada tocha. */
export function torchSeed(id: string): number {
  let h = 0;
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) | 0;
  return (h % 1000) / 100;
}

/** Ponto do mapa (px) de uma tocha. */
export function torchPoint(t: Pick<MapTorch, "col" | "row">, grid: Pick<MapConfig, "cellPx" | "offsetX" | "offsetY">) {
  return { x: grid.offsetX + t.col * grid.cellPx, y: grid.offsetY + t.row * grid.cellPx };
}

/** Uma tocha no mapa. Com a ferramenta Tochas, o mestre arrasta para qualquer ponto. */
function TorchShape({ t, grid, time, draggable, fire, walls }: { t: MapTorch; grid: MapConfig; time: React.RefObject<number>; draggable: boolean; fire: boolean; walls: Wall[] }) {
  const s = grid.cellPx * TORCH_CELLS[t.style];
  const seed = torchSeed(t.id);
  const at = torchPoint(t, grid);
  // Chegou o estado com a tocha no lugar novo: a luz já está lá, sem deslocamento.
  useLayoutEffect(() => endTokenDrag(t.id), [t.id, t.col, t.row]);
  return (
    <Shape
      name="map-torch"
      x={at.x}
      y={at.y}
      fill="#000"
      draggable={draggable}
      listening={draggable}
      onMouseEnter={(e) => {
        const stage = e.target.getStage();
        if (stage) stage.container().style.cursor = "grab";
      }}
      onMouseLeave={(e) => {
        const stage = e.target.getStage();
        if (stage) stage.container().style.cursor = "";
      }}
      onDragMove={(e) => useTokenDrag.setState({ id: t.id, dx: e.target.x() - at.x, dy: e.target.y() - at.y })}
      onDragEnd={(e) => {
        const node = e.target;
        const col = (node.x() - grid.offsetX) / grid.cellPx;
        const row = (node.y() - grid.offsetY) / grid.cellPx;
        // a arandela gruda na parede mais perto de onde soltou; longe de parede, o servidor recusa e ela volta
        const stuck = t.style === "sconce" ? snapSconce({ x: col, y: row }, walls) : null;
        const moved = stuck ? moveTorch(t, stuck.col, stuck.row, stuck.facing) : moveTorch(t, col, row);
        void moved.then((r) => {
          if (!r.ok) node.position(at);
          endTokenDrag(t.id);
        });
      }}
      hitFunc={(k, shape) => {
        k.beginPath();
        k.rect(-s * 0.45, -s * 0.6, s * 0.9, s * 1.05);
        k.closePath();
        k.fillStrokeShape(shape);
      }}
      sceneFunc={(k) => {
        if (fire) drawMapTorch(k._context as CanvasRenderingContext2D, t.style, 0, 0, s, time.current ?? 0, seed, fire);
      }}
    />
  );
}

/**
 * Desenhos das tochas fixas: abaixo da névoa (coberta, ninguém vê), animados como a tocha dos tokens. `fire` falso
 * (chão em WebGL): só o alvo de clique e arrasto; corpo e chama vêm da placa de vídeo (docs/design/luzes.md).
 */
export function MapTorchLayer({ torches, grid, editing, fire = true, walls }: { torches: MapTorch[]; grid: MapConfig; editing: boolean; fire?: boolean; walls: Wall[] }) {
  const layerRef = useRef<Konva.Layer>(null);
  const reduceFx = useApp((s) => s.reduceFx);
  const time = useRef(0);
  const any = torches.length > 0;

  useEffect(() => {
    const layer = layerRef.current;
    if (!layer || reduceFx || !any || !fire) return;
    let last = 0;
    const anim = new Konva.Animation((frame) => {
      if (!frame) return false;
      time.current = frame.time / 1000;
      if (frame.time - last < 40) return false;
      last = frame.time;
      return true;
    }, layer);
    anim.start();
    return () => {
      anim.stop();
    };
  }, [reduceFx, any, fire]);

  const placingSconce = useApp((s) => s.tool === "torches" && !s.torchErase && s.torchStyle === "sconce");
  if (!any && !(editing && placingSconce)) return null;
  return (
    <Layer ref={layerRef} listening={editing}>
      {torches.map((t) => (
        <TorchShape key={t.id} t={t} grid={grid} time={time} draggable={editing} fire={fire} walls={walls} />
      ))}
      {editing && placingSconce && <SconcePreview grid={grid} walls={walls} />}
    </Layer>
  );
}

/**
 * Prévia da arandela sob o ponteiro: grudada na parede mais perto, com um tracinho para onde ela vira; longe de
 * parede, um círculo vermelho no ponteiro (o clique não põe).
 */
function SconcePreview({ grid, walls }: { grid: MapConfig; walls: Wall[] }) {
  const ref = useRef<Konva.Group>(null);
  const [pointer, setPointer] = useState<{ x: number; y: number } | null>(null);
  useEffect(() => {
    const stage = ref.current?.getStage();
    if (!stage) return;
    const move = () => {
      const at = ref.current?.getLayer()?.getRelativePointerPosition();
      setPointer(at ? { x: (at.x - grid.offsetX) / grid.cellPx, y: (at.y - grid.offsetY) / grid.cellPx } : null);
    };
    const leave = () => setPointer(null);
    stage.on("pointermove.sconce", move);
    stage.on("pointerleave.sconce", leave);
    return () => {
      stage.off("pointermove.sconce");
      stage.off("pointerleave.sconce");
    };
  }, [grid.offsetX, grid.offsetY, grid.cellPx]);
  const stuck = pointer ? snapSconce(pointer, walls) : null;
  const radius = grid.cellPx * 0.16;
  const at = stuck ? torchPoint(stuck, grid) : pointer ? torchPoint({ col: pointer.x, row: pointer.y }, grid) : null;
  const angle = stuck ? (stuck.facing * Math.PI) / 180 : 0;
  return (
    <Group ref={ref} listening={false}>
      {at && (
        <>
          <Circle x={at.x} y={at.y} radius={radius} stroke={stuck ? "#c9a36a" : "#c0392b"} strokeWidth={2} dash={stuck ? undefined : [4, 3]} />
          {stuck && <Line points={[at.x, at.y, at.x + Math.cos(angle) * radius * 2.2, at.y + Math.sin(angle) * radius * 2.2]} stroke="#c9a36a" strokeWidth={2} lineCap="round" />}
        </>
      )}
    </Group>
  );
}

/** O desenhinho da fonte no seletor: o do mapa, feito pela placa de vídeo na cor escolhida; sem WebGL 2, o de antes. */
function TorchIcon({ style, color }: { style: MapTorchStyle; color: MapTorchColor }) {
  const ref = useRef<HTMLCanvasElement>(null);
  const [url, setUrl] = useState<string | null>(null);
  useEffect(() => {
    // um por vez, depois de pintar o painel (cada ícone compila o programa do modelo uma vez)
    const timer = window.setTimeout(() => setUrl(torchIconUrl(style, color)), 0);
    return () => window.clearTimeout(timer);
  }, [style, color]);
  useEffect(() => {
    if (url) return;
    const canvas = ref.current;
    const ctx = canvas?.getContext("2d");
    if (!ctx) return;
    ctx.setTransform(2, 0, 0, 2, 0, 0);
    drawMapTorch(ctx, style, 18, 34, 30, 0.42, 2.2);
  }, [style, url]);
  if (url) return <img src={url} width={36} height={36} style={{ display: "block" }} alt="" aria-hidden />;
  return <canvas ref={ref} width={72} height={72} style={{ width: 36, height: 36, display: "block" }} aria-hidden />;
}

/** Opções da ferramenta Tochas (mestre): os modelos, a cor da luz, borracha, desfazer e apagar todas. */
export function MapTorchOptions({ count }: { count: number }) {
  const t = useT();
  const torchStyle = useApp((s) => s.torchStyle);
  const torchColor = useApp((s) => s.torchColor);
  const erasing = useApp((s) => s.torchErase);
  const undoCount = useMapUndo((s) => s.torches);

  async function clearAll() {
    const ok = await confirmAction({ title: t("torches.clearTitle"), message: t("torches.clearMessage"), confirmLabel: t("torches.clear") });
    if (ok) void act("maptorch:clear", {});
  }

  return (
    <Box>
      <MGroup gap="xs" wrap="wrap" align="center" justify="space-between">
        <MGroup gap={4} wrap="wrap" role="radiogroup" aria-label={t("torches.pick")}>
          {MAP_TORCH_STYLES.map((style) => (
            <Tooltip key={style} label={t(LABEL[style])}>
              <ActionIcon
                size={44}
                variant={!erasing && torchStyle === style ? "light" : "subtle"}
                color={!erasing && torchStyle === style ? undefined : "gray"}
                role="radio"
                aria-checked={!erasing && torchStyle === style}
                aria-label={t(LABEL[style])}
                draggable
                onDragStart={(e) => {
                  e.dataTransfer.setData(TORCH_DRAG_MIME, style);
                  useApp.setState({ torchStyle: style, torchErase: false });
                }}
                onClick={() => useApp.setState({ torchStyle: style, torchErase: false })}
              >
                <TorchIcon style={style} color={torchColor} />
              </ActionIcon>
            </Tooltip>
          ))}
          <Tooltip label={t("torches.erase")}>
            <ActionIcon size={44} variant={erasing ? "light" : "subtle"} color={erasing ? undefined : "gray"} role="radio" aria-checked={erasing} aria-label={t("torches.erase")} onClick={() => useApp.setState({ torchErase: true })}>
              <IconEraser size={20} />
            </ActionIcon>
          </Tooltip>
        </MGroup>
        <MGroup gap={4} wrap="nowrap">
          <Tooltip label={t("torches.undoTip")}>
            <Button size="compact-xs" variant="default" disabled={undoCount === 0} leftSection={<IconArrowBackUp size={12} />} onClick={() => void undo("torches")}>
              {t("walls.undo")}
            </Button>
          </Tooltip>
          <Button size="compact-xs" variant="subtle" color="red" disabled={count === 0} leftSection={<IconTrash size={12} />} onClick={() => void clearAll()}>
            {t("torches.clear")}
          </Button>
        </MGroup>
      </MGroup>
      <MGroup gap={6} mt={6} wrap="nowrap" role="radiogroup" aria-label={t("torches.colorPick")}>
        {MAP_TORCH_COLORS.map((color) => {
          const [red, green, blue] = TORCH_RGB[color];
          const chosen = torchColor === color;
          return (
            <Tooltip key={color} label={t(COLOR_LABEL[color])}>
              <ActionIcon
                size={28}
                radius="xl"
                variant={chosen ? "light" : "subtle"}
                color={chosen ? undefined : "gray"}
                role="radio"
                aria-checked={chosen}
                aria-label={t(COLOR_LABEL[color])}
                onClick={() => useApp.setState({ torchColor: color })}
              >
                <Box w={16} h={16} style={{ borderRadius: "50%", background: `rgb(${Math.round(red * 255)}, ${Math.round(green * 255)}, ${Math.round(blue * 255)})`, boxShadow: "0 0 6px currentColor" }} />
              </ActionIcon>
            </Tooltip>
          );
        })}
      </MGroup>
      <Text size="xs" c="dimmed" mt={4}>
        {t(erasing ? "torches.hintErase" : torchStyle === "sconce" ? "torches.hintSconce" : "torches.hint")}
      </Text>
    </Box>
  );
}
