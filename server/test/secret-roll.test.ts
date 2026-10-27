import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { ActionResult } from "@rpg/shared";
import { act, join, stateWhere, useServer } from "./helpers";

// Rolagem secreta: o mestre rola um teste do personagem de um jogador sem ele ver.
const { ctx, client } = useServer();
const game = () => ctx.server.store.game;

function idsOf(res: ActionResult): string[] {
  assert.ok(res.ok, res.ok ? "" : res.error);
  return res.ids ?? [];
}

describe("rolagem secreta por um jogador", () => {
  it("o mestre rola como o personagem, oculto: marca Secreto e o dono não recebe", async () => {
    const g = await client();
    await join(g, "Mestre");
    const ana = await client("10.45.0.1");
    await join(ana, "Ana");
    const [thorin] = idsOf(await act(ana, "ally:create", { name: "Thorin", hpMax: 30, dexMod: 1, ac: 18, abilities: { wis: 14 } }));

    const [secreta] = idsOf(await act(g, "dice:roll", { expr: "1d20+2", check: "wis", asId: thorin, hidden: true }));
    const entry = game().log.find((e) => e.id === secreta)!;
    assert.equal(entry.label, "Teste de SAB · Secreto");
    assert.equal(entry.as, "Thorin");
    assert.equal(entry.hidden, true);

    // Uma rolagem à vista depois: o estado do jogador com ela não tem a secreta.
    const seen = stateWhere(ana, (s) => s.log.some((e) => e.label === "Teste de SAB" && e.as === "Thorin"));
    await act(g, "dice:roll", { expr: "1d20+2", check: "wis", asId: thorin });
    const log = (await seen).log;
    assert.equal(log.some((e) => e.id === secreta), false, "o dono não vê a rolagem secreta");
  });

  it("oculta do mestre como mob não ganha a marca (mob já é segredo)", async () => {
    const g = await client();
    await join(g, "Mestre");
    const [orc] = idsOf(await act(g, "mob:add", { name: "Orc", hpMax: 15, dexMod: 1, ac: 13 }));
    const [id] = idsOf(await act(g, "dice:roll", { expr: "1d20", asId: orc, hidden: true }));
    assert.equal(game().log.find((e) => e.id === id)?.label, undefined);
  });
});
