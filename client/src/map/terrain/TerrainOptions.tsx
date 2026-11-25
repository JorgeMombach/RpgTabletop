import { ActionIcon, Box, Button, Group, Image, SegmentedControl, SimpleGrid, Slider, Text, Tooltip } from "@mantine/core";
import { IconArrowBackUp, IconArrowWaveRightUp, IconEraser, IconTrash } from "@tabler/icons-react";
import { LIMITS, TERRAINS, type TerrainId } from "@rpg/shared";
import { memo } from "react";
import { act } from "../../actions";
import { confirmAction } from "../../confirm";
import { useT, type MessageKey } from "../../i18n";
import { useApp } from "../../store";
import { undo, useMapUndo } from "../mapHistory";
import { TERRAIN_ART } from "./terrainArt";

const TERRAIN_LABEL: Record<TerrainId, MessageKey> = {
  grass: "terrain.grass",
  grassDry: "terrain.grassDry",
  dirt: "terrain.dirt",
  dirtDark: "terrain.dirtDark",
  stone: "terrain.stone",
  stoneLight: "terrain.stoneLight",
  sand: "terrain.sand",
  water: "terrain.water",
  waterDark: "terrain.waterDark",
  packedEarth: "terrain.packedEarth",
  snow: "terrain.snow",
  sea: "terrain.sea",
};

/**
 * Opções da ferramenta Terreno (mestre, criação de mapa): a amostra de cada terreno (a aquarela com o mesmo ajuste
 * de cor do mapa), borracha, tamanho e força do pincel, desfazer e apagar tudo. Em `memo`, como as outras opções.
 */
/** Retângulo de água não faz sentido: com água ou água profunda, só o pincel. */
export function rectAllowed(terrain: TerrainId | "erase" | "current" | "currentErase"): boolean {
  return terrain !== "water" && terrain !== "waterDark";
}

export const TerrainOptions = memo(function TerrainOptions() {
  const t = useT();
  const brush = useApp((s) => s.terrainBrush);
  const painted = useApp((s) => Object.keys(s.terrain).length > 0);
  const undoCount = useMapUndo((s) => s.terrain);
  const erase = brush.terrain === "erase";
  // Correnteza (água animada): riscar linhas no sentido em que a água corre, ou apagá-las.
  const current = brush.terrain === "current" || brush.terrain === "currentErase";
  const currentErase = brush.terrain === "currentErase";
  const setBrush = (changes: Partial<typeof brush>) => useApp.setState((s) => ({ terrainBrush: { ...s.terrainBrush, ...changes } }));

  async function clearAll() {
    const ok = await confirmAction({ title: t("terrain.clearTitle"), message: t("terrain.clearMessage"), confirmLabel: t("terrain.clearConfirm"), danger: true });
    if (ok) await act("terrain:clear", {});
  }

  return (
    <Box>
      <SimpleGrid cols={4} spacing={4} role="radiogroup" aria-label={t("terrain.pick")}>
        {TERRAINS.map((terrain) => {
          const active = brush.terrain === terrain;
          const art = TERRAIN_ART[terrain];
          return (
            <Tooltip key={terrain} label={t(TERRAIN_LABEL[terrain])}>
              <ActionIcon
                variant={active ? "filled" : "default"}
                w="100%"
                h={44}
                p={3}
                role="radio"
                aria-checked={active}
                aria-label={t(TERRAIN_LABEL[terrain])}
                onClick={() => setBrush(rectAllowed(terrain) ? { terrain } : { terrain, shape: "brush" })}
              >
                <Image src={`terreno/${art.image}.webp`} h="100%" w="100%" radius="sm" style={{ filter: art.filter }} alt="" />
              </ActionIcon>
            </Tooltip>
          );
        })}
      </SimpleGrid>
      <Group gap="xs" wrap="wrap" align="center" mt={8}>
        <Button
          size="compact-xs"
          variant={erase || currentErase ? "filled" : "default"}
          leftSection={<IconEraser size={12} />}
          aria-pressed={erase || currentErase}
          onClick={() => setBrush({ terrain: current ? (currentErase ? "current" : "currentErase") : erase ? "grass" : "erase" })}
        >
          {t(current ? "terrain.currentEraser" : "terrain.eraser")}
        </Button>
        <Tooltip label={t("terrain.currentTip")}>
          <Button
            size="compact-xs"
            variant={current ? "filled" : "default"}
            leftSection={<IconArrowWaveRightUp size={12} />}
            aria-pressed={current}
            onClick={() => setBrush(current ? { terrain: "water", shape: "brush" } : { terrain: "current" })}
          >
            {t("terrain.current")}
          </Button>
        </Tooltip>
        <Tooltip label={t("terrain.undoTip")}>
          <Button size="compact-xs" variant="default" disabled={undoCount === 0} leftSection={<IconArrowBackUp size={12} />} onClick={() => void undo("terrain")}>
            {t("walls.undo")}
          </Button>
        </Tooltip>
        <Button size="compact-xs" variant="default" color="red" disabled={!painted} leftSection={<IconTrash size={12} />} onClick={() => void clearAll()}>
          {t("terrain.clear")}
        </Button>
      </Group>
      {!current && rectAllowed(brush.terrain) && (
        <SegmentedControl
          size="xs"
          fullWidth
          mt={8}
          data={[
            { value: "brush", label: t("terrain.shapeBrush") },
            { value: "rect", label: t("terrain.shapeRect") },
          ]}
          value={brush.shape}
          onChange={(value) => setBrush({ shape: value === "rect" ? "rect" : "brush" })}
          aria-label={t("terrain.shape")}
        />
      )}
      {!current && (
        <>
          {brush.shape === "brush" && (
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
          <Group gap={6} wrap="nowrap" mt={4}>
            <Text size="xs" c="dimmed" w={44} style={{ flex: "none" }}>
              {t("terrain.strength")}
            </Text>
            <Slider
              size="xs"
              style={{ flex: 1 }}
              min={LIMITS.terrainStrength.min}
              max={LIMITS.terrainStrength.max}
              step={0.05}
              value={brush.strength}
              onChange={(strength) => setBrush({ strength })}
              label={(v) => `${Math.round(v * 100)}%`}
              aria-label={t("terrain.strength")}
            />
          </Group>
        </>
      )}
      <Text size="xs" c="dimmed" mt={6}>
        {t(currentErase ? "terrain.currentHintErase" : current ? "terrain.currentHint" : erase ? "terrain.hintErase" : "terrain.hint")}
      </Text>
    </Box>
  );
});
