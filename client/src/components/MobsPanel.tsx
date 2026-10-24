import { ActionIcon, Badge, Button, Text, Tooltip } from "@mantine/core";
import { IconTrash } from "@tabler/icons-react";
import { NPC_COLORS, type Combatant } from "@rpg/shared";
import { useState } from "react";
import { act } from "../actions";
import { removeMob } from "../commands";
import { select, useApp } from "../store";
import { CombatantForm } from "./CombatantForm";
import { CombatantRow } from "./CombatantRow";
import { Panel } from "./Panel";

/** Lista de mobs ou NPCs (só o mestre), com remover + "Desfazer". */
function GmList({ list, empty }: { list: Combatant[]; empty: string }) {
  const selectedId = useApp((s) => s.selectedId);
  if (list.length === 0)
    return (
      <Text size="xs" c="dimmed">
        {empty}
      </Text>
    );
  return (
    <ul className="list">
      {list.map((m) => (
        <CombatantRow
          key={m.id}
          c={m}
          selected={m.id === selectedId}
          draggable
          trailing={
            <Tooltip label="Remover da batalha (dá para desfazer)">
              <ActionIcon
                size="sm"
                aria-label={`Remover ${m.name}`}
                onClick={(e) => {
                  e.stopPropagation();
                  void removeMob(m);
                }}
              >
                <IconTrash size={16} />
              </ActionIcon>
            </Tooltip>
          }
        />
      ))}
    </ul>
  );
}

const count = (n: number) => (
  <Badge variant="default" size="sm">
    {n}
  </Badge>
);

/** Mestre: mobs da batalha atual. */
export function MobsPanel({ mobs }: { mobs: Combatant[] }) {
  return (
    <Panel title="Mobs na batalha" aside={count(mobs.length)}>
      <GmList list={mobs} empty="Nenhum mob. Adicione pelo bestiário." />
    </Panel>
  );
}

/** Mestre: NPCs neutros (vida oculta para os jogadores, como a dos mobs). */
export function NpcsPanel({ npcs }: { npcs: Combatant[] }) {
  const [creating, setCreating] = useState(false);

  return (
    <Panel
      title="NPCs"
      aside={
        !creating && (
          <Tooltip label="Personagem neutro controlado por você; os jogadores não veem a vida">
            <Button variant="default" onClick={() => setCreating(true)}>
              + NPC
            </Button>
          </Tooltip>
        )
      }
    >
      {creating && (
        <CombatantForm
          palette={NPC_COLORS}
          submitLabel="Adicionar NPC"
          onCancel={() => setCreating(false)}
          onSubmit={async (v) => {
            const res = await act("npc:add", v);
            if (res.ok) {
              setCreating(false);
              if (res.ids?.[0]) select(res.ids[0]);
            }
            return res.ok;
          }}
        />
      )}
      {!creating && <GmList list={npcs} empty="Nenhum NPC. Crie aqui ou pelo bestiário (botão NPC no template)." />}
    </Panel>
  );
}
