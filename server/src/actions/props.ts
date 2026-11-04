import { randomBytes } from "node:crypto";
import { LIMITS, PROP_DEFAULTS, PROP_KINDS, type MapProp, type PropKind } from "@rpg/shared";
import { fail, requireNumber } from "../validate";
import { requireGm } from "./combatants";
import type { HandlerMap } from "./types";

/**
 * Id curto (8 caracteres): o estado vai inteiro a cada ação, e com centenas de objetos o UUID era quase metade do
 * peso. Até 800 por cena, repetir é desprezível.
 */
const newId = () => randomBytes(6).toString("base64url");

/** Ponto em casas, em centésimos (como as tochas). */
function coord(raw: unknown): number {
  if (typeof raw !== "number" || !Number.isFinite(raw) || Math.abs(raw) > LIMITS.gridCoord) fail("Lugar do objeto inválido.");
  return Math.round(raw * 100) / 100;
}

const sizeOf = (raw: unknown) => Math.round(requireNumber(raw, "Tamanho do objeto", LIMITS.propSize.min, LIMITS.propSize.max) * 100) / 100;
/** Giro em graus inteiros, de 0 a 359. */
const rotationOf = (raw: unknown) => ((Math.round(requireNumber(raw, "Giro do objeto", -3600, 3600)) % 360) + 360) % 360;
/** Versões sorteadas de cada objeto: 65 mil bastam e o número fica curto (o estado vai inteiro a cada ação). */
const PROP_SEEDS = 2 ** 16;
const seedOf = (raw: unknown) => Math.round(requireNumber(raw, "Variação do objeto", 0, 2 ** 31 - 1));

function flag(raw: unknown): boolean {
  if (typeof raw !== "boolean") fail("Valor inválido.");
  return raw;
}

/** Valida um objeto inteiro (do mestre ou do arquivo de sessão), sem o id. */
export function parseProp(raw: unknown): Omit<MapProp, "id"> {
  const p = (raw ?? {}) as Record<string, unknown>;
  if (!PROP_KINDS.includes(p.kind as PropKind)) fail("Objeto inválido.");
  const kind = p.kind as PropKind;
  return {
    kind,
    col: coord(p.col),
    row: coord(p.row),
    size: p.size === undefined ? 1 : sizeOf(p.size),
    rotation: p.rotation === undefined ? 0 : rotationOf(p.rotation),
    seed: p.seed === undefined ? Math.floor(Math.random() * PROP_SEEDS) : seedOf(p.seed),
    above: p.above === undefined ? PROP_DEFAULTS[kind].above : flag(p.above),
    blocks: p.blocks === undefined ? PROP_DEFAULTS[kind].blocks : flag(p.blocks),
  };
}

function findProp(props: MapProp[], id: unknown): MapProp {
  return props.find((p) => p.id === id) ?? fail("Objeto não encontrado.");
}

export const propHandlers: HandlerMap = {
  "prop:add": (store, player, payload) => {
    requireGm(player);
    const { battle } = store.game;
    const prop: MapProp = { id: newId(), ...parseProp(payload) };
    if (battle.props.length >= LIMITS.props) fail("Limite de {n} objetos no mapa.", { n: LIMITS.props });
    battle.props.push(prop);
    return [prop.id];
  },

  "prop:addMany": (store, player, payload) => {
    requireGm(player);
    const { battle } = store.game;
    const items = payload?.items;
    if (!Array.isArray(items) || items.length === 0 || items.length > LIMITS.props) fail("Objeto inválido.");
    // Confere todos antes de pôr algum.
    const added: MapProp[] = items.map((it) => ({ id: newId(), ...parseProp(it) }));
    if (battle.props.length + added.length > LIMITS.props) fail("Limite de {n} objetos no mapa.", { n: LIMITS.props });
    battle.props.push(...added);
    return added.map((p) => p.id);
  },

  "prop:update": (store, player, payload) => {
    requireGm(player);
    const prop = findProp(store.game.battle.props, payload?.id);
    // Confere tudo antes de mudar.
    const next: Partial<MapProp> = {};
    if (payload.col !== undefined) next.col = coord(payload.col);
    if (payload.row !== undefined) next.row = coord(payload.row);
    if (payload.size !== undefined) next.size = sizeOf(payload.size);
    if (payload.rotation !== undefined) next.rotation = rotationOf(payload.rotation);
    if (payload.seed !== undefined) next.seed = seedOf(payload.seed);
    if (payload.above !== undefined) next.above = flag(payload.above);
    if (payload.blocks !== undefined) next.blocks = flag(payload.blocks);
    Object.assign(prop, next);
  },

  "prop:remove": (store, player, payload) => {
    requireGm(player);
    const { battle } = store.game;
    const ids = payload?.ids;
    if (!Array.isArray(ids) || ids.length === 0 || ids.length > LIMITS.props) fail("Objeto não encontrado.");
    const gone = new Set(ids.map((id) => findProp(battle.props, id).id));
    battle.props = battle.props.filter((p) => !gone.has(p.id));
  },
};
