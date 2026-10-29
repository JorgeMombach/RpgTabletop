import { Anchor, Divider, Group, Modal, Stack, Table, Text, Title, UnstyledButton } from "@mantine/core";
import { APP_VERSION } from "@rpg/shared";
import { useT, type MessageKey } from "../i18n";
import { D20Emblem } from "./D20Emblem";

/** Peças de terceiros usadas no app, com a licença de cada uma (o uso de cada uma vem do catálogo). */
const CREDITS: { name: string; url: string; license: string; use: MessageKey }[] = [
  { name: "React", url: "https://react.dev", license: "MIT", use: "about.use.ui" },
  { name: "Mantine", url: "https://mantine.dev", license: "MIT", use: "about.use.components" },
  { name: "Konva / react-konva", url: "https://konvajs.org", license: "MIT", use: "about.use.map" },
  { name: "Zustand", url: "https://github.com/pmndrs/zustand", license: "MIT", use: "about.use.state" },
  { name: "Socket.IO", url: "https://socket.io", license: "MIT", use: "about.use.realtime" },
  { name: "Express", url: "https://expressjs.com", license: "MIT", use: "about.use.server" },
  { name: "Electron", url: "https://www.electronjs.org", license: "MIT", use: "about.use.desktop" },
  { name: "3D Dice (dice-box-threejs)", url: "https://github.com/3d-dice/dice-box-threejs", license: "MIT", use: "about.use.dice" },
  { name: "three.js", url: "https://threejs.org", license: "MIT", use: "about.use.dice3d" },
  { name: "Tabler Icons", url: "https://tabler.io/icons", license: "MIT", use: "about.use.icons" },
  { name: "game-icons.net (Lorc, Delapouite, sbed, Skoll)", url: "https://game-icons.net", license: "CC BY 3.0", use: "about.use.gameIcons" },
  { name: "node-qrcode", url: "https://github.com/soldair/node-qrcode", license: "MIT", use: "about.use.qr" },
  { name: "Alegreya Sans", url: "https://fonts.google.com/specimen/Alegreya+Sans", license: "SIL OFL 1.1", use: "about.use.font" },
  { name: "Cinzel", url: "https://fonts.google.com/specimen/Cinzel", license: "SIL OFL 1.1", use: "about.use.titles" },
];

/** Janela "Sobre": versão, autor, o que o app é, créditos e licenças de terceiros. */
export function AboutModal({ opened, onClose }: { opened: boolean; onClose: () => void }) {
  const t = useT();
  return (
    <Modal opened={opened} onClose={onClose} size="lg" centered title={t("about.title")}>
      <Stack gap="md">
        <Group gap="sm" wrap="nowrap">
          <D20Emblem size={40} />
          <div>
            <Title order={3} c="bronze.4">
              Jamal's Tabletop
            </Title>
            <Text size="sm" c="dimmed">
              {t("about.version", { version: APP_VERSION })} · {t("about.author", { name: "Jorge Mombach" })}
            </Text>
          </div>
        </Group>
        <Text size="sm">{t("about.what")}</Text>
        <Text size="sm" c="dimmed">
          {t("about.rules")}
        </Text>

        <Divider label={t("about.credits")} labelPosition="left" />
        <Table.ScrollContainer minWidth={420}>
          <Table verticalSpacing={4} fz="sm">
            <Table.Thead>
              <Table.Tr>
                <Table.Th>{t("about.colName")}</Table.Th>
                <Table.Th>{t("about.colUse")}</Table.Th>
                <Table.Th>{t("about.colLicense")}</Table.Th>
              </Table.Tr>
            </Table.Thead>
            <Table.Tbody>
              {CREDITS.map((c) => (
                <Table.Tr key={c.name}>
                  <Table.Td>
                    <Anchor href={c.url} target="_blank" rel="noreferrer" size="sm">
                      {c.name}
                    </Anchor>
                  </Table.Td>
                  <Table.Td>{t(c.use)}</Table.Td>
                  <Table.Td style={{ whiteSpace: "nowrap" }}>{c.license}</Table.Td>
                </Table.Tr>
              ))}
            </Table.Tbody>
          </Table>
        </Table.ScrollContainer>
        <Text size="xs" c="dimmed">
          {t("about.sounds")}
        </Text>
        <Text size="xs" c="dimmed">
          {t("about.trademark")}
        </Text>
      </Stack>
    </Modal>
  );
}

/** A versão no topo abre o "Sobre". */
export function AboutLink({ onOpen }: { onOpen: () => void }) {
  const t = useT();
  return (
    <UnstyledButton onClick={onOpen} aria-label={t("about.open")} title={t("about.open")}>
      <Text size="xs" c="dimmed" td="underline" style={{ textDecorationStyle: "dotted" }}>
        v{APP_VERSION}
      </Text>
    </UnstyledButton>
  );
}
