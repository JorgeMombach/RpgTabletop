import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { paintRelief, reliefAffected, ReliefHeights, reliefHeights, reliefSampler, type ReliefChunks } from "@rpg/shared";

// Alturas do relevo guardadas entre traços (docs/design/desempenho.md): os objetos assentam no relevo, e refazer a
// altura dos pedaços no processador a cada traço travava o mapa. As do traço chegam prontas do Worker do relevo.
const stroke = (level: number, points: number[], radius = 2) => ({ level, soft: true, radius, points });
const SPOTS = [
  [3, 3],
  [9.5, 4.2],
  [20, 20],
  [41, 7],
  [44.3, 30.1],
  [70, 70],
];

/** O que o Worker do relevo entrega depois de um traço: a altura de cada pedaço afetado. */
function workerAnswer(heights: ReliefHeights, chunks: ReliefChunks, changed: string[]) {
  for (const key of reliefAffected(changed)) heights.accept(key, reliefHeights(chunks, key));
}

function sameAsFresh(heights: ReliefHeights, chunks: ReliefChunks) {
  const reused = heights.sampler(chunks);
  const fresh = reliefSampler(chunks);
  for (const [x, y] of SPOTS) assert.equal(reused(x, y), fresh(x, y), `altura em ${x}, ${y}`);
}

describe("alturas do relevo entre traços", () => {
  it("com as alturas do Worker, cada traço dá a mesma altura que a conta do zero", () => {
    const heights = new ReliefHeights();
    let chunks: ReliefChunks = {};
    sameAsFresh(heights, chunks);
    for (const [level, points] of [
      [2, [4, 4, 10, 5]],
      [1, [42, 8]],
      [3, [44, 30]],
      [0, [9, 4]],
      [-1, [20, 21]],
    ] as const) {
      chunks = { ...chunks };
      const changed = paintRelief(chunks, stroke(level, [...points]));
      heights.sampler(chunks);
      workerAnswer(heights, chunks, changed);
      sameAsFresh(heights, chunks);
    }
  });

  it("antes do Worker responder, o traço não recalcula: fica a altura de antes", () => {
    const heights = new ReliefHeights();
    const before: ReliefChunks = {};
    paintRelief(before, stroke(2, [5, 5]));
    const old = heights.sampler(before)(5, 5);
    assert.ok(old > 0);
    const after = { ...before };
    paintRelief(after, stroke(3, [5, 5]));
    assert.equal(heights.sampler(after)(5, 5), old, "a altura nova vem do Worker");
  });

  it("esquecer tudo (troca de cena) recalcula do zero", () => {
    const heights = new ReliefHeights();
    const painted: ReliefChunks = {};
    paintRelief(painted, stroke(3, [5, 5]));
    assert.ok(heights.sampler(painted)(5, 5) > 0);
    heights.clear();
    assert.equal(heights.sampler({})(5, 5), 0);
  });
});
