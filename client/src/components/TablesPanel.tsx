import { ActionIcon, Badge, Box, Button, Group, Modal, NumberInput, Paper, SegmentedControl, Select, Stack, Text, TextInput, Tooltip } from "@mantine/core";
import { IconArrowDown, IconArrowUp, IconDice5, IconEye, IconEyeOff, IconPencil, IconPlus, IconTable, IconTrash, IconX } from "@tabler/icons-react";
import { COINS, LIMITS, type Coin, type RollTable, type TableLoot, type TableRow } from "@rpg/shared";
import { useState } from "react";
import { act } from "../actions";
import { confirmAction } from "../confirm";
import { useLang, useT } from "../i18n";
import { toast } from "../notify";
import { tableExamples } from "../tableExamples";
import { EmptyState } from "./EmptyState";
import { Panel } from "./Panel";

/** Dados comuns: com a soma dos pesos igual a um deles, a tela mostra o dado e as faixas; senão, a chance em %. */
const DICE = [1, 2, 3, 4, 6, 8, 10, 12, 20, 100];

/** Faixa de cada linha ("1–3") e o dado ("d8"); sem dado comum, porcentagem. */
export function tableRanges(weights: number[]): { die: string | null; labels: string[] } {
  const total = weights.reduce((a, b) => a + (b > 0 ? b : 0), 0);
  const die = DICE.includes(total) ? `d${total}` : null;
  let at = 1;
  const labels = weights.map((w) => {
    const from = at;
    at += Math.max(w, 0);
    if (!die) return total > 0 ? `${Math.round((Math.max(w, 0) / total) * 100)}%` : "—";
    return w <= 1 ? `${from}` : `${from}–${from + w - 1}`;
  });
  return { die, labels };
}

/** Mestre (Passo 13): tabelas aleatórias da campanha; rola com um clique, só para ele ou para todos. */
export function TablesPanel({ tables }: { tables: RollTable[] }) {
  const t = useT();
  const lang = useLang((s) => s.lang);
  const [editing, setEditing] = useState<RollTable | null>(null);
  const [busy, setBusy] = useState(false);

  async function addExamples() {
    setBusy(true);
    let added = 0;
    for (const ex of tableExamples(lang)) {
      if (tables.some((x) => x.name.toLowerCase() === ex.name.toLowerCase())) continue;
      if ((await act("table:upsert", ex)).ok) added++;
    }
    setBusy(false);
    if (added) toast({ kind: "success", text: t("tables.examplesAdded", { n: added }) });
  }

  const blank: RollTable = { id: "", name: "", kind: "text", rows: [{ weight: 1, text: "" }] };
  return (
    <Panel
      title={t("tables.title")}
      anchor="tables"
      aside={
        <Button size="compact-sm" variant="default" leftSection={<IconPlus size={14} />} disabled={tables.length >= LIMITS.tables} onClick={() => setEditing(blank)}>
          {t("tables.new")}
        </Button>
      }
    >
      {tables.length === 0 ? (
        <EmptyState
          icon={IconTable}
          title={t("tables.emptyTitle")}
          text={t("tables.empty")}
          action={
            <Button size="compact-sm" variant="default" loading={busy} onClick={() => void addExamples()}>
              {t("tables.examples")}
            </Button>
          }
        />
      ) : (
        <Stack gap={2}>
          {tables.map((tb) => (
            <TableItem key={tb.id} table={tb} onEdit={() => setEditing(tb)} />
          ))}
        </Stack>
      )}
      <Modal opened={!!editing} onClose={() => setEditing(null)} title={editing?.id ? t("tables.editTitle") : t("tables.newTitle")} size="lg">
        {editing && <TableEditor table={editing} onDone={() => setEditing(null)} />}
      </Modal>
    </Panel>
  );
}

function TableItem({ table, onEdit }: { table: RollTable; onEdit: () => void }) {
  const t = useT();
  const pub = !!table.public;
  const roll = (asPublic: boolean) => void act("table:roll", { id: table.id, public: asPublic });
  return (
    <Paper p={4} bg="dark.7">
    <Group gap={6} wrap="nowrap">
      <Tooltip label={pub ? t("tables.rollPublic") : t("tables.rollHidden")}>
        <ActionIcon color="bronze" aria-label={t("tables.roll", { name: table.name })} onClick={() => roll(pub)}>
          <IconDice5 size={16} />
        </ActionIcon>
      </Tooltip>
      <Box style={{ flex: 1, minWidth: 0 }}>
        <Text size="sm" truncate title={table.name}>
          {table.name}
        </Text>
        <Text size="xs" c="dimmed">
          {t(table.kind === "loot" ? "tables.kindLoot" : "tables.kindText")} · {t("tables.rows", { n: table.rows.length })}
        </Text>
      </Box>
      <Tooltip label={pub ? t("tables.visPublic") : t("tables.visHidden")}>
        <ActionIcon variant="subtle" color="gray" aria-label={pub ? t("tables.visPublic") : t("tables.visHidden")} onClick={() => roll(!pub)}>
          {pub ? <IconEye size={16} /> : <IconEyeOff size={16} />}
        </ActionIcon>
      </Tooltip>
      <Tooltip label={t("tables.edit")}>
        <ActionIcon variant="subtle" color="gray" aria-label={t("tables.edit")} onClick={onEdit}>
          <IconPencil size={16} />
        </ActionIcon>
      </Tooltip>
    </Group>
    </Paper>
  );
}

/** Linha do formulário: números ainda podem estar vazios enquanto o mestre digita. */
type FormLoot = { kind: TableLoot["kind"]; coin: Coin; amount: string; name: string; qty: string; bonus: number | string; damage: string; note: string };
type FormRow = { weight: number | string; text: string; loot: FormLoot };

const blankLoot = (): FormLoot => ({ kind: "item", coin: "gp", amount: "", name: "", qty: "1", bonus: "", damage: "", note: "" });

function toForm(row: TableRow): FormRow {
  if ("text" in row) return { weight: row.weight, text: row.text, loot: blankLoot() };
  const l = row.loot;
  const loot = blankLoot();
  if (l.kind === "coins") Object.assign(loot, { kind: "coins", coin: l.coin, amount: l.amount });
  else Object.assign(loot, { kind: l.kind, name: l.name, qty: l.qty, note: l.note ?? "", ...(l.kind === "weapon" && { bonus: l.bonus ?? "", damage: l.damage ?? "" }) });
  return { weight: row.weight, text: "", loot };
}

function fromForm(kind: RollTable["kind"], r: FormRow): TableRow {
  const weight = Number(r.weight) || 0;
  if (kind === "text") return { weight, text: r.text };
  const l = r.loot;
  if (l.kind === "coins") return { weight, loot: { kind: "coins", coin: l.coin, amount: l.amount } };
  const note = l.note.trim() ? { note: l.note } : {};
  if (l.kind === "item") return { weight, loot: { kind: "item", name: l.name, qty: l.qty, ...note } };
  return { weight, loot: { kind: "weapon", name: l.name, qty: l.qty, ...(l.bonus !== "" && { bonus: Number(l.bonus) }), ...(l.damage.trim() && { damage: l.damage }), ...note } };
}

function TableEditor({ table, onDone }: { table: RollTable; onDone: () => void }) {
  const t = useT();
  const [name, setName] = useState(table.name);
  const [kind, setKind] = useState(table.kind);
  const [rows, setRows] = useState<FormRow[]>(() => table.rows.map(toForm));
  const [busy, setBusy] = useState(false);
  const { die, labels } = tableRanges(rows.map((r) => Number(r.weight) || 0));
  const set = (i: number, patch: Partial<FormRow>) => setRows((rs) => rs.map((r, j) => (j === i ? { ...r, ...patch } : r)));
  const setLoot = (i: number, patch: Partial<FormLoot>) => setRows((rs) => rs.map((r, j) => (j === i ? { ...r, loot: { ...r.loot, ...patch } } : r)));
  const move = (i: number, d: number) =>
    setRows((rs) => {
      const next = [...rs];
      [next[i], next[i + d]] = [next[i + d], next[i]];
      return next;
    });

  async function save() {
    setBusy(true);
    const payload = { name, kind, rows: rows.map((r) => fromForm(kind, r)) };
    const res = await act("table:upsert", table.id ? { id: table.id, ...payload } : payload);
    setBusy(false);
    if (res.ok) onDone();
  }

  async function remove() {
    if (!(await confirmAction({ title: t("tables.removeTitle", { name: table.name }), message: t("tables.removeMessage"), confirmLabel: t("common.delete"), danger: true }))) return;
    if ((await act("table:remove", { id: table.id })).ok) onDone();
  }

  return (
    <Stack gap="sm">
      <Group gap="xs" align="flex-end" wrap="nowrap">
        <TextInput style={{ flex: 1 }} label={t("tables.name")} required maxLength={LIMITS.tableName} value={name} onChange={(e) => setName(e.currentTarget.value)} data-autofocus />
        <SegmentedControl
          data={[
            { value: "text", label: t("tables.kindText") },
            { value: "loot", label: t("tables.kindLoot") },
          ]}
          value={kind}
          onChange={(v) => setKind(v as RollTable["kind"])}
          aria-label={t("tables.kind")}
        />
      </Group>
      <Group justify="space-between" gap="xs" wrap="wrap">
        <Group gap={6}>
          <Text size="sm" fw={600}>
            {t("tables.lines")}
          </Text>
          {die && (
            <Badge variant="light" color="bronze">
              {die}
            </Badge>
          )}
        </Group>
        <Text size="xs" c="dimmed" style={{ flex: "1 1 240px", textAlign: "right" }}>
          {t(kind === "text" ? "tables.hintText" : "tables.hintLoot")}
        </Text>
      </Group>

      {rows.map((r, i) => (
        <Paper key={i} p="xs" bg="dark.7">
          <Group gap="xs" wrap="nowrap" align="flex-end">
            <Text w={44} size="xs" c="bronze.4" ta="right" pb={8} fw={600} style={{ flex: "none" }}>
              {labels[i]}
            </Text>
            <NumberInput w={64} label={t("tables.weight")} min={1} max={LIMITS.tableWeight} allowDecimal={false} allowNegative={false} value={r.weight} onChange={(v) => set(i, { weight: v })} style={{ flex: "none" }} />
            {kind === "text" ? (
              <TextInput style={{ flex: 1, minWidth: 0 }} label={t("tables.result")} maxLength={LIMITS.tableText} value={r.text} onChange={(e) => set(i, { text: e.currentTarget.value })} />
            ) : (
              <SegmentedControl
                size="xs"
                data={[
                  { value: "coins", label: t("chests.coins") },
                  { value: "item", label: t("chests.item") },
                  { value: "weapon", label: t("chests.weapon") },
                ]}
                value={r.loot.kind}
                onChange={(v) => setLoot(i, { kind: v as FormLoot["kind"] })}
                style={{ flex: 1 }}
              />
            )}
            <Group gap={0} wrap="nowrap" pb={4} style={{ flex: "none" }}>
              <Tooltip label={t("tables.moveUp")}>
                <ActionIcon size="sm" variant="subtle" color="gray" aria-label={t("tables.moveUp")} disabled={i === 0} onClick={() => move(i, -1)}>
                  <IconArrowUp size={14} />
                </ActionIcon>
              </Tooltip>
              <Tooltip label={t("tables.moveDown")}>
                <ActionIcon size="sm" variant="subtle" color="gray" aria-label={t("tables.moveDown")} disabled={i === rows.length - 1} onClick={() => move(i, 1)}>
                  <IconArrowDown size={14} />
                </ActionIcon>
              </Tooltip>
              <Tooltip label={t("common.remove")}>
                <ActionIcon size="sm" color="red" aria-label={t("common.remove")} disabled={rows.length === 1} onClick={() => setRows((rs) => rs.filter((_, j) => j !== i))}>
                  <IconX size={14} />
                </ActionIcon>
              </Tooltip>
            </Group>
          </Group>
          {kind === "loot" && <LootFields loot={r.loot} onChange={(patch) => setLoot(i, patch)} />}
        </Paper>
      ))}
      <Group>
        <Button size="compact-sm" variant="default" leftSection={<IconPlus size={14} />} disabled={rows.length >= LIMITS.tableRows} onClick={() => setRows((rs) => [...rs, { weight: 1, text: "", loot: blankLoot() }])}>
          {t("tables.addRow")}
        </Button>
      </Group>

      <Group justify="space-between" gap="xs" mt="xs">
        {table.id ? (
          <Button variant="subtle" color="red" leftSection={<IconTrash size={14} />} onClick={() => void remove()}>
            {t("tables.remove")}
          </Button>
        ) : (
          <span />
        )}
        <Group gap="xs">
          <Button variant="default" onClick={onDone}>
            {t("common.cancel")}
          </Button>
          <Button loading={busy} onClick={() => void save()}>
            {t("common.save")}
          </Button>
        </Group>
      </Group>
    </Stack>
  );
}

/** Campos do loot de uma linha: quantidades aceitam dado ("3d6"). */
function LootFields({ loot, onChange }: { loot: FormLoot; onChange: (patch: Partial<FormLoot>) => void }) {
  const t = useT();
  if (loot.kind === "coins")
    return (
      <Group gap="xs" mt={6} wrap="nowrap" pl={52}>
        <TextInput w={110} label={t("tables.amount")} placeholder="3d6" maxLength={LIMITS.dice.exprLength} value={loot.amount} onChange={(e) => onChange({ amount: e.currentTarget.value })} />
        <Select w={140} label={t("tables.coin")} allowDeselect={false} data={COINS.map((c) => ({ value: c, label: t(`coin.${c}`) }))} value={loot.coin} onChange={(v) => v && onChange({ coin: v as Coin })} />
      </Group>
    );
  return (
    <Stack gap={4} mt={6} pl={52}>
      <Group gap="xs" wrap="nowrap" align="flex-end">
        <TextInput style={{ flex: 1, minWidth: 0 }} label={t("sheet.items.name")} maxLength={LIMITS.spellName} value={loot.name} onChange={(e) => onChange({ name: e.currentTarget.value })} />
        <TextInput w={76} label={t("sheet.items.qty")} placeholder="1d4" maxLength={LIMITS.dice.exprLength} value={loot.qty} onChange={(e) => onChange({ qty: e.currentTarget.value })} />
      </Group>
      {loot.kind === "weapon" && (
        <Group gap="xs" grow wrap="nowrap">
          <NumberInput label={t("sheet.attacks.bonus")} min={-20} max={40} allowDecimal={false} value={loot.bonus} onChange={(v) => onChange({ bonus: v })} />
          <TextInput label={t("sheet.attacks.damage")} placeholder="1d8+3" maxLength={LIMITS.dice.exprLength} value={loot.damage} onChange={(e) => onChange({ damage: e.currentTarget.value })} />
        </Group>
      )}
      <TextInput label={t("sheet.items.note")} maxLength={LIMITS.spellNote} value={loot.note} onChange={(e) => onChange({ note: e.currentTarget.value })} />
    </Stack>
  );
}
