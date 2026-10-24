import { useState, type FormEvent } from "react";
import { DICE, LIMITS, type ClientState, type LogEntry, type RollMode, type RollTerm } from "@rpg/shared";
import { act } from "../actions";
import { Panel } from "./Panel";
import { Abbr } from "./Abbr";

const MODES: { value: RollMode; label: string }[] = [
  { value: "normal", label: "Normal" },
  { value: "adv", label: "Vantagem" },
  { value: "dis", label: "Desvantagem" },
];

function buildExpr(count: number, faces: number, mod: number) {
  const m = mod === 0 ? "" : mod > 0 ? `+${mod}` : `${mod}`;
  return `${count}d${faces}${m}`;
}

export function DicePanel({ state }: { state: ClientState }) {
  const gm = state.self.role === "gm";
  const [count, setCount] = useState("1");
  const [mod, setMod] = useState("0");
  const [mode, setMode] = useState<RollMode>("normal");
  const [expr, setExpr] = useState("");
  const [hidden, setHidden] = useState(false);

  function rollDie(faces: number) {
    const n = Math.max(1, Math.trunc(Number(count)) || 1);
    const m = Math.trunc(Number(mod)) || 0;
    // Vantagem/desvantagem só faz sentido num único d20.
    const useMode = faces === 20 ? mode : "normal";
    void act("dice:roll", { expr: buildExpr(useMode === "normal" ? n : 1, faces, m), mode: useMode, hidden });
  }

  async function rollExpr(e: FormEvent) {
    e.preventDefault();
    if (!expr.trim()) return;
    const res = await act("dice:roll", { expr, mode, hidden });
    if (res.ok) setExpr("");
  }

  return (
    <Panel title="Dados" className="dice-panel">
      <div className="dice-buttons">
        {DICE.map((f) => (
          <button key={f} className="btn die" onClick={() => rollDie(f)} title={`Rolar d${f}`}>
            d{f}
          </button>
        ))}
      </div>

      <div className="dice-opts">
        <label className="field">
          <span>
            <Abbr title="Quantidade de dados">Qtd.</Abbr>
          </span>
          <input type="number" min={1} max={LIMITS.dice.count} value={count} onChange={(e) => setCount(e.target.value)} />
        </label>
        <label className="field">
          <span>Modificador</span>
          <input type="number" value={mod} onChange={(e) => setMod(e.target.value)} />
        </label>
      </div>

      <div className="segmented" role="radiogroup" aria-label="Modo do d20">
        {MODES.map((m) => (
          <button
            key={m.value}
            role="radio"
            aria-checked={mode === m.value}
            className={mode === m.value ? "on" : ""}
            onClick={() => setMode(m.value)}
          >
            {m.label}
          </button>
        ))}
      </div>

      <form className="dice-expr" onSubmit={rollExpr}>
        <input
          value={expr}
          maxLength={LIMITS.dice.exprLength}
          onChange={(e) => setExpr(e.target.value)}
          placeholder="Ex.: 2d6+1d4+3"
          aria-label="Expressão de dados"
        />
        <button className="btn primary" disabled={!expr.trim()}>
          Rolar
        </button>
      </form>

      {gm && (
        <label className="check">
          <input type="checkbox" checked={hidden} onChange={(e) => setHidden(e.target.checked)} />
          Rolagem oculta (só você vê)
        </label>
      )}

      <RollLog log={state.log} selfId={state.self.id} />
    </Panel>
  );
}

function RollLog({ log, selfId }: { log: LogEntry[]; selfId: string }) {
  if (log.length === 0) return <p className="muted small">Nenhuma rolagem ainda.</p>;

  return (
    <ol className="roll-log">
      {[...log].reverse().map((e) => (
        <li key={e.id} className={`roll ${e.hidden ? "hidden-roll" : ""}`}>
          <div className="roll-meta">
            <span className={e.authorId === selfId ? "role-gm" : ""}>{e.author}</span>
            {e.hidden && <span className="role-tag">oculta</span>}
            <span className="muted small">
              {new Date(e.ts).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit", second: "2-digit" })}
            </span>
          </div>
          {e.roll ? <RollBody entry={e} /> : <div>{e.text}</div>}
        </li>
      ))}
    </ol>
  );
}

/** Valor natural do d20 que valeu, para destacar 20 e 1. */
function naturalD20(terms: RollTerm[]): number | null {
  const d = terms.find((t) => t.kind === "dice" && t.faces === 20 && (t.count === 1 || t.keptIndex !== undefined));
  if (!d || d.kind !== "dice") return null;
  return d.rolls[d.keptIndex ?? 0];
}

function RollBody({ entry }: { entry: LogEntry }) {
  const r = entry.roll!;
  const nat = naturalD20(r.terms);
  const crit = nat === 20 ? "crit" : nat === 1 ? "fumble" : "";

  return (
    <div className="roll-body">
      <div className="roll-detail">
        {entry.label && <span className="roll-label">{entry.label}</span>}
        <code>{r.expr}</code>
        {r.mode !== "normal" && <span className="muted small">{r.mode === "adv" ? "vantagem" : "desvantagem"}</span>}
        <div className="roll-dice">
          {r.terms.map((t, i) =>
            t.kind === "dice" ? (
              <span key={i} className="term">
                {t.sign < 0 && "−"}
                {t.rolls.map((v, j) => (
                  <span
                    key={j}
                    className={`die-chip ${t.keptIndex !== undefined && t.keptIndex !== j ? "dropped" : ""} ${
                      t.faces === 20 && v === 20 ? "nat20" : t.faces === 20 && v === 1 ? "nat1" : ""
                    }`}
                    title={`d${t.faces}`}
                  >
                    {v}
                  </span>
                ))}
              </span>
            ) : (
              <span key={i} className="term muted">
                {t.sign < 0 ? "−" : "+"}
                {t.value}
              </span>
            ),
          )}
        </div>
      </div>
      <div className={`roll-total ${crit}`}>
        {r.total}
        {crit && <span className="small">{nat === 20 ? "20 natural" : "1 natural"}</span>}
      </div>
    </div>
  );
}
