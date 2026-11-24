import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { Area } from "@rpg/shared";
import { effectBounds, effectLook, effectTint, effectTriangles } from "../../client/src/map/effects/effectLayout";

/** Efeitos na placa de vídeo (docs/design/efeitos.md): luz, forma e cor de cada efeito. */

const SQUARE = { feetPerCell: 5, grid: undefined };
const area = (kind: Area["kind"], feet: number, angle = 0): Area => ({ kind, origin: { col: 4, row: 4 }, angle, feet });

describe("conta dos efeitos", () => {
  it("fogo ilumina laranja até 5 casas; escuridão escurece; desligado não mexe na luz", () => {
    assert.deepEqual(effectLook({ preset: "fire", active: true }), { emit: { color: [1, 0.55, 0.22], strength: 1.5, reach: 5, flicker: "fire" }, darkens: false });
    assert.deepEqual(effectLook({ preset: "darkness", active: true }), { emit: null, darkens: true });
    assert.deepEqual(effectLook({ preset: "fire", active: false }), { emit: null, darkens: false });
    assert.deepEqual(effectLook({ preset: "web", active: true }), { emit: null, darkens: false });
    assert.equal(effectLook({ preset: "acid", active: true }).emit?.reach, 2);
  });

  it("esfera vira círculo em casas; cone pelo polígono do 5e", () => {
    const circle = effectTriangles({ area: area("sphere", 10) }, SQUARE);
    assert.equal(circle.length, 48 * 6);
    for (let index = 0; index < circle.length; index += 2) assert.ok(Math.hypot(circle[index] - 4, circle[index + 1] - 4) <= 2 + 1e-5);
    const cone = effectTriangles({ area: area("cone", 15) }, SQUARE);
    assert.deepEqual(effectBounds(cone), [4, 2.5, 7, 5.5]);
  });

  it("casas pintadas: quadrado em 2 triângulos, hex em 4", () => {
    assert.equal(effectTriangles({ area: area("sphere", 5), cells: [1, 2] }, SQUARE).length, 12);
    assert.equal(effectTriangles({ area: area("sphere", 5), cells: [1, 2] }, { feetPerCell: 5, grid: "hexRows" }).length, 24);
  });

  it("cor padrão não tinge; outra cor tinge; personalizado sempre", () => {
    assert.deepEqual(effectTint({ preset: "fire", color: "#ff6a1a" }), [1, 1, 1, 0]);
    assert.deepEqual(effectTint({ preset: "fire", color: "#0000ff" }), [0, 0, 1, 1]);
    assert.deepEqual(effectTint({ preset: "custom", color: "#d4a24c" }).slice(3), [1]);
  });
});
