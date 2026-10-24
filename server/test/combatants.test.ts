import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { ActionResult, ClientState } from "@rpg/shared";
import { UNDO_WINDOW_MS } from "../src/actions/combatants";
import { act, join, stateWhere, useServer, type Client } from "./helpers";

const { ctx, client } = useServer();

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
  const s = await client(`10.1.0.${ipSeq++}`);
  await join(s, name);
  return s;
}

const game = () => ctx.server.store.game;
const mob = (id: string) => game().battle.mobs.find((m) => m.id === id)!;
const ally = (id: string) => game().allies.find((a) => a.id === id)!;

describe("mobs", () => {
  it("template × 4 gera Goblin 1–4 com HP cheio; os próximos continuam a numeração", async () => {
    const g = await gm();
    const [tid] = idsOf(await act(g, "template:upsert", { name: "Goblin", hpMax: 7, dexMod: 2 }));
    const ids = idsOf(await act(g, "mob:addFromTemplate", { templateId: tid, qty: 4 }));

    assert.deepEqual(
      ids.map((id) => [mob(id).name, mob(id).hp, mob(id).hpMax, mob(id).dexMod]),
      [1, 2, 3, 4].map((n) => [`Goblin ${n}`, 7, 7, 2]),
    );

    await act(g, "mob:remove", { id: ids[3] });
    const [next] = idsOf(await act(g, "mob:addFromTemplate", { templateId: tid, qty: 1 }));
    assert.equal(mob(next).name, "Goblin 5", "não reaproveita o nome de um mob removido");
  });

  it("nome de template no limite: o número do mob nunca é cortado", async () => {
    const g = await gm();
    const long = "Goblin Arqueiro da Floresta Negr"; // 32 caracteres, o máximo
    const [tid] = idsOf(await act(g, "template:upsert", { name: long, hpMax: 7, dexMod: 2 }));
    const ids = idsOf(await act(g, "mob:addFromTemplate", { templateId: tid, qty: 12 }));
    const names = ids.map((id) => mob(id).name);
    assert.equal(new Set(names).size, 12, "nomes distintos");
    assert.ok(names.every((n) => n.length <= 32));
    assert.equal(names[0], "Goblin Arqueiro da Floresta Ne 1");
    assert.equal(names[11], "Goblin Arqueiro da Floresta N 12");
  });

  it("vida soma/subtrai o valor informado, entre 0 e o máximo; com 0 o mob continua", async () => {
    const g = await gm();
    const [id] = idsOf(await act(g, "mob:add", { name: "Ogro", hpMax: 59, dexMod: -1 }));

    await act(g, "hp:change", { id, delta: -20 });
    assert.equal(mob(id).hp, 39);
    await act(g, "hp:change", { id, delta: 100 });
    assert.equal(mob(id).hp, 59);
    await act(g, "hp:set", { id, value: 12 });
    assert.equal(mob(id).hp, 12);
    await act(g, "hp:change", { id, delta: -50 });
    assert.equal(mob(id).hp, 0);
    assert.ok(mob(id), "mob com 0 HP não é removido sozinho");
  });

  it("remover e desfazer restaura o mob na mesma posição", async () => {
    const g = await gm();
    const [tid] = idsOf(await act(g, "template:upsert", { name: "Lobo", hpMax: 11, dexMod: 2 }));
    const ids = idsOf(await act(g, "mob:addFromTemplate", { templateId: tid, qty: 3 }));
    await act(g, "hp:change", { id: ids[1], delta: -4 });

    assert.ok((await act(g, "mob:remove", { id: ids[1] })).ok);
    assert.equal(game().battle.mobs.length, 2);

    assert.ok((await act(g, "mob:restore", { id: ids[1] })).ok);
    assert.deepEqual(game().battle.mobs.map((m) => m.id), ids);
    assert.equal(mob(ids[1]).hp, 7, "volta com a vida que tinha");
  });

  it("desfazer expira depois da janela", async () => {
    const g = await gm();
    const [id] = idsOf(await act(g, "mob:add", { name: "Rato", hpMax: 1, dexMod: 0 }));
    await act(g, "mob:remove", { id });
    ctx.server.store.removedMobs.get(id)!.at -= UNDO_WINDOW_MS + 1;
    const res = await act(g, "mob:restore", { id });
    assert.equal(res.ok, false);
  });

  it("remover mob em combate mantém o turno de quem está jogando", async () => {
    const g = await gm();
    const ids = idsOf(await act(g, "mob:add", { name: "A", hpMax: 5, dexMod: 0 }));
    ids.push(...idsOf(await act(g, "mob:add", { name: "B", hpMax: 5, dexMod: 0 })));
    ids.push(...idsOf(await act(g, "mob:add", { name: "C", hpMax: 5, dexMod: 0 })));
    Object.assign(game().battle.combat, { active: true, round: 1, order: [...ids], turnIndex: 2 });

    await act(g, "mob:remove", { id: ids[0] });
    const combat = game().battle.combat;
    assert.equal(combat.order[combat.turnIndex], ids[2], "C continua na vez");

    await act(g, "mob:restore", { id: ids[0] });
    assert.deepEqual(combat.order, ids);
    assert.equal(combat.order[combat.turnIndex], ids[2]);
  });
});

describe("permissões", () => {
  it("jogador não cria template, não cria mob e não mexe na vida de mob", async () => {
    const g = await gm();
    const [id] = idsOf(await act(g, "mob:add", { name: "Goblin", hpMax: 7, dexMod: 2 }));
    const p = await player("Ana");

    for (const res of [
      await act(p, "template:upsert", { name: "X", hpMax: 1, dexMod: 0 }),
      await act(p, "mob:add", { name: "X", hpMax: 1, dexMod: 0 }),
      await act(p, "hp:change", { id, delta: -3 }),
      await act(p, "hp:set", { id, value: 0 }),
      await act(p, "mob:remove", { id }),
    ]) {
      assert.equal(res.ok, false);
    }
    assert.equal(mob(id).hp, 7);
  });

  it("jogador nunca recebe a vida dos mobs, nem depois de alterações", async () => {
    const g = await gm();
    const p = await player("Ana");
    const seen: ClientState[] = [];
    p.on("state:full", (s) => seen.push(s));

    const [tid] = idsOf(await act(g, "template:upsert", { name: "Goblin", hpMax: 7, dexMod: 2 }));
    const [id] = idsOf(await act(g, "mob:addFromTemplate", { templateId: tid, qty: 2 }));
    await act(g, "hp:change", { id, delta: -3 });
    await stateWhere(p, (s) => s.battle.mobs.length === 2);

    assert.ok(seen.length >= 2);
    for (const s of seen) {
      assert.equal(s.templates.length, 0, "jogador não vê o bestiário");
      for (const m of s.battle.mobs) assert.ok(!("hp" in m) && !("hpMax" in m));
    }
  });

  it("jogador controla a própria vida, mas não a de outro jogador; mestre controla todos", async () => {
    const g = await gm();
    const ana = await player("Ana");
    const bia = await player("Bia");
    const [anaId] = idsOf(await act(ana, "ally:create", { name: "Thorin", hpMax: 30, dexMod: 1 }));
    const [biaId] = idsOf(await act(bia, "ally:create", { name: "Lyra", hpMax: 22, dexMod: 3 }));

    assert.ok((await act(ana, "hp:change", { id: anaId, delta: -10 })).ok);
    assert.equal(ally(anaId).hp, 20);

    for (const res of [
      await act(ana, "hp:change", { id: biaId, delta: -5 }),
      await act(ana, "combatant:update", { id: biaId, hpMax: 1 }),
      await act(ana, "ally:remove", { id: biaId }),
    ]) {
      assert.equal(res.ok, false);
    }
    assert.equal(ally(biaId).hp, 22);

    assert.ok((await act(g, "hp:change", { id: biaId, delta: -2 })).ok);
    assert.equal(ally(biaId).hp, 20);
  });
});

describe("aliados", () => {
  it("vida cheia e edição livre do HP máximo", async () => {
    const p = await player("Ana");
    const [id] = idsOf(await act(p, "ally:create", { name: "Thorin", hpMax: 30, dexMod: 1 }));

    await act(p, "hp:set", { id, value: 0 });
    assert.equal(ally(id).hp, 0, "aliado com 0 HP continua (caído)");

    await act(p, "hp:full", { id });
    assert.equal(ally(id).hp, 30);

    await act(p, "combatant:update", { id, hpMax: 38 });
    assert.deepEqual([ally(id).hp, ally(id).hpMax], [30, 38], "subir o máximo não cura");
    await act(p, "hp:full", { id });
    assert.equal(ally(id).hp, 38);

    await act(p, "combatant:update", { id, hpMax: 25 });
    assert.deepEqual([ally(id).hp, ally(id).hpMax], [25, 25], "baixar o máximo limita a vida");
  });

  it("valores inválidos são recusados sem alterar nada", async () => {
    const p = await player("Ana");
    const [id] = idsOf(await act(p, "ally:create", { name: "Thorin", hpMax: 30, dexMod: 1 }));

    const res = await act(p, "combatant:update", { id, name: "Novo nome", hpMax: 0 });
    assert.equal(res.ok, false);
    assert.equal(ally(id).name, "Thorin", "não aplica edição pela metade");

    // Jogador novo, sem personagem: a recusa vem da validação, não do limite de 1 personagem.
    const q = await player("Bia");
    assert.equal((await act(q, "ally:create", { name: "", hpMax: 10, dexMod: 0 })).ok, false);
    assert.equal((await act(q, "ally:create", { name: "X", hpMax: 10, dexMod: 99 })).ok, false);
    assert.ok((await act(q, "ally:create", { name: "Lyra", hpMax: 10, dexMod: 2 })).ok);
  });

  it("jogador cria só um personagem; o mestre cria quantos aliados quiser", async () => {
    const p = await player("Ana");
    assert.ok((await act(p, "ally:create", { name: "Thorin", hpMax: 30, dexMod: 1 })).ok);
    const second = await act(p, "ally:create", { name: "Outro", hpMax: 10, dexMod: 0 });
    assert.equal(second.ok, false);
    assert.match(second.ok ? "" : second.error, /já tem um personagem/);

    const g = await gm();
    for (const name of ["Guarda", "Ferreiro", "Taverneiro"]) {
      assert.ok((await act(g, "ally:create", { name, hpMax: 8, dexMod: 0 })).ok);
    }
    assert.equal(ctx.server.store.game.allies.length, 4);
  });

  it("jogador que removeu o personagem pode criar outro", async () => {
    const p = await player("Ana");
    const [id] = idsOf(await act(p, "ally:create", { name: "Thorin", hpMax: 30, dexMod: 1 }));
    assert.ok((await act(p, "ally:remove", { id })).ok);
    assert.ok((await act(p, "ally:create", { name: "Thorin II", hpMax: 30, dexMod: 1 })).ok);
  });
});
