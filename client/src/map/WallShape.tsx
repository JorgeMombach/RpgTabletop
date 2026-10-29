import { Button, Checkbox, Group, Paper, SegmentedControl, Stack, Text, Tooltip } from "@mantine/core";
import { IconArrowBackUp, IconTrash } from "@tabler/icons-react";
import { Group as KGroup, Line, Rect } from "react-konva";
import type { GridPos, MapConfig, Wall } from "@rpg/shared";
import { act } from "../actions";
import { confirmAction } from "../confirm";
import { useT, type MessageKey } from "../i18n";
import { useApp } from "../store";
import type { Point } from "./geometry";
import { removeWall, undoWall, useWallUndo } from "./wallHistory";

/** Ferramenta Paredes: traçar parede, traçar porta (ou escolher uma para trancar/esconder) ou apagar. */
export type WallMode = "wall" | "door" | "erase";

const MODE_LABEL: Record<WallMode, MessageKey> = { wall: "walls.wall", door: "walls.door", erase: "walls.erase" };

// Pedra clara com borda escura; porta de madeira com moldura de bronze (cores do guia visual).
const STONE = "#c9b79a";
const STONE_EDGE = "#17141c";
const WOOD = "#8b5a2b";
const BRONZE = "#d8b47a";
const LOCKED = "#c94a52";
const SECRET = "#a58fd6";

/** Canto do grid mais perto do ponto (em pixels do mapa). */
export function cornerAt(p: Point, g: MapConfig): GridPos {
  return { col: Math.round((p.x - g.offsetX) / g.cellPx), row: Math.round((p.y - g.offsetY) / g.cellPx) };
}

/** Ponta da parede no ponto: o canto mais perto ou, no traço livre, o próprio ponto (em centésimos de casa). */
export function wallPointAt(p: Point, g: MapConfig, snap: boolean): GridPos {
  if (snap) return cornerAt(p, g);
  const cent = (n: number) => Math.round(n * 100) / 100;
  return { col: cent((p.x - g.offsetX) / g.cellPx), row: cent((p.y - g.offsetY) / g.cellPx) };
}

/** Tamanho do traço (em casas, no eixo mais longo): abaixo de 0,1 é clique, não parede (o servidor recusa). */
export function wallSpan(from: GridPos, to: GridPos): number {
  return Math.max(Math.abs(to.col - from.col), Math.abs(to.row - from.row));
}

function cornerPx(c: GridPos, g: MapConfig): Point {
  return { x: g.offsetX + c.col * g.cellPx, y: g.offsetY + c.row * g.cellPx };
}

/**
 * Parede (linha de pedra) ou porta: fechada é uma folha de madeira na linha; aberta, a folha gira 90°
 * na dobradiça (ponta \`from\`) e deixa a passagem livre. Mestre: trancada com borda vermelha, secreta tracejada.
 */
export function WallShape({
  w,
  grid,
  gm,
  selected,
  onClick,
}: {
  w: Pick<Wall, "from" | "to" | "door">;
  grid: MapConfig;
  gm: boolean;
  selected?: boolean;
  onClick?: () => void;
}) {
  const a = cornerPx(w.from, grid);
  const b = cornerPx(w.to, grid);
  const thick = Math.max(5, grid.cellPx * 0.14);
  const handlers = onClick ? { onClick, onTap: onClick } : {};
  if (!w.door) {
    return (
      <KGroup {...handlers}>
        <Line points={[a.x, a.y, b.x, b.y]} stroke={STONE_EDGE} strokeWidth={thick + 4} lineCap="round" hitStrokeWidth={thick + 14} />
        <Line points={[a.x, a.y, b.x, b.y]} stroke={STONE} strokeWidth={thick} lineCap="round" listening={false} />
      </KGroup>
    );
  }
  const { open, locked, secret } = w.door;
  const len = Math.hypot(b.x - a.x, b.y - a.y);
  const angle = (Math.atan2(b.y - a.y, b.x - a.x) * 180) / Math.PI;
  // Folha mais grossa que a parede, em madeira: dá para ver de longe que ali é porta.
  const leaf = thick * 1.6;
  const frame = gm && locked ? LOCKED : selected ? "#ffffff" : BRONZE;
  return (
    <KGroup x={a.x} y={a.y} rotation={angle} opacity={gm && secret ? 0.7 : 1} {...handlers}>
      {/* Área de clique: o vão inteiro, aberta ou fechada. */}
      <Rect x={0} y={-leaf} width={len} height={leaf * 2} fill="transparent" />
      {/* Batentes nas pontas. */}
      <Line points={[0, -leaf, 0, leaf]} stroke={STONE} strokeWidth={thick * 0.6} lineCap="round" listening={false} />
      <Line points={[len, -leaf, len, leaf]} stroke={STONE} strokeWidth={thick * 0.6} lineCap="round" listening={false} />
      <Rect
        x={0}
        y={-leaf / 2}
        width={len}
        height={leaf}
        rotation={open ? 75 : 0}
        fill={WOOD}
        stroke={gm && secret ? SECRET : frame}
        strokeWidth={selected ? 3 : 1.5}
        dash={gm && secret ? [6, 4] : undefined}
        cornerRadius={2}
        listening={false}
      />
    </KGroup>
  );
}

/** Parede sendo traçada (antes de soltar). */
export function WallPreview({ from, to, door, grid }: { from: GridPos; to: GridPos; door: boolean; grid: MapConfig }) {
  return <WallShape w={{ from, to, door: door ? { open: false } : undefined }} grid={grid} gm selected />;
}

/** Opções da ferramenta Paredes (mestre): modo, a porta escolhida (aberta, trancada, secreta) e apagar tudo. */
export function WallOptions({ walls }: { walls: Wall[] }) {
  const t = useT();
  const { wallMode, wallSnap, selectedDoorId } = useApp();
  const undoCount = useWallUndo((s) => s.count);
  const door = walls.find((w) => w.id === selectedDoorId && w.door);

  async function clearAll() {
    const ok = await confirmAction({ title: t("walls.clearTitle"), message: t("walls.clearMessage"), confirmLabel: t("walls.clear") });
    if (ok) void act("wall:clear", {});
  }

  return (
    <Paper className="map-options" p="xs" shadow="md" radius="md">
      <Group gap="xs" wrap="wrap" justify="space-between">
        <SegmentedControl
          size="xs"
          data={(Object.keys(MODE_LABEL) as WallMode[]).map((m) => ({ value: m, label: t(MODE_LABEL[m]) }))}
          value={wallMode}
          onChange={(v) => useApp.setState({ wallMode: v as WallMode, selectedDoorId: null })}
          aria-label={t("walls.mode")}
        />
        {wallMode !== "erase" && (
          <SegmentedControl
            size="xs"
            data={[
              { value: "snap", label: t("walls.snap") },
              { value: "free", label: t("walls.free") },
            ]}
            value={wallSnap ? "snap" : "free"}
            onChange={(v) => useApp.setState({ wallSnap: v === "snap" })}
            aria-label={t("walls.snapLabel")}
          />
        )}
        <Group gap={4} wrap="nowrap">
          <Tooltip label={t("walls.undoTip")}>
            <Button size="compact-xs" variant="default" disabled={undoCount === 0} leftSection={<IconArrowBackUp size={12} />} onClick={() => void undoWall()}>
              {t("walls.undo")}
            </Button>
          </Tooltip>
          <Button size="compact-xs" variant="subtle" color="red" disabled={walls.length === 0} leftSection={<IconTrash size={12} />} onClick={() => void clearAll()}>
            {t("walls.clear")}
          </Button>
        </Group>
      </Group>
      {door?.door ? (
        <Stack gap={4} mt={6}>
          <Group gap="md" wrap="wrap">
            <Checkbox size="xs" label={t("walls.open")} checked={door.door.open} onChange={(e) => act("door:set", { id: door.id, open: e.currentTarget.checked })} />
            <Checkbox size="xs" label={t("walls.locked")} checked={!!door.door.locked} onChange={(e) => act("door:set", { id: door.id, locked: e.currentTarget.checked })} />
            <Checkbox size="xs" label={t("walls.secret")} checked={!!door.door.secret} onChange={(e) => act("door:set", { id: door.id, secret: e.currentTarget.checked })} />
          </Group>
          <Group gap="xs" justify="space-between">
            <Text size="xs" c="dimmed">
              {t("walls.doorTip")}
            </Text>
            <Button
              size="compact-xs"
              variant="subtle"
              color="red"
              onClick={() => {
                void removeWall(door);
                useApp.setState({ selectedDoorId: null });
              }}
            >
              {t("walls.removeDoor")}
            </Button>
          </Group>
        </Stack>
      ) : (
        <Text size="xs" c="dimmed" mt={4}>
          {t(wallMode === "erase" ? "walls.hintErase" : wallMode === "door" ? "walls.hintDoor" : wallSnap ? "walls.hintWall" : "walls.hintWallFree")}
        </Text>
      )}
    </Paper>
  );
}
