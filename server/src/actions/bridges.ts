import { randomBytes } from "node:crypto";
import { BRIDGE_KINDS, bridgeLength, LIMITS, type Bridge, type BridgeKind, type BridgeWidth } from "@rpg/shared";
import { fail } from "../validate";
import { requireGm } from "./combatants";
import type { HandlerMap } from "./types";
import { requirePointsInFrame } from "./frameRule";

/** Id curto (8 caracteres), como os objetos: o estado vai inteiro a cada ação. */
const newId = () => randomBytes(6).toString("base64url");

const isKind = (raw: unknown): raw is BridgeKind => BRIDGE_KINDS.some((kind) => kind === raw);
const isWidth = (raw: unknown): raw is BridgeWidth => raw === 1 || raw === 2 || raw === 3;

/** Ponta da ponte em casas, em centésimos. */
function endOf(raw: unknown): { x: number; y: number } {
  const coord = (value: unknown): value is number => typeof value === "number" && Number.isFinite(value) && Math.abs(value) <= LIMITS.gridCoord;
  if (typeof raw !== "object" || raw === null || !("x" in raw) || !("y" in raw) || !coord(raw.x) || !coord(raw.y)) fail("Ponte inválida.");
  return { x: Math.round(raw.x * 100) / 100, y: Math.round(raw.y * 100) / 100 };
}

/** Confere o comprimento de ponta a ponta. */
function checkLength(bridge: Pick<Bridge, "from" | "to">) {
  const length = bridgeLength(bridge);
  if (length < LIMITS.bridgeLength.min) fail("Ponte curta demais: arraste de uma margem à outra.");
  if (length > LIMITS.bridgeLength.max) fail("Ponte longa demais (máximo de {n} casas).", { n: LIMITS.bridgeLength.max });
}

/** Valida uma ponte inteira (do mestre ou do arquivo de sessão), sem o id. */
export function parseBridge(raw: unknown): Omit<Bridge, "id"> {
  if (typeof raw !== "object" || raw === null) fail("Ponte inválida.");
  const kind = "kind" in raw ? raw.kind : undefined;
  const width = "width" in raw ? raw.width : undefined;
  if (!isKind(kind) || !isWidth(width)) fail("Ponte inválida.");
  const bridge = { from: endOf("from" in raw ? raw.from : undefined), to: endOf("to" in raw ? raw.to : undefined), width, kind };
  checkLength(bridge);
  return bridge;
}

function findBridge(bridges: Bridge[], id: unknown): Bridge {
  return bridges.find((bridge) => bridge.id === id) ?? fail("Ponte não encontrada.");
}

export const bridgeHandlers: HandlerMap = {
  "bridge:add": (store, player, payload) => {
    requireGm(player);
    const { battle } = store.game;
    const bridge: Bridge = { id: newId(), ...parseBridge(payload) };
    requirePointsInFrame(store, [bridge.from, bridge.to]);
    if (battle.bridges.length >= LIMITS.bridges) fail("Limite de pontes da cena atingido.");
    battle.bridges.push(bridge);
    return [bridge.id];
  },

  "bridge:update": (store, player, payload) => {
    requireGm(player);
    const bridge = findBridge(store.game.battle.bridges, payload?.id);
    // Confere tudo (com o resultado inteiro) antes de mudar.
    const next = parseBridge({
      from: payload.from ?? bridge.from,
      to: payload.to ?? bridge.to,
      width: payload.width ?? bridge.width,
      kind: payload.kind ?? bridge.kind,
    });
    requirePointsInFrame(store, [next.from, next.to]);
    Object.assign(bridge, next);
  },

  "bridge:remove": (store, player, payload) => {
    requireGm(player);
    const ids = payload?.ids;
    if (!Array.isArray(ids) || !ids.every((id) => typeof id === "string")) fail("Ponte inválida.");
    const removing = new Set<string>(ids);
    store.game.battle.bridges = store.game.battle.bridges.filter((bridge) => !removing.has(bridge.id));
  },
};
