import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { groupName, type ActionResult } from "@rpg/shared";
import { act, join, useServer, type Client } from "./helpers";

// Grupos de mobs iguais na iniciativa: mesma rolagem, uma vez só.
const { ctx, client } = useServer();
const game = () => ctx.server.store.game;
const current = () => game().battle.combat.order[game().battle.combat.turnIndex];

function idsOf(res: ActionResult): string[] {
  assert.ok(res.ok, res.ok ? "" : res.error);
  return res.ids ?? [];
}

/** Thorin (20) → 3 goblins do template, em grupo (15) → Lobo (5). */
async function setup() {
  const g: Client = await client();
  await join(g, "Mestre");
  const [thorin] = idsOf(await act(g, "ally:create", { name: "Thorin", hpMax: 30, dexMod: 1, ac: 18 }));
  const [tpl] = idsOf(await act(g, "template:upsert", { name: "Goblin", hpMax: 7, dexMod: 2, ac: 15 }));
  const goblins = idsOf(await act(g, "mob:addFromTemplate", { templateId: tpl, qty: 3 }));
  const [lobo] = idsOf(await act(g, "mob:add", { name: "Lobo", hpMax: 11, dexMod: 2, ac: 13 }));
  await act(g, "init:set", { id: thorin, value: 20 });
  await act(g, "init:set", { id: lobo, value: 5 });
  // Mesmo valor para os três (como a rolagem por template faz).
  for (const id of goblins) await act(g, "init:set", { id, value: 15 });
  assert.ok((await act(g, "combat:start", {})).ok);
  return { g, thorin, goblins, lobo };
}

describe("grupos de mobs na iniciativa", () => {
  it("nome curto do grupo", () => {
    assert.equal(groupName(["Goblin 1", "Goblin 2", "Goblin 3"]), "Goblin 1–3");
    assert.equal(groupName(["Goblin 1", "Goblin 4"]), "Goblin ×2");
    assert.equal(groupName(["Ana", "Bia"]), "Ana +1");
  });

  it("o grupo age numa vez só: o próximo turno pula todos, e o começo da vez roda para cada um", async () => {
    const { g, goblins, lobo } = await setup();
    for (const id of goblins) await act(g, "condition:add", { id, name: "Amedrontado", rounds: 3 });
    await act(g, "combat:next", {});
    assert.equal(current(), goblins[0]);
    for (const id of goblins) assert.equal(game().battle.mobs.find((m) => m.id === id)!.conditions[0].rounds, 2);
    await act(g, "dice:roll", { expr: "1d20" });
    assert.equal(game().log.at(-1)!.turn!.name, "Goblin 1–3", "o log marca o turno do grupo");
    await act(g, "combat:next", {});
    assert.equal(current(), lobo, "pulou o grupo inteiro");
    await act(g, "combat:prev", {});
    assert.equal(current(), goblins[0], "voltar cai no começo do grupo");
  });

  it("iniciativa diferente desfaz o grupo", async () => {
    const { g, goblins } = await setup();
    await act(g, "init:set", { id: goblins[1], value: 14 });
    await act(g, "combat:next", {});
    await act(g, "combat:next", {});
    // Ordem: Thorin, Goblin 1 e 3 (juntos), Goblin 2, Lobo.
    assert.equal(current(), goblins[1], "só os dois que continuam iguais agem juntos");
  });

  it("atrasar a vez leva o grupo inteiro", async () => {
    const { g, goblins, lobo } = await setup();
    await act(g, "combat:next", {});
    assert.ok((await act(g, "combat:delay", { afterId: lobo })).ok);
    const { order } = game().battle.combat;
    assert.deepEqual(order.slice(1), [lobo, ...goblins]);
    assert.equal(current(), lobo);
    assert.ok(game().log.some((e) => e.text === "Goblin 1–3 vai agir depois de Lobo."));
  });
});
