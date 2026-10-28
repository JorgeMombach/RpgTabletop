import { ActionIcon, Group, Popover, Slider, Stack, Switch, Text, Tooltip } from "@mantine/core";
import { IconVolume, IconVolume2, IconVolumeOff } from "@tabler/icons-react";
import { setVolume, useVolume } from "../store";
import { useT } from "../i18n";

/**
 * Volume geral desta pessoa (E25), na barra do topo: o mestre escolhe o que toca e o volume
 * de cada canal para a mesa; aqui cada um ajusta o quanto ouve no próprio computador.
 */
export function VolumeControl() {
  const t = useT();
  const { volume, muted } = useVolume();
  const Icon = muted || volume === 0 ? IconVolumeOff : volume < 0.5 ? IconVolume2 : IconVolume;

  return (
    <Popover position="bottom-end" withArrow shadow="md" width={220}>
      <Popover.Target>
        <Tooltip label={t("volume.tip")}>
          <ActionIcon variant="default" size="lg" aria-label={t("volume.title")}>
            <Icon size={18} />
          </ActionIcon>
        </Tooltip>
      </Popover.Target>
      <Popover.Dropdown>
        <Stack gap="sm">
          <Group justify="space-between">
            <Text size="sm" fw={600}>
              {t("volume.title")}
            </Text>
            <Text size="xs" c="dimmed">
              {muted ? t("volume.mutedShort") : `${Math.round(volume * 100)}%`}
            </Text>
          </Group>
          <Slider
            min={0}
            max={100}
            value={Math.round(volume * 100)}
            onChange={(v) => setVolume({ volume: v / 100, muted: false })}
            label={(v) => `${v}%`}
            aria-label={t("volume.overall")}
          />
          <Switch size="xs" label={t("volume.mute")} checked={muted} onChange={(e) => setVolume({ muted: e.currentTarget.checked })} />
          <Text size="xs" c="dimmed">
            {t("volume.hint")}
          </Text>
        </Stack>
      </Popover.Dropdown>
    </Popover>
  );
}
