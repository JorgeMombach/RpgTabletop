import { randomUUID } from "node:crypto";
import { LIMITS } from "@rpg/shared";
import { currentGroup } from "../combat";
import type { Combatant } from "@rpg/shared";
import type { Store } from "../store";
import { fail, requireInt, requireString } from "../validate";
import { editable } from "./combatants";
import { logSystem } from "./dice";
import { endConcentration, isConcentration, tickCasterEffects } from "./effects";
import { rechargeOnTurn } from "./sheet";
import type { HandlerMap } from "./types";

/**
 * Início do turno de quem está na vez: desconta 1 round das condições com duração.
 * As que chegam a 0 saem e viram aviso no log. Sem duração = não muda (SPEC §14).
 * Também contam os efeitos no mapa que ele conjurou (E19).
 */
export function startTurn(store: Store) {
  // Grupo de mobs iguais: o começo da vez roda para cada um.
  for (const c of currentGroup(store)) startTurnOf(store, c);
}

function startTurnOf(store: Store, c: Combatant) {
  const { combat } = store.game.battle;
  // Voltou a vez de quem atrasou: o começo do turno dele já rodou neste round.
  const delayed = combat.delayed;
  if (delayed && delayed.round === combat.round && delayed.ids.includes(c.id)) {
    delayed.ids = delayed.ids.filter((id) => id !== c.id);
    if (delayed.ids.length === 0) delete combat.delayed;
    return;
  }
  delete c.turnUsed;
  rechargeOnTurn(store, c);
  tickCasterEffects(store, c.id);
  if (c.conditions.length === 0) return;
  const expired: string[] = [];
  c.conditions = c.conditions.filter((k) => {
    if (k.rounds === null) return true;
    k.rounds--;
    if (k.rounds > 0) return true;
    expired.push(k.name);
    return false;
  });
  for (const name of expired) logSystem(store, "{condition} acabou em {name}.", { condition: name, name: c.name });
  if (expired.some(isConcentration)) endConcentration(store, c.id);
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
    if (c.conditions.length >= LIMITS.conditions) fail("Limite de {n} condições por combatente.", { n: LIMITS.conditions });
    const condition = { id: randomUUID(), name, rounds };
    c.conditions.push(condition);
    return [condition.id];
  },

  "condition:remove": (store, player, payload) => {
    const c = editable(store, player, payload?.id);
    const id = requireString(payload.conditionId, "Condição");
    if (!c.conditions.some((k) => k.id === id)) fail("Condição não encontrada.");
    const removed = c.conditions.find((k) => k.id === id)!;
    c.conditions = c.conditions.filter((k) => k.id !== id);
    // Perdeu a concentração: os efeitos de concentração dele somem junto (E19).
    if (isConcentration(removed.name)) endConcentration(store, c.id);
  },
};
