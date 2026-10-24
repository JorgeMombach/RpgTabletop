import type { Combatant } from "@rpg/shared";
import type { Store } from "./store";

export function allCombatants(store: Store): Combatant[] {
  const { allies, battle } = store.game;
  return [...allies, ...battle.mobs, ...battle.npcs];
}

export function byId(store: Store, id: string): Combatant | undefined {
  return allCombatants(store).find((c) => c.id === id);
}

/** Ordem de iniciativa: total maior primeiro; empate → maior mod. DES (SPEC F5). */
export function compareInitiative(a: Combatant, b: Combatant): number {
  return (b.initiative ?? -Infinity) - (a.initiative ?? -Infinity) || b.dexMod - a.dexMod;
}

/**
 * Executa uma mudança na ordem preservando quem está na vez:
 * o índice do turno passa a apontar para o mesmo combatente de antes.
 */
function keepingTurn(store: Store, change: () => void) {
  const combat = store.game.battle.combat;
  const currentId = combat.active ? combat.order[combat.turnIndex] : undefined;
  change();
  if (currentId === undefined) return;
  const idx = combat.order.indexOf(currentId);
  if (idx >= 0) combat.turnIndex = idx;
}

/**
 * (Re)coloca o combatente na posição certa da ordem. Empate total mantém quem já estava
 * antes (o mestre pode reordenar à mão). Quem entra no meio do combate não muda a vez.
 */
export function placeInOrder(store: Store, c: Combatant) {
  if (c.initiative === null) return removeFromOrder(store, c.id);
  const { order } = store.game.battle.combat;
  keepingTurn(store, () => {
    const at = order.indexOf(c.id);
    if (at >= 0) order.splice(at, 1);
    const others = order.map((id) => byId(store, id));
    const idx = others.findIndex((o) => !o || compareInitiative(c, o) < 0);
    order.splice(idx < 0 ? order.length : idx, 0, c.id);
  });
}

/** Tira o combatente da ordem. Se era a vez dele, a vez passa para o próximo. */
export function removeFromOrder(store: Store, id: string): number | null {
  const combat = store.game.battle.combat;
  const idx = combat.order.indexOf(id);
  if (idx < 0) return null;
  combat.order.splice(idx, 1);
  if (idx < combat.turnIndex) combat.turnIndex--;
  if (combat.turnIndex >= combat.order.length) combat.turnIndex = 0;
  return idx;
}

export function moveInOrder(store: Store, id: string, toIndex: number) {
  const { order } = store.game.battle.combat;
  keepingTurn(store, () => {
    const from = order.indexOf(id);
    if (from < 0) return;
    order.splice(from, 1);
    order.splice(Math.max(0, Math.min(order.length, toIndex)), 0, id);
  });
}
