import { useEffect, useRef, useState } from "react";
import { act } from "../actions";
import { select, setTool, toast } from "../store";

/** Confirmação do "Limpar campo de batalha" (SPEC F7). */
export function ClearBattleDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const ref = useRef<HTMLDialogElement>(null);
  const [keepTemplates, setKeepTemplates] = useState(true);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (open && !d.open) d.showModal();
    if (!open && d.open) d.close();
  }, [open]);

  async function confirm() {
    setBusy(true);
    const res = await act("battle:clear", { keepTemplates });
    setBusy(false);
    if (!res.ok) return;
    select(null);
    setTool("move");
    onClose();
    toast({ kind: "info", text: "Campo limpo. Pronto para a próxima batalha." });
  }

  return (
    <dialog ref={ref} className="dialog" onClose={onClose} onCancel={onClose}>
      <h2>Limpar campo de batalha?</h2>
      <div className="dialog-cols">
        <div>
          <div className="section-title">Sai</div>
          <ul>
            <li>Imagem do mapa</li>
            <li>Todos os mobs</li>
            <li>Iniciativa e rounds</li>
            <li>Posições dos tokens</li>
          </ul>
        </div>
        <div>
          <div className="section-title">Fica</div>
          <ul>
            <li>Jogadores conectados</li>
            <li>Personagens com vida, slots e magias</li>
            <li>Configuração do grid</li>
            <li>Log de dados</li>
          </ul>
        </div>
      </div>
      <label className="check">
        <input type="checkbox" checked={keepTemplates} onChange={(e) => setKeepTemplates(e.target.checked)} />
        Manter bestiário (templates) para a próxima luta
      </label>
      <div className="cform-actions">
        <button className="btn" onClick={onClose}>
          Cancelar
        </button>
        <button className="btn danger" disabled={busy} onClick={confirm}>
          Limpar campo
        </button>
      </div>
    </dialog>
  );
}
