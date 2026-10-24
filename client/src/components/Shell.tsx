import { useState } from "react";
import { APP_VERSION, type ClientState, type Combatant } from "@rpg/shared";
import { BattleMap } from "../map/BattleMap";
import { leave } from "../session";
import { useApp } from "../store";
import { AlliesPanel } from "./AlliesPanel";
import { BestiaryPanel } from "./BestiaryPanel";
import { ClearBattleDialog } from "./ClearBattleDialog";
import { DicePanel } from "./DicePanel";
import { InitiativePanel } from "./InitiativePanel";
import { InvitePanel } from "./InvitePanel";
import { MapPanel } from "./MapPanel";
import { MobsPanel } from "./MobsPanel";
import { PlayersPanel } from "./PlayersPanel";
import { SelectedPanel } from "./SelectedPanel";
import { Toasts } from "./Toasts";

/** "Round 2 · vez de Thorin", visível para todos na barra do topo. */
function TurnStatus({ state }: { state: ClientState }) {
  const { combat } = state.battle;
  if (!combat.active) return null;
  const id = combat.order[combat.turnIndex];
  const who = [...state.allies, ...state.battle.mobs].find((c) => c.id === id);
  return (
    <span className="turn-status">
      Round {combat.round}
      {who && (
        <>
          {" · vez de "}
          <strong>{who.name}</strong>
        </>
      )}
    </span>
  );
}

export function Shell({ state }: { state: ClientState }) {
  const connected = useApp((s) => s.connected);
  const [clearing, setClearing] = useState(false);
  const gm = state.self.role === "gm";

  return (
    <div className="shell">
      <header className="topbar">
        <span className="brand">
          🎲 Jamal's Tabletop <span className="version">v{APP_VERSION}</span>
        </span>
        <TurnStatus state={state} />
        <div className="topbar-right">
          {!connected && <span className="badge warn">Reconectando…</span>}
          {gm && (
            <button className="btn small" onClick={() => setClearing(true)} title="Prepara o campo para a próxima batalha">
              🧹 Limpar campo
            </button>
          )}
          <span className="self">
            {state.self.name}
            <span className={`role-tag ${gm ? "role-gm" : "role-player"}`}>{gm ? "Mestre" : "Jogador"}</span>
          </span>
          <button
            className="btn small"
            title="Sair da sessão ou trocar de nome. Ao voltar, você reencontra o seu personagem."
            onClick={leave}
          >
            Sair
          </button>
        </div>
      </header>

      <aside className="col left">
        <InitiativePanel state={state} />
        {gm && <MobsPanel mobs={state.battle.mobs as Combatant[]} />}
        <AlliesPanel state={state} />
        {gm && <MapPanel map={state.battle.map} />}
        {gm && <BestiaryPanel templates={state.templates} />}
        <PlayersPanel state={state} />
        {gm && state.host && <InvitePanel host={state.host} />}
      </aside>

      <main className="map-area">
        <BattleMap state={state} />
      </main>

      <aside className="col right">
        <SelectedPanel state={state} />
        <DicePanel state={state} />
      </aside>

      {gm && <ClearBattleDialog open={clearing} onClose={() => setClearing(false)} />}
      <Toasts />
    </div>
  );
}
