import { randomUUID } from "node:crypto";
import { EFFECT_PRESETS, LIMITS, isColor, type Combatant, type EffectPreset, type EffectState, type GridPos, type MapEffect } from "@rpg/shared";
import { allCombatants, byId, removeFromOrder } from "../combat";
import type { ServerPlayer, Store } from "../store";
import { fail, requireInt, requireString, validArea } from "../validate";
import { logSystem, whoIs } from "./dice";
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
  for (const e of ended) finish(store, e, `${e.name}${of} acabou (concentração perdida)`);
}

/** Efeito acabou: volta ao estado de antes de "Transformar" (se pediram) ou sai do mapa. Avisa no log. */
function finish(store: Store, e: MapEffect, message: string) {
  const before = e.revertTo;
  if (!before) {
    store.game.battle.effects = store.game.battle.effects.filter((x) => x !== e);
    logSystem(store, `${message}.`);
    return;
  }
  delete e.revertTo;
  Object.assign(e, before);
  logSystem(store, `${message}; voltou a ser ${before.name}.`);
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
  for (const e of expired) {
    const caster = e.casterId ? byId(store, e.casterId)?.name : undefined;
    finish(store, e, `${e.name}${caster ? ` de ${caster}` : ""} acabou`);
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

/**
 * O token andou: os efeitos presos a ele andam a mesma distância (a área continua na mesma posição
 * em relação a ele: centrada, saindo dele…). Sair do mapa ou voltar a ele não leva o efeito junto.
 */
export function moveFollowers(store: Store, c: Combatant, from: GridPos | null, to: GridPos | null) {
  if (!from || !to) return;
  const dc = to.col - from.col;
  const dr = to.row - from.row;
  if (dc === 0 && dr === 0) return;
  const lim = LIMITS.gridCoord;
  const clamp = (n: number) => Math.max(-lim, Math.min(lim, n));
  for (const e of store.game.battle.effects) {
    if (e.followId !== c.id) continue;
    e.area = { ...e.area, origin: { col: clamp(e.area.origin.col + dc), row: clamp(e.area.origin.row + dr) } };
  }
}

/** Round novo: contam os efeitos sem conjurador (do ambiente, postos pelo mestre). */
export function tickRoundEffects(store: Store) {
  tick(store, (e) => e.casterId === null);
}

type EffectFields = Pick<MapEffect, "name" | "preset" | "color" | "casterId" | "rounds" | "concentration">;

/** Tipo, nome, cor, conjurador, duração e concentração (criar e transformar validam igual). */
function effectFields(store: Store, player: ServerPlayer, payload: Partial<Record<keyof EffectFields, unknown>>): EffectFields {
  const preset = (typeof payload?.preset === "string" && payload.preset in EFFECT_PRESETS ? payload.preset : fail("Efeito inválido.")) as EffectPreset;
  const name = typeof payload.name === "string" ? payload.name.replace(/\s+/g, " ").trim().slice(0, LIMITS.effectName) : "";
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
  return {
    name: name || EFFECT_PRESETS[preset].label,
    preset,
    color: isColor(payload.color) ? payload.color : EFFECT_PRESETS[preset].color,
    casterId,
    rounds,
    concentration,
  };
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
    if (battle.effects.length >= LIMITS.effects) fail("Limite de {n} efeitos no mapa.", { n: LIMITS.effects });
    const fields = effectFields(store, player, payload);
    const area = validArea(payload.area) ?? fail("Área inválida.");
    const { casterId, concentration } = fields;
    if (payload.follow === true && !casterId) fail("Para o efeito andar junto, escolha quem conjurou.");

    const effect: MapEffect = {
      id: randomUUID(),
      ...fields,
      area,
      ownerId: player.id,
      active: true,
      ...(payload.follow === true && casterId && { followId: casterId }),
    };
    battle.effects.push(effect);

    const caster = casterId ? byId(store, casterId) : undefined;
    if (concentration && caster) ensureConcentration(caster);
    return [effect.id];
  },

  "effect:transform": (store, player, payload) => {
    const id = requireString(payload?.id, "Efeito");
    const e = store.game.battle.effects.find((x) => x.id === id) ?? fail("Efeito não encontrado.");
    // Jogador transforma qualquer efeito que esteja vendo (ligado): é a magia dele agindo na área.
    if (player.role !== "gm" && !e.active) fail("Efeito não encontrado.");
    const fields = effectFields(store, player, payload);
    const before: EffectState = {
      name: e.name,
      preset: e.preset,
      color: e.color,
      ownerId: e.ownerId,
      casterId: e.casterId,
      rounds: e.rounds,
      concentration: e.concentration,
    };
    if (payload.revert === true) {
      if (fields.rounds === null && !fields.concentration) fail("Para voltar ao estado anterior, dê uma duração ou concentração.");
      // Transformar de novo um estado temporário volta ao original, não ao intermediário.
      e.revertTo = e.revertTo ?? before;
    } else {
      delete e.revertTo;
    }
    Object.assign(e, fields, { ownerId: player.id });
    logSystem(store, `${whoIs(store, player)} transformou ${before.name} em ${e.name}.`);
    const caster = fields.casterId ? byId(store, fields.casterId) : undefined;
    if (fields.concentration && caster) ensureConcentration(caster);
  },

  "effect:toggle": (store, player, payload) => {
    const e = ownEffect(store, player, payload?.id);
    if (typeof payload.active !== "boolean") fail("Informe se o efeito fica ligado.");
    e.active = payload.active;
  },

  "effect:follow": (store, player, payload) => {
    const e = ownEffect(store, player, payload?.id);
    if (typeof payload.follow !== "boolean") fail("Informe se o efeito anda junto.");
    if (!payload.follow) {
      delete e.followId;
      return;
    }
    if (!e.casterId || !byId(store, e.casterId)) fail("Para o efeito andar junto, ele precisa de quem conjurou.");
    e.followId = e.casterId;
  },

  "effect:remove": (store, player, payload) => {
    const e = ownEffect(store, player, payload?.id);
    store.game.battle.effects = store.game.battle.effects.filter((x) => x !== e);
  },
};

