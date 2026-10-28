import { cellsAroundPoint, inRows, isRevealed, sizeSpan, type ClientState, type Combatant, type CombatantView, type Drawing, type FogState, type GridPos, type HostInfo, type MapConfig, type MapEffect, type Wall } from "@rpg/shared";
import { toPublic, type ServerPlayer, type Store } from "./store";
import { currentSight } from "./sight";

/** Ficha pessoal (magias, recursos, ataques, inventário, moedas): só o dono e o mestre veem (SPEC E6). */
function withoutSheet<T extends Combatant | CombatantView>({ spells: _s, resources: _r, attacks: _a, inventory: _i, coins: _c, ...rest }: T) {
  return rest;
}

/** Mob/NPC para jogadores: sem vida (nem a temporária), CA, atributos e a ficha (a mesa descobre jogando). */
function hideHp({ hp: _hp, hpMax: _hpMax, tempHp: _tempHp, ac: _ac, abilities: _abilities, gmNotes: _n, phases: _p, ...rest }: Combatant): CombatantView {
  return withoutSheet(rest);
}

/** Aliado para um jogador: as notas do mestre nunca vão (nem para o dono); a ficha, só para o dono. */
function allyFor(player: ServerPlayer, c: Combatant): Combatant {
  if (player.role === "gm") return c;
  const { gmNotes: _n, ...rest } = c;
  return c.ownerId === player.id ? rest : withoutSheet(rest);
}

/** Para jogadores: sem os ocultos (E21) e sem a vida. */
function forPlayers(list: Combatant[]): CombatantView[] {
  return list.filter((c) => !c.hidden).map(hideHp);
}

/**
 * Névoa de guerra (G): o jogador não recebe o que está todo na parte coberta. Mob/NPC fora do mapa
 * continua indo (não está em lugar nenhum); aliados sempre vão. A imagem do mapa vai inteira (a névoa
 * é desenhada por cima), mas inimigos, efeitos, desenhos e paredes cobertos nem chegam.
 */
function inSight(fog: FogState, sight: Record<string, number[]>) {
  // Agora: revelado pelo mestre ou na visão dos aliados. Alguma vez: também o explorado (com a visão ligada).
  const now = (c: GridPos) => isRevealed(fog, c.col, c.row) || inRows(sight, c.col, c.row);
  const ever = (c: GridPos) => now(c) || (fog.vision && inRows(fog.explored, c.col, c.row));
  const anyNow = (cells: GridPos[]) => !fog.enabled || cells.some(now);
  const anyEver = (cells: GridPos[]) => !fog.enabled || cells.some(ever);
  const cells = (c: Combatant) => {
    if (!c.pos) return true;
    const span = sizeSpan(c.size);
    const out: GridPos[] = [];
    for (let dc = 0; dc < span; dc++) for (let dr = 0; dr < span; dr++) out.push({ col: c.pos.col + dc, row: c.pos.row + dr });
    return anyNow(out);
  };
  // Inimigos só aparecem onde se vê agora; o resto do mapa (efeitos, desenhos, paredes) também no explorado.
  return {
    combatant: cells,
    effect: (e: MapEffect) => anyEver(cellsAroundPoint(e.area.origin.col, e.area.origin.row)),
    drawing: (d: Drawing, grid: MapConfig) => {
      const pts: GridPos[] = [];
      for (let i = 0; i + 1 < d.points.length; i += 2) {
        pts.push({ col: Math.floor((d.points[i] - grid.offsetX) / grid.cellPx), row: Math.floor((d.points[i + 1] - grid.offsetY) / grid.cellPx) });
      }
      return anyEver(pts);
    },
    // Parede: aparece se alguma casa encostada nela (em qualquer canto do caminho) estiver revelada.
    wall: (w: Wall) => {
      const steps = Math.max(Math.abs(w.to.col - w.from.col), Math.abs(w.to.row - w.from.row));
      const pts: GridPos[] = [];
      for (let i = 0; i <= steps; i++) {
        const col = Math.round(w.from.col + ((w.to.col - w.from.col) * i) / steps);
        const row = Math.round(w.from.row + ((w.to.row - w.from.row) * i) / steps);
        pts.push(...cellsAroundPoint(col, row));
      }
      return anyEver(pts);
    },
  };
}

/**
 * Estado filtrado por papel (ADR-05): jogadores nunca recebem a vida de mobs e NPCs,
 * nem mobs/NPCs ocultos, nem a lista de magias de outros jogadores.
 */
export function viewFor(store: Store, player: ServerPlayer, host: HostInfo): ClientState {
  const { game } = store;
  const gm = player.role === "gm";
  const { image, ...map } = game.battle.map;
  const fog = game.battle.fog;
  const visible = currentSight(store);
  const sight = inSight(fog, visible);

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
      mobs: gm ? game.battle.mobs : forPlayers(game.battle.mobs.filter(sight.combatant)),
      npcs: gm ? game.battle.npcs : forPlayers(game.battle.npcs.filter(sight.combatant)),
      combat: game.battle.combat,
      rolls: game.battle.rolls,
      // Efeito desligado fica guardado só para o mestre (E19).
      effects: gm ? game.battle.effects : game.battle.effects.filter((e) => e.active && sight.effect(e)),
      // Anotação só do mestre não vai para os jogadores.
      drawings: gm ? game.battle.drawings : game.battle.drawings.filter((d) => !d.hidden && sight.drawing(d, map)),
      // Porta secreta: o jogador nem recebe (parece parede nenhuma) até o mestre revelar.
      walls: gm ? game.battle.walls : game.battle.walls.filter((w) => !w.door?.secret && sight.wall(w)),
      weather: game.battle.weather,
      fog,
      sight: visible,
    },
    log: game.log.filter((e) => !e.hidden || gm || e.authorId === player.id),
    sceneId: game.sceneId,
    rules: game.rules,
    // Cenas preparadas são do mestre: os jogadores só veem a que está no mapa.
    scenes: gm
      ? game.scenes.map((s) => {
          const content = s.stored ?? game.battle;
          return { id: s.id, name: s.name, hasImage: content.map.image !== null, mobs: content.mobs.length };
        })
      : undefined,
    sound: store.sound,
    // A lista de arquivos é do mestre; os jogadores só recebem o que estiver tocando.
    soundLibrary: gm ? store.soundLibrary : undefined,
    host: gm ? host : undefined,
  };
}
