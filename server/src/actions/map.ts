import { LIMITS, type GridPos } from "@rpg/shared";
import { allCombatants, resetCombat } from "../combat";
import { fail, requireImage, requireInt, requireNumber } from "../validate";
import { defaultWeather } from "../weather";
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

/** Rotação em passos de 90° (E17); qualquer múltiplo de 90 vira 0–270. */
function rotationOf(raw: unknown): number {
  if (typeof raw !== "number" || !Number.isInteger(raw) || raw % 90 !== 0) fail("Rotação: use passos de 90°.");
  return ((raw % 360) + 360) % 360;
}

export const mapHandlers: HandlerMap = {
  "battle:setMap": (store, player, payload) => {
    requireGm(player);
    const map = store.game.battle.map;
    map.image = payload?.image === null ? null : requireImage(payload?.image, "Mapa", LIMITS.mapImageChars);
    // Imagem nova começa sem rotação e no tamanho original.
    Object.assign(map, { rotation: 0, imageScale: 1 });
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
    const rotation = input.rotation !== undefined ? rotationOf(input.rotation) : map.rotation;
    const { min: sMin, max: sMax } = LIMITS.imageScale;
    const imageScale = input.imageScale !== undefined ? requireNumber(input.imageScale, "Escala do mapa", sMin, sMax) : map.imageScale;

    // Offset normalizado para [0, cellPx): mesmo grid, números mais previsíveis.
    const norm = (v: number) => Math.round((((v % cellPx) + cellPx) % cellPx) * 100) / 100;
    Object.assign(map, {
      cellPx: Math.round(cellPx * 100) / 100,
      offsetX: norm(offsetX),
      offsetY: norm(offsetY),
      rotation,
      imageScale: Math.round(imageScale * 1000) / 1000,
    });
    if (typeof input.showGrid === "boolean") map.showGrid = input.showGrid;
  },

  "battle:clear": (store, player, payload) => {
    requireGm(player);
    const { game } = store;
    const { battle } = game;
    // Grid continua: a próxima batalha costuma usar mapas na mesma escala.
    Object.assign(battle.map, { image: null, rotation: 0, imageScale: 1 });
    battle.map.imageVersion++;
    battle.mobs = [];
    battle.npcs = [];
    battle.effects = [];
    // Cena nova: sem clima, de dia (E26).
    battle.weather = defaultWeather();
    resetCombat(store);
    // Conjurados são da batalha: até os dos jogadores somem (E21).
    game.allies = game.allies.filter((a) => !a.summonerId);
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
    const pos = gridPosOf(payload.pos);
    // Dois corpos não ocupam a mesma casa. Para o jogador, um oculto não conta: a recusa entregaria
    // que há alguém ali (E21). O mestre separa os dois quando revelar.
    const other =
      pos &&
      allCombatants(store).find(
        (o) => o.id !== c.id && o.pos?.col === pos.col && o.pos?.row === pos.row && (player.role === "gm" || !o.hidden),
      );
    if (other) fail(`Essa casa já está ocupada por ${other.name}.`);
    c.pos = pos;
  },
};
