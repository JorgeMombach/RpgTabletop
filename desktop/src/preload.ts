// Ponte entre a mesa (página) e o app do mestre (ADR-18). Só o que a página precisa, nada mais.
import { contextBridge, ipcRenderer } from "electron";

contextBridge.exposeInMainWorld("desktop", {
  /** A mesa decide o fechamento: `onRequest` roda quando o mestre fecha a janela. */
  guardClose(onRequest: () => void) {
    ipcRenderer.removeAllListeners("close-requested");
    ipcRenderer.on("close-requested", () => onRequest());
    ipcRenderer.send("close-guard");
  },
  confirmClose() {
    ipcRenderer.send("close-confirmed");
  },
  /** "Salvar como" do sistema, na pasta de sessões; `ok: false` se o mestre cancelar. */
  saveSession(json: string, fileName: string): Promise<{ ok: boolean }> {
    return ipcRenderer.invoke("save-session", json, fileName);
  },
  retry() {
    ipcRenderer.send("retry");
  },
  /** Abre a pasta de sons do mestre no explorador de arquivos (E25). */
  openSoundsFolder() {
    ipcRenderer.send("open-sounds-folder");
  },
});
