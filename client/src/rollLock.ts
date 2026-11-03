import type { ClientState } from "@rpg/shared";
import { allCombatants } from "./format";
import type { MessageKey } from "./i18n";
import { useApp } from "./store";

/**
 * Quando o jogador pode rolar (E16/E26): na vez dele, num pedido do mestre ou na reação; fora de combate,
 * conforme o mestre escolheu. O servidor também recusa; aqui só desabilita e explica. Vale para o painel
 * Dados e para os botões de rolar da ficha (ataques, testes de atributo, teste contra a morte).
 */
export interface RollLock {
  myTurn: boolean;
  requested: boolean;
  reactionOpen: boolean;
  reactionUsed: boolean;
  /** Trava por vez ou pelo mestre. */
  locked: boolean;
  /** Antispam: os dados desta pessoa ainda estão caindo na tela. */
  waiting: boolean;
  blocked: boolean;
  /** Por que não pode rolar agora (dica dos botões travados). */
  reason?: MessageKey;
}

export function rollLock(state: ClientState, rolling: string[]): RollLock {
  const gm = state.self.role === "gm";
  const { combat, rolls } = state.battle;
  const me = state.self.id;
  const current = combat.active ? allCombatants(state).find((c) => c.id === combat.order[combat.turnIndex]) : undefined;
  const myTurn = current?.ownerId === me;
  const request = rolls.request;
  const requested = !!request && request.playerIds.includes(me) && !request.done.includes(me);
  const reactionOpen = rolls.reactions.some((r) => r.playerId === me && r.turn === combat.turn);
  const reactionUsed = rolls.reactions.some((r) => r.playerId === me && r.round === combat.round);
  const locked = !gm && (combat.active ? !myTurn && !requested && !reactionOpen : rolls.outside !== "free" && !requested);
  const waiting = !gm && state.log.some((e) => e.authorId === me && rolling.includes(e.id));
  const reason: MessageKey | undefined = locked
    ? combat.active
      ? "dice.offTurn"
      : rolls.outside === "locked"
        ? "dice.lockedByGm"
        : "dice.waitRequest"
    : waiting
      ? "dice.waiting"
      : undefined;
  return { myTurn, requested, reactionOpen, reactionUsed, locked, waiting, blocked: locked || waiting, reason };
}

/** A trava de quem está nesta tela (o mestre nunca é travado). */
export function useRollLock(): RollLock {
  const state = useApp((s) => s.state);
  const rolling = useApp((s) => s.rolling);
  return state ? rollLock(state, rolling) : { myTurn: false, requested: false, reactionOpen: false, reactionUsed: false, locked: false, waiting: false, blocked: false };
}
