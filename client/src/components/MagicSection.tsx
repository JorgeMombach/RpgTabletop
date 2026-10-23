import { useState, type FormEvent } from "react";
import { LIMITS, SPELL_LEVELS, type Combatant, type SpellLevel, type SpellSlot } from "@rpg/shared";
import { act } from "../actions";

const ORDINAL = ["Truque", "1º", "2º", "3º", "4º", "5º", "6º", "7º", "8º", "9º"];
const EMPTY: SpellSlot = { max: 0, used: 0 };

/** Slots e magias de um aliado. O dono gerencia tudo livremente (SPEC F3). */
export function MagicSection({ c, editable }: { c: Combatant; editable: boolean }) {
  const [editingSlots, setEditingSlots] = useState(false);
  const slot = (l: SpellLevel) => c.spellSlots?.[l] ?? EMPTY;
  const levels = SPELL_LEVELS.filter((l) => slot(l).max > 0);
  const anyUsed = levels.some((l) => slot(l).used > 0);

  return (
    <div className="magic">
      <div className="magic-head">
        <span className="section-title">Slots de magia</span>
        {editable && (
          <button className="btn small" onClick={() => setEditingSlots((v) => !v)}>
            {editingSlots ? "Pronto" : "Ajustar"}
          </button>
        )}
      </div>

      {editingSlots ? (
        <div className="slot-editor">
          {SPELL_LEVELS.map((l) => (
            <label key={l} className="slot-max">
              <span>{ORDINAL[l]}</span>
              <input
                type="number"
                min={0}
                max={LIMITS.slotMax}
                value={slot(l).max}
                onChange={(e) => {
                  const max = Math.max(0, Math.min(LIMITS.slotMax, Math.trunc(Number(e.target.value)) || 0));
                  void act("slot:set", { id: c.id, level: l, max });
                }}
              />
            </label>
          ))}
        </div>
      ) : levels.length === 0 ? (
        <p className="muted small">{editable ? "Sem slots. Use “Ajustar” para definir quantos tem por nível." : "Sem slots."}</p>
      ) : (
        <div className="slot-rows">
          {levels.map((l) => {
            const { max, used } = slot(l);
            return (
              <div key={l} className="slot-row">
                <span className="slot-level">{ORDINAL[l]}</span>
                <div className="pips">
                  {Array.from({ length: max }, (_, i) => {
                    // Disponíveis primeiro, gastos depois: clicar gasta ou recupera um slot.
                    const spent = i >= max - used;
                    return (
                      <button
                        key={i}
                        className={`pip ${spent ? "spent" : ""}`}
                        disabled={!editable}
                        title={spent ? "Recuperar slot" : "Gastar slot"}
                        aria-label={`${ORDINAL[l]} nível: slot ${i + 1} ${spent ? "gasto" : "disponível"}`}
                        onClick={() => act("slot:set", { id: c.id, level: l, used: spent ? used - 1 : used + 1 })}
                      />
                    );
                  })}
                </div>
                <span className="muted small">
                  {max - used}/{max}
                </span>
              </div>
            );
          })}
        </div>
      )}

      {editable && (
        <div className="row-gap">
          <button className="btn small grow" disabled={!anyUsed} onClick={() => act("slots:restore", { id: c.id })}>
            Recuperar slots
          </button>
          <button
            className="btn small grow"
            disabled={!anyUsed && c.hp === c.hpMax}
            title="Vida cheia + todos os slots"
            onClick={() => act("ally:restoreAll", { id: c.id })}
          >
            Restaurar tudo
          </button>
        </div>
      )}

      {c.spells !== undefined || editable ? <SpellList c={c} editable={editable} /> : null}
    </div>
  );
}

function SpellList({ c, editable }: { c: Combatant; editable: boolean }) {
  const [name, setName] = useState("");
  const [level, setLevel] = useState("1");
  const [note, setNote] = useState("");
  const [adding, setAdding] = useState(false);
  const spells = c.spells ?? [];

  async function add(e: FormEvent) {
    e.preventDefault();
    const res = await act("spell:add", { id: c.id, name, level: Number(level), note: note || undefined });
    if (res.ok) {
      setName("");
      setNote("");
    }
  }

  return (
    <div className="spells">
      <div className="magic-head">
        <span className="section-title">Magias (referência)</span>
        {editable && !adding && (
          <button className="btn small" onClick={() => setAdding(true)}>
            + Magia
          </button>
        )}
      </div>

      {adding && (
        <form className="spell-form" onSubmit={add}>
          <input
            autoFocus
            placeholder="Nome da magia"
            maxLength={LIMITS.spellName}
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
          />
          <select value={level} onChange={(e) => setLevel(e.target.value)} aria-label="Nível">
            {ORDINAL.map((label, l) => (
              <option key={l} value={l}>
                {label}
              </option>
            ))}
          </select>
          <input
            className="spell-note"
            placeholder="Nota (opcional): dano, alcance…"
            maxLength={LIMITS.spellNote}
            value={note}
            onChange={(e) => setNote(e.target.value)}
          />
          <div className="cform-actions">
            <button type="button" className="btn small" onClick={() => setAdding(false)}>
              Fechar
            </button>
            <button className="btn small primary">Adicionar</button>
          </div>
        </form>
      )}

      {spells.length === 0 ? (
        !adding && <p className="muted small">Nenhuma magia anotada.</p>
      ) : (
        <ul className="spell-list">
          {spells.map((s) => (
            <li key={s.id}>
              <span className="spell-level">{ORDINAL[s.level] ?? s.level}</span>
              <div className="grow">
                <div>{s.name}</div>
                {s.note && <div className="muted small">{s.note}</div>}
              </div>
              {editable && (
                <button className="icon-btn" title="Remover magia" onClick={() => act("spell:remove", { id: c.id, spellId: s.id })}>
                  ✕
                </button>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
