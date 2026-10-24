import { useState, type FormEvent } from "react";
import { LIMITS, type ClientState, type CombatantView } from "@rpg/shared";
import { act } from "../actions";
import { select, useApp } from "../store";
import { Panel } from "./Panel";

export function InitiativePanel({ state }: { state: ClientState }) {
  const selectedId = useApp((s) => s.selectedId);
  const [grouped, setGrouped] = useState(false);
  const gm = state.self.role === "gm";
  const { combat } = state.battle;

  const all: CombatantView[] = [...state.allies, ...state.battle.mobs];
  const byId = new Map(all.map((c) => [c.id, c]));
  const order = combat.order.map((id) => byId.get(id)).filter((c): c is CombatantView => !!c);
  const currentId = combat.active ? combat.order[combat.turnIndex] : null;
  const canEdit = (c: CombatantView) => gm || (c.type === "ally" && c.ownerId === state.self.id);
  const pending = all.filter((c) => c.initiative === null && canEdit(c));
  const myTurn = !gm && currentId !== null && byId.get(currentId)?.ownerId === state.self.id;

  return (
    <Panel
      title="Iniciativa"
      className={myTurn ? "my-turn" : ""}
      aside={combat.active && <span className="round-tag">Round {combat.round}</span>}
    >
      {myTurn && <div className="turn-banner">Sua vez!</div>}

      {gm && (
        <div className="init-controls">
          {combat.active ? (
            <>
              <button className="btn small" onClick={() => act("combat:prev", {})} title="Turno anterior">
                ◀
              </button>
              <button className="btn small primary grow" onClick={() => act("combat:next", {})}>
                Próximo turno ▶
              </button>
              <button
                className="btn small"
                onClick={() => confirm("Encerrar o combate? As iniciativas serão zeradas.") && act("combat:end", {})}
              >
                Encerrar
              </button>
            </>
          ) : (
            <>
              <button
                className="btn small"
                disabled={state.battle.mobs.length === 0}
                onClick={() => act("init:rollMobs", { grouped })}
              >
                🎲 Rolar mobs
              </button>
              <button className="btn small primary grow" disabled={order.length === 0} onClick={() => act("combat:start", {})}>
                Iniciar combate
              </button>
            </>
          )}
        </div>
      )}
      {gm && !combat.active && state.battle.mobs.length > 0 && (
        <label className="check">
          <input type="checkbox" checked={grouped} onChange={(e) => setGrouped(e.target.checked)} />
          Uma rolagem por template (mobs iguais agem juntos)
        </label>
      )}

      {order.length === 0 ? (
        <p className="muted small">
          {gm ? "Role a iniciativa dos mobs; os jogadores rolam a dos personagens." : "Role sua iniciativa abaixo quando o mestre pedir."}
        </p>
      ) : (
        <ol className="init-list">
          {order.map((c, i) => (
            <InitRow
              key={c.id}
              c={c}
              index={i}
              last={i === order.length - 1}
              current={c.id === currentId}
              selected={c.id === selectedId}
              mine={c.ownerId === state.self.id}
              editable={canEdit(c)}
              gm={gm}
            />
          ))}
        </ol>
      )}

      {pending.length > 0 && (
        <div className="init-pending">
          <div className="muted small">Sem iniciativa</div>
          {pending.map((c) => (
            <PendingRow key={c.id} c={c} />
          ))}
        </div>
      )}
    </Panel>
  );
}

function InitRow(props: {
  c: CombatantView;
  index: number;
  last: boolean;
  current: boolean;
  selected: boolean;
  mine: boolean;
  editable: boolean;
  gm: boolean;
}) {
  const { c, index, last, current, selected, mine, editable, gm } = props;
  const [editing, setEditing] = useState<string | null>(null);
  const down = c.hp !== undefined && c.hp <= 0;

  function commit(e?: FormEvent) {
    e?.preventDefault();
    if (editing !== null && editing.trim() !== "") void act("init:set", { id: c.id, value: Number(editing) });
    setEditing(null);
  }

  return (
    <li
      className={`init-row ${current ? "current" : ""} ${selected ? "selected" : ""} ${down ? "down" : ""}`}
      onClick={() => select(c.id)}
    >
      <span className="turn-marker" aria-label={current ? "Na vez" : undefined}>
        {current ? "▶" : ""}
      </span>
      <span className="dot" style={{ background: c.color }} aria-hidden />
      <span className="grow ellipsis" title={c.name}>
        {c.name}
        {mine && <span className="muted small"> (seu)</span>}
      </span>

      {editing !== null ? (
        <form onSubmit={commit} onClick={(e) => e.stopPropagation()}>
          <input
            className="init-edit"
            type="number"
            autoFocus
            value={editing}
            min={LIMITS.initiative.min}
            max={LIMITS.initiative.max}
            onChange={(e) => setEditing(e.target.value)}
            onBlur={() => commit()}
            onKeyDown={(e) => e.key === "Escape" && setEditing(null)}
          />
        </form>
      ) : (
        <button
          className="init-value"
          disabled={!editable}
          title={c.initRoll !== null ? `d20: ${c.initRoll}` : "Valor informado"}
          onClick={(e) => {
            e.stopPropagation();
            setEditing(String(c.initiative ?? ""));
          }}
        >
          {c.initiative}
        </button>
      )}

      {editable && (
        <button
          className="icon-btn"
          title="Rolar de novo"
          onClick={(e) => {
            e.stopPropagation();
            void act("init:roll", { id: c.id });
          }}
        >
          🎲
        </button>
      )}
      {gm && (
        <span className="reorder">
          <button
            className="icon-btn"
            title="Subir"
            disabled={index === 0}
            onClick={(e) => {
              e.stopPropagation();
              void act("init:move", { id: c.id, toIndex: index - 1 });
            }}
          >
            ▲
          </button>
          <button
            className="icon-btn"
            title="Descer"
            disabled={last}
            onClick={(e) => {
              e.stopPropagation();
              void act("init:move", { id: c.id, toIndex: index + 1 });
            }}
          >
            ▼
          </button>
        </span>
      )}
    </li>
  );
}

function PendingRow({ c }: { c: CombatantView }) {
  const [value, setValue] = useState("");

  return (
    <form
      className="pending-row"
      onSubmit={(e) => {
        e.preventDefault();
        if (value.trim()) void act("init:set", { id: c.id, value: Number(value) }).then((r) => r.ok && setValue(""));
      }}
    >
      <span className="dot" style={{ background: c.color }} aria-hidden />
      <span className="grow ellipsis" title={c.name}>
        {c.name}
      </span>
      <input
        type="number"
        placeholder="Valor"
        title="Valor do dado físico (d20 + mod. DES)"
        value={value}
        min={LIMITS.initiative.min}
        max={LIMITS.initiative.max}
        onChange={(e) => setValue(e.target.value)}
        aria-label={`Iniciativa de ${c.name}`}
      />
      <button
        type="button"
        className="btn small icon"
        title="Rolar iniciativa (d20 + mod. DES)"
        aria-label={`Rolar iniciativa de ${c.name}`}
        onClick={() => act("init:roll", { id: c.id })}
      >
        🎲
      </button>
    </form>
  );
}
