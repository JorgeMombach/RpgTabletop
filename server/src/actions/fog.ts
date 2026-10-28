import { cellsToRects, LIMITS, paintFog, roomCells, type FogRect } from "@rpg/shared";
import { fail, requireInt } from "../validate";
import { requireGm } from "./combatants";
import type { HandlerMap } from "./types";

function fogRect(raw: unknown): FogRect {
  if (typeof raw !== "object" || raw === null) fail("Área da névoa inválida.");
  const r = raw as Record<string, unknown>;
  const lim = LIMITS.gridCoord;
  const side = LIMITS.fogRectSide;
  return {
    col: requireInt(r.col, "Coluna", -lim, lim),
    row: requireInt(r.row, "Linha", -lim, lim),
    w: requireInt(r.w, "Largura", 1, side),
    h: requireInt(r.h, "Altura", 1, side),
  };
}

/** Névoa de guerra (G): o mestre liga, revela e cobre partes do mapa da cena. */
export const fogHandlers: HandlerMap = {
  "fog:set": (store, player, payload) => {
    requireGm(player);
    if (typeof payload?.enabled !== "boolean") fail("Informe se a névoa fica ligada.");
    store.game.battle.fog.enabled = payload.enabled;
  },

  "fog:paint": (store, player, payload) => {
    requireGm(player);
    if (typeof payload?.reveal !== "boolean") fail("Informe se é para revelar ou cobrir.");
    if (!Array.isArray(payload.rects) || payload.rects.length === 0) fail("Nada para pintar.");
    if (payload.rects.length > LIMITS.fogRects) fail("Pincelada grande demais: pinte em partes.");
    // Valida tudo antes de pintar.
    const rects = payload.rects.map(fogRect);
    for (const r of rects) paintFog(store.game.battle.fog, r, payload.reveal);
  },

  "fog:room": (store, player, payload) => {
    requireGm(player);
    if (typeof payload?.reveal !== "boolean") fail("Informe se é para revelar ou cobrir.");
    const raw = (payload.cell ?? {}) as unknown as Record<string, unknown>;
    const lim = LIMITS.gridCoord;
    const cell = { col: requireInt(raw.col, "Coluna", -lim, lim), row: requireInt(raw.row, "Linha", -lim, lim) };
    const { battle } = store.game;
    const cells = roomCells(cell, battle.walls, LIMITS.fogRoom);
    if (!cells) fail("Essa área não está fechada por paredes e portas: feche o cômodo ou use o pincel ou o retângulo.");
    for (const r of cellsToRects(cells)) paintFog(battle.fog, r, payload.reveal);
  },

  "fog:reset": (store, player) => {
    requireGm(player);
    store.game.battle.fog.revealed = {};
  },
};
