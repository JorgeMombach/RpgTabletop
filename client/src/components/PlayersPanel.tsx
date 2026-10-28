import { Badge, Box, Group, Stack, Text } from "@mantine/core";
import type { ClientState } from "@rpg/shared";
import { useT } from "../i18n";
import { Panel } from "./Panel";

export function PlayersPanel({ state }: { state: ClientState }) {
  const t = useT();
  const online = state.players.filter((p) => p.role === "player" && p.connected).length;

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
