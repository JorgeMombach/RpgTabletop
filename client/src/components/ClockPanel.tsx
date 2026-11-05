import { Button, Checkbox, Group, NumberInput, Stack, Text, TextInput } from "@mantine/core";
import { IconClock, IconMoon, IconPlus, IconRoute } from "@tabler/icons-react";
import { LIMITS, type GameClock } from "@rpg/shared";
import { useState } from "react";
import { act } from "../actions";
import { useT } from "../i18n";
import { EmptyState } from "./EmptyState";
import { Panel } from "./Panel";

export const clockTime = (minutes: number) => `${String(Math.floor(minutes / 60)).padStart(2, "0")}:${String(minutes % 60).padStart(2, "0")}`;

/** "14:30" → minutos; inválido → null. */
function parseTime(raw: string): number | null {
  const m = /^(\d{1,2})(?::(\d{2}))?$/.exec(raw.trim());
  if (!m) return null;
  const h = Number(m[1]);
  const min = Number(m[2] ?? 0);
  return h < 24 && min < 60 ? h * 60 + min : null;
}

/** Mestre (Passo 15): calendário e hora do jogo; descanso e viagem avançam o relógio. */
export function ClockPanel({ clock }: { clock: GameClock | null }) {
  const t = useT();
  const set = (c: { day: number; minutes: number; lightFollows: boolean } | null) => void act("clock:set", { clock: c });
  const advance = (minutes: number) => void act("clock:advance", { minutes });

  return (
    <Panel title={t("clock.title")} anchor="clock">
      {!clock ? (
        <EmptyState
          icon={IconClock}
          text={t("clock.off")}
          compact
          action={
            <Button size="compact-sm" variant="default" onClick={() => set({ day: 1, minutes: 8 * 60, lightFollows: false })}>
              {t("clock.turnOn")}
            </Button>
          }
        />
      ) : (
        <ClockControls clock={clock} set={set} advance={advance} />
      )}
    </Panel>
  );
}

function ClockControls({ clock, set, advance }: { clock: GameClock; set: (c: { day: number; minutes: number; lightFollows: boolean } | null) => void; advance: (m: number) => void }) {
  const t = useT();
  const [hours, setHours] = useState<number | string>(4);
  const [editing, setEditing] = useState(false);
  const [day, setDay] = useState<number | string>(clock.day);
  const [time, setTime] = useState(clockTime(clock.minutes));
  const parsed = parseTime(time);
  const follows = !!clock.lightFollows;

  return (
    <Stack gap="xs">
      <Group justify="space-between" wrap="nowrap">
        <Text ff="heading" fz={20} c="bronze.4" fw={700}>
          {t("clock.now", { day: clock.day, time: clockTime(clock.minutes) })}
        </Text>
        <Button size="compact-sm" variant="subtle" onClick={() => setEditing((e) => !e)}>
          {t(editing ? "common.close" : "clock.adjust")}
        </Button>
      </Group>
      {editing && (
        <Group gap="xs" align="flex-end" wrap="nowrap">
          <NumberInput w={90} label={t("clock.day")} min={1} max={LIMITS.clockDay} allowDecimal={false} allowNegative={false} value={day} onChange={setDay} />
          <TextInput w={90} label={t("clock.time")} placeholder="14:30" value={time} onChange={(e) => setTime(e.currentTarget.value)} error={parsed === null} />
          <Button
            variant="default"
            disabled={parsed === null || !Number(day)}
            onClick={() => {
              set({ day: Number(day), minutes: parsed!, lightFollows: follows });
              setEditing(false);
            }}
          >
            {t("common.apply")}
          </Button>
        </Group>
      )}
      <Group gap={6}>
        <Button size="compact-sm" variant="default" leftSection={<IconPlus size={14} />} onClick={() => advance(60)}>
          {t("clock.plusHour")}
        </Button>
        <Button size="compact-sm" variant="default" onClick={() => advance(60)}>
          {t("clock.shortRest")}
        </Button>
        <Button size="compact-sm" variant="default" leftSection={<IconMoon size={14} />} onClick={() => advance(8 * 60)}>
          {t("clock.longRest")}
        </Button>
      </Group>
      <Group gap="xs" align="flex-end" wrap="nowrap">
        <NumberInput w={90} label={t("clock.travelHours")} min={1} max={LIMITS.clockAdvance / 60} allowDecimal={false} allowNegative={false} value={hours} onChange={setHours} />
        <Button variant="default" leftSection={<IconRoute size={14} />} disabled={!Number(hours)} onClick={() => advance(Number(hours) * 60)}>
          {t("clock.travel")}
        </Button>
      </Group>
      <Checkbox
        label={t("clock.lightFollows")}
        description={t("clock.lightFollowsHint")}
        checked={follows}
        onChange={(e) => set({ day: clock.day, minutes: clock.minutes, lightFollows: e.currentTarget.checked })}
      />
      <Group justify="flex-end">
        <Button size="compact-sm" variant="subtle" color="red" onClick={() => set(null)}>
          {t("clock.turnOff")}
        </Button>
      </Group>
    </Stack>
  );
}
