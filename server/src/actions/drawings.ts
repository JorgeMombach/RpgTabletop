import { randomUUID } from "node:crypto";
import { DRAWING_KINDS, LIMITS, isColor, type Drawing, type DrawingKind } from "@rpg/shared";
import { fail, requireInt } from "../validate";
import { requireGm } from "./combatants";
import type { HandlerMap } from "./types";

/** Valida um desenho (do mestre ou do arquivo de sessão), sem o id. */
export function parseDrawing(raw: unknown): Omit<Drawing, "id"> {
  const d = (raw ?? {}) as Record<string, unknown>;
  const kind = DRAWING_KINDS.includes(d.kind as DrawingKind) ? (d.kind as DrawingKind) : fail("Tipo de desenho desconhecido.");
  const points = d.points;
  const coord = (n: unknown) => typeof n === "number" && Number.isFinite(n) && Math.abs(n) <= LIMITS.drawingCoord;
  if (!Array.isArray(points) || points.length % 2 !== 0 || !points.every(coord)) fail("Desenho inválido.");
  // Seta e círculo: começo e fim. Traço: pelo menos dois pontos.
  if (kind === "free" ? points.length < 4 : points.length !== 4) fail("Desenho inválido.");
  if (points.length > LIMITS.drawingNumbers) fail("Traço longo demais: desenhe em partes.");
  if (!isColor(d.color)) fail("Cor inválida.");
  const { min, max } = LIMITS.drawingWidth;
  const out: Omit<Drawing, "id"> = {
    kind,
    // Meio pixel basta: o arquivo e o estado ficam menores.
    points: points.map((n: number) => Math.round(n * 2) / 2),
    color: d.color,
    width: requireInt(d.width, "Espessura", min, max),
  };
  if (d.hidden === true) out.hidden = true;
  return out;
}

export const drawingHandlers: HandlerMap = {
  "draw:add": (store, player, payload) => {
    requireGm(player);
    const { battle } = store.game;
    const drawing = { id: randomUUID(), ...parseDrawing(payload) };
    if (battle.drawings.length >= LIMITS.drawings) fail("Limite de {n} desenhos no mapa: apague alguns.", { n: LIMITS.drawings });
    battle.drawings.push(drawing);
    return [drawing.id];
  },

  "draw:remove": (store, player, payload) => {
    requireGm(player);
    const { battle } = store.game;
    if (!battle.drawings.some((d) => d.id === payload?.id)) fail("Desenho não encontrado.");
    battle.drawings = battle.drawings.filter((d) => d.id !== payload.id);
  },

  "draw:clear": (store, player) => {
    requireGm(player);
    store.game.battle.drawings = [];
  },
};
