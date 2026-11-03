import { randomUUID } from "node:crypto";
import { CHEST_STYLES, COINS, LIMITS, type ChestStyle, type Coin, type Coins, type Combatant, type LootEntry, type LootInput, type MapChest } from "@rpg/shared";
import { roll } from "../dice";
import { resolveLoot } from "../loot";
import type { ServerPlayer, Store } from "../store";
import { fail, requireInt, requireString } from "../validate";
import { chestsFor } from "../view";
import { requireGm } from "./combatants";
import { logSystem, whoIs } from "./dice";
import { attackFields } from "./sheet";
import type { HandlerMap } from "./types";

/** Casa do baú (inteira, uma casa só). */
function cellOf(raw: Record<string, unknown>): { col: number; row: number } {
  const lim = LIMITS.gridCoord;
  return { col: requireInt(raw.col, "Coluna", -lim, lim), row: requireInt(raw.row, "Linha", -lim, lim) };
}

function styleOf(raw: unknown): ChestStyle {
  return CHEST_STYLES.includes(raw as ChestStyle) ? (raw as ChestStyle) : fail("Desenho de baú inválido.");
}

function nameOf(raw: unknown): string {
  const name = typeof raw === "string" ? raw.replace(/\s+/g, " ").trim().slice(0, LIMITS.chestName) : "";
  return name || fail("Dê um nome ao baú.");
}

/** Uma entrada de loot (do mestre ou do arquivo de sessão), sem o id. Moedas, item ou arma (como um ataque). */
export function parseLoot(raw: unknown): LootInput {
  const e = (raw ?? {}) as Record<string, unknown>;
  if (e.kind === "coins") {
    const src = e.coins;
    if (typeof src !== "object" || src === null || Array.isArray(src)) fail("Moedas inválidas.");
    const coins: Coins = {};
    for (const [key, value] of Object.entries(src)) {
      if (!(COINS as readonly string[]).includes(key)) fail("Moeda desconhecida.");
      const n = requireInt(value, "Moedas", 0, LIMITS.coins);
      if (n > 0) coins[key as keyof Coins] = n;
    }
    if (Object.keys(coins).length === 0) fail("Diga quantas moedas vão no baú.");
    return { kind: "coins", coins };
  }
  if (e.kind === "item" || e.kind === "weapon") {
    const qty = requireInt(e.qty, "Quantidade", 1, LIMITS.itemQty);
    const note = typeof e.note === "string" ? e.note.trim().slice(0, LIMITS.spellNote) : "";
    // Arma: nome, bônus e dano validados como um ataque salvo.
    const fields =
      e.kind === "weapon"
        ? attackFields(e)
        : { name: typeof e.name === "string" && e.name.trim() ? e.name.replace(/\s+/g, " ").trim().slice(0, LIMITS.spellName) : fail("Informe o nome do item.") };
    return { kind: e.kind, ...fields, qty, ...(note && { note }) } as LootInput;
  }
  fail("Tipo de loot inválido.");
}

/** Valida um baú do arquivo de sessão. */
export function parseChest(raw: unknown): MapChest {
  const c = (raw ?? {}) as Record<string, unknown>;
  const loot = Array.isArray(c.loot) ? c.loot : fail("Arquivo inválido: loot do baú.");
  if (loot.length > LIMITS.loot) fail("Arquivo inválido: loot do baú.");
  return {
    id: requireString(c.id, "Baú"),
    ...cellOf(c),
    name: nameOf(c.name),
    style: styleOf(c.style),
    ...(c.locked === true && { locked: true }),
    ...(c.hidden === true && { hidden: true }),
    ...(c.opened === true && { opened: true }),
    loot: loot.map((e) => ({ id: requireString((e as { id?: unknown })?.id, "Loot"), ...parseLoot(e) }) as LootEntry),
  };
}

function findChest(store: Store, id: unknown): MapChest {
  return store.game.battle.chests.find((c) => c.id === id) ?? fail("Baú não encontrado.");
}

function requireFree(store: Store, cell: { col: number; row: number }, except?: string) {
  if (store.game.battle.chests.some((c) => c.id !== except && c.col === cell.col && c.row === cell.row)) fail("Já tem um baú nessa casa.");
}

/** Baús no mapa (Fase 6, docs/design/baus.md): o mestre põe, edita, move e apaga. */
export const chestHandlers: HandlerMap = {
  "chest:add": (store, player, payload) => {
    requireGm(player);
    const { battle } = store.game;
    const cell = cellOf(payload as unknown as Record<string, unknown>);
    const style = styleOf(payload?.style);
    requireFree(store, cell);
    if (battle.chests.length >= LIMITS.chests) fail("Limite de {n} baús no mapa.", { n: LIMITS.chests });
    const chest: MapChest = { id: randomUUID(), ...cell, name: "Baú", style, loot: [] };
    battle.chests.push(chest);
    return [chest.id];
  },

  "chest:update": (store, player, payload) => {
    requireGm(player);
    const chest = findChest(store, payload?.id);
    const name = nameOf(payload.name);
    const style = styleOf(payload.style);
    if (!Array.isArray(payload.loot)) fail("Loot inválido.");
    if (payload.loot.length > LIMITS.loot) fail("Limite de {n} coisas num baú.", { n: LIMITS.loot });
    // Tudo validado antes de mudar o baú.
    const loot = payload.loot.map((e) => ({ id: randomUUID(), ...parseLoot(e) }) as LootEntry);
    Object.assign(chest, { name, style, loot });
    // Loot trocado no meio da escolha: a disputa acaba sem entregar nada.
    cancelCount(store, chest.id);
    if (payload.locked === true) chest.locked = true;
    else delete chest.locked;
    if (payload.hidden === true) chest.hidden = true;
    else delete chest.hidden;
  },

  "chest:move": (store, player, payload) => {
    requireGm(player);
    const chest = findChest(store, payload?.id);
    const cell = cellOf(payload as unknown as Record<string, unknown>);
    requireFree(store, cell, chest.id);
    Object.assign(chest, cell);
  },

  "chest:remove": (store, player, payload) => {
    requireGm(player);
    const chest = findChest(store, payload?.id);
    store.game.battle.chests = store.game.battle.chests.filter((c) => c !== chest);
    cancelCount(store, chest.id);
  },

  "chest:open": (store, player, payload) => {
    const gm = player.role === "gm";
    const chest = findChest(store, payload?.id);
    // O jogador só abre o que enxerga (invisível ou coberto pela névoa: "não encontrado").
    requireSeen(store, player, chest);
    if (chest.hidden) fail("Revele o baú antes de abrir.");
    if (!gm && chest.locked) fail("Está trancado.");
    if (store.lootCount && store.lootCount.chestId !== chest.id) fail("Espere a escolha do outro baú acabar.");
    if (chest.opened) return;
    chest.opened = true;
    // Baú que os jogadores não veem (coberto pela névoa): o aviso fica só para o mestre.
    logSystem(store, "{who} abriu {chest}.", { who: whoIs(store, player), chest: chest.name }, !seenByPlayers(store, chest));
    const ms = store.lootMsOverride ?? store.game.lootSeconds * 1000;
    if (ms <= 0 || chest.loot.length === 0) return;
    const count = { chestId: chest.id, endsAt: Date.now() + ms, wants: {} };
    store.lootCount = count;
    store.lootResults = null;
    // O tempo acabou: resolve (se ainda for esta contagem).
    store.schedule(ms, () => store.lootCount === count && endCount(store));
  },

  "loot:want": (store, player, payload) => {
    const count = store.lootCount;
    if (!count || count.chestId !== payload?.chestId) fail("A escolha já acabou.");
    if (player.role === "gm") fail("O mestre dá o loot com Dar para….");
    characterOf(store, player);
    requireSeen(store, player, findChest(store, payload.chestId));
    const entry = findEntry(store, payload.chestId, payload.lootId);
    const list = (count.wants[entry.id] ?? []).filter((id) => id !== player.id);
    if (payload.want === true) list.push(player.id);
    if (list.length > 0) count.wants[entry.id] = list;
    else delete count.wants[entry.id];
  },

  "loot:take": (store, player, payload) => {
    const chest = findChest(store, payload?.chestId);
    requireSeen(store, player, chest);
    if (store.lootCount?.chestId === chest.id) fail("Ainda estão escolhendo: espere a contagem.");
    if (!chest.opened) fail("Abra o baú primeiro.");
    const c = characterOf(store, player);
    const entry = chest.loot.find((e) => e.id === payload.lootId) ?? fail("Esse item já foi levado.");
    const qty = entry.kind === "coins" ? 0 : payload.qty === undefined ? entry.qty : requireInt(payload.qty, "Quantidade", 1, entry.qty);
    give(store, chest, entry, c, qty);
  },

  "loot:give": (store, player, payload) => {
    requireGm(player);
    const chest = findChest(store, payload?.chestId);
    const entry = chest.loot.find((e) => e.id === payload.lootId) ?? fail("Esse item já foi levado.");
    const c = store.game.allies.find((a) => a.id === payload.to && !a.summonerId) ?? fail("Personagem não encontrado.");
    const qty = entry.kind === "coins" ? 0 : requireInt(payload.qty, "Quantidade", 1, entry.qty);
    give(store, chest, entry, c, qty);
    // O que o mestre deu sai da disputa.
    if (store.lootCount?.chestId === chest.id) delete store.lootCount.wants[entry.id];
  },

  "loot:end": (store, player) => {
    requireGm(player);
    if (!store.lootCount) fail("Ninguém está escolhendo loot agora.");
    endCount(store);
  },

  "loot:seconds": (store, player, payload) => {
    requireGm(player);
    const { min, max } = LIMITS.lootSeconds;
    store.game.lootSeconds = requireInt(payload?.seconds, "Tempo para escolher o loot", min, max);
  },
};

/** O jogador só mexe no baú que recebe (invisível ou coberto pela névoa: "não encontrado"). */
function requireSeen(store: Store, player: ServerPlayer, chest: MapChest) {
  if (player.role !== "gm" && !seenByPlayers(store, chest)) fail("Baú não encontrado.");
}

function seenByPlayers(store: Store, chest: MapChest): boolean {
  return chestsFor(store, false).some((c) => c.id === chest.id);
}

/** Personagem principal do jogador (quem recebe o loot; nunca um invocado). */
function characterOf(store: Store, player: ServerPlayer): Combatant {
  return store.game.allies.find((a) => a.ownerId === player.id && !a.summonerId) ?? fail("Crie seu personagem antes.");
}

/** Siglas das moedas no log (escrito em português pelo servidor). */
const COIN_LOG: Record<Coin, string> = { pp: "pl", gp: "po", ep: "pe", sp: "pp", cp: "pc" };

function describe(entry: LootEntry, qty: number, coins?: Coins): string {
  if (entry.kind === "coins") {
    const c = coins ?? entry.coins;
    return COINS.filter((k) => c[k]).map((k) => `${c[k]} ${COIN_LOG[k]}`).join(" · ");
  }
  return qty > 1 ? `${entry.name} ×${qty}` : entry.name;
}

/**
 * Põe na ficha: moedas somam; item ou arma entra na aba Itens (igual a um que já existe: soma a quantidade).
 * Devolve quanto entrou: numa pilha perto do limite, só o que cabe (o resto fica no baú); 0 = ficha cheia.
 * Moedas: tudo ou nada (passar do limite de moedas não perde nada, só não entra).
 */
function deliver(c: Combatant, entry: LootEntry, qty: number, coins?: Coins): number {
  if (entry.kind === "coins") {
    const add = coins ?? entry.coins;
    const now: Coins = { ...(c.coins ?? {}) };
    for (const k of COINS) if (add[k]) now[k] = (now[k] ?? 0) + add[k]!;
    if (COINS.some((k) => (now[k] ?? 0) > LIMITS.coins)) return 0;
    c.coins = now;
    return 1;
  }
  const bonus = entry.kind === "weapon" ? entry.bonus : undefined;
  const damage = entry.kind === "weapon" ? entry.damage : undefined;
  const inventory = c.inventory ?? [];
  const same = inventory.find((i) => i.name === entry.name && i.note === entry.note && i.bonus === bonus && i.damage === damage);
  if (same) {
    const fit = Math.min(qty, LIMITS.itemQty - same.qty);
    same.qty += fit;
    return fit;
  }
  if (inventory.length >= LIMITS.items) return 0;
  inventory.push({ id: randomUUID(), name: entry.name, qty, ...(entry.note && { note: entry.note }), ...(bonus !== undefined && { bonus }), ...(damage && { damage }) });
  c.inventory = inventory;
  return qty;
}

/** Tira do baú o que foi entregue (moedas: tudo; pilha: as unidades). */
function takeOut(chest: MapChest, entry: LootEntry, qty: number) {
  if (entry.kind !== "coins" && entry.qty > qty) entry.qty -= qty;
  else chest.loot = chest.loot.filter((e) => e !== entry);
}

/** Pegar ou Dar para…: entrega, tira do baú e registra no log. */
function give(store: Store, chest: MapChest, entry: LootEntry, c: Combatant, qty: number) {
  const got = deliver(c, entry, qty);
  if (got === 0) fail("A ficha de {name} está cheia.", { name: c.name });
  const what = describe(entry, entry.kind === "coins" ? 0 : got);
  takeOut(chest, entry, entry.kind === "coins" ? 0 : got);
  logSystem(store, "{who} levou {what} do {chest}.", { who: c.name, what, chest: chest.name });
}

function findEntry(store: Store, chestId: unknown, lootId: unknown): LootEntry {
  return findChest(store, chestId).loot.find((e) => e.id === lootId) ?? fail("Esse item já foi levado.");
}

/** Baú apagado ou mudado: a disputa dele acaba sem entregar nada, e o resultado antigo sai. */
function cancelCount(store: Store, chestId: string) {
  if (store.lootCount?.chestId === chestId) store.lootCount = null;
  if (store.lootResults?.chestId === chestId) store.lootResults = null;
}

/** Fim da contagem: cada coisa que alguém quis vai para quem ganhou (d20 na disputa), com o resultado para a janela. */
function endCount(store: Store) {
  const count = store.lootCount;
  store.lootCount = null;
  const chest = count && store.game.battle.chests.find((c) => c.id === count.chestId);
  if (!count || !chest) return;
  const charOf = (playerId: string) => store.game.allies.find((a) => a.ownerId === playerId && !a.summonerId);
  const d20 = () => roll("1d20").total;
  const lines: NonNullable<Store["lootResults"]>["lines"] = [];
  for (const entry of [...chest.loot]) {
    // Quem desfez o personagem no meio da contagem sai da disputa.
    const wanters = (count.wants[entry.id] ?? []).filter((id) => charOf(id));
    if (wanters.length === 0) continue;
    const res = resolveLoot(entry, wanters, d20);
    const rolls = res.rolls.map((r) => ({ who: charOf(r.id)!.name, d20: r.d20 }));
    const dice = rolls.map((r) => `${r.who} ${r.d20}`).join(", ");
    const gave: (typeof lines)[number]["gave"] = [];
    let delivered = 0;
    for (const share of res.shares) {
      const c = charOf(share.id)!;
      const got = deliver(c, entry, share.qty, share.coins);
      if (got === 0 || (entry.kind !== "coins" && got < share.qty)) {
        const lost = entry.kind === "coins" ? share.qty : share.qty - got;
        logSystem(store, "A ficha de {who} está cheia: {what} ficou no {chest}.", { who: c.name, what: describe(entry, lost, share.coins), chest: chest.name });
      }
      if (got === 0) continue;
      const qty = entry.kind === "coins" ? 0 : got;
      const what = describe(entry, qty, share.coins);
      delivered += qty;
      gave.push({ who: c.name, qty, ...(share.coins && { coins: share.coins }) });
      if (dice) logSystem(store, "{who} levou {what} do {chest} (d20: {dice}).", { who: c.name, what, chest: chest.name, dice });
      else logSystem(store, "{who} levou {what} do {chest}.", { who: c.name, what, chest: chest.name });
    }
    // Moedas: sai do baú se alguém recebeu (quem estava com a ficha no limite não leva; a parte dele some da disputa).
    if (entry.kind === "coins") {
      if (gave.length > 0) chest.loot = chest.loot.filter((e) => e !== entry);
    } else if (delivered > 0) takeOut(chest, entry, delivered);
    lines.push({ lootId: entry.id, name: entry.kind === "coins" ? "" : entry.name, rolls, gave });
  }
  store.lootResults = { chestId: chest.id, at: Date.now(), lines };
}
