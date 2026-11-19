import {
  Box,
  Button,
  ColorSwatch,
  Group,
  SegmentedControl,
  SimpleGrid,
  Slider,
  Text,
  Tooltip,
  UnstyledButton,
} from "@mantine/core";
import { IconArrowBackUp, IconTrash } from "@tabler/icons-react";
import { FLOOR_MATERIALS, LIMITS, type FloorStroke } from "@rpg/shared";
import { memo } from "react";
import { act } from "../../actions";
import { confirmAction } from "../../confirm";
import { useT, type MessageKey } from "../../i18n";
import { useApp, type FloorBrush } from "../../store";
import { undo, useMapUndo } from "../mapHistory";
import { FLOOR_FLAT_COLOR, FLOOR_LABEL, PLANK_MATERIALS } from "./floorArt";

const MODE_HINT: Record<FloorBrush["mode"], MessageKey> = {
  room: "floor.hintRoom",
  rect: "floor.hintRect",
  brush: "floor.hintBrush",
  erase: "floor.hintErase",
};

/** A passada de piso com a forma dada (o material e o sentido vêm do pincel; a borracha apaga). */
export function floorStrokeOf(
  brush: FloorBrush,
  shape: FloorStroke["shape"],
): FloorStroke {
  return {
    material: brush.mode === "erase" ? "erase" : brush.material,
    vertical: brush.vertical,
    shape,
  };
}

/**
 * Opções da ferramenta Piso (mestre, docs/design/pisos.md): o material (com amostra), o sentido das tábuas, o modo
 * (cômodo, retângulo, pincel ou borracha), o tamanho do pincel, desfazer e apagar tudo. Em `memo`, como as outras.
 */
export const FloorOptions = memo(function FloorOptions() {
  const t = useT();
  const brush = useApp((s) => s.floorBrush);
  const painted = useApp((s) => Object.keys(s.floors).length > 0);
  const undoCount = useMapUndo((s) => s.floor);
  const setBrush = (changes: Partial<FloorBrush>) =>
    useApp.setState((s) => ({ floorBrush: { ...s.floorBrush, ...changes } }));

  async function clearAll() {
    const ok = await confirmAction({
      title: t("floor.clearTitle"),
      message: t("floor.clearMessage"),
      confirmLabel: t("floor.clearConfirm"),
      danger: true,
    });
    if (ok) await act("floor:clear", {});
  }

  const sized = brush.mode === "brush" || brush.mode === "erase";
  return (
    <Box>
      <SimpleGrid
        cols={3}
        spacing={4}
        role="radiogroup"
        aria-label={t("floor.material")}
      >
        {FLOOR_MATERIALS.map((material) => {
          const active = brush.material === material && brush.mode !== "erase";
          return (
            <Tooltip key={material} label={t(FLOOR_LABEL[material])}>
              <UnstyledButton
                role="radio"
                aria-checked={active}
                aria-label={t(FLOOR_LABEL[material])}
                onClick={() =>
                  setBrush({
                    material,
                    ...(brush.mode === "erase" && { mode: "brush" }),
                  })
                }
                className="floor-swatch"
                data-active={active || undefined}
              >
                <ColorSwatch
                  color={FLOOR_FLAT_COLOR[material]}
                  radius="sm"
                  w="100%"
                  h={28}
                />
              </UnstyledButton>
            </Tooltip>
          );
        })}
      </SimpleGrid>
      {PLANK_MATERIALS.includes(brush.material) && brush.mode !== "erase" && (
        <SegmentedControl
          size="xs"
          fullWidth
          mt={6}
          data={[
            { value: "horizontal", label: t("floor.horizontal") },
            { value: "vertical", label: t("floor.vertical") },
          ]}
          value={brush.vertical ? "vertical" : "horizontal"}
          onChange={(value) => setBrush({ vertical: value === "vertical" })}
          aria-label={t("floor.direction")}
        />
      )}
      <SegmentedControl
        size="xs"
        fullWidth
        mt={6}
        data={[
          { value: "room", label: t("floor.room") },
          { value: "rect", label: t("floor.rect") },
          { value: "brush", label: t("floor.brush") },
          { value: "erase", label: t("floor.erase") },
        ]}
        value={brush.mode}
        onChange={(value) =>
          setBrush({
            mode:
              value === "room" || value === "rect" || value === "erase"
                ? value
                : "brush",
          })
        }
        aria-label={t("floor.mode")}
      />
      {sized && (
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
      )}
      <Group gap="xs" wrap="wrap" align="center" mt={8}>
        <Tooltip label={t("floor.undoTip")}>
          <Button
            size="compact-xs"
            variant="default"
            disabled={undoCount === 0}
            leftSection={<IconArrowBackUp size={12} />}
            onClick={() => void undo("floor")}
          >
            {t("walls.undo")}
          </Button>
        </Tooltip>
        <Button
          size="compact-xs"
          variant="default"
          color="red"
          disabled={!painted}
          leftSection={<IconTrash size={12} />}
          onClick={() => void clearAll()}
        >
          {t("floor.clear")}
        </Button>
      </Group>
      <Text size="xs" c="dimmed" mt={6}>
        {t(MODE_HINT[brush.mode])}
      </Text>
    </Box>
  );
});
