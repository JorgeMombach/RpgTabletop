import { RULE_KEYS, type TableRules } from "@rpg/shared";
import { isPlayersTurn } from "../combat";
import type { ServerPlayer, Store } from "../store";
import { fail } from "../validate";
import { requireGm } from "./combatants";
import { logSystem } from "./dice";
import type { HandlerMap } from "./types";

const RULE_LABEL: Record<keyof TableRules, string> = {
  moveOnTurn: "Movimento só na sua vez",
  summonOnTurn: "Invocar só na sua vez",
  darkReminder: "Lembrete de escuridão",
};

/**
 * Trava de uma regra da mesa: em combate, com a regra ligada, o jogador só faz isso na sua vez.
 * Fora de combate e para o mestre, sempre pode.
 */
export function requireTurnFor(store: Store, player: ServerPlayer, rule: keyof TableRules, message: string) {
  if (player.role === "gm" || !store.game.rules[rule] || !store.game.battle.combat.active) return;
  if (!isPlayersTurn(store, player.id)) fail(message);
}

/** Regras da mesa: o mestre liga e desliga; o log avisa a mesa. */
export const ruleHandlers: HandlerMap = {
  "rules:set": (store, player, payload) => {
    requireGm(player);
    const changes: [keyof TableRules, boolean][] = [];
    for (const [key, value] of Object.entries(payload ?? {})) {
      if (!(RULE_KEYS as readonly string[]).includes(key)) fail("Regra desconhecida.");
      if (typeof value !== "boolean") fail("Valor inválido para a regra.");
      changes.push([key as keyof TableRules, value]);
    }
    for (const [key, value] of changes) {
      if (store.game.rules[key] === value) continue;
      store.game.rules[key] = value;
      logSystem(store, `Regra da mesa ${value ? "ligada" : "desligada"}: ${RULE_LABEL[key]}.`);
    }
  },
};
