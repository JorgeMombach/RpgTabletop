import { ActionIcon, Button, Group as MGroup, Paper, Text, Tooltip } from "@mantine/core";
import { IconEraser, IconTrash } from "@tabler/icons-react";
import Konva from "konva";
import { useEffect, useLayoutEffect, useRef } from "react";
import { Layer, Shape } from "react-konva";
import { MAP_TORCH_STYLES, type MapConfig, type MapTorch, type MapTorchStyle } from "@rpg/shared";
import { act } from "../actions";
import { confirmAction } from "../confirm";
import { useT, type MessageKey } from "../i18n";
import { useApp } from "../store";
import { endTokenDrag, useTokenDrag } from "./dragFollow";
import { drawMapTorch } from "./mapTorchArt";

/** Tipo do arrasto de um desenho de tocha do seletor para o mapa. */
export const TORCH_DRAG_MIME = "application/x-map-torch";

/** Altura do desenho, em casas: um pouco maior que um token, para ler bem como objeto do mapa. */
const TORCH_CELLS = 1.5;

const LABEL: Record<MapTorchStyle, MessageKey> = { stick: "torches.stick", iron: "torches.iron", brazier: "torches.brazier" };

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
function TorchShape({ t, grid, time, draggable }: { t: MapTorch; grid: MapConfig; time: React.RefObject<number>; draggable: boolean }) {
  const s = grid.cellPx * TORCH_CELLS;
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
        void act("maptorch:move", { id: t.id, col: (node.x() - grid.offsetX) / grid.cellPx, row: (node.y() - grid.offsetY) / grid.cellPx }).then((r) => {
          if (!r.ok) node.position(at);
          endTokenDrag(t.id);
        });
      }}
      hitFunc={(k, shape) => {
        k.beginPath();
        k.rect(-s * 0.32, -s * 1.1, s * 0.64, s * 1.15);
        k.closePath();
        k.fillStrokeShape(shape);
      }}
      sceneFunc={(k) => drawMapTorch(k._context as CanvasRenderingContext2D, t.style, 0, 0, s, time.current ?? 0, seed)}
    />
  );
}

/** Desenhos das tochas fixas: abaixo da névoa (coberta, ninguém vê), animados como a tocha dos tokens. */
export function MapTorchLayer({ torches, grid, editing }: { torches: MapTorch[]; grid: MapConfig; editing: boolean }) {
  const layerRef = useRef<Konva.Layer>(null);
  const reduceFx = useApp((s) => s.reduceFx);
  const time = useRef(0);
  const any = torches.length > 0;

  useEffect(() => {
    const layer = layerRef.current;
    if (!layer || reduceFx || !any) return;
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
  }, [reduceFx, any]);

  if (!any) return null;
  return (
    <Layer ref={layerRef} listening={editing}>
      {torches.map((t) => (
        <TorchShape key={t.id} t={t} grid={grid} time={time} draggable={editing} />
      ))}
    </Layer>
  );
}

/** O desenhinho da tocha no seletor. */
function TorchIcon({ style }: { style: MapTorchStyle }) {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const canvas = ref.current;
    const ctx = canvas?.getContext("2d");
    if (!ctx) return;
    ctx.setTransform(2, 0, 0, 2, 0, 0);
    drawMapTorch(ctx, style, 18, 34, 30, 0.42, 2.2);
  }, [style]);
  return <canvas ref={ref} width={72} height={72} style={{ width: 36, height: 36, display: "block" }} aria-hidden />;
}

/** Opções da ferramenta Tochas (mestre): os três desenhos, borracha e apagar todas. */
export function MapTorchOptions({ count }: { count: number }) {
  const t = useT();
  const torchStyle = useApp((s) => s.torchStyle);
  const erasing = useApp((s) => s.torchErase);

  async function clearAll() {
    const ok = await confirmAction({ title: t("torches.clearTitle"), message: t("torches.clearMessage"), confirmLabel: t("torches.clear") });
    if (ok) void act("maptorch:clear", {});
  }

  return (
    <Paper className="map-options" p="xs" shadow="md" radius="md">
      <MGroup gap="xs" wrap="wrap" align="center" justify="space-between">
        <MGroup gap={4} wrap="nowrap" role="radiogroup" aria-label={t("torches.pick")}>
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
                <TorchIcon style={style} />
              </ActionIcon>
            </Tooltip>
          ))}
          <Tooltip label={t("torches.erase")}>
            <ActionIcon size={44} variant={erasing ? "light" : "subtle"} color={erasing ? undefined : "gray"} role="radio" aria-checked={erasing} aria-label={t("torches.erase")} onClick={() => useApp.setState({ torchErase: true })}>
              <IconEraser size={20} />
            </ActionIcon>
          </Tooltip>
        </MGroup>
        <Button size="compact-xs" variant="subtle" color="red" disabled={count === 0} leftSection={<IconTrash size={12} />} onClick={() => void clearAll()}>
          {t("torches.clear")}
        </Button>
      </MGroup>
      <Text size="xs" c="dimmed" mt={4}>
        {t(erasing ? "torches.hintErase" : "torches.hint")}
      </Text>
    </Paper>
  );
}
