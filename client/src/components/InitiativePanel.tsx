import { ActionIcon, Alert, Badge, Box, Button, Checkbox, Divider, Group, NumberInput, Stack, Text, Tooltip } from "@mantine/core";
import { LIMITS, type ClientState, type CombatantView } from "@rpg/shared";
import { useState, type FormEvent } from "react";
import { act } from "../actions";
import { confirmAction } from "../confirm";
import { select, useApp } from "../store";
import { CombatantAvatar } from "./CombatantAvatar";
import { Panel } from "./Panel";

const INIT_TIP = "Iniciativa = d20 + mod. DES";

export function InitiativePanel({ state }: { state: ClientState }) {
  const selectedId = useApp((s) => s.selectedId);
  const [grouped, setGrouped] = useState(false);
  const gm = state.self.role === "gm";
  const { combat } = state.battle;

  const all: CombatantView[] = [...state.allies, ...state.battle.mobs];
  const byId = new Map(all.map((c) => [c.id, c]));
  const order = combat.order.map((id) => byId.get(id)).filter((c): c is CombatantView => !!c);
  const currentId = combat.active ? combat.order[combat.turnIndex] : null;
  const canEdit = (c: CombatantView) => gm || (c.type === "ally" && c.ownerId === state.self.id);
  const pending = all.filter((c) => c.initiative === null && canEdit(c));
  const myTurn = !gm && currentId !== null && byId.get(currentId)?.ownerId === state.self.id;

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
          <Badge variant="light" size="sm">
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
                  ◀
                </Button>
              </Tooltip>
              <Button style={{ flex: "1 1 120px" }} onClick={() => act("combat:next", {})}>
                Próximo turno ▶
              </Button>
              <Button variant="default" onClick={() => void endCombat()}>
                Encerrar
              </Button>
            </>
          ) : (
            <>
              <Tooltip label={`Rola para todos os mobs (${INIT_TIP})`}>
                <Button variant="default" disabled={state.battle.mobs.length === 0} onClick={() => act("init:rollMobs", { grouped })}>
                  🎲 Rolar mobs
                </Button>
              </Tooltip>
              <Button style={{ flex: "1 1 120px" }} disabled={order.length === 0} onClick={() => act("combat:start", {})}>
                Iniciar combate
              </Button>
            </>
          )}
        </Group>
      )}
      {gm && !combat.active && state.battle.mobs.length > 0 && (
        <Checkbox
          checked={grouped}
          onChange={(e) => setGrouped(e.currentTarget.checked)}
          label="Uma rolagem por template (mobs iguais agem juntos)"
        />
      )}

      {order.length === 0 ? (
        <Text size="xs" c="dimmed">
          {gm ? "Role a iniciativa dos mobs; os jogadores rolam a dos personagens." : "Role sua iniciativa abaixo quando o mestre pedir."}
        </Text>
      ) : (
        <ol className="init-list">
          {order.map((c, i) => (
            <InitRow
              key={c.id}
              c={c}
              index={i}
              last={i === order.length - 1}
              current={c.id === currentId}
              selected={c.id === selectedId}
              mine={c.ownerId === state.self.id}
              editable={canEdit(c)}
              gm={gm}
            />
          ))}
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
    <li className={`init-row ${current ? "current" : ""} ${selected ? "selected" : ""} ${down ? "down" : ""}`} onClick={() => select(c.id)}>
      <Group gap={4} wrap="nowrap">
        <Text size="xs" c="gold.4" w={10} aria-label={current ? "Na vez" : undefined}>
          {current ? "▶" : ""}
        </Text>
        <Box w={8} h={8} bg={c.color} style={{ borderRadius: c.type === "mob" ? 2 : "50%", flex: "none" }} aria-hidden />
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
              🎲
            </ActionIcon>
          </Tooltip>
        )}
        {gm && (
          <Group gap={0} wrap="nowrap">
            <Tooltip label="Subir (desempate)">
              <ActionIcon size="xs" disabled={index === 0} aria-label="Subir" onClick={stop(() => void act("init:move", { id: c.id, toIndex: index - 1 }))}>
                ▲
              </ActionIcon>
            </Tooltip>
            <Tooltip label="Descer (desempate)">
              <ActionIcon size="xs" disabled={last} aria-label="Descer" onClick={stop(() => void act("init:move", { id: c.id, toIndex: index + 1 }))}>
                ▼
              </ActionIcon>
            </Tooltip>
          </Group>
        )}
      </Group>
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
      <Tooltip label="Valor do dado físico (d20 + mod. DES). Enter confirma.">
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
          🎲
        </ActionIcon>
      </Tooltip>
    </Group>
  );
}
