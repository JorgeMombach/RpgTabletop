import { Button, Checkbox, ColorSwatch, Group, Paper, SegmentedControl, Text, Tooltip } from "@mantine/core";
import { IconArrowBackUp, IconTrash } from "@tabler/icons-react";
import { Arrow, Circle, Line } from "react-konva";
import type { Drawing, DrawingKind } from "@rpg/shared";
import { act } from "../actions";
import { confirmAction } from "../confirm";
import { useT, type MessageKey } from "../i18n";
import { useApp } from "../store";

/** Cores do guia visual: bronze, sangue, azul dos aliados, cobre e pergaminho. */
export const DRAW_COLORS = ["#d8b47a", "#c94a52", "#5ba3e6", "#4fae8c", "#f1e6d0"];
/** Espessuras do traço (px do mapa). */
const WIDTHS = { thin: 3, medium: 6, thick: 12 } as const;
/** Com a borracha, o mesmo controle escolhe o tamanho dela: raio em casas do grid para cada espessura. */
export const ERASER_CELLS: Record<number, number> = { 3: 0.12, 6: 0.25, 12: 0.5 };

/** Ferramenta de desenho: um dos formatos ou a borracha (arrastar apaga por onde passa). */
export type DrawMode = DrawingKind | "erase";

const MODE_LABEL: Record<DrawMode, MessageKey> = {
  free: "draw.free",
  arrow: "draw.arrow",
  circle: "draw.circle",
  erase: "draw.erase",
};

/** Um desenho do mestre ou seta de jogador. Oculto (só o mestre vê): tracejado e mais apagado. */
export function DrawingShape({ d }: { d: Pick<Drawing, "kind" | "points" | "color" | "width" | "hidden"> }) {
  const common = {
    stroke: d.color,
    strokeWidth: d.width,
    opacity: d.hidden ? 0.55 : 0.9,
    dash: d.hidden ? [d.width * 2, d.width * 1.5] : undefined,
    lineCap: "round" as const,
    lineJoin: "round" as const,
    listening: false,
  };
  const [x0, y0, x1, y1] = d.points;
  if (d.kind === "circle") return <Circle x={x0} y={y0} radius={Math.hypot(x1 - x0, y1 - y0)} {...common} />;
  if (d.kind === "arrow") return <Arrow points={d.points} fill={d.color} pointerLength={d.width * 3} pointerWidth={d.width * 3} {...common} />;
  return <Line points={d.points} tension={0.4} {...common} />;
}

/**
 * Opções do desenho (embaixo do mapa, como as da área): formato, cor, espessura (ou tamanho da borracha), só eu
 * vejo, desfazer e apagar. Jogador: só seta e borracha, e desfazer e apagar valem para as setas dele.
 */
export function DrawOptions({ drawings, gm, selfId }: { drawings: Drawing[]; gm: boolean; selfId: string }) {
  const t = useT();
  const { drawMode, drawColor, drawWidth, drawHidden } = useApp();
  const modes: DrawMode[] = gm ? (Object.keys(MODE_LABEL) as DrawMode[]) : ["arrow", "erase"];
  const mode = modes.includes(drawMode) ? drawMode : "arrow";
  const mine = gm ? drawings : drawings.filter((d) => d.authorId === selfId);
  const erasing = mode === "erase";

  async function clearAll() {
    if (!gm) return void act("draw:clear", {});
    const ok = await confirmAction({ title: t("draw.clearTitle"), message: t("draw.clearMessage"), confirmLabel: t("draw.clear") });
    if (ok) void act("draw:clear", {});
  }

  return (
    <Paper className="map-options" p="xs" shadow="md" radius="md">
      <Group gap="xs" wrap="wrap" align="center">
        <SegmentedControl
          size="xs"
          data={modes.map((m) => ({ value: m, label: t(MODE_LABEL[m]) }))}
          value={mode}
          onChange={(v) => useApp.setState({ drawMode: v as DrawMode })}
          aria-label={t("draw.mode")}
        />
        {!erasing && (
        <Group gap={4} wrap="nowrap" role="radiogroup" aria-label={t("draw.color")}>
          {DRAW_COLORS.map((c) => (
            <ColorSwatch
              key={c}
              component="button"
              type="button"
              color={c}
              size={20}
              role="radio"
              aria-checked={drawColor === c}
              aria-label={c}
              onClick={() => useApp.setState({ drawColor: c })}
              style={{ cursor: "pointer", outline: drawColor === c ? "2px solid var(--mantine-color-bronze-4)" : undefined, outlineOffset: 2 }}
            />
          ))}
        </Group>
        )}
        <SegmentedControl
          size="xs"
          data={(Object.keys(WIDTHS) as (keyof typeof WIDTHS)[]).map((k) => ({ value: String(WIDTHS[k]), label: t(erasing ? `draw.eraser.${k}` : `draw.width.${k}`) }))}
          value={String(drawWidth)}
          onChange={(v) => useApp.setState({ drawWidth: Number(v) })}
          aria-label={t(erasing ? "draw.eraserLabel" : "draw.widthLabel")}
        />
      </Group>
      <Group gap="xs" wrap="wrap" justify="space-between" mt={6}>
        {gm ? (
          <Tooltip label={t("draw.hiddenTip")}>
            <Checkbox size="xs" label={t("draw.hidden")} checked={drawHidden} onChange={(e) => useApp.setState({ drawHidden: e.currentTarget.checked })} />
          </Tooltip>
        ) : (
          <span />
        )}
        <Group gap={4} wrap="nowrap">
          <Button
            size="compact-xs"
            variant="default"
            disabled={mine.length === 0}
            leftSection={<IconArrowBackUp size={12} />}
            onClick={() => act("draw:remove", { id: mine[mine.length - 1].id })}
          >
            {t("draw.undo")}
          </Button>
          <Button size="compact-xs" variant="subtle" color="red" disabled={mine.length === 0} leftSection={<IconTrash size={12} />} onClick={() => void clearAll()}>
            {t(gm ? "draw.clear" : "draw.clearMine")}
          </Button>
        </Group>
      </Group>
      <Text size="xs" c="dimmed" mt={4}>
        {t(erasing ? (gm ? "draw.hintErase" : "draw.hintEraseMine") : gm ? "draw.hint" : "draw.hintArrows")}
      </Text>
    </Paper>
  );
}
