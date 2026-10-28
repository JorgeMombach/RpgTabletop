import { ActionIcon, Alert, Badge, Box, Button, Checkbox, Divider, Group, NumberInput, Stack, Text, Tooltip } from "@mantine/core";
import { IconCaretRightFilled, IconChevronDown, IconChevronUp, IconDice5, IconPlayerTrackNext, IconPlayerTrackPrev } from "@tabler/icons-react";
import { LIMITS, groupName, groupRange, type ClientState, type CombatantView } from "@rpg/shared";
import { useState, type FormEvent, type ReactNode } from "react";
import { act } from "../actions";
import { useT } from "../i18n";
import { confirmAction } from "../confirm";
import { allCombatants, fmtCondition } from "../format";
import { select, useApp } from "../store";
import { CombatantAvatar, HEX_CLIP } from "./CombatantAvatar";
import { Panel } from "./Panel";
import { TurnControls } from "./TurnControls";

export function InitiativePanel({ state }: { state: ClientState }) {
  const t = useT();
  const selectedId = useApp((s) => s.selectedId);
  const [grouped, setGrouped] = useState(false);
  const gm = state.self.role === "gm";
  const { combat } = state.battle;

  const all = allCombatants(state);
  const byId = new Map(all.map((c) => [c.id, c]));
  const order = combat.order.map((id) => byId.get(id)).filter((c): c is CombatantView => !!c);
  // Rolagem automática do mestre: só mobs no mapa e visíveis (E21). NPCs rolam um a um.
  const inField = state.battle.mobs.filter((m) => m.pos && !m.hidden).length;
  const currentId = combat.active ? combat.order[combat.turnIndex] : null;
  const canEdit = (c: CombatantView) => gm || (c.type === "ally" && c.ownerId === state.self.id);
  // Oculto fica fora da iniciativa até ser revelado.
  const pending = all.filter((c) => c.initiative === null && !c.hidden && canEdit(c));
  const myTurn = !gm && currentId !== null && byId.get(currentId)?.ownerId === state.self.id;

  async function rerollAll() {
    const ok = await confirmAction({
      title: t("init.rerollTitle"),
      message: t("init.rerollMessage"),
      confirmLabel: t("init.rerollConfirm"),
    });
    if (ok) void act("init:rerollAll", { grouped });
  }

  async function endCombat() {
    const ok = await confirmAction({
      title: t("init.endTitle"),
      message: t("init.endMessage"),
      confirmLabel: t("init.end"),
    });
    if (ok) void act("combat:end", {});
  }

  return (
    <Panel
      title={t("init.title")}
      highlighted={myTurn}
      aside={
        combat.active && (
          <Badge color="copper" variant="light" size="sm">
            {t("top.round", { round: combat.round })}
          </Badge>
        )
      }
    >
      {myTurn && (
        <Alert variant="filled" p={6} styles={{ message: { textAlign: "center", fontWeight: 700 } }}>
          {t("init.yourTurn")}
        </Alert>
      )}

      {gm && (
        <Group gap="xs" wrap="wrap">
          {combat.active ? (
            <>
              <Tooltip label={t("init.prev")}>
                <Button variant="default" onClick={() => act("combat:prev", {})} aria-label={t("init.prev")}>
                  <IconPlayerTrackPrev size={14} />
                </Button>
              </Tooltip>
              <Button style={{ flex: "1 1 120px" }} rightSection={<IconPlayerTrackNext size={14} />} onClick={() => act("combat:next", {})}>
                {t("init.next")}
              </Button>
              <Button variant="default" onClick={() => void endCombat()}>
                {t("init.end")}
              </Button>
              <Tooltip label={t("init.rerollTip")}>
                <Button variant="default" leftSection={<IconDice5 size={14} />} onClick={() => void rerollAll()}>
                  {t("init.reroll")}
                </Button>
              </Tooltip>
            </>
          ) : (
            <>
              <Tooltip
                label={
                  inField === 0
                    ? t("init.rollMobsNone")
                    : t("init.rollMobsTip")
                }
              >
                <Button variant="default" disabled={inField === 0} leftSection={<IconDice5 size={14} />} onClick={() => act("init:rollMobs", { grouped })}>
                  {t("init.rollMobs")}
                </Button>
              </Tooltip>
              <Button style={{ flex: "1 1 120px" }} disabled={order.length === 0} onClick={() => act("combat:start", {})}>
                {combat.round > 0 ? t("init.resume", { round: combat.round }) : t("init.start")}
              </Button>
            </>
          )}
        </Group>
      )}
      {combat.active && currentId && byId.get(currentId) && canEdit(byId.get(currentId)!) && <TurnControls state={state} current={byId.get(currentId)!} />}
      {gm && !combat.active && inField > 0 && (
        <Checkbox
          checked={grouped}
          onChange={(e) => setGrouped(e.currentTarget.checked)}
          label={t("init.grouped")}
        />
      )}

      {order.length === 0 ? (
        <Text size="xs" c="dimmed">
          {gm
            ? t("init.emptyGm")
            : t("init.emptyPlayer")}
        </Text>
      ) : (
        <ol className="init-list">
          {groupsOf(order).map(({ start, members }) => {
            const row = (c: CombatantView, i: number, current: boolean) => (
              <InitRow
                key={c.id}
                c={c}
                index={i}
                last={i === order.length - 1}
                current={current}
                selected={c.id === selectedId}
                mine={c.ownerId === state.self.id}
                // Na ordem, todo mundo já tem valor: mudar ou rolar de novo é com o mestre (iniciativa se rola uma vez).
                editable={gm}
                gm={gm}
              />
            );
            if (members.length === 1) return row(members[0], start, members[0].id === currentId);
            return (
              <GroupRow
                key={members[0].id}
                members={members}
                current={members.some((c) => c.id === currentId)}
                selected={members.some((c) => c.id === selectedId)}
              >
                {members.map((c, k) => row(c, start + k, false))}
              </GroupRow>
            );
          })}
        </ol>
      )}

      {pending.length > 0 && (
        <>
          <Divider label={t("init.pending")} labelPosition="left" />
          <Stack gap={6}>
            {pending.map((c) => (
              <PendingRow key={c.id} c={c} />
            ))}
          </Stack>
        </>
      )}
    </Panel>
  );
}

/** Ordem em blocos: cada combatente sozinho ou um grupo de mobs iguais lado a lado (agem juntos). */
function groupsOf(order: CombatantView[]): { start: number; members: CombatantView[] }[] {
  const ids = order.map((c) => c.id);
  const byId = new Map(order.map((c) => [c.id, c]));
  const out: { start: number; members: CombatantView[] }[] = [];
  for (let i = 0; i < order.length; ) {
    const end = groupRange(ids, i, (id) => byId.get(id))[1];
    out.push({ start: i, members: order.slice(i, end) });
    i = end;
  }
  return out;
}

/** Grupo de mobs iguais numa linha só ("Goblin 1–6"); abre para ver e editar cada um. */
function GroupRow({ members, current, selected, children }: { members: CombatantView[]; current: boolean; selected: boolean; children: ReactNode }) {
  const t = useT();
  const [open, setOpen] = useState(false);
  const head = members[0];
  const name = groupName(members.map((c) => c.name));
  const down = members.every((c) => c.hp !== undefined && c.hp <= 0);

  return (
    <li className={`init-row ${current ? "current" : ""} ${selected ? "selected" : ""} ${down ? "down" : ""}`} onClick={() => select(head.id)}>
      <Group gap={4} wrap="nowrap">
        <Text component="span" c="bronze.4" w={12} style={{ display: "flex", flex: "none" }} aria-label={current ? t("init.onTurn") : undefined}>
          {current && <IconCaretRightFilled size={12} />}
        </Text>
        <Box w={8} h={8} bg={head.color} style={{ borderRadius: 2, flex: "none" }} aria-hidden />
        <Text size="sm" fw={current ? 600 : 400} truncate title={members.map((c) => c.name).join(", ")} style={{ flex: 1, minWidth: 0 }}>
          {name}
        </Text>
        <Tooltip label={t("init.groupTip", { n: members.length })}>
          <Text size="sm" fw={700} miw={36} ta="center">
            {head.initiative}
          </Text>
        </Tooltip>
        <Tooltip label={open ? t("init.groupClose") : t("init.groupOpen")}>
          <ActionIcon
            size="sm"
            aria-label={open ? t("init.groupClose") : t("init.groupOpen")}
            aria-expanded={open}
            onClick={(e) => {
              e.stopPropagation();
              setOpen(!open);
            }}
          >
            {open ? <IconChevronUp size={14} /> : <IconChevronDown size={14} />}
          </ActionIcon>
        </Tooltip>
      </Group>
      {open && <ol className="init-list init-sub">{children}</ol>}
    </li>
  );
}

function InitRow(props: {
  c: CombatantView;
  index: number;
  last: boolean;
  current: boolean;
  selected: boolean;
  mine: boolean;
  editable: boolean;
  gm: boolean;
}) {
  const { c, index, last, current, selected, mine, editable, gm } = props;
  const t = useT();
  const [editing, setEditing] = useState<string | number | null>(null);
  const down = c.hp !== undefined && c.hp <= 0;

  function commit(e?: FormEvent) {
    e?.preventDefault();
    if (editing !== null && String(editing).trim() !== "") void act("init:set", { id: c.id, value: Number(editing) });
    setEditing(null);
  }

  const stop = (fn: () => void) => (e: { stopPropagation: () => void }) => {
    e.stopPropagation();
    fn();
  };

  return (
    <li className={`init-row ${current ? "current" : ""} ${selected ? "selected" : ""} ${down ? "down" : ""}`} onClick={stop(() => select(c.id))}>
      <Group gap={4} wrap="nowrap">
        <Text component="span" c="bronze.4" w={12} style={{ display: "flex", flex: "none" }} aria-label={current ? t("init.onTurn") : undefined}>
          {current && <IconCaretRightFilled size={12} />}
        </Text>
        <Box
          w={8}
          h={8}
          bg={c.color}
          style={{ borderRadius: c.type === "mob" ? 2 : "50%", clipPath: c.type === "npc" ? HEX_CLIP : undefined, flex: "none" }}
          aria-hidden
        />
        <Text size="sm" fw={current ? 600 : 400} truncate title={c.name} style={{ flex: 1, minWidth: 0 }}>
          {c.name}
          {mine && (
            <Text span size="xs" c="dimmed">
              {" "}
              {t("common.yours")}
            </Text>
          )}
        </Text>

        {editing !== null ? (
          <form onSubmit={commit} onClick={(e) => e.stopPropagation()}>
            <NumberInput
              w={56}
              autoFocus
              value={editing}
              min={LIMITS.initiative.min}
              max={LIMITS.initiative.max}
              allowDecimal={false}
              onChange={setEditing}
              onBlur={() => commit()}
              onKeyDown={(e) => e.key === "Escape" && setEditing(null)}
              aria-label={t("init.of", { name: c.name })}
            />
          </form>
        ) : (
          <Tooltip label={(c.initRoll !== null ? `d20: ${c.initRoll}` : t("init.typed")) + (editable ? ` · ${t("init.clickEdit")}` : "")}>
            <Button
              variant="subtle"
              color="gray"
              size="compact-sm"
              fw={700}
              miw={36}
              disabled={!editable}
              onClick={stop(() => setEditing(c.initiative ?? ""))}
            >
              {c.initiative}
            </Button>
          </Tooltip>
        )}

        {editable && (
          <Tooltip label={t("init.rollAgainTip")}>
            <ActionIcon size="sm" aria-label={t("init.rollAgainOf", { name: c.name })} onClick={stop(() => void act("init:roll", { id: c.id }))}>
              <IconDice5 size={16} />
            </ActionIcon>
          </Tooltip>
        )}
        {gm && (
          // Empilhados para sobrar largura para o nome em colunas estreitas.
          <Stack gap={0}>
            <Tooltip label={t("init.upTip")}>
              <ActionIcon size={16} disabled={index === 0} aria-label={t("init.up")} onClick={stop(() => void act("init:move", { id: c.id, toIndex: index - 1 }))}>
                <IconChevronUp size={12} stroke={2.5} />
              </ActionIcon>
            </Tooltip>
            <Tooltip label={t("init.downTip")}>
              <ActionIcon size={16} disabled={last} aria-label={t("init.down")} onClick={stop(() => void act("init:move", { id: c.id, toIndex: index + 1 }))}>
                <IconChevronDown size={12} stroke={2.5} />
              </ActionIcon>
            </Tooltip>
          </Stack>
        )}
      </Group>
      {c.conditions.length > 0 && (
        <Text size="xs" c="bronze.4" truncate pl={26} title={c.conditions.map(fmtCondition).join(", ")}>
          {c.conditions.map(fmtCondition).join(" · ")}
        </Text>
      )}
    </li>
  );
}

function PendingRow({ c }: { c: CombatantView }) {
  const t = useT();
  const [value, setValue] = useState<string | number>("");

  return (
    <Group
      component="form"
      gap="xs"
      wrap="nowrap"
      onSubmit={(e) => {
        e.preventDefault();
        if (String(value).trim()) void act("init:set", { id: c.id, value: Number(value) }).then((r) => r.ok && setValue(""));
      }}
    >
      <CombatantAvatar c={c} size={22} />
      <Text size="sm" truncate title={c.name} style={{ flex: 1, minWidth: 0 }}>
        {c.name}
      </Text>
      <Tooltip label={t("init.physicalTip")}>
        <NumberInput
          w={60}
          placeholder={t("init.value")}
          value={value}
          min={LIMITS.initiative.min}
          max={LIMITS.initiative.max}
          allowDecimal={false}
          onChange={setValue}
          aria-label={t("init.of", { name: c.name })}
        />
      </Tooltip>
      <Tooltip label={t("init.rollTip")}>
        <ActionIcon variant="default" size="md" aria-label={t("init.rollOf", { name: c.name })} onClick={() => act("init:roll", { id: c.id })}>
          <IconDice5 size={16} />
        </ActionIcon>
      </Tooltip>
    </Group>
  );
}
