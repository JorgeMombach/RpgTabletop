import { Badge, Button, Group, Modal, NumberInput, Paper, Popover, Progress, Select, Stack, Text, Tooltip } from "@mantine/core";
import { IconCheck, IconCoins, IconFlask, IconGift, IconSword } from "@tabler/icons-react";
import { COINS, LIMITS, type ClientState, type Coins, type LootEntry, type MapChest } from "@rpg/shared";
import { useEffect, useRef, useState } from "react";
import { act } from "../actions";
import { useT } from "../i18n";
import { ChestIcon } from "../map/MapChests";
import { useApp } from "../store";

/** "120 PO · 30 PP". */
function coinsText(c: Coins, t: ReturnType<typeof useT>): string {
  return COINS.filter((k) => c[k])
    .map((k) => `${c[k]} ${t(`coin.${k}`)}`)
    .join(" · ");
}

/** Linha principal e detalhe de uma coisa do baú. */
function describe(e: LootEntry, t: ReturnType<typeof useT>): { name: string; sub: string } {
  if (e.kind === "coins") return { name: coinsText(e.coins, t), sub: t("loot.coinsSub") };
  const stats = e.kind === "weapon" ? [e.bonus !== undefined ? (e.bonus >= 0 ? `+${e.bonus}` : String(e.bonus)) : null, e.damage].filter(Boolean).join(" · ") : "";
  return {
    name: e.qty > 1 ? `${e.name} ×${e.qty}` : e.name,
    sub: [e.kind === "weapon" ? `${t("chests.weapon")}${stats ? ` · ${stats}` : ""}` : null, e.note].filter(Boolean).join(" · ") || t("chests.addItem"),
  };
}

const ICON = { coins: IconCoins, item: IconFlask, weapon: IconSword };

/**
 * Janela de loot (Fase 6, docs/design/baus.md, protótipo aprovado): abre na tela de todos quando alguém abre um baú.
 * Contagem com Quero; no fim, os d20 de quem disputou; depois, Pegar. O mestre tem Dar para… e Encerrar contagem.
 */
export function LootWindow({ state }: { state: ClientState }) {
  const chestId = useApp((s) => s.lootChestId);
  const chest = state.battle.chests.find((c) => c.id === chestId);
  const count = state.battle.lootCount;
  // Contagem nova (de qualquer um): a janela abre sozinha na tela de todos.
  const lastCount = useRef<string | null>(null);
  useEffect(() => {
    const id = count?.chestId ?? null;
    if (id && id !== lastCount.current) useApp.setState({ lootChestId: id });
    lastCount.current = id;
  }, [count?.chestId]);
  const close = () => useApp.setState({ lootChestId: null });
  return (
    <Modal opened={!!chest} onClose={close} withCloseButton={false} size="md" padding={0} classNames={{ content: "loot-window" }}>
      {chest && <LootBody state={state} chest={chest} onClose={close} />}
    </Modal>
  );
}

function LootBody({ state, chest, onClose }: { state: ClientState; chest: MapChest; onClose: () => void }) {
  const t = useT();
  const gm = state.self.role === "gm";
  const count = state.battle.lootCount?.chestId === chest.id ? state.battle.lootCount : null;
  const results = state.battle.lootResults?.chestId === chest.id ? state.battle.lootResults : null;
  // Nome de quem quer: o personagem do jogador (senão, o nome dele).
  const nameOf = (playerId: string) =>
    state.allies.find((a) => a.ownerId === playerId && !a.summonerId)?.name ?? state.players.find((p) => p.id === playerId)?.name ?? "?";

  // Barra da contagem: o fim é a hora em que o estado chegou mais o que faltava.
  const [now, setNow] = useState(() => Date.now());
  const deadline = useRef(0);
  const total = useRef(1);
  const remaining = count?.remainingMs ?? 0;
  useEffect(() => {
    deadline.current = Date.now() + remaining;
    total.current = Math.max(total.current, remaining, 1);
  }, [remaining]);
  useEffect(() => {
    if (!count) return;
    total.current = Math.max(1, (state.lootSeconds || 1) * 1000);
    const id = window.setInterval(() => setNow(Date.now()), 200);
    return () => window.clearInterval(id);
  }, [count, state.lootSeconds]);
  const left = Math.max(0, deadline.current - now);

  return (
    <Stack gap="sm" p="md">
      <Group gap="sm" wrap="nowrap">
        <ChestIcon style={chest.style} state={chest.loot.length > 0 ? "open" : "empty"} size={44} />
        <div style={{ flex: 1, minWidth: 0 }}>
          <Text ff="heading" fw={700} size="lg" c="bronze.4" truncate title={chest.name}>
            {chest.name}
          </Text>
          <Text size="xs" c="dimmed">
            {count ? t("loot.choosing") : chest.loot.length > 0 ? t("loot.take") : t("loot.empty")}
          </Text>
        </div>
        <Button variant="default" size="compact-sm" onClick={onClose}>
          {t("common.close")}
        </Button>
      </Group>

      {count && (
        <Stack gap={4}>
          <Group justify="space-between">
            <Text size="xs" c="dimmed">
              {t(gm ? "loot.countGm" : "loot.count")}
            </Text>
            <Text size="xs" c="dimmed" style={{ fontVariantNumeric: "tabular-nums" }}>
              {Math.ceil(left / 1000)}s
            </Text>
          </Group>
          <Progress value={(left / total.current) * 100} color="bronze" size="sm" aria-label={t("loot.choosing")} />
        </Stack>
      )}

      {results && results.lines.length > 0 && (
        <Paper className="loot-results" p="xs">
          <Text className="loot-results-title">{t("loot.results")}</Text>
          {results.lines.map((l) => (
            <Text key={l.lootId} size="sm">
              {l.name || coinsText(l.gave[0]?.coins ?? {}, t)}
              {l.rolls.length > 0 && (
                <>
                  {": "}
                  {l.rolls.map((r, i) => (
                    <span key={r.who} className={`loot-d20${i === 0 ? " win" : ""}`}>
                      <i>{r.d20}</i>
                      {r.who}
                    </span>
                  ))}
                </>
              )}
              {l.gave.length > 0 && " → "}
              {l.gave.map((g) => (g.coins ? `${g.who} ${coinsText(g.coins, t)}` : g.qty > 1 ? `${g.who} ${g.qty}` : g.who)).join(", ")}
            </Text>
          ))}
        </Paper>
      )}

      <Stack gap={6}>
        {chest.loot.map((e) => {
          const { name, sub } = describe(e, t);
          const Icon = ICON[e.kind];
          const who = count?.wants[e.id] ?? [];
          const mine = who.includes(state.self.id);
          return (
            // A chave muda com a quantidade: depois de alguém pegar parte da pilha, os campos recomeçam do que sobrou.
            <Group key={`${e.id}-${e.kind === "coins" ? 0 : e.qty}`} className={`loot-row${mine ? " mine" : ""}`} gap="sm" wrap="nowrap">
              <span className="loot-ico">
                <Icon size={16} />
              </span>
              <div style={{ flex: 1, minWidth: 0 }}>
                <Text size="sm" fw={700} truncate title={name}>
                  {name}
                </Text>
                <Text size="xs" c="dimmed" truncate title={sub}>
                  {sub}
                </Text>
                {who.length > 0 && (
                  <Group gap={4} mt={3}>
                    {who.map((id) => (
                      <Badge key={id} size="xs" color="player" variant="light">
                        {nameOf(id)}
                      </Badge>
                    ))}
                  </Group>
                )}
              </div>
              {gm ? (
                <GiveButton state={state} chest={chest} entry={e} />
              ) : count ? (
                <Button size="compact-sm" variant={mine ? "light" : "default"} leftSection={mine ? <IconCheck size={14} /> : undefined} onClick={() => act("loot:want", { chestId: chest.id, lootId: e.id, want: !mine })}>
                  {t("loot.want")}
                </Button>
              ) : (
                <TakeButton chest={chest} entry={e} />
              )}
            </Group>
          );
        })}
      </Stack>

      {count && gm && (
        <Group justify="flex-end">
          <Button variant="default" size="compact-sm" onClick={() => act("loot:end", {})}>
            {t("loot.end")}
          </Button>
        </Group>
      )}
      {count && !gm && (
        <Text size="xs" c="dimmed">
          {t("loot.countHint")}
        </Text>
      )}
    </Stack>
  );
}

/** Pegar: na pilha, escolhe quantas unidades. */
function TakeButton({ chest, entry }: { chest: MapChest; entry: LootEntry }) {
  const t = useT();
  const stack = entry.kind !== "coins" && entry.qty > 1;
  const [qty, setQty] = useState<string | number>(stack ? entry.qty : 1);
  return (
    <Group gap={4} wrap="nowrap">
      {stack && <NumberInput w={56} min={1} max={entry.qty} allowDecimal={false} allowNegative={false} value={qty} onChange={setQty} aria-label={t("sheet.items.qty")} />}
      <Button size="compact-sm" onClick={() => act("loot:take", { chestId: chest.id, lootId: entry.id, ...(stack && { qty: Math.min(Number(qty) || 1, entry.qty) }) })}>
        {t("loot.takeOne")}
      </Button>
    </Group>
  );
}

/** Mestre: Dar para… (personagem e quantidade), a qualquer hora. */
function GiveButton({ state, chest, entry }: { state: ClientState; chest: MapChest; entry: LootEntry }) {
  const t = useT();
  const [opened, setOpened] = useState(false);
  const chars = state.allies.filter((a) => !a.summonerId);
  const [to, setTo] = useState<string | null>(chars[0]?.id ?? null);
  const max = entry.kind !== "coins" ? entry.qty : 1;
  const [qty, setQty] = useState<string | number>(max);
  return (
    <Popover opened={opened} onChange={setOpened} position="bottom-end" withArrow shadow="md" withinPortal={false}>
      <Popover.Target>
        <Tooltip label={t("loot.giveTip")}>
          <Button size="compact-sm" variant="default" leftSection={<IconGift size={14} />} disabled={chars.length === 0} onClick={() => setOpened((o) => !o)}>
            {t("loot.give")}
          </Button>
        </Tooltip>
      </Popover.Target>
      <Popover.Dropdown>
        <Stack gap="xs" w={200}>
          <Select label={t("loot.giveTo")} data={chars.map((c) => ({ value: c.id, label: c.name }))} value={to} onChange={setTo} allowDeselect={false} comboboxProps={{ withinPortal: false }} />
          {entry.kind !== "coins" && max > 1 && (
            <NumberInput label={t("sheet.items.qty")} min={1} max={Math.min(max, LIMITS.itemQty)} allowDecimal={false} allowNegative={false} value={qty} onChange={setQty} />
          )}
          <Button
            disabled={!to}
            onClick={() =>
              to &&
              void act("loot:give", { chestId: chest.id, lootId: entry.id, to, qty: entry.kind === "coins" ? 1 : Math.min(Number(qty) || 1, entry.qty) }).then((r) => r.ok && setOpened(false))
            }
          >
            {t("loot.giveDo")}
          </Button>
        </Stack>
      </Popover.Dropdown>
    </Popover>
  );
}
