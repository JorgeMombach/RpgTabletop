import { randomUUID } from "node:crypto";
import {
  ALLY_COLORS,
  LIMITS,
  MOB_COLORS,
  NAME_MAX_LENGTH,
  NPC_COLORS,
  isColor,
  nearestFreeCell,
  type Combatant,
  type CombatantInput,
  type MobTemplate,
} from "@rpg/shared";
import { allCombatants, byId, placeInOrder, removeFromOrder } from "../combat";
import { endConcentration, ensureConcentration } from "./effects";
import type { ServerPlayer, Store } from "../store";
import { fail, requireImage, requireInt, requireName, requireString } from "../validate";
import type { HandlerMap } from "./types";

/** Janela do "Desfazer" depois de remover um mob. */
export const UNDO_WINDOW_MS = 60_000;

const NO_PERMISSION = "Sem permissão para essa ação.";

export function requireGm(player: ServerPlayer) {
  if (player.role !== "gm") fail(NO_PERMISSION);
}

function hpMaxOf(raw: unknown) {
  return requireInt(raw, "Vida máxima", LIMITS.hpMax.min, LIMITS.hpMax.max);
}

function dexModOf(raw: unknown) {
  return requireInt(raw, "Mod. de Destreza", LIMITS.dexMod.min, LIMITS.dexMod.max);
}

function colorOf(raw: unknown, palette: string[], index: number) {
  return isColor(raw) ? raw : palette[index % palette.length];
}

/** `undefined` = não mexe; `null` = remove; string = novo avatar validado. */
function avatarOf(raw: unknown): string | null | undefined {
  if (raw === undefined || raw === null) return raw;
  return requireImage(raw, "Avatar", LIMITS.avatarChars);
}

function applyAvatar(target: { avatar?: string }, raw: unknown) {
  const avatar = avatarOf(raw);
  if (avatar === null) delete target.avatar;
  else if (avatar !== undefined) target.avatar = avatar;
}

function clampHp(c: Combatant, value: number) {
  c.hp = Math.max(0, Math.min(c.hpMax, value));
}

function findCombatant(store: Store, rawId: unknown): Combatant {
  return byId(store, requireString(rawId, "Combatente")) ?? fail("Combatente não encontrado.");
}

/** Mestre edita tudo; jogador só os próprios aliados. */
export function canEdit(player: ServerPlayer, c: Combatant): boolean {
  return player.role === "gm" || (c.type === "ally" && c.ownerId === player.id);
}

export function editable(store: Store, player: ServerPlayer, rawId: unknown): Combatant {
  const c = findCombatant(store, rawId);
  if (!canEdit(player, c)) fail(NO_PERMISSION);
  return c;
}

/** Marcas opcionais (E21): animal em qualquer combatente; oculto só em mob/NPC. */
function applyFlags(c: Combatant, input: { animal?: unknown; hidden?: unknown } | undefined) {
  if (typeof input?.animal === "boolean") c.animal = input.animal || undefined;
  if (c.type !== "ally" && input?.hidden === true) c.hidden = true;
}

function newCombatant(type: Combatant["type"], input: CombatantInput, color: string): Combatant {
  const hpMax = hpMaxOf(input?.hpMax);
  const c: Combatant = {
    id: randomUUID(),
    name: requireName(input?.name),
    type,
    hp: hpMax,
    hpMax,
    dexMod: dexModOf(input?.dexMod),
    color,
    pos: null,
    initiative: null,
    initRoll: null,
    conditions: [],
  };
  applyAvatar(c, input?.avatar);
  applyFlags(c, input);
  return c;
}

/** Lista onde o combatente mora, pelo tipo. */
function listOf(store: Store, type: Combatant["type"]): Combatant[] {
  const { game } = store;
  return type === "ally" ? game.allies : type === "mob" ? game.battle.mobs : game.battle.npcs;
}

/** Conjurados de alguém (E21). */
export function summonsOf(store: Store, summonerId: string): Combatant[] {
  return allCombatants(store).filter((c) => c.summonerId === summonerId);
}

/** Tira um mob/NPC da batalha guardando o que o "Desfazer" precisa. */
function removeForUndo(store: Store, id: string, summonIds?: string[]) {
  const { battle } = store.game;
  const list = battle.mobs.some((m) => m.id === id) ? "mobs" : "npcs";
  const index = battle[list].findIndex((m) => m.id === id);
  if (index < 0) fail("Mob ou NPC não encontrado.");
  const [mob] = battle[list].splice(index, 1);
  // Saiu da batalha: perde a concentração (os efeitos dele não voltam com o "Desfazer").
  endConcentration(store, id);
  const orderIndex = removeFromOrder(store, id);
  store.removedMobs.set(id, { mob, list, index, orderIndex, at: Date.now(), summonIds });
}

function restoreRemoved(store: Store, id: string) {
  const removed = store.removedMobs.get(id) ?? fail("Não dá mais para desfazer essa remoção.");
  store.removedMobs.delete(id);
  const { combat } = store.game.battle;
  const list = store.game.battle[removed.list];
  list.splice(Math.min(removed.index, list.length), 0, removed.mob);
  // A ordem existe também antes do combate começar (lista de iniciativa já rolada).
  if (removed.orderIndex !== null) {
    const at = Math.min(removed.orderIndex, combat.order.length);
    combat.order.splice(at, 0, id);
    if (combat.active && at <= combat.turnIndex && combat.order.length > 1) combat.turnIndex++;
  }
}

/** Aliado sai da sessão de vez (sem "Desfazer"): os conjurados dele vão junto. */
export function removeAlly(store: Store, id: string) {
  for (const s of summonsOf(store, id)) removeAlly(store, s.id);
  store.game.allies = store.game.allies.filter((a) => a.id !== id);
  removeFromOrder(store, id);
  endConcentration(store, id);
}

function pruneRemoved(store: Store, now = Date.now()) {
  for (const [id, r] of store.removedMobs) if (now - r.at > UNDO_WINDOW_MS) store.removedMobs.delete(id);
}

export const combatantHandlers: HandlerMap = {
  "template:upsert": (store, player, input) => {
    requireGm(player);
    const { templates } = store.game;
    const fields = {
      name: requireName(input?.name),
      hpMax: hpMaxOf(input?.hpMax),
      dexMod: dexModOf(input?.dexMod),
      notes: typeof input?.notes === "string" ? input.notes.trim().slice(0, LIMITS.notes) || undefined : undefined,
      animal: input?.animal === true || undefined,
    };
    avatarOf(input.avatar); // valida antes de alterar

    if (input.id) {
      const t = templates.find((t) => t.id === input.id) ?? fail("Template não encontrado.");
      Object.assign(t, fields);
      if (isColor(input.color)) t.color = input.color;
      applyAvatar(t, input.avatar);
      return [t.id];
    }
    const t: MobTemplate = { id: randomUUID(), ...fields, color: colorOf(input.color, MOB_COLORS, templates.length) };
    applyAvatar(t, input.avatar);
    templates.push(t);
    return [t.id];
  },

  "template:remove": (store, player, { id }) => {
    requireGm(player);
    const { game } = store;
    if (!game.templates.some((t) => t.id === id)) fail("Template não encontrado.");
    // Mobs já criados continuam na batalha.
    game.templates = game.templates.filter((t) => t.id !== id);
    store.mobCounters.delete(id);
  },

  "mob:addFromTemplate": (store, player, payload) => {
    requireGm(player);
    const t = store.game.templates.find((t) => t.id === payload?.templateId) ?? fail("Template não encontrado.");
    const qty = requireInt(payload.qty, "Quantidade", LIMITS.qty.min, LIMITS.qty.max);

    let n = store.mobCounters.get(t.id) ?? 0;
    const ids: string[] = [];
    for (let i = 0; i < qty; i++) {
      n++;
      // O número diferencia os mobs: se o nome passar do limite, encurta o nome base, nunca o número.
      const suffix = ` ${n}`;
      const base = t.name.slice(0, NAME_MAX_LENGTH - suffix.length).trimEnd();
      const mob = newCombatant("mob", { name: base + suffix, hpMax: t.hpMax, dexMod: t.dexMod, animal: t.animal, hidden: payload.hidden }, t.color);
      mob.templateId = t.id;
      if (t.avatar) mob.avatar = t.avatar;
      store.game.battle.mobs.push(mob);
      ids.push(mob.id);
    }
    store.mobCounters.set(t.id, n);
    return ids;
  },

  "mob:add": (store, player, input) => {
    requireGm(player);
    const { mobs } = store.game.battle;
    const mob = newCombatant("mob", input, colorOf(input?.color, MOB_COLORS, mobs.length));
    mobs.push(mob);
    return [mob.id];
  },

  "mob:remove": (store, player, { id }) => {
    requireGm(player);
    pruneRemoved(store);
    if (!store.game.battle.mobs.some((m) => m.id === id) && !store.game.battle.npcs.some((m) => m.id === id)) {
      fail("Mob ou NPC não encontrado.");
    }
    // Os conjurados saem junto (E21), antes do conjurador (senão a concentração perdida apagaria
    // os de concentração sem "Desfazer"). O "Desfazer" devolve na ordem inversa: cada um volta ao mesmo lugar.
    const summonIds = summonsOf(store, id).map((s) => s.id);
    for (const s of summonIds) removeForUndo(store, s);
    removeForUndo(store, id, summonIds);
  },

  "mob:restore": (store, player, { id }) => {
    requireGm(player);
    pruneRemoved(store);
    const removed = store.removedMobs.get(id) ?? fail("Não dá mais para desfazer essa remoção.");
    restoreRemoved(store, id);
    for (const s of [...(removed.summonIds ?? [])].reverse()) if (store.removedMobs.has(s)) restoreRemoved(store, s);
    return [id];
  },

  "summon:add": (store, player, payload) => {
    const summoner = editable(store, player, payload?.summonerId);
    if (summoner.summonerId) fail("Um conjurado não conjura outro (conjure a partir de quem lançou a magia).");
    const qty = requireInt(payload.qty, "Quantidade", LIMITS.qty.min, LIMITS.qty.max);
    const { min, max } = LIMITS.conditionRounds;
    const rounds = payload.rounds === undefined || payload.rounds === null ? null : requireInt(payload.rounds, "Duração", min, max);
    const base = requireName(payload.name);
    const list = listOf(store, summoner.type);
    const palette = summoner.type === "ally" ? ALLY_COLORS : summoner.type === "mob" ? MOB_COLORS : NPC_COLORS;
    // Valida o resto (vida, DES, avatar) antes de criar qualquer um.
    const color = colorOf(payload.color, palette, list.length);
    newCombatant(summoner.type, { ...payload, name: base }, color);

    const occupied = () => allCombatants(store).flatMap((c) => (c.pos ? [c.pos] : []));
    const ids: string[] = [];
    for (let i = 1; i <= qty; i++) {
      // Vários iguais: "Esqueleto 1", "Esqueleto 2"… (o número nunca é cortado).
      const suffix = qty > 1 ? ` ${i}` : "";
      const name = base.slice(0, NAME_MAX_LENGTH - suffix.length).trimEnd() + suffix;
      const s = newCombatant(summoner.type, { ...payload, name, hidden: summoner.hidden }, color);
      s.summonerId = summoner.id;
      if (summoner.ownerId) s.ownerId = summoner.ownerId;
      if (payload.concentration === true) s.summonConcentration = true;
      if (rounds !== null) s.summonRounds = rounds;
      // Aparece do lado de quem conjurou (ou fora do mapa, para escolher onde).
      if (summoner.pos && payload.near !== false) s.pos = nearestFreeCell(summoner.pos, occupied());
      list.push(s);
      ids.push(s.id);
    }
    if (payload.concentration === true) ensureConcentration(summoner);
    return ids;
  },

  "npc:add": (store, player, input) => {
    requireGm(player);
    const { npcs } = store.game.battle;
    const npc = newCombatant("npc", input, colorOf(input?.color, NPC_COLORS, npcs.length));
    npcs.push(npc);
    return [npc.id];
  },

  "npc:addFromTemplate": (store, player, payload) => {
    requireGm(player);
    const t = store.game.templates.find((t) => t.id === payload?.templateId) ?? fail("Template não encontrado.");
    const { npcs } = store.game.battle;
    // A cor do template é de mob (tons quentes): o NPC usa a paleta neutra.
    const npc = newCombatant(
      "npc",
      { name: t.name, hpMax: t.hpMax, dexMod: t.dexMod, animal: t.animal, hidden: payload.hidden },
      colorOf(undefined, NPC_COLORS, npcs.length),
    );
    npc.templateId = t.id;
    if (t.avatar) npc.avatar = t.avatar;
    npcs.push(npc);
    return [npc.id];
  },

  "ally:create": (store, player, input) => {
    const { allies } = store.game;
    // Jogador tem um personagem só (conjurados não contam); o mestre cria quantos aliados (NPC) quiser.
    if (player.role === "player" && allies.some((a) => a.ownerId === player.id && !a.summonerId)) {
      fail("Você já tem um personagem. Para mudar nome, vida ou mod. DES, use Editar no painel Selecionado.");
    }
    const ally = newCombatant("ally", input, colorOf(input?.color, ALLY_COLORS, allies.length));
    ally.ownerId = player.id;
    allies.push(ally);
    return [ally.id];
  },

  "ally:remove": (store, player, { id }) => {
    const ally = editable(store, player, id);
    if (ally.type !== "ally") fail("Use a remoção de mob.");
    removeAlly(store, ally.id);
  },

  "combatant:update": (store, player, payload) => {
    const c = editable(store, player, payload?.id);
    // Valida tudo antes de alterar, para não aplicar edição pela metade.
    const name = payload.name !== undefined ? requireName(payload.name) : c.name;
    const dexMod = payload.dexMod !== undefined ? dexModOf(payload.dexMod) : c.dexMod;
    const hpMax = payload.hpMax !== undefined ? hpMaxOf(payload.hpMax) : c.hpMax;
    avatarOf(payload.avatar);
    Object.assign(c, { name, dexMod, hpMax });
    if (isColor(payload.color)) c.color = payload.color;
    applyAvatar(c, payload.avatar);
    // Ocultar/revelar tem ação própria (mexe na iniciativa): aqui só a marca de animal.
    applyFlags(c, { animal: payload.animal });
    clampHp(c, c.hp);
    // Mod. DES desempata a iniciativa.
    if (payload.dexMod !== undefined && store.game.battle.combat.order.includes(c.id)) placeInOrder(store, c);
  },

  "hp:change": (store, player, payload) => {
    const c = editable(store, player, payload?.id);
    const delta = requireInt(payload.delta, "Valor", -LIMITS.hpMax.max * 10, LIMITS.hpMax.max * 10);
    clampHp(c, c.hp + delta);
  },

  "hp:set": (store, player, payload) => {
    const c = editable(store, player, payload?.id);
    clampHp(c, requireInt(payload.value, "Vida", 0, LIMITS.hpMax.max));
  },

  "hp:full": (store, player, payload) => {
    const c = editable(store, player, payload?.id);
    c.hp = c.hpMax;
  },
};
