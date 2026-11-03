import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { ActionResult, LootInput } from "@rpg/shared";
import { exportSession, importSession } from "../src/session-file";
import { act, join, stateWhere, useServer } from "./helpers";

// Baús no mapa (Fase 6, docs/design/baus.md): o mestre põe, edita, move e apaga; o jogador só vê o que deve.
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

let ipSeq = 1;
async function setup() {
  const g = await client();
  await join(g, "Mestre");
  const ana = await client(`10.73.0.${ipSeq++}`);
  await join(ana, "Ana");
  return { g, ana };
}

const LOOT: LootInput[] = [
  { kind: "coins", coins: { gp: 120, sp: 30 } },
  { kind: "item", name: "Poção de cura", qty: 3, note: "2d4+2" },
  { kind: "weapon", name: "Machado de batalha", qty: 1, bonus: 5, damage: "1d8+3" },
];

describe("baús no mapa", () => {
  it("o mestre põe, edita, move e apaga; o jogador não mexe", async () => {
    const { g, ana } = await setup();
    const [bau] = idsOf(await act(g, "chest:add", { col: 3, row: 4, style: "iron" }));
    assert.deepEqual(game().battle.chests[0], { id: bau, col: 3, row: 4, name: "Baú", style: "iron", loot: [] });

    assert.ok((await act(g, "chest:update", { id: bau, name: "Baú do capitão", style: "ornate", locked: true, hidden: false, loot: LOOT })).ok);
    const c = game().battle.chests[0];
    assert.equal(c.name, "Baú do capitão");
    assert.equal(c.style, "ornate");
    assert.equal(c.locked, true);
    assert.equal(c.hidden, undefined);
    assert.deepEqual(c.loot.map(({ id: _, ...e }) => e), LOOT);

    assert.ok((await act(g, "chest:move", { id: bau, col: 7, row: 1 })).ok);
    assert.deepEqual([game().battle.chests[0].col, game().battle.chests[0].row], [7, 1]);

    for (const [name, payload] of [
      ["chest:add", { col: 1, row: 1, style: "wood" }],
      ["chest:update", { id: bau, name: "X", style: "wood", locked: false, hidden: false, loot: [] }],
      ["chest:move", { id: bau, col: 2, row: 2 }],
      ["chest:remove", { id: bau }],
    ] as const) {
      assert.equal((await act(ana, name, payload as never)).ok, false, name);
    }
    assert.ok((await act(g, "chest:remove", { id: bau })).ok);
    assert.equal(game().battle.chests.length, 0);
  });

  it("valida o loot inteiro antes de mudar o baú", async () => {
    const { g } = await setup();
    const [bau] = idsOf(await act(g, "chest:add", { col: 0, row: 0, style: "wood" }));
    const upd = (loot: unknown) => act(g, "chest:update", { id: bau, name: "Baú", style: "wood", locked: false, hidden: false, loot: loot as LootInput[] });
    assert.match(errorOf(await upd([{ kind: "coins", coins: {} }])), /moedas/i);
    assert.match(errorOf(await upd([{ kind: "coins", coins: { gp: -1 } }])), /Moedas/);
    assert.match(errorOf(await upd([{ kind: "item", name: "Corda", qty: 0 }])), /Quantidade/);
    assert.match(errorOf(await upd([{ kind: "weapon", name: "Clava", qty: 1, damage: "muito" }])), /Dano inválido/);
    assert.match(errorOf(await upd([{ kind: "weapon", name: "Clava", qty: 1 }])), /bônus de ataque, o dano/);
    assert.match(errorOf(await upd(Array.from({ length: 21 }, () => ({ kind: "item", name: "Pedra", qty: 1 })))), /Limite de 20/);
    assert.match(errorOf(await act(g, "chest:add", { col: 0, row: 0, style: "wood" })), /Já tem um baú/);
    assert.match(errorOf(await act(g, "chest:add", { col: 1, row: 0, style: "dourado" as never })), /Desenho de baú inválido/);
    assert.deepEqual(game().battle.chests[0].loot, [], "nada mudou");
  });

  it("jogador: não recebe o invisível, nem o coberto pela névoa, nem o loot antes de abrir", async () => {
    const { g, ana } = await setup();
    const [visivel] = idsOf(await act(g, "chest:add", { col: 2, row: 2, style: "wood" }));
    const [oculto] = idsOf(await act(g, "chest:add", { col: 3, row: 2, style: "wood" }));
    await act(g, "chest:update", { id: visivel, name: "Baú", style: "wood", locked: true, hidden: false, loot: LOOT });
    await act(g, "chest:update", { id: oculto, name: "Segredo", style: "wood", locked: false, hidden: true, loot: LOOT });
    // Espera o estado que já tem a última mudança (o baú visível na linha 3).
    const seen = stateWhere(ana, (st) => st.battle.chests.some((c) => c.id === visivel && c.row === 3));
    await act(g, "chest:move", { id: visivel, col: 2, row: 3 });
    const s = await seen;
    assert.deepEqual(
      s.battle.chests.map((c) => c.id),
      [visivel],
    );
    assert.deepEqual(s.battle.chests[0].loot, [], "o conteúdo só chega depois de aberto");
    assert.equal(s.battle.chests[0].locked, true, "o cadeado aparece");

    // Névoa ligada, nada revelado: o baú some para o jogador.
    const fogged = stateWhere(ana, (st) => st.battle.fog.enabled);
    await act(g, "fog:set", { enabled: true });
    assert.equal((await fogged).battle.chests.length, 0);
  });

  it("vai no arquivo de sessão, fica na cena e Limpar campo apaga", async () => {
    const { g } = await setup();
    const [bau] = idsOf(await act(g, "chest:add", { col: 5, row: 5, style: "ornate" }));
    await act(g, "chest:update", { id: bau, name: "Tesouro", style: "ornate", locked: true, hidden: true, loot: LOOT });
    const before = structuredClone(game().battle.chests);
    const gm = [...ctx.server.store.players.values()].find((p) => p.role === "gm")!;
    importSession(ctx.server.store, gm, JSON.parse(JSON.stringify(exportSession(ctx.server.store))));
    assert.deepEqual(game().battle.chests, before);

    const [outra] = idsOf(await act(g, "scene:add", { name: "Cripta" }));
    await act(g, "scene:switch", { id: outra });
    assert.equal(game().battle.chests.length, 0, "cena nova sem baús");
    await act(g, "scene:switch", { id: game().scenes[0].id });
    assert.deepEqual(game().battle.chests, before, "voltam com a cena");

    await act(g, "battle:clear", { keepTemplates: true });
    assert.equal(game().battle.chests.length, 0);
  });
});
