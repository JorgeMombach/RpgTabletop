import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { ActionResult } from "@rpg/shared";
import { act, join, stateWhere, useServer } from "./helpers";

// Paredes e portas no mapa (só visual).
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
  const ana = await client("10.40.0.1");
  await join(ana, "Ana");
  return { g, ana };
}

describe("paredes e portas", () => {
  it("só o mestre traça e apaga; ponta inválida ou parede de tamanho zero são recusadas", async () => {
    const { g, ana } = await setup();
    const [parede] = idsOf(await act(g, "wall:add", { from: { col: 0, row: 0 }, to: { col: 5, row: 0 } }));
    const [porta] = idsOf(await act(g, "wall:add", { from: { col: 5, row: 0 }, to: { col: 5, row: 1 }, door: true }));
    assert.deepEqual(game().battle.walls.find((w) => w.id === porta)?.door, { open: false });
    assert.equal((await act(ana, "wall:add", { from: { col: 0, row: 0 }, to: { col: 1, row: 0 } })).ok, false);
    assert.match(errorOf(await act(g, "wall:add", { from: { col: 2, row: 2 }, to: { col: 2, row: 2 } })), /de um canto a outro/);
    assert.equal((await act(g, "wall:add", { from: { col: 0.5, row: 0 }, to: { col: 1, row: 0 } })).ok, false);
    assert.equal((await act(ana, "wall:remove", { id: parede })).ok, false);
    assert.ok((await act(g, "wall:remove", { id: parede })).ok);
    assert.equal(game().battle.walls.length, 1);
    assert.ok((await act(g, "wall:clear", {})).ok);
    assert.equal(game().battle.walls.length, 0);
  });

  it("jogador abre e fecha a porta, menos a trancada; só o mestre tranca", async () => {
    const { g, ana } = await setup();
    const [porta] = idsOf(await act(g, "wall:add", { from: { col: 0, row: 0 }, to: { col: 1, row: 0 }, door: true }));
    const [parede] = idsOf(await act(g, "wall:add", { from: { col: 1, row: 0 }, to: { col: 3, row: 0 } }));
    const door = () => game().battle.walls.find((w) => w.id === porta)!.door!;
    assert.ok((await act(ana, "door:set", { id: porta, open: true })).ok);
    assert.equal(door().open, true);
    assert.match(errorOf(await act(ana, "door:set", { id: porta, locked: true })), /Só o mestre/);
    assert.match(errorOf(await act(ana, "door:set", { id: parede, open: true })), /não uma porta/);
    await act(g, "door:set", { id: porta, open: false, locked: true });
    assert.match(errorOf(await act(ana, "door:set", { id: porta, open: true })), /trancada/);
    assert.ok((await act(g, "door:set", { id: porta, open: true })).ok, "o mestre abre a trancada");
    await act(g, "door:set", { id: porta, locked: false });
    assert.equal(door().locked, undefined);
  });

  it("porta secreta não chega aos jogadores nem pode ser aberta por eles", async () => {
    const { g, ana } = await setup();
    const [secreta] = idsOf(await act(g, "wall:add", { from: { col: 2, row: 0 }, to: { col: 3, row: 0 }, door: true }));
    await act(g, "door:set", { id: secreta, secret: true });
    // Marcador: uma parede nova depois; o estado com ela já tem a porta secreta filtrada.
    const seen = stateWhere(ana, (s) => s.battle.walls.length > 0);
    const [marca] = idsOf(await act(g, "wall:add", { from: { col: 0, row: 0 }, to: { col: 2, row: 0 } }));
    assert.deepEqual((await seen).battle.walls.map((w) => w.id), [marca], "a secreta não vai");
    assert.match(errorOf(await act(ana, "door:set", { id: secreta, open: true })), /não encontrada/);
    const revealed = stateWhere(ana, (s) => s.battle.walls.length === 2);
    await act(g, "door:set", { id: secreta, secret: false });
    await revealed;
  });

  it("limpar o campo apaga paredes e portas", async () => {
    const { g } = await setup();
    await act(g, "wall:add", { from: { col: 0, row: 0 }, to: { col: 1, row: 0 } });
    await act(g, "battle:clear", { keepTemplates: true });
    assert.equal(game().battle.walls.length, 0);
  });
});
