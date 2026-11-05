import { ActionIcon, Button, Group, Paper, Select, Text, Tooltip } from "@mantine/core";
import { IconEye, IconFocusCentered, IconX } from "@tabler/icons-react";
import { useT } from "../i18n";
import { useApp } from "../store";
import { viewAs } from "../viewAs";

/**
 * Faixa no lugar da barra do mapa enquanto o mestre vê como um jogador (Passo 11): de quem é a visão (dá para
 * trocar), enquadrar e sair. O mapa embaixo é o que o jogador recebe; mover a visão e o zoom continuam.
 */
export function ViewAsBanner({ onFit }: { onFit: () => void }) {
  const t = useT();
  // Os jogadores vêm do estado do mestre (o do "ver como" é o do jogador).
  const players = useApp((s) => s.state?.players);
  const allies = useApp((s) => s.state?.allies);
  const viewingId = useApp((s) => s.viewAsId);
  const data = (players ?? [])
    .filter((p) => p.role === "player")
    .map((p) => {
      const char = allies?.find((a) => a.ownerId === p.id && !a.summonerId);
      return { value: p.id, label: char && char.name !== p.name ? `${p.name} (${char.name})` : p.name };
    });

  return (
    <Paper className="map-toolbar view-as-banner" p={4} px="sm" shadow="md" radius="md">
      <Group gap="xs" wrap="nowrap">
        <IconEye size={16} color="var(--mantine-color-player-4)" style={{ flex: "none" }} />
        <Text size="sm" style={{ flex: "none" }}>
          {t("viewAs.viewing")}
        </Text>
        <Select size="xs" w={170} data={data} value={viewingId} onChange={(v) => v && viewAs(v)} allowDeselect={false} comboboxProps={{ withinPortal: true }} aria-label={t("viewAs.who")} />
        <Tooltip label={t("map.fit")}>
          <ActionIcon variant="subtle" color="gray" onClick={onFit} aria-label={t("map.fit")}>
            <IconFocusCentered size={16} />
          </ActionIcon>
        </Tooltip>
        <Button size="compact-sm" variant="default" leftSection={<IconX size={12} />} onClick={() => viewAs(null)}>
          {t("viewAs.exit")}
        </Button>
      </Group>
    </Paper>
  );
}
