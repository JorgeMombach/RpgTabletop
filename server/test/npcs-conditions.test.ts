import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { ActionResult, Combatant } from "@rpg/shared";
import { allCombatants } from "../src/combat";
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
  const s = await client(`10.6.0.${ipSeq++}`);
  await join(s, name);
  return s;
}

const game = () => ctx.server.store.game;
const find = (id: string) => allCombatants(ctx.server.store).find((c) => c.id === id) as Combatant;
const conditions = (id: string) => find(id).conditions.map((k) => (k.rounds === null ? k.name : `${k.name} (${k.rounds})`));

describe("NPCs", () => {
  it("jogador vê o NPC no mapa e na iniciativa, mas não recebe a vida", async () => {
    const g = await gm();
    const [npc] = idsOf(await act(g, "npc:add", { name: "Taverneiro", hpMax: 12, dexMod: 1 }));
    await act(g, "token:move", { id: npc, pos: { col: 2, row: 3 } });
    await act(g, "init:set", { id: npc, value: 14 });

    const p = await client("10.6.1.1");
    const arrived = stateWhere(p, (s) => s.battle.npcs.length === 1);
    await join(p, "Ana");
    const s = await arrived;
    const view = s.battle.npcs[0];
    assert.equal(view.name, "Taverneiro");
    assert.equal(view.type, "npc");
    assert.deepEqual(view.pos, { col: 2, row: 3 });
    assert.deepEqual(s.battle.combat.order, [npc]);
    assert.ok(!("hp" in view) && !("hpMax" in view));
    assert.ok(!JSON.stringify(s).includes('"hp"'));

    const gs = stateWhere(g, (s) => s.battle.npcs[0]?.hp === 11);
    await act(g, "hp:change", { id: npc, delta: -1 });
    assert.equal((await gs).battle.npcs[0].hp, 11, "mestre recebe a vida");
  });

  it("só o mestre cria, move e edita NPCs", async () => {
    const g = await gm();
    const [npc] = idsOf(await act(g, "npc:add", { name: "Guarda", hpMax: 11, dexMod: 0 }));
    const p = await player("Ana");
    assert.equal((await act(p, "npc:add", { name: "X", hpMax: 1, dexMod: 0 })).ok, false);
    assert.equal((await act(p, "token:move", { id: npc, pos: { col: 0, row: 0 } })).ok, false);
    assert.equal((await act(p, "hp:change", { id: npc, delta: -5 })).ok, false);
    assert.equal(find(npc).hp, 11);
  });

  it("NPC a partir do template usa os dados dele, sem número no nome", async () => {
    const g = await gm();
    const [tid] = idsOf(await act(g, "template:upsert", { name: "Guarda", hpMax: 11, dexMod: 1 }));
    const [npc] = idsOf(await act(g, "npc:addFromTemplate", { templateId: tid }));
    assert.equal(find(npc).name, "Guarda");
    assert.equal(find(npc).hpMax, 11);
    assert.equal(game().battle.mobs.length, 0, "não vira mob");
  });

  it("remover NPC dá para desfazer e ele volta para a lista de NPCs", async () => {
    const g = await gm();
    const [npc] = idsOf(await act(g, "npc:add", { name: "Guarda", hpMax: 11, dexMod: 0 }));
    assert.ok((await act(g, "mob:remove", { id: npc })).ok);
    assert.equal(game().battle.npcs.length, 0);
    assert.ok((await act(g, "mob:restore", { id: npc })).ok);
    assert.equal(game().battle.npcs[0].id, npc);
    assert.equal(game().battle.mobs.length, 0);
  });

  it("rolar iniciativa dos mobs inclui os NPCs", async () => {
    const g = await gm();
    await act(g, "mob:add", { name: "Goblin", hpMax: 7, dexMod: 2 });
    await act(g, "npc:add", { name: "Guarda", hpMax: 11, dexMod: 0 });
    assert.ok((await act(g, "init:rollMobs", {})).ok);
    assert.equal(game().battle.combat.order.length, 2);
  });

  it("limpar o campo remove NPCs; aliados ficam com as condições", async () => {
    const g = await gm();
    const p = await player("Ana");
    const [ally] = idsOf(await act(p, "ally:create", { name: "Thorin", hpMax: 20, dexMod: 1 }));
    const [npc] = idsOf(await act(g, "npc:add", { name: "Guarda", hpMax: 11, dexMod: 0 }));
    await act(g, "condition:add", { id: npc, name: "Caído" });
    await act(p, "condition:add", { id: ally, name: "Concentração" });

    assert.ok((await act(g, "battle:clear", { keepTemplates: true })).ok);
    assert.equal(game().battle.npcs.length, 0);
    assert.deepEqual(conditions(ally), ["Concentração"]);
    assert.equal((await act(g, "mob:restore", { id: npc })).ok, false);
  });
});

describe("condições", () => {
  /** Thorin (aliado de Ana) age antes do Goblin. */
  async function setup() {
    const g = await gm();
    const p = await player("Ana");
    const [ally] = idsOf(await act(p, "ally:create", { name: "Thorin", hpMax: 20, dexMod: 1 }));
    const [goblin] = idsOf(await act(g, "mob:add", { name: "Goblin", hpMax: 7, dexMod: 0 }));
    await act(p, "init:set", { id: ally, value: 18 });
    await act(g, "init:set", { id: goblin, value: 10 });
    return { g, p, ally, goblin };
  }

  it("“Atordoado (2)” passa a 1 e depois some nos turnos de quem tem; sem duração não muda", async () => {
    const { g, goblin } = await setup();
    await act(g, "condition:add", { id: goblin, name: "Atordoado", rounds: 2 });
    await act(g, "condition:add", { id: goblin, name: "Envenenado" });
    await act(g, "combat:start", {}); // vez de Thorin
    assert.deepEqual(conditions(goblin), ["Atordoado (2)", "Envenenado"], "turno de outro não conta");

    await act(g, "combat:next", {}); // vez do Goblin, round 1
    assert.deepEqual(conditions(goblin), ["Atordoado (1)", "Envenenado"]);

    await act(g, "combat:next", {}); // Thorin, round 2
    assert.deepEqual(conditions(goblin), ["Atordoado (1)", "Envenenado"]);

    await act(g, "combat:next", {}); // Goblin, round 2
    assert.deepEqual(conditions(goblin), ["Envenenado"]);
    const last = game().log.at(-1)!;
    assert.equal(last.system, true);
    assert.equal(last.text, "Atordoado acabou em Goblin.");
  });

  it("iniciar o combate conta como início do turno de quem age primeiro", async () => {
    const { p, g, ally } = await setup();
    await act(p, "condition:add", { id: ally, name: "Abençoado", rounds: 1 });
    await act(g, "combat:start", {});
    assert.deepEqual(conditions(ally), []);
  });

  it("voltar o turno não mexe na contagem", async () => {
    const { g, goblin } = await setup();
    await act(g, "condition:add", { id: goblin, name: "Cego", rounds: 3 });
    await act(g, "combat:start", {});
    await act(g, "combat:next", {});
    assert.deepEqual(conditions(goblin), ["Cego (2)"]);
    await act(g, "combat:prev", {});
    assert.deepEqual(conditions(goblin), ["Cego (2)"]);
  });

  it("a mesma condição de novo atualiza a duração em vez de duplicar", async () => {
    const { g, goblin } = await setup();
    await act(g, "condition:add", { id: goblin, name: "Atordoado", rounds: 1 });
    await act(g, "condition:add", { id: goblin, name: "  atordoado ", rounds: 3 });
    assert.deepEqual(conditions(goblin), ["Atordoado (3)"]);
  });

  it("jogador põe e tira condição só do próprio personagem", async () => {
    const { p, goblin, ally } = await setup();
    assert.equal((await act(p, "condition:add", { id: goblin, name: "Caído" })).ok, false);
    const [cid] = idsOf(await act(p, "condition:add", { id: ally, name: "Concentração" }));
    assert.ok((await act(p, "condition:remove", { id: ally, conditionId: cid })).ok);
    assert.deepEqual(conditions(ally), []);
  });

  it("valida nome, duração e limite sem alterar o estado", async () => {
    const { g, goblin } = await setup();
    assert.equal((await act(g, "condition:add", { id: goblin, name: "   " })).ok, false);
    assert.equal((await act(g, "condition:add", { id: goblin, name: "Cego", rounds: 0 })).ok, false);
    assert.equal((await act(g, "condition:add", { id: goblin, name: "Cego", rounds: 1.5 as number })).ok, true);
    assert.deepEqual(conditions(goblin), ["Cego (1)"]);
    for (let i = 1; i < 12; i++) await act(g, "condition:add", { id: goblin, name: `Efeito ${i}` });
    const res = await act(g, "condition:add", { id: goblin, name: "Mais um" });
    assert.equal(res.ok, false);
    assert.equal(find(goblin).conditions.length, 12);
  });

  it("jogador vê as condições dos mobs (não são segredo)", async () => {
    const { g, p, goblin } = await setup();
    const arrived = stateWhere(p, (s) => s.battle.mobs[0]?.conditions.length === 1);
    await act(g, "condition:add", { id: goblin, name: "Caído" });
    const s = await arrived;
    assert.equal(s.battle.mobs[0].conditions[0].name, "Caído");
  });
});
