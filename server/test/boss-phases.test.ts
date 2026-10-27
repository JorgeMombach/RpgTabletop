import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { ActionResult, ClientState } from "@rpg/shared";
import { act, join, stateWhere, useServer } from "./helpers";

// Chefe com fases: zerou a vida de uma fase, começa a próxima (com aviso no log).
const { ctx, client } = useServer();

function idsOf(res: ActionResult): string[] {
  assert.ok(res.ok, res.ok ? "" : res.error);
  return res.ids ?? [];
}

const mobOf = (id: string) => ctx.server.store.game.battle.mobs.find((m) => m.id === id)!;

describe("chefe com fases", () => {
  it("zerar a fase começa a próxima com vida cheia, nome e CA novos; a última fase zera de vez", async () => {
    const g = await client();
    await join(g, "Mestre");
    const [boss] = idsOf(
      await act(g, "mob:add", { name: "Avanthir", hpMax: 50, dexMod: 2, ac: 17, phases: [{ hpMax: 30, name: "Avanthir Enfurecido", ac: 15 }, { hpMax: 20 }] }),
    );
    assert.equal(mobOf(boss).phases?.length, 2);

    // O dano que sobra não passa para a fase seguinte.
    assert.ok((await act(g, "hp:change", { id: boss, delta: -70 })).ok);
    let b = mobOf(boss);
    assert.deepEqual([b.phase, b.hp, b.hpMax, b.name, b.ac, b.phases?.length], [2, 30, 30, "Avanthir Enfurecido", 15, 1]);
    assert.ok(ctx.server.store.game.log.some((e) => e.system && e.text === "Avanthir passou para a fase 2: agora é Avanthir Enfurecido."));

    // Zerar pelo "definir vida" também passa de fase; sem nome novo, mantém o nome e a CA.
    assert.ok((await act(g, "hp:set", { id: boss, value: 0 })).ok);
    b = mobOf(boss);
    assert.deepEqual([b.phase, b.hp, b.hpMax, b.name, b.ac, b.phases], [3, 20, 20, "Avanthir Enfurecido", 15, undefined]);
    assert.ok(ctx.server.store.game.log.some((e) => e.text === "Avanthir Enfurecido passou para a fase 3."));

    // Última fase: zera e fica abatido, como qualquer mob.
    await act(g, "hp:change", { id: boss, delta: -25 });
    assert.equal(mobOf(boss).hp, 0);
    assert.equal(mobOf(boss).phase, 3);
  });

  it("template leva as fases; o jogador não recebe a vida das fases; validação", async () => {
    const g = await client();
    await join(g, "Mestre");
    const ana = await client("10.49.0.1");
    await join(ana, "Ana");

    const [tpl] = idsOf(await act(g, "template:upsert", { name: "Dragão", hpMax: 100, dexMod: 0, phases: [{ hpMax: 60, name: "Dragão Ferido" }] }));
    const [d1] = idsOf(await act(g, "mob:addFromTemplate", { templateId: tpl, qty: 1 }));
    assert.deepEqual(mobOf(d1).phases, [{ hpMax: 60, name: "Dragão Ferido" }]);

    // Editar o mob troca as próximas fases; [] apaga.
    assert.ok((await act(g, "combatant:update", { id: d1, phases: [{ hpMax: 10 }, { hpMax: 5 }] })).ok);
    assert.equal(mobOf(d1).phases?.length, 2);

    const seen: Promise<ClientState> = stateWhere(ana, (s) => s.battle.mobs.some((m) => m.id === d1 && m.phase === 2));
    await act(g, "hp:set", { id: d1, value: 0 });
    const view = (await seen).battle.mobs.find((m) => m.id === d1)!;
    assert.equal("phases" in view, false, "jogador não recebe as fases (têm vida)");
    assert.equal(view.phase, 2);

    assert.ok((await act(g, "combatant:update", { id: d1, phases: [] })).ok);
    assert.equal(mobOf(d1).phases, undefined);

    assert.equal((await act(g, "mob:add", { name: "X", hpMax: 5, dexMod: 0, phases: [{ hpMax: 0 }] })).ok, false, "fase sem vida");
    const tooMany = Array.from({ length: 6 }, () => ({ hpMax: 5 }));
    assert.equal((await act(g, "mob:add", { name: "X", hpMax: 5, dexMod: 0, phases: tooMany })).ok, false);
  });
});
