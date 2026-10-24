import { LIMITS, type GridPos } from "@rpg/shared";
import { resetCombat } from "../combat";
import { fail, requireImage, requireInt, requireNumber } from "../validate";
import { editable, requireGm } from "./combatants";
import type { HandlerMap } from "./types";

function gridPosOf(raw: unknown): GridPos | null {
  if (raw === null) return null;
  const p = raw as GridPos | undefined;
  if (typeof p !== "object" || !p) fail("Posição inválida.");
  if (!Number.isInteger(p.col) || !Number.isInteger(p.row)) fail("Posição inválida.");
  const lim = LIMITS.gridCoord;
  return {
    col: requireInt(p.col, "Coluna", -lim, lim),
    row: requireInt(p.row, "Linha", -lim, lim),
  };
}

export const mapHandlers: HandlerMap = {
  "battle:setMap": (store, player, payload) => {
    requireGm(player);
    const map = store.game.battle.map;
    map.image = payload?.image === null ? null : requireImage(payload?.image, "Mapa", LIMITS.mapImageChars);
    // A versão faz o servidor reenviar a imagem (evento `map:image`) só quando muda.
    map.imageVersion++;
  },

  "battle:grid": (store, player, input) => {
    requireGm(player);
    const map = store.game.battle.map;
    const { min, max } = LIMITS.cellPx;
    const cellPx = input?.cellPx !== undefined ? requireNumber(input.cellPx, "Tamanho do quadrado", min, max) : map.cellPx;
    const off = (raw: unknown, label: string, current: number) =>
      raw !== undefined ? requireNumber(raw, label, -max, max) : current;
    const offsetX = off(input.offsetX, "Deslocamento X", map.offsetX);
    const offsetY = off(input.offsetY, "Deslocamento Y", map.offsetY);

    // Offset normalizado para [0, cellPx): mesmo grid, números mais previsíveis.
    const norm = (v: number) => Math.round((((v % cellPx) + cellPx) % cellPx) * 100) / 100;
    Object.assign(map, { cellPx: Math.round(cellPx * 100) / 100, offsetX: norm(offsetX), offsetY: norm(offsetY) });
    if (typeof input.showGrid === "boolean") map.showGrid = input.showGrid;
  },

  "battle:clear": (store, player, payload) => {
    requireGm(player);
    const { game } = store;
    const { battle } = game;
    // Grid continua: a próxima batalha costuma usar mapas na mesma escala.
    battle.map.image = null;
    battle.map.imageVersion++;
    battle.mobs = [];
    battle.npcs = [];
    resetCombat(store);
    for (const a of game.allies) {
      a.pos = null;
      a.initiative = a.initRoll = null;
    }
    if (!payload?.keepTemplates) game.templates = [];
    store.removedMobs.clear();
    // Numeração dos mobs recomeça em "Goblin 1" na batalha nova.
    store.mobCounters.clear();
  },

  "token:move": (store, player, payload) => {
    // Movimento livre: sem limite de deslocamento (ADR-06); só a permissão importa.
    const c = editable(store, player, payload?.id);
    c.pos = gridPosOf(payload.pos);
  },
};
