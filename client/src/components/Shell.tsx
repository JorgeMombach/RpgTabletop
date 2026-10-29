import { Badge, Button, Group, Text, Tooltip } from "@mantine/core";
import { IconDeviceMobile, IconLogout } from "@tabler/icons-react";
import { groupName, type ClientState } from "@rpg/shared";
import { useState } from "react";
import { BattleMap } from "../map/BattleMap";
import { currentGroup } from "../format";
import { setLayoutChoice, useMobileLayout, useSmallScreen } from "../layout";
import { leave } from "../session";
import { useT } from "../i18n";
import { useApp } from "../store";
import { AlliesPanel } from "./AlliesPanel";
import { CloseGuard } from "./CloseGuard";
import { D20Emblem } from "./D20Emblem";
import { ColumnResizer, LAYOUT, useColumnWidths } from "./ColumnResizer";
import { DiceOverlay } from "./DiceOverlay";
import { DicePanel } from "./DicePanel";
import { FloatingLog } from "./FloatingLog";
import { EffectsPanel } from "./EffectsPanel";
import { GmTabs } from "./GmTabs";
import { HandoutButton, HandoutModal } from "./Handout";
import { InitiativePanel } from "./InitiativePanel";
import { LanguageMenu } from "./LanguageMenu";
import { Shortcuts, ShortcutsButton } from "./Shortcuts";
import { AboutLink, AboutModal } from "./About";
import { MobileShell } from "./MobileShell";
import { PlayersPanel } from "./PlayersPanel";
import { SoundSync } from "./SoundSync";
import { VolumeControl } from "./VolumeControl";
import { JoinFightBanner } from "./JoinFightBanner";
import { SelectedPanel } from "./SelectedPanel";

/** "Round 2 · vez de Thorin", visível para todos na barra do topo. */
export function TurnStatus({ state }: { state: ClientState }) {
  const t = useT();
  const { combat } = state.battle;
  if (!combat.active) return null;
  const group = currentGroup(state);
  const who = group.length > 0 ? { name: groupName(group.map((c) => c.name)) } : undefined;
  return (
    <Text size="sm" c="dimmed" className="turn-status" truncate>
      {t("top.round", { round: combat.round })}
      {who && (
        <>
          {t("top.turnOf")}
          <Text component="strong" size="sm" c="bronze.4" fw={600}>
            {who.name}
          </Text>
        </>
      )}
    </Text>
  );
}

/** Jogador em tela pequena vai para o layout de celular (E23); o mestre fica sempre neste. */
export function Shell({ state }: { state: ClientState }) {
  const mobile = useMobileLayout(state.self.role === "gm");
  return mobile ? <MobileShell state={state} /> : <DesktopShell state={state} />;
}

function DesktopShell({ state }: { state: ClientState }) {
  const t = useT();
  const small = useSmallScreen();
  const connected = useApp((s) => s.connected);
  // O log fica em um lugar só: no painel, flutuando na mesa ou numa janela fora dela.
  const logDetached = useApp((s) => s.logDetached && !s.logOut);
  const [about, setAbout] = useState(false);
  const { widths, max, collapsed, resize, collapse, toggle, reset } = useColumnWidths();
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
          <AboutLink onOpen={() => setAbout(true)} />
        </Group>
        <TurnStatus state={state} />
        <Group gap="sm" wrap="nowrap">
          {!connected && (
            <Badge color="yellow" variant="light">
              {t("top.reconnecting")}
            </Badge>
          )}
          {!gm && small && (
            <Tooltip label={t("top.mobileLayoutTip")}>
              <Button variant="default" leftSection={<IconDeviceMobile size={14} />} onClick={() => setLayoutChoice("auto")}>
                {t("top.mobileLayout")}
              </Button>
            </Tooltip>
          )}
          <HandoutButton />
          <ShortcutsButton />
          <LanguageMenu size="md" />
          <VolumeControl />
          <Group gap={6} wrap="nowrap">
            <Text size="sm" truncate maw={180}>
              {state.self.name}
            </Text>
            <Badge color={gm ? "bronze" : "player"} variant="light" size="sm">
              {gm ? t("common.gm") : t("common.player")}
            </Badge>
          </Group>
          <Tooltip label={t("top.leaveTip")}>
            <Button variant="default" leftSection={<IconLogout size={14} />} onClick={leave}>
              {t("top.leave")}
            </Button>
          </Tooltip>
        </Group>
      </Group>

      <aside className={`col left ${gm ? "with-tabs" : ""} ${collapsed.left ? "collapsed" : ""}`}>
        {gm ? (
          <GmTabs state={state} />
        ) : (
          <>
            <InitiativePanel state={state} />
            <AlliesPanel state={state} />
            <EffectsPanel state={state} />
            <PlayersPanel state={state} />
          </>
        )}
      </aside>
      <ColumnResizer
        side="left"
        width={widths.left}
        max={max.left}
        collapsed={collapsed.left}
        onResize={(w) => resize("left", w)}
        onCollapse={() => collapse("left")}
        onReset={() => reset("left")}
        onToggle={() => toggle("left")}
      />

      <main className="map-area">
        <BattleMap state={state} />
        <DiceOverlay />
      </main>

      <ColumnResizer
        side="right"
        width={widths.right}
        max={max.right}
        collapsed={collapsed.right}
        onResize={(w) => resize("right", w)}
        onCollapse={() => collapse("right")}
        onReset={() => reset("right")}
        onToggle={() => toggle("right")}
      />
      <aside className={`col right ${collapsed.right ? "collapsed" : ""}`}>
        <JoinFightBanner state={state} />
        <SelectedPanel state={state} />
        <DicePanel state={state} />
      </aside>

      {gm && <CloseGuard />}
      <Shortcuts state={state} />
      {logDetached && <FloatingLog />}
      <SoundSync sound={state.sound} />
      <AboutModal opened={about} onClose={() => setAbout(false)} />
      <HandoutModal />
    </div>
  );
}
