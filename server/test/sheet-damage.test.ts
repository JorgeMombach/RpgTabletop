import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { ActionResult } from "@rpg/shared";
import { act, join, useServer, type Client } from "./helpers";

// Dano na ficha (depois da 2.11): ataques no template, dano em magias e habilidades, nome da rolagem no log.
const { ctx, client } = useServer();
const game = () => ctx.server.store.game;

function idsOf(res: ActionResult): string[] {
  assert.ok(res.ok, res.ok ? "" : res.error);
  return res.ids ?? [];
}

function errorOf(res: ActionResult): string {
  assert.equal(res.ok, false, "deveria recusar");
  return res.ok ? "" : res.error;
}

let ipSeq = 1;
async function gm(): Promise<Client> {
  const g = await client();
  await join(g, "Mestre");
  return g;
}
async function player(name: string): Promise<Client> {
  const s = await client(`10.71.0.${ipSeq++}`);
  await join(s, name);
  return s;
}

describe("ataques no template", () => {
  it("o mob e o NPC criados vêm com cópia própria dos ataques; editar o template não mexe neles", async () => {
    const g = await gm();
    const attacks = [
      { name: "Martelo de pedra", bonus: 4, damage: "1d6+2" },
      { name: "Grito", damage: "2d4" },
    ];
    const [tpl] = idsOf(await act(g, "template:upsert", { name: "Ogro", hpMax: 59, dexMod: -1, attacks }));
    assert.deepEqual(
      game().templates[0].attacks?.map(({ id: _, ...a }) => a),
      attacks,
    );

    const [mob] = idsOf(await act(g, "mob:addFromTemplate", { templateId: tpl, qty: 1 }));
    const [npc] = idsOf(await act(g, "npc:addFromTemplate", { templateId: tpl }));
    const mobAttacks = game().battle.mobs.find((m) => m.id === mob)!.attacks!;
    const npcAttacks = game().battle.npcs.find((n) => n.id === npc)!.attacks!;
    assert.equal(mobAttacks.length, 2);
    assert.equal(mobAttacks[0].name, "Martelo de pedra");
    assert.notEqual(mobAttacks[0].id, game().templates[0].attacks![0].id, "id próprio");
    assert.notEqual(mobAttacks[0].id, npcAttacks[0].id);

    // Template sem ataques ([]): o campo some; o mob continua com os dele.
    assert.ok((await act(g, "template:upsert", { id: tpl, name: "Ogro", hpMax: 59, dexMod: -1, attacks: [] })).ok);
    assert.equal(game().templates[0].attacks, undefined);
    assert.equal(game().battle.mobs[0].attacks?.length, 2);
    // Sem o campo, a edição não mexe nos ataques.
    assert.ok((await act(g, "template:upsert", { id: tpl, name: "Ogro", hpMax: 59, dexMod: -1, attacks: [attacks[0]] })).ok);
    assert.ok((await act(g, "template:upsert", { id: tpl, name: "Ogro velho", hpMax: 59, dexMod: -1 })).ok);
    assert.equal(game().templates[0].attacks?.length, 1);
  });

  it("ataque inválido recusa o template inteiro; jogador não traz ataques prontos", async () => {
    const g = await gm();
    assert.match(errorOf(await act(g, "template:upsert", { name: "Ogro", hpMax: 59, dexMod: 0, attacks: [{ name: "Soco" }] })), /bônus de ataque, o dano/);
    assert.match(errorOf(await act(g, "template:upsert", { name: "Ogro", hpMax: 59, dexMod: 0, attacks: [{ name: "Soco", damage: "muito" }] })), /Dano inválido/);
    assert.equal(game().templates.length, 0);

    const ana = await player("Ana");
    const [lia] = idsOf(await act(ana, "ally:create", { name: "Lia", hpMax: 20, dexMod: 2, attacks: [{ name: "Arco", bonus: 5, damage: "1d8+3" }] }));
    assert.equal(game().allies.find((a) => a.id === lia)!.attacks, undefined, "o jogador monta os ataques na ficha");
  });
});

describe("dano em magias e habilidades", () => {
  it("magia e recurso guardam o dano; dano inválido é recusado", async () => {
    await gm();
    const ana = await player("Ana");
    const [lia] = idsOf(await act(ana, "ally:create", { name: "Lia", hpMax: 20, dexMod: 2 }));
    idsOf(await act(ana, "spell:add", { id: lia, name: "Bola de fogo", level: 3, note: "Resistência DES, metade", damage: "8d6" }));
    assert.deepEqual(
      game().allies[0].spells?.map(({ id: _, ...s }) => s),
      [{ name: "Bola de fogo", level: 3, note: "Resistência DES, metade", damage: "8d6" }],
    );
    assert.match(errorOf(await act(ana, "spell:add", { id: lia, name: "Raio", level: 1, damage: "muito" })), /Dano inválido/);

    const [ki] = idsOf(await act(ana, "resource:upsert", { id: lia, name: "Sopro", max: 1, recharge: "dice", rechargeOn: 5, damage: "6d6" }));
    assert.equal(game().allies[0].resources![0].damage, "6d6");
    // Editar sem dano apaga o dano.
    assert.ok((await act(ana, "resource:upsert", { id: lia, resourceId: ki, name: "Sopro", max: 1, recharge: "dice", rechargeOn: 5 })).ok);
    assert.equal(game().allies[0].resources![0].damage, undefined);
  });

  it("magia guarda o acerto (d20 + bônus, como o ataque); fora do limite é recusado", async () => {
    await gm();
    const ana = await player("Ana");
    const [lia] = idsOf(await act(ana, "ally:create", { name: "Lia", hpMax: 20, dexMod: 2 }));
    idsOf(await act(ana, "spell:add", { id: lia, name: "Raio de fogo", level: 0, bonus: 7, damage: "2d10" }));
    idsOf(await act(ana, "spell:add", { id: lia, name: "Bola de fogo", level: 3, damage: "8d6" }));
    assert.deepEqual(
      game().allies[0].spells?.map(({ id: _, ...s }) => s),
      [
        { name: "Raio de fogo", level: 0, bonus: 7, damage: "2d10" },
        { name: "Bola de fogo", level: 3, damage: "8d6" },
      ],
    );
    assert.match(errorOf(await act(ana, "spell:add", { id: lia, name: "Raio", level: 1, bonus: 99 })), /Acerto/);
    assert.match(errorOf(await act(ana, "spell:add", { id: lia, name: "Raio", level: 1, bonus: "muito" as unknown as number })), /Acerto/);
    assert.equal(game().allies[0].spells?.length, 2);
  });

  it("o nome do que rolou vai na frente do rótulo no log", async () => {
    const g = await gm();
    assert.ok((await act(g, "dice:roll", { expr: "8d6", kind: "damage", name: "  Bola   de fogo " })).ok);
    const last = game().log.at(-1)!;
    assert.deepEqual(last.labelParts, [{ key: "Bola de fogo" }, { key: "Dano" }]);
    assert.equal(last.label, "Bola de fogo · Dano");
  });
});
