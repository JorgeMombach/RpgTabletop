import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { ActionResult } from "@rpg/shared";
import { act, join, useServer } from "./helpers";

// Numeração dos mobs pelos nomes em uso: bestiário e Conjurar não repetem "Zumbi 1".
const { ctx, client } = useServer();
const names = () => [...ctx.server.store.game.battle.mobs].map((m) => m.name);

function idsOf(res: ActionResult): string[] {
  assert.ok(res.ok, res.ok ? "" : res.error);
  return res.ids ?? [];
}

describe("numeração dos mobs", () => {
  it("bestiário e Conjurar continuam do maior número em uso, sem repetir", async () => {
    const g = await client();
    await join(g, "Mestre");
    const [necro] = idsOf(await act(g, "mob:add", { name: "Necromante", hpMax: 40, dexMod: 1, ac: 12 }));
    await act(g, "summon:add", { summonerId: necro, name: "Zumbi", hpMax: 22, dexMod: -2, qty: 3 });
    const [tpl] = idsOf(await act(g, "template:upsert", { name: "Zumbi", hpMax: 22, dexMod: -2, ac: 8 }));
    await act(g, "mob:addFromTemplate", { templateId: tpl, qty: 2 });
    await act(g, "summon:add", { summonerId: necro, name: "zumbi", hpMax: 22, dexMod: -2, qty: 1 });
    assert.deepEqual(names(), ["Necromante", "Zumbi 1", "Zumbi 2", "Zumbi 3", "Zumbi 4", "Zumbi 5", "zumbi 6"]);
  });

  it("um só, sem ninguém com o nome, fica sem número; mob removido não libera o número", async () => {
    const g = await client();
    await join(g, "Mestre");
    await act(g, "battle:clear", { keepTemplates: true });
    const [mago] = idsOf(await act(g, "mob:add", { name: "Mago", hpMax: 30, dexMod: 2, ac: 12 }));
    await act(g, "summon:add", { summonerId: mago, name: "Diabrete", hpMax: 10, dexMod: 3, qty: 1 });
    assert.ok(names().includes("Diabrete"));
    const [tpl] = idsOf(await act(g, "template:upsert", { name: "Lobo", hpMax: 11, dexMod: 2, ac: 13 }));
    const [, lobo2] = idsOf(await act(g, "mob:addFromTemplate", { templateId: tpl, qty: 2 }));
    await act(g, "mob:remove", { id: lobo2 });
    await act(g, "mob:addFromTemplate", { templateId: tpl, qty: 1 });
    assert.deepEqual(names().filter((n) => n.startsWith("Lobo")), ["Lobo 1", "Lobo 3"]);
  });
});
