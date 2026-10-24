import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { ActionResult } from "@rpg/shared";
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
  const s = await client(`10.4.0.${ipSeq++}`);
  await join(s, name);
  return s;
}

const combat = () => ctx.server.store.game.battle.combat;
const nameOf = (id: string) =>
  [...ctx.server.store.game.allies, ...ctx.server.store.game.battle.mobs].find((c) => c.id === id)?.name;
const orderNames = () => combat().order.map(nameOf);
const current = () => nameOf(combat().order[combat().turnIndex]);

async function mob(g: Client, name: string, dexMod = 0) {
  return idsOf(await act(g, "mob:add", { name, hpMax: 10, dexMod }))[0];
}

describe("ordem de iniciativa", () => {
  it("ordena pelo total e desempata pelo mod. DES", async () => {
    const g = await gm();
    const a = await mob(g, "A", 1);
    const b = await mob(g, "B", 3);
    const c = await mob(g, "C", 0);
    await act(g, "init:set", { id: a, value: 15 });
    await act(g, "init:set", { id: b, value: 15 });
    await act(g, "init:set", { id: c, value: 18 });
    assert.deepEqual(orderNames(), ["C", "B", "A"]);
  });

  it("mestre reordena à mão (empate total) e mudar o valor reposiciona", async () => {
    const g = await gm();
    const a = await mob(g, "A");
    const b = await mob(g, "B");
    await act(g, "init:set", { id: a, value: 12 });
    await act(g, "init:set", { id: b, value: 12 });
    assert.deepEqual(orderNames(), ["A", "B"]);
    await act(g, "init:move", { id: b, toIndex: 0 });
    assert.deepEqual(orderNames(), ["B", "A"]);
    await act(g, "init:set", { id: a, value: 20 });
    assert.deepEqual(orderNames(), ["A", "B"]);
    await act(g, "init:set", { id: a, value: null });
    assert.deepEqual(orderNames(), ["B"]);
  });

  it("rolagem = d20 + mod. DES e aparece no log", async () => {
    const p = await player("Ana");
    const [id] = idsOf(await act(p, "ally:create", { name: "Thorin", hpMax: 30, dexMod: 3 }));
    const seen = stateWhere(p, (s) => s.log.length === 1);
    assert.ok((await act(p, "init:roll", { id })).ok);
    const ally = ctx.server.store.game.allies[0];
    assert.ok(ally.initRoll! >= 1 && ally.initRoll! <= 20);
    assert.equal(ally.initiative, ally.initRoll! + 3);
    const s = await seen;
    assert.equal(s.log[0].label, "Iniciativa · Thorin");
    assert.equal(s.log[0].roll?.total, ally.initiative);
  });

  it("rolar mobs em grupo dá o mesmo valor por template", async () => {
    const g = await gm();
    const [tid] = idsOf(await act(g, "template:upsert", { name: "Goblin", hpMax: 7, dexMod: 2 }));
    await act(g, "mob:addFromTemplate", { templateId: tid, qty: 4 });
    await mob(g, "Chefe", 1);

    assert.ok((await act(g, "init:rollMobs", { grouped: true })).ok);
    const goblins = ctx.server.store.game.battle.mobs.filter((m) => m.templateId === tid);
    assert.equal(new Set(goblins.map((m) => m.initiative)).size, 1);
    assert.equal(combat().order.length, 5);
    // Empatados no total e no DES: ficam juntos, na ordem em que foram criados.
    const idx = goblins.map((m) => combat().order.indexOf(m.id));
    assert.deepEqual(idx, [...idx].sort((x, y) => x - y));
  });
});

describe("turnos", () => {
  async function setup() {
    const g = await gm();
    const ids = [await mob(g, "A"), await mob(g, "B"), await mob(g, "C")];
    await act(g, "init:set", { id: ids[0], value: 20 });
    await act(g, "init:set", { id: ids[1], value: 15 });
    await act(g, "init:set", { id: ids[2], value: 10 });
    return { g, ids };
  }

  it("iniciar, próximo, anterior e virada de round", async () => {
    const { g } = await setup();
    assert.ok((await act(g, "combat:start", {})).ok);
    assert.deepEqual([combat().round, current()], [1, "A"]);
    await act(g, "combat:next", {});
    await act(g, "combat:next", {});
    assert.deepEqual([combat().round, current()], [1, "C"]);
    await act(g, "combat:next", {});
    assert.deepEqual([combat().round, current()], [2, "A"], "virar o último incrementa o round");
    await act(g, "combat:prev", {});
    assert.deepEqual([combat().round, current()], [1, "C"]);
  });

  it("não inicia sem iniciativa", async () => {
    const g = await gm();
    await mob(g, "A");
    assert.equal((await act(g, "combat:start", {})).ok, false);
  });

  it("quem entra no meio do combate vai para a posição certa sem mudar a vez", async () => {
    const { g } = await setup();
    await act(g, "combat:start", {});
    await act(g, "combat:next", {}); // vez do B (15)

    const before = await mob(g, "Rápido");
    await act(g, "init:set", { id: before, value: 25 }); // entra antes de quem está jogando
    const after = await mob(g, "Lento");
    await act(g, "init:set", { id: after, value: 5 });

    assert.deepEqual(orderNames(), ["Rápido", "A", "B", "C", "Lento"]);
    assert.equal(current(), "B");
  });

  it("re-rolar quem está na vez mantém a vez com ele", async () => {
    const { g, ids } = await setup();
    await act(g, "combat:start", {});
    await act(g, "combat:next", {}); // B
    await act(g, "init:set", { id: ids[1], value: 1 });
    assert.deepEqual(orderNames(), ["A", "C", "B"]);
    assert.equal(current(), "B");
  });

  it("remover mob na vez passa a vez para o próximo", async () => {
    const { g, ids } = await setup();
    await act(g, "combat:start", {});
    await act(g, "combat:next", {}); // B
    await act(g, "mob:remove", { id: ids[1] });
    assert.equal(current(), "C");
  });

  it("encerrar zera round e iniciativas e mantém os combatentes", async () => {
    const { g } = await setup();
    await act(g, "combat:start", {});
    await act(g, "combat:end", {});
    assert.deepEqual({ ...combat(), turn: 0 }, { active: false, round: 0, turnIndex: 0, order: [], turn: 0 });
    const mobs = ctx.server.store.game.battle.mobs;
    assert.equal(mobs.length, 3);
    assert.ok(mobs.every((m) => m.initiative === null));
  });
});

describe("permissões", () => {
  it("jogador rola/define só a própria iniciativa e não controla turnos", async () => {
    const g = await gm();
    const ana = await player("Ana");
    const bia = await player("Bia");
    const [anaId] = idsOf(await act(ana, "ally:create", { name: "Thorin", hpMax: 30, dexMod: 1 }));
    const [biaId] = idsOf(await act(bia, "ally:create", { name: "Lyra", hpMax: 20, dexMod: 3 }));
    const m = await mob(g, "Goblin");

    assert.ok((await act(ana, "init:set", { id: anaId, value: 14 })).ok);
    for (const res of [
      await act(ana, "init:roll", { id: biaId }),
      await act(ana, "init:set", { id: m, value: 1 }),
      await act(ana, "init:rollMobs", {}),
      await act(ana, "init:move", { id: anaId, toIndex: 0 }),
      await act(ana, "combat:start", {}),
      await act(ana, "combat:next", {}),
      await act(ana, "combat:end", {}),
    ]) {
      assert.equal(res.ok, false);
    }
    assert.equal(combat().active, false);
  });

  it("valor fora do limite é recusado", async () => {
    const p = await player("Ana");
    const [id] = idsOf(await act(p, "ally:create", { name: "Thorin", hpMax: 30, dexMod: 1 }));
    assert.equal((await act(p, "init:set", { id, value: 500 })).ok, false);
  });
});
