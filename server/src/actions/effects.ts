import { randomUUID } from "node:crypto";
import { EFFECT_PRESETS, LIMITS, isColor, type Combatant, type EffectPreset, type MapEffect } from "@rpg/shared";
import { allCombatants, byId, removeFromOrder } from "../combat";
import type { ServerPlayer, Store } from "../store";
import { fail, requireInt, requireString, validArea } from "../validate";
import { logSystem } from "./dice";
import type { HandlerMap } from "./types";

export const CONCENTRATION = "Concentração";

export function isConcentration(name: string): boolean {
  return name.toLocaleLowerCase("pt-BR") === CONCENTRATION.toLocaleLowerCase("pt-BR");
}

/**
 * Efeitos e conjurados de concentração do conjurador somem (perdeu a concentração, saiu da batalha…).
 * Conjurado de concentração (E21) sai de vez, sem "Desfazer", como os efeitos.
 */
export function endConcentration(store: Store, casterId: string) {
  const { game } = store;
  const { battle } = game;
  const caster = byId(store, casterId)?.name;
  const of = caster ? ` de ${caster}` : "";

  const summons = allCombatants(store).filter((c) => c.summonConcentration && c.summonerId === casterId);
  for (const s of summons) dismissSummon(store, s, `${s.name}${of} sumiu (concentração perdida).`);

  const ended = battle.effects.filter((e) => e.concentration && e.casterId === casterId);
  if (ended.length === 0) return;
  battle.effects = battle.effects.filter((e) => !ended.includes(e));
  for (const e of ended) logSystem(store, `${e.name}${of} acabou (concentração perdida).`);
}

/** Concentração: o conjurador ganha a condição (o vínculo só funciona se ela existir). */
export function ensureConcentration(caster: Combatant) {
  if (caster.conditions.some((k) => isConcentration(k.name))) return;
  if (caster.conditions.length < LIMITS.conditions) caster.conditions.push({ id: randomUUID(), name: CONCENTRATION, rounds: null });
}

/** Conjurado sai de vez (concentração, duração): sem "Desfazer", com aviso no log. */
function dismissSummon(store: Store, s: Combatant, message: string) {
  const { game } = store;
  const { battle } = game;
  game.allies = game.allies.filter((c) => c.id !== s.id);
  battle.mobs = battle.mobs.filter((c) => c.id !== s.id);
  battle.npcs = battle.npcs.filter((c) => c.id !== s.id);
  removeFromOrder(store, s.id);
  endConcentration(store, s.id);
  logSystem(store, message);
}

/** Desconta 1 round dos efeitos que passam no filtro; os que chegam a 0 somem com aviso. */
function tick(store: Store, which: (e: MapEffect) => boolean) {
  const { battle } = store.game;
  const expired: MapEffect[] = [];
  for (const e of battle.effects) {
    if (e.rounds === null || !which(e)) continue;
    e.rounds--;
    if (e.rounds <= 0) expired.push(e);
  }
  if (expired.length === 0) return;
  battle.effects = battle.effects.filter((e) => !expired.includes(e));
  for (const e of expired) {
    const caster = e.casterId ? byId(store, e.casterId)?.name : undefined;
    logSystem(store, `${e.name}${caster ? ` de ${caster}` : ""} acabou.`);
  }
}

/** Início do turno de um combatente: contam os efeitos e os conjurados (E21) com duração que ele conjurou. */
export function tickCasterEffects(store: Store, casterId: string) {
  tick(store, (e) => e.casterId === casterId);
  const caster = byId(store, casterId)?.name;
  for (const s of allCombatants(store)) {
    if (s.summonerId !== casterId || s.summonRounds === undefined) continue;
    s.summonRounds--;
    if (s.summonRounds <= 0) dismissSummon(store, s, `${s.name}${caster ? ` de ${caster}` : ""} sumiu (duração acabou).`);
  }
}

/** Round novo: contam os efeitos sem conjurador (do ambiente, postos pelo mestre). */
export function tickRoundEffects(store: Store) {
  tick(store, (e) => e.casterId === null);
}

function ownEffect(store: Store, player: ServerPlayer, rawId: unknown): MapEffect {
  const id = requireString(rawId, "Efeito");
  const e = store.game.battle.effects.find((x) => x.id === id) ?? fail("Efeito não encontrado.");
  if (player.role !== "gm" && e.ownerId !== player.id) fail("Só quem criou o efeito (ou o mestre) mexe nele.");
  return e;
}

export const effectHandlers: HandlerMap = {
  "effect:add": (store, player, payload) => {
    const { battle } = store.game;
    if (battle.effects.length >= LIMITS.effects) fail(`Limite de ${LIMITS.effects} efeitos no mapa.`);
    const preset = (payload?.preset in EFFECT_PRESETS ? payload.preset : fail("Efeito inválido.")) as EffectPreset;
    const name = typeof payload.name === "string" ? payload.name.replace(/\s+/g, " ").trim().slice(0, LIMITS.effectName) : "";
    const area = validArea(payload.area) ?? fail("Área inválida.");
    const { min, max } = LIMITS.conditionRounds;
    const rounds = payload.rounds === undefined || payload.rounds === null ? null : requireInt(payload.rounds, "Duração", min, max);

    // Conjurador: mestre escolhe qualquer combatente (ou nenhum); jogador, um personagem dele.
    let casterId: string | null = null;
    if (payload.casterId) {
      const caster = byId(store, requireString(payload.casterId, "Conjurador")) ?? fail("Conjurador não encontrado.");
      if (player.role !== "gm" && caster.ownerId !== player.id) fail("Escolha o seu personagem como conjurador.");
      casterId = caster.id;
    } else if (player.role !== "gm") {
      fail("Escolha o seu personagem como conjurador.");
    }
    const concentration = payload.concentration === true;
    if (concentration && !casterId) fail("Efeito de concentração precisa de um conjurador.");

    const effect: MapEffect = {
      id: randomUUID(),
      name: name || EFFECT_PRESETS[preset].label,
      preset,
      color: isColor(payload.color) ? payload.color : EFFECT_PRESETS[preset].color,
      area,
      ownerId: player.id,
      casterId,
      rounds,
      concentration,
      active: true,
    };
    battle.effects.push(effect);

    const caster = casterId ? byId(store, casterId) : undefined;
    if (concentration && caster) ensureConcentration(caster);
    return [effect.id];
  },

  "effect:toggle": (store, player, payload) => {
    const e = ownEffect(store, player, payload?.id);
    if (typeof payload.active !== "boolean") fail("Informe se o efeito fica ligado.");
    e.active = payload.active;
  },

  "effect:remove": (store, player, payload) => {
    const e = ownEffect(store, player, payload?.id);
    store.game.battle.effects = store.game.battle.effects.filter((x) => x !== e);
  },
};

