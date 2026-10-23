import { JoinScreen } from "./components/JoinScreen";
import { Shell } from "./components/Shell";
import { useApp } from "./store";

export function App() {
  const state = useApp((s) => s.state);
  return state ? <Shell state={state} /> : <JoinScreen />;
}
