import { randomUUID } from "node:crypto";
import { LIMITS, MAP_TORCH_COLORS, MAP_TORCH_STYLES, sconceHasWall, touchesWall, WALL_CLEARANCE, type GameState, type MapTorch, type MapTorchColor, type MapTorchStyle, type Wall } from "@rpg/shared";
import { eraseMapTorch, pathOf } from "../erase";
import { fail, requireNumber } from "../validate";
import { requireGm } from "./combatants";
import { requirePointsInFrame } from "./frameRule";
import type { HandlerMap } from "./types";

/** Ponto do mapa, em casas (qualquer lugar, como as pontas das paredes livres), em centésimos. */
function spot(raw: Record<string, unknown>): { col: number; row: number } {
  const ok = (n: unknown) => typeof n === "number" && Number.isFinite(n) && Math.abs(n) <= LIMITS.gridCoord;
  if (!ok(raw.col) || !ok(raw.row)) fail("Posição da tocha inválida.");
  const cent = (n: number) => Math.round(n * 100) / 100;
  return { col: cent(raw.col as number), row: cent(raw.row as number) };
}

/** Direção da arandela: inteiro de 0 a 359 (graus). */
function facingOf(raw: unknown): number {
  if (typeof raw !== "number" || !Number.isInteger(raw) || raw < 0 || raw > 359) fail("Direção da arandela inválida.");
  return raw;
}

/**
 * Onde a fonte pode ficar (docs/design/luzes.md): a arandela precisa de uma parede perto; as outras não ficam em cima
 * de parede (portas e janelas não contam).
 */
function requirePlace(style: MapTorchStyle, spotAt: { col: number; row: number }, walls: Wall[]) {
  const at = { x: spotAt.col, y: spotAt.row };
  if (style === "sconce") {
    if (!sconceHasWall(at, walls)) fail("A arandela precisa de uma parede.");
  } else if (touchesWall(at, WALL_CLEARANCE.torch, walls)) fail("Aí tem uma parede.");
}

/** Valida uma fonte de luz fixa (do mestre ou do arquivo de sessão), sem o id. Campos opcionais só quando vêm. */
export function parseMapTorch(raw: unknown): Omit<MapTorch, "id"> {
  const t = (raw ?? {}) as Record<string, unknown>;
  if (!MAP_TORCH_STYLES.includes(t.style as MapTorchStyle)) fail("Desenho de tocha inválido.");
  const style = t.style as MapTorchStyle;
  const torch: Omit<MapTorch, "id"> = { ...spot(t), style };
  if (t.color !== undefined) {
    if (!MAP_TORCH_COLORS.includes(t.color as MapTorchColor)) fail("Cor da luz inválida.");
    if (t.color !== "flame") torch.color = t.color as MapTorchColor;
  }
  if (style === "sconce") torch.facing = facingOf(t.facing ?? 0);
  return torch;
}

/** Depois de mudar as paredes: a arandela que ficou sem parede perto sai junto (como uma porta). */
export function dropLooseSconces(battle: GameState["battle"]) {
  if (!battle.torches.some((torch) => torch.style === "sconce")) return;
  battle.torches = battle.torches.filter((torch) => torch.style !== "sconce" || sconceHasWall({ x: torch.col, y: torch.row }, battle.walls));
}

/** Tochas fixas no mapa: o mestre coloca, arrasta e apaga. A luz é a mesma da tocha dos tokens. */
export const mapTorchHandlers: HandlerMap = {
  "maptorch:add": (store, player, payload) => {
    requireGm(player);
    const { battle } = store.game;
    const torch: MapTorch = { id: randomUUID(), ...parseMapTorch(payload) };
    requirePointsInFrame(store, [{ x: torch.col, y: torch.row }]);
    requirePlace(torch.style, torch, battle.walls);
    if (battle.torches.length >= LIMITS.mapTorches) fail("Limite de {n} tochas no mapa: apague algumas.", { n: LIMITS.mapTorches });
    battle.torches.push(torch);
    return [torch.id];
  },

  "maptorch:move": (store, player, payload) => {
    requireGm(player);
    const torch = store.game.battle.torches.find((t) => t.id === payload?.id) ?? fail("Tocha não encontrada.");
    const next = spot(payload as unknown as Record<string, unknown>);
    requirePointsInFrame(store, [{ x: next.col, y: next.row }]);
    requirePlace(torch.style, next, store.game.battle.walls);
    const facing = torch.style === "sconce" && payload.facing !== undefined ? facingOf(payload.facing) : torch.facing;
    Object.assign(torch, next, facing === undefined ? {} : { facing });
  },

  "maptorch:remove": (store, player, payload) => {
    requireGm(player);
    const { battle } = store.game;
    const torch = battle.torches.find((t) => t.id === payload?.id) ?? fail("Tocha não encontrada.");
    battle.torches = battle.torches.filter((t) => t !== torch);
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
