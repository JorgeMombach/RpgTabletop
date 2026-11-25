import {
  decodeLayer,
  FLOOR_MATERIALS,
  isChunkKey,
  LIMITS,
  paintFloor,
  TERRAIN_CHUNK_SIDE,
  TERRAIN_FINE,
  validFloorByte,
  type FloorChunks,
  type FloorMaterial,
  type FloorShape,
  type FloorStroke,
} from "@rpg/shared";
import type { Store } from "../store";
import { fail, isRecord, requireNumber } from "../validate";
import { requireGm } from "./combatants";
import type { HandlerMap } from "./types";

/**
 * Pisos (docs/design/pisos.md): só o mestre pinta. Tudo é validado antes de mexer; os pedaços que mudaram vão por
 * evento próprio no próximo envio (fora do estado), como o terreno e o relevo.
 */

/** O que mandar aos jogadores no próximo envio: só estes pedaços, ou o piso inteiro (`"all"`). */
export function markFloors(store: Store, keys: Iterable<string> | "all") {
  if (keys === "all" || store.floorsDirty === "all") {
    store.floorsDirty = "all";
    return;
  }
  for (const key of keys) store.floorsDirty.add(key);
}

/** Um pedaço vindo de fora (ação ou arquivo): 1024 bytes em base64, cada um um piso válido. */
export function parseFloorChunk(raw: unknown): string {
  if (typeof raw !== "string") fail("Piso inválido.");
  const bytes = decodeLayer(raw);
  if (!bytes || !bytes.every(validFloorByte)) fail("Piso inválido.");
  return raw;
}

/** Piso inteiro vindo do arquivo de sessão: chaves `"cx,cy"`, pedaços válidos, no máximo o limite da cena. */
export function parseFloorChunks(raw: unknown): FloorChunks {
  if (!isRecord(raw)) fail("Piso inválido.");
  const entries = Object.entries(raw);
  if (entries.length > LIMITS.terrainChunks) fail("Arquivo com piso demais numa cena (máximo de {n} pedaços).", { n: LIMITS.terrainChunks });
  const chunks: FloorChunks = {};
  for (const [key, chunk] of entries) {
    if (!isChunkKey(key)) fail("Piso inválido.");
    chunks[key] = parseFloorChunk(chunk);
  }
  return chunks;
}

/** Um ponto `{ x, y }` em casas, finito e dentro do limite do mapa. */
function parsePoint(raw: unknown): { x: number; y: number } {
  if (!isRecord(raw)) fail("Piso inválido.");
  const { x, y } = raw;
  if (
    typeof x !== "number" ||
    typeof y !== "number" ||
    !Number.isFinite(x) ||
    !Number.isFinite(y)
  )
    fail("Piso inválido.");
  if (Math.abs(x) > LIMITS.gridCoord || Math.abs(y) > LIMITS.gridCoord)
    fail("Piso inválido.");
  return { x, y };
}

function parseShape(raw: unknown): FloorShape {
  if (!isRecord(raw)) fail("Piso inválido.");
  if (raw.kind === "brush") {
    const radius = requireNumber(
      raw.radius,
      "Tamanho do pincel",
      LIMITS.terrainRadius.min,
      LIMITS.terrainRadius.max,
    );
    const points = raw.points;
    if (!Array.isArray(points) || points.length < 2 || points.length % 2 !== 0)
      fail("Piso inválido.");
    if (points.length > LIMITS.terrainStrokePoints * 2)
      fail("Pincelada longa demais: solte e continue pintando.");
    if (
      !points.every(
        (n): n is number =>
          typeof n === "number" &&
          Number.isFinite(n) &&
          Math.abs(n) <= LIMITS.gridCoord,
      )
    )
      fail("Piso inválido.");
    return { kind: "brush", radius, points };
  }
  if (raw.kind === "rect")
    return { kind: "rect", from: parsePoint(raw.from), to: parsePoint(raw.to) };
  if (raw.kind === "room") return { kind: "room", at: parsePoint(raw.at) };
  fail("Piso inválido.");
}

/** Quantos pedaços (8 × 8 casas) a caixa do retângulo toca. */
function rectChunks(rect: { from: { x: number; y: number }; to: { x: number; y: number } }): number {
  const cells = TERRAIN_CHUNK_SIDE / TERRAIN_FINE;
  const span = (a: number, b: number) => Math.floor(Math.max(a, b) / cells) - Math.floor(Math.min(a, b) / cells) + 1;
  return span(rect.from.x, rect.to.x) * span(rect.from.y, rect.to.y);
}

function isMaterial(raw: unknown): raw is FloorMaterial {
  return FLOOR_MATERIALS.some((material) => material === raw);
}

function parseStroke(raw: unknown): FloorStroke {
  if (!isRecord(raw)) fail("Piso inválido.");
  const { material, vertical } = raw;
  if (material !== "erase" && !isMaterial(material)) fail("Piso inválido.");
  if (typeof vertical !== "boolean") fail("Piso inválido.");
  return { material, vertical, shape: parseShape(raw.shape) };
}

/** Guarda o piso novo da cena (sem campo quando vazio) depois de conferir o limite de pedaços. */
function commit(store: Store, next: FloorChunks, changed: Iterable<string>) {
  if (Object.keys(next).length > LIMITS.terrainChunks)
    fail("Limite de piso na cena: apague uma parte antes de pintar mais.");
  const { battle } = store.game;
  if (Object.keys(next).length > 0) battle.floors = next;
  else delete battle.floors;
  markFloors(store, changed);
}

export const floorHandlers: HandlerMap = {
  "floor:paint": (store, player, payload) => {
    requireGm(player);
    const stroke = parseStroke(payload);
    const { battle } = store.game;
    // Numa cópia: o piso da cena só muda se tudo der certo.
    const next: FloorChunks = { ...battle.floors };
    // Retângulo pintando: cada pedaço que ele toca ganha piso. Se só isso já passa do limite, recusa antes de varrer
    // a caixa inteira (um retângulo forjado de milhares de casas travaria o servidor).
    if (stroke.shape.kind === "rect" && stroke.material !== "erase" && rectChunks(stroke.shape) > LIMITS.terrainChunks)
      fail("Limite de piso na cena: apague uma parte antes de pintar mais.");
    const changed = paintFloor(
      next,
      stroke,
      battle.walls,
      battle.map.wallStyle ?? "stone",
      battle.map.frame,
    );
    if (!changed) fail("Clique dentro de um lugar fechado por paredes.");
    commit(store, next, changed);
  },

  // Desfazer do mestre: repõe os pedaços como estavam (`null` = o pedaço não existia).
  "floor:restore": (store, player, payload) => {
    requireGm(player);
    const raw = isRecord(payload) ? payload.chunks : undefined;
    if (!isRecord(raw)) fail("Piso inválido.");
    const entries = Object.entries(raw);
    if (entries.length > LIMITS.terrainChunks) fail("Piso inválido.");
    const next: FloorChunks = { ...store.game.battle.floors };
    for (const [key, chunk] of entries) {
      if (!isChunkKey(key)) fail("Piso inválido.");
      if (chunk === null) delete next[key];
      else next[key] = parseFloorChunk(chunk);
    }
    commit(
      store,
      next,
      entries.map(([key]) => key),
    );
  },

  "floor:clear": (store, player) => {
    requireGm(player);
    delete store.game.battle.floors;
    markFloors(store, "all");
  },
};
