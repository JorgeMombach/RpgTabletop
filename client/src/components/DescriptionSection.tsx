import { Group, Paper, Stack, Text } from "@mantine/core";
import { IconLock } from "@tabler/icons-react";
import type { Combatant, CombatantView } from "@rpg/shared";
import { useT } from "../i18n";

/**
 * Descrição (todos veem: "dragão ancião de neve…") e, para o mestre, as notas dele (o servidor nem
 * envia as notas aos jogadores). Sem nenhuma das duas, não ocupa espaço.
 */
export function DescriptionSection({ c, gm }: { c: Combatant | CombatantView; gm: boolean }) {
  const t = useT();
  const notes = gm ? c.gmNotes : undefined;
  if (!c.description && !notes) return null;
  return (
    <Stack gap={6}>
      {c.description && (
        <Text size="sm" style={{ whiteSpace: "pre-wrap" }}>
          {c.description}
        </Text>
      )}
      {notes && (
        <Paper p={6} radius="sm" bg="dark.6" withBorder>
          <Group gap={4} wrap="nowrap" mb={2}>
            <IconLock size={12} />
            <Text size="xs" c="dimmed" fw={600}>
              {t("form.notesTitle")}
            </Text>
          </Group>
          <Text size="xs" style={{ whiteSpace: "pre-wrap" }}>
            {notes}
          </Text>
        </Paper>
      )}
    </Stack>
  );
}
