import { LIMITS, TURN_ACTIONS, groupName, type Combatant, type RollResult, type TurnAction } from "@rpg/shared";
import { allCombatants, byId, currentGroup, groupAt, moveInOrder, newTurn, placeInOrder, removeFromOrder, resetCombat } from "../combat";
import { roll } from "../dice";
import type { ServerPlayer, Store } from "../store";
import { fail, requireInt } from "../validate";
import { editable, requireGm } from "./combatants";
import { startTurn } from "./conditions";
import { tickRoundEffects } from "./effects";
import { logRoll, logSystem, whoIs } from "./dice";
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

/** Na rolagem automática do mestre (E21): mob no mapa e visível. NPCs o mestre rola um a um, quando entram na luta. */
function inField(c: Combatant): boolean {
  return c.pos !== null && !c.hidden;
}

/** Rola para `list` (mobs em campo e, no "de novo", NPCs que já lutavam). `grouped` = uma rolagem por template. */
function rollGmSide(store: Store, list: Combatant[], grouped: boolean) {
  const byTemplate = new Map<string, RollResult>();
  for (const mob of list) {
    // Iniciativa em grupo: todos os mobs do mesmo template agem juntos.
    const key = grouped && mob.templateId ? `${mob.type}:${mob.templateId}:${mob.dexMod}` : null;
    let result = key ? byTemplate.get(key) : undefined;
    if (!result) {
      result = rollInitiative(mob.dexMod);
      if (key) byTemplate.set(key, result);
    }
    applyRoll(store, mob, result);
  }
}

/**
 * Iniciativa se rola uma vez: o jogador rola (ou digita) a do próprio personagem e dos invocados dele
 * só enquanto não tem valor. Depois, mudar ou rolar de novo é com o mestre (ou *Iniciativa de novo*, que zera todas).
 */
function onceForPlayers(player: ServerPlayer, c: Combatant): Combatant {
  if (player.role !== "gm" && c.initiative !== null) fail(`A iniciativa de ${c.name} já foi rolada. Só o mestre muda.`);
  return c;
}

/** Oculto fica fora da iniciativa até o mestre revelar (E21). */
function notHidden(c: Combatant): Combatant {
  if (c.hidden) fail(`${c.name} está oculto: revele antes de pôr na iniciativa.`);
  return c;
}

function requireActive(store: Store) {
  if (!store.game.battle.combat.active) fail("O combate não começou.");
}

/** Avança para o próximo da ordem (round novo no fim da lista) e começa a vez dele. Grupo de mobs iguais passa inteiro. */
function advance(store: Store) {
  const combat = store.game.battle.combat;
  combat.turnIndex = groupAt(store, combat.turnIndex)[1];
  if (combat.turnIndex >= combat.order.length) {
    combat.turnIndex = 0;
    combat.round++;
    delete combat.delayed;
    tickRoundEffects(store);
  }
  newTurn(store);
  startTurn(store);
}

/** Combatente da vez, se quem pede pode agir por ele: o mestre ou o dono (personagem ou conjurado). */
function currentOf(store: Store, player: ServerPlayer): Combatant {
  const { combat } = store.game.battle;
  const c = byId(store, combat.order[combat.turnIndex]) ?? fail("Ninguém está na vez.");
  if (player.role !== "gm" && !(c.type === "ally" && c.ownerId === player.id)) fail("Não é a sua vez.");
  return c;
}

export const initiativeHandlers: HandlerMap = {
  "init:roll": (store, player, payload) => {
    const c = onceForPlayers(player, notHidden(editable(store, player, payload?.id)));
    const result = rollInitiative(c.dexMod);
    applyRoll(store, c, result);
    // Iniciativa de mob e NPC fica só para o mestre no log; a de aliado, para todos.
    logRoll(store, player, result, { label: "Iniciativa", as: c.name, hidden: c.type !== "ally", color: c.color });
  },

  "init:rollMobs": (store, player, payload) => {
    requireGm(player);
    const mobs = store.game.battle.mobs.filter(inField);
    if (mobs.length === 0) fail("Nenhum mob visível no mapa. Coloque os tokens no mapa (ou revele os ocultos) antes de rolar.");
    rollGmSide(store, mobs, payload?.grouped === true);
  },

  "init:rerollAll": (store, player, payload) => {
    requireGm(player);
    const { battle } = store.game;
    // NPCs que já estavam na luta rolam de novo junto com os mobs em campo.
    const npcs = battle.npcs.filter((n) => n.initiative !== null && !n.hidden);
    for (const c of allCombatants(store)) c.initiative = c.initRoll = null;
    // Pausa no mesmo round: os jogadores rolam de novo e o mestre retoma com "Iniciar combate".
    Object.assign(battle.combat, { active: false, turnIndex: 0, order: [] });
    battle.rolls.request = null;
    rollGmSide(store, [...battle.mobs.filter(inField), ...npcs], payload?.grouped === true);
  },

  "init:set": (store, player, payload) => {
    const c = onceForPlayers(player, notHidden(editable(store, player, payload?.id)));
    if (payload.value === null) {
      c.initiative = c.initRoll = null;
      removeFromOrder(store, c.id);
      return;
    }
    c.initiative = requireInt(payload.value, "Iniciativa", LIMITS.initiative.min, LIMITS.initiative.max);
    c.initRoll = null;
    placeInOrder(store, c);
  },

  "combatant:setHidden": (store, player, payload) => {
    requireGm(player);
    const c = editable(store, player, payload?.id);
    if (c.type === "ally") fail("Só mobs e NPCs podem ficar ocultos.");
    if (typeof payload.hidden !== "boolean") fail("Valor inválido.");
    if (payload.hidden) {
      c.hidden = true;
      // Some da iniciativa (e da vez, se fosse a dele) até ser revelado.
      c.initiative = c.initRoll = null;
      removeFromOrder(store, c.id);
      return;
    }
    if (!c.hidden) return;
    delete c.hidden;
    // Revelado com a iniciativa em andamento: rola e entra na ordem (sem mudar a vez de ninguém).
    const { combat } = store.game.battle;
    if (combat.active || combat.order.length > 0) {
      const result = rollInitiative(c.dexMod);
      applyRoll(store, c, result);
      logRoll(store, player, result, { label: "Iniciativa (revelado)", as: c.name, hidden: true, color: c.color });
    }
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
    // Depois de "rolar iniciativa de novo" o combate retoma no mesmo round.
    Object.assign(combat, { active: true, round: Math.max(1, combat.round), turnIndex: 0 });
    newTurn(store);
    startTurn(store);
  },

  "combat:next": (store, player) => {
    requireGm(player);
    requireActive(store);
    advance(store);
  },

  "combat:pass": (store, player) => {
    requireActive(store);
    currentOf(store, player);
    if (player.role !== "gm") logSystem(store, `${whoIs(store, player)} passou a vez.`);
    advance(store);
  },

  "combat:delay": (store, player, payload) => {
    requireActive(store);
    const c = currentOf(store, player);
    const { combat } = store.game.battle;
    // Grupo de mobs iguais atrasa junto.
    const [from, end] = groupAt(store, combat.turnIndex);
    const to = combat.order.indexOf(payload?.afterId);
    if (to < end) fail("Escolha alguém que ainda vai agir neste round.");
    const after = byId(store, payload.afterId);
    const group = currentGroup(store);
    // Muda de lugar na ordem; a vez passa para quem vinha logo depois.
    const moved = combat.order.splice(from, end - from);
    combat.order.splice(to - moved.length + 1, 0, ...moved);
    // A iniciativa acompanha o novo lugar (empata com quem ele esperou).
    for (const g of group) if (after?.initiative !== null && after?.initiative !== undefined) g.initiative = after.initiative;
    combat.delayed = { ids: moved, round: combat.round };
    logSystem(store, `${group.length > 1 ? groupName(group.map((g) => g.name)) : c.name} vai agir depois de ${after?.name ?? "?"}.`);
    newTurn(store);
    startTurn(store);
  },

  "turn:use": (store, player, payload) => {
    const c = editable(store, player, payload?.id);
    const what = TURN_ACTIONS.includes(payload?.what as TurnAction) ? (payload.what as TurnAction) : fail("Ação desconhecida.");
    if (typeof payload.used !== "boolean") fail("Valor inválido.");
    const used = new Set(c.turnUsed ?? []);
    if (payload.used) used.add(what);
    else used.delete(what);
    if (used.size > 0) c.turnUsed = TURN_ACTIONS.filter((a) => used.has(a));
    else delete c.turnUsed;
  },

  "combat:prev": (store, player) => {
    // Voltar não devolve rounds de condição: a contagem só anda para frente.
    requireGm(player);
    requireActive(store);
    const combat = store.game.battle.combat;
    const start = groupAt(store, combat.turnIndex)[0];
    if (start > 0) combat.turnIndex = groupAt(store, start - 1)[0];
    else if (combat.round > 1) {
      combat.round--;
      combat.turnIndex = groupAt(store, Math.max(0, combat.order.length - 1))[0];
    } else combat.turnIndex = start;
    newTurn(store);
  },

  "combat:end": (store, player) => {
    requireGm(player);
    resetCombat(store);
    for (const c of allCombatants(store)) c.initiative = c.initRoll = null;
  },
};
