import { decodeLayer, isChunkKey, LIMITS, paintTerrain, TERRAINS, type TerrainChunk, type TerrainChunks, type TerrainId, type TerrainStroke } from "@rpg/shared";
import type { Store } from "../store";
import { fail, requireNumber } from "../validate";
import { requireGm } from "./combatants";
import type { HandlerMap } from "./types";

/**
 * Terreno pintado (criação de mapa, entrega 1): só o mestre pinta. Tudo é validado antes de mexer; os pedaços que
 * mudaram são marcados em `store.terrainDirty` e vão por evento próprio no próximo envio (fora do estado).
 */

/** O que mandar aos jogadores no próximo envio: só estes pedaços, ou o terreno inteiro (`"all"`). */
export function markTerrain(store: Store, keys: Iterable<string> | "all") {
  if (keys === "all" || store.terrainDirty === "all") {
    store.terrainDirty = "all";
    return;
  }
  for (const key of keys) store.terrainDirty.add(key);
}

/** Um pedaço vindo de fora (ação ou arquivo): só terrenos conhecidos, cada um com 1024 bytes em base64; não vazio. */
export function parseTerrainChunk(raw: unknown): TerrainChunk {
  if (typeof raw !== "object" || raw === null || Array.isArray(raw)) fail("Terreno inválido.");
  const entries = Object.entries(raw);
  if (entries.length === 0) fail("Terreno inválido.");
  const chunk: TerrainChunk = {};
  for (const [id, text] of entries) {
    if (!TERRAINS.includes(id as TerrainId) || typeof text !== "string" || !decodeLayer(text)) fail("Terreno inválido.");
    chunk[id as TerrainId] = text;
  }
  return chunk;
}

/** Terreno inteiro vindo do arquivo de sessão: chaves `"cx,cy"`, pedaços válidos, no máximo o limite da cena. */
export function parseTerrainChunks(raw: unknown): TerrainChunks {
  if (typeof raw !== "object" || raw === null || Array.isArray(raw)) fail("Terreno inválido.");
  const entries = Object.entries(raw);
  if (entries.length > LIMITS.terrainChunks) fail("Arquivo com terreno pintado demais numa cena (máximo de {n} pedaços).", { n: LIMITS.terrainChunks });
  const chunks: TerrainChunks = {};
  for (const [key, chunk] of entries) {
    if (!isChunkKey(key)) fail("Terreno inválido.");
    chunks[key] = parseTerrainChunk(chunk);
  }
  return chunks;
}

function parseStroke(raw: unknown): TerrainStroke {
  const stroke = (raw ?? {}) as Partial<Record<keyof TerrainStroke, unknown>>;
  const terrain = stroke.terrain;
  if (terrain !== "erase" && !TERRAINS.includes(terrain as TerrainId)) fail("Terreno inválido.");
  const radius = requireNumber(stroke.radius, "Tamanho do pincel", LIMITS.terrainRadius.min, LIMITS.terrainRadius.max);
  const strength = requireNumber(stroke.strength, "Força do pincel", LIMITS.terrainStrength.min, LIMITS.terrainStrength.max);
  const coord = (n: unknown): n is number => typeof n === "number" && Number.isFinite(n) && Math.abs(n) <= LIMITS.gridCoord;
  if (stroke.rect !== undefined) {
    // Retângulo de canto a canto: os pontos do pincel não contam.
    const rect = stroke.rect;
    const corner = (raw: unknown): { x: number; y: number } => {
      if (typeof raw !== "object" || raw === null || !("x" in raw) || !("y" in raw) || !coord(raw.x) || !coord(raw.y)) fail("Terreno inválido.");
      return { x: raw.x, y: raw.y };
    };
    if (typeof rect !== "object" || rect === null || !("from" in rect) || !("to" in rect)) fail("Terreno inválido.");
    const from = corner(rect.from);
    const to = corner(rect.to);
    if (Math.abs(to.x - from.x) > LIMITS.terrainRectSide || Math.abs(to.y - from.y) > LIMITS.terrainRectSide) fail("Retângulo grande demais (máximo de {n} casas de lado): pinte em partes.", { n: LIMITS.terrainRectSide });
    return { terrain: terrain as TerrainStroke["terrain"], radius, strength, points: [], rect: { from, to } };
  }
  const points = stroke.points;
  if (!Array.isArray(points) || points.length < 2 || points.length % 2 !== 0) fail("Terreno inválido.");
  if (points.length > LIMITS.terrainStrokePoints * 2) fail("Pincelada longa demais: solte e continue pintando.");
  if (!points.every(coord)) fail("Terreno inválido.");
  return { terrain: terrain as TerrainStroke["terrain"], radius, strength, points };
}

/** Guarda o terreno novo da cena (sem campo quando vazio) depois de conferir o limite de pedaços. */
function commit(store: Store, next: TerrainChunks, changed: Iterable<string>) {
  if (Object.keys(next).length > LIMITS.terrainChunks) fail("Limite de terreno pintado na cena: apague uma parte antes de pintar mais.");
  const { battle } = store.game;
  if (Object.keys(next).length > 0) battle.terrain = next;
  else delete battle.terrain;
  markTerrain(store, changed);
}

export const terrainHandlers: HandlerMap = {
  "terrain:paint": (store, player, payload) => {
    requireGm(player);
    const stroke = parseStroke(payload);
    // Numa cópia: os pedaços tocados viram objetos novos, o terreno da cena só muda se tudo der certo.
    const next: TerrainChunks = { ...store.game.battle.terrain };
    const changed = paintTerrain(next, stroke);
    commit(store, next, changed);
  },

  // Desfazer do mestre: repõe os pedaços como estavam (`null` = o pedaço não existia).
  "terrain:restore": (store, player, payload) => {
    requireGm(player);
    const raw = payload?.chunks;
    if (typeof raw !== "object" || raw === null || Array.isArray(raw)) fail("Terreno inválido.");
    const next: TerrainChunks = { ...store.game.battle.terrain };
    const entries = Object.entries(raw);
    if (entries.length > LIMITS.terrainChunks) fail("Terreno inválido.");
    for (const [key, chunk] of entries) {
      if (!isChunkKey(key)) fail("Terreno inválido.");
      if (chunk === null) delete next[key];
      else next[key] = parseTerrainChunk(chunk);
    }
    commit(store, next, entries.map(([key]) => key));
  },

  "terrain:clear": (store, player) => {
    requireGm(player);
    delete store.game.battle.terrain;
    markTerrain(store, "all");
  },
};
