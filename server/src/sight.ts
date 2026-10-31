import { cellsToRects, inRows, isRevealed, paintRows, sizeSpan, sightCells, TORCH_FEET, visionFeet, type Combatant, type GridPos } from "@rpg/shared";
import { allCombatants } from "./combat";
import type { Store } from "./store";

type Rows = Record<string, number[]>;

const cache = new WeakMap<Store, { key: string; rows: Rows }>();

/** O que muda a visão: aliados (lugar, tamanho, visão no escuro), paredes e portas, luz e escala, cena. */
function keyOf(store: Store): string {
  const { game } = store;
  const { battle } = game;
  return JSON.stringify([
    game.sceneId,
    battle.weather.light,
    battle.fog.range,
    battle.map.feetPerCell,
    game.allies.map((a) => (a.pos ? [a.pos.col, a.pos.row, a.size ?? "", a.darkvision ? 1 : 0] : 0)),
    lightsOf(store).map((c) => [c.pos!.col, c.pos!.row, c.size ?? ""]),
    battle.torches.map((t) => [t.col, t.row]),
    battle.walls.map((w) => [w.from.col, w.from.row, w.to.col, w.to.row, w.door ? (w.door.open ? 1 : 2) : 0]),
  ]);
}

/** Quem ilumina: tocha acesa, no mapa e à vista (mob oculto não se entrega pela luz). */
function lightsOf(store: Store): Combatant[] {
  return allCombatants(store).filter((c) => c.torch && c.pos && !c.hidden);
}

/**
 * Visão dos personagens (névoa, parte 3): casas que os aliados no mapa veem agora. Chamado antes de cada
 * envio do estado; quando muda, o que eles veem passa a ficar explorado (lembrado) na névoa da cena.
 */
export function updateSight(store: Store): Rows {
  const { battle, allies } = store.game;
  const { fog } = battle;
  if (!fog.enabled || !fog.vision) {
    cache.delete(store);
    return {};
  }
  const key = keyOf(store);
  const hit = cache.get(store);
  if (hit && hit.key === key) return hit.rows;
  // Alcance da cena: o mesmo para todos, sem luz, visão no escuro nem tocha.
  const feetOf = (a: Combatant) => fog.range ?? visionFeet(battle.weather.light, !!a.darkvision, !!a.torch);
  const viewers = allies.flatMap((a) => (a.pos ? [{ pos: a.pos, span: sizeSpan(a.size), feet: feetOf(a) }] : []));
  // De dia (ou com alcance da cena) a luz da tocha não muda nada.
  const lights =
    battle.weather.light === "day" || fog.range !== null
      ? []
      : [
          ...lightsOf(store).map((c) => ({ pos: c.pos!, span: sizeSpan(c.size), feet: TORCH_FEET })),
          // Tocha fixa: o centro da "casa" de luz cai no ponto exato dela.
          ...battle.torches.map((t) => ({ pos: { col: t.col - 0.5, row: t.row - 0.5 }, span: 1, feet: TORCH_FEET })),
        ];
  const rows: Rows = {};
  for (const r of cellsToRects(sightCells(viewers, battle.walls, battle.map.feetPerCell, lights))) {
    paintRows(rows, r, true);
    paintRows(fog.explored, r, true);
  }
  cache.set(store, { key, rows });
  return rows;
}

/** A visão de agora (a última calculada). */
export function currentSight(store: Store): Rows {
  return updateSight(store);
}

/** Casas que um combatente ocupa. */
function cellsOf(pos: GridPos, span: number): GridPos[] {
  const out: GridPos[] = [];
  for (let dc = 0; dc < span; dc++) for (let dr = 0; dr < span; dr++) out.push({ col: pos.col + dc, row: pos.row + dr });
  return out;
}

/** Inimigos à vista do grupo no último envio (onde estavam), para saber quem acabou de sumir. */
const inView = new WeakMap<Store, Map<string, { name: string; pos: GridPos; span: number }>>();

/**
 * "Visto por último aqui" (névoa com visão dos personagens): inimigo que sai da vista deixa uma marca
 * no último lugar em que foi visto. A marca some quando alguém volta a ver o lugar, quando ele reaparece,
 * sai da batalha ou é ocultado pelo mestre. Chamado uma vez por envio do estado, depois de `updateSight`.
 * A marca é só de mob: NPC visto entra em `foundNpcs` e continua à vista com o próprio token.
 */
export function trackLastSeen(store: Store) {
  const { battle } = store.game;
  const { fog } = battle;
  if (!fog.enabled || !fog.vision) {
    inView.delete(store);
    return;
  }
  const sight = currentSight(store);
  const seenNow = (cells: GridPos[]) => cells.some((p) => isRevealed(fog, p.col, p.row) || inRows(sight, p.col, p.row));
  const found = new Set(fog.foundNpcs);
  for (const c of battle.npcs) if (c.pos && !c.hidden && seenNow(cellsOf(c.pos, sizeSpan(c.size)))) found.add(c.id);
  fog.foundNpcs = battle.npcs.filter((c) => found.has(c.id)).map((c) => c.id);
  const enemies = battle.mobs;
  const now = new Map<string, { name: string; pos: GridPos; span: number }>();
  for (const c of enemies) {
    if (!c.pos || c.hidden) continue;
    const span = sizeSpan(c.size);
    if (seenNow(cellsOf(c.pos, span))) now.set(c.id, { name: c.name, pos: c.pos, span });
  }
  const before = inView.get(store);
  // Quem estava à vista e sumiu (ainda na batalha e não ocultado): marca onde foi visto.
  if (before) {
    for (const [id, last] of before) {
      if (now.has(id)) continue;
      const c = enemies.find((e) => e.id === id);
      if (!c || c.hidden) continue;
      fog.lastSeen = fog.lastSeen.filter((m) => m.id !== id);
      fog.lastSeen.push({ id, ...last });
    }
  }
  fog.lastSeen = fog.lastSeen.filter((m) => {
    const c = enemies.find((e) => e.id === m.id);
    return c && !c.hidden && !now.has(m.id) && !seenNow(cellsOf(m.pos, m.span));
  });
  inView.set(store, now);
}

/**
 * O mestre mexeu na névoa (cobriu, cobriu tudo, mudou o alcance): quem sumiu por isso não deixa marca de
 * "visto por último", e a visão é recalculada (o explorado volta a incluir o que se vê agora).
 */
export function forgetSight(store: Store) {
  cache.delete(store);
  inView.delete(store);
}
