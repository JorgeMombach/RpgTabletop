import { useState, type FormEvent } from "react";
import type { Combatant } from "@rpg/shared";
import { act } from "../actions";
import { HpBar } from "./HpBar";

/** Vida de um combatente: o sistema só soma/subtrai o que a pessoa informar (ADR-06). */
export function HpControl({ c }: { c: Combatant }) {
  const [amount, setAmount] = useState("");
  const [editing, setEditing] = useState<string | null>(null);
  const down = c.hp <= 0;

  function apply(sign: 1 | -1) {
    const n = Math.abs(Math.trunc(Number(amount)));
    if (!n) return;
    void act("hp:change", { id: c.id, delta: sign * n });
    setAmount("");
  }

  function commitEdit(e?: FormEvent) {
    e?.preventDefault();
    if (editing !== null && editing.trim() !== "") void act("hp:set", { id: c.id, value: Number(editing) });
    setEditing(null);
  }

  return (
    <div className="hp-control">
      <div className="hp-readout">
        {editing === null ? (
          <button className="hp-value" title="Clique para editar" onClick={() => setEditing(String(c.hp))}>
            {c.hp}
          </button>
        ) : (
          <form onSubmit={commitEdit}>
            <input
              className="hp-edit"
              type="number"
              autoFocus
              min={0}
              max={c.hpMax}
              value={editing}
              onChange={(e) => setEditing(e.target.value)}
              onBlur={() => commitEdit()}
              onKeyDown={(e) => e.key === "Escape" && setEditing(null)}
            />
          </form>
        )}
        <span className="muted">/ {c.hpMax}</span>
        {down && <span className="status-tag">{c.type === "mob" ? "Abatido" : "Caído"}</span>}
      </div>

      <HpBar hp={c.hp} hpMax={c.hpMax} thick />

      <div className="hp-actions">
        <input
          type="number"
          min={1}
          placeholder="Valor"
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") apply(e.shiftKey ? 1 : -1);
          }}
          aria-label="Valor de dano ou cura"
        />
        <button className="btn danger" onClick={() => apply(-1)} disabled={!amount}>
          − Dano
        </button>
        <button className="btn heal" onClick={() => apply(1)} disabled={!amount}>
          + Cura
        </button>
      </div>
      <div className="hp-footer">
        <span className="muted small">Enter = dano · Shift+Enter = cura</span>
        <button className="btn small" onClick={() => act("hp:full", { id: c.id })} disabled={c.hp === c.hpMax}>
          Vida cheia
        </button>
      </div>
    </div>
  );
}
