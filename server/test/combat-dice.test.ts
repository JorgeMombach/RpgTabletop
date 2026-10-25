import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { ActionResult } from "@rpg/shared";
import { allCombatants } from "../src/combat";
import { act, join, stateWhere, useServer, type Client } from "./helpers";

const { ctx, client } = useServer();

function idsOf(res: ActionResult): string[] {
  assert.ok(res.ok, res.ok ? "" : res.error);
  return res.ids ?? [];
}

function errorOf(res: ActionResult): string {
  assert.equal(res.ok, false, "deveria recusar");
  return res.ok ? "" : res.error;
}

async function gm(): Promise<Client> {
  const s = await client();
  await join(s, "Mestre");
  return s;
}

let ipSeq = 1;
async function player(name: string): Promise<Client> {
  const s = await client(`10.7.0.${ipSeq++}`);
  await join(s, name);
  return s;
}

const game = () => ctx.server.store.game;
const lastLog = () => game().log.at(-1)!;
const playerId = (name: string) => [...ctx.server.store.players.values()].find((p) => p.name === name)!.id;

/** Ordem: Thorin (Ana) → Goblin 2 → Lia (Bia). Combate começa na vez de Thorin. */
async function setup() {
  const g = await gm();
  const ana = await player("Ana");
  const bia = await player("Bia");
  const [thorin] = idsOf(await act(ana, "ally:create", { name: "Thorin", hpMax: 20, dexMod: 1 }));
  const [lia] = idsOf(await act(bia, "ally:create", { name: "Lia", hpMax: 15, dexMod: 3 }));
  const [goblin] = idsOf(await act(g, "mob:add", { name: "Goblin 2", hpMax: 7, dexMod: 2 }));
  await act(ana, "init:set", { id: thorin, value: 20 });
  await act(g, "init:set", { id: goblin, value: 15 });
  await act(bia, "init:set", { id: lia, value: 10 });
  assert.ok((await act(g, "combat:start", {})).ok);
  return { g, ana, bia, thorin, lia, goblin };
}

describe("trava por turno", () => {
  it("jogador fora da vez recebe recusa com o motivo; na própria vez rola", async () => {
    const { ana, bia } = await setup();
    assert.match(errorOf(await act(bia, "dice:roll", { expr: "1d20" })), /Não é a sua vez/);
    assert.ok((await act(ana, "dice:roll", { expr: "1d20" })).ok);
    assert.equal(game().log.filter((e) => e.roll).length, 1);
  });

  it("fora de combate todos rolam", async () => {
    await gm();
    const ana = await player("Ana");
    assert.ok((await act(ana, "dice:roll", { expr: "1d20" })).ok);
  });

  it("o mestre rola sempre, mesmo na vez de um jogador", async () => {
    const { g } = await setup();
    assert.ok((await act(g, "dice:roll", { expr: "1d20" })).ok);
  });
});

describe("rolar como", () => {
  it("rolagem do mestre no turno do Goblin 2 aparece como Goblin 2, agrupada no turno", async () => {
    const { g, goblin } = await setup();
    await act(g, "combat:next", {}); // vez do Goblin 2
    assert.ok((await act(g, "dice:roll", { expr: "1d20+4", asId: goblin, kind: "attack" })).ok);
    assert.ok((await act(g, "dice:roll", { expr: "1d6+2", asId: goblin, kind: "damage" })).ok);
    const [atk, dmg] = game().log.slice(-2);
    assert.equal(atk.as, "Goblin 2");
    assert.equal(atk.label, "Ataque");
    assert.equal(dmg.label, "Dano");
    assert.deepEqual(atk.turn, dmg.turn, "ataque e dano no mesmo turno");
    assert.deepEqual(atk.turn, { seq: game().battle.combat.turn, round: 1, name: "Goblin 2" });
  });

  it("dano de crítico fica marcado; jogador não usa 'rolar como'", async () => {
    const { ana, goblin } = await setup();
    assert.ok((await act(ana, "dice:roll", { expr: "4d6+3", kind: "damage", crit: true, asId: goblin })).ok);
    assert.equal(lastLog().label, "Dano (crítico)");
    assert.equal(lastLog().crit, true);
    assert.equal(lastLog().as, undefined);
    assert.equal(lastLog().author, "Ana");
  });
});

describe("pedido de rolagem (resistência)", () => {
  it("o mestre pede, cada jogador pedido rola uma vez e o pedido acaba", async () => {
    const { g, ana, bia } = await setup();
    await act(g, "combat:next", {}); // vez do Goblin: nenhum jogador na vez
    idsOf(await act(g, "roll:request", { label: "Resistência DES", playerIds: [] }));
    assert.deepEqual(game().battle.rolls.request?.playerIds.sort(), [playerId("Ana"), playerId("Bia")].sort());

    assert.ok((await act(ana, "dice:roll", { expr: "1d20+1" })).ok);
    assert.equal(lastLog().label, "Resistência DES");
    assert.match(errorOf(await act(ana, "dice:roll", { expr: "1d20+1" })), /Não é a sua vez/, "só uma vez");

    assert.ok((await act(bia, "dice:roll", { expr: "1d20+3" })).ok);
    assert.equal(game().battle.rolls.request, null, "todos rolaram");
  });

  it("pedido para um jogador só não libera os outros; trocar de turno cancela", async () => {
    const { g, ana } = await setup();
    await act(g, "combat:next", {});
    await act(g, "roll:request", { label: "Resistência SAB", playerIds: [playerId("Bia")] });
    assert.equal((await act(ana, "dice:roll", { expr: "1d20" })).ok, false);
    await act(g, "combat:next", {}); // vez de Lia (Bia)
    assert.equal(game().battle.rolls.request, null);
  });

  it("rolagem inválida não gasta o pedido; só o mestre pede e só em combate", async () => {
    const { g, ana, bia } = await setup();
    await act(g, "combat:next", {});
    await act(g, "roll:request", { label: "Resistência FOR", playerIds: [] });
    assert.equal((await act(ana, "dice:roll", { expr: "1d20+banana" })).ok, false);
    assert.deepEqual(game().battle.rolls.request?.done, []);
    assert.equal((await act(bia, "roll:request", { label: "X", playerIds: [] })).ok, false);
    assert.equal((await act(g, "roll:request", { label: "  ", playerIds: [] })).ok, false);
    assert.ok((await act(g, "roll:cancel", {})).ok);
    assert.equal(game().battle.rolls.request, null);
    await act(g, "combat:end", {});
    assert.match(errorOf(await act(g, "roll:request", { label: "X", playerIds: [] })), /Fora de combate/);
  });
});

describe("reação", () => {
  it("libera a rolagem até o turno mudar, uma vez por round", async () => {
    const { g, bia } = await setup(); // vez de Thorin (Ana)
    assert.ok((await act(bia, "reaction:use", {})).ok);
    assert.equal(lastLog().text, "Bia usou a reação.");
    assert.ok((await act(bia, "dice:roll", { expr: "1d20+5", kind: "attack" })).ok);
    assert.equal(lastLog().label, "Reação · Ataque");
    assert.ok((await act(bia, "dice:roll", { expr: "1d8+3", kind: "damage" })).ok, "ataque e dano na mesma reação");

    await act(g, "combat:next", {}); // vez do Goblin, mesmo round
    assert.equal((await act(bia, "dice:roll", { expr: "1d20" })).ok, false, "turno mudou: fechou");
    assert.match(errorOf(await act(bia, "reaction:use", {})), /já usou a reação neste round/);

    await act(g, "combat:next", {}); // Lia
    await act(g, "combat:next", {}); // Thorin, round 2
    assert.ok((await act(bia, "reaction:use", {})).ok, "round novo, reação nova");
  });

  it("na própria vez não precisa de reação; mestre não usa", async () => {
    const { g, ana } = await setup();
    assert.match(errorOf(await act(ana, "reaction:use", {})), /Na sua vez/);
    assert.equal((await act(g, "reaction:use", {})).ok, false);
  });
});

describe("rolar iniciativa de novo", () => {
  it("zera todos, rola os mobs em campo e pausa no mesmo round; retomar continua o round", async () => {
    const { g, ana, thorin, goblin } = await setup();
    await act(g, "token:move", { id: goblin, pos: { col: 1, row: 1 } });
    await act(g, "combat:next", {});
    await act(g, "combat:next", {});
    await act(g, "combat:next", {}); // round 2
    assert.ok((await act(g, "init:rerollAll", {})).ok);

    const { combat } = game().battle;
    assert.equal(combat.active, false);
    assert.equal(combat.round, 2);
    assert.deepEqual(combat.order, [goblin], "só os do mestre já rolados");
    assert.equal(game().allies.find((a) => a.id === thorin)?.initiative, null);

    assert.ok((await act(ana, "dice:roll", { expr: "1d20" })).ok, "pausado: jogadores rolam livres");
    await act(ana, "init:set", { id: thorin, value: 12 });
    assert.ok((await act(g, "combat:start", {})).ok);
    assert.equal(game().battle.combat.round, 2);
    assert.equal((await act(ana, "init:rerollAll", {})).ok, false, "só o mestre");
  });
});

describe("estado para os clientes", () => {
  it("jogador recebe o pedido em andamento para saber que pode rolar", async () => {
    const { g, bia } = await setup();
    await act(g, "combat:next", {});
    const seen = stateWhere(bia, (s) => s.battle.rolls.request !== null);
    await act(g, "roll:request", { label: "Resistência CON", playerIds: [] });
    const s = await seen;
    assert.equal(s.battle.rolls.request?.label, "Resistência CON");
  });
});

describe("cor dos dados (E22)", () => {
  it("jogador rola na cor do personagem (ou do conjurado na vez); mestre como combatente, na cor dele; mestre puro, sem cor", async () => {
    const { g, ana, thorin, goblin } = await setup();
    const color = (id: string) => allCombatants(ctx.server.store).find((c) => c.id === id)!.color;
    const last = () => game().log.at(-1)!;

    await act(ana, "dice:roll", { expr: "1d20" }); // vez do Thorin
    assert.equal(last().color, color(thorin));
    await act(g, "dice:roll", { expr: "1d20", asId: goblin });
    assert.equal(last().color, color(goblin));
    await act(g, "dice:roll", { expr: "1d20" });
    assert.equal(last().color, undefined);

    // Conjurado do jogador na vez: os dados saem na cor dele.
    const [sapoId] = idsOf(await act(ana, "summon:add", { summonerId: thorin, name: "Sapo", hpMax: 1, dexMod: 0, qty: 1, color: "#3a9b5c" }));
    await act(g, "combat:end", {});
    await act(ana, "init:set", { id: sapoId, value: 25 });
    await act(g, "init:set", { id: goblin, value: 10 });
    await act(g, "combat:start", {});
    await act(ana, "dice:roll", { expr: "1d20" });
    assert.equal(last().color, "#3a9b5c");
  });
});
