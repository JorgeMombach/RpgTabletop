import { randomUUID } from "node:crypto";
import { LIMITS } from "@rpg/shared";
import { byId } from "../combat";
import type { Store } from "../store";
import { fail, requireInt, requireString } from "../validate";
import { editable } from "./combatants";
import { logSystem } from "./dice";
import type { HandlerMap } from "./types";

/**
 * Início do turno de quem está na vez: desconta 1 round das condições com duração.
 * As que chegam a 0 saem e viram aviso no log. Sem duração = não muda (SPEC §14).
 */
export function startTurn(store: Store) {
  const { combat } = store.game.battle;
  if (!combat.active) return;
  const c = byId(store, combat.order[combat.turnIndex]);
  if (!c || c.conditions.length === 0) return;
  const expired: string[] = [];
  c.conditions = c.conditions.filter((k) => {
    if (k.rounds === null) return true;
    k.rounds--;
    if (k.rounds > 0) return true;
    expired.push(k.name);
    return false;
  });
  for (const name of expired) logSystem(store, `${name} acabou em ${c.name}.`);
}

export const conditionHandlers: HandlerMap = {
  // Mestre em qualquer combatente; jogador só nos próprios aliados.
  "condition:add": (store, player, payload) => {
    const c = editable(store, player, payload?.id);
    const name = typeof payload.name === "string" ? payload.name.replace(/\s+/g, " ").trim().slice(0, LIMITS.conditionName) : "";
    if (!name) fail("Informe a condição.");
    const { min, max } = LIMITS.conditionRounds;
    const rounds = payload.rounds === undefined || payload.rounds === null ? null : requireInt(payload.rounds, "Duração", min, max);

    // Mesma condição de novo só atualiza a duração (ex.: reaplicar Atordoado).
    const same = c.conditions.find((k) => k.name.toLocaleLowerCase("pt-BR") === name.toLocaleLowerCase("pt-BR"));
    if (same) {
      same.rounds = rounds;
      return [same.id];
    }
    if (c.conditions.length >= LIMITS.conditions) fail(`Limite de ${LIMITS.conditions} condições por combatente.`);
    const condition = { id: randomUUID(), name, rounds };
    c.conditions.push(condition);
    return [condition.id];
  },

  "condition:remove": (store, player, payload) => {
    const c = editable(store, player, payload?.id);
    const id = requireString(payload.conditionId, "Condição");
    if (!c.conditions.some((k) => k.id === id)) fail("Condição não encontrada.");
    c.conditions = c.conditions.filter((k) => k.id !== id);
  },
};
