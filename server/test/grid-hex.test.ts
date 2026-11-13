import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { geometryOf, shapesOverlap, type ActionPayloads, type ActionResult, type Area } from "@rpg/shared";
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

  it("ações só do quadrado são recusadas no hex", async () => {
    const g = await hexScene();
    const refusals: [keyof ActionPayloads, ActionPayloads[keyof ActionPayloads]][] = [
      ["wall:add", { from: { col: 1, row: 1 }, to: { col: 3, row: 1 } }],
      ["wall:erase", { points: [10, 10, 50, 50], radius: 10 }],
      ["fog:set", { enabled: true }],
      ["fog:paint", { reveal: true, rects: [{ col: 0, row: 0, w: 2, h: 2 }] }],
      ["fog:room", { cell: { col: 0, row: 0 }, reveal: true }],
      ["fog:vision", { enabled: true }],
      ["effect:add", { name: "Teia", preset: "web", area: AREA }],
      ["effect:paint", { preset: "fire", cells: [1, 1] }],
      ["prop:addMany", { items: [{ kind: "tree", col: 1, row: 1 }] }],
    ];
    for (const [action, payload] of refusals) {
      assert.match(errorOf(await act(g, action, payload as never)), /Ainda não disponível no grid hexagonal/, action);
    }
    assert.ok((await act(g, "prop:add", { kind: "barrel", col: 2, row: 2 })).ok, "objeto avulso continua");
    await backToSquare(g);
    for (const [action, payload] of refusals) {
      const res = await act(g, action, payload as never);
      assert.doesNotMatch(res.ok ? "" : res.error, /grid hexagonal/, `${action} no quadrado`);
    }
  });

  it("área no hex não é repassada", async () => {
    const g = await hexScene();
    const ana = await client("10.41.0.3");
    await join(ana, "Ana");
    let received = false;
    g.on("area", () => (received = true));
    ana.emit("area:update", AREA);
    await new Promise((resolve) => setTimeout(resolve, 300));
    assert.equal(received, false);
    g.off("area");
    ana.disconnect();
    await backToSquare(g);
  });
});
