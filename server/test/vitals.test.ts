import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { ActionResult } from "@rpg/shared";
import { act, join, stateWhere, useServer, type Client } from "./helpers";

// Vida temporária e testes contra a morte: só registro, a mesa decide.
const { ctx, client } = useServer();
const ally = () => ctx.server.store.game.allies[0];

function idsOf(res: ActionResult): string[] {
  assert.ok(res.ok, res.ok ? "" : res.error);
  return res.ids ?? [];
}

function errorOf(res: ActionResult): string {
  assert.equal(res.ok, false, "deveria recusar");
  return res.ok ? "" : res.error;
}

let ipSeq = 1;
async function player(name: string): Promise<Client> {
  const s = await client(`10.33.0.${ipSeq++}`);
  await join(s, name);
  return s;
}

async function gm(): Promise<Client> {
  const s = await client();
  await join(s, "Mestre");
  return s;
}

describe("vida temporária", () => {
  it("o dano tira primeiro da temporária; a cura não mexe nela; valor novo substitui", async () => {
    const ana = await player("Ana");
    const [id] = idsOf(await act(ana, "ally:create", { name: "Thorin", hpMax: 30, dexMod: 1, ac: 18 }));
    await act(ana, "hp:temp", { id, value: 8 });
    await act(ana, "hp:change", { id, delta: -5 });
    assert.equal(ally().tempHp, 3);
    assert.equal(ally().hp, 30);
    await act(ana, "hp:change", { id, delta: -7 });
    assert.equal(ally().tempHp, undefined, "acabou a temporária");
    assert.equal(ally().hp, 26, "o resto foi na vida");
    await act(ana, "hp:temp", { id, value: 5 });
    await act(ana, "hp:temp", { id, value: 3 });
    assert.equal(ally().tempHp, 3, "não soma");
    await act(ana, "hp:change", { id, delta: 4 });
    assert.equal(ally().tempHp, 3);
    await act(ana, "hp:temp", { id, value: 0 });
    assert.equal(ally().tempHp, undefined);
  });

  it("jogador não recebe a vida temporária de um mob", async () => {
    const g = await gm();
    const ana = await player("Ana");
    const [ogro] = idsOf(await act(g, "mob:add", { name: "Ogro", hpMax: 59, dexMod: -1, ac: 11 }));
    await act(g, "hp:temp", { id: ogro, value: 10 });
    // Um estado novo, já com a vida temporária aplicada no servidor.
    const next = stateWhere(ana, (st) => st.allies.length === 1);
    await act(ana, "ally:create", { name: "Thorin", hpMax: 30, dexMod: 1, ac: 18 });
    const s = await next;
    assert.equal(ctx.server.store.game.battle.mobs[0].tempHp, 10);
    assert.equal("tempHp" in s.battle.mobs[0], false);
  });
});

describe("testes contra a morte", () => {
  it("só com 0 de vida; marcar e desmarcar; voltar a ter vida zera", async () => {
    const ana = await player("Ana");
    const [id] = idsOf(await act(ana, "ally:create", { name: "Thorin", hpMax: 30, dexMod: 1, ac: 18 }));
    assert.match(errorOf(await act(ana, "death:set", { id, successes: 1, failures: 0 })), /0 de vida/);
    await act(ana, "hp:change", { id, delta: -30 });
    assert.ok((await act(ana, "death:set", { id, successes: 2, failures: 1 })).ok);
    assert.deepEqual(ally().deathSaves, { successes: 2, failures: 1 });
    assert.equal((await act(ana, "death:set", { id, successes: 4, failures: 0 })).ok, false);
    await act(ana, "hp:change", { id, delta: 1 });
    assert.equal(ally().deathSaves, undefined, "curado: zera");
  });

  it("rolagem sai no log como Teste contra a morte; mob não tem", async () => {
    const g = await gm();
    const ana = await player("Ana");
    await act(ana, "ally:create", { name: "Thorin", hpMax: 30, dexMod: 1, ac: 18 });
    assert.ok((await act(ana, "dice:roll", { expr: "1d20", death: true })).ok);
    assert.equal(ctx.server.store.game.log.at(-1)?.label, "Teste contra a morte");
    const [ogro] = idsOf(await act(g, "mob:add", { name: "Ogro", hpMax: 59, dexMod: -1, ac: 11 }));
    await act(g, "hp:change", { id: ogro, delta: -59 });
    assert.match(errorOf(await act(g, "death:set", { id: ogro, successes: 1, failures: 0 })), /personagens/);
  });
});
