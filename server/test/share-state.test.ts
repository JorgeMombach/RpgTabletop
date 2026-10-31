import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { samePanelProps, shareEqual, type ClientState } from "@rpg/shared";

// Estado que chega novo a cada envio: o cliente reaproveita o que não mudou para não redesenhar à toa.
const base = () =>
  ({
    self: { id: "a", name: "Ana" },
    allies: [{ id: "x", hp: 5 }],
    log: [],
    battle: { walls: [{ id: "p", door: { open: false } }], fog: { enabled: false }, sight: {}, drawings: [], mobs: [{ id: "m" }], combat: { round: 1 } },
  }) as unknown as ClientState;

describe("reaproveitar o estado", () => {
  it("o que é igual continua sendo o mesmo objeto; o que mudou vem novo", () => {
    const prev = base();
    assert.equal(shareEqual(prev, base()), prev, "nada mudou: o próprio anterior");
    const next = base();
    (next.battle.walls[0].door as { open: boolean }).open = true;
    const out = shareEqual(prev, next);
    assert.notEqual(out, prev);
    assert.notEqual(out.battle.walls, prev.battle.walls);
    assert.equal(out.battle.mobs, prev.battle.mobs);
    assert.equal(out.allies, prev.allies);
    assert.deepEqual(out, next);
  });

  it("campo, item ou tipo diferente não passa por igual", () => {
    assert.deepEqual(shareEqual({ a: 1 } as object, { a: 1, b: 2 }), { a: 1, b: 2 });
    assert.deepEqual(shareEqual({ a: 1, b: 2 } as object, { a: 1 }), { a: 1 });
    assert.deepEqual(shareEqual([1, 2], [1]), [1]);
    assert.deepEqual(shareEqual([1] as unknown, { 0: 1 } as unknown), { 0: 1 });
    assert.equal(shareEqual({ a: null } as object, { a: null }).constructor, Object);
    assert.deepEqual(shareEqual({ a: { b: 1 } } as object, { a: null }), { a: null });
  });

  it("painel: porta, parede, desenho e névoa não redesenham; o resto, sim", () => {
    const prev = base();
    const change = (edit: (s: ClientState) => void) => {
      const next = base();
      edit(next);
      return samePanelProps({ state: prev }, { state: shareEqual(prev, next) });
    };
    assert.equal(change(() => {}), true);
    assert.equal(change((s) => ((s.battle.walls[0].door as { open: boolean }).open = true)), true);
    assert.equal(change((s) => ((s.battle.fog as { enabled: boolean }).enabled = true)), true);
    assert.equal(change((s) => ((s.battle.mobs[0] as { pos?: unknown }).pos = { col: 1, row: 1 })), false);
    assert.equal(change((s) => ((s.allies[0] as { hp: number }).hp = 1)), false);
    assert.equal(change((s) => (s.battle.combat.round = 2)), false);
    assert.equal(samePanelProps({ state: prev, inline: true }, { state: prev, inline: false }), false, "outro prop mudou");
  });
});
