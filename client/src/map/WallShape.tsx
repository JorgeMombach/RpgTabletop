import { Button, Center, Checkbox, Box, Group, SegmentedControl, Select, Slider, Stack, Text, Tooltip, VisuallyHidden } from "@mantine/core";
import { IconArrowBackUp, IconBrush, IconDoor, IconEraser, IconTrash, IconWall, IconWindow } from "@tabler/icons-react";
import type Konva from "konva";
import { Shape as KShape } from "react-konva";
import { isHex, seeThrough, wallAnchor, wallSeed, WALL_STYLES, WALL_THICKNESS, type DoorLayout, type GridPos, type MapConfig, type Wall, type WallStyle } from "@rpg/shared";
import { useEffect, useRef } from "react";
import { act } from "../actions";
import { confirmAction } from "../confirm";
import { useT, type MessageKey } from "../i18n";
import { useApp } from "../store";
import { toCellUnits, type Point } from "./geometry";
import { drawDoor, drawOpeningSelection, drawWindow, wallArt } from "./wallArt";
import { removeWall, restyleWalls, undo, useMapUndo } from "./mapHistory";
import { useShallow } from "zustand/react/shallow";

/** Ferramenta Paredes: traçar parede, traçar porta (ou escolher uma para trancar/esconder), trocar o desenho ou apagar. */
export type WallMode = "wall" | "door" | "window" | "restyle" | "erase";

const MODE_LABEL: Record<WallMode, MessageKey> = { wall: "walls.wall", door: "walls.door", window: "walls.window", restyle: "walls.restyle", erase: "walls.erase" };
const MODE_ICON: Record<WallMode, typeof IconWall> = { wall: IconWall, door: IconDoor, window: IconWindow, restyle: IconBrush, erase: IconEraser };

/** Modos que traçam (parede, porta, janela): mostram o encaixe e a espessura. */
const tracing = (mode: WallMode) => mode === "wall" || mode === "door" || mode === "window";
export const STYLE_LABEL: Record<WallStyle, MessageKey> = {
  stone: "walls.styleStone",
  rock: "walls.styleRock",
  wood: "walls.styleWood",
  brick: "walls.styleBrick",
  palisade: "walls.stylePalisade",
  rampart: "walls.styleRampart",
  fence: "walls.styleFence",
  iron: "walls.styleIron",
  barbed: "walls.styleBarbed",
  hedge: "walls.styleHedge",
  lowstone: "walls.styleLowstone",
};
const SCENE = "__cena";

/** Onde a ponta encaixa (em pixels do mapa): o canto do quadrado ou, no hex (Passo 16), o vértice ou o meio do lado. */
export function cornerAt(p: Point, g: MapConfig): GridPos {
  const anchor = wallAnchor(toCellUnits(p, g), g.grid);
  return { col: anchor.x, row: anchor.y };
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
 * Parede (no desenho dela, ou no da cena) ou porta de madeira com cintas de ferro (portão, na cerca e na grade).
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
  standalone,
  gpu,
}: {
  w: Pick<Wall, "from" | "to" | "door" | "window" | "thickness">;
  grid: MapConfig;
  gm: boolean;
  style: WallStyle;
  layout?: DoorLayout;
  selected?: boolean;
  onClick?: () => void;
  /** Parede comum desenhada sozinha (prévia do traço); no mapa, quem desenha é `WallChains`. */
  standalone?: boolean;
  /** Portas e janelas vêm da placa de vídeo: aqui, só a área de clique e o contorno de escolhida. */
  gpu?: boolean;
}) {
  const a = cornerPx(w.from, grid);
  const b = cornerPx(w.to, grid);
  const thick = grid.cellPx * (w.thickness ?? WALL_THICKNESS.default);
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
        if (gpu && (w.window || door)) {
          if (selected) drawOpeningSelection(ctx, L, thick);
        } else if (w.window) {
          drawWindow(ctx, L, thick, { closed: !!w.window.closed, selected: !!selected, style });
        } else if (door) {
          drawDoor(ctx, L, thick, seed, {
            open: door.open,
            locked: gm && !!door.locked,
            secret: gm && !!door.secret,
            selected: !!selected,
            swing: layout?.swing ?? 1,
            style,
          });
        } else if (standalone) {
          const m = ctx.getTransform();
          const art = wallArt(style, L, thick, seed, Math.hypot(m.a, m.b), grid.cellPx);
          ctx.drawImage(art.canvas, -art.pad, -art.pad, L + art.pad * 2, art.pad * 2);
        }
        ctx.restore();
      }}
    />
  );
}

/** Parede sendo traçada (antes de soltar). */
export function WallPreview({ from, to, opening, grid, style }: { from: GridPos; to: GridPos; opening: "door" | "window" | null; grid: MapConfig; style: WallStyle }) {
  const thickness = useApp((s) => s.wallThick);
  return <WallShape w={{ from, to, thickness, door: opening === "door" ? { open: false } : undefined, window: opening === "window" ? {} : undefined }} grid={grid} gm style={style} selected standalone />;
}

/** Amostra do desenho de parede (lista de desenhos): um trecho curto desenhado de verdade. */
function WallSwatch({ style }: { style: WallStyle }) {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const c = ref.current;
    if (!c) return;
    const dpr = window.devicePixelRatio || 1;
    const ctx = c.getContext("2d")!;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, 48, 20);
    const t = 5.5;
    const art = wallArt(style, 40, t, 7, dpr, 20);
    ctx.drawImage(art.canvas, 4 - art.pad, 10 - art.pad, 40 + art.pad * 2, art.pad * 2);
  }, [style]);
  return <canvas ref={ref} width={96} height={40} style={{ width: 48, height: 20, flex: "none" }} aria-hidden />;
}

/** Opções da ferramenta Paredes (mestre): modo, desenho, traço, a porta escolhida (aberta, trancada, secreta), desfazer e apagar tudo. */
export function WallOptions({ walls, style }: { walls: Wall[]; style: WallStyle }) {
  const t = useT();
  const { wallMode, wallSnap, wallThick, selectedDoorId, wallDrawStyle } = useApp(useShallow((s) => ({ wallMode: s.wallMode, wallSnap: s.wallSnap, wallThick: s.wallThick, selectedDoorId: s.selectedDoorId, wallDrawStyle: s.wallDrawStyle })));
  const undoCount = useMapUndo((s) => s.walls);
  // No hex, as pontas encaixam nos vértices e meios de lado (não há "canto do grid").
  const hex = useApp((s) => !!s.state && isHex(s.state.battle.map));
  const door = walls.find((w) => w.id === selectedDoorId && w.door);
  const pane = walls.find((w) => w.id === selectedDoorId && w.window);

  async function clearAll() {
    const ok = await confirmAction({ title: t("walls.clearTitle"), message: t("walls.clearMessage"), confirmLabel: t("walls.clear") });
    if (ok) void act("wall:clear", {});
  }

  return (
    <Box>
      <Stack gap={6}>
        <SegmentedControl
          size="xs"
          fullWidth
          // Cinco modos não cabem por extenso na coluna estreita: ícone com dica (e o nome para leitor de tela).
          data={(Object.keys(MODE_LABEL) as WallMode[]).map((m) => {
            const Icon = MODE_ICON[m];
            return {
              value: m,
              label: (
                <Tooltip label={t(MODE_LABEL[m])}>
                  <Center>
                    <Icon size={16} />
                    <VisuallyHidden>{t(MODE_LABEL[m])}</VisuallyHidden>
                  </Center>
                </Tooltip>
              ),
            };
          })}
          value={wallMode}
          onChange={(v) => useApp.setState({ wallMode: v as WallMode, selectedDoorId: null })}
          aria-label={t("walls.mode")}
        />
        {tracing(wallMode) && (
          <SegmentedControl
            size="xs"
            fullWidth
            data={[
              { value: "snap", label: t("walls.snap") },
              { value: "free", label: t("walls.free") },
            ]}
            value={wallSnap ? "snap" : "free"}
            onChange={(v) => useApp.setState({ wallSnap: v === "snap" })}
            aria-label={t("walls.snapLabel")}
          />
        )}
        {tracing(wallMode) && !wallSnap && (
          <Text size="xs" c="dimmed">
            {t("walls.freeHint")}
          </Text>
        )}
        <Group gap={4} wrap="nowrap" justify="space-between">
          <Tooltip label={t("walls.undoTip")}>
            <Button size="compact-xs" variant="default" disabled={undoCount === 0} leftSection={<IconArrowBackUp size={12} />} onClick={() => void undo("walls")}>
              {t("walls.undo")}
            </Button>
          </Tooltip>
          <Button size="compact-xs" variant="subtle" color="red" disabled={walls.length === 0} leftSection={<IconTrash size={12} />} onClick={() => void clearAll()}>
            {t("walls.clear")}
          </Button>
        </Group>
      </Stack>
      {tracing(wallMode) && (
        <Group gap="xs" mt={6} wrap="nowrap">
          <Text size="xs" c="dimmed" style={{ flex: "none" }}>
            {t("walls.thickness")}
          </Text>
          <Slider
            size="xs"
            style={{ flex: 1, minWidth: 100 }}
            min={WALL_THICKNESS.min}
            max={WALL_THICKNESS.max}
            step={0.02}
            value={wallThick}
            onChange={(v) => useApp.setState({ wallThick: v })}
            label={(v) => t("walls.thicknessValue", { n: v.toFixed(2).replace(".", ",") })}
            aria-label={t("walls.thickness")}
          />
        </Group>
      )}
      {wallMode !== "erase" && (
        <Group gap="xs" mt={6} wrap="nowrap">
          <Text size="xs" c="dimmed" style={{ flex: "none" }}>
            {t("walls.style")}
          </Text>
          <Select
            size="xs"
            style={{ flex: 1, minWidth: 0 }}
            data={[{ value: SCENE, label: t("walls.sceneStyle", { style: t(STYLE_LABEL[style]) }) }, ...WALL_STYLES.map((s) => ({ value: s, label: t(STYLE_LABEL[s]) }))]}
            value={wallDrawStyle ?? SCENE}
            onChange={(v) => v && useApp.setState({ wallDrawStyle: v === SCENE ? null : (v as WallStyle) })}
            allowDeselect={false}
            leftSection={<WallSwatch style={wallDrawStyle ?? style} />}
            leftSectionWidth={56}
            renderOption={({ option }) => {
              const s = option.value === SCENE ? style : (option.value as WallStyle);
              return (
                <Group gap="xs" wrap="nowrap">
                  <WallSwatch style={s} />
                  <Text size="sm">{option.label}</Text>
                  {seeThrough(s) && (
                    <Text size="xs" c="dimmed">
                      {t("walls.seeThrough")}
                    </Text>
                  )}
                </Group>
              );
            }}
            comboboxProps={{ withinPortal: true }}
            aria-label={t("walls.style")}
          />
          {wallMode === "restyle" && (
            <Tooltip label={t("walls.restyleAllTip")}>
              <Button size="compact-xs" variant="default" leftSection={<IconBrush size={12} />} disabled={walls.length === 0} onClick={() => void restyleWalls(walls.map((w) => w.id), wallDrawStyle)}>
                {t("walls.restyleAll")}
              </Button>
            </Tooltip>
          )}
        </Group>
      )}
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
      ) : pane?.window ? (
        <Group gap="xs" mt={6} justify="space-between">
          <Checkbox size="xs" label={t("walls.shutter")} checked={!!pane.window.closed} onChange={(e) => act("window:set", { id: pane.id, closed: e.currentTarget.checked })} />
          <Button
            size="compact-xs"
            variant="subtle"
            color="red"
            onClick={() => {
              void removeWall(pane);
              useApp.setState({ selectedDoorId: null });
            }}
          >
            {t("walls.removeWindow")}
          </Button>
        </Group>
      ) : (
        <Text size="xs" c="dimmed" mt={4}>
          {t(wallMode === "erase" ? "walls.hintErase" : wallMode === "restyle" ? "walls.hintRestyle" : wallMode === "door" ? "walls.hintDoor" : wallMode === "window" ? "walls.hintWindow" : wallSnap ? (hex ? "walls.hintWallHex" : "walls.hintWall") : "walls.hintWallFree")}
        </Text>
      )}
    </Box>
  );
}
