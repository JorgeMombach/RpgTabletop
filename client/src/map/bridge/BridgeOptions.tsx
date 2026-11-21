import { Box, Button, ColorSwatch, Group, SegmentedControl, SimpleGrid, Text, Tooltip, UnstyledButton } from "@mantine/core";
import { IconArrowBackUp, IconTrash } from "@tabler/icons-react";
import { BRIDGE_KINDS, type Bridge, type BridgeKind, type BridgeWidth } from "@rpg/shared";
import { memo } from "react";
import { useT } from "../../i18n";
import { useApp } from "../../store";
import { removeBridges, undo, updateBridge, useMapUndo } from "../mapHistory";
import { BRIDGE_FLAT_COLOR, BRIDGE_LABEL } from "./bridgeArt";

const WIDTHS: BridgeWidth[] = [1, 2, 3];

/**
 * Opções da ferramenta Ponte (mestre, docs/design/pontes.md): o tipo (com amostra) e a largura da próxima ponte;
 * com uma ponte escolhida, os mesmos botões mudam a dela, e dá para apagá-la. Desfazer e uma dica.
 */
export const BridgeOptions = memo(function BridgeOptions({ selected }: { selected: Bridge | null }) {
  const t = useT();
  const brush = useApp((s) => s.bridgeBrush);
  const undoCount = useMapUndo((s) => s.bridge);
  const kind = selected?.kind ?? brush.kind;
  const width = selected?.width ?? brush.width;

  function pickKind(next: BridgeKind) {
    useApp.setState((s) => ({ bridgeBrush: { ...s.bridgeBrush, kind: next } }));
    if (selected && selected.kind !== next) void updateBridge(selected, { kind: next });
  }
  function pickWidth(next: BridgeWidth) {
    useApp.setState((s) => ({ bridgeBrush: { ...s.bridgeBrush, width: next } }));
    if (selected && selected.width !== next) void updateBridge(selected, { width: next });
  }

  return (
    <Box>
      <SimpleGrid cols={3} spacing={4} role="radiogroup" aria-label={t("bridge.kind")}>
        {BRIDGE_KINDS.map((option) => {
          const active = kind === option;
          return (
            <Tooltip key={option} label={t(BRIDGE_LABEL[option])}>
              <UnstyledButton role="radio" aria-checked={active} aria-label={t(BRIDGE_LABEL[option])} onClick={() => pickKind(option)} className="floor-swatch" data-active={active || undefined}>
                <ColorSwatch color={BRIDGE_FLAT_COLOR[option]} radius="sm" w="100%" h={28} />
              </UnstyledButton>
            </Tooltip>
          );
        })}
      </SimpleGrid>
      <Group gap={6} wrap="nowrap" mt={8}>
        <Text size="xs" c="dimmed" style={{ flex: "none" }}>
          {t("bridge.width")}
        </Text>
        <SegmentedControl
          size="xs"
          style={{ flex: 1 }}
          data={WIDTHS.map((value) => ({ value: String(value), label: t("bridge.widthValue", { n: value }) }))}
          value={String(width)}
          onChange={(value) => pickWidth(value === "1" ? 1 : value === "3" ? 3 : 2)}
          aria-label={t("bridge.width")}
        />
      </Group>
      <Group gap="xs" wrap="wrap" align="center" mt={8}>
        <Tooltip label={t("bridge.undoTip")}>
          <Button size="compact-xs" variant="default" disabled={undoCount === 0} leftSection={<IconArrowBackUp size={12} />} onClick={() => void undo("bridge")}>
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
              void removeBridges([selected]);
              useApp.setState({ selectedBridgeId: null });
            }}
          >
            {t("bridge.remove")}
          </Button>
        )}
      </Group>
      <Text size="xs" c="dimmed" mt={6}>
        {t(selected ? "bridge.hintSelected" : "bridge.hint")}
      </Text>
    </Box>
  );
});
