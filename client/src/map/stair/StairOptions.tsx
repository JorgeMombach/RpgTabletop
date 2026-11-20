import { Box, Button, ColorSwatch, Group, SegmentedControl, SimpleGrid, Text, Tooltip, UnstyledButton } from "@mantine/core";
import { IconArrowBackUp, IconTrash } from "@tabler/icons-react";
import { STAIR_MATERIALS, STAIR_SHAPES, type BridgeWidth, type Stair, type StairExit, type StairMaterial, type StairShape } from "@rpg/shared";
import { memo } from "react";
import { useT } from "../../i18n";
import { useApp } from "../../store";
import { removeStairs, undo, updateStair, useMapUndo } from "../mapHistory";
import { pointsForShape, STAIR_FLAT_COLOR, STAIR_MATERIAL_LABEL, STAIR_SHAPE_LABEL } from "./stairArt";

const WIDTHS: BridgeWidth[] = [1, 2, 3];
const isShape = (value: string): value is StairShape => STAIR_SHAPES.some((shape) => shape === value);

/**
 * Opções da ferramenta Escada (mestre, docs/design/escadas.md): formato, material (some na de mão), largura ou
 * diâmetro e sentido da próxima escada; com uma escada escolhida, os mesmos controles mudam a dela, e dá para apagá-la.
 * Desfazer e a dica dos cliques.
 */
export const StairOptions = memo(function StairOptions({ selected }: { selected: Stair | null }) {
  const t = useT();
  const brush = useApp((s) => s.stairBrush);
  const undoCount = useMapUndo((s) => s.stair);
  const shape = selected?.shape ?? brush.shape;
  const material = selected?.material ?? brush.material;
  const width = selected?.width ?? brush.width;
  const exit = selected?.exit ?? brush.exit;

  function pickShape(next: StairShape) {
    useApp.setState((s) => ({ stairBrush: { ...s.stairBrush, shape: next } }));
    if (selected && selected.shape !== next) void updateStair(selected, { shape: next, points: pointsForShape(selected, next) });
  }
  function pickMaterial(next: StairMaterial) {
    useApp.setState((s) => ({ stairBrush: { ...s.stairBrush, material: next } }));
    if (selected && selected.material !== next) void updateStair(selected, { material: next });
  }
  function pickWidth(next: BridgeWidth) {
    useApp.setState((s) => ({ stairBrush: { ...s.stairBrush, width: next } }));
    if (selected && selected.width !== next) void updateStair(selected, { width: next });
  }
  function pickExit(next: StairExit) {
    useApp.setState((s) => ({ stairBrush: { ...s.stairBrush, exit: next } }));
    if (selected && selected.exit !== next) void updateStair(selected, { exit: next });
  }

  const hint = selected ? "stair.hintSelected" : shape === "path" ? "stair.hintPath" : "stair.hintDrag";
  return (
    <Box>
      <SegmentedControl
        fullWidth
        size="xs"
        data={STAIR_SHAPES.map((option) => ({ value: option, label: t(STAIR_SHAPE_LABEL[option]) }))}
        value={shape}
        onChange={(value) => isShape(value) && pickShape(value)}
        aria-label={t("stair.shape")}
      />
      {shape !== "ladder" && (
        <>
          <SimpleGrid cols={2} spacing={4} mt={8} role="radiogroup" aria-label={t("stair.material")}>
            {STAIR_MATERIALS.map((option) => {
              const active = material === option;
              return (
                <Tooltip key={option} label={t(STAIR_MATERIAL_LABEL[option])}>
                  <UnstyledButton role="radio" aria-checked={active} aria-label={t(STAIR_MATERIAL_LABEL[option])} onClick={() => pickMaterial(option)} className="floor-swatch" data-active={active || undefined}>
                    <ColorSwatch color={STAIR_FLAT_COLOR[option]} radius="sm" w="100%" h={28} />
                  </UnstyledButton>
                </Tooltip>
              );
            })}
          </SimpleGrid>
          <Group gap={6} wrap="nowrap" mt={8}>
            <Text size="xs" c="dimmed" style={{ flex: "none" }}>
              {t(shape === "spiral" ? "stair.diameter" : "stair.width")}
            </Text>
            <SegmentedControl
              size="xs"
              style={{ flex: 1 }}
              data={WIDTHS.map((value) => ({ value: String(value), label: t("stair.widthValue", { n: value }) }))}
              value={String(width)}
              onChange={(value) => pickWidth(value === "1" ? 1 : value === "3" ? 3 : 2)}
              aria-label={t(shape === "spiral" ? "stair.diameter" : "stair.width")}
            />
          </Group>
        </>
      )}
      <Group gap={6} wrap="nowrap" mt={8}>
        <Text size="xs" c="dimmed" style={{ flex: "none" }}>
          {t("stair.exit")}
        </Text>
        <Tooltip label={t("stair.exitTip")} multiline w={240}>
          <SegmentedControl
            size="xs"
            style={{ flex: 1 }}
            data={[
              { value: "up", label: t("stair.up") },
              { value: "down", label: t("stair.down") },
            ]}
            value={exit}
            onChange={(value) => pickExit(value === "down" ? "down" : "up")}
            aria-label={t("stair.exit")}
          />
        </Tooltip>
      </Group>
      <Group gap="xs" wrap="wrap" align="center" mt={8}>
        <Tooltip label={t("stair.undoTip")}>
          <Button size="compact-xs" variant="default" disabled={undoCount === 0} leftSection={<IconArrowBackUp size={12} />} onClick={() => void undo("stair")}>
            {t("walls.undo")}
          </Button>
        </Tooltip>
        {selected && (
          <Button
            size="compact-xs"
            variant="default"
            color="red"
            leftSection={<IconTrash size={12} />}
            onClick={() => {
              void removeStairs([selected]);
              useApp.setState({ selectedStairId: null });
            }}
          >
            {t("stair.remove")}
          </Button>
        )}
      </Group>
      <Text size="xs" c="dimmed" mt={6}>
        {t(hint)}
      </Text>
    </Box>
  );
});
