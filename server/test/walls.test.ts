import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { isRevealed, type ActionResult } from "@rpg/shared";
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
  it("só o mestre traça e apaga; ponta inválida ou parede curta demais são recusadas", async () => {
    const { g, ana } = await setup();
    const [parede] = idsOf(await act(g, "wall:add", { from: { col: 0, row: 0 }, to: { col: 5, row: 0 } }));
    const [porta] = idsOf(await act(g, "wall:add", { from: { col: 5, row: 0 }, to: { col: 5, row: 1 }, door: true }));
    assert.deepEqual(game().battle.walls.find((w) => w.id === porta)?.door, { open: false });
    assert.equal((await act(ana, "wall:add", { from: { col: 0, row: 0 }, to: { col: 1, row: 0 } })).ok, false);
    assert.match(errorOf(await act(g, "wall:add", { from: { col: 2, row: 2 }, to: { col: 2, row: 2 } })), /curta demais/);
    assert.match(errorOf(await act(g, "wall:add", { from: { col: 2, row: 2 }, to: { col: 2.05, row: 2 } })), /curta demais/);
    assert.match(errorOf(await act(g, "wall:add", { from: { col: "1" as unknown as number, row: 0 }, to: { col: 1, row: 3 } })), /Ponta da parede inválida/);
    assert.match(errorOf(await act(g, "wall:add", { from: { col: Number.NaN, row: 0 }, to: { col: 1, row: 3 } })), /Ponta da parede inválida/);
    assert.equal((await act(ana, "wall:remove", { id: parede })).ok, false);
    assert.ok((await act(g, "wall:remove", { id: parede })).ok);
    assert.equal(game().battle.walls.length, 1);
    assert.ok((await act(g, "wall:clear", {})).ok);
    assert.equal(game().battle.walls.length, 0);
  });

  it("traço livre: pontas fracionadas valem, em centésimos de casa, e bloqueiam a passagem e a visão", async () => {
    const { g } = await setup();
    const [livre] = idsOf(await act(g, "wall:add", { from: { col: 0.333333, row: 2.25 }, to: { col: 3.7, row: 0.1 } }));
    assert.deepEqual(game().battle.walls.find((w) => w.id === livre), { id: livre, from: { col: 0.33, row: 2.25 }, to: { col: 3.7, row: 0.1 } });
    // Sala fechada por paredes livres, com a parede da direita no meio da casa 5 (x = 5,5): o cômodo
    // revela as casas 0 a 4 (o centro da casa 5 fica do lado de fora).
    for (const [from, to] of [
      [{ col: 0, row: 10 }, { col: 5.5, row: 10 }],
      [{ col: 5.5, row: 10 }, { col: 5.5, row: 13 }],
      [{ col: 5.5, row: 13 }, { col: 0, row: 13 }],
      [{ col: 0, row: 13 }, { col: 0, row: 10 }],
    ])
      assert.ok((await act(g, "wall:add", { from, to })).ok);
    await act(g, "fog:set", { enabled: true });
    assert.ok((await act(g, "fog:room", { cell: { col: 1, row: 11 }, reveal: true })).ok);
    const fog = game().battle.fog;
    assert.ok(isRevealed(fog, 4, 11) && isRevealed(fog, 0, 12));
    assert.ok(!isRevealed(fog, 5, 11), "a casa cortada pela parede fica de fora");
    // Exporta e importa: a ponta fracionada volta igual.
    const exported = await g.timeout(2000).emitWithAck("session:export");
    assert.ok(exported.ok);
    await act(g, "battle:clear", { keepTemplates: true });
    assert.ok((await g.timeout(2000).emitWithAck("session:import", exported.file)).ok);
    assert.deepEqual(game().battle.walls.find((w) => w.id === livre)?.from, { col: 0.33, row: 2.25 });
  });

  it("espessura da parede: de 0,1 a 1 casa, em centésimos; a padrão fica sem campo", async () => {
    const { g } = await setup();
    const [grossa] = idsOf(await act(g, "wall:add", { from: { col: 0, row: 0 }, to: { col: 4, row: 0 }, thickness: 0.6666 }));
    assert.equal(game().battle.walls.find((w) => w.id === grossa)?.thickness, 0.67);
    const [padrao] = idsOf(await act(g, "wall:add", { from: { col: 0, row: 1 }, to: { col: 4, row: 1 }, thickness: 0.18 }));
    assert.equal(game().battle.walls.find((w) => w.id === padrao)?.thickness, undefined);
    assert.match(errorOf(await act(g, "wall:add", { from: { col: 0, row: 2 }, to: { col: 4, row: 2 }, thickness: 1.5 })), /Espessura da parede/);
    assert.match(errorOf(await act(g, "wall:add", { from: { col: 0, row: 2 }, to: { col: 4, row: 2 }, thickness: 0.05 })), /Espessura da parede/);
  });

  it("estilo das paredes por cena: só o mestre escolhe, valor inválido é recusado, vai no arquivo", async () => {
    const { g, ana } = await setup();
    assert.equal((await act(ana, "battle:grid", { wallStyle: "wood" })).ok, false);
    assert.match(errorOf(await act(g, "battle:grid", { wallStyle: "lava" as never })), /Estilo de parede inválido/);
    assert.ok((await act(g, "battle:grid", { wallStyle: "rock", tableStyle: "leather" })).ok);
    assert.match(errorOf(await act(g, "battle:grid", { tableStyle: "marble" as never })), /Estilo de mesa inválido/);
    assert.equal(game().battle.map.tableStyle, "leather");
    assert.equal(game().battle.map.wallStyle, "rock");
    const exported = await g.timeout(2000).emitWithAck("session:export");
    assert.ok((await act(g, "battle:grid", { wallStyle: "stone" })).ok);
    assert.equal(game().battle.map.wallStyle, undefined, "pedra lavrada é o padrão (sem campo)");
    assert.ok((await g.timeout(2000).emitWithAck("session:import", exported.file)).ok);
    assert.equal(game().battle.map.wallStyle, "rock");
    assert.equal(game().battle.map.tableStyle, "leather");
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
