import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { ActionResult } from "@rpg/shared";
import { act, join, useServer } from "./helpers";

// Iniciativa se rola uma vez: depois, só o mestre muda.
const { ctx, client } = useServer();
const thorinOf = () => ctx.server.store.game.allies.find((a) => a.name === "Thorin")!;

function idsOf(res: ActionResult): string[] {
  assert.ok(res.ok, res.ok ? "" : res.error);
  return res.ids ?? [];
}

function errorOf(res: ActionResult): string {
  assert.equal(res.ok, false, "deveria recusar");
  return res.ok ? "" : res.error;
}

describe("iniciativa uma vez só", () => {
  it("o jogador rola ou digita uma vez; depois só o mestre muda; Iniciativa de novo libera", async () => {
    const g = await client();
    await join(g, "Mestre");
    const ana = await client("10.42.0.1");
    await join(ana, "Ana");
    const [thorin] = idsOf(await act(ana, "ally:create", { name: "Thorin", hpMax: 30, dexMod: 1, ac: 18 }));

    assert.ok((await act(ana, "init:roll", { id: thorin })).ok);
    const first = thorinOf().initiative;
    assert.match(errorOf(await act(ana, "init:roll", { id: thorin })), /já foi rolada/);
    assert.match(errorOf(await act(ana, "init:set", { id: thorin, value: 30 })), /Só o mestre/);
    assert.match(errorOf(await act(ana, "init:set", { id: thorin, value: null })), /Só o mestre/);
    assert.equal(thorinOf().initiative, first, "não mudou");

    assert.ok((await act(g, "init:set", { id: thorin, value: 25 })).ok, "o mestre muda");
    assert.ok((await act(g, "init:roll", { id: thorin })).ok, "e rola de novo");

    // "Iniciativa de novo" zera todas: o jogador volta a rolar (uma vez).
    await act(g, "init:rerollAll", {});
    assert.equal(thorinOf().initiative, null);
    assert.ok((await act(ana, "init:set", { id: thorin, value: 17 })).ok, "digitar o dado físico também conta como a vez dele");
    assert.equal((await act(ana, "init:roll", { id: thorin })).ok, false);
  });
});
