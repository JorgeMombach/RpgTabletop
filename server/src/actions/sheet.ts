import { randomUUID } from "node:crypto";
import { COINS, LIMITS, type Coins, type Combatant, type Recharge } from "@rpg/shared";
import { roll } from "../dice";
import type { ServerPlayer, Store } from "../store";
import { fail, requireInt, requireString } from "../validate";
import { editable, requireGm } from "./combatants";
import { logRoll, logSystem } from "./dice";
import type { HandlerMap } from "./types";

/*
 * Ficha pessoal: recursos com usos, ataques salvos, inventário e moedas. Só registro (ADR-06):
 * o app conta e rola o que a pessoa cadastrou, sem saber de regra de classe ou item.
 * Quem edita: o dono e o mestre (que também usa em mobs e NPCs, ex.: "Mordida +5 / 2d6+3").
 */

const RECHARGES: Recharge[] = ["short", "long", "none", "turn", "dice"];

/** Texto de uma linha, aparado e cortado; vazio recusa com a mensagem. */
function line(raw: unknown, max: number, empty: string): string {
  const s = typeof raw === "string" ? raw.replace(/\s+/g, " ").trim().slice(0, max) : "";
  return s || fail(empty);
}

function optLine(raw: unknown, max: number): string | undefined {
  return typeof raw === "string" ? raw.replace(/\s+/g, " ").trim().slice(0, max) || undefined : undefined;
}

/** Item de uma lista do combatente pelo id, ou recusa. */
function findIn<T extends { id: string }>(list: T[] | undefined, raw: unknown, what: string): T {
  const id = requireString(raw, what);
  return list?.find((x) => x.id === id) ?? fail("{what} não encontrado.", { what });
}

/** Tira um item de uma das listas; a lista vazia some do combatente. */
function removeFrom(c: Combatant, key: "resources" | "attacks" | "inventory", raw: unknown, what: string) {
  const list: { id: string }[] | undefined = c[key];
  const target = findIn(list, raw, what);
  const rest = list!.filter((x) => x !== target);
  if (rest.length > 0) Object.assign(c, { [key]: rest });
  else delete c[key];
}

/** Expressão de dano: só o formato (o dado é rolado pelo servidor na hora de rolar). */
function damageOf(raw: unknown): string | undefined {
  const s = optLine(raw, LIMITS.dice.exprLength);
  if (s && !/^[\d\sdD+\-%]+$/.test(s)) fail("Dano inválido: use algo como 1d8+3.");
  return s;
}

const REST_LABEL = { short: "descanso curto", long: "descanso longo" } as const;

function restKind(raw: unknown): "short" | "long" {
  return raw === "short" || raw === "long" ? raw : fail("Descanso curto ou longo?");
}

/** Descanso longo: vida cheia, slots de volta, sem vida temporária nem testes contra a morte. Os dois: recursos. */
function applyRest(c: Combatant, kind: "short" | "long") {
  recharge(c, kind);
  if (kind === "short") return;
  c.hp = c.hpMax;
  for (const slot of Object.values(c.spellSlots ?? {})) slot.used = 0;
  delete c.tempHp;
  delete c.deathSaves;
}

/** Recupera os recursos que voltam neste descanso. */
function recharge(c: Combatant, kind: "short" | "long") {
  for (const r of c.resources ?? []) if (r.recharge === "short" || (kind === "long" && r.recharge === "long")) r.used = 0;
}

/**
 * Começo da vez de quem tem os recursos: os de "começo da vez" (ações lendárias) voltam; os de recarga
 * gastos rolam o d6 (no log, oculto se for mob/NPC) e voltam tirando o valor pedido ou mais.
 */
export function rechargeOnTurn(store: Store, c: Combatant) {
  for (const r of c.resources ?? []) {
    if (r.recharge === "turn") r.used = 0;
    if (r.recharge !== "dice" || r.used === 0) continue;
    const result = roll("1d6", "normal");
    const back = result.total >= (r.rechargeOn ?? 6);
    if (back) r.used = 0;
    logRoll(store, gmOf(store), result, {
      label: `Recarga de ${r.name} (${r.rechargeOn ?? 6}–6)${back ? ": voltou" : ""}`,
      as: c.name,
      hidden: c.type !== "ally",
      color: c.color,
    });
  }
}

/** Autor das rolagens automáticas da mesa (recarga): o mestre, como se ele tivesse rolado. */
function gmOf(store: Store): ServerPlayer {
  return store.findGm() ?? ({ id: "system", name: "Mesa", role: "gm", token: "", sockets: new Set() } as ServerPlayer);
}

export const sheetHandlers: HandlerMap = {
  "resource:upsert": (store, player, payload) => {
    const c = editable(store, player, payload?.id);
    const name = line(payload.name, LIMITS.spellName, "Informe o nome do recurso.");
    const max = requireInt(payload.max, "Usos", 1, LIMITS.resourceMax);
    const kind = RECHARGES.includes(payload.recharge) ? payload.recharge : fail("Quando o recurso volta?");
    const rechargeOn = kind === "dice" ? requireInt(payload.rechargeOn, "Recarga", 2, 6) : undefined;
    if (payload.resourceId !== undefined) {
      const r = findIn(c.resources, payload.resourceId, "Recurso");
      delete r.rechargeOn;
      Object.assign(r, { name, max, recharge: kind, used: Math.min(r.used, max) }, rechargeOn && { rechargeOn });
      return [r.id];
    }
    const resources = (c.resources ??= []);
    if (resources.length >= LIMITS.resources) fail("Limite de {n} recursos.", { n: LIMITS.resources });
    const r = { id: randomUUID(), name, max, used: 0, recharge: kind, ...(rechargeOn && { rechargeOn }) };
    resources.push(r);
    return [r.id];
  },

  "resource:use": (store, player, payload) => {
    const c = editable(store, player, payload?.id);
    const r = findIn(c.resources, payload.resourceId, "Recurso");
    const delta = requireInt(payload.delta, "Usos", -LIMITS.resourceMax, LIMITS.resourceMax);
    r.used = Math.max(0, Math.min(r.max, r.used + delta));
  },

  "resource:remove": (store, player, payload) => {
    removeFrom(editable(store, player, payload?.id), "resources", payload.resourceId, "Recurso");
  },

  rest: (store, player, payload) => {
    const c = editable(store, player, payload?.id);
    const kind = restKind(payload?.kind);
    // Ninguém descansa no meio da luta (e um clique sem querer não enche a vida de ninguém). O mestre pode tudo.
    if (player.role !== "gm" && store.game.battle.combat.active) fail("Descanso só fora de combate.");
    applyRest(c, kind);
    // No log, para a mesa ver quem descansou. De mob/NPC, só o mestre vê.
    const who = player.role === "gm" ? `${c.name} (Mestre)` : c.name === player.name ? c.name : `${c.name} (${player.name})`;
    logSystem(store, `${who} fez um ${REST_LABEL[kind]}.`, c.type !== "ally");
  },

  "rest:all": (store, player, payload) => {
    requireGm(player);
    const kind = restKind(payload?.kind);
    const { allies } = store.game;
    if (allies.length === 0) fail("Nenhum aliado na mesa.");
    for (const a of allies) applyRest(a, kind);
    logSystem(store, `Mestre: ${REST_LABEL[kind]} para o grupo (${allies.map((a) => a.name).join(", ")}).`);
  },

  "attack:upsert": (store, player, payload) => {
    const c = editable(store, player, payload?.id);
    const name = line(payload.name, LIMITS.spellName, "Informe o nome do ataque.");
    const bonus = payload.bonus === undefined || payload.bonus === null ? undefined : requireInt(payload.bonus, "Bônus de ataque", -20, 40);
    const damage = damageOf(payload.damage);
    if (bonus === undefined && !damage) fail("Informe o bônus de ataque, o dano ou os dois.");
    const fields = { name, ...(bonus !== undefined && { bonus }), ...(damage && { damage }) };
    if (payload.attackId !== undefined) {
      const a = findIn(c.attacks, payload.attackId, "Ataque");
      delete a.bonus;
      delete a.damage;
      Object.assign(a, fields);
      return [a.id];
    }
    const attacks = (c.attacks ??= []);
    if (attacks.length >= LIMITS.attacks) fail("Limite de {n} ataques.", { n: LIMITS.attacks });
    const a = { id: randomUUID(), ...fields };
    attacks.push(a);
    return [a.id];
  },

  "attack:remove": (store, player, payload) => {
    removeFrom(editable(store, player, payload?.id), "attacks", payload.attackId, "Ataque");
  },

  "item:upsert": (store, player, payload) => {
    const c = editable(store, player, payload?.id);
    const name = line(payload.name, LIMITS.spellName, "Informe o nome do item.");
    const qty = requireInt(payload.qty, "Quantidade", 0, LIMITS.itemQty);
    const note = optLine(payload.note, LIMITS.spellNote);
    const fields = { name, qty, ...(note && { note }) };
    if (payload.itemId !== undefined) {
      const item = findIn(c.inventory, payload.itemId, "Item");
      delete item.note;
      Object.assign(item, fields);
      return [item.id];
    }
    const inventory = (c.inventory ??= []);
    if (inventory.length >= LIMITS.items) fail("Limite de {n} itens.", { n: LIMITS.items });
    const item = { id: randomUUID(), ...fields };
    inventory.push(item);
    return [item.id];
  },

  "item:remove": (store, player, payload) => {
    removeFrom(editable(store, player, payload?.id), "inventory", payload.itemId, "Item");
  },

  "coins:set": (store, player, payload) => {
    const c = editable(store, player, payload?.id);
    const raw = payload?.coins;
    if (typeof raw !== "object" || raw === null || Array.isArray(raw)) fail("Moedas inválidas.");
    const coins: Coins = {};
    for (const [key, value] of Object.entries(raw)) {
      if (!(COINS as readonly string[]).includes(key)) fail("Moeda desconhecida.");
      const n = value === null || value === undefined ? 0 : requireInt(value, "Moedas", 0, LIMITS.coins);
      if (n > 0) coins[key as keyof Coins] = n;
    }
    if (Object.keys(coins).length > 0) c.coins = coins;
    else delete c.coins;
  },
};
