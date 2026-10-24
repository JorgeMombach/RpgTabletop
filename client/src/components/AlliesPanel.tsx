import { Button, Text } from "@mantine/core";
import { ALLY_COLORS, type ClientState } from "@rpg/shared";
import { useState } from "react";
import { act } from "../actions";
import { select, useApp } from "../store";
import { CombatantForm } from "./CombatantForm";
import { CombatantRow } from "./CombatantRow";
import { Panel } from "./Panel";

export function AlliesPanel({ state }: { state: ClientState }) {
  const selectedId = useApp((s) => s.selectedId);
  const [creating, setCreating] = useState(false);
  const gm = state.self.role === "gm";
  const hasOwn = state.allies.some((a) => a.ownerId === state.self.id);
  const ownerName = (id?: string) => state.players.find((p) => p.id === id)?.name;

  return (
    <Panel
      title="Aliados"
      aside={
        // Jogador tem um personagem só (o servidor também recusa um segundo).
        !creating &&
        (gm || !hasOwn) && (
          <Button variant="default" onClick={() => setCreating(true)}>
            {gm ? "+ Aliado (NPC)" : "+ Criar personagem"}
          </Button>
        )
      }
    >
      {creating && (
        <CombatantForm
          palette={ALLY_COLORS}
          submitLabel="Criar"
          onCancel={() => setCreating(false)}
          onSubmit={async (v) => {
            const res = await act("ally:create", v);
            if (res.ok) {
              setCreating(false);
              if (res.ids?.[0]) select(res.ids[0]);
            }
            return res.ok;
          }}
        />
      )}

      {state.allies.length === 0 && !creating && (
        <Text size="xs" c="dimmed">
          {gm ? "Os jogadores criam os próprios personagens." : "Crie seu personagem para controlar a vida."}
        </Text>
      )}

      {state.allies.length > 0 && (
        <ul className="list">
          {state.allies.map((a) => {
            const mine = a.ownerId === state.self.id;
            const owner = ownerName(a.ownerId);
            return (
              <CombatantRow
                key={a.id}
                c={a}
                selected={a.id === selectedId}
                suffix={mine ? "(seu)" : owner ? `· ${owner}` : undefined}
                draggable={gm || mine}
              />
            );
          })}
        </ul>
      )}
    </Panel>
  );
}
