import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { ActionResult } from "@rpg/shared";
import { act, join, useServer, type Client } from "./helpers";

// Passar a vez, atrasar a vez e ações do turno.
const { ctx, client } = useServer();
const game = () => ctx.server.store.game;
const current = () => game().battle.combat.order[game().battle.combat.turnIndex];

function idsOf(res: ActionResult): string[] {
  assert.ok(res.ok, res.ok ? "" : res.error);
  return res.ids ?? [];
}

function errorOf(res: ActionResult): string {
  assert.equal(res.ok, false, "deveria recusar");
  return res.ok ? "" : res.error;
}

let ipSeq = 1;
async function player(name: string): Promise<Client> {
  const s = await client(`10.35.0.${ipSeq++}`);
  await join(s, name);
  return s;
}

/** Ordem: Thorin (Ana, 20) → Goblin (15) → Lia (Bia, 10). Começa na vez de Thorin. */
async function setup() {
  const g = await client();
  await join(g, "Mestre");
  const ana = await player("Ana");
  const bia = await player("Bia");
  const [thorin] = idsOf(await act(ana, "ally:create", { name: "Thorin", hpMax: 30, dexMod: 1, ac: 18 }));
  const [lia] = idsOf(await act(bia, "ally:create", { name: "Lia", hpMax: 15, dexMod: 3, ac: 13 }));
  const [goblin] = idsOf(await act(g, "mob:add", { name: "Goblin", hpMax: 7, dexMod: 2, ac: 15 }));
  await act(ana, "init:set", { id: thorin, value: 20 });
  await act(g, "init:set", { id: goblin, value: 15 });
  await act(bia, "init:set", { id: lia, value: 10 });
  assert.ok((await act(g, "combat:start", {})).ok);
  return { g, ana, bia, thorin, lia, goblin };
}

describe("passar a vez", () => {
  it("quem está na vez passa; outro jogador não; o log registra", async () => {
    const { ana, bia, goblin } = await setup();
    assert.match(errorOf(await act(bia, "combat:pass", {})), /Não é a sua vez/);
    assert.ok((await act(ana, "combat:pass", {})).ok);
    assert.equal(current(), goblin);
    assert.ok(game().log.some((e) => e.system && e.text === "Thorin (Ana) passou a vez."));
  });

  it("passar no fim da ordem vira o round", async () => {
    const { g, bia } = await setup();
    await act(g, "combat:next", {});
    await act(g, "combat:next", {});
    assert.ok((await act(bia, "combat:pass", {})).ok);
    assert.equal(game().battle.combat.round, 2);
  });
});

describe("atrasar a vez", () => {
  it("vai para depois do escolhido e a vez passa ao próximo", async () => {
    const { ana, thorin, goblin, lia } = await setup();
    await act(ana, "condition:add", { id: thorin, name: "Abençoado", rounds: 5 });
    assert.ok((await act(ana, "combat:delay", { afterId: lia })).ok);
    assert.deepEqual(game().battle.combat.order, [goblin, lia, thorin]);
    assert.equal(current(), goblin, "a vez passou ao goblin");
    assert.equal(game().allies.find((a) => a.id === thorin)?.initiative, 10, "empata com quem esperou");
  });

  it("chegando a vez de novo no mesmo round, o começo do turno não roda outra vez", async () => {
    const { g, ana, thorin, lia } = await setup();
    await act(ana, "condition:add", { id: thorin, name: "Abençoado", rounds: 5 });
    await act(ana, "turn:use", { id: thorin, what: "move", used: true });
    await act(ana, "combat:delay", { afterId: lia });
    await act(g, "combat:next", {}); // Lia
    await act(g, "combat:next", {}); // Thorin de novo, mesmo round
    const t = game().allies.find((a) => a.id === thorin)!;
    assert.equal(current(), thorin);
    assert.equal(t.conditions[0].rounds, 5, "não descontou de novo");
    assert.deepEqual(t.turnUsed, ["move"], "o movimento já gasto continua marcado");
  });

  it("só para quem ainda vai agir; jogador fora da vez não atrasa", async () => {
    const { ana, bia, thorin, lia } = await setup();
    assert.match(errorOf(await act(ana, "combat:delay", { afterId: thorin })), /ainda vai agir/);
    assert.match(errorOf(await act(bia, "combat:delay", { afterId: lia })), /Não é a sua vez/);
  });
});

describe("ações do turno", () => {
  it("marca e desmarca; zeram no começo da próxima vez dele", async () => {
    const { g, ana, thorin } = await setup();
    await act(ana, "turn:use", { id: thorin, what: "action", used: true });
    await act(ana, "turn:use", { id: thorin, what: "bonus", used: true });
    await act(ana, "turn:use", { id: thorin, what: "bonus", used: false });
    assert.deepEqual(game().allies[0].turnUsed, ["action"]);
    assert.equal((await act(ana, "turn:use", { id: thorin, what: "dança" as never, used: true })).ok, false);
    await act(g, "combat:next", {});
    await act(g, "combat:next", {});
    await act(g, "combat:next", {}); // Thorin, round 2
    assert.equal(game().allies[0].turnUsed, undefined);
  });
});
