import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { ActionResult } from "@rpg/shared";
import { act, join, stateWhere, useServer } from "./helpers";

// Desenho livre do mestre no mapa.
const { ctx, client } = useServer();
const game = () => ctx.server.store.game;

function idsOf(res: ActionResult): string[] {
  assert.ok(res.ok, res.ok ? "" : res.error);
  return res.ids ?? [];
}

describe("desenhos do mestre", () => {
  it("mestre desenha e apaga; jogador não; o oculto não chega aos jogadores", async () => {
    const g = await client();
    await join(g, "Mestre");
    const ana = await client("10.39.0.1");
    await join(ana, "Ana");

    const seen = stateWhere(ana, (s) => s.battle.drawings.length > 0);
    const [seta] = idsOf(await act(g, "draw:add", { kind: "arrow", points: [0, 0, 120.26, 40], color: "#c94a52", width: 4 }));
    await seen;
    assert.equal(game().battle.drawings[0].points[2], 120.5, "arredonda para meio pixel");
    // Desenho oculto: o estado seguinte do jogador continua só com a seta.
    const next = stateWhere(ana, () => true);
    idsOf(await act(g, "draw:add", { kind: "free", points: [0, 0, 5, 5, 10, 3], color: "#d8b47a", width: 3, hidden: true }));
    assert.equal((await next).battle.drawings.length, 1, "o oculto fica só com o mestre");
    assert.equal(game().battle.drawings.length, 2);

    assert.equal((await act(ana, "draw:add", { kind: "circle", points: [0, 0, 10, 10], color: "#ffffff", width: 2 })).ok, false);
    assert.equal((await act(g, "draw:add", { kind: "arrow", points: [0, 0, 1, 1, 2, 2], color: "#ffffff", width: 2 })).ok, false, "seta é começo e fim");
    assert.equal((await act(g, "draw:add", { kind: "free", points: [0, 0, 1], color: "#ffffff", width: 2 })).ok, false);
    assert.equal((await act(g, "draw:add", { kind: "free", points: [0, 0, 1, 1], color: "red", width: 2 })).ok, false);

    assert.equal((await act(ana, "draw:remove", { id: seta })).ok, false);
    assert.ok((await act(g, "draw:remove", { id: seta })).ok);
    assert.equal(game().battle.drawings.length, 1);
    assert.ok((await act(g, "draw:clear", {})).ok);
    assert.equal(game().battle.drawings.length, 0);
  });

  it("limpar o campo apaga os desenhos", async () => {
    const g = await client();
    await join(g, "Mestre");
    await act(g, "draw:add", { kind: "circle", points: [50, 50, 80, 50], color: "#5ba3e6", width: 3 });
    await act(g, "battle:clear", { keepTemplates: true });
    assert.equal(game().battle.drawings.length, 0);
  });
});
