import { LIMITS, type Combatant, type RollResult } from "@rpg/shared";
import { moveInOrder, placeInOrder, removeFromOrder } from "../combat";
import { roll } from "../dice";
import type { Store } from "../store";
import { fail, requireInt } from "../validate";
import { editable, requireGm } from "./combatants";
import { logRoll } from "./dice";
import type { HandlerMap } from "./types";

/** Iniciativa = d20 + mod. DES (SPEC F5). */
function rollInitiative(dexMod: number): RollResult {
  return roll(dexMod === 0 ? "1d20" : `1d20${dexMod > 0 ? "+" : ""}${dexMod}`);
}

function applyRoll(store: Store, c: Combatant, result: RollResult) {
  const d20 = result.terms[0];
  c.initRoll = d20.kind === "dice" ? d20.rolls[0] : null;
  c.initiative = result.total;
  placeInOrder(store, c);
}

function requireActive(store: Store) {
  if (!store.game.battle.combat.active) fail("O combate não começou.");
}

export const initiativeHandlers: HandlerMap = {
  "init:roll": (store, player, payload) => {
    const c = editable(store, player, payload?.id);
    const result = rollInitiative(c.dexMod);
    applyRoll(store, c, result);
    // Iniciativa de mob fica só para o mestre no log; a de aliado, para todos.
    logRoll(store, player, result, { label: `Iniciativa · ${c.name}`, hidden: c.type === "mob" });
  },

  "init:rollMobs": (store, player, payload) => {
    requireGm(player);
    const { mobs } = store.game.battle;
    if (mobs.length === 0) fail("Não há mobs na batalha.");
    // Iniciativa em grupo: todos os mobs do mesmo template agem juntos.
    const byTemplate = new Map<string, RollResult>();
    for (const mob of mobs) {
      const key = payload?.grouped && mob.templateId ? `${mob.templateId}:${mob.dexMod}` : null;
      let result = key ? byTemplate.get(key) : undefined;
      if (!result) {
        result = rollInitiative(mob.dexMod);
        if (key) byTemplate.set(key, result);
      }
      applyRoll(store, mob, result);
    }
  },

  "init:set": (store, player, payload) => {
    const c = editable(store, player, payload?.id);
    if (payload.value === null) {
      c.initiative = c.initRoll = null;
      removeFromOrder(store, c.id);
      return;
    }
    c.initiative = requireInt(payload.value, "Iniciativa", LIMITS.initiative.min, LIMITS.initiative.max);
    c.initRoll = null;
    placeInOrder(store, c);
  },

  "init:move": (store, player, payload) => {
    requireGm(player);
    if (!store.game.battle.combat.order.includes(payload?.id)) fail("Combatente fora da ordem de iniciativa.");
    moveInOrder(store, payload.id, requireInt(payload.toIndex, "Posição", 0, 10_000));
  },

  "combat:start": (store, player) => {
    requireGm(player);
    const combat = store.game.battle.combat;
    if (combat.order.length === 0) fail("Role a iniciativa antes de iniciar o combate.");
    Object.assign(combat, { active: true, round: 1, turnIndex: 0 });
  },

  "combat:next": (store, player) => {
    requireGm(player);
    requireActive(store);
    const combat = store.game.battle.combat;
    combat.turnIndex++;
    if (combat.turnIndex >= combat.order.length) {
      combat.turnIndex = 0;
      combat.round++;
    }
  },

  "combat:prev": (store, player) => {
    requireGm(player);
    requireActive(store);
    const combat = store.game.battle.combat;
    if (combat.turnIndex > 0) combat.turnIndex--;
    else if (combat.round > 1) {
      combat.round--;
      combat.turnIndex = Math.max(0, combat.order.length - 1);
    }
  },

  "combat:end": (store, player) => {
    requireGm(player);
    Object.assign(store.game.battle.combat, { active: false, round: 0, turnIndex: 0, order: [] });
    for (const c of [...store.game.allies, ...store.game.battle.mobs]) c.initiative = c.initRoll = null;
  },
};
