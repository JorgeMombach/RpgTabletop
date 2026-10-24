import type { Combatant } from "@rpg/shared";
import { removeMob } from "../commands";
import { DRAG_MIME } from "../map/BattleMap";
import { select, useApp } from "../store";
import { HpBar } from "./HpBar";
import { Panel } from "./Panel";

/** Mestre: mobs da batalha atual. */
export function MobsPanel({ mobs }: { mobs: Combatant[] }) {
  const selectedId = useApp((s) => s.selectedId);

  return (
    <Panel title="Mobs na batalha" aside={<span className="muted small">{mobs.length}</span>}>
      {mobs.length === 0 ? (
        <p className="muted small">Nenhum mob. Adicione pelo bestiário.</p>
      ) : (
        <ul className="list">
          {mobs.map((m) => (
            <li
              key={m.id}
              className={`crow ${m.id === selectedId ? "selected" : ""} ${m.hp <= 0 ? "down" : ""}`}
              onClick={() => select(m.id)}
              draggable
              onDragStart={(e) => e.dataTransfer.setData(DRAG_MIME, m.id)}
              title={m.pos ? undefined : "Fora do mapa: arraste para posicionar"}
            >
              <span className="dot" style={{ background: m.color }} aria-hidden />
              <div className="grow">
                <div className="crow-head">
                  <span className="ellipsis" title={m.name}>
                    {m.hp <= 0 && "✕ "}
                    {m.name}
                    {!m.pos && <span className="muted small"> · fora do mapa</span>}
                  </span>
                  <span className="muted small">
                    {m.hp}/{m.hpMax}
                  </span>
                </div>
                <HpBar hp={m.hp} hpMax={m.hpMax} />
              </div>
              <button
                className="icon-btn"
                title="Remover da batalha"
                onClick={(e) => {
                  e.stopPropagation();
                  removeMob(m);
                }}
              >
                🗑
              </button>
            </li>
          ))}
        </ul>
      )}
    </Panel>
  );
}
