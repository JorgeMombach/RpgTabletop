import { ActionIcon, Box, Button, Group, Paper, Popover, Stack, Switch, Text, TextInput, Tooltip } from "@mantine/core";
import { IconPlayerPause, IconPlayerPlay } from "@tabler/icons-react";
import { LIMITS } from "@rpg/shared";
import { useState, type FormEvent } from "react";
import { act } from "../actions";
import { useT } from "../i18n";
import { setDicePrefs, useApp } from "../store";

/**
 * Jogo pausado (Passo 7). Jogadores: o mapa escurece e uma placa no meio dá o aviso (os tokens deles ficam parados).
 * Mestre: o mapa continua normal, para ajeitar a cena; uma faixa lembra que está pausado, com Retomar.
 */
export function PauseOverlay({ pause, gm }: { pause: { message: string } | null; gm: boolean }) {
  const t = useT();
  if (!pause) return null;
  if (gm) {
    return (
      <Paper className="pause-banner" p={6} px="sm" radius="md" shadow="md">
        <Group gap="sm" wrap="nowrap">
          <IconPlayerPause size={14} color="var(--mantine-color-red-5)" style={{ flex: "none" }} />
          <Text size="sm" truncate title={pause.message}>
            {t("pause.gmBanner")}
            {pause.message && (
              <>
                {": "}
                <i>{pause.message}</i>
              </>
            )}
          </Text>
          <Button size="compact-xs" leftSection={<IconPlayerPlay size={12} />} onClick={() => void act("pause:set", { paused: false })} style={{ flex: "none" }}>
            {t("pause.resume")}
          </Button>
        </Group>
      </Paper>
    );
  }
  return (
    <Box className="pause-veil">
      <Paper className="plaque pause-plaque" p="lg">
        <span className="plaque-rivets" aria-hidden />
        <Stack gap={6} align="center">
          <IconPlayerPause size={28} color="var(--mantine-color-bronze-4)" />
          <Text ff="heading" fw={700} fz={20} c="bronze.4" tt="uppercase" style={{ letterSpacing: "0.12em" }}>
            {t("pause.title")}
          </Text>
          {pause.message && (
            <Text size="sm" style={{ overflowWrap: "anywhere" }}>
              {pause.message}
            </Text>
          )}
          <Text size="xs" c="dimmed">
            {t("pause.hint")}
          </Text>
        </Stack>
      </Paper>
    </Box>
  );
}

/** Botão de pausa na barra do mapa (mestre): abre o aviso opcional; pausado, retoma direto. */
export function PauseButton({ paused, size }: { paused: boolean; size?: "lg" }) {
  const t = useT();
  const [open, setOpen] = useState(false);
  const [message, setMessage] = useState("");

  async function pause(e: FormEvent) {
    e.preventDefault();
    if ((await act("pause:set", { paused: true, message })).ok) setOpen(false);
  }

  if (paused) {
    return (
      <Tooltip label={t("pause.resumeTip")}>
        <ActionIcon size={size} variant="filled" color="red" onClick={() => void act("pause:set", { paused: false })} aria-label={t("pause.resume")}>
          <IconPlayerPlay size={16} />
        </ActionIcon>
      </Tooltip>
    );
  }
  return (
    <Popover opened={open} onChange={setOpen} position="bottom-end" shadow="md" withinPortal trapFocus>
      <Popover.Target>
        <Tooltip label={t("pause.pauseTip")} disabled={open}>
          <ActionIcon size={size} variant="subtle" color="gray" onClick={() => setOpen((o) => !o)} aria-label={t("pause.pause")}>
            <IconPlayerPause size={16} />
          </ActionIcon>
        </Tooltip>
      </Popover.Target>
      <Popover.Dropdown p="sm" w={280}>
        <Stack component="form" gap="xs" onSubmit={pause}>
          <TextInput size="xs" label={t("pause.message")} placeholder={t("pause.messagePlaceholder")} maxLength={LIMITS.pauseMessage} value={message} onChange={(e) => setMessage(e.currentTarget.value)} data-autofocus />
          <Button type="submit" size="xs" leftSection={<IconPlayerPause size={12} />}>
            {t("pause.pauseAll")}
          </Button>
        </Stack>
      </Popover.Dropdown>
    </Popover>
  );
}

/** Ferramenta Ping do mestre: levar a visão de todos até o ping ("olhem aqui"). */
export function PingOptions() {
  const t = useT();
  const pingLook = useApp((s) => s.pingLook);
  return (
    <Paper className="map-options" p="xs" shadow="md" radius="md">
      <Stack gap={4}>
        <Switch size="xs" checked={pingLook} onChange={(e) => setDicePrefs({ pingLook: e.currentTarget.checked })} label={t("pause.pingLook")} />
        <Text size="xs" c="dimmed">
          {t(pingLook ? "pause.pingLookOn" : "pause.pingLookOff")}
        </Text>
      </Stack>
    </Paper>
  );
}
