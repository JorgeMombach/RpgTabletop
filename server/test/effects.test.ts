import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { ActionPayloads, ActionResult, Area } from "@rpg/shared";
import { act, join, stateWhere, useServer, type Client } from "./helpers";

const { ctx, client } = useServer();

function idsOf(res: ActionResult): string[] {
  assert.ok(res.ok, res.ok ? "" : res.error);
  return res.ids ?? [];
}

async function gm(): Promise<Client> {
  const s = await client();
  await join(s, "Mestre");
  return s;
}

let ipSeq = 1;
async function player(name: string): Promise<Client> {
  const s = await client(`10.8.0.${ipSeq++}`);
  await join(s, name);
  return s;
}

const AREA: Area = { kind: "cube", origin: { col: 2, row: 2 }, angle: 0, feet: 20 };
const battle = () => ctx.server.store.game.battle;
const effects = () => battle().effects.map((e) => (e.rounds === null ? e.name : `${e.name} (${e.rounds})`));
const conditionsOf = (id: string) => ctx.server.store.game.allies.find((a) => a.id === id)!.conditions.map((k) => k.name);

function effect(extra: Partial<ActionPayloads["effect:add"]>): ActionPayloads["effect:add"] {
  return { name: "Teia", preset: "web", area: AREA, ...extra };
}

/** Ordem: Thorin (Ana) → Goblin → Lia (Bia). */
async function setup() {
  const g = await gm();
  const ana = await player("Ana");
  const bia = await player("Bia");
  const [thorin] = idsOf(await act(ana, "ally:create", { name: "Thorin", hpMax: 20, dexMod: 1 }));
  const [lia] = idsOf(await act(bia, "ally:create", { name: "Lia", hpMax: 15, dexMod: 3 }));
  const [goblin] = idsOf(await act(g, "mob:add", { name: "Goblin", hpMax: 7, dexMod: 2 }));
  await act(ana, "init:set", { id: thorin, value: 20 });
  await act(g, "init:set", { id: goblin, value: 15 });
  await act(bia, "init:set", { id: lia, value: 10 });
  return { g, ana, bia, thorin, lia, goblin };
}

describe("efeitos no mapa", () => {
  it("“Teia (3)” de Ana passa a 2, 1 e some nos turnos de Thorin, com aviso; sem duração não muda", async () => {
    const { g, ana, thorin } = await setup();
    idsOf(await act(ana, "effect:add", effect({ casterId: thorin, rounds: 3 })));
    idsOf(await act(g, "effect:add", effect({ name: "Graxa", preset: "grease", casterId: null })));
    await act(g, "combat:start", {}); // vez de Thorin
    assert.deepEqual(effects(), ["Teia (2)", "Graxa"]);
    for (let i = 0; i < 3; i++) await act(g, "combat:next", {}); // Goblin, Lia, Thorin (round 2)
    assert.deepEqual(effects(), ["Teia (1)", "Graxa"]);
    for (let i = 0; i < 3; i++) await act(g, "combat:next", {});
    assert.deepEqual(effects(), ["Graxa"]);
    assert.ok(ctx.server.store.game.log.some((e) => e.system && e.text === "Teia de Thorin acabou."));
  });

  it("efeito sem conjurador conta no início de cada round", async () => {
    const { g } = await setup();
    await act(g, "effect:add", effect({ name: "Fogo", preset: "fire", rounds: 1 }));
    await act(g, "combat:start", {});
    await act(g, "combat:next", {});
    await act(g, "combat:next", {});
    assert.deepEqual(effects(), ["Fogo (1)"], "ainda no round 1");
    await act(g, "combat:next", {}); // round 2
    assert.deepEqual(effects(), []);
  });

  it("tirar a Concentração de Thorin remove os efeitos de concentração dele, e só esses", async () => {
    const { ana, bia, thorin, lia } = await setup();
    await act(ana, "effect:add", effect({ casterId: thorin, concentration: true }));
    await act(ana, "effect:add", effect({ name: "Água", preset: "water", casterId: thorin }));
    await act(bia, "effect:add", effect({ name: "Névoa", preset: "fog", casterId: lia, concentration: true }));
    assert.deepEqual(conditionsOf(thorin), ["Concentração"], "ganha a condição ao conjurar");

    const conc = ctx.server.store.game.allies.find((a) => a.id === thorin)!.conditions[0];
    assert.ok((await act(ana, "condition:remove", { id: thorin, conditionId: conc.id })).ok);
    assert.deepEqual(effects(), ["Água", "Névoa"]);
    assert.ok(ctx.server.store.game.log.some((e) => e.text === "Teia de Thorin acabou (concentração perdida)."));
  });

  it("Concentração com duração que acaba também encerra os efeitos", async () => {
    const { g, ana, thorin } = await setup();
    await act(ana, "condition:add", { id: thorin, name: "Concentração", rounds: 1 });
    await act(ana, "effect:add", effect({ casterId: thorin, concentration: true }));
    await act(g, "combat:start", {}); // turno de Thorin: Concentração (1) acaba
    assert.deepEqual(effects(), []);
  });

  it("mob que sai da batalha perde a concentração", async () => {
    const { g, goblin } = await setup();
    await act(g, "effect:add", effect({ name: "Escuridão", preset: "darkness", casterId: goblin, concentration: true }));
    await act(g, "mob:remove", { id: goblin });
    assert.deepEqual(effects(), []);
  });

  it("jogador não remove nem desliga efeito de outra pessoa; mestre pode", async () => {
    const { g, ana, bia, thorin } = await setup();
    const [id] = idsOf(await act(ana, "effect:add", effect({ casterId: thorin })));
    assert.equal((await act(bia, "effect:remove", { id })).ok, false);
    assert.equal((await act(bia, "effect:toggle", { id, active: false })).ok, false);
    assert.ok((await act(ana, "effect:toggle", { id, active: false })).ok);
    assert.ok((await act(g, "effect:remove", { id })).ok);
    assert.deepEqual(effects(), []);
  });

  it("jogador conjura só com o próprio personagem; concentração exige conjurador", async () => {
    const { g, ana, lia } = await setup();
    assert.equal((await act(ana, "effect:add", effect({ casterId: lia }))).ok, false);
    assert.equal((await act(ana, "effect:add", effect({}))).ok, false, "sem conjurador");
    assert.equal((await act(g, "effect:add", effect({ concentration: true }))).ok, false);
    assert.equal((await act(g, "effect:add", effect({ preset: "lava" as never }))).ok, false);
    assert.equal((await act(g, "effect:add", effect({ area: { ...AREA, feet: 0 } }))).ok, false);
    assert.deepEqual(effects(), []);
  });

  it("efeito desligado não chega aos jogadores", async () => {
    const { g, bia } = await setup();
    const [id] = idsOf(await act(g, "effect:add", effect({ name: "Fogo", preset: "fire" })));
    const off = stateWhere(bia, (s) => s.battle.effects.length === 0);
    await act(g, "effect:toggle", { id, active: false });
    assert.equal((await off).battle.effects.length, 0);
    const on = stateWhere(bia, (s) => s.battle.effects.length === 1);
    await act(g, "effect:toggle", { id, active: true });
    assert.equal((await on).battle.effects[0].name, "Fogo");
  });

  it("limpar o campo remove todos os efeitos", async () => {
    const { g } = await setup();
    await act(g, "effect:add", effect({}));
    await act(g, "battle:clear", { keepTemplates: true });
    assert.deepEqual(effects(), []);
  });
});
