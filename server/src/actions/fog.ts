import { cellsToRects, footprint, LIMITS, paintFog, roomCells, sizeSpan, type FogRect, type FogState } from "@rpg/shared";
import { forgetSight } from "../sight";
import { fail, requireInt } from "../validate";
import type { Store } from "../store";
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

/** Cobriu: as marcas de "visto por último" que ficaram embaixo somem, e quem sumiu agora não deixa marca. */
function covered(store: Store, fog: FogState, rects: FogRect[]) {
  const inside = (col: number, row: number) => rects.some((r) => col >= r.col && col < r.col + r.w && row >= r.row && row < r.row + r.h);
  fog.lastSeen = fog.lastSeen.filter((m) => {
    for (let dc = 0; dc < m.span; dc++) for (let dr = 0; dr < m.span; dr++) if (inside(m.pos.col + dc, m.pos.row + dr)) return false;
    return true;
  });
  // NPC que ficou embaixo é esquecido (se alguém ainda o vê, a visão encontra de novo).
  const npcs = store.game.battle.npcs;
  fog.foundNpcs = fog.foundNpcs.filter((id) => {
    const pos = npcs.find((c) => c.id === id)?.pos;
    if (!pos) return true;
    return !footprint(pos, sizeSpan(npcs.find((c) => c.id === id)?.size)).some((p) => inside(p.col, p.row));
  });
  forgetSight(store);
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
    if (!payload.reveal) covered(store, store.game.battle.fog, rects);
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
    const rects = cellsToRects(cells);
    for (const r of rects) paintFog(battle.fog, r, payload.reveal);
    if (!payload.reveal) covered(store, battle.fog, rects);
  },

  "fog:vision": (store, player, payload) => {
    requireGm(player);
    if (typeof payload?.enabled !== "boolean") fail("Informe se a visão dos personagens fica ligada.");
    store.game.battle.fog.vision = payload.enabled;
  },

  "fog:range": (store, player, payload) => {
    requireGm(player);
    const feet = payload?.feet === null ? null : requireInt(payload?.feet, "Alcance", LIMITS.visionFeet.min, LIMITS.visionFeet.max);
    store.game.battle.fog.range = feet;
    forgetSight(store);
  },

  "fog:reset": (store, player) => {
    requireGm(player);
    store.game.battle.fog.revealed = {};
    store.game.battle.fog.explored = {};
    store.game.battle.fog.lastSeen = [];
    store.game.battle.fog.foundNpcs = [];
    // Quem sumiu porque o mapa foi coberto não deixa "?" (antes era preciso cobrir duas vezes).
    forgetSight(store);
  },
};
