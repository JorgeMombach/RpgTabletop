import { Badge, Button, Group, Text, Tooltip } from "@mantine/core";
import { IconBrush, IconLogout } from "@tabler/icons-react";
import { APP_VERSION, type ClientState, type Combatant } from "@rpg/shared";
import { useState } from "react";
import { BattleMap } from "../map/BattleMap";
import { allCombatants } from "../format";
import { leave } from "../session";
import { useApp } from "../store";
import { AlliesPanel } from "./AlliesPanel";
import { BestiaryPanel } from "./BestiaryPanel";
import { ClearBattleDialog } from "./ClearBattleDialog";
import { D20Emblem } from "./D20Emblem";
import { ColumnResizer, LAYOUT, useColumnWidths } from "./ColumnResizer";
import { DicePanel } from "./DicePanel";
import { EffectsPanel } from "./EffectsPanel";
import { InitiativePanel } from "./InitiativePanel";
import { InvitePanel } from "./InvitePanel";
import { MapPanel } from "./MapPanel";
import { MobsPanel, NpcsPanel } from "./MobsPanel";
import { PlayersPanel } from "./PlayersPanel";
import { SessionPanel } from "./SessionPanel";
import { SelectedPanel } from "./SelectedPanel";

/** "Round 2 · vez de Thorin", visível para todos na barra do topo. */
function TurnStatus({ state }: { state: ClientState }) {
  const { combat } = state.battle;
  if (!combat.active) return null;
  const id = combat.order[combat.turnIndex];
  const who = allCombatants(state).find((c) => c.id === id);
  return (
    <Text size="sm" c="dimmed" className="turn-status" truncate>
      Round {combat.round}
      {who && (
        <>
          {" · vez de "}
          <Text component="strong" size="sm" c="bronze.4" fw={600}>
            {who.name}
          </Text>
        </>
      )}
    </Text>
  );
}

export function Shell({ state }: { state: ClientState }) {
  const connected = useApp((s) => s.connected);
  const [clearing, setClearing] = useState(false);
  const { widths, max, set, reset } = useColumnWidths();
  const gm = state.self.role === "gm";

  return (
    <div
      className="shell"
      style={{
        gridTemplateColumns: `${widths.left}px 6px minmax(${LAYOUT.mapMinWidth}px, 1fr) 6px ${widths.right}px`,
        minWidth: LAYOUT.appMinWidth,
        minHeight: LAYOUT.appMinHeight,
      }}
    >
      <Group component="header" className="topbar" justify="space-between" wrap="nowrap" gap="md" px="md">
        <Group gap={6} wrap="nowrap">
          <D20Emblem size={24} />
          <Text fw={700} ff="heading" c="bronze.4" fz={18}>
            Jamal's Tabletop
          </Text>
          <Text size="xs" c="dimmed">
            v{APP_VERSION}
          </Text>
        </Group>
        <TurnStatus state={state} />
        <Group gap="sm" wrap="nowrap">
          {!connected && (
            <Badge color="yellow" variant="light">
              Reconectando…
            </Badge>
          )}
          {gm && (
            <Tooltip label="Prepara o campo para a próxima batalha">
              <Button variant="default" leftSection={<IconBrush size={14} />} onClick={() => setClearing(true)}>
                Limpar campo
              </Button>
            </Tooltip>
          )}
          <Group gap={6} wrap="nowrap">
            <Text size="sm" truncate maw={180}>
              {state.self.name}
            </Text>
            <Badge color={gm ? "bronze" : "player"} variant="light" size="sm">
              {gm ? "Mestre" : "Jogador"}
            </Badge>
          </Group>
          <Tooltip label="Sair da sessão ou trocar de nome. Ao voltar, você reencontra o seu personagem.">
            <Button variant="default" leftSection={<IconLogout size={14} />} onClick={leave}>
              Sair
            </Button>
          </Tooltip>
        </Group>
      </Group>

      <aside className="col left">
        <InitiativePanel state={state} />
        {gm && <MobsPanel mobs={state.battle.mobs as Combatant[]} />}
        {gm && <NpcsPanel npcs={state.battle.npcs as Combatant[]} />}
        <AlliesPanel state={state} />
        <EffectsPanel state={state} />
        {gm && <MapPanel map={state.battle.map} />}
        {gm && <BestiaryPanel templates={state.templates} />}
        <PlayersPanel state={state} />
        {gm && <SessionPanel />}
        {gm && state.host && <InvitePanel host={state.host} />}
      </aside>
      <ColumnResizer side="left" width={widths.left} max={max.left} onResize={(w) => set("left", w)} onReset={() => reset("left")} />

      <main className="map-area">
        <BattleMap state={state} />
      </main>

      <ColumnResizer side="right" width={widths.right} max={max.right} onResize={(w) => set("right", w)} onReset={() => reset("right")} />
      <aside className="col right">
        <SelectedPanel state={state} />
        <DicePanel state={state} />
      </aside>

      {gm && <ClearBattleDialog open={clearing} onClose={() => setClearing(false)} />}
    </div>
  );
}
