import { Button, ColorInput, Box, Group, SegmentedControl, Select, Text, Tooltip } from "@mantine/core";
import { IconArrowBackUp } from "@tabler/icons-react";
import { EFFECT_PRESETS, type EffectPreset } from "@rpg/shared";
import { memo } from "react";
import { PRESETS, Swatch } from "../components/FixEffectModal";
import { useT } from "../i18n";
import { presetLabel } from "../labels";
import { useApp } from "../store";
import { undo, useMapUndo } from "./mapHistory";

/** Cor da pintura: a do tipo, ou a escolhida no Personalizado (é ela que separa uma pintura da outra). */
export function paintColorOf(preset: EffectPreset, custom: string): string {
  return preset === "custom" ? custom : EFFECT_PRESETS[preset].color;
}

/**
 * Opções do Pincel de efeitos (mestre, Fase 6): tipo do efeito, pintar ou apagar, tamanho e desfazer.
 * O mesmo tipo vira um efeito só (aparece em Efeitos no mapa, onde se liga, transforma ou remove).
 * Em `memo`: o mapa redesenha a cada passo do WASD e o painel não tem por que ir junto.
 */
export const PaintOptions = memo(function PaintOptions() {
  const t = useT();
  // Só os campos do pincel: com o estado inteiro, o painel redesenhava a cada passo do WASD e a visão engasgava.
  const paintPreset = useApp((s) => s.paintPreset);
  const paintColor = useApp((s) => s.paintColor);
  const paintErase = useApp((s) => s.paintErase);
  const paintSize = useApp((s) => s.paintSize);
  const undoCount = useMapUndo((s) => s.paint);
  const color = paintColorOf(paintPreset, paintColor);

  return (
    <Box>
      <Group gap="xs" wrap="wrap" align="center">
        <Select
          size="xs"
          style={{ flex: "1 1 160px" }}
          data={PRESETS.map((p) => ({ value: p, label: presetLabel(p) }))}
          value={paintPreset}
          onChange={(v) => v && useApp.setState({ paintPreset: v as EffectPreset, paintErase: false })}
          allowDeselect={false}
          searchable
          selectFirstOptionOnChange
          leftSection={<Swatch preset={paintPreset} color={color} size={16} />}
          renderOption={({ option }) => (
            <Group gap="xs" wrap="nowrap">
              <Swatch preset={option.value as EffectPreset} color={paintColorOf(option.value as EffectPreset, paintColor)} />
              <Text size="sm">{option.label}</Text>
            </Group>
          )}
          comboboxProps={{ withinPortal: true }}
          aria-label={t("effects.effect")}
        />
        {paintPreset === "custom" && <ColorInput size="xs" w={120} value={paintColor} onChange={(v) => useApp.setState({ paintColor: v })} format="hex" aria-label={t("form.color")} />}
        <SegmentedControl
          size="xs"
          data={[
            { value: "paint", label: t("paint.paint") },
            { value: "erase", label: t("paint.erase") },
          ]}
          value={paintErase ? "erase" : "paint"}
          onChange={(v) => useApp.setState({ paintErase: v === "erase" })}
          aria-label={t("paint.mode")}
        />
        <SegmentedControl
          size="xs"
          data={["1", "3", "5"].map((n) => ({ value: n, label: t("fog.brushSize", { n }) }))}
          value={String(paintSize)}
          onChange={(v) => useApp.setState({ paintSize: Number(v) })}
          aria-label={t("fog.brushSizeLabel")}
        />
        <Tooltip label={t("paint.undoTip")}>
          <Button size="compact-xs" variant="default" disabled={undoCount === 0} leftSection={<IconArrowBackUp size={12} />} onClick={() => void undo("paint")}>
            {t("walls.undo")}
          </Button>
        </Tooltip>
      </Group>
      <Text size="xs" c="dimmed" mt={6}>
        {t(paintErase ? "paint.hintErase" : "paint.hint")}
      </Text>
    </Box>
  );
});
