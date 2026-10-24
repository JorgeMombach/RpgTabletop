import { useState } from "react";
import { LIMITS, MOB_COLORS, type MobTemplate } from "@rpg/shared";
import { act } from "../actions";
import { fmtMod } from "../format";
import { CombatantForm } from "./CombatantForm";
import { Panel } from "./Panel";
import { Abbr } from "./Abbr";

type Mode = { kind: "none" } | { kind: "newTemplate" } | { kind: "newMob" } | { kind: "edit"; id: string };

/** Mestre: modelos de mob da sessão e criação de mobs na batalha. */
export function BestiaryPanel({ templates }: { templates: MobTemplate[] }) {
  const [mode, setMode] = useState<Mode>({ kind: "none" });
  const close = () => setMode({ kind: "none" });

  return (
    <Panel
      title="Bestiário"
      aside={
        mode.kind === "none" && (
          <div className="row-gap">
            <button className="btn small" onClick={() => setMode({ kind: "newMob" })}>
              + Avulso
            </button>
            <button className="btn small" onClick={() => setMode({ kind: "newTemplate" })}>
              + Template
            </button>
          </div>
        )
      }
    >
      {mode.kind === "newTemplate" && (
        <CombatantForm
          palette={MOB_COLORS}
          submitLabel="Criar template"
          withNotes
          onCancel={close}
          onSubmit={async (v) => {
            const ok = (await act("template:upsert", v)).ok;
            if (ok) close();
            return ok;
          }}
        />
      )}

      {mode.kind === "newMob" && (
        <CombatantForm
          palette={MOB_COLORS}
          submitLabel="Adicionar à batalha"
          onCancel={close}
          onSubmit={async (v) => {
            const ok = (await act("mob:add", v)).ok;
            if (ok) close();
            return ok;
          }}
        />
      )}

      {templates.length === 0 && mode.kind === "none" && (
        <p className="muted small">Crie templates (ex.: Goblin) para adicionar vários mobs iguais de uma vez.</p>
      )}

      <ul className="list">
        {templates.map((t) =>
          mode.kind === "edit" && mode.id === t.id ? (
            <li key={t.id}>
              <CombatantForm
                initial={t}
                palette={MOB_COLORS}
                submitLabel="Salvar"
                withNotes
                onCancel={close}
                onSubmit={async (v) => {
                  const ok = (await act("template:upsert", { ...v, id: t.id })).ok;
                  if (ok) close();
                  return ok;
                }}
              />
            </li>
          ) : (
            <TemplateRow key={t.id} t={t} onEdit={() => setMode({ kind: "edit", id: t.id })} />
          ),
        )}
      </ul>
    </Panel>
  );
}

function TemplateRow({ t, onEdit }: { t: MobTemplate; onEdit: () => void }) {
  const [qty, setQty] = useState("1");

  return (
    <li className="template-row">
      <div className="template-info">
        <span className="dot" style={{ background: t.color }} aria-hidden />
        <div className="grow">
          <div className="ellipsis" title={t.notes ? `${t.name} — ${t.notes}` : t.name}>
            {t.name}
          </div>
          <div className="muted small">
            Vida {t.hpMax} · <Abbr title="Modificador de Destreza (usado na iniciativa: d20 + mod. DES)">DES</Abbr> {fmtMod(t.dexMod)}
          </div>
        </div>
        <button className="icon-btn" title="Editar" onClick={onEdit}>
          ✎
        </button>
        <button
          className="icon-btn"
          title="Excluir template"
          onClick={() => {
            if (confirm(`Excluir o template "${t.name}"? Mobs já criados continuam na batalha.`)) {
              void act("template:remove", { id: t.id });
            }
          }}
        >
          🗑
        </button>
      </div>
      <form
        className="template-add"
        onSubmit={(e) => {
          e.preventDefault();
          void act("mob:addFromTemplate", { templateId: t.id, qty: Number(qty) });
        }}
      >
        <input
          type="number"
          min={LIMITS.qty.min}
          max={LIMITS.qty.max}
          value={qty}
          onChange={(e) => setQty(e.target.value)}
          aria-label="Quantidade"
        />
        <button className="btn small primary">Adicionar à batalha</button>
      </form>
    </li>
  );
}
