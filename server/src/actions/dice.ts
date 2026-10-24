import { randomUUID } from "node:crypto";
import { LIMITS, type LogEntry, type RollKind, type RollMode, type RollResult } from "@rpg/shared";
import { byId } from "../combat";
import { roll } from "../dice";
import type { ServerPlayer, Store } from "../store";
import { fail, requireString } from "../validate";
import { requireGm } from "./combatants";
import type { HandlerMap } from "./types";

const MODES: RollMode[] = ["normal", "adv", "dis"];
const KINDS: RollKind[] = ["attack", "damage"];

/**
 * Acrescenta ao log compartilhado (mantém só as últimas entradas). Com combate ativo,
 * marca o turno em que aconteceu, para o log agrupar ("Round 2 · Goblin 2").
 */
function pushLog(store: Store, entry: Omit<LogEntry, "id" | "ts">): string {
  const { log, battle } = store.game;
  const { combat } = battle;
  const current = combat.active ? byId(store, combat.order[combat.turnIndex]) : undefined;
  const id = randomUUID();
  log.push({
    id,
    ts: Date.now(),
    ...entry,
    turn: current ? { seq: combat.turn, round: combat.round, name: current.name } : undefined,
  });
  if (log.length > LIMITS.logSize) log.splice(0, log.length - LIMITS.logSize);
  return id;
}

/** Registra uma rolagem no log compartilhado. */
export function logRoll(
  store: Store,
  player: ServerPlayer,
  result: RollResult,
  opts: Pick<LogEntry, "hidden" | "label" | "as" | "kind" | "crit"> = {},
): string {
  return pushLog(store, {
    authorId: player.id,
    author: player.name,
    text: `${opts.label ? `${opts.label}: ` : ""}${result.expr} = ${result.total}`,
    hidden: opts.hidden || undefined,
    label: opts.label,
    as: opts.as,
    kind: opts.kind,
    crit: opts.crit || undefined,
    roll: result,
  });
}

/** Aviso da mesa no log (ex.: condição que acabou); o cliente também mostra como toast. */
export function logSystem(store: Store, text: string) {
  pushLog(store, { authorId: "system", author: "Mesa", text, system: true });
}

/** Reação aberta = usada neste turno (fecha sozinha quando o turno muda). */
function reactionOpen(store: Store, playerId: string): boolean {
  const { combat, rolls } = store.game.battle;
  return rolls.reactions.some((r) => r.playerId === playerId && r.turn === combat.turn);
}

/**
 * Com combate ativo, o jogador só rola na própria vez, num pedido do mestre ou na reação (SPEC E16).
 * Devolve o rótulo da rolagem fora da vez ("Resistência DES", "Reação"); consome o pedido.
 */
function outOfTurn(store: Store, player: ServerPlayer): string | undefined {
  const { combat, rolls } = store.game.battle;
  if (player.role === "gm" || !combat.active) return undefined;
  const current = byId(store, combat.order[combat.turnIndex]);
  if (current?.ownerId === player.id) return undefined;

  const req = rolls.request;
  if (req && req.playerIds.includes(player.id) && !req.done.includes(player.id)) {
    req.done.push(player.id);
    // Todos rolaram: o pedido acaba.
    if (req.done.length >= req.playerIds.length) rolls.request = null;
    return req.label;
  }
  if (reactionOpen(store, player.id)) return "Reação";
  fail("Não é a sua vez. Fora da vez, só com pedido do mestre (resistência) ou usando a Reação.");
}

export const diceHandlers: HandlerMap = {
  // Rolagem no servidor: um resultado único para todos (ADR-07).
  "dice:roll": (store, player, payload) => {
    const gm = player.role === "gm";
    const mode = MODES.includes(payload?.mode as RollMode) ? (payload.mode as RollMode) : "normal";
    const kind = KINDS.includes(payload?.kind as RollKind) ? (payload.kind as RollKind) : undefined;
    const crit = kind === "damage" && payload.crit === true;
    // "Rolar como": o mestre assina a rolagem com o nome de um combatente (o da vez, por padrão no cliente).
    let as: string | undefined;
    if (gm && payload?.asId) {
      as = (byId(store, requireString(payload.asId, "Combatente")) ?? fail("Combatente não encontrado.")).name;
    }
    const result = roll(payload?.expr, mode);
    // Só depois de validar a expressão: rolagem inválida não gasta o pedido do mestre.
    const context = outOfTurn(store, player);
    const kindLabel = kind === "attack" ? "Ataque" : kind === "damage" ? (crit ? "Dano (crítico)" : "Dano") : undefined;
    const label = [context, kindLabel].filter(Boolean).join(" · ") || undefined;
    return [logRoll(store, player, result, { hidden: gm && payload.hidden === true, label, as, kind, crit })];
  },

  "roll:request": (store, player, payload) => {
    requireGm(player);
    const { combat, rolls } = store.game.battle;
    if (!combat.active) fail("Fora de combate todos já rolam livremente.");
    const label = typeof payload?.label === "string" ? payload.label.replace(/\s+/g, " ").trim().slice(0, LIMITS.rollLabel) : "";
    if (!label) fail("Diga o que rolar (ex.: Resistência DES).");
    const players = [...store.players.values()].filter((p) => p.role === "player");
    const wanted = Array.isArray(payload.playerIds) ? payload.playerIds : [];
    if (wanted.some((id) => !players.some((p) => p.id === id))) fail("Jogador não encontrado.");
    const playerIds = wanted.length > 0 ? [...new Set(wanted)] : players.map((p) => p.id);
    if (playerIds.length === 0) fail("Não há jogadores na sessão.");
    rolls.request = { id: randomUUID(), label, playerIds, done: [] };
    return [rolls.request.id];
  },

  "roll:cancel": (store, player) => {
    requireGm(player);
    store.game.battle.rolls.request = null;
  },

  "reaction:use": (store, player) => {
    if (player.role === "gm") fail("O mestre rola sempre; reação é para os jogadores.");
    const { combat, rolls } = store.game.battle;
    if (!combat.active) fail("Fora de combate todos já rolam livremente.");
    const current = byId(store, combat.order[combat.turnIndex]);
    if (current?.ownerId === player.id) fail("Na sua vez você já pode rolar.");
    if (rolls.reactions.some((r) => r.playerId === player.id && r.round === combat.round)) {
      fail("Você já usou a reação neste round.");
    }
    rolls.reactions = rolls.reactions.filter((r) => r.playerId !== player.id);
    rolls.reactions.push({ playerId: player.id, round: combat.round, turn: combat.turn });
    logSystem(store, `${player.name} usou a reação.`);
  },
};
