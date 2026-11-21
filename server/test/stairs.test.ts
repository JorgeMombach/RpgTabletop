import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { LIMITS, type ActionResult, type Stair } from "@rpg/shared";
import { exportSession, importSession } from "../src/session-file";
import { act, join, useServer, type Client } from "./helpers";

// Escadas (docs/design/escadas.md): peças do mapa da cena, só o mestre põe, muda e apaga.
const { ctx, client } = useServer();
const game = () => ctx.server.store.game;

function idsOf(res: ActionResult): string[] {
  assert.ok(res.ok, res.ok ? "" : res.error);
  return res.ids ?? [];
}

function errorOf(res: ActionResult): string {
  assert.equal(res.ok, false, "deveria recusar");
  return res.ok ? "" : res.error;
}

const path: Omit<Stair, "id"> = {
  shape: "path",
  points: [{ x: 2, y: 3 }, { x: 6.456, y: 3 }, { x: 6.5, y: 7 }],
  width: 2,
  material: "stone",
  exit: "up",
};
const spiral: Omit<Stair, "id"> = { shape: "spiral", points: [{ x: 10, y: 10 }, { x: 11, y: 10 }], width: 2, material: "wood", exit: "down" };
const ladder: Omit<Stair, "id"> = { shape: "ladder", points: [{ x: 20, y: 5 }, { x: 20, y: 3 }], width: 1, material: "wood", exit: "up" };

let ipSeq = 1;
async function setup() {
  const g: Client = await client();
  await join(g, "Mestre");
  const ana: Client = await client(`10.79.0.${ipSeq++}`);
  await join(ana, "Ana");
  // Cada teste começa sem escadas.
  game().battle.stairs = [];
  return { g, ana };
}

describe("escadas: servidor", () => {
  it("o mestre põe os três formatos, muda e apaga; o jogador é recusado", async () => {
    const { g, ana } = await setup();
    const [id] = idsOf(await act(g, "stair:add", path));
    assert.deepEqual(game().battle.stairs[0], { id, ...path, points: [{ x: 2, y: 3 }, { x: 6.46, y: 3 }, { x: 6.5, y: 7 }] });
    idsOf(await act(g, "stair:add", spiral));
    idsOf(await act(g, "stair:add", ladder));
    assert.deepEqual(
      game().battle.stairs.map((stair) => stair.shape),
      ["path", "spiral", "ladder"],
    );
    assert.ok((await act(g, "stair:update", { id, points: [{ x: 0, y: 0 }, { x: 5, y: 0 }], material: "wood", width: 3, exit: "down" })).ok);
    assert.deepEqual(game().battle.stairs[0], { id, shape: "path", points: [{ x: 0, y: 0 }, { x: 5, y: 0 }], width: 3, material: "wood", exit: "down" });
    assert.match(errorOf(await act(ana, "stair:add", path)), /permissão/);
    assert.match(errorOf(await act(ana, "stair:update", { id, width: 1 })), /permissão/);
    assert.match(errorOf(await act(ana, "stair:remove", { ids: [id] })), /permissão/);
    await act(g, "stair:remove", { ids: [id] });
    assert.deepEqual(
      game().battle.stairs.map((stair) => stair.shape),
      ["spiral", "ladder"],
    );
  });

  it("a escada de mão é sempre de madeira e de largura 1", async () => {
    const { g } = await setup();
    const [id] = idsOf(await act(g, "stair:add", { ...ladder, material: "stone", width: 3 }));
    assert.deepEqual(game().battle.stairs[0], { id, ...ladder });
    assert.ok((await act(g, "stair:update", { id, material: "stone", width: 2 })).ok);
    assert.deepEqual(game().battle.stairs[0], { id, ...ladder });
  });

  it("recusas não mudam nada", async () => {
    const { g } = await setup();
    const [id] = idsOf(await act(g, "stair:add", path));
    const before = structuredClone(game().battle.stairs);
    assert.match(errorOf(await act(g, "stair:add", { ...path, shape: "rampa" as Stair["shape"] })), /Escada inválida/);
    assert.match(errorOf(await act(g, "stair:add", { ...path, material: "ouro" as Stair["material"] })), /Escada inválida/);
    assert.match(errorOf(await act(g, "stair:add", { ...path, width: 4 as Stair["width"] })), /Escada inválida/);
    assert.match(errorOf(await act(g, "stair:add", { ...path, exit: "lado" as Stair["exit"] })), /Escada inválida/);
    assert.match(errorOf(await act(g, "stair:add", { ...path, points: [{ x: 2, y: Number.NaN }, { x: 6, y: 3 }] })), /Escada inválida/);
    assert.match(errorOf(await act(g, "stair:add", { ...path, points: [{ x: 2, y: 3 }] })), /Escada inválida/);
    const many = Array.from({ length: LIMITS.stairPoints + 1 }, (_, index) => ({ x: index, y: index % 2 }));
    assert.match(errorOf(await act(g, "stair:add", { ...path, points: many })), /Escada inválida/);
    assert.match(errorOf(await act(g, "stair:add", { ...spiral, points: [...spiral.points, { x: 12, y: 10 }] })), /Escada inválida/);
    assert.match(errorOf(await act(g, "stair:add", { ...ladder, points: [ladder.points[0]] })), /Escada inválida/);
    assert.match(errorOf(await act(g, "stair:add", { ...path, points: [{ x: 2, y: 3 }, { x: 2.5, y: 3 }] })), /Escada curta demais/);
    assert.match(errorOf(await act(g, "stair:add", { ...path, points: [{ x: 2, y: 3 }, { x: 45, y: 3 }] })), /Escada longa demais/);
    assert.match(errorOf(await act(g, "stair:add", { ...ladder, points: [{ x: 0, y: 0 }, { x: 0, y: 0.5 }] })), /Escada curta demais/);
    assert.match(errorOf(await act(g, "stair:add", { ...ladder, points: [{ x: 0, y: 0 }, { x: 0, y: 5 }] })), /Escada longa demais/);
    assert.match(errorOf(await act(g, "stair:add", { ...spiral, points: [{ x: 0, y: 0 }, { x: 0, y: 0 }] })), /Escada inválida/);
    assert.match(errorOf(await act(g, "stair:update", { id: "nenhuma", width: 1 })), /Escada não encontrada/);
    assert.match(errorOf(await act(g, "stair:update", { id, points: [{ x: 2, y: 3 }, { x: 2.2, y: 3 }] })), /curta demais/);
    assert.deepEqual(game().battle.stairs, before);
  });

  it("limite de escadas da cena", async () => {
    const { g } = await setup();
    for (let index = 0; index < LIMITS.stairs; index++) idsOf(await act(g, "stair:add", { ...ladder, points: [{ x: index, y: 0 }, { x: index, y: 2 }] }));
    assert.match(errorOf(await act(g, "stair:add", path)), /Limite de escadas/);
    assert.equal(game().battle.stairs.length, LIMITS.stairs);
  });

  it("são da cena: trocar de cena guarda e devolve; trocar o grid mantém; limpar o campo apaga", async () => {
    const { g } = await setup();
    const salao = game().sceneId;
    const [escada] = idsOf(await act(g, "stair:add", path));
    const [porao] = idsOf(await act(g, "scene:add", { name: "Porão" }));
    await act(g, "scene:switch", { id: porao });
    assert.deepEqual(game().battle.stairs, []);
    await act(g, "scene:switch", { id: salao });
    assert.deepEqual(game().battle.stairs.map((stair) => stair.id), [escada]);
    assert.ok((await act(g, "battle:grid", { grid: "hexRows" })).ok);
    assert.deepEqual(game().battle.stairs.map((stair) => stair.id), [escada]);
    assert.ok((await act(g, "battle:grid", { grid: "square" })).ok);
    await act(g, "battle:clear", { keepTemplates: true });
    assert.deepEqual(game().battle.stairs, []);
  });

  it("vai e volta no arquivo de sessão; arquivo antigo, sem escadas, abre sem nenhuma", async () => {
    const { g } = await setup();
    await act(g, "stair:add", path);
    await act(g, "stair:add", ladder);
    const saved = structuredClone(game().battle.stairs);
    const store = ctx.server.store;
    const file = JSON.parse(JSON.stringify(exportSession(store)));
    game().battle.stairs = [];
    importSession(store, store.createPlayer("Mestre do arquivo", "gm"), file);
    assert.deepEqual(game().battle.stairs, saved);
    delete file.game.battle.stairs;
    importSession(store, store.createPlayer("Mestre antigo", "gm"), file);
    assert.deepEqual(game().battle.stairs, []);
  });
});
