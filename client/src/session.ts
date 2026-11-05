import { shareEqual } from "@rpg/shared";
import { socket } from "./socket";
import { act } from "./actions";
import { rollerName } from "./format";
import { logText, t } from "./i18n";
import { pushHits } from "./map/hits";
import { toast } from "./notify";
import { IS_LOG_WINDOW } from "./logWindow";
import { PING_MS, useApp } from "./store";

const TOKEN_KEY = "rpg.sessionToken";
const NAME_KEY = "rpg.name";
const GM_KEY = "rpg.gmKey";

function read(key: string): string | null {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

function write(key: string, value: string) {
  try {
    localStorage.setItem(key, value);
  } catch {
    // Sem storage só perdemos a reconexão automática.
  }
}

/**
 * Link de mestre (`/?gm=<chave>`, ADR-12): guarda a chave para reconectar
 * e tira da barra de endereço para não ir junto num print ou link copiado.
 */
function captureGmKey() {
  const params = new URLSearchParams(location.search);
  const key = params.get("gm");
  if (!key) return;
  write(GM_KEY, key);
  params.delete("gm");
  const query = params.toString();
  history.replaceState(null, "", location.pathname + (query ? `?${query}` : "") + location.hash);
}

captureGmKey();

function gmKey(): string | undefined {
  return read(GM_KEY) ?? undefined;
}

/** Token desta pessoa na sessão: também libera os arquivos da pasta de sons (E25). */
export function sessionToken(): string {
  return read(TOKEN_KEY) ?? "";
}

export function savedName(): string {
  return read(NAME_KEY) ?? useApp.getState().lastName;
}

/**
 * Sai da sessão para trocar de nome (ou deixar a mesa). Esquece o nome salvo, para o
 * navegador não entrar sozinho de novo, mas mantém o token: voltando, a pessoa
 * reencontra o mesmo personagem.
 */
export function leave() {
  const lastName = useApp.getState().state?.self.name ?? "";
  socket.emit("session:leave");
  try {
    localStorage.removeItem(NAME_KEY);
  } catch {
    // ignora
  }
  useApp.setState({ state: null, selectedId: null, joinError: null, lastName, rulers: {}, areas: {} });
}

export async function join(name: string) {
  useApp.setState({ joining: true, joinError: null });
  try {
    const res = await socket
      .timeout(5000)
      .emitWithAck("session:join", { name, sessionToken: read(TOKEN_KEY) ?? undefined, gmKey: gmKey() });
    if (res.ok) {
      write(TOKEN_KEY, res.sessionToken);
      write(NAME_KEY, res.self.name);
    } else {
      useApp.setState({ joinError: res.error });
    }
  } catch {
    // Timeout: o socket vai reconectar e tentar de novo.
  } finally {
    useApp.setState({ joining: false });
  }
}

socket.on("connect", async () => {
  useApp.setState({ connected: true });
  const { role } = await socket.emitWithAck("session:probe", { gmKey: gmKey() });
  useApp.setState({ probedRole: role });

  // Recarregou a página ou a conexão caiu: volta com a mesma identidade.
  const name = useApp.getState().state?.self.name ?? read(NAME_KEY);
  if (name) void join(name);
});

socket.on("disconnect", () => {
  useApp.setState({ connected: false });
});

/** Último pedido de reenvio da imagem do mapa: um por versão, e no máximo a cada 3 s. */
let imageAsked = { version: -1, at: 0 };

/**
 * A imagem do mapa vai à parte (`map:image`) e só quando muda. Se a deste cliente ficou para trás (evento
 * perdido numa troca de cena, conexão que caiu no meio), o estado denuncia pela versão: pede de novo.
 */
export function askMapImage(version: number) {
  const now = Date.now();
  if (imageAsked.version === version && now - imageAsked.at < 3000) return;
  imageAsked = { version, at: now };
  socket.emit("map:imageRequest");
}

/** Aviso do log quando um jogador substitui a ficha pelo arquivo (modelo do servidor, `sheetFiles.ts`). */
const SHEET_REPLACED = "{who} substituiu {name} pela ficha do arquivo.";

socket.on("state:full", (incoming) => {
  const previous = useApp.getState().state;
  // O que não mudou continua o mesmo objeto: a interface só redesenha o que mudou de verdade.
  const state = previous ? shareEqual(previous, incoming) : incoming;
  useApp.setState({ state, joinError: null });
  const { map } = state.battle;
  if (map.hasImage && useApp.getState().mapImage.version !== map.imageVersion) askMapImage(map.imageVersion);
  // Avisos da mesa (ex.: condição que acabou) viram toast, mas só os novos: ao entrar, o log antigo não se repete.
  // Na janela do log, não: a janela principal já avisa.
  if (!previous || IS_LOG_WINDOW) return;
  const seen = new Set(previous.log.map((e) => e.id));
  const gm = state.self.role === "gm";
  for (const e of state.log) {
    if (seen.has(e.id)) continue;
    // Sussurro que chegou (Passo 6): avisa, o log pode estar fechado.
    if (e.whisper && e.authorId !== state.self.id) {
      toast({ kind: "info", text: t("chat.whisperToast", { name: rollerName(e), text: e.text }) }, 10_000);
      continue;
    }
    if (!e.system) continue;
    // Jogador substituiu a ficha pelo arquivo (Fase 4): o mestre pode voltar a anterior.
    const id = e.textParams?.id;
    if (gm && e.textKey === SHEET_REPLACED && typeof id === "string") {
      toast({ kind: "info", text: logText(e), action: { label: t("common.undo"), run: () => void act("sheet:undo", { id }) } }, 20_000);
    } else toast({ kind: "info", text: logText(e) });
  }
});

socket.on("toast", (t) => toast(t));

// Ver como jogador (Passo 11): o estado que ele recebe, mantendo os objetos que não mudaram (como o state:full).
socket.on("view:preview", (incoming) => {
  useApp.setState((s) => {
    if (!incoming || !s.viewAsId) return { preview: null, viewAsId: null };
    return { preview: s.preview ? shareEqual(s.preview, incoming) : incoming };
  });
});
// Reconectou: o servidor esqueceu o pedido (conexão nova). Volta à visão do mestre.
socket.on("connect", () => useApp.setState({ preview: null, viewAsId: null }));

// Golpes e curas (L6): viram o número que sobe do token (com "Reduzir efeitos", nada).
socket.on("fx:hp", (hits) => {
  if (!useApp.getState().reduceFx) pushHits(hits);
});

socket.on("map:image", (payload) => {
  useApp.setState({ mapImage: payload });
});

socket.on("ruler", ({ playerId, name, ruler }) => {
  useApp.setState((s) => {
    const rulers = { ...s.rulers };
    if (ruler) rulers[playerId] = { name, ruler };
    else delete rulers[playerId];
    return { rulers };
  });
});

let pingSeq = 0;
// O que o mestre mostra para a mesa: abre de novo para todos quando é algo novo.
socket.on("handout", (handout) => useApp.setState({ handout }));

socket.on("ping", ({ playerId, name, at, look }) => {
  const id = ++pingSeq;
  // "Olhem aqui" do mestre: o mapa de cada um desliza até o ping (o do mestre já está lá).
  if (look && playerId !== useApp.getState().state?.self.id) useApp.setState({ lookAt: { at, seq: id } });
  useApp.setState((s) => ({ pings: [...s.pings, { id, playerId, name, at }].slice(-12) }));
  setTimeout(() => useApp.setState((s) => ({ pings: s.pings.filter((p) => p.id !== id) })), PING_MS);
});

socket.on("area", ({ playerId, name, area }) => {
  useApp.setState((s) => {
    const areas = { ...s.areas };
    if (area) areas[playerId] = { name, area };
    else delete areas[playerId];
    return { areas };
  });
});
