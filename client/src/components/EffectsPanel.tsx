import { ActionIcon, Badge, Group, Stack, Switch, Text, Tooltip } from "@mantine/core";
import type { ClientState } from "@rpg/shared";
import { act } from "../actions";
import { allCombatants } from "../format";
import { EffectSwatch } from "./FixEffectModal";
import { Panel } from "./Panel";

/** Efeitos persistentes no mapa (E19): quem conjurou, rounds restantes, ligar/desligar e remover. */
export function EffectsPanel({ state }: { state: ClientState }) {
  const gm = state.self.role === "gm";
  const { effects } = state.battle;
  const nameOf = (id: string | null) => (id ? allCombatants(state).find((c) => c.id === id)?.name : undefined);

  return (
    <Panel
      title="Efeitos no mapa"
      aside={
        <Badge variant="default" size="sm">
          {effects.length}
        </Badge>
      }
    >
      {effects.length === 0 ? (
        <Text size="xs" c="dimmed">
          Nenhum efeito. No mapa, use ✦ Área e depois “Fixar como efeito”.
        </Text>
      ) : (
        <Stack gap={6}>
          {effects.map((e) => {
            const canEdit = gm || e.ownerId === state.self.id;
            const caster = nameOf(e.casterId) ?? "ambiente";
            const detail = `${caster}${e.rounds !== null ? ` · ${e.rounds} round(s)` : ""}${e.concentration ? " · concentração" : ""}`;
            return (
              <Group key={e.id} gap="xs" wrap="nowrap" style={{ opacity: e.active ? 1 : 0.55 }}>
                <EffectSwatch preset={e.preset} color={e.color} size={24} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <Text size="sm" truncate title={e.name}>
                    {e.name}
                  </Text>
                  <Text size="xs" c="dimmed" truncate title={detail}>
                    {detail}
                  </Text>
                </div>
                {canEdit && (
                  <Tooltip label={e.active ? "Desligar (fica guardado; só o mestre vê)" : "Ligar"}>
                    <Switch
                      size="xs"
                      checked={e.active}
                      onChange={(ev) => void act("effect:toggle", { id: e.id, active: ev.currentTarget.checked })}
                      aria-label={`${e.active ? "Desligar" : "Ligar"} ${e.name}`}
                    />
                  </Tooltip>
                )}
                {canEdit && (
                  <Tooltip label="Remover efeito">
                    <ActionIcon size="sm" aria-label={`Remover ${e.name}`} onClick={() => act("effect:remove", { id: e.id })}>
                      🗑
                    </ActionIcon>
                  </Tooltip>
                )}
              </Group>
            );
          })}
        </Stack>
      )}
    </Panel>
  );
}
