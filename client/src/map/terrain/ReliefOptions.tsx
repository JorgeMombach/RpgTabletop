import { Box, Button, Group, SegmentedControl, Slider, Text, Tooltip } from "@mantine/core";
import { IconArrowBackUp, IconTrash } from "@tabler/icons-react";
import { LIMITS, RELIEF_DUNE, RELIEF_LEVELS } from "@rpg/shared";
import { memo } from "react";
import { act } from "../../actions";
import { confirmAction } from "../../confirm";
import { useT } from "../../i18n";
import { useApp } from "../../store";
import { undo, useMapUndo } from "../mapHistory";

/** Níveis do pincel, do mais fundo ao mais alto (o texto com sinal: −2, −1, 0, +1…). */
const LEVELS = Array.from({ length: RELIEF_LEVELS.max - RELIEF_LEVELS.min + 1 }, (_, index) => RELIEF_LEVELS.min + index);
const levelText = (level: number) => (level > 0 ? `+${level}` : level < 0 ? `−${-level}` : "0");

/**
 * Opções da ferramenta Relevo (mestre, docs/design/relevo.md): pintar o nível (com a borda: escarpa de rocha ou encosta
 * suave) ou as dunas (só a altura delas), o tamanho do pincel, desfazer e aplainar tudo. Em `memo`, como as outras.
 */
export const ReliefOptions = memo(function ReliefOptions() {
  const t = useT();
  const brush = useApp((s) => s.reliefBrush);
  const painted = useApp((s) => Object.keys(s.relief).length > 0);
  const undoCount = useMapUndo((s) => s.relief);
  const setBrush = (changes: Partial<typeof brush>) => useApp.setState((s) => ({ reliefBrush: { ...s.reliefBrush, ...changes } }));

  async function clearAll() {
    const ok = await confirmAction({ title: t("relief.clearTitle"), message: t("relief.clearMessage"), confirmLabel: t("relief.clearConfirm"), danger: true });
    if (ok) await act("relief:clear", {});
  }

  return (
    <Box>
      <SegmentedControl
        size="xs"
        fullWidth
        mb={6}
        data={[
          { value: "level", label: t("relief.paintLevel") },
          { value: "dunes", label: t("relief.paintDunes") },
        ]}
        value={brush.mode}
        onChange={(value) => setBrush({ mode: value === "dunes" ? "dunes" : "level" })}
        aria-label={t("relief.paint")}
      />
      {brush.mode === "dunes" ? (
        <Group gap={6} wrap="nowrap">
          <Text size="xs" c="dimmed" w={44} style={{ flex: "none" }}>
            {t("relief.duneHeight")}
          </Text>
          <Slider
            size="xs"
            style={{ flex: 1 }}
            min={0}
            max={RELIEF_DUNE.max}
            step={1}
            value={brush.dune}
            onChange={(dune) => setBrush({ dune })}
            label={(value) => (value === 0 ? t("relief.duneNone") : String(value))}
            aria-label={t("relief.duneHeight")}
          />
        </Group>
      ) : (
        <>
          <Text size="xs" c="dimmed" mb={4}>
            {t("relief.level")}
          </Text>
          <SegmentedControl
            size="xs"
            fullWidth
            data={LEVELS.map((level) => ({ value: String(level), label: levelText(level) }))}
            value={String(brush.level)}
            onChange={(value) => setBrush({ level: Number(value) })}
            aria-label={t("relief.level")}
          />
          <SegmentedControl
            size="xs"
            fullWidth
            mt={6}
            data={[
              { value: "cliff", label: t("relief.cliff") },
              { value: "soft", label: t("relief.soft") },
            ]}
            value={brush.soft ? "soft" : "cliff"}
            onChange={(value) => setBrush({ soft: value === "soft" })}
            aria-label={t("relief.edge")}
          />
        </>
      )}
      <Group gap={6} wrap="nowrap" mt={8}>
        <Text size="xs" c="dimmed" w={44} style={{ flex: "none" }}>
          {t("terrain.size")}
        </Text>
        <Slider
          size="xs"
          style={{ flex: 1 }}
          min={LIMITS.terrainRadius.min}
          max={LIMITS.terrainRadius.max}
          step={0.5}
          value={brush.radius}
          onChange={(radius) => setBrush({ radius })}
          label={(v) => t("terrain.sizeValue", { n: v })}
          aria-label={t("terrain.size")}
        />
      </Group>
      <Group gap="xs" wrap="wrap" align="center" mt={8}>
        <Tooltip label={t("relief.undoTip")}>
          <Button size="compact-xs" variant="default" disabled={undoCount === 0} leftSection={<IconArrowBackUp size={12} />} onClick={() => void undo("relief")}>
            {t("walls.undo")}
          </Button>
        </Tooltip>
        <Button size="compact-xs" variant="default" color="red" disabled={!painted} leftSection={<IconTrash size={12} />} onClick={() => void clearAll()}>
          {t("relief.clear")}
        </Button>
      </Group>
      <Text size="xs" c="dimmed" mt={6}>
        {t(brush.mode === "dunes" ? "relief.hintDunes" : brush.soft ? "relief.hintSoft" : "relief.hint")}
      </Text>
    </Box>
  );
});
