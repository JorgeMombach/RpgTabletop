import { randomUUID } from "node:crypto";
import { areaAnchor, emptyFog, freeSpotNear, geometryOf, GRID_KINDS, inRows, isColor, isRevealed, LIMITS, occupiedCells, shapesOverlap, sharesCell, TABLE_STYLES, WALL_STYLES, seeThrough, type Combatant, type GridKind, type GridPos, type MapTorch, type TableStyle, type Wall, type WallStyle } from "@rpg/shared";
import { allCombatants, resetCombat } from "../combat";
import type { Store } from "../store";
import { currentSight, forgetSight } from "../sight";
import { fail, requireImage, requireInt, requireNumber } from "../validate";
import { defaultWeather } from "../weather";
import { editable, requireGm } from "./combatants";
import { moveFollowers } from "./effects";
import { requireTurnFor } from "./rules";
import { parseMapTorch } from "./mapTorches";
import { markTerrain } from "./terrain";
import type { HandlerMap } from "./types";
import { parseWall } from "./walls";

function gridPosOf(raw: unknown): GridPos | null {
  if (raw === null) return null;
  const p = raw as GridPos | undefined;
  if (typeof p !== "object" || !p) fail("Posição inválida.");
  if (!Number.isInteger(p.col) || !Number.isInteger(p.row)) fail("Posição inválida.");
  const lim = LIMITS.gridCoord;
  return {
    col: requireInt(p.col, "Coluna", -lim, lim),
    row: requireInt(p.row, "Linha", -lim, lim),
  };
}

/** Rotação em passos de 90° (E17); qualquer múltiplo de 90 vira 0–270. */
function rotationOf(raw: unknown): number {
  if (typeof raw !== "number" || !Number.isInteger(raw) || raw % 90 !== 0) fail("Rotação: use passos de 90°.");
  return ((raw % 360) + 360) % 360;
}

/** Mesa em volta do mapa (L5); madeira fica sem campo (era o padrão até a 2.11: arquivos antigos abrem iguais). */
export function tableStyleOf(raw: unknown): TableStyle | undefined {
  if (!TABLE_STYLES.includes(raw as TableStyle)) fail("Estilo de mesa inválido.");
  return raw === "wood" ? undefined : (raw as TableStyle);
}

/** Cor do grid da cena; preto fica sem campo. */
export function gridColorOf(raw: unknown): string | undefined {
  if (!isColor(raw)) fail("Cor do grid inválida.");
  return raw.toLowerCase() === "#000000" ? undefined : raw.toLowerCase();
}

/**
 * Estilo das paredes da cena (L5); pedra lavrada é o padrão e fica sem campo. Só os que bloqueiam a visão: a
 * parede sem desenho próprio sempre bloqueia (a visão olha só a parede).
 */
export function wallStyleOf(raw: unknown): WallStyle | undefined {
  if (!WALL_STYLES.includes(raw as WallStyle) || seeThrough(raw as WallStyle)) fail("Estilo de parede inválido.");
  return raw === "stone" ? undefined : (raw as WallStyle);
}

/** Grade da cena (Passo 16); quadrado fica sem campo (arquivos antigos abrem iguais). */
export function gridKindOf(raw: unknown): GridKind | undefined {
  if (!GRID_KINDS.includes(raw as GridKind)) fail("Grid desconhecido.");
  return raw === "square" ? undefined : (raw as GridKind);
}

/**
 * Troca a grade da cena. Tokens e baús mantêm `col`/`row` (o app não reposiciona ninguém); paredes, pinturas
 * de efeito e névoa só valem na geometria em que foram feitas e saem. A névoa desliga (com a visão): ligada,
 * os jogadores ficariam sem nada à vista e sem ferramenta no hex para revelar.
 */
function changeGrid(store: Store, grid: GridKind | undefined) {
  const { battle } = store.game;
  if (grid) battle.map.grid = grid;
  else delete battle.map.grid;
  battle.walls = [];
  battle.effects = battle.effects.filter((effect) => !effect.cells);
  // Área que andava com o token fica parada: o passo de quem segue é contado em casas do quadrado (Fase 2).
  for (const effect of battle.effects) delete effect.followId;
  // Área fixada no hex tem a origem no centro ou vértice do hex (centésimos); no quadrado ela vai para a meia casa
  // mais perto, que é o que o quadrado aceita (inclusive ao carregar o arquivo de sessão).
  if (!grid) {
    for (const effect of battle.effects) {
      const anchor = areaAnchor({ x: effect.area.origin.col, y: effect.area.origin.row }, undefined);
      effect.area = { ...effect.area, origin: { col: anchor.x, row: anchor.y } };
    }
  }
  // Alcance e NPCs encontrados não dependem da grade.
  battle.fog = { ...emptyFog(), range: battle.fog.range, foundNpcs: battle.fog.foundNpcs };
  forgetSight(store);
}

export const mapHandlers: HandlerMap = {
  "battle:setMap": (store, player, payload) => {
    requireGm(player);
    const map = store.game.battle.map;
    map.image = payload?.image === null ? null : requireImage(payload?.image, "Mapa", LIMITS.mapImageChars);
    // Imagem nova começa sem rotação e no tamanho original.
    Object.assign(map, { rotation: 0, imageScale: 1 });
    // A versão faz o servidor reenviar a imagem (evento `map:image`) só quando muda.
    map.imageVersion++;
  },

  // Mapa do Dungeondraft e similares (Passo 9): o cliente lê o arquivo (parseUvtt) e manda tudo de uma vez.
  // Imagem nova começa sem deslocamento, rotação nem escala; o grid é o do arquivo. Tudo validado antes de mexer.
  "map:importUvtt": (store, player, payload) => {
    requireGm(player);
    const image = requireImage(payload?.image, "Mapa", LIMITS.mapImageChars);
    const cellPx = Math.round(requireNumber(payload?.cellPx, "Tamanho do quadrado", LIMITS.cellPx.min, LIMITS.cellPx.max) * 100) / 100;
    const { battle } = store.game;
    let walls: Wall[] | undefined;
    if (payload.walls !== undefined) {
      if (!Array.isArray(payload.walls)) fail("Paredes inválidas.");
      if (payload.walls.length > LIMITS.walls) fail("Limite de {n} paredes por cena.", { n: LIMITS.walls });
      walls = payload.walls.map((w) => ({ id: randomUUID(), ...parseWall(w) }));
    }
    let torches: MapTorch[] = [];
    if (payload.torches !== undefined) {
      if (!Array.isArray(payload.torches)) fail("Tochas inválidas.");
      if (battle.torches.length + payload.torches.length > LIMITS.mapTorches) fail("Limite de {n} tochas no mapa: apague algumas.", { n: LIMITS.mapTorches });
      torches = payload.torches.map((t) => ({ id: randomUUID(), ...parseMapTorch({ ...t, style: "iron" }) }));
    }
    const map = battle.map;
    map.image = image;
    Object.assign(map, { cellPx, offsetX: 0, offsetY: 0, rotation: 0, imageScale: 1 });
    map.imageVersion++;
    // O formato só tem grid quadrado: a cena hex volta a ser quadrada (antes das paredes do arquivo).
    if (map.grid) changeGrid(store, undefined);
    if (walls) battle.walls = walls;
    battle.torches.push(...torches);
  },

  "battle:grid": (store, player, input) => {
    requireGm(player);
    const map = store.game.battle.map;
    const { min, max } = LIMITS.cellPx;
    const cellPx = input?.cellPx !== undefined ? requireNumber(input.cellPx, "Tamanho do quadrado", min, max) : map.cellPx;
    const off = (raw: unknown, label: string, current: number) =>
      raw !== undefined ? requireNumber(raw, label, -max, max) : current;
    const offsetX = off(input.offsetX, "Deslocamento X", map.offsetX);
    const offsetY = off(input.offsetY, "Deslocamento Y", map.offsetY);
    const rotation = input.rotation !== undefined ? rotationOf(input.rotation) : map.rotation;
    const { min: sMin, max: sMax } = LIMITS.imageScale;
    const imageScale = input.imageScale !== undefined ? requireNumber(input.imageScale, "Escala do mapa", sMin, sMax) : map.imageScale;
    const grid = input.grid !== undefined ? gridKindOf(input.grid) : map.grid;
    const wallStyle = input.wallStyle !== undefined ? wallStyleOf(input.wallStyle) : map.wallStyle;
    const tableStyle = input.tableStyle !== undefined ? tableStyleOf(input.tableStyle) : map.tableStyle;
    const gridColor = input.gridColor !== undefined ? gridColorOf(input.gridColor) : map.gridColor;

    // Validado tudo: aplica. Offset normalizado para um período do desenho do grid (no quadrado, [0, cellPx);
    // no hex o padrão só se repete a cada duas linhas ou colunas): mesmo grid, números mais previsíveis.
    const { period } = geometryOf(grid);
    const norm = (value: number, step: number) => Math.round((((value % step) + step) % step) * 100) / 100;
    Object.assign(map, {
      cellPx: Math.round(cellPx * 100) / 100,
      offsetX: norm(offsetX, cellPx * period.x),
      offsetY: norm(offsetY, cellPx * period.y),
      rotation,
      imageScale: Math.round(imageScale * 1000) / 1000,
    });
    if (grid !== map.grid) changeGrid(store, grid);
    if (typeof input.showGrid === "boolean") map.showGrid = input.showGrid;
    if (wallStyle) map.wallStyle = wallStyle;
    else delete map.wallStyle;
    if (tableStyle) map.tableStyle = tableStyle;
    else delete map.tableStyle;
    if (gridColor) map.gridColor = gridColor;
    else delete map.gridColor;
  },

  "battle:clear": (store, player, payload) => {
    requireGm(player);
    const { game } = store;
    const { battle } = game;
    // Grid continua: a próxima batalha costuma usar mapas na mesma escala.
    Object.assign(battle.map, { image: null, rotation: 0, imageScale: 1 });
    battle.map.imageVersion++;
    battle.mobs = [];
    battle.npcs = [];
    battle.effects = [];
    battle.drawings = [];
    battle.walls = [];
    battle.torches = [];
    battle.chests = [];
    battle.props = [];
    battle.currents = [];
    // O terreno pintado também é do campo que se limpa.
    delete battle.terrain;
    markTerrain(store, "all");
    // A disputa de loot era da batalha que acabou.
    store.lootCount = null;
    store.lootResults = null;
    // Cena nova: sem clima, de dia (E26), e sem névoa.
    battle.weather = defaultWeather();
    battle.fog = emptyFog();
    resetCombat(store);
    // Conjurados são da batalha: até os dos jogadores somem (E21).
    game.allies = game.allies.filter((a) => !a.summonerId);
    for (const a of game.allies) {
      a.pos = null;
      a.initiative = a.initRoll = null;
    }
    if (!payload?.keepTemplates) game.templates = [];
    store.removedMobs.clear();
    // Numeração dos mobs recomeça em "Goblin 1" na batalha nova.
    store.mobCounters.clear();
  },

  "allies:gather": (store, player, payload) => {
    requireGm(player);
    const at = gridPosOf(payload?.at) ?? fail("Posição inválida.");
    const { allies } = store.game;
    if (allies.length === 0) fail("Nenhum aliado na mesa.");
    // Personagens primeiro, perto do ponto; conjurados depois, por fora. Ninguém em cima de mob, NPC ou outro aliado.
    const order = [...allies.filter((a) => !a.summonerId), ...allies.filter((a) => a.summonerId)];
    const placed: Combatant[] = allCombatants(store).filter((c) => c.type !== "ally" && c.pos);
    const { grid } = store.game.battle.map;
    const geometry = geometryOf(grid);
    for (const a of order) {
      const pos = freeSpotNear(geometry.centeredOn(at, a.size), occupiedCells(placed, grid), a.size, grid);
      moveFollowers(store, a, a.pos, pos);
      a.pos = pos;
      placed.push(a);
    }
  },

  // Pausa (Passo 7): aviso na tela de todos; fica fora do arquivo de sessão.
  "pause:set": (store, player, payload) => {
    requireGm(player);
    if (payload?.paused !== true) {
      store.pause = null;
      return;
    }
    const message = typeof payload.message === "string" ? payload.message.replace(/\s+/g, " ").trim().slice(0, LIMITS.pauseMessage) : "";
    store.pause = { message };
  },

  // Altura e direção (Passo 10): só visual, como mover (quem move o token, muda; pausado, o jogador espera).
  "token:pose": (store, player, payload) => {
    const c = editable(store, player, payload?.id);
    if (store.pause && player.role !== "gm") fail("O jogo está pausado: espere o mestre retomar.");
    const elevation = payload.elevation == null ? payload.elevation : requireInt(payload.elevation, "Altura", LIMITS.elevation.min, LIMITS.elevation.max);
    const facing = payload.facing == null ? payload.facing : (((requireInt(payload.facing, "Direção", -3600, 3600) % 360) + 360) % 360);
    // Validado tudo: aplica. 0 de altura = no chão (sem campo).
    if (elevation === null || elevation === 0) delete c.elevation;
    else if (elevation !== undefined) c.elevation = elevation;
    if (facing === null) delete c.facing;
    else if (facing !== undefined) c.facing = facing;
  },

  "token:move": (store, player, payload) => {
    // Movimento livre: sem limite de deslocamento (ADR-06); só a permissão importa e, com a regra
    // da mesa ligada, a vez em combate.
    const c = editable(store, player, payload?.id);
    // Jogo pausado (Passo 7): os jogadores esperam; o mestre continua ajeitando a cena.
    if (store.pause && player.role !== "gm") fail("O jogo está pausado: espere o mestre retomar.");
    requireTurnFor(store, player, "moveOnTurn", "Em combate, cada um move na sua vez.");
    const pos = gridPosOf(payload.pos);
    // Dois corpos não ocupam o mesmo espaço; criaturas grandes ocupam várias casas e miúdas dividem a casa.
    // Para o jogador, um oculto não conta: a recusa entregaria que há alguém ali (E21). O mestre separa os dois quando revelar.
    const { fog, map } = store.game.battle;
    const geometry = geometryOf(map.grid);
    const sight = currentSight(store);
    const seen = (o: Combatant) =>
      o.type === "ally" || !o.pos || !fog.enabled || geometry.footprint(o.pos, o.size).some((p) => isRevealed(fog, p.col, p.row) || inRows(sight, p.col, p.row));
    const other =
      pos &&
      !sharesCell(c.size) &&
      allCombatants(store).find(
        (o) =>
          o.id !== c.id &&
          o.pos &&
          !sharesCell(o.size) &&
          shapesOverlap(pos, c.size, o.pos, o.size, map.grid) &&
          (player.role === "gm" || (!o.hidden && seen(o))),
      );
    if (other) fail(geometry.drawSpan(c.size) > 1 ? "Não cabe aí: {name} está no caminho." : "Essa casa já está ocupada por {name}.", { name: other.name });
    moveFollowers(store, c, c.pos, pos);
    c.pos = pos;
  },
};
