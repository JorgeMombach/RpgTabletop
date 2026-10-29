import { toast } from "./notify";
import { setDicePrefs, useApp } from "./store";
import { t } from "./i18n";

/**
 * Log de rolagens fora da mesa (para arrastar a outro monitor): é o próprio app aberto com `?janela=log`.
 * Ele entra sozinho com o mesmo nome e token (o servidor aceita várias conexões da mesma pessoa) e mostra
 * só o log, sem som nem avisos. Enquanto ele está fora, a mesa não mostra o log (um lugar só, sem duplicar).
 * As duas janelas conversam por um BroadcastChannel: a de fora avisa quando fecha ou pede para voltar.
 */
export const IS_LOG_WINDOW = new URLSearchParams(location.search).get("janela") === "log";

const NAME = "jamals-tabletop-log";
type Message = "ping" | "here" | "closed" | "return";
const channel = typeof BroadcastChannel === "function" ? new BroadcastChannel(NAME) : null;
const post = (m: Message) => channel?.postMessage(m);
let child: Window | null = null;

/**
 * Tablet e celular (toque, sem mouse): janela nova vira outra aba, que esconde a mesa. Lá o log só flutua
 * dentro da mesa.
 */
export const CAN_POP_OUT = !(typeof matchMedia === "function" && matchMedia("(hover: none) and (pointer: coarse)").matches);
/** A janela de fora respondeu desde a última conferência (a mesa confere a cada 3 s). */
let answered = true;

/**
 * Leva o log para uma janela própria (`at` = onde ela aparece, em pixels da tela, e o tamanho; sem `at`,
 * encostada na direita da mesa). Precisa de um clique ou arrasto recente (o navegador bloqueia janelas
 * abertas sozinhas): se bloquear, o log abre flutuando dentro da mesa (arrastar para fora tenta de novo).
 */
export function popOutLog(at?: { x: number; y: number; w: number; h: number }) {
  if (!CAN_POP_OUT) {
    setDicePrefs({ logDetached: true });
    return;
  }
  const url = `${location.origin}${location.pathname}?janela=log`;
  const w = at?.w ?? 420;
  const h = at?.h ?? Math.min(720, window.outerHeight);
  const x = at?.x ?? window.screenX + window.outerWidth - w - 24;
  const y = at?.y ?? window.screenY + 80;
  child = window.open(url, NAME, `popup,width=${Math.round(w)},height=${Math.round(h)},left=${Math.round(x)},top=${Math.round(y)}`);
  if (!child) {
    setDicePrefs({ logDetached: true });
    toast({ kind: "info", text: t("logWindow.blocked") });
    return;
  }
  child.focus();
  // Dá tempo de a janela nova carregar antes da primeira conferência.
  answered = true;
  useApp.setState({ logOut: true });
}

/** Traz o log de volta para o painel Dados e fecha a janela de fora. */
export function bringLogBack() {
  post("return");
  child?.close();
  child = null;
  useApp.setState({ logOut: false });
  setDicePrefs({ logDetached: false });
}

if (channel && IS_LOG_WINDOW) {
  // Janela de fora: responde à mesa, fecha quando ela pede e avisa quando fecha.
  channel.onmessage = (e: MessageEvent<Message>) => {
    if (e.data === "ping") post("here");
    if (e.data === "return") window.close();
  };
  post("here");
  window.addEventListener("pagehide", () => post("closed"));
} else if (channel) {
  const back = () => {
    child = null;
    useApp.setState({ logOut: false });
    setDicePrefs({ logDetached: false });
  };
  // Mesa: se a janela de fora fechar (ou pedir para voltar), o log volta a aparecer aqui.
  channel.onmessage = (e: MessageEvent<Message>) => {
    if (e.data === "here") {
      answered = true;
      useApp.setState({ logOut: true });
    }
    if (e.data === "closed" || e.data === "return") back();
  };
  // Recarregou a mesa com o log lá fora: ele responde e a mesa continua sem o log.
  post("ping");
  // A janela de fora pode sumir sem avisar (fechada à força, travou): sem resposta, o log volta para a mesa.
  window.setInterval(() => {
    if (!useApp.getState().logOut) return;
    if (!answered) return back();
    answered = false;
    post("ping");
  }, 3000);
}

/** Pedido da janela de fora para voltar para a mesa (botão no cabeçalho dela). */
export function returnToTable() {
  post("return");
  window.close();
}
