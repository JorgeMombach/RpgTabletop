import { Button, SimpleGrid, Text, Tooltip } from "@mantine/core";
import { IconBox, IconBrush, IconFlame, IconTree, IconWall } from "@tabler/icons-react";
import { useT, type MessageKey } from "../i18n";
import { TOOL_KEYS } from "../map/BattleMap";
import { MapChestOptions } from "../map/MapChests";
import { PropOptions } from "../map/MapProps";
import { MapTorchOptions } from "../map/MapTorches";
import { PaintOptions } from "../map/PaintOptions";
import { WallOptions } from "../map/WallShape";
import { setTool, useApp, type MapTool } from "../store";
import { TipTitle } from "./TipTitle";
import { Panel } from "./Panel";

/** Ferramentas de construção do mapa (passo 4 do cenário): saíram da barra do mapa e ficam neste painel. */
export const BUILD_TOOLS = ["walls", "torches", "chests", "props", "paint"] as const satisfies readonly MapTool[];
export type BuildTool = (typeof BUILD_TOOLS)[number];
export const isBuildTool = (tool: MapTool): tool is BuildTool => (BUILD_TOOLS as readonly MapTool[]).includes(tool);

const TOOLS: Record<BuildTool, { text: MessageKey; tip: MessageKey; icon: typeof IconWall }> = {
  walls: { text: "walls.tool", tip: "walls.toolTip", icon: IconWall },
  torches: { text: "torches.tool", tip: "torches.toolTip", icon: IconFlame },
  chests: { text: "chests.tool", tip: "chests.toolTip", icon: IconBox },
  props: { text: "props.tool", tip: "props.toolTip", icon: IconTree },
  paint: { text: "paint.tool", tip: "paint.toolTip", icon: IconBrush },
};

/**
 * Painel Construir (mestre, aba Mapa): escolhe a ferramenta de construção e mostra as opções dela logo abaixo,
 * em vez de flutuarem por cima do mapa. Lê do estado só o que as opções usam (paredes, tochas, o objeto escolhido):
 * a aba inteira fica em `memo` com `samePanelProps`, que ignora paredes e tochas.
 */
export function BuildPanel() {
  const t = useT();
  const tool = useApp((s) => s.tool);
  const walls = useApp((s) => s.state?.battle.walls);
  const sceneStyle = useApp((s) => s.state?.battle.map.wallStyle ?? "stone");
  const torchCount = useApp((s) => s.state?.battle.torches.length ?? 0);
  const selectedProp = useApp((s) => s.state?.battle.props.find((p) => p.id === s.selectedPropId) ?? null);

  return (
    <Panel title={t("build.title")} anchor="build">
      <SimpleGrid cols={5} spacing={4} role="radiogroup" aria-label={t("build.pick")}>
        {BUILD_TOOLS.map((id) => {
          const { text, tip, icon: Icon } = TOOLS[id];
          const active = tool === id;
          return (
            <Tooltip key={id} label={<TipTitle title={t(text)} shortcut={TOOL_KEYS[id]}>{t(tip)}</TipTitle>}>
              <Button
                variant={active ? "filled" : "default"}
                h={48}
                px={0}
                role="radio"
                aria-checked={active}
                onClick={() => setTool(active ? "move" : id)}
                styles={{ label: { flexDirection: "column", gap: 4 } }}
              >
                <Icon size={18} />
                <Text span size="xs" lh={1}>
                  {t(text)}
                </Text>
              </Button>
            </Tooltip>
          );
        })}
      </SimpleGrid>
      {tool === "walls" && walls && <WallOptions walls={walls} style={sceneStyle} />}
      {tool === "torches" && <MapTorchOptions count={torchCount} />}
      {tool === "chests" && <MapChestOptions />}
      {tool === "props" && <PropOptions selected={selectedProp} />}
      {tool === "paint" && <PaintOptions />}
      {!isBuildTool(tool) && (
        <Text size="xs" c="dimmed">
          {t("build.hint")}
        </Text>
      )}
    </Panel>
  );
}
