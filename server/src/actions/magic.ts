import { randomUUID } from "node:crypto";
import { LIMITS, SPELL_LEVELS, type Combatant, type SpellLevel, type SpellSlot } from "@rpg/shared";
import type { ServerPlayer, Store } from "../store";
import { fail, requireInt } from "../validate";
import { editable } from "./combatants";
import type { HandlerMap } from "./types";

/** Slots e magias são só de aliados; o jogador gerencia livremente (ADR-06). */
function editableAlly(store: Store, player: ServerPlayer, id: unknown): Combatant {
  const c = editable(store, player, id);
  if (c.type !== "ally") fail("Só aliados têm slots e magias.");
  return c;
}

export function emptySlots(): Record<SpellLevel, SpellSlot> {
  return Object.fromEntries(SPELL_LEVELS.map((l) => [l, { max: 0, used: 0 }])) as Record<SpellLevel, SpellSlot>;
}

function slotsOf(c: Combatant) {
  return (c.spellSlots ??= emptySlots());
}

function restoreSlots(c: Combatant) {
  for (const slot of Object.values(slotsOf(c))) slot.used = 0;
}

export const magicHandlers: HandlerMap = {
  "slot:set": (store, player, payload) => {
    const c = editableAlly(store, player, payload?.id);
    const level = requireInt(payload.level, "Nível", 1, 9) as SpellLevel;
    const slot = slotsOf(c)[level];
    const max = payload.max !== undefined ? requireInt(payload.max, "Slots", 0, LIMITS.slotMax) : slot.max;
    const used = payload.used !== undefined ? requireInt(payload.used, "Slots usados", 0, LIMITS.slotMax) : slot.used;
    slot.max = max;
    slot.used = Math.min(used, max);
  },

  "slots:restore": (store, player, payload) => {
    restoreSlots(editableAlly(store, player, payload?.id));
  },

  "ally:restoreAll": (store, player, payload) => {
    const c = editableAlly(store, player, payload?.id);
    c.hp = c.hpMax;
    restoreSlots(c);
  },

  "spell:add": (store, player, payload) => {
    const c = editableAlly(store, player, payload?.id);
    const spells = (c.spells ??= []);
    if (spells.length >= LIMITS.spells) fail(`Limite de ${LIMITS.spells} magias.`);
    const name = typeof payload.name === "string" ? payload.name.replace(/\s+/g, " ").trim().slice(0, LIMITS.spellName) : "";
    if (!name) fail("Informe o nome da magia.");
    const note = typeof payload.note === "string" ? payload.note.trim().slice(0, LIMITS.spellNote) : "";
    const spell = { id: randomUUID(), name, level: requireInt(payload.level, "Nível", 0, 9), ...(note && { note }) };
    spells.push(spell);
    spells.sort((a, b) => a.level - b.level || a.name.localeCompare(b.name, "pt-BR"));
    return [spell.id];
  },

  "spell:remove": (store, player, payload) => {
    const c = editableAlly(store, player, payload?.id);
    const before = c.spells?.length ?? 0;
    c.spells = (c.spells ?? []).filter((s) => s.id !== payload.spellId);
    if (c.spells.length === before) fail("Magia não encontrada.");
  },
};
