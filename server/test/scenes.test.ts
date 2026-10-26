import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { ActionResult } from "@rpg/shared";
import { exportSession, importSession } from "../src/session-file";
import { act, join, stateWhere, useServer } from "./helpers";

// Vários mapas na sessão (cenas).
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

async function setup() {
  const g = await client();
  await join(g, "Mestre");
  const ana = await client("10.41.0.1");
  await join(ana, "Ana");
  return { g, ana };
}

describe("cenas", () => {
  it("trocar guarda a cena atual (mobs, desenhos, posições) e traz a outra inteira", async () => {
    const { g, ana } = await setup();
    const salao = game().sceneId;
    const [thorin] = idsOf(await act(ana, "ally:create", { name: "Thorin", hpMax: 30, dexMod: 1, ac: 18 }));
    await act(ana, "token:move", { id: thorin, pos: { col: 2, row: 2 } });
    const [goblin] = idsOf(await act(g, "mob:add", { name: "Goblin", hpMax: 7, dexMod: 2, ac: 15 }));
    await act(g, "draw:add", { kind: "arrow", points: [0, 0, 50, 50], color: "#c94a52", width: 4 });

    const [cripta] = idsOf(await act(g, "scene:add", { name: "  Cripta  " }));
    assert.equal(game().scenes.find((s) => s.id === cripta)?.name, "Cripta");
    assert.equal(game().sceneId, salao, "criar não troca");

    const imageVersion = game().battle.map.imageVersion;
    assert.ok((await act(g, "scene:switch", { id: cripta })).ok);
    assert.equal(game().sceneId, cripta);
    assert.deepEqual(game().battle.mobs, []);
    assert.deepEqual(game().battle.drawings, []);
    assert.equal(game().allies[0].pos, null, "o aliado ainda não foi posto nesta cena");
    assert.equal(game().battle.map.imageVersion, imageVersion + 1, "a imagem é reenviada");
    await act(ana, "token:move", { id: thorin, pos: { col: 7, row: 1 } });

    assert.ok((await act(g, "scene:switch", { id: salao })).ok);
    assert.equal(game().battle.mobs[0].id, goblin);
    assert.equal(game().battle.drawings.length, 1);
    assert.deepEqual(game().allies[0].pos, { col: 2, row: 2 }, "volta para onde estava no salão");
    assert.deepEqual(game().scenes.find((s) => s.id === cripta)?.stored?.allyPos, { [thorin]: { col: 7, row: 1 } });
  });

  it("só o mestre mexe nas cenas; não troca em combate; não apaga a atual; jogador não recebe a lista", async () => {
    const { g, ana } = await setup();
    const atual = game().sceneId;
    assert.equal((await act(ana, "scene:add", { name: "X" })).ok, false);
    assert.match(errorOf(await act(g, "scene:add", { name: "   " })), /nome/);
    const [outra] = idsOf(await act(g, "scene:add", { name: "Floresta" }));
    assert.equal((await act(ana, "scene:switch", { id: outra })).ok, false);

    const [lobo] = idsOf(await act(g, "mob:add", { name: "Lobo", hpMax: 11, dexMod: 2, ac: 13 }));
    await act(g, "init:set", { id: lobo, value: 12 });
    await act(g, "combat:start", {});
    assert.match(errorOf(await act(g, "scene:switch", { id: outra })), /Encerre o combate/);
    await act(g, "combat:end", {});
    assert.match(errorOf(await act(g, "scene:remove", { id: atual })), /cena atual/);

    const seen = stateWhere(ana, (s) => s.sceneId === outra);
    assert.ok((await act(g, "scene:switch", { id: outra })).ok);
    const s = await seen;
    assert.equal(s.scenes, undefined, "a lista é do mestre");
    await act(g, "scene:rename", { id: atual, name: "Estrada" });
    assert.ok((await act(g, "scene:remove", { id: atual })).ok);
    assert.equal(game().scenes.length, 1);
  });

  it("arquivo antigo (formato 1, sem cenas, desenhos nem paredes) abre como uma cena só", () => {
    const store = ctx.server.store;
    const gm = store.createPlayer("Mestre antigo", "gm");
    const file = JSON.parse(JSON.stringify(exportSession(store)));
    file.format = 1;
    delete file.game.scenes;
    delete file.game.sceneId;
    delete file.game.battle.drawings;
    delete file.game.battle.walls;
    importSession(store, gm, file);
    assert.equal(game().scenes.length, 1);
    assert.equal(game().scenes[0].id, game().sceneId);
    assert.equal(game().scenes[0].stored, undefined, "a única cena é a ativa");
    assert.deepEqual(game().battle.walls, []);
  });
});
