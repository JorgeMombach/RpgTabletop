import { socket } from "./socket";
import { toast, useApp } from "./store";

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
  useApp.setState({ state: null, selectedId: null, joinError: null, lastName, rulers: {} });
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
  useApp.setState({ state, joinError: null });
});

socket.on("toast", (t) => toast(t));

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
