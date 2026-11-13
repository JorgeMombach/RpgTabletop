import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { ActionResult, Area } from "@rpg/shared";
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
    await act(g, "wall:add", { from: { col: 1, row: 1 }, to: { col: 3, row: 1 } });
    assert.ok((await act(g, "battle:grid", { grid: "hexRows", showGrid: true })).ok);
    assert.equal(battle().walls.length, 1);
    await backToSquare(g);
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
