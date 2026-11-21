import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { geometryOf, isRevealed, paintFog, shapesOverlap, type ActionPayloads, type GridPos, type ActionResult, type Area, type AreaBroadcast } from "@rpg/shared";
import { hostInfo } from "../src/net";
import { viewFor } from "../src/view";
import { act, join, stateWhere, useServer, type Client } from "./helpers";

// Grid hexagonal (Passo 16): a cena guarda a grade; trocar apaga o que só vale na geometria antiga.
const { ctx, client } = useServer();
const battle = () => ctx.server.store.game.battle;

// PNG 1×1 válido.
const PNG = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=";
const AREA: Area = { kind: "cube", origin: { col: 2, row: 2 }, angle: 0, feet: 20 };

function idsOf(res: ActionResult): string[] {
  assert.ok(res.ok, res.ok ? "" : res.error);
  return res.ids ?? [];
}

async function gm(): Promise<Client> {
  const socket = await client();
  await join(socket, "Mestre");
  return socket;
}

async function backToSquare(g: Client) {
  assert.ok((await act(g, "battle:grid", { grid: "square", offsetX: 0, offsetY: 0 })).ok);
}

describe("grid hexagonal: a cena guarda o grid", () => {
  it("trocar para hex apaga paredes, névoa e pinturas e mantém tokens", async () => {
    const g = await gm();
    await act(g, "wall:add", { from: { col: 1, row: 1 }, to: { col: 3, row: 1 } });
    await act(g, "fog:set", { enabled: true });
    await act(g, "fog:vision", { enabled: true });
    await act(g, "fog:paint", { reveal: true, rects: [{ col: 2, row: 2, w: 3, h: 3 }] });
    idsOf(await act(g, "effect:paint", { preset: "fire", cells: [1, 1, 2, 1] }));
    idsOf(await act(g, "effect:add", { name: "Teia", preset: "web", area: AREA }));
    const [goblin] = idsOf(await act(g, "mob:add", { name: "Goblin", hpMax: 7, dexMod: 2 }));
    await act(g, "token:move", { id: goblin, pos: { col: 3, row: 4 } });
    assert.ok(battle().walls.length > 0 && battle().fog.enabled, "preparação");

    assert.ok((await act(g, "battle:grid", { grid: "hexRows" })).ok);
    const { map, walls, fog, effects, mobs } = battle();
    assert.equal(map.grid, "hexRows");
    assert.deepEqual(walls, []);
    assert.equal(fog.enabled, false);
    assert.equal(fog.vision, false);
    assert.deepEqual(fog.revealed, {});
    assert.deepEqual(fog.explored, {});
    assert.equal(effects.some((effect) => effect.cells), false, "pinturas saem");
    assert.deepEqual(effects.map((effect) => effect.name), ["Teia"], "área fixada fica");
    assert.deepEqual(mobs.find((mob) => mob.id === goblin)!.pos, { col: 3, row: 4 });

    // Mudar outra coisa sem trocar a grade não apaga nada.
    await backToSquare(g);
    await act(g, "wall:add", { from: { col: 1, row: 1 }, to: { col: 3, row: 1 } });
    assert.ok((await act(g, "battle:grid", { grid: "square", showGrid: true })).ok);
    assert.equal(battle().walls.length, 1);
  });

  it("voltar para quadrado apaga o grid do mapa", async () => {
    const g = await gm();
    assert.ok((await act(g, "battle:grid", { grid: "hexCols" })).ok);
    assert.equal(battle().map.grid, "hexCols");
    await backToSquare(g);
    assert.equal("grid" in battle().map, false);
  });

  it("grid inválido é recusado", async () => {
    const g = await gm();
    const before = structuredClone(battle().map);
    const res = await act(g, "battle:grid", { grid: "triangulo" as never, cellPx: 80 });
    assert.equal(res.ok, false);
    assert.match(res.ok ? "" : res.error, /Grid desconhecido/);
    assert.deepEqual(battle().map, before, "nada muda");
  });

  it("deslocamento no hex normaliza pelo período", async () => {
    const g = await gm();
    assert.ok((await act(g, "battle:grid", { grid: "hexRows", cellPx: 100, offsetX: 130, offsetY: 200 })).ok);
    assert.equal(battle().map.offsetX, 30);
    assert.equal(battle().map.offsetY, 26.79, "o padrão do hex de pontas para cima repete a cada √3 casas na vertical");
    assert.ok((await act(g, "battle:grid", { grid: "hexCols", offsetX: 200, offsetY: 130 })).ok);
    assert.equal(battle().map.offsetX, 26.79);
    assert.equal(battle().map.offsetY, 30);
    await backToSquare(g);
  });

  it("importar do Dungeondraft numa cena hex volta para quadrado", async () => {
    const g = await gm();
    assert.ok((await act(g, "battle:grid", { grid: "hexRows" })).ok);
    assert.ok((await act(g, "map:importUvtt", { image: PNG, cellPx: 70 })).ok);
    assert.equal("grid" in battle().map, false);
  });

  it("o grid vai e volta no arquivo de sessão; arquivo antigo abre quadrado", async () => {
    const g = await gm();
    assert.ok((await act(g, "battle:grid", { grid: "hexCols" })).ok);
    const exported = await g.timeout(2000).emitWithAck("session:export");
    assert.ok(exported.ok, exported.ok ? "" : exported.error);
    const file = exported.file;
    assert.equal(file.game.battle.map.grid, "hexCols");
    await backToSquare(g);
    assert.ok((await g.timeout(2000).emitWithAck("session:import", file)).ok);
    assert.equal(battle().map.grid, "hexCols");
    const { grid: _removed, ...oldMap } = file.game.battle.map;
    const oldFile = { ...file, game: { ...file.game, battle: { ...file.game.battle, map: oldMap } } };
    assert.ok((await g.timeout(2000).emitWithAck("session:import", oldFile)).ok);
    assert.equal("grid" in battle().map, false);
  });

  it("quem entra recebe o grid", async () => {
    const g = await gm();
    assert.ok((await act(g, "battle:grid", { grid: "hexRows" })).ok);
    const ana = await client("10.41.0.1");
    const arrived = stateWhere(ana, (state) => state.battle.map.grid === "hexRows");
    await join(ana, "Ana");
    await arrived;
    await backToSquare(g);
  });
});

describe("grid hexagonal: o servidor confere a ocupação pela geometria", () => {
  const hex = geometryOf("hexRows");
  const errorOf = (res: ActionResult) => {
    assert.equal(res.ok, false, "deveria recusar");
    return res.ok ? "" : res.error;
  };
  const posOf = (id: string) => [...battle().mobs, ...battle().npcs, ...ctx.server.store.game.allies].find((c) => c.id === id)!;
  /** Ninguém com forma sobre a de outro. */
  function assertNoOverlap() {
    const placed = [...battle().mobs, ...battle().npcs, ...ctx.server.store.game.allies].filter((c) => c.pos && c.size !== "tiny");
    for (const a of placed) {
      for (const b of placed) {
        if (a !== b) assert.equal(shapesOverlap(a.pos!, a.size, b.pos!, b.size, "hexRows"), false, `${a.name} sobre ${b.name}`);
      }
    }
  }

  async function hexScene(): Promise<Client> {
    const g = await gm();
    await act(g, "battle:clear", { keepTemplates: false });
    assert.ok((await act(g, "battle:grid", { grid: "hexRows" })).ok);
    return g;
  }

  it("Grande no hex não pousa em cima de ninguém", async () => {
    const g = await hexScene();
    const [ogro] = idsOf(await act(g, "mob:add", { name: "Ogro", hpMax: 59, dexMod: -1, size: "large" }));
    const [goblin] = idsOf(await act(g, "mob:add", { name: "Goblin", hpMax: 7, dexMod: 2 }));
    const ogroAt = { col: 2, row: 2 };
    assert.ok((await act(g, "token:move", { id: ogro, pos: ogroAt })).ok);
    const shape = hex.footprint(ogroAt, "large");
    assert.match(errorOf(await act(g, "token:move", { id: goblin, pos: shape[2] })), /ocupada por Ogro/);
    // A casa que completaria o 2×2 do quadrado fica fora do triângulo do hex: lá cabe.
    const outside = { col: 3, row: 3 };
    assert.ok(!shape.some((own) => own.col === outside.col && own.row === outside.row) && hex.distance(ogroAt, outside) <= 2);
    assert.ok((await act(g, "token:move", { id: goblin, pos: outside })).ok, "do lado, cabe");
    // O ogro numa forma que pega a casa do goblin.
    const covering = [outside, ...hex.neighbors(outside)].find((pos) =>
      hex.footprint(pos, "large").some((cell) => cell.col === outside.col && cell.row === outside.row),
    )!;
    assert.match(errorOf(await act(g, "token:move", { id: ogro, pos: covering })), /Não cabe aí: Goblin/);
    await backToSquare(g);
  });

  it("invocar, levar o grupo e crescer a ficha caem em lugar livre no hex", async () => {
    const g = await hexScene();
    const ana = await client("10.41.0.2");
    await join(ana, "Ana");
    const [thorin] = idsOf(await act(ana, "ally:create", { name: "Thorin", hpMax: 30, dexMod: 1 }));
    await act(ana, "token:move", { id: thorin, pos: { col: 5, row: 5 } });
    const [urso] = idsOf(await act(ana, "summon:add", { summonerId: thorin, qty: 1, name: "Urso", hpMax: 34, dexMod: 0, size: "large" }));
    assertNoOverlap();
    assert.ok(hex.distance(posOf(urso).pos!, { col: 5, row: 5 }) <= 3, "o urso nasce perto");

    // Um Enorme no ponto de encontro: o grupo chega em volta, sem ninguém em cima dele.
    const [troll] = idsOf(await act(g, "mob:add", { name: "Troll", hpMax: 84, dexMod: 1, size: "huge" }));
    await act(g, "token:move", { id: troll, pos: { col: 12, row: 12 } });
    assert.ok((await act(g, "allies:gather", { at: { col: 12, row: 12 } })).ok);
    assertNoOverlap();
    assert.ok(hex.distance(posOf(thorin).pos!, { col: 12, row: 12 }) <= 4, "o grupo chega perto");

    // Ficha que cresce para Imenso ao lado de alguém vai para o lugar livre mais perto.
    const [lobo] = idsOf(await act(g, "mob:add", { name: "Lobo", hpMax: 11, dexMod: 2 }));
    const [goblin] = idsOf(await act(g, "mob:add", { name: "Goblin", hpMax: 7, dexMod: 2 }));
    await act(g, "token:move", { id: lobo, pos: { col: 3, row: 20 } });
    await act(g, "token:move", { id: goblin, pos: { col: 4, row: 20 } });
    assert.ok((await act(g, "combatant:update", { id: lobo, size: "gargantuan" })).ok);
    assertNoOverlap();
    assert.ok(hex.distance(posOf(lobo).pos!, { col: 3, row: 20 }) <= 3, "vai para perto de onde estava");
    ana.disconnect();
    await backToSquare(g);
  });

  const keyOf = (cell: GridPos) => `${cell.col},${cell.row}`;

  /** O lado comum de duas casas vizinhas no hex de pontas para cima, como parede. */
  function sideWall(a: GridPos, b: GridPos) {
    const other = hex.polygon(b);
    const [from, to] = hex.polygon(a).filter((corner) => other.some((p) => Math.hypot(p.x - corner.x, p.y - corner.y) < 1e-6));
    return { from: { col: Math.round(from.x * 100) / 100, row: Math.round(from.y * 100) / 100 }, to: { col: Math.round(to.x * 100) / 100, row: Math.round(to.y * 100) / 100 } };
  }

  it("paredes e névoa valem no hex", async () => {
    const g = await hexScene();
    const actions: [keyof ActionPayloads, ActionPayloads[keyof ActionPayloads]][] = [
      ["wall:add", { from: { col: 1, row: 1 }, to: { col: 3, row: 1 } }],
      ["wall:erase", { points: [10, 10, 50, 50], radius: 10 }],
      ["fog:set", { enabled: true }],
      ["fog:paint", { reveal: true, rects: [{ col: 0, row: 0, w: 2, h: 1 }] }],
      ["fog:vision", { enabled: true }],
      ["fog:room", { cell: { col: 30, row: 30 }, reveal: true }],
    ];
    for (const [action, payload] of actions) {
      const res = await act(g, action, payload as never);
      assert.doesNotMatch(res.ok ? "" : res.error, /grid hexagonal/, action);
    }
    await act(g, "fog:set", { enabled: false });
    await act(g, "fog:vision", { enabled: false });
    await backToSquare(g);
  });

  it("cômodo no hex", async () => {
    const g = await hexScene();
    const center = { col: 5, row: 5 };
    const room = hex.footprint(center, "huge");
    const inside = new Set(room.map(keyOf));
    for (const cell of room) {
      for (const neighbor of hex.neighbors(cell)) if (!inside.has(keyOf(neighbor))) await act(g, "wall:add", sideWall(cell, neighbor));
    }
    await act(g, "fog:set", { enabled: true });
    assert.ok((await act(g, "fog:room", { cell: center, reveal: true })).ok);
    const { fog } = battle();
    for (const cell of room) assert.ok(isRevealed(fog, cell.col, cell.row), `revelou ${keyOf(cell)}`);
    for (const neighbor of hex.neighbors({ col: 7, row: 5 })) if (!inside.has(keyOf(neighbor))) assert.equal(isRevealed(fog, neighbor.col, neighbor.row), false);
    await act(g, "fog:set", { enabled: false });
    await backToSquare(g);
  });

  it("jogador não recebe o que está atrás da parede no hex", async () => {
    const g = await hexScene();
    await act(g, "fog:set", { enabled: true });
    await act(g, "fog:vision", { enabled: true });
    const ana = await client("10.41.0.4");
    await join(ana, "Ana");
    const [thorin] = idsOf(await act(ana, "ally:create", { name: "Thorin", hpMax: 30, dexMod: 1 }));
    const [goblin] = idsOf(await act(g, "mob:add", { name: "Goblin", hpMax: 7, dexMod: 2 }));
    await act(g, "token:move", { id: goblin, pos: { col: 2, row: 8 } });
    // Parede comprida entre as linhas 4 e 5: o goblin fica do outro lado.
    const y = (hex.center({ col: 0, row: 4 }).y + hex.center({ col: 0, row: 5 }).y) / 2;
    await act(g, "wall:add", { from: { col: -4, row: Math.round(y * 100) / 100 }, to: { col: 10, row: Math.round(y * 100) / 100 } });
    await act(g, "effect:add", { name: "Teia", preset: "web", area: { ...AREA, kind: "sphere", origin: { col: 2.5, row: 12.12 } } });
    const hidden = stateWhere(ana, (state) => state.allies.some((ally) => ally.id === thorin && ally.pos !== null));
    await act(ana, "token:move", { id: thorin, pos: { col: 2, row: 2 } });
    let state = await hidden;
    assert.equal(state.battle.mobs.length, 0, "goblin atrás da parede");
    assert.equal(state.battle.effects.length, 0, "efeito atrás da parede");
    const seen = stateWhere(ana, (next) => next.battle.mobs.length === 1);
    await act(g, "wall:clear", {});
    state = await seen;
    assert.equal(state.battle.mobs[0].name, "Goblin");
    ana.disconnect();
    await act(g, "fog:set", { enabled: false });
    await act(g, "fog:vision", { enabled: false });
    await backToSquare(g);
  });

  it("parede comprida no hex chega ao jogador por qualquer hex que ela cruza", async () => {
    const g = await hexScene();
    const ana = await client("10.41.0.6");
    await join(ana, "Ana");
    await act(g, "fog:set", { enabled: true });
    const from = { col: 0.13, row: 0.41 };
    const to = { col: 9.87, row: 4.66 };
    await act(g, "wall:add", { from, to });
    // Os hexes que a parede cruza, amostrando o caminho bem de perto.
    const crossed = new Map<string, GridPos>();
    for (let i = 0; i <= 1000; i++) {
      const cell = hex.cellAt({ x: from.col + ((to.col - from.col) * i) / 1000, y: from.row + ((to.row - from.row) * i) / 1000 });
      crossed.set(keyOf(cell), cell);
    }
    const anaPlayer = [...ctx.server.store.players.values()].find((player) => player.name === "Ana")!;
    const host = hostInfo(0, "chave", ["http://mesa.test"]);
    const missing: string[] = [];
    for (const cell of crossed.values()) {
      battle().fog.revealed = {};
      paintFog(battle().fog, { col: cell.col, row: cell.row, w: 1, h: 1 }, true);
      if (viewFor(ctx.server.store, anaPlayer, host).battle.walls.length === 0) missing.push(keyOf(cell));
    }
    assert.deepEqual(missing, [], "a parede aparece com qualquer hex dela à vista");
    ana.disconnect();
    await act(g, "fog:set", { enabled: false });
    await backToSquare(g);
  });

  it("visto por último e NPC encontrado no hex", async () => {
    const g = await hexScene();
    await act(g, "fog:set", { enabled: true });
    await act(g, "fog:vision", { enabled: true });
    const ana = await client("10.41.0.5");
    await join(ana, "Ana");
    const [thorin] = idsOf(await act(ana, "ally:create", { name: "Thorin", hpMax: 30, dexMod: 1 }));
    await act(ana, "token:move", { id: thorin, pos: { col: 2, row: 2 } });
    const [ogro] = idsOf(await act(g, "mob:add", { name: "Ogro", hpMax: 59, dexMod: -1, size: "large" }));
    const [guarda] = idsOf(await act(g, "npc:add", { name: "Guarda", hpMax: 11, dexMod: 1 }));
    await act(g, "token:move", { id: guarda, pos: { col: 4, row: 2 } });
    await act(g, "token:move", { id: ogro, pos: { col: 2, row: 6 } });
    assert.deepEqual(battle().fog.foundNpcs, [guarda], "NPC visto entra nos encontrados");
    // Uma parede entre eles: o ogro some da vista e deixa a marca.
    const y = (hex.center({ col: 0, row: 4 }).y + hex.center({ col: 0, row: 5 }).y) / 2;
    await act(g, "wall:add", { from: { col: -4, row: Math.round(y * 100) / 100 }, to: { col: 10, row: Math.round(y * 100) / 100 } });
    assert.deepEqual(battle().fog.lastSeen.map((mark) => mark.id), [ogro]);
    // Cobrir só o hex que completaria o 2×2 do quadrado não mexe na marca: ele não é da forma do Grande no hex.
    assert.deepEqual(hex.footprint({ col: 2, row: 6 }, "large").some((cell) => cell.col === 3 && cell.row === 7), false);
    await act(g, "fog:paint", { reveal: false, rects: [{ col: 3, row: 7, w: 1, h: 1 }] });
    assert.equal(battle().fog.lastSeen.length, 1, "a marca continua");
    // Cobrir um hex da forma, sim.
    await act(g, "fog:paint", { reveal: false, rects: [{ col: 3, row: 6, w: 1, h: 1 }] });
    assert.equal(battle().fog.lastSeen.length, 0, "a marca some");
    await act(g, "wall:clear", {});
    await act(g, "token:move", { id: ogro, pos: { col: 30, row: 30 } });
    assert.equal(battle().fog.lastSeen.length, 0);
    ana.disconnect();
    await act(g, "fog:set", { enabled: false });
    await act(g, "fog:vision", { enabled: false });
    await backToSquare(g);
  });

  it("efeito que anda com o token solta ao trocar o grid (a posição em relação ao token não vale na outra grade)", async () => {
    const g = await gm();
    await act(g, "battle:clear", { keepTemplates: false });
    await backToSquare(g);
    const [clerigo] = idsOf(await act(g, "mob:add", { name: "Clérigo", hpMax: 20, dexMod: 0 }));
    await act(g, "token:move", { id: clerigo, pos: { col: 2, row: 2 } });
    const [aura] = idsOf(await act(g, "effect:add", { name: "Espíritos", preset: "custom", area: AREA, casterId: clerigo, follow: true }));
    assert.equal(battle().effects.find((effect) => effect.id === aura)?.followId, clerigo, "preparação");
    assert.ok((await act(g, "battle:grid", { grid: "hexCols" })).ok);
    const kept = battle().effects.find((effect) => effect.id === aura);
    assert.ok(kept, "a área fica");
    assert.equal(kept.followId, undefined, "mas não anda mais com o token");
    assert.ok((await act(g, "effect:follow", { id: aura, follow: true })).ok, "no hex, dá para prender de novo");
    await backToSquare(g);
  });

  it("área no hex é repassada com a origem no hex", async () => {
    const g = await hexScene();
    const ana = await client("10.41.0.3");
    await join(ana, "Ana");
    // A área chega por evento: sem ela, falha em 2 s em vez de travar o teste.
    const next = () =>
      new Promise<AreaBroadcast>((resolve, reject) => {
        const timer = setTimeout(() => reject(new Error("a área não chegou")), 2000);
        g.once("area", (area: AreaBroadcast) => (clearTimeout(timer), resolve(area)));
      });
    const origin = { col: 1.5, row: 1.44 };
    let arrived = next();
    ana.emit("area:update", { ...AREA, kind: "sphere", origin });
    assert.deepEqual((await arrived).area?.origin, origin);
    arrived = next();
    ana.emit("area:update", { ...AREA, kind: "sphere", origin: { col: 1.234, row: 2 } });
    assert.deepEqual((await arrived).area?.origin, { col: 1.23, row: 2 });
    arrived = next();
    ana.emit("area:update", { ...AREA, kind: "sphere", origin: { col: Number.NaN, row: 2 } });
    assert.equal((await arrived).area, null);
    ana.disconnect();
    await backToSquare(g);
  });

  it("fixar efeito, pintar e espalhar objetos no hex", async () => {
    const g = await hexScene();
    const center = hex.center({ col: 2, row: 2 });
    const origin = { col: Math.round(center.x * 100) / 100, row: Math.round(center.y * 100) / 100 };
    const [teia] = idsOf(await act(g, "effect:add", { name: "Teia", preset: "web", area: { ...AREA, kind: "sphere", origin } }));
    assert.deepEqual(battle().effects.find((effect) => effect.id === teia)?.area.origin, origin);
    assert.ok((await act(g, "effect:paint", { preset: "fire", cells: [1, 1, 2, 1] })).ok);
    assert.ok((await act(g, "prop:addMany", { items: [{ kind: "tree", col: 1.37, row: 2.61 }] })).ok);
    await backToSquare(g);
  });

  it("efeito preso ao token anda pelo centro do hex", async () => {
    const g = await hexScene();
    const [ogro] = idsOf(await act(g, "mob:add", { name: "Ogro", hpMax: 59, dexMod: -1, size: "large" }));
    await act(g, "token:move", { id: ogro, pos: { col: 2, row: 2 } });
    const middle = (pos: { col: number; row: number }) => hex.shapeCenter(pos, "large");
    const start = middle({ col: 2, row: 2 });
    const origin = { col: Math.round(start.x * 100) / 100, row: Math.round(start.y * 100) / 100 };
    const [aura] = idsOf(await act(g, "effect:add", { name: "Aura", preset: "custom", area: { ...AREA, kind: "sphere", origin }, casterId: ogro, follow: true }));
    assert.ok((await act(g, "token:move", { id: ogro, pos: { col: 3, row: 5 } })).ok);
    const moved = battle().effects.find((effect) => effect.id === aura)!.area.origin;
    const goal = middle({ col: 3, row: 5 });
    assert.ok(Math.abs(moved.col - goal.x) <= 0.011 && Math.abs(moved.row - goal.y) <= 0.011, `origem ${JSON.stringify(moved)} longe de ${JSON.stringify(goal)}`);
    assert.ok((await act(g, "effect:follow", { id: aura, follow: false })).ok);
    assert.ok((await act(g, "effect:follow", { id: aura, follow: true })).ok);
    await backToSquare(g);
  });

  it("área fixada no hex volta à meia casa ao trocar para quadrado e o arquivo continua carregando", async () => {
    const g = await hexScene();
    const [teia] = idsOf(await act(g, "effect:add", { name: "Teia", preset: "web", area: { ...AREA, kind: "sphere", origin: { col: 2.5, row: 2.31 } } }));
    await backToSquare(g);
    assert.deepEqual(battle().effects.find((effect) => effect.id === teia)?.area.origin, { col: 2.5, row: 2.5 }, "encaixa na meia casa mais perto");
    const exported = await g.timeout(2000).emitWithAck("session:export");
    assert.ok(exported.ok, exported.ok ? "" : exported.error);
    const imported = await g.timeout(2000).emitWithAck("session:import", exported.file);
    assert.ok(imported.ok, imported.ok ? "" : imported.error);
  });

  it("efeito preso ao token não escorrega depois de muitos passos no hex", async () => {
    const g = await hexScene();
    const [ogro] = idsOf(await act(g, "mob:add", { name: "Ogro", hpMax: 59, dexMod: -1, size: "large" }));
    await act(g, "token:move", { id: ogro, pos: { col: 3, row: 2 } });
    const start = hex.shapeCenter({ col: 3, row: 2 }, "large");
    const origin = { col: Math.round(start.x * 100) / 100, row: Math.round(start.y * 100) / 100 };
    const [aura] = idsOf(await act(g, "effect:add", { name: "Aura", preset: "custom", area: { ...AREA, kind: "sphere", origin }, casterId: ogro, follow: true }));
    // Sempre para baixo: o arredondamento a cada passo não pode se acumular.
    for (let row = 3; row <= 42; row++) assert.ok((await act(g, "token:move", { id: ogro, pos: { col: 3, row } })).ok);
    const moved = battle().effects.find((effect) => effect.id === aura)!.area.origin;
    const goal = hex.shapeCenter({ col: 3, row: 42 }, "large");
    assert.ok(Math.abs(moved.col - goal.x) <= 0.011 && Math.abs(moved.row - goal.y) <= 0.011, `origem ${JSON.stringify(moved)} longe de ${JSON.stringify(goal)}`);
    await backToSquare(g);
  });

  it("efeito fixado no hex vai e volta no arquivo de sessão", async () => {
    const g = await hexScene();
    const origin = { col: 2.5, row: 2.31 };
    const [teia] = idsOf(await act(g, "effect:add", { name: "Teia", preset: "web", area: { ...AREA, kind: "sphere", origin } }));
    const exported = await g.timeout(2000).emitWithAck("session:export");
    assert.ok(exported.ok, exported.ok ? "" : exported.error);
    const imported = await g.timeout(2000).emitWithAck("session:import", exported.file);
    assert.ok(imported.ok, imported.ok ? "" : imported.error);
    assert.deepEqual(battle().effects.find((effect) => effect.id === teia)?.area.origin, origin);
    await backToSquare(g);
  });
});
