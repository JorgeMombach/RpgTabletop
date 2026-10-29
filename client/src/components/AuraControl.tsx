import { Button, ColorSwatch, Group, NumberInput, Popover, Stack, Text, Tooltip } from "@mantine/core";
import { IconCircleDashed } from "@tabler/icons-react";
import { LIMITS, type Combatant } from "@rpg/shared";
import { useEffect, useState } from "react";
import { act } from "../actions";
import { useT } from "../i18n";
import { DRAW_COLORS } from "../map/DrawingShape";

/** Valores comuns: alcance de arma (5/10 ft) e auras (15, 30 ft). */
const PRESETS = [5, 10, 15, 30];

/**
 * Alcance ou aura em volta do token: escolhe os pés ou apaga. Sozinho, é um botão; com `opened` (o item
 * "Alcance" do menu Mais do Selecionado, L8), a janelinha abre presa a um ponto invisível no lugar do botão.
 */
export function AuraControl({ c, opened, onOpenChange }: { c: Combatant; opened?: boolean; onOpenChange?: (open: boolean) => void }) {
  const t = useT();
  const [ownOpen, setOwnOpen] = useState(false);
  const controlled = opened !== undefined;
  const open = controlled ? opened : ownOpen;
  const setOpen = (next: boolean) => (controlled ? onOpenChange?.(next) : setOwnOpen(next));
  const [value, setValue] = useState<string | number>(c.aura ?? "");
  // null = a cor do token.
  const [color, setColor] = useState<string | null>(c.auraColor ?? null);
  // Aberta pelo menu: começa com o que está no token.
  useEffect(() => {
    if (!opened) return;
    setValue(c.aura ?? "");
    setColor(c.auraColor ?? null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [opened]);

  async function save(feet: number | null) {
    if ((await act("aura:set", { id: c.id, feet, color })).ok) setOpen(false);
  }

  /** Trocar a cor com o círculo já no mapa aplica na hora (o popover continua aberto). */
  function pick(next: string | null) {
    setColor(next);
    if (c.aura) void act("aura:set", { id: c.id, feet: c.aura, color: next });
  }

  return (
    <Popover opened={open} onChange={setOpen} position="top" withArrow trapFocus>
      <Popover.Target>
        {controlled ? (
          <span className="aura-anchor" aria-hidden />
        ) : (
          <Tooltip label={t("aura.tip")} disabled={open}>
            <Button
              variant="default"
              leftSection={<IconCircleDashed size={14} />}
              onClick={() => {
                setValue(c.aura ?? "");
                setColor(c.auraColor ?? null);
                setOpen(!open);
              }}
            >
              {c.aura ? t("aura.labelOn", { feet: c.aura }) : t("aura.label")}
            </Button>
          </Tooltip>
        )}
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
          <Group gap={6} wrap="wrap" role="radiogroup" aria-label={t("aura.color")}>
            {[null, ...DRAW_COLORS].map((col) => (
              <Tooltip key={col ?? "token"} label={col ? col : t("aura.tokenColor")} disabled={col !== null}>
                <ColorSwatch
                  component="button"
                  type="button"
                  color={col ?? c.color}
                  size={20}
                  role="radio"
                  aria-checked={color === col}
                  aria-label={col ?? t("aura.tokenColor")}
                  onClick={() => pick(col)}
                  style={{ cursor: "pointer", outline: color === col ? "2px solid var(--mantine-color-bronze-4)" : undefined, outlineOffset: 2 }}
                />
              </Tooltip>
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
