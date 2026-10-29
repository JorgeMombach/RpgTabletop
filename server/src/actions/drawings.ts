import { randomUUID } from "node:crypto";
import { DRAWING_KINDS, LIMITS, isColor, type Drawing, type DrawingKind } from "@rpg/shared";
import { eraseDrawing, pathOf } from "../erase";
import type { ServerPlayer } from "../store";
import { fail, requireInt, requireNumber } from "../validate";
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

/** O que cada um pode apagar: o mestre, tudo; o jogador, as próprias setas. */
function erasable(player: ServerPlayer, d: Drawing): boolean {
  return player.role === "gm" || d.authorId === player.id;
}

export const drawingHandlers: HandlerMap = {
  "draw:add": (store, player, payload) => {
    const { battle } = store.game;
    const gm = player.role === "gm";
    const drawing: Drawing = { id: randomUUID(), ...parseDrawing(payload) };
    if (!gm) {
      // Jogador: só setas, à vista de todos, com a marca de quem desenhou.
      if (drawing.kind !== "arrow") fail("Jogadores desenham só setas.");
      delete drawing.hidden;
      drawing.authorId = player.id;
      // Passou do limite: a seta mais antiga dele some.
      const mine = battle.drawings.filter((d) => d.authorId === player.id);
      if (mine.length >= LIMITS.playerArrows) battle.drawings = battle.drawings.filter((d) => d !== mine[0]);
    }
    if (battle.drawings.length >= LIMITS.drawings) fail("Limite de {n} desenhos no mapa: apague alguns.", { n: LIMITS.drawings });
    battle.drawings.push(drawing);
    return [drawing.id];
  },

  "draw:remove": (store, player, payload) => {
    const { battle } = store.game;
    const drawing = battle.drawings.find((d) => d.id === payload?.id) ?? fail("Desenho não encontrado.");
    if (!erasable(player, drawing)) fail("Você só apaga as suas setas.");
    battle.drawings = battle.drawings.filter((d) => d !== drawing);
  },

  "draw:clear": (store, player) => {
    const { battle } = store.game;
    battle.drawings = player.role === "gm" ? [] : battle.drawings.filter((d) => d.authorId !== player.id);
  },

  "draw:erase": (store, player, payload) => {
    const raw = payload?.points;
    const coord = (n: unknown) => typeof n === "number" && Number.isFinite(n) && Math.abs(n) <= LIMITS.drawingCoord;
    if (!Array.isArray(raw) || raw.length < 2 || raw.length % 2 !== 0 || raw.length > LIMITS.eraserNumbers || !raw.every(coord)) fail("Caminho da borracha inválido.");
    const radius = requireNumber(payload.radius, "Tamanho da borracha", LIMITS.eraserRadius.min, LIMITS.eraserRadius.max);
    const path = pathOf(raw);
    const { battle } = store.game;
    const out: Drawing[] = [];
    for (const d of battle.drawings) {
      const left = erasable(player, d) ? eraseDrawing(d, path, radius, LIMITS.drawingNumbers) : null;
      if (left === null) out.push(d);
      // Os pedaços continuam o mesmo desenho (cor, espessura, oculto, autor), com ids novos.
      else for (const points of left) out.push({ ...d, id: randomUUID(), points });
    }
    if (out.length > LIMITS.drawings) fail("Limite de {n} desenhos no mapa: apague alguns.", { n: LIMITS.drawings });
    battle.drawings = out;
  },
};
