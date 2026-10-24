import { useState } from "react";
import { ALLY_COLORS, type ClientState } from "@rpg/shared";
import { act } from "../actions";
import { DRAG_MIME } from "../map/BattleMap";
import { select, useApp } from "../store";
import { CombatantForm } from "./CombatantForm";
import { HpBar } from "./HpBar";
import { Panel } from "./Panel";

export function AlliesPanel({ state }: { state: ClientState }) {
  const selectedId = useApp((s) => s.selectedId);
  const [creating, setCreating] = useState(false);
  const gm = state.self.role === "gm";
  const hasOwn = state.allies.some((a) => a.ownerId === state.self.id);
  const ownerName = (id?: string) => state.players.find((p) => p.id === id)?.name;

  return (
    <Panel
      title="Aliados"
      aside={
        // Jogador tem um personagem só (o servidor também recusa um segundo).
        !creating &&
        (gm || !hasOwn) && (
          <button className="btn small" onClick={() => setCreating(true)}>
            {gm ? "+ Aliado (NPC)" : "+ Criar personagem"}
          </button>
        )
      }
    >
      {creating && (
        <CombatantForm
          palette={ALLY_COLORS}
          submitLabel="Criar"
          onCancel={() => setCreating(false)}
          onSubmit={async (v) => {
            const res = await act("ally:create", v);
            if (res.ok) {
              setCreating(false);
              if (res.ids?.[0]) select(res.ids[0]);
            }
            return res.ok;
          }}
        />
      )}

      {state.allies.length === 0 && !creating && (
        <p className="muted small">
          {gm ? "Os jogadores criam os próprios personagens." : "Crie seu personagem para controlar a vida."}
        </p>
      )}

      <ul className="list">
        {state.allies.map((a) => (
          <li
            key={a.id}
            className={`crow ${a.id === selectedId ? "selected" : ""} ${a.hp <= 0 ? "down" : ""}`}
            onClick={() => select(a.id)}
            draggable={gm || a.ownerId === state.self.id}
            onDragStart={(e) => e.dataTransfer.setData(DRAG_MIME, a.id)}
            title={!a.pos && (gm || a.ownerId === state.self.id) ? "Fora do mapa: arraste para posicionar" : undefined}
          >
            <span className="dot" style={{ background: a.color }} aria-hidden />
            <div className="grow">
              <div className="crow-head">
                <span className="ellipsis" title={a.name}>
                  {a.name}
                  {a.ownerId === state.self.id ? (
                    <span className="muted small"> (seu)</span>
                  ) : (
                    ownerName(a.ownerId) && <span className="muted small"> · {ownerName(a.ownerId)}</span>
                  )}
                </span>
                <span className="muted small">{a.hp <= 0 ? "Caído" : `${a.hp}/${a.hpMax}`}</span>
              </div>
              <HpBar hp={a.hp} hpMax={a.hpMax} />
            </div>
          </li>
        ))}
      </ul>
    </Panel>
  );
}
