import { ActionIcon, Badge, Box, Group, Stack, Text, Tooltip } from "@mantine/core";
import { IconEye } from "@tabler/icons-react";
import type { ClientState } from "@rpg/shared";
import { useT } from "../i18n";
import { Panel } from "./Panel";
import { useApp } from "../store";
import { viewAs } from "../viewAs";

export function PlayersPanel({ state }: { state: ClientState }) {
  const t = useT();
  const online = state.players.filter((p) => p.role === "player" && p.connected).length;
  const gm = state.self.role === "gm";
  const viewingId = useApp((s) => s.viewAsId);

  return (
    <Panel
      title={t("players.title")}
      aside={
        <Text size="xs" c="dimmed">
          {t("players.count", { n: online, max: state.maxPlayers })}
        </Text>
      }
    >
      <Stack gap={6}>
        {state.players.map((p) => (
          <Group key={p.id} gap="sm" wrap="nowrap">
            <Box
              w={8}
              h={8}
              bg={p.connected ? "copper.4" : "dark.3"}
              style={{ borderRadius: "50%", flex: "none" }}
              aria-label={p.connected ? "online" : "offline"}
            />
            <Text size="sm" c={p.connected ? undefined : "dimmed"} truncate title={p.name} style={{ flex: 1, minWidth: 0 }}>
              {p.name}
              {p.id === state.self.id && (
                <Text span size="xs" c="dimmed">
                  {" "}
                  {t("players.you")}
                </Text>
              )}
            </Text>
            {gm && p.role === "player" && (
              <Tooltip label={t("viewAs.tip", { name: p.name })}>
                <ActionIcon variant={viewingId === p.id ? "filled" : "subtle"} color={viewingId === p.id ? undefined : "gray"} size="sm" aria-label={t("viewAs.tip", { name: p.name })} aria-pressed={viewingId === p.id} onClick={() => viewAs(viewingId === p.id ? null : p.id)}>
                  <IconEye size={14} />
                </ActionIcon>
              </Tooltip>
            )}
            {p.role === "gm" ? (
              <Badge size="xs" variant="light">
                {t("common.gm")}
              </Badge>
            ) : (
              !p.connected && (
                <Text size="xs" c="dimmed">
                  offline
                </Text>
              )
            )}
          </Group>
        ))}
      </Stack>
    </Panel>
  );
}
