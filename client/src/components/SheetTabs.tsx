import {
  ActionIcon,
  Badge,
  Button,
  Group,
  NumberInput,
  Paper,
  SegmentedControl,
  Select,
  SimpleGrid,
  Stack,
  Text,
  TextInput,
  Tooltip,
} from "@mantine/core";
import { IconBackpack, IconFlask, IconMinus, IconPencil, IconPlus, IconSword, IconX } from "@tabler/icons-react";
import { COINS, LIMITS, type ActionPayloads, type Coin, type Combatant, type InventoryItem, type Recharge } from "@rpg/shared";
import { useState, type FormEvent } from "react";
import { act } from "../actions";
import { fmtMod } from "../format";
import { useT, type MessageKey } from "../i18n";
import { useRollLock } from "../rollLock";
import { attacksOf } from "../weapons";
import { doubleDice } from "./DicePanel";
import { DamageRollButton } from "./DamageRollButton";
import { RestButton } from "./RestButton";
import { EmptyState } from "./EmptyState";
import { MagicSection } from "./MagicSection";

type Tab = "magic" | "resources" | "attacks" | "items";

/**
 * Ficha pessoal em abas, no painel Selecionado: magia (aliados), recursos com descanso, ataques salvos
 * e inventário com moedas. Mob e NPC (só o mestre vê) têm recursos e ataques.
 */
/** Abas da ficha. `wide`: ficha completa no modal (magias agrupadas por círculo). */
export function SheetTabs({ c, editable, gm, wide = false }: { c: Combatant; editable: boolean; gm: boolean; wide?: boolean }) {
  const t = useT();
  const ally = c.type === "ally";
  const tabs: { value: Tab; label: MessageKey }[] = [
    ...(ally ? [{ value: "magic" as const, label: "sheet.tab.magic" as const }] : []),
    { value: "resources", label: "sheet.tab.resources" },
    { value: "attacks", label: "sheet.tab.attacks" },
    ...(ally ? [{ value: "items" as const, label: "sheet.tab.items" as const }] : []),
  ];
  const [tab, setTab] = useState<Tab>(ally ? "magic" : "attacks");
  const current = tabs.some((x) => x.value === tab) ? tab : tabs[0].value;

  return (
    <Stack gap="sm">
      <SegmentedControl
        fullWidth
        size="xs"
        data={tabs.map((x) => ({ value: x.value, label: t(x.label) }))}
        value={current}
        onChange={(v) => setTab(v as Tab)}
        aria-label={t("sheet.tabs")}
      />
      {current === "magic" && <MagicSection c={c} editable={editable} wide={wide} />}
      {current === "resources" && <ResourcesSection c={c} editable={editable} />}
      {current === "attacks" && <AttacksSection c={c} editable={editable} gm={gm} />}
      {current === "items" && <ItemsSection c={c} editable={editable} />}
    </Stack>
  );
}

/* ---------- recursos ---------- */

/** Cartão de combate: só o contador de cada recurso (gastar e recuperar); o resto fica na ficha completa. */
export function ResourceCounters({ c, editable }: { c: Combatant; editable: boolean }) {
  const t = useT();
  return (
    <Stack gap={4}>
      {(c.resources ?? []).map((r) => (
        <Group key={r.id} gap="xs" wrap="nowrap">
          <Text size="sm" truncate title={r.name} style={{ flex: 1, minWidth: 0 }}>
            {r.name}
          </Text>
          {editable && (
            <ActionIcon variant="default" onClick={() => act("resource:use", { id: c.id, resourceId: r.id, delta: 1 })} disabled={r.used >= r.max} aria-label={t("sheet.resources.use")}>
              <IconMinus size={14} />
            </ActionIcon>
          )}
          <Text fw={700} w={44} ta="center">
            {r.max - r.used}/{r.max}
          </Text>
          {editable && (
            <ActionIcon variant="default" onClick={() => act("resource:use", { id: c.id, resourceId: r.id, delta: -1 })} disabled={r.used === 0} aria-label={t("sheet.resources.recover")}>
              <IconPlus size={14} />
            </ActionIcon>
          )}
        </Group>
      ))}
    </Stack>
  );
}

const RECHARGE_LABEL: Record<Recharge, MessageKey> = {
  short: "sheet.recharge.short",
  long: "sheet.recharge.long",
  none: "sheet.recharge.none",
  turn: "sheet.recharge.turn",
  dice: "sheet.recharge.dice",
};
/** Versão curta, embaixo do nome na lista. */
const RECHARGE_TAG: Record<Recharge, MessageKey> = {
  short: "sheet.rechargeTag.short",
  long: "sheet.rechargeTag.long",
  none: "sheet.rechargeTag.none",
  turn: "sheet.rechargeTag.turn",
  dice: "sheet.rechargeTag.dice",
};

function ResourcesSection({ c, editable }: { c: Combatant; editable: boolean }) {
  const t = useT();
  const [adding, setAdding] = useState(false);
  const resources = c.resources ?? [];

  return (
    <Stack gap="xs">
      {resources.length === 0 && !adding && (
        <EmptyState icon={IconFlask} text={t(c.type === "ally" ? "sheet.resources.empty" : "sheet.resources.emptyMob")} compact />
      )}
      {resources.map((r) => (
        // Nome numa linha (com o remover) e, embaixo, quando volta e o contador: o nome não corta na coluna estreita.
        <Stack key={r.id} gap={2}>
          <Group gap={6} wrap="nowrap">
            <Text size="sm" fw={600} truncate title={r.name} style={{ flex: 1, minWidth: 0 }}>
              {r.name}
            </Text>
            {r.damage && <DamageRollButton c={c} name={r.name} expr={r.damage} disabled={!editable} />}
            {editable && (
              <Tooltip label={t("common.remove")}>
                <ActionIcon variant="subtle" color="red" size="sm" onClick={() => act("resource:remove", { id: c.id, resourceId: r.id })} aria-label={t("common.remove")}>
                  <IconX size={14} />
                </ActionIcon>
              </Tooltip>
            )}
          </Group>
          <Group gap="xs" wrap="nowrap">
            <Text size="xs" c="dimmed" style={{ flex: 1, minWidth: 0 }} truncate>
              {t(RECHARGE_TAG[r.recharge], { from: r.rechargeOn ?? 6 })}
            </Text>
            {editable && (
              <ActionIcon variant="default" onClick={() => act("resource:use", { id: c.id, resourceId: r.id, delta: 1 })} disabled={r.used >= r.max} aria-label={t("sheet.resources.use")}>
                <IconMinus size={14} />
              </ActionIcon>
            )}
            <Text fw={700} w={44} ta="center">
              {r.max - r.used}/{r.max}
            </Text>
            {editable && (
              <ActionIcon variant="default" onClick={() => act("resource:use", { id: c.id, resourceId: r.id, delta: -1 })} disabled={r.used === 0} aria-label={t("sheet.resources.recover")}>
                <IconPlus size={14} />
              </ActionIcon>
            )}
          </Group>
        </Stack>
      ))}
      {adding && <ResourceForm c={c} onDone={() => setAdding(false)} />}
      {editable && (
        <Group gap="xs" wrap="wrap">
          {!adding && (
            <Button variant="default" onClick={() => setAdding(true)}>
              {t("sheet.resources.add")}
            </Button>
          )}
          <RestButton who={c} kind="short" ml="auto" />
          <RestButton who={c} kind="long" />
        </Group>
      )}
    </Stack>
  );
}

function ResourceForm({ c, onDone }: { c: Combatant; onDone: () => void }) {
  const t = useT();
  const [name, setName] = useState("");
  const [max, setMax] = useState<string | number>(1);
  const [recharge, setRecharge] = useState<Recharge>(c.type === "ally" ? "long" : "turn");
  const [rechargeOn, setRechargeOn] = useState<string | number>(5);
  const [damage, setDamage] = useState("");

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (
      (
        await act("resource:upsert", {
          id: c.id,
          name,
          max: Number(max),
          recharge,
          rechargeOn: recharge === "dice" ? Number(rechargeOn) : undefined,
          damage: damage.trim() || undefined,
        })
      ).ok
    )
      onDone();
  }

  return (
    <Paper component="form" onSubmit={submit} p="sm" bg="dark.7">
      <Stack gap="xs">
        <TextInput
          label={t("sheet.resources.name")}
          placeholder={t("sheet.resources.namePlaceholder")}
          autoFocus
          required
          maxLength={LIMITS.spellName}
          value={name}
          onChange={(e) => setName(e.currentTarget.value)}
        />
        <Group grow gap="xs" align="flex-start">
          <NumberInput
            label={t("sheet.resources.max")}
            required
            min={1}
            max={LIMITS.resourceMax}
            allowDecimal={false}
            allowNegative={false}
            value={max}
            onChange={setMax}
          />
          <Select
            label={t("sheet.resources.recharge")}
            data={(Object.keys(RECHARGE_LABEL) as Recharge[]).map((v) => ({
              value: v,
              label: t(RECHARGE_LABEL[v]),
            }))}
            value={recharge}
            onChange={(v) => v && setRecharge(v as Recharge)}
            allowDeselect={false}
            comboboxProps={{ withinPortal: true }}
          />
        </Group>
        {recharge === "dice" && (
          <NumberInput
            label={t("sheet.resources.rechargeOn")}
            description={t("sheet.resources.rechargeOnHint")}
            min={2}
            max={6}
            allowDecimal={false}
            allowNegative={false}
            value={rechargeOn}
            onChange={setRechargeOn}
          />
        )}
        <TextInput
          label={t("sheet.damageOptional")}
          description={t("sheet.resources.damageHint")}
          placeholder="6d6"
          maxLength={LIMITS.dice.exprLength}
          value={damage}
          onChange={(e) => setDamage(e.currentTarget.value)}
        />
        <Group justify="flex-end" gap="xs">
          <Button variant="default" onClick={onDone}>
            {t("common.cancel")}
          </Button>
          <Button type="submit">{t("common.add")}</Button>
        </Group>
      </Stack>
    </Paper>
  );
}

/* ---------- ataques salvos ---------- */

/** "1d20+5". */
function d20(bonus: number) {
  return bonus === 0 ? "1d20" : `1d20${bonus > 0 ? "+" : ""}${bonus}`;
}

function AttacksSection({ c, editable, gm }: { c: Combatant; editable: boolean; gm: boolean }) {
  const t = useT();
  const [adding, setAdding] = useState(false);
  const attacks = attacksOf(c);
  // Mestre rola por mob/NPC: assina com ele e oculta (como no painel Dados).
  const as = gm ? { asId: c.id, hidden: c.type !== "ally" } : {};
  // Mesma trava do painel Dados: fora da vez ou com o mestre travando, o botão fica apagado e a dica diz o porquê.
  const lock = useRollLock();
  const tip = (label: string) => (lock.reason ? t(lock.reason) : label);
  const roll = (payload: ActionPayloads["dice:roll"]) => () => {
    if (!lock.blocked) void act("dice:roll", { ...payload, ...as });
  };

  return (
    <Stack gap="xs">
      {attacks.length === 0 && !adding && (
        <EmptyState icon={IconSword} text={t("sheet.attacks.empty")} compact />
      )}
      {attacks.map((a) => (
        // Nome numa linha e os botões de rolar embaixo: cabe na coluna estreita sem cortar o nome.
        <Stack key={a.id} gap={4}>
          <Group gap={6} wrap="nowrap">
            <Text size="sm" fw={600} truncate title={a.name} style={{ flex: 1, minWidth: 0 }}>
              {a.name}
            </Text>
            {/* Arma empunhada do inventário: guarda-se (ou apaga) pela aba Itens. */}
            {a.fromItem && (
              <Badge variant="default" size="xs" style={{ flex: "none" }}>
                {t("sheet.items.wieldedTag")}
              </Badge>
            )}
            {editable && !a.fromItem && (
              <Tooltip label={t("common.remove")}>
                <ActionIcon
                  variant="subtle"
                  color="red"
                  size="sm"
                  onClick={() => act("attack:remove", { id: c.id, attackId: a.id })}
                  aria-label={t("common.remove")}
                >
                  <IconX size={14} />
                </ActionIcon>
              </Tooltip>
            )}
          </Group>
          <Group gap={6} wrap="nowrap">
            {a.bonus !== undefined && (
              <Tooltip label={tip(t("sheet.attacks.rollAttack", { expr: d20(a.bonus) }))}>
                <Button size="compact-sm" disabled={!editable} data-disabled={lock.blocked || undefined} onClick={roll({ expr: d20(a.bonus), kind: "attack", name: a.name })}>
                  {fmtMod(a.bonus)}
                </Button>
              </Tooltip>
            )}
            {a.damage && (
              <>
                <Tooltip label={tip(t("sheet.attacks.rollDamage"))}>
                  <Button
                    size="compact-sm"
                    variant="default"
                    disabled={!editable}
                    data-disabled={lock.blocked || undefined}
                    onClick={roll({ expr: a.damage, kind: "damage", name: a.name })}
                  >
                    {a.damage}
                  </Button>
                </Tooltip>
                <Tooltip label={tip(t("sheet.attacks.rollCrit", { expr: doubleDice(a.damage) }))}>
                  <Button
                    size="compact-sm"
                    variant="default"
                    color="red"
                    disabled={!editable}
                    data-disabled={lock.blocked || undefined}
                    onClick={roll({ expr: doubleDice(a.damage), kind: "damage", crit: true, name: a.name })}
                  >
                    {t("sheet.attacks.crit")}
                  </Button>
                </Tooltip>
              </>
            )}
          </Group>
        </Stack>
      ))}
      {adding && <AttackForm c={c} onDone={() => setAdding(false)} />}
      {editable && !adding && (
        <Button variant="default" onClick={() => setAdding(true)}>
          {t("sheet.attacks.add")}
        </Button>
      )}
    </Stack>
  );
}

function AttackForm({ c, onDone }: { c: Combatant; onDone: () => void }) {
  const t = useT();
  const [name, setName] = useState("");
  const [bonus, setBonus] = useState<string | number>("");
  const [damage, setDamage] = useState("");

  async function submit(e: FormEvent) {
    e.preventDefault();
    const res = await act("attack:upsert", {
      id: c.id,
      name,
      bonus: bonus === "" ? null : Number(bonus),
      damage: damage || undefined,
    });
    if (res.ok) onDone();
  }

  return (
    <Paper component="form" onSubmit={submit} p="sm" bg="dark.7">
      <Stack gap="xs">
        <TextInput
          label={t("sheet.attacks.name")}
          placeholder={t("sheet.attacks.namePlaceholder")}
          autoFocus
          required
          maxLength={LIMITS.spellName}
          value={name}
          onChange={(e) => setName(e.currentTarget.value)}
        />
        <Group grow gap="xs" align="flex-start">
          <NumberInput
            label={t("sheet.attacks.bonus")}
            placeholder="+5"
            min={-20}
            max={40}
            allowDecimal={false}
            value={bonus}
            onChange={setBonus}
          />
          <TextInput
            label={t("sheet.attacks.damage")}
            placeholder="1d8+3"
            maxLength={LIMITS.dice.exprLength}
            value={damage}
            onChange={(e) => setDamage(e.currentTarget.value)}
          />
        </Group>
        <Group justify="flex-end" gap="xs">
          <Button variant="default" onClick={onDone}>
            {t("common.cancel")}
          </Button>
          <Button type="submit">{t("common.add")}</Button>
        </Group>
      </Stack>
    </Paper>
  );
}

/* ---------- inventário e moedas ---------- */

/** O item como ele é, para mudar só a quantidade sem perder nota nem a arma. */
const itemPayload = (c: Combatant, i: InventoryItem, qty: number) => ({ id: c.id, itemId: i.id, name: i.name, note: i.note, bonus: i.bonus, damage: i.damage, qty });

function ItemsSection({ c, editable }: { c: Combatant; editable: boolean }) {
  const t = useT();
  const [adding, setAdding] = useState(false);
  const [editing, setEditing] = useState<string | null>(null);
  const items = c.inventory ?? [];

  return (
    <Stack gap="xs">
      <Coins c={c} editable={editable} />
      {items.length === 0 && !adding && (
        <EmptyState icon={IconBackpack} text={t("sheet.items.empty")} compact />
      )}
      {items.map((i) => {
        if (editing === i.id) return <ItemForm key={i.id} c={c} item={i} onDone={() => setEditing(null)} />;
        const weapon = i.bonus !== undefined || !!i.damage;
        const stats = [i.bonus !== undefined ? fmtMod(i.bonus) : null, i.damage].filter(Boolean).join(" · ");
        return (
          <Stack key={i.id} gap={4}>
            <Group gap="xs" wrap="nowrap">
              <Stack gap={0} style={{ flex: 1, minWidth: 0 }}>
                <Text size="sm" fw={600} truncate title={i.name}>
                  {i.name}
                </Text>
                {(weapon || i.note) && (
                  <Text size="xs" c="dimmed" truncate title={[stats, i.note].filter(Boolean).join(" · ")}>
                    {[stats, i.note].filter(Boolean).join(" · ")}
                  </Text>
                )}
              </Stack>
              {editable && (
                <ActionIcon
                  variant="default"
                  onClick={() => act("item:upsert", itemPayload(c, i, i.qty - 1))}
                  disabled={i.qty === 0}
                  aria-label={t("sheet.items.less")}
                >
                  <IconMinus size={14} />
                </ActionIcon>
              )}
              <Badge variant="default" miw={36}>
                ×{i.qty}
              </Badge>
              {editable && (
                <>
                  <ActionIcon
                    variant="default"
                    onClick={() => act("item:upsert", itemPayload(c, i, i.qty + 1))}
                    aria-label={t("sheet.items.more")}
                  >
                    <IconPlus size={14} />
                  </ActionIcon>
                  <Tooltip label={t("selected.edit")}>
                    <ActionIcon variant="subtle" onClick={() => setEditing(i.id)} aria-label={t("sheet.items.editOf", { name: i.name })}>
                      <IconPencil size={14} />
                    </ActionIcon>
                  </Tooltip>
                  <Tooltip label={t("common.remove")}>
                    <ActionIcon
                      variant="subtle"
                      color="red"
                      onClick={() => act("item:remove", { id: c.id, itemId: i.id })}
                      aria-label={t("common.remove")}
                    >
                      <IconX size={14} />
                    </ActionIcon>
                  </Tooltip>
                </>
              )}
            </Group>
            {/* Arma: empunhada, entra nos ataques (aba Ataques e painel Dados). */}
            {weapon && editable && (
              <Tooltip label={t(i.wielded ? "sheet.items.sheatheTip" : "sheet.items.wieldTip")}>
                <Button
                  size="compact-xs"
                  variant={i.wielded ? "light" : "default"}
                  leftSection={<IconSword size={12} />}
                  onClick={() => act("item:wield", { id: c.id, itemId: i.id, wielded: !i.wielded })}
                  style={{ alignSelf: "flex-start" }}
                >
                  {t(i.wielded ? "sheet.items.wielded" : "sheet.items.wield")}
                </Button>
              </Tooltip>
            )}
          </Stack>
        );
      })}
      {adding && <ItemForm c={c} onDone={() => setAdding(false)} />}
      {editable && !adding && (
        <Button variant="default" onClick={() => setAdding(true)}>
          {t("sheet.items.add")}
        </Button>
      )}
    </Stack>
  );
}

/** Moedas: cada campo salva ao sair dele (Enter também). */
function Coins({ c, editable }: { c: Combatant; editable: boolean }) {
  const t = useT();
  const [draft, setDraft] = useState<Partial<Record<Coin, string | number>>>({});

  function commit(k: Coin) {
    if (draft[k] === undefined) return;
    const coins = { ...(c.coins ?? {}), [k]: Number(draft[k]) || 0 };
    setDraft((d) => ({ ...d, [k]: undefined }));
    void act("coins:set", { id: c.id, coins });
  }

  return (
    <SimpleGrid cols={5} spacing={4}>
      {COINS.map((k) => (
        <Tooltip key={k} label={t(`coin.${k}.name`)}>
          <NumberInput
            size="xs"
            label={t(`coin.${k}`)}
            min={0}
            max={LIMITS.coins}
            allowDecimal={false}
            allowNegative={false}
            thousandSeparator="."
            decimalSeparator=","
            readOnly={!editable}
            value={draft[k] ?? c.coins?.[k] ?? 0}
            onChange={(v) => setDraft((d) => ({ ...d, [k]: v }))}
            onBlur={() => commit(k)}
            onKeyDown={(e) => e.key === "Enter" && commit(k)}
          />
        </Tooltip>
      ))}
    </SimpleGrid>
  );
}

function ItemForm({ c, item, onDone }: { c: Combatant; item?: InventoryItem; onDone: () => void }) {
  const t = useT();
  const [name, setName] = useState(item?.name ?? "");
  const [qty, setQty] = useState<string | number>(item?.qty ?? 1);
  const [note, setNote] = useState(item?.note ?? "");
  const [bonus, setBonus] = useState<string | number>(item?.bonus ?? "");
  const [damage, setDamage] = useState(item?.damage ?? "");

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (
      (
        await act("item:upsert", {
          id: c.id,
          ...(item && { itemId: item.id }),
          name,
          qty: Number(qty) || 0,
          note: note || undefined,
          bonus: bonus === "" ? null : Number(bonus),
          damage: damage.trim() || undefined,
        })
      ).ok
    )
      onDone();
  }

  return (
    <Paper component="form" onSubmit={submit} p="sm" bg="dark.7">
      <Stack gap="xs">
        <Group gap="xs" wrap="nowrap" align="flex-start">
          <TextInput
            style={{ flex: 1 }}
            label={t("sheet.items.name")}
            autoFocus
            required
            maxLength={LIMITS.spellName}
            value={name}
            onChange={(e) => setName(e.currentTarget.value)}
          />
          <NumberInput
            w={72}
            label={t("sheet.items.qty")}
            min={0}
            max={LIMITS.itemQty}
            allowDecimal={false}
            allowNegative={false}
            value={qty}
            onChange={setQty}
          />
        </Group>
        <TextInput
          label={t("sheet.items.note")}
          maxLength={LIMITS.spellNote}
          value={note}
          onChange={(e) => setNote(e.currentTarget.value)}
        />
        {/* Arma: com bônus e/ou dano, o item pode ser empunhado. */}
        <Group grow gap="xs" align="flex-start">
          <NumberInput label={t("sheet.items.bonus")} min={-20} max={40} allowDecimal={false} value={bonus} onChange={setBonus} />
          <TextInput label={t("sheet.items.damage")} placeholder="1d8+3" maxLength={LIMITS.dice.exprLength} value={damage} onChange={(e) => setDamage(e.currentTarget.value)} />
        </Group>
        <Text size="xs" c="dimmed">
          {t("sheet.items.weaponHint")}
        </Text>
        <Group justify="flex-end" gap="xs">
          <Button variant="default" onClick={onDone}>
            {t("common.cancel")}
          </Button>
          <Button type="submit">{t(item ? "common.save" : "common.add")}</Button>
        </Group>
      </Stack>
    </Paper>
  );
}
