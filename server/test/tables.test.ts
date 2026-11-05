import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { ActionResult, ClientState, LootInput, RollTable, TableRow } from "@rpg/shared";
import { dieLabel, rollLootTable, rollTable } from "../src/tables";
import { act, join, nextState, stateWhere, useServer, type Client } from "./helpers";

// Passo 13 (docs/design/tabelas.md): tabelas aleatórias do mestre.
const { ctx, client } = useServer();
const tables = () => ctx.server.store.game.tables;

function errorOf(res: ActionResult): string {
  assert.equal(res.ok, false, "deveria recusar");
  return res.ok ? "" : res.error;
}

async function gm() {
  const g: Client = await client();
  await join(g, "Mestre");
  return g;
}

/** id do que a ação criou (falha o teste se ela recusou). */
function idOf(res: ActionResult): string {
  assert.ok(res.ok, res.ok ? "" : res.error);
  return res.ids![0];
}

/** rng que devolve os valores em sequência (e depois sempre o último). */
const seq = (...values: number[]) => {
  let i = 0;
  return () => values[Math.min(i++, values.length - 1)];
};

const text = (name: string, rows: (string | [number, string])[], id = name): RollTable => ({
  id,
  name,
  kind: "text",
  rows: rows.map((r) => (typeof r === "string" ? { weight: 1, text: r } : { weight: r[0], text: r[1] })),
});

describe("sorteio das tabelas (módulo puro)", () => {
  it("o peso decide a faixa de cada linha; o dado é o comum quando a soma fecha", () => {
    const t = text("Encontro", [[3, "Goblins"], [2, "Lobos"], [3, "Nada"]]);
    assert.equal(dieLabel(8), "d8");
    assert.equal(dieLabel(7), "1–7");
    assert.deepEqual(rollTable(t, [t], seq(1)), { die: "d8", value: 1, text: "Goblins" });
    assert.deepEqual(rollTable(t, [t], seq(3)), { die: "d8", value: 3, text: "Goblins" });
    assert.deepEqual(rollTable(t, [t], seq(4)), { die: "d8", value: 4, text: "Lobos" });
    assert.deepEqual(rollTable(t, [t], seq(8)), { die: "d8", value: 8, text: "Nada" });
  });

  it("dados dentro do texto são rolados e mostrados entre parênteses", () => {
    const t = text("Goblins", ["2d4 goblins e 1d6+1 lobos"]);
    // 1 sorteia a linha; depois 3 e 2 no 2d4 e 4 no 1d6.
    assert.equal(rollTable(t, [t], seq(1, 3, 2, 4)).text, "5 (2d4) goblins e 5 (1d6+1) lobos");
  });

  it("[outra tabela] sorteia nela; inexistente ou em laço vira [nome?] sem quebrar", () => {
    const nomes = text("Nomes de goblin", ["Snaga"]);
    const enc = text("Encontro", ["Um goblin chamado [nomes de goblin] e [Fantasma]"]);
    assert.equal(rollTable(enc, [enc, nomes], seq(1)).text, "Um goblin chamado Snaga e [Fantasma?]");
    const loop = text("Laço", ["sempre [Laço]"]);
    const out = rollTable(loop, [loop], seq(1)).text;
    assert.match(out, /\[Laço\?\]$/);
    assert.equal(out.split("sempre").length - 1, 5, "para na profundidade máxima");
  });

  it("loot: dados resolvidos, moedas somadas numa linha, item igual soma a quantidade", () => {
    const t: RollTable = {
      id: "l",
      name: "Loot",
      kind: "loot",
      rows: [
        { weight: 1, loot: { kind: "coins", coin: "gp", amount: "2d6" } },
        { weight: 1, loot: { kind: "item", name: "Poção de cura", qty: "1" } },
      ],
    };
    // Vez 1: linha 1 (moedas 3+4); vez 2: linha 1 (moedas 6+6); vez 3: linha 2; vez 4: linha 2.
    const loot = rollLootTable(t, 4, seq(1, 3, 4, 1, 6, 6, 2, 2));
    assert.deepEqual(loot, [
      { kind: "coins", coins: { gp: 19 } },
      { kind: "item", name: "Poção de cura", qty: 2 },
    ] satisfies LootInput[]);
  });
});

describe("tabelas aleatórias (mesa)", () => {
  const encounter = { name: "Encontro na estrada", kind: "text" as const, rows: [{ weight: 2, text: "1d4 goblins" }] satisfies TableRow[] };

  it("só o mestre cria, edita, apaga e rola; jogador não recebe as tabelas", async () => {
    const g = await gm();
    const res = await act(g, "table:upsert", encounter);
    assert.ok(res.ok, res.ok ? "" : res.error);
    const id = res.ids![0];
    assert.equal(tables().find((t) => t.id === id)?.name, "Encontro na estrada");

    const ana: Client = await client("10.83.0.1");
    const first = nextState(ana);
    await join(ana, "Ana");
    const st: ClientState = await first;
    assert.deepEqual(st.tables, [], "jogador não recebe as tabelas");
    for (const [name, payload] of [
      ["table:upsert", { ...encounter, name: "Outra" }],
      ["table:remove", { id }],
      ["table:roll", { id, public: true }],
    ] as const) {
      assert.match(errorOf(await act(ana, name, payload as never)), /permissão|mestre/i, name);
    }
    const no: { ok: boolean } = await ana.timeout(5000).emitWithAck("table:rollLoot", { tableId: id, times: 1 });
    assert.equal(no.ok, false);

    assert.ok((await act(g, "table:upsert", { id, ...encounter, name: "Estrada do norte" })).ok);
    assert.equal(tables().find((t) => t.id === id)?.name, "Estrada do norte");
    assert.ok((await act(g, "table:remove", { id })).ok);
    assert.equal(tables().some((t) => t.id === id), false);
  });

  it("valida tudo antes de gravar", async () => {
    const g = await gm();
    assert.ok((await act(g, "table:upsert", { ...encounter, name: "Clima" })).ok);
    const bad = async (payload: object, re: RegExp) => assert.match(errorOf(await act(g, "table:upsert", { ...encounter, ...payload })), re);
    await bad({ name: "  " }, /nome/i);
    await bad({ name: "clima" }, /já existe/i);
    await bad({ name: "Vazia", rows: [] }, /linha/i);
    await bad({ name: "Peso", rows: [{ weight: 0, text: "x" }] }, /Peso/);
    await bad({ name: "Peso2", rows: [{ weight: 100, text: "x" }] }, /Peso/);
    await bad({ name: "Muitas", rows: Array.from({ length: 101 }, () => ({ weight: 1, text: "x" })) }, /100/);
    await bad({ name: "Longa", rows: [{ weight: 1, text: "x".repeat(201) }] }, /200/);
    await bad({ name: "Loot ruim", kind: "loot", rows: [{ weight: 1, loot: { kind: "item", name: "Poção", qty: "1d" } }] }, /Quantidade/);
    await bad({ name: "Loot texto", kind: "loot", rows: [{ weight: 1, text: "x" }] }, /loot/i);
    assert.equal(tables().filter((t) => /Vazia|Peso|Muitas|Longa|Loot/.test(t.name)).length, 0);
  });

  it("rolar escreve no log: só o mestre por padrão; público para todos, e a tabela lembra", async () => {
    const g = await gm();
    const id = idOf(await act(g, "table:upsert", { ...encounter, name: "Uma linha", rows: [{ weight: 1, text: "Sempre isto" }] }));
    const ana: Client = await client("10.83.0.2");
    await join(ana, "Bia");

    assert.ok((await act(g, "table:roll", { id, public: false })).ok);
    const hidden = ctx.server.store.game.log.at(-1)!;
    assert.equal(hidden.hidden, true);
    assert.equal(hidden.text, "Sempre isto");
    assert.deepEqual(hidden.table, { id, name: "Uma linha", die: "d1", value: 1 });

    assert.ok((await act(g, "table:roll", { id, public: true })).ok);
    assert.equal(tables().find((t) => t.id === id)?.public, true);
    const shown = ctx.server.store.game.log.at(-1)!;
    assert.equal(shown.hidden, undefined);
    const st = await stateWhere(ana, (s) => s.log.some((e) => e.id === shown.id));
    assert.equal(st.log.some((e) => e.id === hidden.id), false, "jogador não recebe a rolagem escondida");
  });

  it("rolar loot para o baú devolve o loot resolvido e registra só para o mestre", async () => {
    const g = await gm();
    const loot = idOf(await act(g, "table:upsert", {
      name: "Loot de goblin",
      kind: "loot",
      rows: [{ weight: 1, loot: { kind: "coins", coin: "cp", amount: "3" } }],
    }));
    const textId = idOf(await act(g, "table:upsert", { ...encounter, name: "Só texto" }));
    type Res = { ok: boolean; loot?: LootInput[]; error?: string };
    const res: Res = await g.timeout(5000).emitWithAck("table:rollLoot", { tableId: loot, times: 3 });
    assert.ok(res.ok, res.error);
    assert.deepEqual(res.loot, [{ kind: "coins", coins: { cp: 9 } }]);
    assert.equal(ctx.server.store.game.log.at(-1)?.hidden, true);
    const text: Res = await g.timeout(5000).emitWithAck("table:rollLoot", { tableId: textId, times: 1 });
    assert.match(text.error ?? "", /loot/i);
    const many: Res = await g.timeout(5000).emitWithAck("table:rollLoot", { tableId: loot, times: 11 });
    assert.equal(many.ok, false);
  });
});
