import type { ClientState, Combatant, CombatantView, HostInfo } from "@rpg/shared";
import { toPublic, type ServerPlayer, type Store } from "./store";

/** Ficha pessoal (magias, recursos, ataques, inventário, moedas): só o dono e o mestre veem (SPEC E6). */
function withoutSheet<T extends Combatant | CombatantView>({ spells: _s, resources: _r, attacks: _a, inventory: _i, coins: _c, ...rest }: T) {
  return rest;
}

/** Mob/NPC para jogadores: sem vida (nem a temporária), CA, atributos e a ficha (a mesa descobre jogando). */
function hideHp({ hp: _hp, hpMax: _hpMax, tempHp: _tempHp, ac: _ac, abilities: _abilities, ...rest }: Combatant): CombatantView {
  return withoutSheet(rest);
}

function allyFor(player: ServerPlayer, c: Combatant): Combatant {
  if (player.role === "gm" || c.ownerId === player.id) return c;
  return withoutSheet(c);
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
      weather: game.battle.weather,
    },
    log: game.log.filter((e) => !e.hidden || gm || e.authorId === player.id),
    sound: store.sound,
    // A lista de arquivos é do mestre; os jogadores só recebem o que estiver tocando.
    soundLibrary: gm ? store.soundLibrary : undefined,
    host: gm ? host : undefined,
  };
}
