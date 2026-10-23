import { randomUUID } from "node:crypto";
import { LIMITS, type RollMode, type RollResult } from "@rpg/shared";
import { roll } from "../dice";
import type { ServerPlayer, Store } from "../store";
import type { HandlerMap } from "./types";

const MODES: RollMode[] = ["normal", "adv", "dis"];

/** Registra uma rolagem no log compartilhado (mantém só as últimas). */
export function logRoll(
  store: Store,
  player: ServerPlayer,
  result: RollResult,
  opts: { hidden?: boolean; label?: string } = {},
) {
  const { log } = store.game;
  log.push({
    id: randomUUID(),
    ts: Date.now(),
    authorId: player.id,
    author: player.name,
    text: `${opts.label ? `${opts.label}: ` : ""}${result.expr} = ${result.total}`,
    hidden: opts.hidden || undefined,
    label: opts.label,
    roll: result,
  });
  if (log.length > LIMITS.logSize) log.splice(0, log.length - LIMITS.logSize);
}

export const diceHandlers: HandlerMap = {
  // Rolagem no servidor: um resultado único para todos (ADR-07).
  "dice:roll": (store, player, payload) => {
    const mode = MODES.includes(payload?.mode as RollMode) ? (payload.mode as RollMode) : "normal";
    const result = roll(payload?.expr, mode);
    logRoll(store, player, result, { hidden: player.role === "gm" && payload.hidden === true });
  },
};
