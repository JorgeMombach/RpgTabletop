import { Button, Group } from "@mantine/core";
import { ALLY_COLORS, type ClientState } from "@rpg/shared";
import { useState } from "react";
import { act } from "../actions";
import { useT } from "../i18n";
import { select, useApp } from "../store";
import { CombatantForm } from "./CombatantForm";
import { CombatantRow } from "./CombatantRow";
import { Panel } from "./Panel";
import { EmptyState } from "./EmptyState";
import { IconUsers } from "@tabler/icons-react";
import { RestAllMenu } from "./RestButton";

export function AlliesPanel({ state }: { state: ClientState }) {
  const selectedId = useApp((s) => s.selectedId);
  const [creating, setCreating] = useState(false);
  const gm = state.self.role === "gm";
  // Conjurados (E21) não contam como o personagem do jogador.
  const hasOwn = state.allies.some((a) => a.ownerId === state.self.id && !a.summonerId);
  const t = useT();
  const ownerName = (id?: string) => state.players.find((p) => p.id === id)?.name;

  return (
    <Panel
      title={t("allies.title")}
      aside={
        <Group gap={4} wrap="nowrap">
          {gm && state.allies.length > 0 && <RestAllMenu />}
          {/* Jogador tem um personagem só (o servidor também recusa um segundo). */}
          {!creating && (gm || !hasOwn) && (
            <Button variant="default" onClick={() => setCreating(true)}>
              {gm ? t("allies.add") : t("allies.create")}
            </Button>
          )}
        </Group>
      }
    >
      {creating && (
        <CombatantForm
          palette={ALLY_COLORS}
          withNotes={gm}
          withDarkvision
          submitLabel={t("allies.createSubmit")}
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
        <EmptyState icon={IconUsers} title={t("empty.allies")} text={gm ? t("allies.emptyGm") : t("allies.empty")} />
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
                suffix={mine ? t("common.yours") : owner ? `· ${owner}` : undefined}
                draggable={gm || mine}
              />
            );
          })}
        </ul>
      )}
    </Panel>
  );
}
