import { randomUUID } from "node:crypto";
import { LIMITS, MAP_TORCH_STYLES, type MapTorch, type MapTorchStyle } from "@rpg/shared";
import { eraseMapTorch, pathOf } from "../erase";
import { fail, requireNumber } from "../validate";
import { requireGm } from "./combatants";
import type { HandlerMap } from "./types";

/** Ponto do mapa, em casas (qualquer lugar, como as pontas das paredes livres), em centésimos. */
function spot(raw: Record<string, unknown>): { col: number; row: number } {
  const ok = (n: unknown) => typeof n === "number" && Number.isFinite(n) && Math.abs(n) <= LIMITS.gridCoord;
  if (!ok(raw.col) || !ok(raw.row)) fail("Posição da tocha inválida.");
  const cent = (n: number) => Math.round(n * 100) / 100;
  return { col: cent(raw.col as number), row: cent(raw.row as number) };
}

/** Valida uma tocha fixa (do mestre ou do arquivo de sessão), sem o id. */
export function parseMapTorch(raw: unknown): Omit<MapTorch, "id"> {
  const t = (raw ?? {}) as Record<string, unknown>;
  if (!MAP_TORCH_STYLES.includes(t.style as MapTorchStyle)) fail("Desenho de tocha inválido.");
  return { ...spot(t), style: t.style as MapTorchStyle };
}

/** Tochas fixas no mapa: o mestre coloca, arrasta e apaga. A luz é a mesma da tocha dos tokens. */
export const mapTorchHandlers: HandlerMap = {
  "maptorch:add": (store, player, payload) => {
    requireGm(player);
    const { battle } = store.game;
    const torch: MapTorch = { id: randomUUID(), ...parseMapTorch(payload) };
    if (battle.torches.length >= LIMITS.mapTorches) fail("Limite de {n} tochas no mapa: apague algumas.", { n: LIMITS.mapTorches });
    battle.torches.push(torch);
    return [torch.id];
  },

  "maptorch:move": (store, player, payload) => {
    requireGm(player);
    const torch = store.game.battle.torches.find((t) => t.id === payload?.id) ?? fail("Tocha não encontrada.");
    Object.assign(torch, spot(payload as unknown as Record<string, unknown>));
  },

  "maptorch:erase": (store, player, payload) => {
    requireGm(player);
    const raw = payload?.points;
    const coord = (n: unknown) => typeof n === "number" && Number.isFinite(n) && Math.abs(n) <= LIMITS.gridCoord;
    if (!Array.isArray(raw) || raw.length < 2 || raw.length % 2 !== 0 || raw.length > LIMITS.eraserNumbers || !raw.every(coord)) fail("Caminho da borracha inválido.");
    const { min, max } = LIMITS.wallEraserRadius;
    const radius = requireNumber(payload.radius, "Tamanho da borracha", min, max);
    const path = pathOf(raw);
    const { battle } = store.game;
    battle.torches = battle.torches.filter((t) => !eraseMapTorch(t, path, radius));
  },

  "maptorch:clear": (store, player) => {
    requireGm(player);
    store.game.battle.torches = [];
  },
};
