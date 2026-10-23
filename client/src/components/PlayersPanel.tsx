import type { ClientState } from "@rpg/shared";
import { Panel } from "./Panel";

export function PlayersPanel({ state }: { state: ClientState }) {
  const online = state.players.filter((p) => p.role === "player" && p.connected).length;

  return (
    <Panel
      title="Na sessão"
      aside={
        <span className="muted small">
          {online}/{state.maxPlayers} jogadores
        </span>
      }
    >
      <ul className="players">
        {state.players.map((p) => (
          <li key={p.id} className={p.connected ? "" : "offline"}>
            <span className={`dot ${p.connected ? "on" : "off"}`} aria-hidden />
            <span className="player-name">
              {p.name}
              {p.id === state.self.id && <span className="muted"> (você)</span>}
            </span>
            {p.role === "gm" ? (
              <span className="role-tag role-gm">Mestre</span>
            ) : (
              !p.connected && <span className="muted small">offline</span>
            )}
          </li>
        ))}
      </ul>
    </Panel>
  );
}
