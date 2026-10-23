import { useState } from "react";
import type { HostInfo } from "@rpg/shared";
import { Panel } from "./Panel";

export function InvitePanel({ host }: { host: HostInfo }) {
  const [copied, setCopied] = useState<string | null>(null);
  // Outro dispositivo não alcança o "localhost" daqui: usa o primeiro endereço de convite.
  const gmLink = `${host.addresses[0]?.url ?? location.origin}/?gm=${host.gmKey}`;

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
        <p className="muted small">
          Nenhum endereço detectado. No Docker, defina <code>PUBLIC_URLS</code> com o endereço que os jogadores usam
          (ex.: <code>http://192.168.0.10:3000</code>).
        </p>
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
      <details className="gm-link">
        <summary className="muted small">Abrir como mestre em outro dispositivo</summary>
        <p className="muted small">Quem abrir este link entra como mestre. Não compartilhe com os jogadores.</p>
        <div className="invite-row">
          <code>{gmLink}</code>
          <button className="btn small" onClick={() => copy(gmLink)}>
            {copied === gmLink ? "Copiado" : "Copiar"}
          </button>
        </div>
      </details>
    </Panel>
  );
}
