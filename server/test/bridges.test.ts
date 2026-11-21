import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { LIMITS, type ActionResult, type Bridge } from "@rpg/shared";
import { exportSession, importSession } from "../src/session-file";
import { act, join, useServer, type Client } from "./helpers";

// Pontes (docs/design/pontes.md): peças do mapa da cena, só o mestre põe, muda e apaga.
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

const plank: Omit<Bridge, "id"> = { from: { x: 2, y: 3 }, to: { x: 8.456, y: 3 }, width: 2, kind: "plank" };

let ipSeq = 1;
async function setup() {
  const g: Client = await client();
  await join(g, "Mestre");
  const ana: Client = await client(`10.78.0.${ipSeq++}`);
  await join(ana, "Ana");
  // Cada teste começa sem pontes.
  game().battle.bridges = [];
  return { g, ana };
}

describe("pontes: servidor", () => {
  it("o mestre põe, muda e apaga; o jogador é recusado", async () => {
    const { g, ana } = await setup();
    const [id] = idsOf(await act(g, "bridge:add", plank));
    assert.deepEqual(game().battle.bridges, [{ id, from: { x: 2, y: 3 }, to: { x: 8.46, y: 3 }, width: 2, kind: "plank" }]);
    assert.ok((await act(g, "bridge:update", { id, kind: "stone", width: 3, to: { x: 9, y: 4 } })).ok);
    assert.deepEqual(game().battle.bridges[0], { id, from: { x: 2, y: 3 }, to: { x: 9, y: 4 }, width: 3, kind: "stone" });
    assert.match(errorOf(await act(ana, "bridge:add", plank)), /permissão/);
    assert.match(errorOf(await act(ana, "bridge:update", { id, width: 1 })), /permissão/);
    assert.match(errorOf(await act(ana, "bridge:remove", { ids: [id] })), /permissão/);
    await act(g, "bridge:remove", { ids: [id] });
    assert.deepEqual(game().battle.bridges, []);
  });

  it("recusas não mudam nada", async () => {
    const { g } = await setup();
    const [id] = idsOf(await act(g, "bridge:add", plank));
    const before = structuredClone(game().battle.bridges);
    assert.match(errorOf(await act(g, "bridge:add", { ...plank, kind: "lava" as Bridge["kind"] })), /Ponte inválida/);
    assert.match(errorOf(await act(g, "bridge:add", { ...plank, width: 4 as Bridge["width"] })), /Ponte inválida/);
    assert.match(errorOf(await act(g, "bridge:add", { ...plank, to: { x: 2.5, y: 3 } })), /curta demais/);
    assert.match(errorOf(await act(g, "bridge:add", { ...plank, to: { x: 43, y: 3 } })), /longa demais/);
    assert.match(errorOf(await act(g, "bridge:add", { ...plank, to: { x: Number.NaN, y: 3 } })), /Ponte inválida/);
    assert.match(errorOf(await act(g, "bridge:update", { id: "nenhuma", width: 1 })), /Ponte não encontrada/);
    assert.match(errorOf(await act(g, "bridge:update", { id, to: { x: 2.2, y: 3 } })), /curta demais/);
    assert.deepEqual(game().battle.bridges, before);
  });

  it("limite de pontes da cena", async () => {
    const { g } = await setup();
    for (let index = 0; index < LIMITS.bridges; index++) idsOf(await act(g, "bridge:add", { ...plank, from: { x: 0, y: index }, to: { x: 3, y: index } }));
    assert.match(errorOf(await act(g, "bridge:add", plank)), /Limite de pontes/);
    assert.equal(game().battle.bridges.length, LIMITS.bridges);
  });

  it("são da cena: trocar de cena guarda e devolve; trocar o grid mantém; limpar o campo apaga", async () => {
    const { g } = await setup();
    const salao = game().sceneId;
    const [ponte] = idsOf(await act(g, "bridge:add", plank));
    const [cripta] = idsOf(await act(g, "scene:add", { name: "Cripta" }));
    await act(g, "scene:switch", { id: cripta });
    assert.deepEqual(game().battle.bridges, []);
    await act(g, "scene:switch", { id: salao });
    assert.deepEqual(game().battle.bridges.map((bridge) => bridge.id), [ponte]);
    assert.ok((await act(g, "battle:grid", { grid: "hexRows" })).ok);
    assert.deepEqual(game().battle.bridges.map((bridge) => bridge.id), [ponte]);
    assert.ok((await act(g, "battle:grid", { grid: "square" })).ok);
    await act(g, "battle:clear", { keepTemplates: true });
    assert.deepEqual(game().battle.bridges, []);
  });

  it("vai e volta no arquivo de sessão; arquivo antigo, sem pontes, abre sem nenhuma", async () => {
    const { g } = await setup();
    await act(g, "bridge:add", plank);
    const saved = structuredClone(game().battle.bridges);
    const store = ctx.server.store;
    const file = JSON.parse(JSON.stringify(exportSession(store)));
    game().battle.bridges = [];
    importSession(store, store.createPlayer("Mestre do arquivo", "gm"), file);
    assert.deepEqual(game().battle.bridges, saved);
    delete file.game.battle.bridges;
    importSession(store, store.createPlayer("Mestre antigo", "gm"), file);
    assert.deepEqual(game().battle.bridges, []);
  });
});
