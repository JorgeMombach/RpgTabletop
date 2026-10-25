import type { ClientState, Combatant, CombatantView, HostInfo } from "@rpg/shared";
import { toPublic, type ServerPlayer, type Store } from "./store";

function hideHp({ hp: _hp, hpMax: _hpMax, ...rest }: Combatant): CombatantView {
  return rest;
}

/** A lista de magias é referência pessoal: só o dono e o mestre veem (SPEC E6). */
function allyFor(player: ServerPlayer, c: Combatant): Combatant {
  if (player.role === "gm" || c.ownerId === player.id || !c.spells) return c;
  const { spells: _spells, ...rest } = c;
  return rest;
}

/** Para jogadores: sem os ocultos (E21) e sem a vida. */
function forPlayers(list: Combatant[]): CombatantView[] {
  return list.filter((c) => !c.hidden).map(hideHp);
}

/**
 * Estado filtrado por papel (ADR-05): jogadores nunca recebem a vida de mobs e NPCs,
 * nem mobs/NPCs ocultos, nem a lista de magias de outros jogadores.
 */
export function viewFor(store: Store, player: ServerPlayer, host: HostInfo): ClientState {
  const { game } = store;
  const gm = player.role === "gm";
  const { image, ...map } = game.battle.map;

  const players = [...store.players.values()]
    .map(toPublic)
    .sort((a, b) => Number(b.role === "gm") - Number(a.role === "gm") || a.name.localeCompare(b.name));

  return {
    self: toPublic(player),
    players,
    maxPlayers: store.maxPlayers,
    templates: gm ? game.templates : [],
    allies: game.allies.map((a) => allyFor(player, a)),
    battle: {
      map: { ...map, hasImage: image !== null },
      mobs: gm ? game.battle.mobs : forPlayers(game.battle.mobs),
      npcs: gm ? game.battle.npcs : forPlayers(game.battle.npcs),
      combat: game.battle.combat,
      rolls: game.battle.rolls,
      // Efeito desligado fica guardado só para o mestre (E19).
      effects: gm ? game.battle.effects : game.battle.effects.filter((e) => e.active),
    },
    log: game.log.filter((e) => !e.hidden || gm || e.authorId === player.id),
    host: gm ? host : undefined,
  };
}
