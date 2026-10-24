import { Alert, Badge, Button, Center, Loader, Paper, Stack, Text, TextInput, Title } from "@mantine/core";
import { APP_VERSION, NAME_MAX_LENGTH, type JoinError } from "@rpg/shared";
import { useState, type FormEvent } from "react";
import { join, savedName } from "../session";
import { useApp } from "../store";
import { D20Emblem } from "./D20Emblem";

const ERRORS: Record<JoinError, string> = {
  invalid_name: "Digite um nome.",
  room_full: "Sala cheia: o limite de jogadores foi atingido.",
};

/**
 * Arte de fundo opcional: um arquivo `client/src/assets/login-bg.(jpg|png|webp)` vira o fundo da tela.
 * Sem ele, o fundo é o padrão em CSS (grid de mapa sobre gradiente).
 */
const customArt = Object.values(
  import.meta.glob<string>("../assets/login-bg.{jpg,jpeg,png,webp}", { eager: true, query: "?url", import: "default" }),
)[0];

export function JoinScreen() {
  const { connected, probedRole, joining, joinError } = useApp();
  const [name, setName] = useState(savedName);
  const gm = probedRole === "gm";

  function submit(e: FormEvent) {
    e.preventDefault();
    if (name.trim()) void join(name);
  }

  return (
    <main
      className="join"
      style={
        customArt
          ? { backgroundImage: `linear-gradient(rgb(11 12 15 / 0.55), rgb(11 12 15 / 0.85)), url(${customArt})` }
          : undefined
      }
    >
      <Paper component="form" onSubmit={submit} className="join-card" p="xl" radius="lg" shadow="xl">
        <Stack gap="lg" align="stretch">
          <Center>
            <D20Emblem />
          </Center>
          <Stack gap={4} align="center">
            <Title order={1} ta="center" c="gold.3">
              Jamal's Tabletop
            </Title>
            <Text size="sm" c="dimmed" ta="center">
              A mesa de combate do seu grupo
            </Text>
          </Stack>

          <Center>
            {!connected ? (
              <Badge variant="default" leftSection={<Loader size={10} />}>
                Conectando ao servidor…
              </Badge>
            ) : (
              <Text size="sm">
                Você vai entrar como{" "}
                <Badge color={gm ? "gold" : "player"} variant="light">
                  {gm ? "Mestre (host)" : "Jogador"}
                </Badge>
              </Text>
            )}
          </Center>

          <TextInput
            size="sm"
            label="Seu nome"
            autoFocus
            value={name}
            maxLength={NAME_MAX_LENGTH}
            onChange={(e) => setName(e.currentTarget.value)}
            placeholder={gm ? "Ex.: Mestre" : "Ex.: Ana"}
          />

          {joinError && (
            <Alert color="red" variant="light" p="xs">
              {ERRORS[joinError]}
            </Alert>
          )}

          <Button type="submit" size="sm" loading={joining} disabled={!connected || !name.trim()}>
            Entrar
          </Button>
          <Text size="xs" c="dimmed" ta="center">
            v{APP_VERSION}
          </Text>
        </Stack>
      </Paper>
    </main>
  );
}
