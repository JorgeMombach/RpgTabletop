import { Button, Group, Stack, Text, Tooltip, UnstyledButton } from "@mantine/core";
import { IconDice5 } from "@tabler/icons-react";
import type { Combatant } from "@rpg/shared";
import { act } from "../actions";
import { useT } from "../i18n";

/**
 * Testes contra a morte de um personagem com 0 de vida: três marcas de sucesso e três de falha,
 * marcadas por quem joga (o app não decide o resultado) e um botão que rola o d20 no log.
 */
export function DeathSaves({ c, editable, gm }: { c: Combatant; editable: boolean; gm: boolean }) {
  const t = useT();
  const s = c.deathSaves?.successes ?? 0;
  const f = c.deathSaves?.failures ?? 0;

  /** Clicar na marca n acende até ela; clicar na última acesa apaga essa. */
  function mark(kind: "successes" | "failures", n: number) {
    const current = kind === "successes" ? s : f;
    const next = current === n ? n - 1 : n;
    void act("death:set", { id: c.id, successes: kind === "successes" ? next : s, failures: kind === "failures" ? next : f });
  }

  const row = (kind: "successes" | "failures", count: number, color: string, label: string) => (
    <Group gap={6} wrap="nowrap">
      <Text size="xs" c="dimmed" w={64}>
        {label}
      </Text>
      {[1, 2, 3].map((n) => (
        <UnstyledButton
          key={n}
          className={`death-mark ${n <= count ? "on" : ""}`}
          style={{ "--mark": color } as React.CSSProperties}
          disabled={!editable}
          onClick={() => mark(kind, n)}
          aria-label={`${label} ${n}`}
          aria-pressed={n <= count}
        />
      ))}
    </Group>
  );

  const status = s >= 3 ? t("death.stable") : f >= 3 ? t("death.dead") : null;

  return (
    <Stack gap={6} className="death-saves">
      <Group justify="space-between" wrap="nowrap">
        <Text size="xs" fw={600} tt="uppercase" c="red.4" style={{ letterSpacing: "0.04em" }}>
          {t("death.title")}
        </Text>
        {status && (
          <Text size="xs" fw={700} c={s >= 3 ? "copper.4" : "red.4"}>
            {status}
          </Text>
        )}
      </Group>
      {row("successes", s, "var(--mantine-color-copper-5)", t("death.successes"))}
      {row("failures", f, "var(--mantine-color-red-6)", t("death.failures"))}
      {editable && (
        <Tooltip label={t("death.rollTip")}>
          <Button
            variant="default"
            leftSection={<IconDice5 size={14} />}
            onClick={() => act("dice:roll", { expr: "1d20", death: true, ...(gm ? { asId: c.id } : {}) })}
          >
            {t("death.roll")}
          </Button>
        </Tooltip>
      )}
    </Stack>
  );
}
