import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { ActionResult } from "@rpg/shared";
import { act, join, stateWhere, useServer, type Client } from "./helpers";

// Lembrete de Concentração e recursos de chefe (ações lendárias, recarga no d6).
const { ctx, client } = useServer();
const game = () => ctx.server.store.game;

function idsOf(res: ActionResult): string[] {
  assert.ok(res.ok, res.ok ? "" : res.error);
  return res.ids ?? [];
}

let ipSeq = 1;
async function player(name: string): Promise<Client> {
  const s = await client(`10.36.0.${ipSeq++}`);
  await join(s, name);
  return s;
}

async function gm(): Promise<Client> {
  const s = await client();
  await join(s, "Mestre");
  return s;
}

describe("lembrete de Concentração", () => {
  it("quem concentra e toma dano recebe o aviso com a CD (metade do dano, mínimo 10)", async () => {
    const ana = await player("Ana");
    const [id] = idsOf(await act(ana, "ally:create", { name: "Lia", hpMax: 40, dexMod: 2, ac: 13 }));
    await act(ana, "hp:change", { id, delta: -6 });
    assert.equal(game().log.some((e) => e.system), false, "sem concentração, sem aviso");
    await act(ana, "condition:add", { id, name: "Concentração", rounds: null });
    await act(ana, "hp:change", { id, delta: -6 });
    await act(ana, "hp:change", { id, delta: -26 });
    const notes = game().log.filter((e) => e.system).map((e) => e.text);
    assert.deepEqual(notes, ["Teste de Concentração para Lia: CD 10 (resistência de CON).", "Teste de Concentração para Lia: CD 13 (resistência de CON)."]);
  });

  it("aviso de mob concentrando fica só para o mestre", async () => {
    const g = await gm();
    const ana = await player("Ana");
    const [mago] = idsOf(await act(g, "mob:add", { name: "Mago das trevas", hpMax: 40, dexMod: 2, ac: 12 }));
    await act(g, "condition:add", { id: mago, name: "Concentração", rounds: null });
    const seen = stateWhere(ana, (s) => s.allies.length === 1);
    await act(g, "hp:change", { id: mago, delta: -8 });
    await act(ana, "ally:create", { name: "Thorin", hpMax: 30, dexMod: 1, ac: 18 });
    const s = await seen;
    assert.equal(s.log.some((e) => e.text.includes("Mago das trevas")), false);
    assert.ok(game().log.some((e) => e.hidden && e.text.includes("Mago das trevas")));
  });
});

describe("chefes: recursos que voltam na vez", () => {
  it("ações lendárias voltam no começo da vez do chefe; recarga rola o d6", async () => {
    const g = await gm();
    const [dragao] = idsOf(await act(g, "mob:add", { name: "Dragão", hpMax: 200, dexMod: 0, ac: 19, size: "huge" }));
    const [goblin] = idsOf(await act(g, "mob:add", { name: "Goblin", hpMax: 7, dexMod: 2, ac: 15 }));
    const [lendarias] = idsOf(await act(g, "resource:upsert", { id: dragao, name: "Ações lendárias", max: 3, recharge: "turn" }));
    const [sopro] = idsOf(await act(g, "resource:upsert", { id: dragao, name: "Sopro de fogo", max: 1, recharge: "dice", rechargeOn: 5 }));
    assert.equal((await act(g, "resource:upsert", { id: dragao, name: "X", max: 1, recharge: "dice", rechargeOn: 9 })).ok, false);
    await act(g, "init:set", { id: dragao, value: 20 });
    await act(g, "init:set", { id: goblin, value: 10 });
    await act(g, "combat:start", {}); // vez do dragão
    await act(g, "resource:use", { id: dragao, resourceId: lendarias, delta: 3 });
    await act(g, "resource:use", { id: dragao, resourceId: sopro, delta: 1 });
    await act(g, "combat:next", {}); // goblin
    await act(g, "combat:next", {}); // dragão, round 2
    const res = game().battle.mobs.find((m) => m.id === dragao)!.resources!;
    assert.equal(res[0].used, 0, "ações lendárias de volta");
    const recharge = game().log.find((e) => e.label?.startsWith("Recarga de Sopro de fogo"))!;
    assert.ok(recharge, "rolou a recarga");
    assert.equal(recharge.hidden, true, "rolagem do chefe é oculta");
    assert.equal(res[1].used, recharge.roll!.total >= 5 ? 0 : 1, "volta só com 5 ou 6");
  });
});
