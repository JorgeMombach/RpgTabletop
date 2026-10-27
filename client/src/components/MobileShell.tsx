import { ActionIcon, Badge, Group, Indicator, Menu, Text, UnstyledButton } from "@mantine/core";
import { IconCheck, IconDeviceDesktop, IconDice5, IconLogout, IconMap, IconMenu2, IconSwords, IconUser } from "@tabler/icons-react";
import type { ClientState } from "@rpg/shared";
import { useEffect, useState, type ReactNode } from "react";
import { BattleMap } from "../map/BattleMap";
import { LANGS, setLang, useLang, useT, type Lang, type MessageKey } from "../i18n";
import { setLayoutChoice } from "../layout";
import { leave } from "../session";
import { select, useApp } from "../store";
import { AlliesPanel } from "./AlliesPanel";
import { D20Emblem } from "./D20Emblem";
import { DiceOverlay } from "./DiceOverlay";
import { DicePanel } from "./DicePanel";
import { EffectsPanel } from "./EffectsPanel";
import { InitiativePanel } from "./InitiativePanel";
import { PlayersPanel } from "./PlayersPanel";
import { SelectedPanel } from "./SelectedPanel";
import { HandoutButton, HandoutModal } from "./Handout";
import { TurnStatus } from "./Shell";
import { SoundSync } from "./SoundSync";
import { VolumeControl } from "./VolumeControl";

type Tab = "map" | "sheet" | "dice" | "combat";

const TABS: { id: Tab; label: MessageKey; icon: typeof IconMap }[] = [
  { id: "map", label: "mobile.tab.map", icon: IconMap },
  { id: "sheet", label: "mobile.tab.sheet", icon: IconUser },
  { id: "dice", label: "mobile.tab.dice", icon: IconDice5 },
  { id: "combat", label: "mobile.tab.combat", icon: IconSwords },
];

const TAB_KEY = "rpg.mobileTab";

function readTab(): Tab {
  try {
    const t = sessionStorage.getItem(TAB_KEY);
    return TABS.some((x) => x.id === t) ? (t as Tab) : "map";
  } catch {
    return "map";
  }
}

/**
 * Tela de celular e tablet do jogador (E23): topo compacto, uma aba por vez e a barra de abas embaixo,
 * no alcance do polegar. O mapa fica sempre montado (só escondido) para não perder zoom e posição.
 * O mestre continua no layout de computador.
 */
export function MobileShell({ state }: { state: ClientState }) {
  const t = useT();
  const lang = useLang((s) => s.lang);
  const connected = useApp((s) => s.connected);
  const selectedId = useApp((s) => s.selectedId);
  const [tab, setTab] = useState<Tab>(readTab);
  const me = state.self.id;
  const { combat, rolls } = state.battle;
  const currentId = combat.active ? combat.order[combat.turnIndex] : null;
  const current = state.allies.find((a) => a.id === currentId);
  const myTurn = !!current && current.ownerId === me;
  const requested = !!rolls.request && rolls.request.playerIds.includes(me) && !rolls.request.done.includes(me);
  const mine = state.allies.find((a) => a.ownerId === me && !a.summonerId);

  function open(next: Tab) {
    setTab(next);
    try {
      sessionStorage.setItem(TAB_KEY, next);
    } catch {
      // ignora
    }
  }

  // Algo esperando um toque no mapa (personagem ou conjurado): vai para a aba Mapa.
  const placing = useApp((s) => s.placing);
  useEffect(() => {
    if (placing) open("map");
  }, [placing]);

  // Ficha sem ninguém escolhido: abre o próprio personagem.
  useEffect(() => {
    if (tab === "sheet" && !selectedId && mine) select(mine.id);
  }, [tab, selectedId, mine?.id]);

  const dots: Partial<Record<Tab, boolean>> = { dice: myTurn || requested, combat: myTurn };

  return (
    <div className="mobile-shell">
      <Group component="header" className="mobile-top" justify="space-between" wrap="nowrap" gap="xs" px="sm">
        <D20Emblem size={22} />
        {myTurn ? (
          <Text size="sm" fw={700} c="bronze.4" className="turn-status">
            {t("top.yourTurn")}
          </Text>
        ) : combat.active ? (
          <TurnStatus state={state} />
        ) : (
          <Text fw={700} ff="heading" c="bronze.4" fz={15} truncate className="turn-status">
            Jamal's Tabletop
          </Text>
        )}
        {!connected && (
          <Badge color="yellow" variant="light" size="sm">
            {t("top.reconnecting")}
          </Badge>
        )}
        <HandoutButton compact />
        <VolumeControl />
        <Menu position="bottom-end" withinPortal>
          <Menu.Target>
            <ActionIcon variant="default" size="lg" aria-label={t("mobile.menu")}>
              <IconMenu2 size={18} />
            </ActionIcon>
          </Menu.Target>
          <Menu.Dropdown>
            <Menu.Label>
              {state.self.name} · {t("common.player")}
            </Menu.Label>
            <Menu.Item leftSection={<IconDeviceDesktop size={14} />} onClick={() => setLayoutChoice("desktop")}>
              {t("mobile.desktopLayout")}
            </Menu.Item>
            <Menu.Label>{t("lang.label")}</Menu.Label>
            {(Object.keys(LANGS) as Lang[]).map((l) => (
              <Menu.Item key={l} lang={l} onClick={() => setLang(l)} rightSection={l === lang ? <IconCheck size={14} /> : null}>
                {LANGS[l]}
              </Menu.Item>
            ))}
            <Menu.Divider />
            <Menu.Item leftSection={<IconLogout size={14} />} onClick={leave}>
              {t("top.leave")}
            </Menu.Item>
          </Menu.Dropdown>
        </Menu>
      </Group>

      <main className="mobile-content">
        <div className={`mobile-map ${tab === "map" ? "" : "hidden"}`}>
          <BattleMap state={state} compact />
        </div>
        {tab === "sheet" && (
          <Pane>
            {/* Sem ninguém escolhido (ainda sem personagem), o painel vazio só ocuparia a tela. */}
            {selectedId && <SelectedPanel state={state} />}
            <AlliesPanel state={state} />
          </Pane>
        )}
        {tab === "dice" && (
          <Pane>
            <DicePanel state={state} inline />
          </Pane>
        )}
        {tab === "combat" && (
          <Pane>
            <InitiativePanel state={state} />
            <EffectsPanel state={state} />
            <PlayersPanel state={state} />
          </Pane>
        )}
        {/* Dados 3D por cima de qualquer aba: rolar na aba Dados também mostra a rolagem. */}
        <DiceOverlay />
      </main>

      <nav className="mobile-tabs" aria-label={t("mobile.sections")}>
        {TABS.map(({ id, label, icon: Icon }) => (
          <UnstyledButton key={id} className={`mobile-tab ${tab === id ? "active" : ""}`} onClick={() => open(id)} aria-current={tab === id ? "page" : undefined}>
            <Indicator disabled={!dots[id] || tab === id} color="bronze" size={8} offset={2} processing>
              <Icon size={22} stroke={1.6} />
            </Indicator>
            <Text size="xs" fw={tab === id ? 700 : 500}>
              {t(label)}
            </Text>
          </UnstyledButton>
        ))}
      </nav>

      <SoundSync sound={state.sound} />
      <HandoutModal />
    </div>
  );
}

function Pane({ children }: { children: ReactNode }) {
  return <div className="mobile-pane">{children}</div>;
}
