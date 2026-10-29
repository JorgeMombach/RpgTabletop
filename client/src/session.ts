import { socket } from "./socket";
import { logText } from "./i18n";
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

socket.on("state:full", (state) => {
  const previous = useApp.getState().state;
  useApp.setState({ state, joinError: null });
  // Avisos da mesa (ex.: condição que acabou) viram toast, mas só os novos: ao entrar, o log antigo não se repete.
  // Na janela do log, não: a janela principal já avisa.
  if (!previous || IS_LOG_WINDOW) return;
  const seen = new Set(previous.log.map((e) => e.id));
  for (const e of state.log) if (e.system && !seen.has(e.id)) toast({ kind: "info", text: logText(e) });
});

socket.on("toast", (t) => toast(t));

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

socket.on("ping", ({ playerId, name, at }) => {
  const id = ++pingSeq;
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
