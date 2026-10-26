import { Button, Group, NumberInput, Popover, Stack, Text, Tooltip } from "@mantine/core";
import { IconCircleDashed } from "@tabler/icons-react";
import { LIMITS, type Combatant } from "@rpg/shared";
import { useState } from "react";
import { act } from "../actions";
import { useT } from "../i18n";

/** Valores comuns: alcance de arma (5/10 ft) e auras (15, 30 ft). */
const PRESETS = [5, 10, 15, 30];

/** Alcance ou aura em volta do token (botão no painel Selecionado): escolhe os pés ou apaga. */
export function AuraControl({ c }: { c: Combatant }) {
  const t = useT();
  const [open, setOpen] = useState(false);
  const [value, setValue] = useState<string | number>(c.aura ?? "");

  async function save(feet: number | null) {
    if ((await act("aura:set", { id: c.id, feet })).ok) setOpen(false);
  }

  return (
    <Popover opened={open} onChange={setOpen} position="top" withArrow trapFocus>
      <Popover.Target>
        <Tooltip label={t("aura.tip")} disabled={open}>
          <Button
            variant="default"
            leftSection={<IconCircleDashed size={14} />}
            onClick={() => {
              setValue(c.aura ?? "");
              setOpen(!open);
            }}
          >
            {c.aura ? t("aura.labelOn", { feet: c.aura }) : t("aura.label")}
          </Button>
        </Tooltip>
      </Popover.Target>
      <Popover.Dropdown>
        <Stack
          gap="xs"
          component="form"
          onSubmit={(e) => {
            e.preventDefault();
            if (String(value).trim()) void save(Number(value));
          }}
        >
          <Text size="xs" c="dimmed" maw={220}>
            {t("aura.hint")}
          </Text>
          <Group gap={4}>
            {PRESETS.map((ft) => (
              <Button key={ft} size="compact-sm" variant={c.aura === ft ? "filled" : "default"} onClick={() => void save(ft)}>
                {ft} ft
              </Button>
            ))}
          </Group>
          <Group gap="xs" wrap="nowrap" align="flex-end">
            <NumberInput
              label={t("aura.feet")}
              w={96}
              min={LIMITS.aura.min}
              max={LIMITS.aura.max}
              step={5}
              allowDecimal={false}
              allowNegative={false}
              value={value}
              onChange={setValue}
            />
            <Button type="submit">{t("aura.save")}</Button>
          </Group>
          {c.aura !== undefined && (
            <Button variant="subtle" color="red" onClick={() => void save(null)}>
              {t("aura.remove")}
            </Button>
          )}
        </Stack>
      </Popover.Dropdown>
    </Popover>
  );
}
