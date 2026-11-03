import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { overlaps, sizeSpan, type ActionResult } from "@rpg/shared";
import { act, join, useServer } from "./helpers";

// Levar o grupo (ao abrir uma cena): o mestre clica num ponto e os aliados chegam juntos em volta dele.
const { ctx, client } = useServer();
const game = () => ctx.server.store.game;

function idsOf(res: ActionResult): string[] {
  assert.ok(res.ok, res.ok ? "" : res.error);
  return res.ids ?? [];
}

describe("levar o grupo", () => {
  it("todos os aliados em volta do ponto, sem sobrepor ninguém; só o mestre", async () => {
    const g = await client();
    await join(g, "Mestre");
    const ana = await client("10.72.0.1");
    await join(ana, "Ana");
    assert.equal((await act(g, "allies:gather", { at: { col: 5, row: 5 } })).ok, false, "sem aliados");

    const [thorin] = idsOf(await act(ana, "ally:create", { name: "Thorin", hpMax: 30, dexMod: 0 }));
    const bia = await client("10.72.0.2");
    await join(bia, "Bia");
    idsOf(await act(bia, "ally:create", { name: "Urso", hpMax: 30, dexMod: 0, size: "large" }));
    idsOf(await act(ana, "summon:add", { summonerId: thorin, name: "Lobo", hpMax: 11, dexMod: 2, ac: 13, qty: 2 }));
    const [orc] = idsOf(await act(g, "mob:add", { name: "Orc", hpMax: 15, dexMod: 0 }));
    assert.ok((await act(g, "token:move", { id: orc, pos: { col: 5, row: 5 } })).ok);

    assert.equal((await act(ana, "allies:gather", { at: { col: 5, row: 5 } })).ok, false, "jogador não leva o grupo");
    assert.ok((await act(g, "allies:gather", { at: { col: 5, row: 5 } })).ok);

    const allies = game().allies;
    assert.equal(allies.length, 4);
    const bodies = [...allies, game().battle.mobs[0]];
    for (const a of allies) {
      assert.ok(a.pos, a.name + " no mapa");
      assert.ok(Math.abs(a.pos!.col - 5) <= 4 && Math.abs(a.pos!.row - 5) <= 4, a.name + " perto do ponto");
      for (const o of bodies) {
        if (o === a) continue;
        assert.ok(!overlaps(a.pos!, sizeSpan(a.size), o.pos!, sizeSpan(o.size)), a.name + " não fica em cima de " + o.name);
      }
    }
    assert.equal((await act(g, "allies:gather", { at: { col: 1.5, row: 2 } })).ok, false, "só casa inteira");
  });
});
