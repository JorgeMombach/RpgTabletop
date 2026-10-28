import { Button, Checkbox, Group, Paper, SegmentedControl, Text, Tooltip } from "@mantine/core";
import { IconEye, IconEyeOff } from "@tabler/icons-react";
import { Layer, Rect } from "react-konva";
import { LIMITS, type FogRect, type FogState, type GridPos, type MapConfig } from "@rpg/shared";
import { act } from "../actions";
import { confirmAction } from "../confirm";
import { useT } from "../i18n";
import { useApp } from "../store";

/** Névoa do jogador: a "tinta" mais escura do tema, opaca. */
const FOG_COLOR = "#0d0b10";
/** Névoa vista pelo mestre: bruma acinzentada e translúcida (aparece até no grid sem imagem). */
const GM_FOG = { color: "#5b5470", opacity: 0.45 };
/** Até onde a névoa vai em volta do mapa (casas): o grid não tem fim. */
const REACH = LIMITS.gridCoord;

export type FogShape = "brush" | "rect";

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

/**
 * Névoa por cima do mapa, dos efeitos, dos desenhos e das paredes; abaixo dos tokens (o jogador sempre
 * vê os aliados; inimigos cobertos nem chegam do servidor). Uma camada própria: as casas reveladas
 * "furam" a névoa (destination-out) sem apagar o resto do mapa. O mestre vê através dela.
 */
export function FogLayer({ fog, grid, gm, draft }: { fog: FogState; grid: Grid; gm: boolean; draft: FogDraft | null }) {
  if (!fog.enabled) return null;
  const { cellPx: s, offsetX: ox, offsetY: oy } = grid;
  const cut = { fill: "#000", globalCompositeOperation: "destination-out" as const };
  const holes: FogRect[] = [];
  for (const [key, list] of Object.entries(fog.revealed)) {
    const row = Number(key);
    for (let i = 0; i < list.length; i += 2) holes.push({ col: list[i], row, w: list[i + 1] - list[i], h: 1 });
  }
  const fill = gm ? GM_FOG.color : FOG_COLOR;
  const box = (r: FogRect) => ({ x: ox + r.col * s, y: oy + r.row * s, width: r.w * s, height: r.h * s });
  return (
    <Layer listening={false} opacity={gm ? GM_FOG.opacity : 1}>
      <Rect x={ox - REACH * s} y={oy - REACH * s} width={2 * REACH * s} height={2 * REACH * s} fill={fill} />
      {holes.map((r) => (
        <Rect key={`${r.row}:${r.col}`} {...box(r)} {...cut} />
      ))}
      {draft?.rects.map((r, i) => <Rect key={`d${i}`} {...box(r)} {...(draft.reveal ? cut : { fill })} />)}
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
          {t(fog.enabled ? "fog.hint" : "fog.hintOff")}
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
