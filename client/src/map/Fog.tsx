import { Button, Checkbox, Group, Paper, SegmentedControl, Select, Text, Tooltip } from "@mantine/core";
import { IconEye, IconEyeOff } from "@tabler/icons-react";
import Konva from "konva";
import { useEffect, useMemo, useRef } from "react";
import { Layer, Shape } from "react-konva";
import { LIMITS, type FogRect, type FogState, type GridPos, type MapConfig } from "@rpg/shared";
import { act } from "../actions";
import { confirmAction } from "../confirm";
import { useT } from "../i18n";
import { useApp } from "../store";
import { buildMask, FOG_TILE, fogTexture, type MaskArea } from "./fogRender";

/** Névoa vista pelo mestre: bruma acinzentada e translúcida (aparece até no grid sem imagem). */
const GM_FOG_OPACITY = 0.62;
/** Área explorada (já vista, ninguém olhando agora): a névoa fica rala, o mapa aparece escurecido. */
const EXPLORED_OPACITY = 0.6;
/** Até onde a névoa vai em volta do mapa (casas): o grid não tem fim. */
const REACH = LIMITS.gridCoord;

/** Alcances da visão por cena (pés) que o mestre escolhe; fora deles, "pela luz do clima". */
const RANGES = [30, 60, 120];

/** Pincel, retângulo ou o cômodo inteiro (um clique: até as paredes e portas fechadas). */
export type FogShape = "brush" | "rect" | "room";

/** Pincelada em andamento do mestre (aparece na hora, antes de o servidor confirmar). */
export interface FogDraft {
  reveal: boolean;
  rects: FogRect[];
}

/** Retângulo de casas entre duas casas (inclusive), em qualquer direção. */
export function rectBetween(a: GridPos, b: GridPos): FogRect {
  const col = Math.min(a.col, b.col);
  const row = Math.min(a.row, b.row);
  return { col, row, w: Math.abs(a.col - b.col) + 1, h: Math.abs(a.row - b.row) + 1 };
}

/** Quadrado do pincel (lado `size` casas) centrado na casa. */
export function brushRect(cell: GridPos, size: number): FogRect {
  const half = Math.floor(size / 2);
  return { col: cell.col - half, row: cell.row - half, w: size, h: size };
}

/** Quebra retângulos maiores que o lado máximo aceito pelo servidor. */
function split(rects: FogRect[]): FogRect[] {
  const side = LIMITS.fogRectSide;
  return rects.flatMap((r) => {
    const out: FogRect[] = [];
    for (let row = r.row; row < r.row + r.h; row += side) {
      for (let col = r.col; col < r.col + r.w; col += side) {
        out.push({ col, row, w: Math.min(side, r.col + r.w - col), h: Math.min(side, r.row + r.h - row) });
      }
    }
    return out;
  });
}

/** Manda a pincelada ao servidor (em partes, se for grande). */
export async function sendFog(draft: FogDraft) {
  const rects = split(draft.rects);
  for (let i = 0; i < rects.length; i += LIMITS.fogRects) {
    const res = await act("fog:paint", { reveal: draft.reveal, rects: rects.slice(i, i + LIMITS.fogRects) });
    if (!res.ok) return;
  }
}

type Grid = Pick<MapConfig, "cellPx" | "offsetX" | "offsetY">;

/** Intervalos por linha viram retângulos de uma linha. */
function rowsToRects(rows: Record<string, number[]>): FogRect[] {
  const out: FogRect[] = [];
  for (const [key, list] of Object.entries(rows)) {
    const row = Number(key);
    for (let i = 0; i < list.length; i += 2) out.push({ col: list[i], row, w: list[i + 1] - list[i], h: 1 });
  }
  return out;
}

/**
 * Névoa por cima do mapa, dos efeitos, dos desenhos e das paredes; abaixo dos tokens (o jogador sempre
 * vê os aliados; inimigos cobertos nem chegam do servidor). Uma camada própria: fumaça em duas camadas
 * que derivam devagar e, por cima, a máscara do que se vê "fura" a fumaça (destination-out), com borda
 * esfumaçada. O explorado fura só um pouco (névoa rala). O mestre vê através (bruma translúcida).
 */
export function FogLayer({ fog, sight, grid, gm, draft }: { fog: FogState; sight: Record<string, number[]>; grid: Grid; gm: boolean; draft: FogDraft | null }) {
  const reduceFx = useApp((s) => s.reduceFx);
  const layerRef = useRef<Konva.Layer>(null);
  const time = useRef(0);

  // A máscara só muda quando a névoa, a visão ou a pincelada mudam (não a cada quadro).
  const mask = useMemo(() => {
    if (!fog.enabled) return null;
    const areas: MaskArea[] = [];
    if (fog.vision) for (const rect of rowsToRects(fog.explored)) areas.push({ rect, amount: 1 - EXPLORED_OPACITY });
    for (const rect of rowsToRects(fog.revealed)) areas.push({ rect, amount: 1 });
    if (fog.vision) for (const rect of rowsToRects(sight)) areas.push({ rect, amount: 1 });
    if (draft?.reveal) for (const rect of draft.rects) areas.push({ rect, amount: 1 });
    return buildMask(areas, draft && !draft.reveal ? draft.rects : []);
  }, [fog, sight, draft]);

  // Fumaça andando devagar (sem animação com "Reduzir efeitos").
  useEffect(() => {
    const layer = layerRef.current;
    if (!fog.enabled || reduceFx || !layer) return;
    let last = 0;
    const anim = new Konva.Animation((frame) => {
      if (!frame) return false;
      time.current = frame.time / 1000;
      // ~20 quadros por segundo bastam para a fumaça.
      if (frame.time - last < 50) return false;
      last = frame.time;
      return true;
    }, layer);
    anim.start();
    return () => {
      anim.stop();
    };
  }, [fog.enabled, reduceFx]);

  if (!fog.enabled) return null;
  const { cellPx: s, offsetX: ox, offsetY: oy } = grid;
  const look = gm ? "mist" : "dark";

  return (
    <Layer ref={layerRef} listening={false} opacity={gm ? GM_FOG_OPACITY : 1}>
      <Shape
        sceneFunc={(kctx) => {
          const ctx = kctx._context as CanvasRenderingContext2D;
          const t = time.current;
          const big = { x: ox - REACH * s, y: oy - REACH * s, w: 2 * REACH * s, h: 2 * REACH * s };
          // O ladrilho cobre 3 casas: a fumaça acompanha o zoom do mapa.
          const tile = (3 * s) / FOG_TILE;
          const drifts: [number, number][] = [
            [t * 0.06 * s, t * 0.025 * s],
            [-t * 0.11 * s, t * 0.05 * s],
          ];
          ctx.save();
          ([0, 1] as const).forEach((layer) => {
            const pattern = ctx.createPattern(fogTexture(look, layer), "repeat");
            if (!pattern) return;
            const scale = layer ? tile * 1.7 : tile;
            pattern.setTransform(new DOMMatrix().translate(ox + drifts[layer][0], oy + drifts[layer][1]).scale(scale));
            ctx.fillStyle = pattern;
            ctx.fillRect(big.x, big.y, big.w, big.h);
          });
          if (mask) {
            ctx.globalCompositeOperation = "destination-out";
            ctx.imageSmoothingEnabled = true;
            ctx.imageSmoothingQuality = "high";
            ctx.drawImage(mask.canvas, ox + mask.col * s, oy + mask.row * s, (mask.canvas.width / mask.ppc) * s, (mask.canvas.height / mask.ppc) * s);
          }
          ctx.restore();
        }}
      />
    </Layer>
  );
}

/** Opções da ferramenta Névoa (mestre): ligar, revelar ou cobrir, pincel ou retângulo, revelar o mapa e cobrir tudo. */
export function FogOptions({ fog, onRevealMap }: { fog: FogState; onRevealMap: (() => void) | null }) {
  const t = useT();
  const { fogReveal, fogShape, fogBrush } = useApp();

  async function coverAll() {
    const ok = await confirmAction({ title: t("fog.coverAllTitle"), message: t("fog.coverAllMessage"), confirmLabel: t("fog.coverAll") });
    if (ok) void act("fog:reset", {});
  }

  return (
    <Paper className="map-options" p="xs" shadow="md" radius="md">
      <Group gap="xs" wrap="wrap" align="center">
        <Checkbox size="xs" label={t("fog.enabled")} checked={fog.enabled} onChange={(e) => void act("fog:set", { enabled: e.currentTarget.checked })} />
        <Tooltip label={t("fog.visionTip")} multiline w={280}>
          <Checkbox
            size="xs"
            label={t("fog.vision")}
            disabled={!fog.enabled}
            checked={fog.vision}
            onChange={(e) => void act("fog:vision", { enabled: e.currentTarget.checked })}
          />
        </Tooltip>
        {fog.vision && (
          <Tooltip label={t("fog.rangeTip")} multiline w={260}>
            <Select
              size="xs"
              w={150}
              disabled={!fog.enabled}
              aria-label={t("fog.range")}
              allowDeselect={false}
              data={[
                { value: "light", label: t("fog.rangeLight") },
                ...[...new Set([...RANGES, ...(fog.range === null ? [] : [fog.range])])]
                  .sort((a, b) => a - b)
                  .map((n) => ({ value: String(n), label: t("fog.rangeFeet", { n }) })),
              ]}
              value={fog.range === null ? "light" : String(fog.range)}
              onChange={(v) => v && void act("fog:range", { feet: v === "light" ? null : Number(v) })}
            />
          </Tooltip>
        )}
        <SegmentedControl
          size="xs"
          disabled={!fog.enabled}
          data={[
            { value: "reveal", label: t("fog.reveal") },
            { value: "cover", label: t("fog.cover") },
          ]}
          value={fogReveal ? "reveal" : "cover"}
          onChange={(v) => useApp.setState({ fogReveal: v === "reveal" })}
          aria-label={t("fog.mode")}
        />
        <SegmentedControl
          size="xs"
          disabled={!fog.enabled}
          data={[
            { value: "brush", label: t("fog.brush") },
            { value: "rect", label: t("fog.rect") },
            { value: "room", label: t("fog.room") },
          ]}
          value={fogShape}
          onChange={(v) => useApp.setState({ fogShape: v as FogShape })}
          aria-label={t("fog.shape")}
        />
        {fogShape === "brush" && (
          <SegmentedControl
            size="xs"
            disabled={!fog.enabled}
            data={["1", "3", "5"].map((n) => ({ value: n, label: t("fog.brushSize", { n }) }))}
            value={String(fogBrush)}
            onChange={(v) => useApp.setState({ fogBrush: Number(v) })}
            aria-label={t("fog.brushSizeLabel")}
          />
        )}
      </Group>
      <Group gap="xs" wrap="wrap" justify="space-between" mt={6}>
        <Text size="xs" c="dimmed" style={{ flex: 1, minWidth: 160 }}>
          {t(!fog.enabled ? "fog.hintOff" : fogShape === "room" ? "fog.hintRoom" : "fog.hint")}
        </Text>
        <Group gap={4} wrap="nowrap">
          <Tooltip label={t(onRevealMap ? "fog.revealMapTip" : "fog.revealMapNoImage")}>
            <Button size="compact-xs" variant="default" disabled={!fog.enabled || !onRevealMap} leftSection={<IconEye size={12} />} onClick={() => onRevealMap?.()}>
              {t("fog.revealMap")}
            </Button>
          </Tooltip>
          <Button size="compact-xs" variant="subtle" color="red" disabled={!fog.enabled} leftSection={<IconEyeOff size={12} />} onClick={() => void coverAll()}>
            {t("fog.coverAll")}
          </Button>
        </Group>
      </Group>
    </Paper>
  );
}
