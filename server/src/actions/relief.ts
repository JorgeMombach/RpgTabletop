import { decodeLayer, LIMITS, paintRelief, RELIEF_LEVELS, validReliefByte, type ReliefChunks, type ReliefStroke } from "@rpg/shared";
import type { Store } from "../store";
import { fail, requireNumber } from "../validate";
import { requireGm } from "./combatants";
import type { HandlerMap } from "./types";

/**
 * Relevo (docs/design/relevo.md): só o mestre pinta. Tudo é validado antes de mexer; os pedaços que mudaram vão por
 * evento próprio no próximo envio (fora do estado), como o terreno.
 */

/** O que mandar aos jogadores no próximo envio: só estes pedaços, ou o relevo inteiro (`"all"`). */
export function markRelief(store: Store, keys: Iterable<string> | "all") {
  if (keys === "all" || store.reliefDirty === "all") {
    store.reliefDirty = "all";
    return;
  }
  for (const key of keys) store.reliefDirty.add(key);
}

const KEY = /^-?\d{1,4},-?\d{1,4}$/;

/** Um pedaço vindo de fora (ação ou arquivo): 1024 bytes em base64, cada um um nível e tipo válidos. */
export function parseReliefChunk(raw: unknown): string {
  if (typeof raw !== "string") fail("Relevo inválido.");
  const bytes = decodeLayer(raw);
  if (!bytes || !bytes.every(validReliefByte)) fail("Relevo inválido.");
  return raw;
}

/** Relevo inteiro vindo do arquivo de sessão: chaves `"cx,cy"`, pedaços válidos, no máximo o limite da cena. */
export function parseReliefChunks(raw: unknown): ReliefChunks {
  if (typeof raw !== "object" || raw === null || Array.isArray(raw)) fail("Relevo inválido.");
  const entries = Object.entries(raw);
  if (entries.length > LIMITS.terrainChunks) fail("Limite de relevo na cena: aplaine uma parte antes de pintar mais.");
  const chunks: ReliefChunks = {};
  for (const [key, chunk] of entries) {
    if (!KEY.test(key)) fail("Relevo inválido.");
    chunks[key] = parseReliefChunk(chunk);
  }
  return chunks;
}

function parseStroke(raw: unknown): ReliefStroke {
  const stroke = (raw ?? {}) as Partial<Record<keyof ReliefStroke, unknown>>;
  const level = requireNumber(stroke.level, "Nível do relevo", RELIEF_LEVELS.min, RELIEF_LEVELS.max);
  if (!Number.isInteger(level)) fail("Relevo inválido.");
  if (typeof stroke.soft !== "boolean") fail("Relevo inválido.");
  const radius = requireNumber(stroke.radius, "Tamanho do pincel", LIMITS.terrainRadius.min, LIMITS.terrainRadius.max);
  const points = stroke.points;
  if (!Array.isArray(points) || points.length < 2 || points.length % 2 !== 0) fail("Relevo inválido.");
  if (points.length > LIMITS.terrainStrokePoints * 2) fail("Pincelada longa demais: solte e continue pintando.");
  if (!points.every((n): n is number => typeof n === "number" && Number.isFinite(n) && Math.abs(n) <= LIMITS.gridCoord)) fail("Relevo inválido.");
  return { level, soft: stroke.soft, radius, points };
}

/** Guarda o relevo novo da cena (sem campo quando vazio) depois de conferir o limite de pedaços. */
function commit(store: Store, next: ReliefChunks, changed: Iterable<string>) {
  if (Object.keys(next).length > LIMITS.terrainChunks) fail("Limite de relevo na cena: aplaine uma parte antes de pintar mais.");
  const { battle } = store.game;
  if (Object.keys(next).length > 0) battle.relief = next;
  else delete battle.relief;
  markRelief(store, changed);
}

export const reliefHandlers: HandlerMap = {
  "relief:paint": (store, player, payload) => {
    requireGm(player);
    const stroke = parseStroke(payload);
    // Numa cópia: o relevo da cena só muda se tudo der certo.
    const next: ReliefChunks = { ...store.game.battle.relief };
    commit(store, next, paintRelief(next, stroke));
  },

  // Desfazer do mestre: repõe os pedaços como estavam (`null` = o pedaço não existia).
  "relief:restore": (store, player, payload) => {
    requireGm(player);
    const raw = payload?.chunks;
    if (typeof raw !== "object" || raw === null || Array.isArray(raw)) fail("Relevo inválido.");
    const entries = Object.entries(raw);
    if (entries.length > LIMITS.terrainChunks) fail("Relevo inválido.");
    const next: ReliefChunks = { ...store.game.battle.relief };
    for (const [key, chunk] of entries) {
      if (!KEY.test(key)) fail("Relevo inválido.");
      if (chunk === null) delete next[key];
      else next[key] = parseReliefChunk(chunk);
    }
    commit(store, next, entries.map(([key]) => key));
  },

  "relief:clear": (store, player) => {
    requireGm(player);
    delete store.game.battle.relief;
    markRelief(store, "all");
  },
};
