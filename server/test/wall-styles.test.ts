import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { blocks, isRevealed, sightCells, type ActionResult, type Wall } from "@rpg/shared";
import { act, join, useServer } from "./helpers";

// Cenário, passo 1 (docs/design/cenario.md): cada parede com o próprio desenho; cerca, grade, arame, sebe e
// muro baixo deixam ver.
const { ctx, client } = useServer();
const walls = () => ctx.server.store.game.battle.walls;

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
  const ana = await client("10.73.0.1");
  await join(ana, "Ana");
  return { g, ana };
}

const line = (style?: Wall["style"], door?: Wall["door"]): Wall => ({ id: "x", from: { col: 3, row: 0 }, to: { col: 3, row: 6 }, ...(style && { style }), ...(door && { door }) });

describe("desenho por parede", () => {
  it("parede nova guarda o desenho; sem desenho fica sem campo; desenho inválido é recusado", async () => {
    const { g } = await setup();
    const [cerca] = idsOf(await act(g, "wall:add", { from: { col: 0, row: 0 }, to: { col: 3, row: 0 }, style: "fence" }));
    const [simples] = idsOf(await act(g, "wall:add", { from: { col: 0, row: 1 }, to: { col: 3, row: 1 } }));
    assert.equal(walls().find((w) => w.id === cerca)?.style, "fence");
    assert.equal("style" in walls().find((w) => w.id === simples)!, false);
    assert.match(errorOf(await act(g, "wall:add", { from: { col: 0, row: 2 }, to: { col: 3, row: 2 }, style: "lava" as "fence" })), /Desenho de parede inválido/);
    assert.equal(walls().length, 2);
  });

  it("trocar o desenho: só o mestre, de várias de uma vez; null volta ao da cena; id desconhecido recusa sem mudar nada", async () => {
    const { g, ana } = await setup();
    const [a] = idsOf(await act(g, "wall:add", { from: { col: 0, row: 0 }, to: { col: 3, row: 0 } }));
    const [b] = idsOf(await act(g, "wall:add", { from: { col: 3, row: 0 }, to: { col: 4, row: 0 }, door: true }));
    assert.ok((await act(g, "wall:style", { ids: [a, b], style: "iron" })).ok);
    assert.deepEqual(
      walls().map((w) => w.style),
      ["iron", "iron"],
    );
    assert.deepEqual(walls()[1].door, { open: false }, "a porta continua porta");
    assert.match(errorOf(await act(ana, "wall:style", { ids: [a], style: "brick" })), /permissão/);
    assert.match(errorOf(await act(g, "wall:style", { ids: [a, "nada"], style: "brick" })), /não encontrada/);
    assert.equal(walls()[0].style, "iron");
    assert.ok((await act(g, "wall:style", { ids: [a], style: null })).ok);
    assert.equal("style" in walls()[0], false);
  });

  it("a borracha corta a parede e os pedaços mantêm o desenho", async () => {
    const { g } = await setup();
    await act(g, "wall:add", { from: { col: 0, row: 0 }, to: { col: 6, row: 0 }, style: "hedge" });
    assert.ok((await act(g, "wall:erase", { points: [3, -1, 3, 1], radius: 0.3 })).ok);
    assert.equal(walls().length, 2);
    assert.deepEqual(
      walls().map((w) => w.style),
      ["hedge", "hedge"],
    );
  });

  it("o desenho da cena só aceita os que bloqueiam a visão", async () => {
    const { g } = await setup();
    assert.ok((await act(g, "battle:grid", { wallStyle: "brick" })).ok);
    assert.match(errorOf(await act(g, "battle:grid", { wallStyle: "fence" })), /Estilo de parede inválido/);
  });

  it("cerca, grade, arame, sebe e muro baixo deixam ver (aberta ou fechada); os outros bloqueiam", () => {
    for (const s of ["fence", "iron", "barbed", "hedge", "lowstone"] as const) {
      assert.equal(blocks(line(s)), false, s);
      assert.equal(blocks(line(s, { open: false })), false, `${s} com portão fechado`);
    }
    for (const s of [undefined, "stone", "rock", "wood", "brick", "palisade", "rampart"] as const) assert.equal(blocks(line(s)), true, String(s));
    // Visão: quem está na casa 1 vê a casa 5 através da cerca, não através do tijolo.
    const viewer = [{ pos: { col: 1, row: 3 }, span: 1, feet: 30 }];
    const sees = (w: Wall) => sightCells(viewer, [w], 5).some((c) => c.col === 5 && c.row === 3);
    assert.equal(sees(line("fence")), true);
    assert.equal(sees(line("brick")), false);
  });

  it("o cômodo da névoa passa pela cerca", async () => {
    const { g } = await setup();
    for (const [from, to] of [
      [{ col: 0, row: 0 }, { col: 4, row: 0 }],
      [{ col: 4, row: 0 }, { col: 4, row: 4 }],
      [{ col: 4, row: 4 }, { col: 0, row: 4 }],
      [{ col: 0, row: 4 }, { col: 0, row: 0 }],
    ])
      await act(g, "wall:add", { from, to, style: "fence" });
    await act(g, "fog:set", { enabled: true });
    // Sem nada que bloqueie, o "cômodo" não fecha: a área passa do limite e não revela nada.
    await act(g, "fog:room", { cell: { col: 1, row: 1 }, reveal: true });
    assert.equal(isRevealed(ctx.server.store.game.battle.fog, 1, 1), false);
  });

  it("vai no arquivo de sessão", async () => {
    const { g } = await setup();
    await act(g, "wall:add", { from: { col: 0, row: 0 }, to: { col: 3, row: 0 }, style: "palisade" });
    const exported = await g.timeout(2000).emitWithAck("session:export");
    assert.ok(exported.ok);
    await act(g, "battle:clear", { keepTemplates: true });
    assert.ok((await g.timeout(2000).emitWithAck("session:import", exported.file)).ok);
    assert.equal(walls()[0]?.style, "palisade");
  });
});
