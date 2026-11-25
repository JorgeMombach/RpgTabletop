import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { sightCells, type Wall } from "@rpg/shared";

// Casa vista em parte (decisão do dono, 2026-11-25): se um pedaço dela aparece atrás da ponta de uma parede, ela é
// vista (a borda da visão na névoa sai lisa, sem degrau). O alcance continua contado pelo centro.
describe("visão: casa vista em parte", () => {
  // parede vertical em x = 3, de y = 0 a y = 2; quem vê na casa (0, 0)
  const wall: Wall = { id: "w", from: { col: 3, row: 0 }, to: { col: 3, row: 2 } };
  const seen = () => new Set(sightCells([{ pos: { col: 0, row: 0 }, span: 1, feet: 60 }], [wall], 5).map((cell) => `${cell.col},${cell.row}`));

  it("o centro escondido pela ponta da parede, mas um canto à vista: a casa é vista", () => {
    assert.ok(seen().has("4,2"));
  });

  it("a casa inteira atrás da parede continua escondida", () => {
    assert.ok(!seen().has("4,0"));
    assert.ok(!seen().has("5,0"));
  });

  it("o alcance continua pelo centro (a visão não aumenta de raio)", () => {
    const open = new Set(sightCells([{ pos: { col: 0, row: 0 }, span: 1, feet: 10 }], [], 5).map((cell) => `${cell.col},${cell.row}`));
    // 10 ft = 2 casas + meia (o tamanho de quem vê): a casa (3, 0) tem o centro a 3 casas, fora
    assert.ok(open.has("2,0"));
    assert.ok(!open.has("3,0"));
  });
});
