import { ActionIcon, Button, Group, NumberInput, Stack, Text, TextInput, Tooltip } from "@mantine/core";
import { IconPlus, IconX } from "@tabler/icons-react";
import { LIMITS, NAME_MAX_LENGTH, type BossPhase } from "@rpg/shared";
import { useT } from "../i18n";

/** Fase no formulário: campos como digitados (vazio = não preenchido). */
export interface PhaseInput {
  hpMax: string | number;
  name: string;
  ac: string | number;
}

export const toPhaseInputs = (phases: BossPhase[] | undefined): PhaseInput[] =>
  (phases ?? []).map((p) => ({ hpMax: p.hpMax, name: p.name ?? "", ac: p.ac ?? "" }));

/** O que vai para o servidor (ele valida: vida vazia é recusada com aviso). */
export const fromPhaseInputs = (phases: PhaseInput[]): BossPhase[] =>
  phases.map((p) => ({
    hpMax: Number(p.hpMax),
    ...(p.name.trim() && { name: p.name.trim() }),
    ...(p.ac !== "" && { ac: Number(p.ac) }),
  }));

/**
 * Fases de um chefe (mestre: mob, NPC e template): as barras de vida que vêm depois da primeira.
 * Cada uma com vida e, se quiser, nome e CA novos ao começar.
 */
export function PhasesField({ phases, onChange, current = 1 }: { phases: PhaseInput[]; onChange: (p: PhaseInput[]) => void; current?: number }) {
  const t = useT();
  const set = (i: number, patch: Partial<PhaseInput>) => onChange(phases.map((p, j) => (j === i ? { ...p, ...patch } : p)));

  return (
    <Stack gap={6}>
      <Group justify="space-between" gap="xs" wrap="nowrap">
        <Text size="sm" fw={500}>
          {t("phases.title")}
        </Text>
        <Button
          size="compact-sm"
          variant="default"
          leftSection={<IconPlus size={14} />}
          disabled={phases.length >= LIMITS.phases}
          onClick={() => onChange([...phases, { hpMax: "", name: "", ac: "" }])}
        >
          {t("phases.add")}
        </Button>
      </Group>
      {phases.length === 0 ? (
        <Text size="xs" c="dimmed">
          {t("phases.hint")}
        </Text>
      ) : (
        phases.map((p, i) => (
          // Em duas linhas: cabe na coluna na largura mínima.
          <Stack key={i} gap={4} className="phase-row">
            <Group justify="space-between" gap="xs" wrap="nowrap">
              <Text size="xs" c="bronze.4">
                {t("phases.label", { n: current + i + 1 })}
              </Text>
              <Tooltip label={t("phases.remove")}>
                <ActionIcon size="sm" color="red" aria-label={t("phases.remove")} onClick={() => onChange(phases.filter((_, j) => j !== i))}>
                  <IconX size={14} />
                </ActionIcon>
              </Tooltip>
            </Group>
            <Group gap="xs" grow wrap="nowrap">
              <NumberInput
                label={t("phases.hp")}
                min={LIMITS.hpMax.min}
                max={LIMITS.hpMax.max}
                allowDecimal={false}
                allowNegative={false}
                required
                value={p.hpMax}
                onChange={(v) => set(i, { hpMax: v })}
              />
              <NumberInput
                label={t("phases.ac")}
                placeholder={t("phases.sameAc")}
                min={LIMITS.ac.min}
                max={LIMITS.ac.max}
                allowDecimal={false}
                allowNegative={false}
                value={p.ac}
                onChange={(v) => set(i, { ac: v })}
              />
            </Group>
            <TextInput
              label={t("phases.name")}
              placeholder={t("phases.sameName")}
              maxLength={NAME_MAX_LENGTH}
              value={p.name}
              onChange={(e) => set(i, { name: e.currentTarget.value })}
            />
          </Stack>
        ))
      )}
    </Stack>
  );
}
