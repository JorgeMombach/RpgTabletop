import { Alert, Badge, Button, Center, Loader, Paper, Stack, Text, TextInput, Title } from "@mantine/core";
import { APP_VERSION, NAME_MAX_LENGTH, type JoinError } from "@rpg/shared";
import { useState, type FormEvent } from "react";
import { useT, type MessageKey } from "../i18n";
import { join, savedName } from "../session";
import { useApp } from "../store";
import { D20Emblem } from "./D20Emblem";
import { LanguageMenu } from "./LanguageMenu";

const ERRORS: Record<JoinError, MessageKey> = {
  invalid_name: "join.error.invalidName",
  room_full: "join.error.roomFull",
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
  const t = useT();
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
      <div className="join-lang">
        <LanguageMenu />
      </div>
      <Paper component="form" onSubmit={submit} className="join-card" p="xl" radius="lg" shadow="xl">
        <Stack gap="lg" align="stretch">
          <Center>
            <D20Emblem />
          </Center>
          <Stack gap={4} align="center">
            <Title order={1} ta="center" c="bronze.3">
              Jamal's Tabletop
            </Title>
            <Text size="sm" c="dimmed" ta="center">
              {t("join.tagline")}
            </Text>
          </Stack>

          <Center>
            {!connected ? (
              <Badge variant="default" leftSection={<Loader size={10} />}>
                {t("join.connecting")}
              </Badge>
            ) : (
              // div: o Badge é um bloco e não pode ficar dentro de <p>.
              <Text size="sm" component="div">
                {t("join.joiningAs")}{" "}
                <Badge color={gm ? "bronze" : "player"} variant="light">
                  {gm ? t("join.roleGm") : t("common.player")}
                </Badge>
              </Text>
            )}
          </Center>

          <TextInput
            size="sm"
            label={t("join.name")}
            autoFocus
            value={name}
            maxLength={NAME_MAX_LENGTH}
            onChange={(e) => setName(e.currentTarget.value)}
            placeholder={gm ? t("join.namePlaceholderGm") : t("join.namePlaceholderPlayer")}
          />

          {joinError && (
            <Alert color="red" variant="light" p="xs">
              {t(ERRORS[joinError])}
            </Alert>
          )}

          <Button type="submit" size="sm" loading={joining} disabled={!connected || !name.trim()}>
            {t("join.submit")}
          </Button>
          <Text size="xs" c="dimmed" ta="center">
            v{APP_VERSION}
          </Text>
        </Stack>
      </Paper>
    </main>
  );
}
