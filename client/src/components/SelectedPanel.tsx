import { ActionIcon, Button, Divider, Group, Stack, Text, Tooltip } from "@mantine/core";
import { ALLY_COLORS, MOB_COLORS, type ClientState, type Combatant } from "@rpg/shared";
import { useState } from "react";
import { act } from "../actions";
import { removeMob } from "../commands";
import { confirmAction } from "../confirm";
import { fmtMod } from "../format";
import { cellAt, nearestFreeCell } from "../map/geometry";
import { select, useApp } from "../store";
import { Abbr } from "./Abbr";
import { CombatantAvatar } from "./CombatantAvatar";
import { CombatantForm } from "./CombatantForm";
import { HpBar } from "./HpBar";
import { HpControl } from "./HpControl";
import { MagicSection } from "./MagicSection";
import { Panel } from "./Panel";

/** Coloca o token no quadrado livre mais perto do centro da visão do mapa. */
function placeOnMap(state: ClientState, id: string) {
  const { viewCenter } = useApp.getState();
  const occupied = [...state.allies, ...state.battle.mobs].flatMap((c) => (c.pos ? [c.pos] : []));
  void act("token:move", { id, pos: nearestFreeCell(cellAt(viewCenter, state.battle.map), occupied) });
}

const DES = <Abbr title="Modificador de Destreza (usado na iniciativa: d20 + mod. DES)">DES</Abbr>;

export function SelectedPanel({ state }: { state: ClientState }) {
  const selectedId = useApp((s) => s.selectedId);
  const [editingId, setEditingId] = useState<string | null>(null);

  const gm = state.self.role === "gm";
  const ally = state.allies.find((a) => a.id === selectedId);
  const mobView = state.battle.mobs.find((m) => m.id === selectedId);
  // Jogadores não recebem vida de mob, então só o mestre tem o mob completo.
  const c: Combatant | undefined = ally ?? (gm ? (mobView as Combatant | undefined) : undefined);
  const close = (
    <Tooltip label="Fechar">
      <ActionIcon size="sm" onClick={() => select(null)} aria-label="Fechar">
        ✕
      </ActionIcon>
    </Tooltip>
  );

  if (!c && mobView) {
    return (
      <Panel title="Selecionado" aside={close}>
        <Group gap="sm" wrap="nowrap">
          <CombatantAvatar c={mobView} />
          <div style={{ minWidth: 0 }}>
            <Text fw={600} truncate title={mobView.name}>
              {mobView.name}
            </Text>
            <Text size="xs" c="dimmed">
              Inimigo
            </Text>
          </div>
        </Group>
      </Panel>
    );
  }

  if (!c) {
    return (
      <Panel title="Selecionado">
        <Text size="xs" c="dimmed">
          Clique num aliado{gm ? " ou mob" : ""} (na lista ou no mapa) para ver e controlar a vida.
        </Text>
      </Panel>
    );
  }

  const canEdit = gm || c.ownerId === state.self.id;
  const owner = state.players.find((p) => p.id === c.ownerId);
  const editing = editingId === c.id;
  const kind = c.type === "mob" ? "Mob" : owner ? `Aliado · ${owner.name}` : "Aliado";

  async function remove(target: Combatant) {
    if (target.type === "mob") return void removeMob(target);
    const ok = await confirmAction({ title: `Remover ${target.name}?`, message: "O personagem sai da sessão.", confirmLabel: "Remover", danger: true });
    if (ok) void act("ally:remove", { id: target.id }).then((r) => r.ok && select(null));
  }

  return (
    <Panel title="Selecionado" aside={close}>
      <Group gap="sm" wrap="nowrap">
        <CombatantAvatar c={c} />
        <div style={{ minWidth: 0, flex: 1 }}>
          <Text fw={600} truncate title={c.name}>
            {c.name}
          </Text>
          <Text size="xs" c="dimmed" truncate title={`${kind} · mod. DES ${fmtMod(c.dexMod)}`}>
            {kind} · {DES} {fmtMod(c.dexMod)}
          </Text>
        </div>
        {canEdit && !editing && (
          <Tooltip label="Mudar nome, vida máxima, mod. DES, cor e avatar">
            <Button variant="default" onClick={() => setEditingId(c.id)}>
              ✎ Editar
            </Button>
          </Tooltip>
        )}
      </Group>

      {editing ? (
        <CombatantForm
          initial={c}
          palette={c.type === "mob" ? MOB_COLORS : ALLY_COLORS}
          submitLabel="Salvar"
          onCancel={() => setEditingId(null)}
          onSubmit={async (v) => {
            const ok = (await act("combatant:update", { id: c.id, ...v })).ok;
            if (ok) setEditingId(null);
            return ok;
          }}
        />
      ) : canEdit ? (
        <HpControl c={c} />
      ) : (
        <Stack gap="xs">
          <Text fz={24} fw={700} lh={1.1}>
            {c.hp}{" "}
            <Text span size="lg" c="dimmed" fw={400}>
              / {c.hpMax}
            </Text>
          </Text>
          <HpBar hp={c.hp} hpMax={c.hpMax} thick />
        </Stack>
      )}

      {c.type === "ally" && !editing && <MagicSection c={c} editable={canEdit} />}

      {canEdit && !editing && (
        <>
          <Divider />
          <Group justify="space-between" gap="xs" wrap="wrap">
            {c.pos ? (
              <Button variant="default" onClick={() => act("token:move", { id: c.id, pos: null })}>
                Tirar do mapa
              </Button>
            ) : (
              <Button variant="default" onClick={() => placeOnMap(state, c.id)}>
                Colocar no mapa
              </Button>
            )}
            <Button variant="subtle" color="red" onClick={() => void remove(c)}>
              Remover
            </Button>
          </Group>
        </>
      )}
    </Panel>
  );
}
