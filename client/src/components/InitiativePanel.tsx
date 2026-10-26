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

const INIT_TIP = "Iniciativa = d20 + bônus de iniciativa";

export function InitiativePanel({ state }: { state: ClientState }) {
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
      title: "Rolar a iniciativa de novo?",
      message:
        "Todas as iniciativas são zeradas; os mobs em campo e os NPCs que já lutavam rolam agora, e os jogadores rolam de novo. O combate pausa neste round até você retomar.",
      confirmLabel: "Rolar de novo",
    });
    if (ok) void act("init:rerollAll", { grouped });
  }

  async function endCombat() {
    const ok = await confirmAction({
      title: "Encerrar o combate?",
      message: "As iniciativas e o round são zerados. Os combatentes continuam.",
      confirmLabel: "Encerrar",
    });
    if (ok) void act("combat:end", {});
  }

  return (
    <Panel
      title="Iniciativa"
      highlighted={myTurn}
      aside={
        combat.active && (
          <Badge color="copper" variant="light" size="sm">
            Round {combat.round}
          </Badge>
        )
      }
    >
      {myTurn && (
        <Alert variant="filled" p={6} styles={{ message: { textAlign: "center", fontWeight: 700 } }}>
          Sua vez!
        </Alert>
      )}

      {gm && (
        <Group gap="xs" wrap="wrap">
          {combat.active ? (
            <>
              <Tooltip label="Turno anterior">
                <Button variant="default" onClick={() => act("combat:prev", {})} aria-label="Turno anterior">
                  <IconPlayerTrackPrev size={14} />
                </Button>
              </Tooltip>
              <Button style={{ flex: "1 1 120px" }} rightSection={<IconPlayerTrackNext size={14} />} onClick={() => act("combat:next", {})}>
                Próximo turno
              </Button>
              <Button variant="default" onClick={() => void endCombat()}>
                Encerrar
              </Button>
              <Tooltip label={`Zera todas as iniciativas, rola os mobs em campo e os NPCs que já lutavam e pausa até os jogadores rolarem (${INIT_TIP})`}>
                <Button variant="default" leftSection={<IconDice5 size={14} />} onClick={() => void rerollAll()}>
                  Iniciativa de novo
                </Button>
              </Tooltip>
            </>
          ) : (
            <>
              <Tooltip
                label={
                  inField === 0
                    ? "Nenhum mob visível no mapa: coloque os tokens no mapa (ou revele os ocultos)"
                    : `Rola para os mobs no mapa e visíveis. NPCs entram quando você rolar a de cada um, abaixo (${INIT_TIP})`
                }
              >
                <Button variant="default" disabled={inField === 0} leftSection={<IconDice5 size={14} />} onClick={() => act("init:rollMobs", { grouped })}>
                  Rolar mobs em campo
                </Button>
              </Tooltip>
              <Button style={{ flex: "1 1 120px" }} disabled={order.length === 0} onClick={() => act("combat:start", {})}>
                {combat.round > 0 ? `Retomar (round ${combat.round})` : "Iniciar combate"}
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
          label="Uma rolagem por template (mobs iguais agem juntos)"
        />
      )}

      {order.length === 0 ? (
        <Text size="xs" c="dimmed">
          {gm
            ? "Role a iniciativa dos mobs em campo e, um a um, a dos NPCs que entram na luta; os jogadores rolam a dos personagens."
            : "Role sua iniciativa abaixo quando o mestre pedir."}
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
                editable={canEdit(c)}
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
          <Divider label="Sem iniciativa" labelPosition="left" />
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
        <Text component="span" c="bronze.4" w={12} style={{ display: "flex", flex: "none" }} aria-label={current ? "Na vez" : undefined}>
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
              (seu)
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
              aria-label={`Iniciativa de ${c.name}`}
            />
          </form>
        ) : (
          <Tooltip label={c.initRoll !== null ? `d20: ${c.initRoll}${editable ? " · clique para editar" : ""}` : `Valor informado${editable ? " · clique para editar" : ""}`}>
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
          <Tooltip label={`Rolar de novo (${INIT_TIP})`}>
            <ActionIcon size="sm" aria-label={`Rolar iniciativa de ${c.name} de novo`} onClick={stop(() => void act("init:roll", { id: c.id }))}>
              <IconDice5 size={16} />
            </ActionIcon>
          </Tooltip>
        )}
        {gm && (
          // Empilhados para sobrar largura para o nome em colunas estreitas.
          <Stack gap={0}>
            <Tooltip label="Subir (desempate)">
              <ActionIcon size={16} disabled={index === 0} aria-label="Subir" onClick={stop(() => void act("init:move", { id: c.id, toIndex: index - 1 }))}>
                <IconChevronUp size={12} stroke={2.5} />
              </ActionIcon>
            </Tooltip>
            <Tooltip label="Descer (desempate)">
              <ActionIcon size={16} disabled={last} aria-label="Descer" onClick={stop(() => void act("init:move", { id: c.id, toIndex: index + 1 }))}>
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
      <Tooltip label="Valor do dado físico (d20 + bônus de iniciativa). Enter confirma.">
        <NumberInput
          w={60}
          placeholder="Valor"
          value={value}
          min={LIMITS.initiative.min}
          max={LIMITS.initiative.max}
          allowDecimal={false}
          onChange={setValue}
          aria-label={`Iniciativa de ${c.name}`}
        />
      </Tooltip>
      <Tooltip label={`Rolar iniciativa (${INIT_TIP})`}>
        <ActionIcon variant="default" size="md" aria-label={`Rolar iniciativa de ${c.name}`} onClick={() => act("init:roll", { id: c.id })}>
          <IconDice5 size={16} />
        </ActionIcon>
      </Tooltip>
    </Group>
  );
}
