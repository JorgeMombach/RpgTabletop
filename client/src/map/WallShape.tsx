import { Button, Checkbox, Group, Paper, SegmentedControl, Stack, Text, Tooltip } from "@mantine/core";
import { IconArrowBackUp, IconTrash } from "@tabler/icons-react";
import type Konva from "konva";
import { Shape as KShape } from "react-konva";
import { WALL_STYLES, type GridPos, type MapConfig, type Wall, type WallStyle } from "@rpg/shared";
import { act } from "../actions";
import { confirmAction } from "../confirm";
import { useT, type MessageKey } from "../i18n";
import { useApp } from "../store";
import type { Point } from "./geometry";
import { drawDoor, wallArt, wallSeed } from "./wallArt";
import { removeWall, undoWall, useWallUndo } from "./wallHistory";

/** Ferramenta Paredes: traçar parede, traçar porta (ou escolher uma para trancar/esconder) ou apagar. */
export type WallMode = "wall" | "door" | "erase";

const MODE_LABEL: Record<WallMode, MessageKey> = { wall: "walls.wall", door: "walls.door", erase: "walls.erase" };
const STYLE_LABEL: Record<WallStyle, MessageKey> = { stone: "walls.styleStone", rock: "walls.styleRock", wood: "walls.styleWood" };

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

/** Como a porta abre: dobradiça na ponta `to` em vez de `from` e para que lado a folha gira. */
export interface DoorLayout {
  hingeAtTo: boolean;
  swing: number;
}

const near = (p: GridPos, q: GridPos) => Math.abs(p.col - q.col) < 0.02 && Math.abs(p.row - q.row) < 0.02;

/**
 * Portas duplas (L5): duas portas em linha que se encostam numa ponta. As dobradiças ficam nas pontas de
 * fora e as duas folhas giram para o mesmo lado, cada uma para a sua ponta. Porta sozinha: dobradiça em `from`.
 */
export function doorLayouts(walls: Wall[]): Map<string, DoorLayout> {
  const doors = walls.filter((w) => w.door);
  const out = new Map<string, DoorLayout>();
  for (let i = 0; i < doors.length; i++) {
    const a = doors[i];
    if (out.has(a.id)) continue;
    for (let j = i + 1; j < doors.length; j++) {
      const b = doors[j];
      if (out.has(b.id)) continue;
      const shared = [a.from, a.to].find((p) => near(p, b.from) || near(p, b.to));
      if (!shared) continue;
      // Em linha: as duas direções são paralelas.
      const da = { x: a.to.col - a.from.col, y: a.to.row - a.from.row };
      const db = { x: b.to.col - b.from.col, y: b.to.row - b.from.row };
      const cross = da.x * db.y - da.y * db.x;
      if (Math.abs(cross) > 0.02 * Math.hypot(da.x, da.y) * Math.hypot(db.x, db.y)) continue;
      // A dobradiça é a ponta que não é a do meio; as direções (dobradiça → meio) são opostas, então os
      // giros têm sinais opostos para as folhas irem para o mesmo lado.
      out.set(a.id, { hingeAtTo: near(a.from, shared), swing: 1 });
      out.set(b.id, { hingeAtTo: near(b.from, shared), swing: -1 });
      break;
    }
  }
  return out;
}

/**
 * Parede (no estilo da cena: pedra lavrada, rocha bruta ou madeira) ou porta de madeira com cintas de ferro.
 * Aberta, a folha gira na dobradiça e deixa a passagem livre. Mestre: trancada com cadeado vermelho, secreta
 * translúcida e tracejada. A espessura acompanha o tamanho do quadrado.
 */
export function WallShape({
  w,
  grid,
  gm,
  style,
  layout,
  selected,
  onClick,
}: {
  w: Pick<Wall, "from" | "to" | "door">;
  grid: MapConfig;
  gm: boolean;
  style: WallStyle;
  layout?: DoorLayout;
  selected?: boolean;
  onClick?: () => void;
}) {
  const a = cornerPx(w.from, grid);
  const b = cornerPx(w.to, grid);
  const thick = grid.cellPx * 0.18;
  const handlers = onClick ? { onClick, onTap: onClick } : {};
  const seed = wallSeed(w.from.col, w.from.row, w.to.col, w.to.row);
  // Área de clique: a linha da parede (ou o vão da porta), bem mais grossa que o desenho.
  const hit = (k: Konva.Context, shape: Konva.Shape) => {
    k.beginPath();
    k.moveTo(a.x, a.y);
    k.lineTo(b.x, b.y);
    k.fillStrokeShape(shape);
  };
  const door = w.door;
  const [h, e] = layout?.hingeAtTo ? [b, a] : [a, b];
  return (
    <KShape
      {...handlers}
      stroke="#000"
      strokeWidth={thick}
      hitStrokeWidth={thick * (door ? 2.4 : 1) + grid.cellPx * 0.2}
      hitFunc={hit}
      sceneFunc={(kctx) => {
        const ctx = kctx._context;
        const L = Math.hypot(e.x - h.x, e.y - h.y);
        if (L < 0.5) return;
        ctx.save();
        ctx.translate(h.x, h.y);
        ctx.rotate(Math.atan2(e.y - h.y, e.x - h.x));
        if (door) {
          drawDoor(ctx, L, thick, seed, {
            open: door.open,
            locked: gm && !!door.locked,
            secret: gm && !!door.secret,
            selected: !!selected,
            swing: layout?.swing ?? 1,
            style,
          });
        } else {
          const m = ctx.getTransform();
          const art = wallArt(style, L, thick, seed, Math.hypot(m.a, m.b));
          ctx.drawImage(art.canvas, -art.pad, -art.pad, L + art.pad * 2, art.pad * 2);
        }
        ctx.restore();
      }}
    />
  );
}

/** Parede sendo traçada (antes de soltar). */
export function WallPreview({ from, to, door, grid, style }: { from: GridPos; to: GridPos; door: boolean; grid: MapConfig; style: WallStyle }) {
  return <WallShape w={{ from, to, door: door ? { open: false } : undefined }} grid={grid} gm style={style} selected />;
}

/** Opções da ferramenta Paredes (mestre): modo, traço, estilo da cena, a porta escolhida (aberta, trancada, secreta), desfazer e apagar tudo. */
export function WallOptions({ walls, style }: { walls: Wall[]; style: WallStyle }) {
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
      <Group gap="xs" mt={6} wrap="nowrap">
        <Text size="xs" c="dimmed">
          {t("walls.style")}
        </Text>
        <SegmentedControl
          size="xs"
          data={WALL_STYLES.map((s) => ({ value: s, label: t(STYLE_LABEL[s]) }))}
          value={style}
          onChange={(v) => void act("battle:grid", { wallStyle: v as WallStyle })}
          aria-label={t("walls.style")}
        />
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
