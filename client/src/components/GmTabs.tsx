import { Indicator, Stack, Tabs, Text } from "@mantine/core";
import { IconCloud, IconMap2, IconSwords, IconUsers } from "@tabler/icons-react";
import type { ClientState, Combatant } from "@rpg/shared";
import { memo, useEffect, useRef, useState } from "react";
import { create } from "zustand";
import { SetupCard } from "./SetupCard";
import { useT, type MessageKey } from "../i18n";
import { setTool, useApp } from "../store";
import { AlliesPanel } from "./AlliesPanel";
import { BuildPanel, isBuildTool } from "./BuildPanel";
import { BestiaryPanel } from "./BestiaryPanel";
import { EffectsPanel } from "./EffectsPanel";
import { HandoutPanel } from "./Handout";
import { InitiativePanel } from "./InitiativePanel";
import { InvitePanel } from "./InvitePanel";
import { MapPanel } from "./MapPanel";
import { MobsPanel, NpcsPanel } from "./MobsPanel";
import { PlayersPanel } from "./PlayersPanel";
import { ScenesPanel } from "./ScenesPanel";
import { SessionPanel } from "./SessionPanel";
import { SoundPanel } from "./SoundPanel";
import { TablesPanel } from "./TablesPanel";
import { JournalPanel } from "./JournalPanel";
import { ClockPanel } from "./ClockPanel";
import { WeatherPanel } from "./WeatherPanel";

export type GmTab = "combat" | "map" | "ambience" | "table";
type Tab = GmTab;

const TABS: { id: Tab; label: MessageKey; icon: typeof IconSwords }[] = [
  { id: "combat", label: "gmTabs.combat", icon: IconSwords },
  { id: "map", label: "gmTabs.map", icon: IconMap2 },
  { id: "ambience", label: "gmTabs.ambience", icon: IconCloud },
  { id: "table", label: "gmTabs.table", icon: IconUsers },
];

const KEY = "rpg.gmTab";

function readTab(): Tab {
  try {
    const v = localStorage.getItem(KEY);
    return TABS.some((t) => t.id === v) ? (v as Tab) : "combat";
  } catch {
    return "combat";
  }
}

/**
 * Coluna da esquerda do mestre em abas (a lista de painéis tinha ficado comprida demais):
 * Combate, Mapa (cenas, construir e mapa), Ambiente (clima e som) e Mesa (mostrar para a mesa, regras da mesa, bestiário, jogadores, sessão, convite).
 * A aba não troca sozinha: quando a vez muda com outra aba aberta, a de Combate ganha um ponto.
 * A aba escolhida fica guardada neste navegador.
 */
/** Aba aberta, guardada fora do componente: o cartão Preparar a mesa troca a aba (L8). */
const useGmTab = create<{ tab: Tab }>(() => ({ tab: readTab() }));

/** Abre a aba e, se der, leva até o painel (`anchor` do Panel) e faz ele piscar. */
export function openGmTab(tab: GmTab, anchor?: string) {
  useGmTab.setState({ tab });
  try {
    localStorage.setItem(KEY, tab);
  } catch {
    // sem armazenamento: vale só nesta aba
  }
  if (!anchor) return;
  // Espera a aba nova aparecer.
  window.setTimeout(() => {
    const el = document.querySelector<HTMLElement>(`[data-panel="${anchor}"]`);
    if (!el) return;
    el.scrollIntoView({ behavior: "smooth", block: "start" });
    el.classList.remove("panel-flash");
    void el.offsetWidth;
    el.classList.add("panel-flash");
  }, 60);
}

/**
 * Painel que recebe o estado inteiro mas lê só alguns campos: redesenha só quando eles mudam. O `shareEqual`
 * mantém o que não mudou como o mesmo objeto, então comparar por identidade basta.
 */
function readsOnly(pick: (s: ClientState) => unknown[]) {
  return (a: { state: ClientState }, b: { state: ClientState }) => {
    const before = pick(a.state);
    const after = pick(b.state);
    return before.length === after.length && before.every((v, i) => v === after[i]);
  };
}

/**
 * As abas ficam montadas mesmo escondidas (Mantine): sem isto, mover um token redesenhava as quatro, inclusive o
 * catálogo SRD inteiro e o diário (medido em 2026-11-11: ~100 ms no mestre a cada movimento, no build de produção).
 */
const Panels = {
  MapPanel: memo(MapPanel),
  BuildPanel: memo(BuildPanel),
  ClockPanel: memo(ClockPanel),
  WeatherPanel: memo(WeatherPanel, readsOnly((s) => [s.battle.weather, s.sound.ambient, s.rules, s.allies])),
  SoundPanel: memo(SoundPanel, readsOnly((s) => [s.sound, s.soundLibrary])),
  ScenesPanel: memo(ScenesPanel, readsOnly((s) => [s.scenes, s.sceneId, s.allies.length, s.battle.combat.active, s.battle.combat.order.length])),
  HandoutPanel: memo(HandoutPanel),
  BestiaryPanel: memo(BestiaryPanel),
  TablesPanel: memo(TablesPanel),
  JournalPanel: memo(JournalPanel),
  PlayersPanel: memo(PlayersPanel, readsOnly((s) => [s.players, s.maxPlayers, s.self])),
  SessionPanel: memo(SessionPanel),
  InvitePanel: memo(InvitePanel),
};

export function GmTabs({ state }: { state: ClientState }) {
  const t = useT();
  const tab = useGmTab((s) => s.tab);
  const setTab = (next: Tab) => useGmTab.setState({ tab: next });
  const [turnDot, setTurnDot] = useState(false);
  const { combat } = state.battle;

  // Ferramenta de construção escolhida (atalho) com outra aba aberta: a coluna vai para Mapa, onde estão as opções dela.
  const tool = useApp((s) => s.tool);
  useEffect(() => {
    if (isBuildTool(tool) && useGmTab.getState().tab !== "map") openGmTab("map", "build");
  }, [tool]);

  // Vez nova com o mestre em outra aba: avisa com o ponto (some ao abrir Combate).
  const lastTurn = useRef(combat.turn);
  useEffect(() => {
    if (combat.turn === lastTurn.current) return;
    lastTurn.current = combat.turn;
    if (combat.active && tab !== "combat") setTurnDot(true);
  }, [combat.turn, combat.active, tab]);

  function open(next: Tab) {
    setTab(next);
    // Saindo da aba Mapa, a construção para (as opções ficariam escondidas).
    if (next !== "map" && isBuildTool(useApp.getState().tool)) setTool("move");
    if (next === "combat") setTurnDot(false);
    try {
      localStorage.setItem(KEY, next);
    } catch {
      // sem armazenamento: vale só nesta aba
    }
  }

  return (
    <Tabs value={tab} onChange={(v) => v && open(v as Tab)} className="gm-tabs">
      <Tabs.List grow className="gm-tabs-list" style={{ flexWrap: "nowrap" }}>
        {TABS.map(({ id, label, icon: Icon }) => (
          // Ícone em cima do nome: as quatro abas cabem numa linha mesmo com a coluna na largura mínima.
          <Tabs.Tab key={id} value={id} px={2} py={6}>
            <Indicator disabled={!(id === "combat" && turnDot)} size={7} offset={2} color="bronze" processing>
              <Stack gap={2} align="center">
                <Icon size={16} />
                <Text size="xs" lh={1}>
                  {t(label)}
                </Text>
              </Stack>
            </Indicator>
          </Tabs.Tab>
        ))}
      </Tabs.List>

      <Tabs.Panel value="combat" className="gm-tabs-panel">
        <SetupCard state={state} />
        <InitiativePanel state={state} />
        <MobsPanel mobs={state.battle.mobs as Combatant[]} templates={state.templates} />
        <NpcsPanel npcs={state.battle.npcs as Combatant[]} />
        <AlliesPanel state={state} />
        <EffectsPanel state={state} />
      </Tabs.Panel>
      <Tabs.Panel value="map" className="gm-tabs-panel">
        <Panels.ScenesPanel state={state} />
        <Panels.BuildPanel />
        <Panels.MapPanel map={state.battle.map} />
      </Tabs.Panel>
      <Tabs.Panel value="ambience" className="gm-tabs-panel">
        <Panels.ClockPanel clock={state.clock} />
        <Panels.WeatherPanel state={state} />
        <Panels.SoundPanel state={state} />
      </Tabs.Panel>
      <Tabs.Panel value="table" className="gm-tabs-panel">
        <Panels.HandoutPanel />
        <Panels.BestiaryPanel templates={state.templates} />
        <Panels.TablesPanel tables={state.tables} />
        <Panels.JournalPanel />
        <Panels.PlayersPanel state={state} />
        <Panels.SessionPanel />
        {state.host && <Panels.InvitePanel host={state.host} />}
      </Tabs.Panel>
    </Tabs>
  );
}
