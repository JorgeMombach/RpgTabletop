import { Indicator, Stack, Tabs, Text } from "@mantine/core";
import { IconCloud, IconMap2, IconSwords, IconUsers } from "@tabler/icons-react";
import type { ClientState, Combatant } from "@rpg/shared";
import { useEffect, useRef, useState } from "react";
import { useT, type MessageKey } from "../i18n";
import { AlliesPanel } from "./AlliesPanel";
import { BestiaryPanel } from "./BestiaryPanel";
import { EffectsPanel } from "./EffectsPanel";
import { InitiativePanel } from "./InitiativePanel";
import { InvitePanel } from "./InvitePanel";
import { MapPanel } from "./MapPanel";
import { MobsPanel, NpcsPanel } from "./MobsPanel";
import { PlayersPanel } from "./PlayersPanel";
import { ScenesPanel } from "./ScenesPanel";
import { SessionPanel } from "./SessionPanel";
import { SoundPanel } from "./SoundPanel";
import { WeatherPanel } from "./WeatherPanel";

type Tab = "combat" | "map" | "ambience" | "table";

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
 * Combate, Mapa (cenas e mapa), Ambiente (clima e som) e Mesa (bestiário, jogadores, sessão, convite).
 * A aba não troca sozinha: quando a vez muda com outra aba aberta, a de Combate ganha um ponto.
 * A aba escolhida fica guardada neste navegador.
 */
export function GmTabs({ state }: { state: ClientState }) {
  const t = useT();
  const [tab, setTab] = useState<Tab>(readTab);
  const [turnDot, setTurnDot] = useState(false);
  const { combat } = state.battle;

  // Vez nova com o mestre em outra aba: avisa com o ponto (some ao abrir Combate).
  const lastTurn = useRef(combat.turn);
  useEffect(() => {
    if (combat.turn === lastTurn.current) return;
    lastTurn.current = combat.turn;
    if (combat.active && tab !== "combat") setTurnDot(true);
  }, [combat.turn, combat.active, tab]);

  function open(next: Tab) {
    setTab(next);
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
        <InitiativePanel state={state} />
        <MobsPanel mobs={state.battle.mobs as Combatant[]} />
        <NpcsPanel npcs={state.battle.npcs as Combatant[]} />
        <AlliesPanel state={state} />
        <EffectsPanel state={state} />
      </Tabs.Panel>
      <Tabs.Panel value="map" className="gm-tabs-panel">
        <ScenesPanel state={state} />
        <MapPanel map={state.battle.map} />
      </Tabs.Panel>
      <Tabs.Panel value="ambience" className="gm-tabs-panel">
        <WeatherPanel state={state} />
        <SoundPanel state={state} />
      </Tabs.Panel>
      <Tabs.Panel value="table" className="gm-tabs-panel">
        <BestiaryPanel templates={state.templates} />
        <PlayersPanel state={state} />
        <SessionPanel />
        {state.host && <InvitePanel host={state.host} />}
      </Tabs.Panel>
    </Tabs>
  );
}
