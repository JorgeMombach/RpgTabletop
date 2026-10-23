import { socket } from "./socket";
import { toast, useApp } from "./store";

const TOKEN_KEY = "rpg.sessionToken";
const NAME_KEY = "rpg.name";

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

export function savedName(): string {
  return read(NAME_KEY) ?? "";
}

export async function join(name: string) {
  useApp.setState({ joining: true, joinError: null });
  try {
    const res = await socket
      .timeout(5000)
      .emitWithAck("session:join", { name, sessionToken: read(TOKEN_KEY) ?? undefined });
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
  const { role } = await socket.emitWithAck("session:probe");
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
