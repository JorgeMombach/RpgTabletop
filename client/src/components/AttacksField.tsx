import { ActionIcon, Button, Group, NumberInput, Stack, Text, TextInput, Tooltip } from "@mantine/core";
import { IconPlus, IconX } from "@tabler/icons-react";
import { LIMITS, type AttackInput, type SavedAttack } from "@rpg/shared";
import { useT } from "../i18n";

/** Ataque no formulário: campos como digitados (vazio = não preenchido). */
export interface AttackRow {
  name: string;
  bonus: string | number;
  damage: string;
}

export const toAttackRows = (attacks: SavedAttack[] | undefined): AttackRow[] =>
  (attacks ?? []).map((a) => ({ name: a.name, bonus: a.bonus ?? "", damage: a.damage ?? "" }));

/** O que vai para o servidor (ele valida: sem bônus nem dano é recusado com aviso). */
export const fromAttackRows = (rows: AttackRow[]): AttackInput[] =>
  rows.map((a) => ({
    name: a.name.trim(),
    ...(a.bonus !== "" && { bonus: Number(a.bonus) }),
    ...(a.damage.trim() && { damage: a.damage.trim() }),
  }));

/**
 * Ataques prontos (mestre: template, mob e NPC novos): "Martelo de pedra +4, 1d6+2". Os criados com o
 * template já vêm com eles na ficha e no painel Dados; dá para rolar o de cada um.
 */
export function AttacksField({ rows, onChange }: { rows: AttackRow[]; onChange: (rows: AttackRow[]) => void }) {
  const t = useT();
  const set = (i: number, patch: Partial<AttackRow>) => onChange(rows.map((a, j) => (j === i ? { ...a, ...patch } : a)));

  return (
    <Stack gap={6}>
      <Group justify="space-between" gap="xs" wrap="nowrap">
        <Text size="sm" fw={500}>
          {t("attacksField.title")}
        </Text>
        <Button
          size="compact-sm"
          variant="default"
          leftSection={<IconPlus size={14} />}
          disabled={rows.length >= LIMITS.attacks}
          onClick={() => onChange([...rows, { name: "", bonus: "", damage: "" }])}
        >
          {t("attacksField.add")}
        </Button>
      </Group>
      {rows.length === 0 ? (
        <Text size="xs" c="dimmed">
          {t("attacksField.hint")}
        </Text>
      ) : (
        rows.map((a, i) => (
          // Nome numa linha, bônus e dano embaixo: cabe na coluna na largura mínima.
          <Stack key={i} gap={4} className="phase-row">
            <Group gap="xs" wrap="nowrap" align="flex-end">
              <TextInput
                style={{ flex: 1 }}
                label={t("sheet.attacks.name")}
                placeholder={t("attacksField.namePlaceholder")}
                required
                maxLength={LIMITS.spellName}
                value={a.name}
                onChange={(e) => set(i, { name: e.currentTarget.value })}
              />
              <Tooltip label={t("attacksField.remove")}>
                <ActionIcon size="sm" color="red" mb={6} aria-label={t("attacksField.remove")} onClick={() => onChange(rows.filter((_, j) => j !== i))}>
                  <IconX size={14} />
                </ActionIcon>
              </Tooltip>
            </Group>
            <Group gap="xs" grow wrap="nowrap">
              <NumberInput label={t("sheet.attacks.bonus")} min={-20} max={40} allowDecimal={false} value={a.bonus} onChange={(v) => set(i, { bonus: v })} />
              <TextInput
                label={t("sheet.attacks.damage")}
                placeholder="1d6+2"
                maxLength={LIMITS.dice.exprLength}
                value={a.damage}
                onChange={(e) => set(i, { damage: e.currentTarget.value })}
              />
            </Group>
          </Stack>
        ))
      )}
    </Stack>
  );
}
