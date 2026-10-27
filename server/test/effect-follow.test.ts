import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { ActionResult, Area } from "@rpg/shared";
import { act, join, useServer } from "./helpers";

// Efeitos que andam com o token: a área acompanha quem conjurou.
const { ctx, client } = useServer();

function idsOf(res: ActionResult): string[] {
  assert.ok(res.ok, res.ok ? "" : res.error);
  return res.ids ?? [];
}

const sphere = (col: number, row: number): Area => ({ kind: "sphere", origin: { col, row }, angle: 0, feet: 15 });
const effectOf = (id: string) => ctx.server.store.game.battle.effects.find((e) => e.id === id)!;

describe("efeitos que andam com o token", () => {
  it("a área anda a mesma distância que o token; soltar deixa parada; sem conjurador não anda", async () => {
    const g = await client();
    await join(g, "Mestre");
    const ana = await client("10.48.0.1");
    await join(ana, "Ana");
    const [lia] = idsOf(await act(ana, "ally:create", { name: "Lia", hpMax: 20, dexMod: 0, ac: 14 }));
    assert.ok((await act(ana, "token:move", { id: lia, pos: { col: 2, row: 2 } })).ok);

    // Centrada na Lia (centro da casa 2,2 = 2,5).
    const [aura] = idsOf(await act(ana, "effect:add", { name: "Espíritos Guardiões", preset: "custom", area: sphere(2.5, 2.5), casterId: lia, follow: true }));
    assert.equal(effectOf(aura).followId, lia);
    const [parado] = idsOf(await act(ana, "effect:add", { name: "Teia", preset: "web", area: sphere(8, 8), casterId: lia }));

    assert.ok((await act(ana, "token:move", { id: lia, pos: { col: 5, row: 1 } })).ok);
    assert.deepEqual(effectOf(aura).area.origin, { col: 5.5, row: 1.5 });
    assert.deepEqual(effectOf(parado).area.origin, { col: 8, row: 8 }, "o que não está preso fica");

    // Sair do mapa e voltar não leva o efeito.
    await act(ana, "token:move", { id: lia, pos: null });
    await act(ana, "token:move", { id: lia, pos: { col: 0, row: 0 } });
    assert.deepEqual(effectOf(aura).area.origin, { col: 5.5, row: 1.5 });

    // Soltar e prender de novo pelo painel.
    assert.ok((await act(ana, "effect:follow", { id: aura, follow: false })).ok);
    await act(ana, "token:move", { id: lia, pos: { col: 1, row: 0 } });
    assert.deepEqual(effectOf(aura).area.origin, { col: 5.5, row: 1.5 });
    assert.ok((await act(ana, "effect:follow", { id: parado, follow: true })).ok);
    await act(ana, "token:move", { id: lia, pos: { col: 1, row: 2 } });
    assert.deepEqual(effectOf(parado).area.origin, { col: 8, row: 10 });

    // Sem conjurador (ambiente) não dá para prender.
    const [neblina] = idsOf(await act(g, "effect:add", { name: "Neblina", preset: "custom", area: sphere(4, 4), casterId: null }));
    assert.equal((await act(g, "effect:add", { name: "X", preset: "custom", area: sphere(4, 4), casterId: null, follow: true })).ok, false);
    assert.equal((await act(g, "effect:follow", { id: neblina, follow: true })).ok, false);
    // Jogador não prende efeito dos outros.
    assert.equal((await act(ana, "effect:follow", { id: neblina, follow: false })).ok, false);
  });
});
