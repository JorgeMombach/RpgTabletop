import { useState } from "react";
import type { HostInfo } from "@rpg/shared";
import { Panel } from "./Panel";

export function InvitePanel({ host }: { host: HostInfo }) {
  const [copied, setCopied] = useState<string | null>(null);

  async function copy(url: string) {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(url);
      setTimeout(() => setCopied((c) => (c === url ? null : c)), 1500);
    } catch {
      // Clipboard indisponível: o endereço continua visível para copiar à mão.
    }
  }

  return (
    <Panel title="Convidar jogadores">
      {host.addresses.length === 0 ? (
        <p className="muted small">Nenhuma interface de rede encontrada.</p>
      ) : (
        <ul className="invite">
          {host.addresses.map((a) => (
            <li key={a.url}>
              <div>
                <code>{a.url}</code>
                <div className="muted small">{a.label}</div>
              </div>
              <button className="btn small" onClick={() => copy(a.url)}>
                {copied === a.url ? "Copiado" : "Copiar"}
              </button>
            </li>
          ))}
        </ul>
      )}
    </Panel>
  );
}
