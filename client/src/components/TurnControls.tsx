import { Button, Chip, Group, Menu, Stack, Text, Tooltip } from "@mantine/core";
import { IconClockPause, IconPlayerTrackNext } from "@tabler/icons-react";
import { TURN_ACTIONS, groupName, groupRange, type ClientState, type CombatantView, type TurnAction } from "@rpg/shared";
import { act } from "../actions";
import { useT, type MessageKey } from "../i18n";

const ACTION_LABEL: Record<TurnAction, MessageKey> = {
  action: "turn.action",
  bonus: "turn.bonus",
  move: "turn.move",
  reaction: "turn.reaction",
};

/**
 * A vez de quem está agindo (no painel Iniciativa): ações gastas (Ação, Ação bônus, Movimento, Reação),
 * passar a vez e atrasar ("agir depois de…"). Aparece para quem controla o combatente da vez: o dono ou o mestre.
 * O mestre já tem o Próximo turno; para ele, "Passar" não aparece.
 */
export function TurnControls({ state, current }: { state: ClientState; current: CombatantView }) {
  const t = useT();
  const gm = state.self.role === "gm";
  const { combat } = state.battle;
  const used = new Set(current.turnUsed ?? []);
  const byId = new Map([...state.allies, ...state.battle.mobs, ...state.battle.npcs].map((c) => [c.id, c]));
  // Só dá para esperar quem ainda vai agir neste round (depois do grupo inteiro, se for um grupo).
  const [start, end] = groupRange(combat.order, combat.turnIndex, (id) => byId.get(id));
  const name = groupName(combat.order.slice(start, end).map((id) => byId.get(id)?.name ?? ""));
  const later = combat.order.slice(end).flatMap((id) => byId.get(id) ?? []);

  return (
    <Stack gap={6} className="turn-controls">
      <Text size="xs" c="dimmed">
        {t("turn.of", { name })}
      </Text>
      <Group gap={4}>
        {TURN_ACTIONS.map((a) => (
          <Chip
            key={a}
            size="xs"
            variant="outline"
            checked={used.has(a)}
            // Grupo de mobs iguais: marca para todos.
            onChange={(checked) => {
              for (const id of combat.order.slice(start, end)) void act("turn:use", { id, what: a, used: checked });
            }}
          >
            {t(ACTION_LABEL[a])}
          </Chip>
        ))}
      </Group>
      <Group gap="xs" wrap="wrap">
        {!gm && (
          <Tooltip label={t("turn.passTip")}>
            <Button style={{ flex: "1 1 auto" }} rightSection={<IconPlayerTrackNext size={14} />} onClick={() => act("combat:pass", {})}>
              {t("turn.pass")}
            </Button>
          </Tooltip>
        )}
        <Menu position="bottom-end" withinPortal disabled={later.length === 0}>
          <Menu.Target>
            <Tooltip label={later.length === 0 ? t("turn.delayNone") : t("turn.delayTip")}>
              <Button variant="default" style={{ flex: "1 1 auto" }} leftSection={<IconClockPause size={14} />} disabled={later.length === 0}>
                {t("turn.delay")}
              </Button>
            </Tooltip>
          </Menu.Target>
          <Menu.Dropdown>
            <Menu.Label>{t("turn.delayLabel")}</Menu.Label>
            {later.map((c) => (
              <Menu.Item key={c.id} onClick={() => act("combat:delay", { afterId: c.id })}>
                {c.name}
              </Menu.Item>
            ))}
          </Menu.Dropdown>
        </Menu>
      </Group>
    </Stack>
  );
}
