import { ActionIcon, Badge, Text, Tooltip } from "@mantine/core";
import type { Combatant } from "@rpg/shared";
import { removeMob } from "../commands";
import { useApp } from "../store";
import { CombatantRow } from "./CombatantRow";
import { Panel } from "./Panel";

/** Mestre: mobs da batalha atual. */
export function MobsPanel({ mobs }: { mobs: Combatant[] }) {
  const selectedId = useApp((s) => s.selectedId);

  return (
    <Panel
      title="Mobs na batalha"
      aside={
        <Badge variant="default" size="sm">
          {mobs.length}
        </Badge>
      }
    >
      {mobs.length === 0 ? (
        <Text size="xs" c="dimmed">
          Nenhum mob. Adicione pelo bestiário.
        </Text>
      ) : (
        <ul className="list">
          {mobs.map((m) => (
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
                    🗑
                  </ActionIcon>
                </Tooltip>
              }
            />
          ))}
        </ul>
      )}
    </Panel>
  );
}
