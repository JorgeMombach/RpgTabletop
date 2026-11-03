import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { LootEntry } from "@rpg/shared";
import { resolveLoot } from "../src/loot";

// Divisão do loot na disputa (docs/design/baus.md, seção 3), com o d20 vindo de uma fila fixa.
const queue = (...values: number[]) => () => {
  const v = values.shift();
  assert.notEqual(v, undefined, "d20 a mais do que o esperado");
  return v!;
};
const pocao: LootEntry = { id: "p", kind: "item", name: "Poção de cura", qty: 3 };
const machado: LootEntry = { id: "m", kind: "weapon", name: "Machado", qty: 1, bonus: 5, damage: "1d8+3" };

describe("divisão do loot", () => {
  it("ninguém quis: nada", () => {
    assert.deepEqual(resolveLoot(pocao, [], queue()), { rolls: [], shares: [] });
  });

  it("um interessado leva tudo, sem rolar", () => {
    assert.deepEqual(resolveLoot(pocao, ["lia"], queue()), { rolls: [], shares: [{ id: "lia", qty: 3 }] });
  });

  it("item único: o maior d20 leva", () => {
    assert.deepEqual(resolveLoot(machado, ["lia", "kael"], queue(9, 17)), {
      rolls: [
        { id: "kael", d20: 17 },
        { id: "lia", d20: 9 },
      ],
      shares: [{ id: "kael", qty: 1 }],
    });
  });

  it("empate: rola de novo só entre os empatados", () => {
    const res = resolveLoot(machado, ["lia", "kael", "thorin"], queue(10, 10, 3, 15, 4));
    assert.deepEqual(res.rolls, [
      { id: "lia", d20: 15 },
      { id: "kael", d20: 4 },
      { id: "thorin", d20: 3 },
    ]);
    assert.deepEqual(res.shares, [{ id: "lia", qty: 1 }]);
  });

  it("pilha: uma unidade por vez, em rodízio pela ordem do d20", () => {
    assert.deepEqual(resolveLoot(pocao, ["kael", "lia"], queue(9, 17)).shares, [
      { id: "lia", qty: 2 },
      { id: "kael", qty: 1 },
    ]);
  });

  it("moedas: divididas igual; a sobra vai para o maior d20", () => {
    const ouro: LootEntry = { id: "o", kind: "coins", coins: { gp: 100, sp: 30 } };
    assert.deepEqual(resolveLoot(ouro, ["lia", "kael", "thorin"], queue(5, 18, 11)).shares, [
      { id: "kael", qty: 0, coins: { gp: 34, sp: 10 } },
      { id: "thorin", qty: 0, coins: { gp: 33, sp: 10 } },
      { id: "lia", qty: 0, coins: { gp: 33, sp: 10 } },
    ]);
  });
});
