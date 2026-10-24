import { Badge, Box, Group, Stack, Text } from "@mantine/core";
import type { ClientState } from "@rpg/shared";
import { Panel } from "./Panel";

export function PlayersPanel({ state }: { state: ClientState }) {
  const online = state.players.filter((p) => p.role === "player" && p.connected).length;

  return (
    <Panel
      title="Na sessão"
      aside={
        <Text size="xs" c="dimmed">
          {online}/{state.maxPlayers} jogadores
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
                  (você)
                </Text>
              )}
            </Text>
            {p.role === "gm" ? (
              <Badge size="xs" variant="light">
                Mestre
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
