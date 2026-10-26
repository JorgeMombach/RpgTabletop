import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { ActionResult } from "@rpg/shared";
import { act, join, stateWhere, useServer, type Client } from "./helpers";

// Ficha pessoal: recursos com descanso, ataques salvos, inventário e moedas.
const { ctx, client } = useServer();
const ally = () => ctx.server.store.game.allies[0];

function idsOf(res: ActionResult): string[] {
  assert.ok(res.ok, res.ok ? "" : res.error);
  return res.ids ?? [];
}

let ipSeq = 1;
async function player(name: string): Promise<Client> {
  const s = await client(`10.34.0.${ipSeq++}`);
  await join(s, name);
  return s;
}

async function withThorin() {
  const ana = await player("Ana");
  const [id] = idsOf(await act(ana, "ally:create", { name: "Thorin", hpMax: 30, dexMod: 1, ac: 18 }));
  return { ana, id };
}

describe("recursos e descanso", () => {
  it("gasta, recupera e o descanso curto só devolve os de descanso curto", async () => {
    const { ana, id } = await withThorin();
    const [furia] = idsOf(await act(ana, "resource:upsert", { id, name: "Fúria", max: 3, recharge: "long" }));
    const [ki] = idsOf(await act(ana, "resource:upsert", { id, name: "Ki", max: 5, recharge: "short" }));
    await act(ana, "resource:use", { id, resourceId: furia, delta: 2 });
    await act(ana, "resource:use", { id, resourceId: ki, delta: 9 });
    assert.equal(ally().resources![1].used, 5, "não passa do máximo");
    await act(ana, "rest", { id, kind: "short" });
    assert.deepEqual(ally().resources!.map((r) => r.used), [2, 0]);
    await act(ana, "hp:change", { id, delta: -10 });
    await act(ana, "hp:temp", { id, value: 4 });
    await act(ana, "slot:set", { id, level: 1, max: 2, used: 2 });
    await act(ana, "rest", { id, kind: "long" });
    const t = ally();
    assert.deepEqual(t.resources!.map((r) => r.used), [0, 0]);
    assert.equal(t.hp, 30);
    assert.equal(t.tempHp, undefined);
    assert.equal(t.spellSlots![1].used, 0);
  });

  it("editar o máximo corta o que foi gasto; validação antes de mudar", async () => {
    const { ana, id } = await withThorin();
    const [r] = idsOf(await act(ana, "resource:upsert", { id, name: "Ki", max: 5, recharge: "short" }));
    await act(ana, "resource:use", { id, resourceId: r, delta: 4 });
    await act(ana, "resource:upsert", { id, resourceId: r, name: "Ki", max: 2, recharge: "short" });
    assert.equal(ally().resources![0].used, 2);
    assert.equal((await act(ana, "resource:upsert", { id, resourceId: r, name: "Ki", max: 2, recharge: "sempre" as never })).ok, false);
    assert.ok((await act(ana, "resource:remove", { id, resourceId: r })).ok);
    assert.equal(ally().resources, undefined);
  });
});

describe("ataques salvos, inventário e moedas", () => {
  it("cadastra ataque com bônus e dano; recusa sem nenhum dos dois ou dano estranho", async () => {
    const { ana, id } = await withThorin();
    const [a] = idsOf(await act(ana, "attack:upsert", { id, name: "Espada longa", bonus: 5, damage: "1d8+3" }));
    assert.deepEqual(ally().attacks![0], { id: a, name: "Espada longa", bonus: 5, damage: "1d8+3" });
    await act(ana, "attack:upsert", { id, attackId: a, name: "Espada longa", bonus: null, damage: "1d10+3" });
    assert.equal(ally().attacks![0].bonus, undefined);
    assert.equal((await act(ana, "attack:upsert", { id, name: "Nada" })).ok, false);
    assert.equal((await act(ana, "attack:upsert", { id, name: "Hack", damage: "process.exit()" })).ok, false);
  });

  it("inventário e moedas (zeradas somem)", async () => {
    const { ana, id } = await withThorin();
    const [corda] = idsOf(await act(ana, "item:upsert", { id, name: "Corda (15 m)", qty: 1, note: "de seda" }));
    await act(ana, "item:upsert", { id, itemId: corda, name: "Corda (15 m)", qty: 2 });
    assert.deepEqual(ally().inventory![0], { id: corda, name: "Corda (15 m)", qty: 2 });
    await act(ana, "coins:set", { id, coins: { gp: 25, sp: 0, cp: 30 } });
    assert.deepEqual(ally().coins, { gp: 25, cp: 30 });
    assert.equal((await act(ana, "coins:set", { id, coins: { dobrao: 3 } as never })).ok, false);
  });

  it("outro jogador não vê a ficha pessoal; e não pode mexer nela", async () => {
    const { ana, id } = await withThorin();
    await act(ana, "item:upsert", { id, name: "Mapa secreto", qty: 1 });
    const bia = await player("Bia");
    const seen = stateWhere(bia, (s) => s.allies.length === 2);
    await act(bia, "ally:create", { name: "Lia", hpMax: 15, dexMod: 3, ac: 13 });
    const s = await seen;
    const thorin = s.allies.find((a) => a.id === id)!;
    assert.equal("inventory" in thorin, false);
    assert.equal((await act(bia, "item:upsert", { id, name: "Pedra", qty: 1 })).ok, false);
  });
});
