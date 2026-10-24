import { useState, type FormEvent } from "react";
import { APP_VERSION, NAME_MAX_LENGTH, type JoinError } from "@rpg/shared";
import { join, savedName } from "../session";
import { useApp } from "../store";

const ERRORS: Record<JoinError, string> = {
  invalid_name: "Digite um nome.",
  room_full: "Sala cheia: o limite de jogadores foi atingido.",
};

export function JoinScreen() {
  const { connected, probedRole, joining, joinError } = useApp();
  const [name, setName] = useState(savedName);

  function submit(e: FormEvent) {
    e.preventDefault();
    if (name.trim()) void join(name);
  }

  return (
    <main className="join">
      <form className="join-card" onSubmit={submit}>
        <div className="join-logo" aria-hidden>
          🎲
        </div>
        <h1>Jamal's Tabletop</h1>

        {!connected ? (
          <p className="muted">Conectando ao servidor…</p>
        ) : (
          <p className="join-role">
            Você vai entrar como{" "}
            <strong className={probedRole === "gm" ? "role-gm" : "role-player"}>
              {probedRole === "gm" ? "Mestre (host)" : "Jogador"}
            </strong>
          </p>
        )}

        <label className="field">
          <span>Seu nome</span>
          <input
            autoFocus
            value={name}
            maxLength={NAME_MAX_LENGTH}
            onChange={(e) => setName(e.target.value)}
            placeholder={probedRole === "gm" ? "Ex.: Mestre" : "Ex.: Ana"}
          />
        </label>

        {joinError && <p className="error">{ERRORS[joinError]}</p>}

        <button className="btn primary" disabled={!connected || joining || !name.trim()}>
          {joining ? "Entrando…" : "Entrar"}
        </button>
        <p className="muted small">v{APP_VERSION}</p>
      </form>
    </main>
  );
}
