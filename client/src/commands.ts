import type { Combatant } from "@rpg/shared";
import { act } from "./actions";
import { select, toast, useApp } from "./store";

/** Remove um mob e oferece "Desfazer" (o servidor guarda por 60 s). */
export async function removeMob(m: Combatant) {
  const res = await act("mob:remove", { id: m.id });
  if (!res.ok) return;
  if (useApp.getState().selectedId === m.id) select(null);
  toast({
    kind: "info",
    text: `${m.name} removido.`,
    action: { label: "Desfazer", run: () => void act("mob:restore", { id: m.id }) },
  });
}
