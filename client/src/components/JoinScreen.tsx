import { Alert, Badge, Button, Center, Loader, Paper, Stack, Text, TextInput, Title } from "@mantine/core";
import { APP_VERSION, NAME_MAX_LENGTH, type JoinError } from "@rpg/shared";
import { useMemo, useState, type CSSProperties, type FormEvent } from "react";
import { tableTile } from "../map/tableArt";
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

/** Fagulhas subindo devagar (posição, duração, atraso e deriva sorteados uma vez). */
function Embers() {
  const sparks = useMemo(
    () =>
      Array.from(
        { length: 18 },
        () =>
          ({
            left: `${10 + Math.random() * 80}%`,
            "--d": `${9 + Math.random() * 9}s`,
            "--w": `${-Math.random() * 18}s`,
            "--x": `${(Math.random() - 0.5) * 160}px`,
            "--s": 0.5 + Math.random(),
          }) as CSSProperties,
      ),
    [],
  );
  return (
    <div className="join-embers" aria-hidden>
      {sparks.map((style, i) => (
        <span key={i} style={style} />
      ))}
    </div>
  );
}

/**
 * Tela de entrada (L7): o tapete de couro da mesa à luz de uma vela (luz quente que oscila, bordas no escuro,
 * fagulhas) e o cartão em placa de couro com o d20 flutuando, o título em ouro e o papel numa fita.
 * Com "Reduzir efeitos", nada anima.
 */
export function JoinScreen() {
  const { connected, probedRole, joining, joinError, reduceFx } = useApp();
  // Ladrilho do couro da mesa (o mesmo do mapa), gerado uma vez.
  const leather = useMemo(() => (customArt ? null : tableTile("leather").toDataURL()), []);
  const t = useT();
  const [name, setName] = useState(savedName);
  const gm = probedRole === "gm";

  function submit(e: FormEvent) {
    e.preventDefault();
    if (name.trim()) void join(name);
  }

  return (
    <main className={`join${reduceFx ? " still" : ""}`}>
      <div
        className="join-table"
        style={{
          backgroundImage: customArt
            ? `linear-gradient(rgb(11 12 15 / 0.55), rgb(11 12 15 / 0.85)), url(${customArt})`
            : `url(${leather})`,
          backgroundSize: customArt ? "cover" : "256px 256px",
        }}
      />
      <div className="join-lamp" />
      <div className="join-shade" />
      {!reduceFx && <Embers />}
      <div className="join-lang">
        <LanguageMenu />
      </div>
      <Paper component="form" onSubmit={submit} className="join-card" px="xl" pt="xl" pb="lg" radius="sm">
        <span className="join-corners" aria-hidden />
        <span className="join-rivet top" aria-hidden />
        <span className="join-rivet bottom" aria-hidden />
        <Stack gap="lg" align="stretch">
          <Center>
            <div className="join-emblem">
              <D20Emblem />
            </div>
          </Center>
          <Stack gap={4} align="center">
            <Title order={1} ta="center" className="join-title">
              Jamal's Tabletop
            </Title>
            <Text size="sm" c="dimmed" ta="center" fs="italic">
              {t("join.tagline")}
            </Text>
          </Stack>

          <div className="join-orn" aria-hidden>
            <i />
          </div>

          <Center>
            {!connected ? (
              <Badge variant="default" leftSection={<Loader size={10} />}>
                {t("join.connecting")}
              </Badge>
            ) : (
              // div: o Badge é um bloco e não pode ficar dentro de <p>.
              <div className="join-role">
                <span>{t("join.joiningAs")}</span>
                <span className={`join-ribbon${gm ? "" : " player"}`}>{gm ? t("join.roleGm") : t("common.player")}</span>
              </div>
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
            classNames={{ input: "join-input" }}
          />

          {joinError && (
            <Alert color="red" variant="light" p="xs">
              {t(ERRORS[joinError])}
            </Alert>
          )}

          <Button type="submit" size="md" ff="heading" className="join-go" loading={joining} disabled={!connected || !name.trim()}>
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
