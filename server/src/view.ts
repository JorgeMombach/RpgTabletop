import { cellsAroundPoint, inRows, isRevealed, sizeSpan, type ClientState, type Combatant, type CombatantView, type Drawing, type FogState, type GridPos, type HostInfo, type LogEntry, type MapConfig, type MapEffect, type MapChest, type MapProp, type MapTorch, type Wall } from "@rpg/shared";
import { toPublic, type ServerPlayer, type Store } from "./store";
import { currentSight } from "./sight";

/** Ficha pessoal (magias, recursos, ataques, inventário, moedas, rolagens salvas): só o dono e o mestre veem (SPEC E6). */
function withoutSheet<T extends Combatant | CombatantView>({ spells: _s, resources: _r, attacks: _a, inventory: _i, coins: _c, rolls: _o, ...rest }: T) {
  return rest;
}

/**
 * Mob/NPC para jogadores: sem vida (nem a temporária), CA, atributos e a ficha (a mesa descobre jogando).
 * Caído vai: todos veem o mob no chão.
 */
function hideHp({ hp, hpMax: _hpMax, tempHp: _tempHp, ac: _ac, abilities: _abilities, gmNotes: _n, phases: _p, ...rest }: Combatant): CombatantView {
  const view: CombatantView = withoutSheet(rest);
  if (hp <= 0) view.down = true;
  return view;
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
/** Casas de uma pintura (achatadas: col0, row0…) como posições. */
function paintedCells(flat: number[]): GridPos[] {
  const out: GridPos[] = [];
  for (let i = 0; i + 1 < flat.length; i += 2) out.push({ col: flat[i], row: flat[i + 1] });
  return out;
}

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
    // Pintura: aparece se alguma casa pintada já foi vista.
    effect: (e: MapEffect) => anyEver(e.cells ? paintedCells(e.cells) : cellsAroundPoint(e.area.origin.col, e.area.origin.row)),
    drawing: (d: Drawing, grid: MapConfig) => {
      const pts: GridPos[] = [];
      for (let i = 0; i + 1 < d.points.length; i += 2) {
        pts.push({ col: Math.floor((d.points[i] - grid.offsetX) / grid.cellPx), row: Math.floor((d.points[i + 1] - grid.offsetY) / grid.cellPx) });
      }
      return anyEver(pts);
    },
    torch: (t: MapTorch) => anyEver([{ col: Math.floor(t.col), row: Math.floor(t.row) }]),
    chest: (c: MapChest) => anyEver([{ col: c.col, row: c.row }]),
    prop: (p: MapProp) => anyEver(cellsAroundPoint(p.col, p.row)),
    // Parede: aparece se alguma casa encostada nela (em qualquer canto do caminho) estiver revelada.
    wall: (w: Wall) => {
      // Pontas podem ser fracionadas (traço livre): um passo por casa, no mínimo um.
      const steps = Math.max(1, Math.ceil(Math.max(Math.abs(w.to.col - w.from.col), Math.abs(w.to.row - w.from.row))));
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

/** Baús que cada um recebe: o jogador não recebe o invisível nem o coberto; o conteúdo, só depois da primeira abertura. */
export function chestsFor(store: Store, gm: boolean): MapChest[] {
  const { chests, fog } = store.game.battle;
  if (gm) return chests;
  const sight = inSight(fog, currentSight(store));
  return chests.filter((c) => !c.hidden && sight.chest(c)).map((c) => (c.opened ? c : { ...c, loot: [] }));
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
  const chests = chestsFor(store, gm);
  const seesChest = (id: string) => chests.some((c) => c.id === id);

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
      // NPC já encontrado continua à vista, mesmo sem ninguém por perto.
      npcs: gm ? game.battle.npcs : forPlayers(game.battle.npcs.filter((c) => sight.combatant(c) || (fog.enabled && fog.vision && fog.foundNpcs.includes(c.id)))),
      combat: game.battle.combat,
      rolls: game.battle.rolls,
      // Efeito desligado fica guardado só para o mestre (E19).
      effects: gm ? game.battle.effects : game.battle.effects.filter((e) => e.active && sight.effect(e)),
      // Anotação só do mestre não vai para os jogadores.
      drawings: gm ? game.battle.drawings : game.battle.drawings.filter((d) => !d.hidden && sight.drawing(d, map)),
      // Porta secreta: o jogador nem recebe (parece parede nenhuma) até o mestre revelar.
      walls: gm ? game.battle.walls : game.battle.walls.filter((w) => !w.door?.secret && sight.wall(w)),
      // Tocha na parte coberta nem chega: nem o desenho nem a luz entregam o lugar.
      torches: gm ? game.battle.torches : game.battle.torches.filter(sight.torch),
      // Baú invisível ou coberto nem chega; o conteúdo só depois da primeira abertura (surpresa).
      chests,
      // Objeto do cenário coberto pela névoa nem chega.
      props: gm ? game.battle.props : game.battle.props.filter(sight.prop),
      // A disputa do loot vai para todos (o baú abre na tela de cada um).
      // ...mas só de baú que a pessoa recebe (coberto pela névoa, nem a disputa nem o resultado chegam).
      lootCount: store.lootCount && seesChest(store.lootCount.chestId) ? { chestId: store.lootCount.chestId, remainingMs: Math.max(0, store.lootCount.endsAt - Date.now()), wants: store.lootCount.wants } : null,
      lootResults: store.lootResults && seesChest(store.lootResults.chestId) ? store.lootResults : null,
      weather: game.battle.weather,
      fog,
      sight: visible,
    },
    log: gm ? game.log : game.log.filter((e) => visibleEntry(e, player.id)).map((e) => (e.secret && e.roll ? blindEntry(e) : e)),
    sceneId: game.sceneId,
    rules: game.rules,
    lootSeconds: game.lootSeconds,
    // Tabelas aleatórias (Passo 13): só o mestre (o conteúdo é surpresa).
    tables: gm ? game.tables : [],
    // Cenas preparadas são do mestre: os jogadores só veem a que está no mapa.
    scenes: gm
      ? game.scenes.map((s) => {
          const content = s.stored ?? game.battle;
          return { id: s.id, name: s.name, hasImage: content.map.image !== null, mobs: content.mobs.length };
        })
      : undefined,
    sound: store.sound,
    pause: store.pause,
    // A lista de arquivos é do mestre; os jogadores só recebem o que estiver tocando.
    soundLibrary: gm ? store.soundLibrary : undefined,
    host: gm ? host : undefined,
  };
}

/**
 * Entrada do log que um jogador recebe: rolagem oculta do mestre e rolagem secreta só para quem rolou;
 * sussurro (Passo 6) só para quem escreveu e quem recebe (o mestre recebe tudo, nem passa por aqui).
 */
function visibleEntry(e: LogEntry, playerId: string): boolean {
  if (e.whisper) return e.authorId === playerId || e.whisper.to === playerId;
  if (e.hidden || e.secret) return e.authorId === playerId;
  return true;
}

/** Rolagem secreta na tela de quem rolou: às cegas, sem os dados nem o total (nem no texto). */
function blindEntry(e: LogEntry): LogEntry {
  return { ...e, text: e.label ?? "", roll: { expr: e.roll!.expr, mode: e.roll!.mode, terms: [], total: 0 } };
}
