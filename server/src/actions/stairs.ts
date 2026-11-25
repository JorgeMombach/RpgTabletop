import { randomBytes } from "node:crypto";
import { LIMITS, STAIR_MATERIALS, STAIR_SHAPES, stairPath, type BridgeWidth, type LightPoint, type Stair, type StairMaterial, type StairShape } from "@rpg/shared";
import { fail } from "../validate";
import { requireGm } from "./combatants";
import type { HandlerMap } from "./types";
import { requirePointsInFrame } from "./frameRule";

/** Id curto (8 caracteres), como as pontes: o estado vai inteiro a cada ação. */
const newId = () => randomBytes(6).toString("base64url");

const isShape = (raw: unknown): raw is StairShape => STAIR_SHAPES.some((shape) => shape === raw);
const isMaterial = (raw: unknown): raw is StairMaterial => STAIR_MATERIALS.some((material) => material === raw);
const isWidth = (raw: unknown): raw is BridgeWidth => raw === 1 || raw === 2 || raw === 3;
const isExit = (raw: unknown): raw is Stair["exit"] => raw === "up" || raw === "down";

/** Ponto da escada em casas, em centésimos. */
function pointOf(raw: unknown): LightPoint {
  const coord = (value: unknown): value is number => typeof value === "number" && Number.isFinite(value) && Math.abs(value) <= LIMITS.gridCoord;
  if (typeof raw !== "object" || raw === null || !("x" in raw) || !("y" in raw) || !coord(raw.x) || !coord(raw.y)) fail("Escada inválida.");
  return { x: Math.round(raw.x * 100) / 100, y: Math.round(raw.y * 100) / 100 };
}

/** Confere o comprimento (do caminho, com as viradas; ou de ponta a ponta na escada de mão). */
function checkLength(length: number, limits: { min: number; max: number }) {
  if (length < limits.min) fail("Escada curta demais.");
  if (length > limits.max) fail("Escada longa demais (máximo de {n} casas).", { n: limits.max });
}

/**
 * Valida uma escada inteira (do mestre ou do arquivo de sessão), sem o id. Caminho: 2 a 16 pontos, de 1 a 40 casas;
 * caracol: centro e borda (em lugares diferentes); de mão: pé e topo, de 1 a 4 casas, sempre de madeira e largura 1.
 */
export function parseStair(raw: unknown): Omit<Stair, "id"> {
  if (typeof raw !== "object" || raw === null) fail("Escada inválida.");
  const shape = "shape" in raw ? raw.shape : undefined;
  const material = "material" in raw ? raw.material : undefined;
  const width = "width" in raw ? raw.width : undefined;
  const exit = "exit" in raw ? raw.exit : undefined;
  const rawPoints = "points" in raw ? raw.points : undefined;
  if (!isShape(shape) || !isMaterial(material) || !isWidth(width) || !isExit(exit) || !Array.isArray(rawPoints)) fail("Escada inválida.");
  const count = rawPoints.length;
  if (shape === "path" ? count < 2 || count > LIMITS.stairPoints : count !== 2) fail("Escada inválida.");
  const points = rawPoints.map(pointOf);
  if (shape === "path") {
    checkLength(stairPath(points).length, LIMITS.stairLength);
    return { shape, points, width, material, exit };
  }
  const [first, second] = points;
  const span = Math.hypot(second.x - first.x, second.y - first.y);
  if (shape === "spiral") {
    // a borda só dá a direção do primeiro degrau: precisa estar fora do centro
    if (span <= 0) fail("Escada inválida.");
    return { shape, points, width, material, exit };
  }
  checkLength(span, LIMITS.ladderLength);
  return { shape, points, width: 1, material: "wood", exit };
}

function findStair(stairs: Stair[], id: unknown): Stair {
  return stairs.find((stair) => stair.id === id) ?? fail("Escada não encontrada.");
}

export const stairHandlers: HandlerMap = {
  "stair:add": (store, player, payload) => {
    requireGm(player);
    const { battle } = store.game;
    const stair: Stair = { id: newId(), ...parseStair(payload) };
    requirePointsInFrame(store, stair.points);
    if (battle.stairs.length >= LIMITS.stairs) fail("Limite de escadas da cena atingido.");
    battle.stairs.push(stair);
    return [stair.id];
  },

  "stair:update": (store, player, payload) => {
    requireGm(player);
    const stair = findStair(store.game.battle.stairs, payload?.id);
    // Confere tudo (com o resultado inteiro) antes de mudar.
    const next = parseStair({
      shape: payload.shape ?? stair.shape,
      points: payload.points ?? stair.points,
      width: payload.width ?? stair.width,
      material: payload.material ?? stair.material,
      exit: payload.exit ?? stair.exit,
    });
    requirePointsInFrame(store, next.points);
    Object.assign(stair, next);
  },

  "stair:remove": (store, player, payload) => {
    requireGm(player);
    const ids = payload?.ids;
    if (!Array.isArray(ids) || !ids.every((id) => typeof id === "string")) fail("Escada inválida.");
    const removing = new Set<string>(ids);
    store.game.battle.stairs = store.game.battle.stairs.filter((stair) => !removing.has(stair.id));
  },
};
