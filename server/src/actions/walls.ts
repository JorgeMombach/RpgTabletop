import { randomUUID } from "node:crypto";
import { LIMITS, WALL_THICKNESS, type Door, type GridPos, type Wall } from "@rpg/shared";
import { eraseWall, pathOf } from "../erase";
import { fail, requireNumber } from "../validate";
import { requireGm } from "./combatants";
import type { HandlerMap } from "./types";

/**
 * Ponta da parede, em casas do grid: inteira no canto (traço "nos cantos") ou fracionada (traço livre, L5),
 * guardada em centésimos de casa.
 */
function corner(raw: unknown): GridPos {
  const p = raw as GridPos | undefined;
  const ok = (n: unknown) => typeof n === "number" && Number.isFinite(n) && Math.abs(n) <= LIMITS.gridCoord;
  if (!p || !ok(p.col) || !ok(p.row)) fail("Ponta da parede inválida.");
  const cent = (n: number) => Math.round(n * 100) / 100;
  return { col: cent(p.col), row: cent(p.row) };
}

/** Valida as pontas e a porta de uma parede (do mestre ou do arquivo de sessão), sem o id. */
export function parseWall(raw: unknown): Omit<Wall, "id"> {
  const w = (raw ?? {}) as Record<string, unknown>;
  const from = corner(w.from);
  const to = corner(w.to);
  const len = Math.max(Math.abs(to.col - from.col), Math.abs(to.row - from.row));
  // Menos de um décimo de casa: foi um clique, não um traço.
  if (len < 0.1) fail("Parede curta demais: arraste de uma ponta à outra.");
  if (len > LIMITS.wallLength) fail("Parede longa demais (máximo de {n} casas): trace em partes.", { n: LIMITS.wallLength });
  const out: Omit<Wall, "id"> = { from, to };
  if (w.thickness !== undefined) {
    const { min, max } = WALL_THICKNESS;
    const t = requireNumber(w.thickness, "Espessura da parede", min, max);
    // Em centésimos de casa; a espessura padrão fica sem campo.
    const cent = Math.round(t * 100) / 100;
    if (cent !== WALL_THICKNESS.default) out.thickness = cent;
  }
  if (w.door !== undefined) {
    const d = w.door as Partial<Door>;
    if (typeof d !== "object" || d === null || typeof d.open !== "boolean") fail("Porta inválida.");
    out.door = { open: d.open };
    if (d.locked === true) out.door.locked = true;
    if (d.secret === true) out.door.secret = true;
  }
  return out;
}

function findWall(walls: Wall[], id: unknown): Wall {
  return walls.find((w) => w.id === id) ?? fail("Parede não encontrada.");
}

export const wallHandlers: HandlerMap = {
  "wall:add": (store, player, payload) => {
    requireGm(player);
    const { battle } = store.game;
    const wall: Wall = { id: randomUUID(), ...parseWall({ from: payload?.from, to: payload?.to, thickness: payload?.thickness }) };
    if (payload.door === true) wall.door = { open: false };
    if (battle.walls.length >= LIMITS.walls) fail("Limite de {n} paredes e portas no mapa.", { n: LIMITS.walls });
    battle.walls.push(wall);
    return [wall.id];
  },

  "wall:remove": (store, player, payload) => {
    requireGm(player);
    const { battle } = store.game;
    const wall = findWall(battle.walls, payload?.id);
    battle.walls = battle.walls.filter((w) => w !== wall);
  },

  "wall:erase": (store, player, payload) => {
    requireGm(player);
    const raw = payload?.points;
    const coord = (n: unknown) => typeof n === "number" && Number.isFinite(n) && Math.abs(n) <= LIMITS.gridCoord;
    if (!Array.isArray(raw) || raw.length < 2 || raw.length % 2 !== 0 || raw.length > LIMITS.eraserNumbers || !raw.every(coord)) fail("Caminho da borracha inválido.");
    const { min, max } = LIMITS.wallEraserRadius;
    const radius = requireNumber(payload.radius, "Tamanho da borracha", min, max);
    const path = pathOf(raw);
    const { battle } = store.game;
    const out: Wall[] = [];
    const ids: string[] = [];
    for (const w of battle.walls) {
      const left = eraseWall(w, path, radius);
      if (left === null) {
        out.push(w);
        continue;
      }
      // Os trechos que sobram continuam a parede (mesma espessura), com ids novos.
      for (const part of left) {
        const piece: Wall = { id: randomUUID(), ...part, ...(w.thickness !== undefined && { thickness: w.thickness }) };
        out.push(piece);
        ids.push(piece.id);
      }
    }
    if (out.length > LIMITS.walls) fail("Limite de {n} paredes e portas no mapa.", { n: LIMITS.walls });
    battle.walls = out;
    return ids;
  },

  "wall:clear": (store, player) => {
    requireGm(player);
    store.game.battle.walls = [];
  },

  "door:set": (store, player, payload) => {
    const door = findWall(store.game.battle.walls, payload?.id).door ?? fail("Isso é uma parede, não uma porta.");
    const gm = player.role === "gm";
    const flags = ["open", "locked", "secret"] as const;
    for (const k of flags) if (payload[k] !== undefined && typeof payload[k] !== "boolean") fail("Valor inválido.");
    if (!gm) {
      // Jogador só abre e fecha, e só a porta que ele vê e que não está trancada.
      if (door.secret) fail("Parede não encontrada.");
      if (payload.locked !== undefined || payload.secret !== undefined) fail("Só o mestre tranca ou esconde portas.");
      if (door.locked) fail("A porta está trancada.");
    }
    if (payload.open !== undefined) door.open = payload.open;
    if (payload.locked !== undefined) {
      if (payload.locked) door.locked = true;
      else delete door.locked;
    }
    if (payload.secret !== undefined) {
      if (payload.secret) door.secret = true;
      else delete door.secret;
    }
  },
};
