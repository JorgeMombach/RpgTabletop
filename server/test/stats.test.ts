import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { abilityMod, type ActionResult } from "@rpg/shared";
import { act, join, stateWhere, useServer, type Client } from "./helpers";

// CA e atributos: opcionais por baixo, escondidos dos jogadores em mob/NPC.
const { ctx, client } = useServer();
const game = () => ctx.server.store.game;

function idsOf(res: ActionResult): string[] {
  assert.ok(res.ok, res.ok ? "" : res.error);
  return res.ids ?? [];
}

async function gm(): Promise<Client> {
  const s = await client();
  await join(s, "Mestre");
  return s;
}

let ipSeq = 1;
async function player(name: string): Promise<Client> {
  const s = await client(`10.31.0.${ipSeq++}`);
  await join(s, name);
  return s;
}

describe("CA e atributos", () => {
  it("modificador do 5e, sem teto", () => {
    assert.deepEqual([1, 8, 9, 10, 11, 12, 15, 20, 30].map(abilityMod), [-5, -1, -1, 0, 0, 1, 2, 5, 10]);
  });

  it("mob guarda CA e atributos; o jogador não recebe os do mob, mas recebe os dos aliados", async () => {
    const g = await gm();
    const ana = await player("Ana");
    const seenByAna = stateWhere(ana, (st) => st.allies.length === 1 && st.battle.mobs.length === 1);
    const seenByGm = stateWhere(g, (st) => st.allies.length === 1 && st.battle.mobs.length === 1);
    const [ogro] = idsOf(await act(g, "mob:add", { name: "Ogro", hpMax: 59, dexMod: -1, ac: 11, abilities: { str: 19, dex: 8 } }));
    const [thorin] = idsOf(await act(ana, "ally:create", { name: "Thorin", hpMax: 30, dexMod: 1, ac: 18, abilities: { wis: 13 } }));
    assert.equal(game().battle.mobs[0].ac, 11);
    assert.deepEqual(game().battle.mobs[0].abilities, { str: 19, dex: 8 });

    const s = await seenByAna;
    const seenOgro = s.battle.mobs.find((m) => m.id === ogro)!;
    assert.equal("ac" in seenOgro, false, "CA do inimigo não vai para o jogador");
    assert.equal("abilities" in seenOgro, false);
    assert.equal(s.allies.find((a) => a.id === thorin)?.ac, 18, "CA do aliado vai");

    const gs = await seenByGm;
    assert.equal(gs.battle.mobs[0].ac, 11, "o mestre vê tudo");
  });

  it("template passa CA e atributos para os mobs, cada um com a sua cópia", async () => {
    const g = await gm();
    const [tid] = idsOf(await act(g, "template:upsert", { name: "Goblin", hpMax: 7, dexMod: 2, ac: 15, abilities: { dex: 14 } }));
    const [a, b] = idsOf(await act(g, "mob:addFromTemplate", { templateId: tid, qty: 2 }));
    await act(g, "combatant:update", { id: a, abilities: { dex: 18 } });
    const mob = (id: string) => game().battle.mobs.find((m) => m.id === id)!;
    assert.equal(mob(b).ac, 15);
    assert.deepEqual(mob(b).abilities, { dex: 14 }, "mexer em um não mexe no outro");
    assert.deepEqual(game().templates[0].abilities, { dex: 14 });
    const [npc] = idsOf(await act(g, "npc:addFromTemplate", { templateId: tid }));
    assert.equal(game().battle.npcs.find((n) => n.id === npc)?.ac, 15);
  });

  it("editar: null apaga a CA, {} apaga os atributos; valor inválido não muda nada", async () => {
    const ana = await player("Ana");
    const [id] = idsOf(await act(ana, "ally:create", { name: "Lia", hpMax: 15, dexMod: 3, ac: 13, abilities: { dex: 16 } }));
    const lia = () => game().allies[0];
    assert.equal((await act(ana, "combatant:update", { id, name: "Lia Nova", ac: 200 })).ok, false);
    assert.equal(lia().name, "Lia", "nada pela metade");
    assert.equal((await act(ana, "combatant:update", { id, abilities: { sorte: 10 } as never })).ok, false);
    assert.ok((await act(ana, "combatant:update", { id, ac: null, abilities: {} })).ok);
    assert.equal(lia().ac, undefined);
    assert.equal(lia().abilities, undefined);
  });

  it("teste de atributo pela ficha sai no log como Teste de SAB", async () => {
    const ana = await player("Ana");
    await act(ana, "ally:create", { name: "Thorin", hpMax: 30, dexMod: 1, abilities: { wis: 16 } });
    assert.ok((await act(ana, "dice:roll", { expr: "1d20+3", check: "wis" })).ok);
    const last = game().log.at(-1)!;
    assert.equal(last.label, "Teste de SAB");
    assert.equal(last.as, "Thorin");
  });
});
