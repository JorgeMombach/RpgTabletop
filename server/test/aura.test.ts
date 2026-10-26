import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { ActionResult } from "@rpg/shared";
import { act, join, stateWhere, useServer } from "./helpers";

// Alcance/aura em volta do token.
const { ctx, client } = useServer();
const game = () => ctx.server.store.game;

function idsOf(res: ActionResult): string[] {
  assert.ok(res.ok, res.ok ? "" : res.error);
  return res.ids ?? [];
}

describe("alcance / aura", () => {
  it("dono e mestre marcam; outro jogador não; null apaga; todos veem a do mob", async () => {
    const g = await client();
    await join(g, "Mestre");
    const ana = await client("10.37.0.1");
    await join(ana, "Ana");
    const bia = await client("10.37.0.2");
    await join(bia, "Bia");
    const [lia] = idsOf(await act(ana, "ally:create", { name: "Lia", hpMax: 20, dexMod: 2, ac: 14 }));
    const [ogro] = idsOf(await act(g, "mob:add", { name: "Ogro", hpMax: 59, dexMod: -1, ac: 11, size: "large" }));

    assert.ok((await act(ana, "aura:set", { id: lia, feet: 10 })).ok);
    assert.equal((await act(bia, "aura:set", { id: lia, feet: 30 })).ok, false);
    assert.equal((await act(ana, "aura:set", { id: lia, feet: 2 })).ok, false, "menos de 5 ft");
    assert.equal(game().allies[0].aura, 10);
    await act(ana, "aura:set", { id: lia, feet: null });
    assert.equal(game().allies[0].aura, undefined);

    const seen = stateWhere(bia, (s) => s.battle.mobs.some((m) => m.aura === 10));
    await act(g, "aura:set", { id: ogro, feet: 10 });
    await seen;
  });
});
