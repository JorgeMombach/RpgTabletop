import type { Combatant } from "@rpg/shared";
import { act } from "./actions";
import { confirmAction } from "./confirm";
import { t } from "./i18n";
import { toast } from "./notify";
import { select, useApp } from "./store";

/** Remove um mob e oferece "Desfazer" (o servidor guarda por 60 s). */
export async function removeMob(m: Pick<Combatant, "id" | "name">) {
  const res = await act("mob:remove", { id: m.id });
  if (!res.ok) return;
  if (useApp.getState().selectedId === m.id) select(null);
  toast({
    kind: "info",
    text: t("mobs.removed", { name: m.name }),
    action: { label: t("common.undo"), run: () => void act("mob:restore", { id: m.id }) },
  });
}

/** Remove do jogo: mob ou NPC na hora (com "Desfazer"); aliado só depois de confirmar. */
export async function removeCombatant(c: Pick<Combatant, "id" | "name" | "type">) {
  if (c.type !== "ally") return void removeMob(c);
  const ok = await confirmAction({ title: t("selected.removeTitle", { name: c.name }), message: t("selected.removeMessage"), confirmLabel: t("common.remove"), danger: true });
  if (ok) void act("ally:remove", { id: c.id }).then((r) => r.ok && select(null));
}
