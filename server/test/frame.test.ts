import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { ActionResult } from "@rpg/shared";
import { exportSession, importSession } from "../src/session-file";
import { act, join, useServer, type Client } from "./helpers";

// Moldura da cena (docs/design/moldura.md): opcional; com ela, nada é posto fora; o que já estava fora não é apagado.
const { ctx, client } = useServer();
const game = () => ctx.server.store.game;
const OUTSIDE = "Fora da moldura.";

function ok(res: ActionResult): string[] {
  assert.ok(res.ok, res.ok ? "" : res.error);
  return res.ids ?? [];
}

function outside(res: ActionResult) {
  assert.equal(res.ok, false, "deveria recusar");
  assert.equal(res.ok ? "" : res.error, OUTSIDE);
}

async function freshGm(): Promise<Client> {
  const gm = await client();
  await join(gm, "Mestre");
  await act(gm, "battle:clear", { keepTemplates: false });
  await act(gm, "battle:grid", { frame: null });
  return gm;
}

async function withFrame(gm: Client, cols = 10, rows = 8) {
  ok(await act(gm, "battle:grid", { frame: { cols, rows, style: "bronze" } }));
}

describe("moldura da cena", () => {
  it("liga, muda e desliga; tamanho e desenho conferidos", async () => {
    const gm = await freshGm();
    await withFrame(gm, 20, 12);
    assert.deepEqual(game().battle.map.frame, { cols: 20, rows: 12, style: "bronze" });
    assert.equal((await act(gm, "battle:grid", { frame: { cols: 3, rows: 12, style: "wood" } })).ok, false, "menor que 4");
    assert.equal((await act(gm, "battle:grid", { frame: { cols: 20, rows: 201, style: "wood" } })).ok, false, "maior que 200");
    // desenho que não existe (vindo de fora, sem tipo)
    assert.equal((await act(gm, "battle:grid", { frame: JSON.parse('{"cols":20,"rows":12,"style":"gold"}') })).ok, false, "desenho");
    assert.equal((await act(gm, "battle:grid", { frame: { cols: 20.5, rows: 12, style: "wood" } })).ok, false, "inteiro");
    // trocar o grid mantém a moldura nas mesmas casas
    ok(await act(gm, "battle:grid", { cellPx: 80 }));
    assert.deepEqual(game().battle.map.frame, { cols: 20, rows: 12, style: "bronze" });
    ok(await act(gm, "battle:grid", { frame: null }));
    assert.equal(game().battle.map.frame, undefined);
  });

  it("tokens: mover para fora é recusado; o token grande tem que caber inteiro; juntar o grupo fora também", async () => {
    const gm = await freshGm();
    const [id] = ok(await act(gm, "mob:add", { name: "Lobo", hpMax: 10, dexMod: 0, ac: 12, size: "medium" }));
    const [big] = ok(await act(gm, "mob:add", { name: "Ogro", hpMax: 30, dexMod: 0, ac: 11, size: "large" }));
    ok(await act(gm, "token:move", { id, pos: { col: 2, row: 2 } }));
    await withFrame(gm);
    outside(await act(gm, "token:move", { id, pos: { col: 10, row: 2 } }));
    assert.deepEqual(game().battle.mobs.find((mob) => mob.id === id)?.pos, { col: 2, row: 2 }, "a recusa não mexe");
    ok(await act(gm, "token:move", { id, pos: { col: 9, row: 7 } }));
    outside(await act(gm, "token:move", { id: big, pos: { col: 9, row: 3 } }));
    ok(await act(gm, "token:move", { id: big, pos: { col: 8, row: 3 } }));
    // tirar do mapa continua valendo
    ok(await act(gm, "token:move", { id, pos: null }));
    const ana = await client("10.70.0.1");
    await join(ana, "Ana");
    outside(await act(gm, "allies:gather", { at: { col: 30, row: 2 } }));
  });

  it("cenário: objeto, tocha, baú, parede, ponte, escada, correnteza, efeito e desenho fora são recusados", async () => {
    const gm = await freshGm();
    await withFrame(gm);
    outside(await act(gm, "prop:add", { kind: "tree", col: 11, row: 2 }));
    outside(await act(gm, "prop:addMany", { items: [{ kind: "bush", col: 2, row: 2 }, { kind: "bush", col: 2, row: 9 }] }));
    outside(await act(gm, "maptorch:add", { col: 10.5, row: 2, style: "stick" }));
    outside(await act(gm, "chest:add", { col: 10, row: 2, style: "wood" }));
    outside(await act(gm, "wall:add", { from: { col: 2, row: 2 }, to: { col: 12, row: 2 } }));
    outside(await act(gm, "bridge:add", { from: { x: 2, y: 2 }, to: { x: 2, y: 9 }, width: 1, kind: "plank" }));
    outside(await act(gm, "stair:add", { shape: "path", points: [{ x: 2, y: 2 }, { x: 11, y: 2 }], width: 1, material: "stone", exit: "up" }));
    outside(await act(gm, "current:add", { points: [2, 2, 12, 2] }));
    outside(await act(gm, "effect:add", { name: "", preset: "fire", area: { kind: "sphere", origin: { col: 11, row: 2 }, angle: 0, feet: 10 } }));
    const { cellPx, offsetX, offsetY } = game().battle.map;
    const px = (col: number) => offsetX + col * cellPx;
    const py = (row: number) => offsetY + row * cellPx;
    outside(await act(gm, "draw:add", { kind: "arrow", points: [px(2), py(2), px(12), py(2)], color: "#ffffff", width: 3 }));
    // dentro: tudo passa
    const [prop] = ok(await act(gm, "prop:add", { kind: "tree", col: 2, row: 2 }));
    const [torch] = ok(await act(gm, "maptorch:add", { col: 3, row: 3, style: "stick" }));
    ok(await act(gm, "chest:add", { col: 4, row: 4, style: "wood" }));
    ok(await act(gm, "wall:add", { from: { col: 1, row: 6 }, to: { col: 5, row: 6 } }));
    const [bridge] = ok(await act(gm, "bridge:add", { from: { x: 6, y: 1 }, to: { x: 6, y: 4 }, width: 1, kind: "plank" }));
    ok(await act(gm, "stair:add", { shape: "path", points: [{ x: 7, y: 1 }, { x: 9, y: 1 }], width: 1, material: "stone", exit: "up" }));
    ok(await act(gm, "current:add", { points: [1, 7, 4, 7] }));
    ok(await act(gm, "effect:add", { name: "", preset: "fire", area: { kind: "sphere", origin: { col: 5, row: 5 }, angle: 0, feet: 10 } }));
    ok(await act(gm, "draw:add", { kind: "arrow", points: [px(2), py(2), px(4), py(2)], color: "#ffffff", width: 3 }));
    // mover para fora também
    outside(await act(gm, "prop:update", { id: prop, col: 12 }));
    outside(await act(gm, "maptorch:move", { id: torch, col: 12, row: 3 }));
    outside(await act(gm, "bridge:update", { id: bridge, to: { x: 6, y: 12 } }));
  });

  it("o que já estava fora não é apagado; desligar a moldura volta a deixar pôr fora", async () => {
    const gm = await freshGm();
    ok(await act(gm, "prop:add", { kind: "tree", col: 15, row: 2 }));
    ok(await act(gm, "maptorch:add", { col: 15, row: 3, style: "stick" }));
    await withFrame(gm);
    assert.equal(game().battle.props.length, 1);
    assert.equal(game().battle.torches.length, 1);
    ok(await act(gm, "battle:grid", { frame: null }));
    ok(await act(gm, "prop:add", { kind: "tree", col: 15, row: 5 }));
  });

  it("vai no arquivo de sessão; arquivo antigo abre sem moldura", async () => {
    const gm = await freshGm();
    await withFrame(gm, 30, 20);
    const master = [...ctx.server.store.players.values()].find((player) => player.role === "gm");
    assert.ok(master);
    const file = JSON.parse(JSON.stringify(exportSession(ctx.server.store)));
    await act(gm, "battle:grid", { frame: null });
    importSession(ctx.server.store, master, file);
    assert.deepEqual(game().battle.map.frame, { cols: 30, rows: 20, style: "bronze" });
    delete file.game.battle.map.frame;
    importSession(ctx.server.store, master, file);
    assert.equal(game().battle.map.frame, undefined);
  });
});
