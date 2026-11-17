import { randomUUID } from "node:crypto";
import { LIMITS, type WaterCurrent } from "@rpg/shared";
import { fail } from "../validate";
import { requireGm } from "./combatants";
import type { HandlerMap } from "./types";

/**
 * Linha de correnteza (água animada, docs/design/agua.md), do mestre ou do arquivo de sessão, sem o id: pares x, y em
 * casas, no sentido em que a água corre, pelo menos dois pontos. Guardada em centésimos de casa.
 */
export function parseCurrent(raw: unknown): Omit<WaterCurrent, "id"> {
  const points = typeof raw === "object" && raw !== null && "points" in raw ? raw.points : undefined;
  const coord = (value: unknown) => typeof value === "number" && Number.isFinite(value) && Math.abs(value) <= LIMITS.gridCoord;
  if (!Array.isArray(points) || points.length < 4 || points.length % 2 !== 0) fail("Correnteza inválida.");
  if (points.length > LIMITS.currentNumbers) fail("Correnteza longa demais: risque em partes.");
  if (!points.every(coord)) fail("Correnteza inválida.");
  return { points: points.map((value: number) => Math.round(value * 100) / 100) };
}

export const currentHandlers: HandlerMap = {
  "current:add": (store, player, payload) => {
    requireGm(player);
    const { battle } = store.game;
    const current: WaterCurrent = { id: randomUUID(), ...parseCurrent(payload) };
    if (battle.currents.length >= LIMITS.currents) fail("Limite de correntezas da cena atingido.");
    battle.currents.push(current);
    return [current.id];
  },

  "current:remove": (store, player, payload) => {
    requireGm(player);
    const ids = payload?.ids;
    if (!Array.isArray(ids) || !ids.every((id) => typeof id === "string")) fail("Correnteza inválida.");
    const removing = new Set<string>(ids);
    store.game.battle.currents = store.game.battle.currents.filter((current) => !removing.has(current.id));
  },
};
