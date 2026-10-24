import { randomUUID } from "node:crypto";
import { EFFECT_PRESETS, LIMITS, isColor, type EffectPreset, type MapEffect } from "@rpg/shared";
import { byId } from "../combat";
import type { ServerPlayer, Store } from "../store";
import { fail, requireInt, requireString, validArea } from "../validate";
import { logSystem } from "./dice";
import type { HandlerMap } from "./types";

export const CONCENTRATION = "Concentração";

export function isConcentration(name: string): boolean {
  return name.toLocaleLowerCase("pt-BR") === CONCENTRATION.toLocaleLowerCase("pt-BR");
}

/** Efeitos de concentração do conjurador somem (perdeu a concentração, saiu da batalha…). */
export function endConcentration(store: Store, casterId: string) {
  const { battle } = store.game;
  const ended = battle.effects.filter((e) => e.concentration && e.casterId === casterId);
  if (ended.length === 0) return;
  battle.effects = battle.effects.filter((e) => !ended.includes(e));
  const caster = byId(store, casterId)?.name;
  for (const e of ended) logSystem(store, `${e.name}${caster ? ` de ${caster}` : ""} acabou (concentração perdida).`);
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

/** Início do turno de um combatente: contam os efeitos que ele conjurou (como as magias do 5e). */
export function tickCasterEffects(store: Store, casterId: string) {
  tick(store, (e) => e.casterId === casterId);
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

    // Concentração: o conjurador ganha a condição (o vínculo só funciona se ela existir).
    const caster = casterId ? byId(store, casterId) : undefined;
    if (concentration && caster && !caster.conditions.some((k) => isConcentration(k.name))) {
      if (caster.conditions.length < LIMITS.conditions) caster.conditions.push({ id: randomUUID(), name: CONCENTRATION, rounds: null });
    }
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

