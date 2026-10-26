import { ActionIcon, Button, Divider, Group, Stack, Text, Tooltip } from "@mantine/core";
import { IconEye, IconEyeOff, IconPencil, IconWand, IconX } from "@tabler/icons-react";
import { ALLY_COLORS, MOB_COLORS, NPC_COLORS, type ClientState, type Combatant } from "@rpg/shared";
import { useState } from "react";
import { act } from "../actions";
import { removeMob } from "../commands";
import { confirmAction } from "../confirm";
import { allCombatants, fmtMod } from "../format";
import { cellAt, placeFor } from "../map/geometry";
import { select, useApp } from "../store";
import { Abbr } from "./Abbr";
import { CombatantAvatar } from "./CombatantAvatar";
import { StatsSection } from "./StatsSection";
import { SummonForm } from "./SummonForm";
import { CombatantForm } from "./CombatantForm";
import { DeathSaves } from "./DeathSaves";
import { ConditionsSection } from "./ConditionsSection";
import { HpBar } from "./HpBar";
import { HpControl } from "./HpControl";
import { SheetTabs } from "./SheetTabs";
import { Panel } from "./Panel";

/** Coloca o token no quadrado livre mais perto do centro da visão do mapa. */
function placeOnMap(state: ClientState, id: string) {
  const { viewCenter } = useApp.getState();
  const all = allCombatants(state);
  const c = all.find((o) => o.id === id);
  if (c) void act("token:move", { id, pos: placeFor(c, cellAt(viewCenter, state.battle.map), all) });
}

const PALETTE = { ally: ALLY_COLORS, mob: MOB_COLORS, npc: NPC_COLORS };

const INIT = <Abbr title="Bônus de iniciativa (d20 + este valor)">Inic.</Abbr>;

export function SelectedPanel({ state }: { state: ClientState }) {
  const selectedId = useApp((s) => s.selectedId);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [summoningId, setSummoningId] = useState<string | null>(null);

  const gm = state.self.role === "gm";
  const ally = state.allies.find((a) => a.id === selectedId);
  const mobView = [...state.battle.mobs, ...state.battle.npcs].find((m) => m.id === selectedId);
  // Jogadores não recebem vida de mob nem de NPC, então só o mestre tem o combatente completo.
  const c: Combatant | undefined = ally ?? (gm ? (mobView as Combatant | undefined) : undefined);
  const close = (
    <Tooltip label="Fechar">
      <ActionIcon size="sm" onClick={() => select(null)} aria-label="Fechar">
        <IconX size={16} />
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
              {mobView.type === "npc" ? "NPC" : "Inimigo"}
              {mobView.animal && " · animal"}
            </Text>
          </div>
        </Group>
        <ConditionsSection c={mobView} editable={false} />
      </Panel>
    );
  }

  if (!c) {
    return (
      <Panel title="Selecionado">
        <Text size="xs" c="dimmed">
          Clique num aliado{gm ? ", mob ou NPC" : ""} (na lista ou no mapa) para ver e controlar a vida.
        </Text>
      </Panel>
    );
  }

  const canEdit = gm || c.ownerId === state.self.id;
  const owner = state.players.find((p) => p.id === c.ownerId);
  const editing = editingId === c.id;
  const summoner = c.summonerId ? allCombatants(state).find((o) => o.id === c.summonerId) : undefined;
  const summoning = summoningId === c.id;
  const kind =
    (c.type === "mob" ? "Mob" : c.type === "npc" ? "NPC" : owner ? `Aliado · ${owner.name}` : "Aliado") +
    (summoner ? ` · conjurado de ${summoner.name}` : "") +
    (c.summonRounds !== undefined ? ` · ${c.summonRounds} ${c.summonRounds === 1 ? "round" : "rounds"}` : "") +
    (c.animal ? " · animal" : "") +
    (c.hidden ? " · oculto" : "");

  async function remove(target: Combatant) {
    if (target.type !== "ally") return void removeMob(target);
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
          <Text size="xs" c="dimmed" truncate title={`${kind} · iniciativa ${fmtMod(c.dexMod)}`}>
            {kind} · {INIT} {fmtMod(c.dexMod)}
          </Text>
        </div>
        {canEdit && !editing && !summoning && (
          <Tooltip label="Mudar nome, vida, CA, iniciativa, atributos, cor e avatar">
            <Button variant="default" leftSection={<IconPencil size={14} />} onClick={() => setEditingId(c.id)}>
              Editar
            </Button>
          </Tooltip>
        )}
      </Group>

      {summoning ? (
        <SummonForm summoner={c} templates={state.templates} onClose={() => setSummoningId(null)} />
      ) : editing ? (
        <CombatantForm
          initial={c}
          palette={PALETTE[c.type]}
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
          <HpBar hp={c.hp} hpMax={c.hpMax} tempHp={c.tempHp} thick />
        </Stack>
      )}

      {!editing && !summoning && c.type === "ally" && c.hp <= 0 && <DeathSaves c={c} editable={canEdit} gm={gm} />}

      {!editing && !summoning && <StatsSection c={c} canRoll={canEdit} gm={gm} />}

      {!editing && !summoning && <ConditionsSection c={c} editable={canEdit} />}

      {!editing && !summoning && (c.type === "ally" || gm) && <SheetTabs c={c} editable={canEdit} gm={gm} />}

      {canEdit && !editing && !summoning && (
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
            {!c.summonerId && (
              <Tooltip label="Familiar, esqueletos, animais…: ficam do seu lado e você controla">
                <Button variant="default" leftSection={<IconWand size={14} />} onClick={() => setSummoningId(c.id)}>
                  Conjurar
                </Button>
              </Tooltip>
            )}
            {gm && c.type !== "ally" && (
              <Tooltip label={c.hidden ? "Os jogadores passam a ver; rola a iniciativa se ela já estiver em andamento" : "Só você vê; sai da iniciativa até revelar"}>
                <Button
                  variant="default"
                  leftSection={c.hidden ? <IconEye size={14} /> : <IconEyeOff size={14} />}
                  onClick={() => act("combatant:setHidden", { id: c.id, hidden: !c.hidden })}
                >
                  {c.hidden ? "Revelar" : "Ocultar"}
                </Button>
              </Tooltip>
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
