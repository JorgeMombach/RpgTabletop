import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { ActionResult } from "@rpg/shared";
import { act, join, stateWhere, useServer } from "./helpers";

// Descrição pública (todos veem) e notas do mestre (só ele): em mobs, NPCs, aliados e no bestiário.
const { ctx, client } = useServer();
const game = () => ctx.server.store.game;

function idsOf(res: ActionResult): string[] {
  assert.ok(res.ok, res.ok ? "" : res.error);
  return res.ids ?? [];
}

function errorOf(res: ActionResult): string {
  assert.equal(res.ok, false, "deveria recusar");
  return res.ok ? "" : res.error;
}

describe("descrição e notas do mestre", () => {
  it("o template passa descrição e notas para o mob; o jogador vê a descrição e nunca as notas", async () => {
    const g = await client();
    await join(g, "Mestre");
    const ana = await client("10.44.0.1");
    await join(ana, "Ana");
    const [tpl] = idsOf(
      await act(g, "template:upsert", { name: "Avanthir, o Sábio", hpMax: 200, dexMod: 0, ac: 19, description: "Dragão ancião de neve.", notes: "Mente sobre o tesouro." }),
    );
    const seen = stateWhere(ana, (s) => s.battle.mobs.length === 1);
    const [dragao] = idsOf(await act(g, "mob:addFromTemplate", { templateId: tpl, qty: 1 }));
    const mob = game().battle.mobs.find((m) => m.id === dragao)!;
    assert.equal(mob.description, "Dragão ancião de neve.");
    assert.equal(mob.gmNotes, "Mente sobre o tesouro.");
    const view = (await seen).battle.mobs[0];
    assert.equal(view.description, "Dragão ancião de neve.");
    assert.equal("gmNotes" in view, false, "notas do mestre não vão para o jogador");
  });

  it("dono escreve a descrição do próprio personagem, mas não notas do mestre; nem ele recebe as notas", async () => {
    const g = await client();
    await join(g, "Mestre");
    const bia = await client("10.44.0.2");
    await join(bia, "Bia");
    const [lia] = idsOf(await act(bia, "ally:create", { name: "Lia", hpMax: 15, dexMod: 3, ac: 13, description: "Elfa ruiva, arco longo." }));
    assert.equal(game().allies.find((a) => a.id === lia)?.description, "Elfa ruiva, arco longo.");
    assert.match(errorOf(await act(bia, "combatant:update", { id: lia, gmNotes: "x" })), /Só o mestre/);
    assert.match(errorOf(await act(bia, "ally:create", { name: "Outro", hpMax: 5, dexMod: 0, ac: 10, gmNotes: "x" } as never)), /personagem|mestre/);

    const seen = stateWhere(bia, (s) => s.allies.some((a) => a.id === lia && a.description === "Elfa ruiva, arco longo, olhos verdes."));
    await act(g, "combatant:update", { id: lia, gmNotes: "É a herdeira perdida." });
    await act(bia, "combatant:update", { id: lia, description: "Elfa ruiva, arco longo, olhos verdes." });
    const mine = (await seen).allies.find((a) => a.id === lia)!;
    assert.equal("gmNotes" in mine, false, "nem o dono recebe as notas do mestre");
    assert.equal(game().allies.find((a) => a.id === lia)?.gmNotes, "É a herdeira perdida.");

    await act(g, "combatant:update", { id: lia, gmNotes: "", description: "" });
    const l = game().allies.find((a) => a.id === lia)!;
    assert.equal(l.gmNotes, undefined, "vazio apaga");
    assert.equal(l.description, undefined);
  });
});
