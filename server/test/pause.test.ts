import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { ActionResult, PingBroadcast } from "@rpg/shared";
import { act, join, stateWhere, useServer, type Client } from "./helpers";

// Passo 7 (backlog, "Mesa completa"): pausar o jogo e "olhem aqui".
const { ctx, client } = useServer();

function errorOf(res: ActionResult): string {
  assert.equal(res.ok, false, "deveria recusar");
  return res.ok ? "" : res.error;
}

let ipSeq = 1;
async function setup() {
  const g: Client = await client();
  await join(g, "Mestre");
  const ana: Client = await client(`10.77.0.${ipSeq++}`);
  await join(ana, `Ana-${ipSeq}`);
  return { g, ana };
}

function nextPing(c: Client): Promise<PingBroadcast> {
  return new Promise((resolve) => c.once("ping", resolve));
}

describe("pausa e olhem aqui", () => {
  it("o mestre pausa com aviso: todos recebem, o jogador não move token, o mestre move; retomar libera", async () => {
    const { g, ana } = await setup();
    const res = await act(ana, "ally:create", { name: "Kira", hpMax: 20, dexMod: 2 });
    assert.ok(res.ok);
    const id = res.ids![0];
    assert.match(errorOf(await act(ana, "pause:set", { paused: true })), /permissão/);

    const seen = stateWhere(ana, (s) => s.pause !== null);
    assert.ok((await act(g, "pause:set", { paused: true, message: "  Pausa de 10 min,   volto já.  " })).ok);
    assert.deepEqual((await seen).pause, { message: "Pausa de 10 min, volto já." });

    assert.match(errorOf(await act(ana, "token:move", { id, pos: { col: 3, row: 3 } })), /pausado/);
    assert.ok((await act(g, "token:move", { id, pos: { col: 3, row: 3 } })).ok, "o mestre continua ajeitando a cena");

    assert.ok((await act(g, "pause:set", { paused: false })).ok);
    assert.equal(ctx.server.store.pause, null);
    assert.ok((await act(ana, "token:move", { id, pos: { col: 4, row: 3 } })).ok);
  });

  it("aviso longo é cortado; sem aviso, fica vazio", async () => {
    const { g } = await setup();
    assert.ok((await act(g, "pause:set", { paused: true, message: "x".repeat(300) })).ok);
    assert.equal(ctx.server.store.pause?.message.length, 120);
    assert.ok((await act(g, "pause:set", { paused: true })).ok);
    assert.deepEqual(ctx.server.store.pause, { message: "" });
    assert.ok((await act(g, "pause:set", { paused: false })).ok);
  });

  it("olhem aqui: só o ping do mestre leva a visão; o do jogador é um ping comum", async () => {
    const { g, ana } = await setup();
    let p = nextPing(ana);
    g.emit("map:ping", { col: 5, row: 6, look: true });
    assert.equal((await p).look, true);
    p = nextPing(g);
    ana.emit("map:ping", { col: 1, row: 1, look: true });
    assert.equal((await p).look, undefined);
  });
});
