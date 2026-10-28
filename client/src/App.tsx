import { JoinScreen } from "./components/JoinScreen";
import { LogWindow } from "./components/LogWindow";
import { IS_LOG_WINDOW } from "./logWindow";
import { Shell } from "./components/Shell";
import { useApp } from "./store";

export function App() {
  const state = useApp((s) => s.state);
  // Janela do log (outro monitor): nem tela de entrada, nem mesa; só o log.
  if (IS_LOG_WINDOW) return <LogWindow />;
  return state ? <Shell state={state} /> : <JoinScreen />;
}
