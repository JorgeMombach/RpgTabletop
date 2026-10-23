import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { ClientState } from "@rpg/shared";
import { MAX, join, nextState, stateWhere, useServer } from "./helpers";

const { ctx, client } = useServer();

describe("papéis", () => {
  it("conexão local vira mestre e remota vira jogador", async () => {
    const gm = await client();
    const pl = await client("192.168.0.10");

    assert.deepEqual(await gm.emitWithAck("session:probe", {}), { role: "gm" });
    assert.deepEqual(await pl.emitWithAck("session:probe", {}), { role: "player" });

    const g = await join(gm, "Mestre");
    const p = await join(pl, "Ana");
    assert.ok(g.ok && g.self.role === "gm");
    assert.ok(p.ok && p.self.role === "player");
  });

  it("toda conexão local assume o mesmo mestre", async () => {
    const a = await join(await client(), "Mestre");
    const b = await join(await client(), "Mestre (aba 2)");
    assert.ok(a.ok && b.ok);
    assert.equal(a.self.id, b.self.id);
    assert.equal([...ctx.server.store.players.values()].filter((p) => p.role === "gm").length, 1);
  });

  it("rejeita nome vazio", async () => {
    const res = await join(await client("10.0.0.2"), "   ");
    assert.deepEqual(res, { ok: false, error: "invalid_name" });
  });
});

describe("capacidade", () => {
  it(`aceita ${MAX} jogadores e recusa o seguinte`, async () => {
    await join(await client(), "Mestre");
    for (let i = 0; i < MAX; i++) {
      const res = await join(await client(`10.0.0.${i + 10}`), `Jogador ${i + 1}`);
      assert.ok(res.ok, `jogador ${i + 1} deveria entrar`);
    }
    const extra = await join(await client("10.0.0.99"), "Sobrando");
    assert.deepEqual(extra, { ok: false, error: "room_full" });
  });

  it("vaga de quem saiu fica livre", async () => {
    const sockets = [];
    for (let i = 0; i < MAX; i++) {
      const s = await client(`10.0.1.${i + 10}`);
      sockets.push(s);
      assert.ok((await join(s, `J${i}`)).ok);
    }
    sockets[0].disconnect();
    await new Promise((r) => setTimeout(r, 50));
    assert.ok((await join(await client("10.0.1.99"), "Novo")).ok);
  });
});

describe("reconexão", () => {
  it("token devolve a mesma identidade e a lista mostra online/offline", async () => {
    const gm = await client();
    await join(gm, "Mestre");

    const first = await client("10.0.2.1");
    const res = await join(first, "Ana");
    assert.ok(res.ok);

    const ana = (s: ClientState) => s.players.find((p) => p.id === res.self.id);

    const offline = stateWhere(gm, (s) => ana(s)?.connected === false);
    first.disconnect();
    await offline;

    const online = stateWhere(gm, (s) => ana(s)?.connected === true);
    const again = await join(await client("10.0.2.1"), "Ana", res.sessionToken);
    assert.ok(again.ok);
    assert.equal(again.self.id, res.self.id);
    const s2 = await online;
    assert.equal(s2.players.filter((p) => p.role === "player").length, 1, "não duplica o jogador");
  });

  it("token de jogador não vale numa conexão local (vira mestre)", async () => {
    const p = await join(await client("10.0.3.1"), "Ana");
    assert.ok(p.ok);
    const local = await join(await client(), "Ana", p.sessionToken);
    assert.ok(local.ok && local.self.role === "gm");
  });
});

describe("filtro por papel", () => {
  it("jogador não recebe vida de mob; mestre recebe", async () => {
    ctx.server.store.game.battle.mobs.push({
      id: "m1",
      name: "Goblin 1",
      type: "mob",
      hp: 7,
      hpMax: 7,
      dexMod: 2,
      color: "#c33333",
      pos: null,
      initiative: null,
      initRoll: null,
    });

    const gm = await client();
    const gmState = nextState(gm);
    await join(gm, "Mestre");
    const g = await gmState;
    assert.equal(g.battle.mobs[0].hp, 7);
    assert.ok(g.host, "mestre recebe os endereços de acesso");

    const pl = await client("10.0.4.1");
    const plState = nextState(pl);
    await join(pl, "Ana");
    const p = await plState;
    assert.equal(p.battle.mobs[0].name, "Goblin 1");
    assert.ok(!("hp" in p.battle.mobs[0]) && !("hpMax" in p.battle.mobs[0]));
    assert.equal(p.host, undefined);
    assert.ok(!JSON.stringify(p).includes('"hp"'));
  });
});
