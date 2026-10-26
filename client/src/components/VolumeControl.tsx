import { ActionIcon, Group, Popover, Slider, Stack, Switch, Text, Tooltip } from "@mantine/core";
import { IconVolume, IconVolume2, IconVolumeOff } from "@tabler/icons-react";
import { setVolume, useVolume } from "../store";

/**
 * Volume geral desta pessoa (E25), na barra do topo: o mestre escolhe o que toca e o volume
 * de cada canal para a mesa; aqui cada um ajusta o quanto ouve no próprio computador.
 */
export function VolumeControl() {
  const { volume, muted } = useVolume();
  const Icon = muted || volume === 0 ? IconVolumeOff : volume < 0.5 ? IconVolume2 : IconVolume;

  return (
    <Popover position="bottom-end" withArrow shadow="md" width={220}>
      <Popover.Target>
        <Tooltip label="Volume do som da mesa (só no seu computador)">
          <ActionIcon variant="default" size="lg" aria-label="Volume">
            <Icon size={18} />
          </ActionIcon>
        </Tooltip>
      </Popover.Target>
      <Popover.Dropdown>
        <Stack gap="sm">
          <Group justify="space-between">
            <Text size="sm" fw={600}>
              Volume
            </Text>
            <Text size="xs" c="dimmed">
              {muted ? "mudo" : `${Math.round(volume * 100)}%`}
            </Text>
          </Group>
          <Slider
            min={0}
            max={100}
            value={Math.round(volume * 100)}
            onChange={(v) => setVolume({ volume: v / 100, muted: false })}
            label={(v) => `${v}%`}
            aria-label="Volume geral"
          />
          <Switch size="xs" label="Mudo" checked={muted} onChange={(e) => setVolume({ muted: e.currentTarget.checked })} />
          <Text size="xs" c="dimmed">
            Vale só para você: o mestre controla o que toca e o volume de cada som para a mesa.
          </Text>
        </Stack>
      </Popover.Dropdown>
    </Popover>
  );
}
