import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { SCONCE_REACH, snapSconce, type Wall } from "@rpg/shared";

// Arandela grudando na parede mais perto (docs/design/luzes.md): do lado em que está o ponteiro, virada para ele.
describe("arandela gruda na parede", () => {
  const wall: Wall = { id: "w", from: { col: 0, row: 0 }, to: { col: 4, row: 0 } };

  it("do lado de baixo da parede, virada para baixo", () => {
    assert.deepEqual(snapSconce({ x: 2, y: 0.5 }, [wall]), { col: 2, row: 0.12, facing: 90 });
  });

  it("do lado de cima, virada para cima", () => {
    assert.deepEqual(snapSconce({ x: 2, y: -0.5 }, [wall]), { col: 2, row: -0.12, facing: 270 });
  });

  it("longe da parede (mais de 0,75 casa), não gruda", () => {
    assert.equal(snapSconce({ x: 2, y: 1 }, [wall]), null);
  });

  it("parede vertical: vira para a direita ou para a esquerda", () => {
    const side: Wall = { id: "v", from: { col: 3, row: 0 }, to: { col: 3, row: 5 } };
    assert.deepEqual(snapSconce({ x: 3.4, y: 2 }, [side]), { col: 3.12, row: 2, facing: 0 });
    assert.deepEqual(snapSconce({ x: 2.6, y: 2 }, [side]), { col: 2.88, row: 2, facing: 180 });
  });

  it("porta e janela não seguram arandela; a parede mais perto ganha", () => {
    const door: Wall = { id: "d", from: { col: 0, row: 1 }, to: { col: 4, row: 1 }, door: { open: false } };
    assert.equal(snapSconce({ x: 2, y: 1.3 }, [door]), null);
    assert.deepEqual(snapSconce({ x: 2, y: 0.3 }, [wall, door]), { col: 2, row: 0.12, facing: 90 });
  });

  it("o ponto grudado fica dentro do alcance que o servidor aceita", () => {
    const at = snapSconce({ x: 1.5, y: 0.7 }, [wall]);
    assert.ok(at && Math.abs(at.row) < SCONCE_REACH);
  });
});
