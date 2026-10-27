import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { ActionResult } from "@rpg/shared";
import { act, join, useServer } from "./helpers";

// Regras da mesa: opções que o mestre liga (movimento e invocação só na vez, em combate).
const { ctx, client } = useServer();

function idsOf(res: ActionResult): string[] {
  assert.ok(res.ok, res.ok ? "" : res.error);
  return res.ids ?? [];
}

function errorOf(res: ActionResult): string {
  assert.equal(res.ok, false, "deveria recusar");
  return res.ok ? "" : res.error;
}

describe("regras da mesa", () => {
  it("só o mestre liga; regra desconhecida ou valor inválido é recusado", async () => {
    const g = await client();
    await join(g, "Mestre");
    const ana = await client("10.47.0.1");
    await join(ana, "Ana");

    assert.match(errorOf(await act(ana, "rules:set", { moveOnTurn: true })), /permissão/i);
    assert.match(errorOf(await act(g, "rules:set", { moveOnTurn: "sim" as unknown as boolean })), /inválido/);
    assert.match(errorOf(await act(g, "rules:set", { voar: true } as never)), /desconhecida/);
    assert.deepEqual(ctx.server.store.game.rules, { moveOnTurn: false, summonOnTurn: false, darkReminder: false });
  });

  it("ligadas: em combate o jogador move e invoca só na sua vez; o mestre sempre; fora de combate, livre", async () => {
    const g = await client();
    await join(g, "Mestre");
    const bia = await client("10.47.0.2");
    await join(bia, "Bia");
    const [lia] = idsOf(await act(bia, "ally:create", { name: "Lia", hpMax: 20, dexMod: 0, ac: 14 }));
    const [orc] = idsOf(await act(g, "mob:add", { name: "Orc", hpMax: 15, dexMod: 0, ac: 13 }));
    assert.ok((await act(g, "rules:set", { moveOnTurn: true, summonOnTurn: true })).ok);
    assert.ok(ctx.server.store.game.log.some((e) => e.system && e.text === "Regra da mesa ligada: Movimento só na sua vez."));

    // Fora de combate: livre.
    assert.ok((await act(bia, "token:move", { id: lia, pos: { col: 1, row: 1 } })).ok);

    await act(g, "init:set", { id: orc, value: 20 });
    await act(g, "init:set", { id: lia, value: 5 });
    assert.ok((await act(g, "combat:start", {})).ok);

    // Vez do Orc: Bia não move nem invoca; o mestre move qualquer um.
    assert.match(errorOf(await act(bia, "token:move", { id: lia, pos: { col: 2, row: 1 } })), /na sua vez/);
    assert.match(errorOf(await act(bia, "summon:add", { summonerId: lia, name: "Lobo", hpMax: 11, dexMod: 2, ac: 13, qty: 1 })), /na sua vez/);
    assert.ok((await act(g, "token:move", { id: lia, pos: { col: 3, row: 1 } })).ok);

    // Vez da Lia: pode, e o invocado dela também anda na vez dela.
    assert.ok((await act(g, "combat:next", {})).ok);
    assert.ok((await act(bia, "token:move", { id: lia, pos: { col: 4, row: 1 } })).ok);
    const [lobo] = idsOf(await act(bia, "summon:add", { summonerId: lia, name: "Lobo", hpMax: 11, dexMod: 2, ac: 13, qty: 1 }));
    assert.ok((await act(bia, "token:move", { id: lobo, pos: { col: 6, row: 6 } })).ok);

    // Desligar a regra libera de novo.
    assert.ok((await act(g, "combat:next", {})).ok);
    assert.equal((await act(bia, "token:move", { id: lia, pos: { col: 5, row: 1 } })).ok, false);
    assert.ok((await act(g, "rules:set", { moveOnTurn: false })).ok);
    assert.ok((await act(bia, "token:move", { id: lia, pos: { col: 5, row: 1 } })).ok);
    assert.equal(ctx.server.store.game.rules.summonOnTurn, true, "só muda a que veio");
  });

  it("visão no escuro: o jogador marca no próprio personagem; mob não leva a marca; a regra liga pelo mestre", async () => {
    const g = await client();
    await join(g, "Mestre");
    const caio = await client("10.47.0.3");
    await join(caio, "Caio");
    const [kael] = idsOf(await act(caio, "ally:create", { name: "Kael", hpMax: 12, dexMod: 1, ac: 12, darkvision: true }));
    const kaelOf = () => ctx.server.store.game.allies.find((a) => a.id === kael)!;
    assert.equal(kaelOf().darkvision, true);
    assert.ok((await act(caio, "combatant:update", { id: kael, name: "Kael", hpMax: 12, dexMod: 1, darkvision: false })).ok);
    assert.equal(kaelOf().darkvision, undefined);
    const [rato] = idsOf(await act(g, "mob:add", { name: "Rato", hpMax: 2, dexMod: 0, darkvision: true }));
    assert.equal(ctx.server.store.game.battle.mobs.find((m) => m.id === rato)!.darkvision, undefined);
    assert.ok((await act(g, "rules:set", { darkReminder: true })).ok);
    assert.ok(ctx.server.store.game.log.some((e) => e.system && e.text === "Regra da mesa ligada: Lembrete de escuridão."));
  });
});
