import { JoinScreen } from "./components/JoinScreen";
import { LogWindow } from "./components/LogWindow";
import { IS_LOG_WINDOW } from "./logWindow";
import { Shell } from "./components/Shell";
import { useApp } from "./store";
import { useEffect } from "react";

export function App() {
  const state = useApp((s) => s.state);
  // "Reduzir efeitos" também para as microanimações da interface (L7): classe na raiz, desliga no CSS.
  const reduceFx = useApp((s) => s.reduceFx);
  useEffect(() => {
    document.documentElement.classList.toggle("reduce-fx", reduceFx);
  }, [reduceFx]);
  // Janela do log (outro monitor): nem tela de entrada, nem mesa; só o log.
  if (IS_LOG_WINDOW) return <LogWindow />;
  return state ? <Shell state={state} /> : <JoinScreen />;
}
