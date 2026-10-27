import { ActionIcon, Group, Paper, Text, Tooltip } from "@mantine/core";
import { IconMoon, IconX } from "@tabler/icons-react";
import type { ClientState } from "@rpg/shared";
import { useState } from "react";
import { inTheDark } from "../format";
import { useT } from "../i18n";

/**
 * Lembrete de escuridão no mapa do jogador cujo personagem não tem visão no escuro.
 * Fechar esconde até a luz mudar.
 */
export function DarkReminder({ state }: { state: ClientState }) {
  const t = useT();
  const light = state.battle.weather.light;
  const [closedAt, setClosedAt] = useState<string | null>(null);
  const mine = inTheDark(state).filter((a) => a.ownerId === state.self.id);
  if (mine.length === 0 || closedAt === light) return null;
  return (
    <Paper className="map-hint dark-reminder" px="md" py="sm" shadow="md">
      <Group gap="sm" wrap="nowrap" align="flex-start">
        <IconMoon size={18} style={{ flex: "none", marginTop: 2 }} />
        <Text size="sm" style={{ flex: 1 }}>
          {t("dark.reminder", { names: mine.map((a) => a.name).join(", ") })}
        </Text>
        <Tooltip label={t("dark.close")}>
          <ActionIcon size="sm" variant="subtle" color="gray" aria-label={t("dark.close")} onClick={() => setClosedAt(light)}>
            <IconX size={14} />
          </ActionIcon>
        </Tooltip>
      </Group>
    </Paper>
  );
}
