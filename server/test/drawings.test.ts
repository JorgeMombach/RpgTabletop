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

  it("jogador desenha só setas, apaga só as dele (no máximo 10, a mais antiga sai); o mestre apaga todas", async () => {
    const g = await client();
    await join(g, "Mestre");
    await act(g, "draw:clear", {});
    const bia = await client("10.39.0.2");
    await join(bia, "Bia");
    const caio = await client("10.39.0.3");
    await join(caio, "Caio");
    const arrow = (x: number) => ({ kind: "arrow" as const, points: [x, 0, x + 50, 0], color: "#5ba3e6", width: 4, hidden: true });
    const [mine] = idsOf(await act(bia, "draw:add", arrow(0)));
    const d = game().battle.drawings.find((x) => x.id === mine)!;
    assert.equal(d.hidden, undefined, "seta de jogador é sempre à vista");
    assert.ok(d.authorId);
    assert.equal((await act(caio, "draw:remove", { id: mine })).ok, false, "a seta é da Bia");
    await act(caio, "draw:add", arrow(500));
    // Caio limpa: só as dele.
    await act(caio, "draw:clear", {});
    assert.deepEqual(game().battle.drawings.map((x) => x.id), [mine]);
    // Passou de 10: a mais antiga da Bia sai.
    for (let k = 1; k <= 10; k++) await act(bia, "draw:add", arrow(k * 100));
    assert.equal(game().battle.drawings.length, 10);
    assert.ok(!game().battle.drawings.some((x) => x.id === mine));
    assert.ok((await act(bia, "draw:remove", { id: game().battle.drawings[0].id })).ok);
    assert.ok((await act(g, "draw:clear", {})).ok);
    assert.equal(game().battle.drawings.length, 0);
  });

  it("borracha: corta o traço por onde passa, apaga seta e círculo tocados; jogador só nas setas dele", async () => {
    const g = await client();
    await join(g, "Mestre");
    await act(g, "draw:clear", {});
    const duda = await client("10.39.0.4");
    await join(duda, "Duda");
    // Traço reto de 0 a 200 em y=0; seta e círculo longe dele.
    idsOf(await act(g, "draw:add", { kind: "free", points: [0, 0, 200, 0], color: "#d8b47a", width: 2 }));
    idsOf(await act(g, "draw:add", { kind: "arrow", points: [0, 100, 200, 100], color: "#d8b47a", width: 2 }));
    idsOf(await act(g, "draw:add", { kind: "circle", points: [500, 500, 550, 500], color: "#d8b47a", width: 2 }));
    const [hers] = idsOf(await act(duda, "draw:add", { kind: "arrow", points: [0, 300, 200, 300], color: "#5ba3e6", width: 2 }));

    // Jogadora passa a borracha em tudo: só a seta dela some.
    assert.ok((await act(duda, "draw:erase", { points: [100, -20, 100, 320], radius: 10 })).ok);
    assert.equal(game().battle.drawings.length, 3);
    assert.ok(!game().battle.drawings.some((x) => x.id === hers));

    // Mestre corta o traço no meio (vira dois) e apaga a seta; passa por dentro do círculo sem tocar o aro.
    assert.ok((await act(g, "draw:erase", { points: [100, -20, 100, 120], radius: 10 })).ok);
    const free = game().battle.drawings.filter((x) => x.kind === "free");
    assert.equal(free.length, 2, "o traço virou dois pedaços");
    assert.ok(free.every((x) => x.points.every((n, k) => k % 2 === 1 || Math.abs(n - 100) > 10)), "nada sobra perto da borracha");
    assert.ok(!game().battle.drawings.some((x) => x.kind === "arrow"));
    assert.ok((await act(g, "draw:erase", { points: [510, 500, 525, 505], radius: 5 })).ok);
    assert.equal(game().battle.drawings.filter((x) => x.kind === "circle").length, 1, "dentro do círculo, longe do aro: fica");
    // Encostar no aro apaga.
    assert.ok((await act(g, "draw:erase", { points: [550, 500], radius: 5 })).ok);
    assert.equal(game().battle.drawings.filter((x) => x.kind === "circle").length, 0);
    assert.equal((await act(g, "draw:erase", { points: [1], radius: 5 })).ok, false);
  });
});
