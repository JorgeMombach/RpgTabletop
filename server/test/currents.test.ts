import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { LIMITS, type ActionResult } from "@rpg/shared";
import { exportSession, importSession } from "../src/session-file";
import { act, join, useServer, type Client } from "./helpers";

// Água animada (docs/design/agua.md): linhas de correnteza que o mestre risca, dado da cena.
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

let ipSeq = 1;
async function setup() {
  const g: Client = await client();
  await join(g, "Mestre");
  const ana: Client = await client(`10.77.0.${ipSeq++}`);
  await join(ana, "Ana");
  // Cada teste começa com a cena sem correnteza.
  for (const current of [...game().battle.currents]) await act(g, "current:remove", { ids: [current.id] });
  return { g, ana };
}

describe("correnteza da água", () => {
  it("o mestre risca e apaga; jogador e linha inválida são recusados", async () => {
    const { g, ana } = await setup();
    const [rio] = idsOf(await act(g, "current:add", { points: [1, 1, 4.567, 2, 8, 6] }));
    assert.deepEqual(game().battle.currents, [{ id: rio, points: [1, 1, 4.57, 2, 8, 6] }]);
    assert.match(errorOf(await act(ana, "current:add", { points: [0, 0, 1, 1] })), /permissão/);
    assert.match(errorOf(await act(g, "current:add", { points: [1, 1] })), /Correnteza inválida/);
    assert.match(errorOf(await act(g, "current:add", { points: [1, 1, 2] })), /Correnteza inválida/);
    assert.match(errorOf(await act(g, "current:add", { points: [1, 1, Number.NaN, 2] })), /Correnteza inválida/);
    const long = Array.from({ length: LIMITS.currentNumbers + 2 }, (_, index) => index / 10);
    assert.match(errorOf(await act(g, "current:add", { points: long })), /longa demais/);
    assert.match(errorOf(await act(ana, "current:remove", { ids: [rio] })), /permissão/);
    await act(g, "current:remove", { ids: [rio] });
    assert.deepEqual(game().battle.currents, []);
  });

  it("teto de linhas por cena", async () => {
    const { g } = await setup();
    for (let index = 0; index < LIMITS.currents; index++) idsOf(await act(g, "current:add", { points: [0, index, 5, index] }));
    assert.match(errorOf(await act(g, "current:add", { points: [0, 0, 5, 5] })), /Limite de correntezas/);
    assert.equal(game().battle.currents.length, LIMITS.currents);
  });

  it("as linhas são da cena: trocar de cena guarda e devolve; limpar o campo apaga", async () => {
    const { g } = await setup();
    const salao = game().sceneId;
    const [rio] = idsOf(await act(g, "current:add", { points: [2, 2, 6, 3] }));
    const [cripta] = idsOf(await act(g, "scene:add", { name: "Cripta" }));
    await act(g, "scene:switch", { id: cripta });
    assert.deepEqual(game().battle.currents, []);
    await act(g, "scene:switch", { id: salao });
    assert.deepEqual(game().battle.currents.map((current) => current.id), [rio]);
    await act(g, "battle:clear", { keepTemplates: true });
    assert.deepEqual(game().battle.currents, []);
  });

  it("vai e volta no arquivo de sessão", async () => {
    const { g } = await setup();
    await act(g, "current:add", { points: [1, 2, 3, 4, 5, 6] });
    const saved = game().battle.currents.map((current) => current.points);
    const store = ctx.server.store;
    const file = JSON.parse(JSON.stringify(exportSession(store)));
    game().battle.currents = [];
    importSession(store, store.createPlayer("Mestre do arquivo", "gm"), file);
    assert.deepEqual(game().battle.currents.map((current) => current.points), saved);
  });

  it("arquivo antigo, sem correnteza, abre sem linhas", () => {
    const store = ctx.server.store;
    const file = JSON.parse(JSON.stringify(exportSession(store)));
    delete file.game.battle.currents;
    importSession(store, store.createPlayer("Mestre antigo", "gm"), file);
    assert.deepEqual(game().battle.currents, []);
  });
});
