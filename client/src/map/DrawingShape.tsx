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

/** Ferramenta de desenho: um dos formatos ou a borracha (clicar num desenho apaga). */
export type DrawMode = DrawingKind | "erase";

const MODE_LABEL: Record<DrawMode, MessageKey> = {
  free: "draw.free",
  arrow: "draw.arrow",
  circle: "draw.circle",
  erase: "draw.erase",
};

/** Um desenho do mestre. Oculto (só o mestre vê): tracejado e mais apagado. */
export function DrawingShape({ d, onErase }: { d: Pick<Drawing, "kind" | "points" | "color" | "width" | "hidden">; onErase?: () => void }) {
  const common = {
    stroke: d.color,
    strokeWidth: d.width,
    opacity: d.hidden ? 0.55 : 0.9,
    dash: d.hidden ? [d.width * 2, d.width * 1.5] : undefined,
    lineCap: "round" as const,
    lineJoin: "round" as const,
    // Borracha: área de clique maior que o traço.
    hitStrokeWidth: Math.max(16, d.width + 10),
    onClick: onErase,
    onTap: onErase,
  };
  const [x0, y0, x1, y1] = d.points;
  if (d.kind === "circle") return <Circle x={x0} y={y0} radius={Math.hypot(x1 - x0, y1 - y0)} {...common} />;
  if (d.kind === "arrow") return <Arrow points={d.points} fill={d.color} pointerLength={d.width * 3} pointerWidth={d.width * 3} {...common} />;
  return <Line points={d.points} tension={0.4} {...common} />;
}

/** Opções do desenho (embaixo do mapa, como as da área): formato, cor, espessura, só eu vejo, desfazer e apagar. */
export function DrawOptions({ drawings }: { drawings: Drawing[] }) {
  const t = useT();
  const { drawMode, drawColor, drawWidth, drawHidden } = useApp();

  async function clearAll() {
    const ok = await confirmAction({ title: t("draw.clearTitle"), message: t("draw.clearMessage"), confirmLabel: t("draw.clear") });
    if (ok) void act("draw:clear", {});
  }

  return (
    <Paper className="map-options" p="xs" shadow="md" radius="md">
      <Group gap="xs" wrap="wrap" align="center">
        <SegmentedControl
          size="xs"
          data={(Object.keys(MODE_LABEL) as DrawMode[]).map((m) => ({ value: m, label: t(MODE_LABEL[m]) }))}
          value={drawMode}
          onChange={(v) => useApp.setState({ drawMode: v as DrawMode })}
          aria-label={t("draw.mode")}
        />
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
        <SegmentedControl
          size="xs"
          data={(Object.keys(WIDTHS) as (keyof typeof WIDTHS)[]).map((k) => ({ value: String(WIDTHS[k]), label: t(`draw.width.${k}`) }))}
          value={String(drawWidth)}
          onChange={(v) => useApp.setState({ drawWidth: Number(v) })}
          aria-label={t("draw.widthLabel")}
        />
      </Group>
      <Group gap="xs" wrap="wrap" justify="space-between" mt={6}>
        <Tooltip label={t("draw.hiddenTip")}>
          <Checkbox size="xs" label={t("draw.hidden")} checked={drawHidden} onChange={(e) => useApp.setState({ drawHidden: e.currentTarget.checked })} />
        </Tooltip>
        <Group gap={4} wrap="nowrap">
          <Button
            size="compact-xs"
            variant="default"
            disabled={drawings.length === 0}
            leftSection={<IconArrowBackUp size={12} />}
            onClick={() => act("draw:remove", { id: drawings[drawings.length - 1].id })}
          >
            {t("draw.undo")}
          </Button>
          <Button size="compact-xs" variant="subtle" color="red" disabled={drawings.length === 0} leftSection={<IconTrash size={12} />} onClick={() => void clearAll()}>
            {t("draw.clear")}
          </Button>
        </Group>
      </Group>
      <Text size="xs" c="dimmed" mt={4}>
        {t(drawMode === "erase" ? "draw.hintErase" : "draw.hint")}
      </Text>
    </Paper>
  );
}
