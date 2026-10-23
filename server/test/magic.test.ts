import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { ActionResult, ClientState } from "@rpg/shared";
import { act, join, stateWhere, useServer, type Client } from "./helpers";

const { ctx, client } = useServer();

function idsOf(res: ActionResult): string[] {
  assert.ok(res.ok, res.ok ? "" : res.error);
  return res.ids ?? [];
}

let ipSeq = 1;
async function player(name: string): Promise<Client> {
  const s = await client(`10.5.0.${ipSeq++}`);
  await join(s, name);
  return s;
}

async function withAlly(name = "Ana") {
  const p = await player(name);
  const [id] = idsOf(await act(p, "ally:create", { name: `${name} PC`, hpMax: 20, dexMod: 2 }));
  return { p, id };
}

const ally = (id: string) => ctx.server.store.game.allies.find((a) => a.id === id)!;

describe("slots de magia", () => {
  it("jogador define máximo e marca/desmarca usados livremente", async () => {
    const { p, id } = await withAlly();
    assert.ok((await act(p, "slot:set", { id, level: 1, max: 4 })).ok);
    assert.ok((await act(p, "slot:set", { id, level: 3, max: 2 })).ok);
    await act(p, "slot:set", { id, level: 1, used: 3 });
    assert.deepEqual(ally(id).spellSlots![1], { max: 4, used: 3 });

    await act(p, "slot:set", { id, level: 1, used: 2 });
    assert.equal(ally(id).spellSlots![1].used, 2, "recuperar um slot específico");

    await act(p, "slot:set", { id, level: 3, used: 9 });
    assert.equal(ally(id).spellSlots![3].used, 2, "usados nunca passam do máximo");

    await act(p, "slot:set", { id, level: 1, max: 1 });
    assert.deepEqual(ally(id).spellSlots![1], { max: 1, used: 1 }, "baixar o máximo limita os usados");
  });

  it("recuperar slots zera os usados de todos os níveis", async () => {
    const { p, id } = await withAlly();
    await act(p, "slot:set", { id, level: 1, max: 4, used: 4 });
    await act(p, "slot:set", { id, level: 2, max: 3, used: 1 });
    assert.ok((await act(p, "slots:restore", { id })).ok);
    const slots = ally(id).spellSlots!;
    assert.deepEqual([slots[1], slots[2]], [{ max: 4, used: 0 }, { max: 3, used: 0 }]);
  });

  it("restaurar tudo: vida cheia + slots", async () => {
    const { p, id } = await withAlly();
    await act(p, "slot:set", { id, level: 2, max: 3, used: 3 });
    await act(p, "hp:change", { id, delta: -15 });
    assert.ok((await act(p, "ally:restoreAll", { id })).ok);
    assert.equal(ally(id).hp, 20);
    assert.equal(ally(id).spellSlots![2].used, 0);
  });

  it("todos veem os slots atualizados; ninguém mexe nos slots de outro", async () => {
    const { p: ana, id } = await withAlly("Ana");
    const bia = await player("Bia");
    const seen = stateWhere(bia, (s) => s.allies[0]?.spellSlots?.[1]?.used === 2);
    await act(ana, "slot:set", { id, level: 1, max: 4, used: 2 });
    await seen;

    for (const res of [
      await act(bia, "slot:set", { id, level: 1, used: 0 }),
      await act(bia, "slots:restore", { id }),
      await act(bia, "ally:restoreAll", { id }),
      await act(bia, "spell:add", { id, name: "Sono", level: 1 }),
    ]) {
      assert.equal(res.ok, false);
    }
    assert.equal(ally(id).spellSlots![1].used, 2);
  });

  it("mob não tem slots; valores inválidos são recusados", async () => {
    const g = await client();
    await join(g, "Mestre");
    const [mob] = idsOf(await act(g, "mob:add", { name: "Goblin", hpMax: 7, dexMod: 2 }));
    assert.equal((await act(g, "slot:set", { id: mob, level: 1, max: 2 })).ok, false);

    const { p, id } = await withAlly();
    assert.equal((await act(p, "slot:set", { id, level: 10, max: 1 })).ok, false);
    assert.equal((await act(p, "slot:set", { id, level: 1, max: 50 })).ok, false);
  });
});

describe("lista de magias", () => {
  it("adiciona (ordenada por nível) e remove", async () => {
    const { p, id } = await withAlly();
    await act(p, "spell:add", { id, name: "Bola de Fogo", level: 3, note: "8d6, 20 ft" });
    const [luz] = idsOf(await act(p, "spell:add", { id, name: "Luz", level: 0 }));
    await act(p, "spell:add", { id, name: "Escudo", level: 1 });
    assert.deepEqual(
      ally(id).spells!.map((s) => s.name),
      ["Luz", "Escudo", "Bola de Fogo"],
    );
    assert.ok((await act(p, "spell:remove", { id, spellId: luz })).ok);
    assert.equal(ally(id).spells!.length, 2);
    assert.equal((await act(p, "spell:add", { id, name: "  ", level: 1 })).ok, false);
  });

  it("aparece para o dono e o mestre, mas não para outros jogadores", async () => {
    const g = await client();
    await join(g, "Mestre");
    const { p: ana, id } = await withAlly("Ana");
    const bia = await player("Bia");

    const states: Record<string, Promise<ClientState>> = {
      gm: stateWhere(g, (s) => (s.allies[0]?.spells?.length ?? 0) === 1),
      ana: stateWhere(ana, (s) => (s.allies[0]?.spells?.length ?? 0) === 1),
      bia: stateWhere(bia, (s) => s.allies[0]?.spellSlots?.[1]?.max === 2),
    };
    await act(ana, "spell:add", { id, name: "Mísseis Mágicos", level: 1 });
    await act(ana, "slot:set", { id, level: 1, max: 2 });

    await states.gm;
    await states.ana;
    const b = await states.bia;
    assert.equal(b.allies[0].spells, undefined, "Bia não vê as magias da Ana");
    assert.equal(b.allies[0].spellSlots?.[1].max, 2, "mas vê os slots");
  });

  it("slots e magias continuam depois de encerrar o combate", async () => {
    const g = await client();
    await join(g, "Mestre");
    const { p, id } = await withAlly();
    await act(p, "slot:set", { id, level: 1, max: 3, used: 2 });
    await act(p, "spell:add", { id, name: "Sono", level: 1 });
    await act(p, "init:set", { id, value: 10 });
    await act(g, "combat:start", {});
    await act(g, "combat:end", {});
    assert.equal(ally(id).spellSlots![1].used, 2);
    assert.equal(ally(id).spells!.length, 1);
  });
});
