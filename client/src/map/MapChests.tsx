import { ActionIcon, Box, Button, Checkbox, Group as MGroup, Modal, NumberInput, Paper, SegmentedControl, Stack, Text, TextInput, Tooltip } from "@mantine/core";
import { IconArrowBackUp, IconPlus, IconTrash, IconX } from "@tabler/icons-react";
import { useEffect, useRef, useState } from "react";
import { Layer, Shape } from "react-konva";
import { CHEST_STYLES, COINS, LIMITS, type ChestStyle, type Coin, type LootInput, type MapChest, type MapConfig } from "@rpg/shared";
import { act } from "../actions";
import { useT, type MessageKey } from "../i18n";
import { useApp } from "../store";
import { drawChest, type ChestState } from "./chestArt";
import { cellAt } from "./geometry";
import { moveChest, removeChest, undo, useMapUndo } from "./mapHistory";

export const CHEST_LABEL: Record<ChestStyle, MessageKey> = { wood: "chests.wood", iron: "chests.iron", ornate: "chests.ornate" };

/** Como o baú aparece: invisível (só o mestre), aberto com ou sem loot, trancado ou fechado. */
export function chestState(c: MapChest): ChestState {
  if (c.hidden) return "hidden";
  if (c.opened) return c.loot.length > 0 ? "open" : "empty";
  return c.locked ? "locked" : "closed";
}

/** Um baú no mapa, na base da casa. Com a ferramenta Baús, o mestre arrasta para outra casa ou clica para editar. */
/** Abrir o baú (clique fora da ferramenta Baús): na primeira vez abre para todos; depois só mostra a janela. */
async function openChest(c: MapChest) {
  if (!c.opened) {
    const res = await act("chest:open", { id: c.id });
    if (!res.ok) return;
  }
  useApp.setState({ lootChestId: c.id });
}

function ChestShape({ c, grid, editing, clickable }: { c: MapChest; grid: MapConfig; editing: boolean; clickable: boolean }) {
  const s = grid.cellPx;
  const x = grid.offsetX + (c.col + 0.5) * s;
  const y = grid.offsetY + (c.row + 0.92) * s;
  // O Konva solta um clique no fim do arrasto: esse não abre o editor.
  const dragged = useRef(false);
  const edit = () => {
    if (dragged.current) return;
    if (editing) useApp.setState({ editingChestId: c.id });
    else void openChest(c);
  };
  return (
    <Shape
      name="map-chest"
      id={c.id}
      x={x}
      y={y}
      fill="#000"
      draggable={editing}
      listening={editing || clickable}
      onMouseEnter={(e) => {
        const stage = e.target.getStage();
        if (stage) stage.container().style.cursor = "pointer";
      }}
      onMouseLeave={(e) => {
        const stage = e.target.getStage();
        if (stage) stage.container().style.cursor = "";
      }}
      onClick={edit}
      onTap={edit}
      onDragStart={() => {
        dragged.current = true;
      }}
      onDragEnd={(e) => {
        // Só o clique deste mesmo soltar é ignorado (quando o Konva manda um).
        window.setTimeout(() => (dragged.current = false), 0);
        const node = e.target;
        // Encaixa na casa onde soltou (a base do desenho fica embaixo da casa).
        const cell = cellAt({ x: node.x(), y: node.y() - s * 0.42 }, grid);
        node.position({ x, y });
        if (cell.col !== c.col || cell.row !== c.row) void moveChest(c, cell.col, cell.row);
      }}
      hitFunc={(k, shape) => {
        k.beginPath();
        k.rect(-s * 0.45, -s * 0.85, s * 0.9, s * 0.9);
        k.closePath();
        k.fillStrokeShape(shape);
      }}
      sceneFunc={(k) => drawChest(k._context as CanvasRenderingContext2D, c.style, 0, 0, s, chestState(c))}
    />
  );
}

/** Baús da cena: abaixo da névoa (coberto, o jogador nem recebe). Com Mover, clicar abre o baú (janela de loot). */
export function MapChestLayer({ chests, grid, editing, clickable }: { chests: MapChest[]; grid: MapConfig; editing: boolean; clickable: boolean }) {
  if (chests.length === 0) return null;
  return (
    <Layer listening={editing || clickable}>
      {chests.map((c) => (
        <ChestShape key={c.id} c={c} grid={grid} editing={editing} clickable={clickable} />
      ))}
    </Layer>
  );
}

/** O desenho do baú no seletor. */
export function ChestIcon({ style, state = "closed", size = 36 }: { style: ChestStyle; state?: ChestState; size?: number }) {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const ctx = ref.current?.getContext("2d");
    if (!ctx) return;
    ctx.setTransform(2, 0, 0, 2, 0, 0);
    ctx.clearRect(0, 0, size, size);
    drawChest(ctx, style, size / 2, size * 0.9, size * 0.95, state);
  }, [style, state, size]);
  return <canvas ref={ref} width={size * 2} height={size * 2} style={{ width: size, height: size, display: "block" }} aria-hidden />;
}

/** Opções da ferramenta Baús (mestre): o desenho do próximo baú e desfazer. */
export function MapChestOptions() {
  const t = useT();
  const chestStyle = useApp((s) => s.chestStyle);
  const undoCount = useMapUndo((s) => s.chests);
  return (
    <Box>
      <MGroup gap="xs" wrap="wrap" align="center" justify="space-between">
        <MGroup gap={4} wrap="nowrap" role="radiogroup" aria-label={t("chests.pick")}>
          {CHEST_STYLES.map((style) => (
            <Tooltip key={style} label={t(CHEST_LABEL[style])}>
              <ActionIcon
                size={44}
                variant={chestStyle === style ? "light" : "subtle"}
                color={chestStyle === style ? undefined : "gray"}
                role="radio"
                aria-checked={chestStyle === style}
                aria-label={t(CHEST_LABEL[style])}
                onClick={() => useApp.setState({ chestStyle: style })}
              >
                <ChestIcon style={style} />
              </ActionIcon>
            </Tooltip>
          ))}
        </MGroup>
        <Tooltip label={t("chests.undoTip")}>
          <Button size="compact-xs" variant="default" disabled={undoCount === 0} leftSection={<IconArrowBackUp size={12} />} onClick={() => void undo("chests")}>
            {t("walls.undo")}
          </Button>
        </Tooltip>
      </MGroup>
      <Text size="xs" c="dimmed" mt={4}>
        {t("chests.hint")}
      </Text>
    </Box>
  );
}

/** Loot no formulário: campos como digitados. */
type Row =
  | { kind: "coins"; coins: Partial<Record<Coin, string | number>> }
  | { kind: "item" | "weapon"; name: string; qty: string | number; note: string; bonus: string | number; damage: string };

const toRows = (c: MapChest): Row[] =>
  c.loot.map((e): Row => (e.kind === "coins" ? { kind: "coins", coins: { ...e.coins } } : { kind: e.kind, name: e.name, qty: e.qty, note: e.note ?? "", bonus: e.kind === "weapon" ? (e.bonus ?? "") : "", damage: e.kind === "weapon" ? (e.damage ?? "") : "" }));

/** O que vai para o servidor (ele valida e recusa com aviso). */
const fromRows = (rows: Row[]): LootInput[] =>
  rows.map((r): LootInput => {
    if (r.kind === "coins") return { kind: "coins", coins: Object.fromEntries(COINS.map((k) => [k, Number(r.coins[k]) || 0]).filter(([, n]) => (n as number) > 0)) };
    const base = { name: r.name.trim(), qty: Number(r.qty) || 0, ...(r.note.trim() && { note: r.note.trim() }) };
    if (r.kind === "item") return { kind: "item", ...base };
    return { kind: "weapon", ...base, ...(r.bonus !== "" && { bonus: Number(r.bonus) }), ...(r.damage.trim() && { damage: r.damage.trim() }) };
  });

/**
 * Editor do baú (mestre): nome, desenho, trancado, invisível e o loot (moedas, itens e armas).
 * Aberto pela ferramenta Baús, ao pôr um baú novo ou clicar num que já existe.
 */
export function ChestEditor({ chests }: { chests: MapChest[] }) {
  const t = useT();
  const id = useApp((s) => s.editingChestId);
  const chest = chests.find((c) => c.id === id);
  const close = () => useApp.setState({ editingChestId: null });
  return (
    <Modal opened={!!chest} onClose={close} title={t("chests.editTitle")} size="lg">
      {chest && <ChestForm key={chest.id} chest={chest} onDone={close} />}
    </Modal>
  );
}

function ChestForm({ chest, onDone }: { chest: MapChest; onDone: () => void }) {
  const t = useT();
  const [name, setName] = useState(chest.name);
  const [style, setStyle] = useState<ChestStyle>(chest.style);
  const [locked, setLocked] = useState(!!chest.locked);
  const [hidden, setHidden] = useState(!!chest.hidden);
  const [rows, setRows] = useState<Row[]>(() => toRows(chest));
  const [busy, setBusy] = useState(false);
  const set = (i: number, patch: Partial<Row>) => setRows((rs) => rs.map((r, j) => (j === i ? ({ ...r, ...patch } as Row) : r)));
  const hasCoins = rows.some((r) => r.kind === "coins");

  async function save() {
    setBusy(true);
    const res = await act("chest:update", { id: chest.id, name, style, locked, hidden, loot: fromRows(rows) });
    setBusy(false);
    if (res.ok) onDone();
  }

  return (
    <Stack gap="sm">
      <TextInput label={t("chests.name")} maxLength={LIMITS.chestName} required value={name} onChange={(e) => setName(e.currentTarget.value)} />
      <SegmentedControl
        fullWidth
        data={CHEST_STYLES.map((s) => ({ value: s, label: t(CHEST_LABEL[s]) }))}
        value={style}
        onChange={(v) => setStyle(v as ChestStyle)}
        aria-label={t("chests.pick")}
      />
      <MGroup gap="lg">
        <Checkbox label={t("chests.locked")} description={t("chests.lockedHint")} checked={locked} onChange={(e) => setLocked(e.currentTarget.checked)} />
        <Checkbox label={t("chests.hidden")} description={t("chests.hiddenHint")} checked={hidden} onChange={(e) => setHidden(e.currentTarget.checked)} />
      </MGroup>

      <MGroup justify="space-between" gap="xs">
        <Text size="sm" fw={600}>
          {t("chests.loot")}
        </Text>
        <MGroup gap={4}>
          <Button size="compact-sm" variant="default" leftSection={<IconPlus size={14} />} disabled={hasCoins || rows.length >= LIMITS.loot} onClick={() => setRows((r) => [...r, { kind: "coins", coins: {} }])}>
            {t("chests.addCoins")}
          </Button>
          <Button size="compact-sm" variant="default" leftSection={<IconPlus size={14} />} disabled={rows.length >= LIMITS.loot} onClick={() => setRows((r) => [...r, { kind: "item", name: "", qty: 1, note: "", bonus: "", damage: "" }])}>
            {t("chests.addItem")}
          </Button>
          <Button size="compact-sm" variant="default" leftSection={<IconPlus size={14} />} disabled={rows.length >= LIMITS.loot} onClick={() => setRows((r) => [...r, { kind: "weapon", name: "", qty: 1, note: "", bonus: "", damage: "" }])}>
            {t("chests.addWeapon")}
          </Button>
        </MGroup>
      </MGroup>
      {rows.length === 0 && (
        <Text size="xs" c="dimmed">
          {t("chests.lootEmpty")}
        </Text>
      )}
      {rows.map((r, i) => (
        <Paper key={i} p="xs" bg="dark.7">
          <MGroup justify="space-between" gap="xs" mb={4}>
            <Text size="xs" c="bronze.4" fw={600} tt="uppercase">
              {t(r.kind === "coins" ? "chests.coins" : r.kind === "item" ? "chests.item" : "chests.weapon")}
            </Text>
            <Tooltip label={t("common.remove")}>
              <ActionIcon size="sm" color="red" aria-label={t("common.remove")} onClick={() => setRows((rs) => rs.filter((_, j) => j !== i))}>
                <IconX size={14} />
              </ActionIcon>
            </Tooltip>
          </MGroup>
          {r.kind === "coins" ? (
            <MGroup gap="xs" grow wrap="nowrap">
              {COINS.map((k) => (
                <NumberInput
                  key={k}
                  label={t(`coin.${k}`)}
                  min={0}
                  max={LIMITS.coins}
                  allowDecimal={false}
                  allowNegative={false}
                  value={r.coins[k] ?? ""}
                  onChange={(v) => set(i, { coins: { ...r.coins, [k]: v } })}
                />
              ))}
            </MGroup>
          ) : (
            <Stack gap={4}>
              <MGroup gap="xs" wrap="nowrap" align="flex-end">
                <TextInput style={{ flex: 1 }} label={t("sheet.items.name")} required maxLength={LIMITS.spellName} value={r.name} onChange={(e) => set(i, { name: e.currentTarget.value })} />
                <NumberInput w={72} label={t("sheet.items.qty")} min={1} max={LIMITS.itemQty} allowDecimal={false} allowNegative={false} value={r.qty} onChange={(v) => set(i, { qty: v })} />
              </MGroup>
              {r.kind === "weapon" && (
                <MGroup gap="xs" grow wrap="nowrap">
                  <NumberInput label={t("sheet.attacks.bonus")} min={-20} max={40} allowDecimal={false} value={r.bonus} onChange={(v) => set(i, { bonus: v })} />
                  <TextInput label={t("sheet.attacks.damage")} placeholder="1d8+3" maxLength={LIMITS.dice.exprLength} value={r.damage} onChange={(e) => set(i, { damage: e.currentTarget.value })} />
                </MGroup>
              )}
              <TextInput label={t("sheet.items.note")} maxLength={LIMITS.spellNote} value={r.note} onChange={(e) => set(i, { note: e.currentTarget.value })} />
            </Stack>
          )}
        </Paper>
      ))}

      <MGroup justify="space-between" gap="xs" mt="xs">
        <Button variant="subtle" color="red" leftSection={<IconTrash size={14} />} onClick={() => void removeChest(chest).then((r) => r.ok && onDone())}>
          {t("chests.remove")}
        </Button>
        <MGroup gap="xs">
          <Button variant="default" onClick={onDone}>
            {t("common.cancel")}
          </Button>
          <Button loading={busy} onClick={() => void save()}>
            {t("common.save")}
          </Button>
        </MGroup>
      </MGroup>
    </Stack>
  );
}
