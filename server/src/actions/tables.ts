// Tabelas aleatórias (Passo 13, docs/design/tabelas.md): o mestre cria, edita, apaga e rola.
import { randomUUID } from "node:crypto";
import { LIMITS, type LootInput, type RollTable } from "@rpg/shared";
import type { ServerPlayer, Store } from "../store";
import { lootText, parseTable, rollLootTable, rollTable } from "../tables";
import { fail, requireInt } from "../validate";
import { requireGm } from "./combatants";
import { pushTableLog } from "./dice";
import type { HandlerMap } from "./types";

export function findTable(store: Store, id: unknown): RollTable {
  return store.game.tables.find((t) => t.id === id) ?? fail("Essa tabela não existe mais.");
}

export const tableHandlers: HandlerMap = {
  "table:upsert": (store, player, payload) => {
    requireGm(player);
    const parsed = parseTable(payload);
    const { tables } = store.game;
    const current = payload.id === undefined ? undefined : findTable(store, payload.id);
    const lower = parsed.name.toLowerCase();
    if (tables.some((t) => t !== current && t.name.toLowerCase() === lower)) fail("Já existe uma tabela chamada {name}.", { name: parsed.name });
    if (current) {
      Object.assign(current, parsed);
      return [current.id];
    }
    if (tables.length >= LIMITS.tables) fail("Limite de {n} tabelas.", { n: LIMITS.tables });
    const table: RollTable = { id: randomUUID(), ...parsed };
    tables.push(table);
    return [table.id];
  },

  "table:remove": (store, player, payload) => {
    requireGm(player);
    const table = findTable(store, payload?.id);
    store.game.tables = store.game.tables.filter((t) => t !== table);
  },

  "table:roll": (store, player, payload) => {
    requireGm(player);
    const table = findTable(store, payload?.id);
    const isPublic = payload.public === true;
    const { die, value, text } = rollTable(table, store.game.tables);
    if (isPublic) table.public = true;
    else delete table.public;
    return [pushTableLog(store, player, { table: { id: table.id, name: table.name, die, value }, text, hidden: !isPublic })];
  },
};

/** Pedido `table:rollLoot` (socket): sorteia o loot para o baú que o mestre está editando e registra só para ele. */
export function rollLootFor(store: Store, player: ServerPlayer, req: unknown): LootInput[] {
  requireGm(player);
  const r = (req ?? {}) as Record<string, unknown>;
  const table = findTable(store, r.tableId);
  if (table.kind !== "loot") fail("Escolha uma tabela de loot.");
  const times = requireInt(r.times, "Vezes", 1, LIMITS.tableTimes);
  const loot = rollLootTable(table, times);
  pushTableLog(store, player, { table: { id: table.id, name: table.name, die: `×${times}`, value: times }, text: lootText(loot), hidden: true });
  return loot;
}
