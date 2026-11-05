import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { ActionResult } from "@rpg/shared";
import { act, join, useServer, type Client } from "./helpers";

// Passo 10 (backlog, "Mesa completa"): altura/voo e direção do token. Só visual.
const { ctx, client } = useServer();
const ally = (id: string) => ctx.server.store.game.allies.find((a) => a.id === id)!;

function errorOf(res: ActionResult): string {
  assert.equal(res.ok, false, "deveria recusar");
  return res.ok ? "" : res.error;
}

let ipSeq = 1;
async function setup() {
  const g: Client = await client();
  await join(g, "Mestre");
  const ana: Client = await client(`10.80.0.${ipSeq++}`);
  await join(ana, `Ana-${ipSeq}`);
  const bia: Client = await client(`10.80.0.${ipSeq++}`);
  await join(bia, `Bia-${ipSeq}`);
  const res = await act(ana, "ally:create", { name: "Kira", hpMax: 20, dexMod: 3 });
  assert.ok(res.ok);
  return { g, ana, bia, id: res.ids![0] };
}

describe("altura e direção do token", () => {
  it("o dono muda altura e direção; a direção dá a volta; null volta ao chão e tira a direção", async () => {
    const { ana, id } = await setup();
    assert.ok((await act(ana, "token:pose", { id, elevation: 30, facing: 45 })).ok);
    assert.deepEqual([ally(id).elevation, ally(id).facing], [30, 45]);
    assert.ok((await act(ana, "token:pose", { id, facing: -45 })).ok);
    assert.equal(ally(id).facing, 315, "−45° vira 315°");
    assert.equal(ally(id).elevation, 30, "o que não vem fica como está");
    assert.ok((await act(ana, "token:pose", { id, elevation: -10 })).ok);
    assert.equal(ally(id).elevation, -10, "escavando");
    assert.ok((await act(ana, "token:pose", { id, elevation: 0, facing: null })).ok);
    assert.equal(ally(id).elevation, undefined, "0 = no chão, sem campo");
    assert.equal(ally(id).facing, undefined);
  });

  it("recusa altura fora do limite, outro jogador e jogador com o jogo pausado", async () => {
    const { g, ana, bia, id } = await setup();
    assert.match(errorOf(await act(ana, "token:pose", { id, elevation: 99999 })), /Altura/);
    assert.match(errorOf(await act(bia, "token:pose", { id, elevation: 5 })), /permissão/);
    assert.ok((await act(g, "pause:set", { paused: true })).ok);
    assert.match(errorOf(await act(ana, "token:pose", { id, elevation: 5 })), /pausado/);
    assert.ok((await act(g, "token:pose", { id, elevation: 5 })).ok, "o mestre continua");
    assert.ok((await act(g, "pause:set", { paused: false })).ok);
  });
});
