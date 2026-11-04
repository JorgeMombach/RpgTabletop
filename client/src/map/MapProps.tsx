import { ActionIcon, Button, Checkbox, Group, Paper, SegmentedControl, Select, Slider, Text, Tooltip } from "@mantine/core";
import { IconArrowBackUp, IconDice5, IconTrash } from "@tabler/icons-react";
import type Konva from "konva";
import { memo, useEffect, useRef } from "react";
import { Image as KImage, Layer, Transformer } from "react-konva";
import { LIMITS, PROP_KINDS, type CombatantView, type MapConfig, type MapProp, type PropKind } from "@rpg/shared";
import { useT, type MessageKey } from "../i18n";
import { useApp } from "../store";
import { removeProps, undo, updateProp, useMapUndo } from "./mapHistory";
import { drawProp, PROP_EXTENT, propImage } from "./propArt";
import { SCATTER_SETS, type ScatterSet } from "./scatter";

export const PROP_LABEL: Record<PropKind, MessageKey> = {
  tree: "props.tree",
  bush: "props.bush",
  boulder: "props.boulder",
  stones: "props.stones",
  log: "props.log",
  stump: "props.stump",
  rubble: "props.rubble",
  barrel: "props.barrel",
  crate: "props.crate",
  crates: "props.crates",
  planks: "props.planks",
  table: "props.table",
  pillar: "props.pillar",
};

/** Centro do objeto em pixels do mapa. */
const centerOf = (p: Pick<MapProp, "col" | "row">, g: MapConfig) => ({ x: g.offsetX + p.col * g.cellPx, y: g.offsetY + p.row * g.cellPx });

/** Ponto do mapa (pixels) em casas, em centésimos; com Shift, no centro da casa. */
export function propSpot(x: number, y: number, g: MapConfig, snap: boolean): { col: number; row: number } {
  const col = (x - g.offsetX) / g.cellPx;
  const row = (y - g.offsetY) / g.cellPx;
  if (snap) return { col: Math.floor(col) + 0.5, row: Math.floor(row) + 0.5 };
  return { col: Math.round(col * 100) / 100, row: Math.round(row * 100) / 100 };
}

/**
 * Um objeto do cenário: a imagem guardada do desenho (feita uma vez por tipo, semente e resolução), girada no
 * centro. Com a ferramenta Objetos, o mestre arrasta (Shift encaixa no centro da casa) e clica para escolher.
 */
function PropNode({ p, grid, scale, editing, faded, onPick }: { p: MapProp; grid: MapConfig; scale: number; editing: boolean; faded: boolean; onPick: () => void }) {
  const { x, y } = centerOf(p, grid);
  const side = PROP_EXTENT[p.kind] * 2 * grid.cellPx * p.size;
  const image = propImage(p.kind, p.seed, grid.cellPx * p.size * scale * (window.devicePixelRatio || 1));
  // O Konva solta um clique no fim do arrasto: esse não escolhe de novo.
  const dragged = useRef(false);
  return (
    <KImage
      name="map-prop"
      id={`prop-${p.id}`}
      image={image}
      x={x}
      y={y}
      width={side}
      height={side}
      offsetX={side / 2}
      offsetY={side / 2}
      rotation={p.rotation}
      opacity={faded ? 0.45 : 1}
      listening={editing}
      draggable={editing}
      perfectDrawEnabled={false}
      // Área de clique: o miolo do desenho (não a sombra nem a folga da imagem).
      hitFunc={(k, shape) => {
        k.beginPath();
        k.arc(side / 2, side / 2, (side / 2 / PROP_EXTENT[p.kind]) * Math.min(1, PROP_EXTENT[p.kind] * 0.75), 0, Math.PI * 2);
        k.closePath();
        k.fillStrokeShape(shape);
      }}
      onMouseEnter={(e) => {
        const stage = e.target.getStage();
        if (stage && editing) stage.container().style.cursor = "move";
      }}
      onMouseLeave={(e) => {
        const stage = e.target.getStage();
        if (stage) stage.container().style.cursor = "";
      }}
      onClick={() => !dragged.current && onPick()}
      onTap={() => !dragged.current && onPick()}
      onDragStart={() => {
        dragged.current = true;
        onPick();
      }}
      onDragEnd={(e) => {
        window.setTimeout(() => (dragged.current = false), 0);
        const node = e.target;
        const spot = propSpot(node.x(), node.y(), grid, e.evt.shiftKey);
        node.position(centerOf(spot, grid));
        if (spot.col !== p.col || spot.row !== p.row) void updateProp(p, spot);
      }}
      onTransformEnd={(e) => {
        // As alças mudam a escala do nó: vira tamanho do objeto, e a escala volta a 1.
        const node = e.target;
        const size = Math.min(LIMITS.propSize.max, Math.max(LIMITS.propSize.min, Math.round(p.size * node.scaleX() * 100) / 100));
        const rotation = Math.round(node.rotation());
        node.scale({ x: 1, y: 1 });
        void updateProp(p, { size, rotation });
      }}
    />
  );
}

interface PropLayerProps {
  props: MapProp[];
  grid: MapConfig;
  scale: number;
  layer: "below" | "above";
  editing: boolean;
  selectedId: string | null;
  tokens: CombatantView[];
  /** Onde estão os tokens (`tokenSpots`): só isso importa da lista de tokens, para a copa ficar transparente. */
  tokenKey: string;
}

/**
 * Objetos de uma camada: os de baixo (abaixo das tochas e da névoa) ou os de cima dos tokens (copas). Copa com token
 * embaixo fica meio transparente, para não esconder ninguém. O escolhido ganha as alças de tamanho e giro.
 * Em `memo` (`samePropLayer`): o mapa redesenha a cada passo do WASD, e com centenas de objetos refazer a camada
 * à toa engasgava a visão.
 */
export const MapPropLayer = memo(function MapPropLayer({
  props,
  grid,
  scale,
  layer,
  editing,
  selectedId,
  tokens,
}: PropLayerProps) {
  const list = props.filter((p) => p.above === (layer === "above"));
  const tr = useRef<Konva.Transformer>(null);
  const picked = editing && list.some((p) => p.id === selectedId) ? selectedId : null;
  useEffect(() => {
    const t = tr.current;
    if (!t) return;
    const node = picked ? t.getStage()?.findOne(`#prop-${picked}`) : undefined;
    t.nodes(node ? [node] : []);
    t.getLayer()?.batchDraw();
  }, [picked, list]);
  if (list.length === 0) return null;
  const under = (p: MapProp) => {
    if (layer !== "above") return false;
    const { x, y } = centerOf(p, grid);
    const r = grid.cellPx * p.size;
    return tokens.some((c) => c.pos && Math.hypot(grid.offsetX + (c.pos.col + 0.5) * grid.cellPx - x, grid.offsetY + (c.pos.row + 0.5) * grid.cellPx - y) < r);
  };
  return (
    <Layer listening={editing}>
      {list.map((p) => (
        <PropNode key={p.id} p={p} grid={grid} scale={scale} editing={editing} faded={under(p)} onPick={() => useApp.setState({ selectedPropId: p.id })} />
      ))}
      {editing && (
        <Transformer
          ref={tr}
          keepRatio
          centeredScaling
          rotationSnaps={[0, 45, 90, 135, 180, 225, 270, 315]}
          rotationSnapTolerance={6}
          enabledAnchors={["top-left", "top-right", "bottom-left", "bottom-right"]}
          anchorFill="#d8b47a"
          anchorStroke="#2a1608"
          anchorSize={10}
          anchorCornerRadius={5}
          borderStroke="#d8b47a"
          borderDash={[6, 4]}
          rotateAnchorOffset={24}
          boundBoxFunc={(oldBox, box) => (Math.abs(box.width) < 12 ? oldBox : box)}
        />
      )}
    </Layer>
  );
}, samePropLayer);

function samePropLayer(a: PropLayerProps, b: PropLayerProps): boolean {
  return a.props === b.props && a.grid === b.grid && a.scale === b.scale && a.layer === b.layer && a.editing === b.editing && a.selectedId === b.selectedId && a.tokenKey === b.tokenKey;
}

/** Chave das posições dos tokens no mapa (muda só quando algum anda). */
export function tokenSpots(tokens: CombatantView[]): string {
  return tokens.map((c) => (c.pos ? `${c.pos.col},${c.pos.row}` : "")).join("|");
}

/** O desenho do objeto no catálogo. */
export function PropIcon({ kind, size = 34 }: { kind: PropKind; size?: number }) {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const ctx = ref.current?.getContext("2d");
    if (!ctx) return;
    ctx.setTransform(2, 0, 0, 2, 0, 0);
    ctx.clearRect(0, 0, size, size);
    ctx.translate(size / 2, size / 2);
    drawProp(ctx, kind, size / (PROP_EXTENT[kind] * 2), 17);
  }, [kind, size]);
  return <canvas ref={ref} width={size * 2} height={size * 2} style={{ width: size, height: size, display: "block" }} aria-hidden />;
}

/**
 * Opções da ferramenta Objetos (mestre): o catálogo (o próximo a pôr) e, com um objeto escolhido, variar, camada,
 * atrapalhar a visão, tamanho e apagar. Em `memo`: o mapa redesenha a cada passo do WASD.
 */
const SET_LABEL: Record<ScatterSet, MessageKey> = { forest: "props.setForest", grove: "props.setGrove", rocks: "props.setRocks", rubble: "props.setRubble" };

export const PropOptions = memo(function PropOptions({ selected }: { selected: MapProp | null }) {
  const t = useT();
  const propKind = useApp((s) => s.propKind);
  const mode = useApp((s) => s.propMode);
  const scatterSet = useApp((s) => s.scatterSet);
  const scatterSize = useApp((s) => s.scatterSize);
  const scatterDensity = useApp((s) => s.scatterDensity);
  const undoCount = useMapUndo((s) => s.props);
  const brush = mode !== "place";
  return (
    <Paper className="map-options" p="xs" shadow="md" radius="md">
      <Group gap="xs" wrap="wrap" mb={6}>
        <SegmentedControl
          size="xs"
          data={[
            { value: "place", label: t("props.modePlace") },
            { value: "scatter", label: t("props.modeScatter") },
            { value: "erase", label: t("props.modeErase") },
          ]}
          value={mode}
          onChange={(v) => useApp.setState({ propMode: v as "place" | "scatter" | "erase", selectedPropId: null })}
          aria-label={t("props.mode")}
        />
        {mode === "scatter" && (
          <Select
            size="xs"
            w={150}
            data={SCATTER_SETS.map((s) => ({ value: s, label: t(SET_LABEL[s]) }))}
            value={scatterSet}
            onChange={(v) => v && useApp.setState({ scatterSet: v as ScatterSet })}
            allowDeselect={false}
            comboboxProps={{ withinPortal: true }}
            aria-label={t("props.set")}
          />
        )}
        {brush && (
          <SegmentedControl
            size="xs"
            data={["3", "5", "9"].map((n) => ({ value: n, label: t("fog.brushSize", { n }) }))}
            value={String(scatterSize)}
            onChange={(v) => useApp.setState({ scatterSize: Number(v) })}
            aria-label={t("fog.brushSizeLabel")}
          />
        )}
        {mode === "scatter" && (
          <Group gap={6} wrap="nowrap" style={{ flex: "1 1 140px" }}>
            <Text size="xs" c="dimmed" style={{ flex: "none" }}>
              {t("props.density")}
            </Text>
            <Slider
              size="xs"
              style={{ flex: 1 }}
              min={0.2}
              max={1}
              step={0.05}
              value={scatterDensity}
              onChange={(v) => useApp.setState({ scatterDensity: v })}
              label={(v) => `${Math.round(v * 100)}%`}
              aria-label={t("props.density")}
            />
          </Group>
        )}
      </Group>
      {!brush && (
      <Group gap={2} wrap="wrap" role="radiogroup" aria-label={t("props.pick")}>
        {PROP_KINDS.map((k) => (
          <Tooltip key={k} label={t(PROP_LABEL[k])}>
            <ActionIcon
              size={40}
              variant={propKind === k ? "light" : "subtle"}
              color={propKind === k ? undefined : "gray"}
              role="radio"
              aria-checked={propKind === k}
              aria-label={t(PROP_LABEL[k])}
              onClick={() => useApp.setState({ propKind: k, selectedPropId: null })}
            >
              <PropIcon kind={k} />
            </ActionIcon>
          </Tooltip>
        ))}
      </Group>
      )}
      {selected && !brush ? (
        <Group gap="xs" mt={6} wrap="wrap" align="center">
          <Text size="xs" fw={700}>
            {t(PROP_LABEL[selected.kind])}
          </Text>
          <Tooltip label={t("props.varyTip")}>
            <Button size="compact-xs" variant="default" leftSection={<IconDice5 size={12} />} onClick={() => void updateProp(selected, { seed: Math.floor(Math.random() * 2 ** 16) })}>
              {t("props.vary")}
            </Button>
          </Tooltip>
          <SegmentedControl
            size="xs"
            data={[
              { value: "below", label: t("props.below") },
              { value: "above", label: t("props.above") },
            ]}
            value={selected.above ? "above" : "below"}
            onChange={(v) => void updateProp(selected, { above: v === "above" })}
            aria-label={t("props.layer")}
          />
          <Checkbox size="xs" label={t("props.blocks")} checked={selected.blocks} onChange={(e) => void updateProp(selected, { blocks: e.currentTarget.checked })} />
          <Group gap={6} wrap="nowrap" style={{ flex: "1 1 160px" }}>
            <Text size="xs" c="dimmed" style={{ flex: "none" }}>
              {t("props.size")}
            </Text>
            <Slider
              key={`${selected.id}-${selected.size}`}
              size="xs"
              style={{ flex: 1 }}
              min={LIMITS.propSize.min}
              max={LIMITS.propSize.max}
              step={0.05}
              defaultValue={selected.size}
              label={(v) => `${Math.round(v * 100)}%`}
              onChangeEnd={(v) => void updateProp(selected, { size: Math.round(v * 100) / 100 })}
              aria-label={t("props.size")}
            />
          </Group>
          <Button
            size="compact-xs"
            variant="subtle"
            color="red"
            leftSection={<IconTrash size={12} />}
            onClick={() => {
              void removeProps([selected]);
              useApp.setState({ selectedPropId: null });
            }}
          >
            {t("props.remove")}
          </Button>
        </Group>
      ) : null}
      <Group gap="xs" mt={6} justify="space-between" wrap="nowrap">
        <Text size="xs" c="dimmed" style={{ flex: 1, minWidth: 0 }}>
          {t(mode === "scatter" ? "props.hintScatter" : mode === "erase" ? "props.hintErase" : selected ? "props.hintSelected" : "props.hint")}
        </Text>
        <Tooltip label={t("props.undoTip")}>
          <Button size="compact-xs" variant="default" style={{ flex: "none" }} disabled={undoCount === 0} leftSection={<IconArrowBackUp size={12} />} onClick={() => void undo("props")}>
            {t("walls.undo")}
          </Button>
        </Tooltip>
      </Group>
    </Paper>
  );
});
