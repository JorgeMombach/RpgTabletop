import type { ReactNode } from "react";

/**
 * Conteúdo de tooltip com título (pergaminho, depois da 2.11): o nome em Cinzel e a tecla de atalho em cima,
 * um filete e a explicação embaixo. Para tooltips que explicam algo (ferramentas do mapa); os curtos
 * ("Remover") continuam só com o texto.
 */
export function TipTitle({ title, shortcut, children }: { title: string; shortcut?: string; children: ReactNode }) {
  return (
    <div className="tip-titled">
      <div className="tip-title">
        <span>{title}</span>
        {shortcut && <kbd className="tip-key">{shortcut}</kbd>}
      </div>
      <div className="tip-rule" />
      <div className="tip-body">{children}</div>
    </div>
  );
}
