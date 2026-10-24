import { useState } from "react";
import { ALLY_COLORS, MOB_COLORS, type ClientState, type Combatant, type CombatantView } from "@rpg/shared";
import { act } from "../actions";
import { removeMob } from "../commands";
import { fmtMod } from "../format";
import { cellAt, nearestFreeCell } from "../map/geometry";
import { select, useApp } from "../store";
import { Abbr } from "./Abbr";
import { CombatantForm } from "./CombatantForm";
import { HpBar } from "./HpBar";
import { HpControl } from "./HpControl";
import { MagicSection } from "./MagicSection";
import { Panel } from "./Panel";

/** Coloca o token no quadrado livre mais perto do centro da visão do mapa. */
function placeOnMap(state: ClientState, id: string) {
  const { viewCenter } = useApp.getState();
  const occupied = [...state.allies, ...state.battle.mobs].flatMap((c) => (c.pos ? [c.pos] : []));
  void act("token:move", { id, pos: nearestFreeCell(cellAt(viewCenter, state.battle.map), occupied) });
}

function Avatar({ c }: { c: CombatantView }) {
  return c.avatar ? (
    <img className="sel-avatar" src={c.avatar} alt="" style={{ borderColor: c.color }} />
  ) : (
    <span className="dot big" style={{ background: c.color }} aria-hidden />
  );
}

export function SelectedPanel({ state }: { state: ClientState }) {
  const selectedId = useApp((s) => s.selectedId);
  const [editingId, setEditingId] = useState<string | null>(null);

  const gm = state.self.role === "gm";
  const ally = state.allies.find((a) => a.id === selectedId);
  const mobView = state.battle.mobs.find((m) => m.id === selectedId);
  // Jogadores não recebem vida de mob, então só o mestre tem o mob completo.
  const c: Combatant | undefined = ally ?? (gm ? (mobView as Combatant | undefined) : undefined);
  const close = (
    <button className="icon-btn" title="Fechar" onClick={() => select(null)}>
      ✕
    </button>
  );

  if (!c && mobView) {
    return (
      <Panel title="Selecionado" aside={close}>
        <div className="sel-head">
          <Avatar c={mobView} />
          <div className="grow">
            <div className="sel-name">{mobView.name}</div>
            <div className="muted small">Inimigo</div>
          </div>
        </div>
      </Panel>
    );
  }

  if (!c) {
    return (
      <Panel title="Selecionado">
        <p className="muted small">Clique num aliado{gm ? " ou mob" : ""} (na lista ou no mapa) para ver e controlar a vida.</p>
      </Panel>
    );
  }

  const canEdit = gm || c.ownerId === state.self.id;
  const owner = state.players.find((p) => p.id === c.ownerId);
  const editing = editingId === c.id;

  return (
    <Panel title="Selecionado" aside={close}>
      <div className="sel-head">
        <Avatar c={c} />
        <div className="grow">
          <div className="sel-name ellipsis" title={c.name}>
            {c.name}
          </div>
          <div
            className="muted small ellipsis"
            title={`${c.type === "mob" ? "Mob" : owner ? `Aliado · ${owner.name}` : "Aliado"} · mod. DES ${fmtMod(c.dexMod)}`}
          >
            {c.type === "mob" ? "Mob" : owner ? `Aliado · ${owner.name}` : "Aliado"} · <Abbr title="Modificador de Destreza (usado na iniciativa)">DES</Abbr>{" "}
            {fmtMod(c.dexMod)}
          </div>
        </div>
        {canEdit && !editing && (
          <button
            className="btn small"
            title="Mudar nome, vida máxima, mod. DES, cor e avatar"
            onClick={() => setEditingId(c.id)}
          >
            ✎ Editar
          </button>
        )}
      </div>

      {editing ? (
        <CombatantForm
          initial={c}
          palette={c.type === "mob" ? MOB_COLORS : ALLY_COLORS}
          submitLabel="Salvar"
          onCancel={() => setEditingId(null)}
          onSubmit={async (v) => {
            const ok = (await act("combatant:update", { id: c.id, ...v })).ok;
            if (ok) setEditingId(null);
            return ok;
          }}
        />
      ) : canEdit ? (
        <HpControl c={c} />
      ) : (
        <div className="hp-readonly">
          <div>
            {c.hp} <span className="muted">/ {c.hpMax}</span>
          </div>
          <HpBar hp={c.hp} hpMax={c.hpMax} thick />
        </div>
      )}

      {c.type === "ally" && !editing && <MagicSection c={c} editable={canEdit} />}

      {canEdit && !editing && (
        <div className="sel-actions">
          <div className="row-gap">
            {c.pos ? (
              <button className="btn small" onClick={() => act("token:move", { id: c.id, pos: null })}>
                Tirar do mapa
              </button>
            ) : (
              <button className="btn small" onClick={() => placeOnMap(state, c.id)}>
                Colocar no mapa
              </button>
            )}
          </div>
          <button
            className="btn small danger-outline"
            onClick={() => {
              if (c.type === "mob") return void removeMob(c);
              if (confirm(`Remover ${c.name}?`)) {
                void act("ally:remove", { id: c.id }).then((r) => r.ok && select(null));
              }
            }}
          >
            Remover
          </button>
        </div>
      )}
    </Panel>
  );
}
