import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { geometryOf, sightCells, type GridKind } from "@rpg/shared";
import { fogCellTriangles, fogLit, fogNoiseData, fogSightTriangles, fogViewers, type FogAlly, type FogCarrier, type FogScene } from "../../client/src/map/ground/fogGeometry";

/** Névoa na placa de vídeo (docs/design/nevoa.md): quem vê, as casas e a linha de visão, como o servidor. */

const NIGHT: FogScene = { kind: undefined, feetPerCell: 5, light: "night", range: null, vision: true };

describe("conta da névoa", () => {
  it("aliado médio com visão no escuro à noite: 60 ft menos meia diagonal", () => {
    const ally: FogAlly = { pos: { col: 3, row: 4 }, darkvision: true };
    const [viewer, ...rest] = fogViewers([ally], NIGHT);
    assert.equal(rest.length, 0);
    assert.equal(viewer.x, 3.5);
    assert.equal(viewer.y, 4.5);
    assert.ok(Math.abs(viewer.reach - (12 + 0.5 - 0.71)) < 1e-9);
  });

  it("alcance da cena vale para todos; sem visão dos personagens, ninguém", () => {
    const ally: FogAlly = { pos: { col: 0, row: 0 }, darkvision: true };
    const [viewer] = fogViewers([ally], { ...NIGHT, range: 30 });
    assert.ok(Math.abs(viewer.reach - (6 + 0.5 - 0.71)) < 1e-9);
    assert.deepEqual(fogViewers([ally], { ...NIGHT, vision: false }), []);
    assert.deepEqual(fogViewers([{ pos: null }], NIGHT), []);
  });

  it("o leque sem paredes cai inteiro nas casas que o servidor manda", () => {
    for (const kind of [undefined, "hexRows"] satisfies (GridKind | undefined)[]) {
      const pos = { col: 10, row: 10 };
      const seen = new Set(sightCells([{ pos, span: 1, feet: 30, size: "medium" }], [], 5, [], undefined, kind).map((cell) => `${cell.col},${cell.row}`));
      const [viewer] = fogViewers([{ pos }], { ...NIGHT, kind, range: 30 });
      const points = fogSightTriangles([viewer], []);
      const geometry = geometryOf(kind);
      for (let index = 0; index < points.length; index += 2) {
        // um tico para dentro: o ponto na borda do leque, não em cima da linha entre duas casas
        const x = points[index] + (viewer.x - points[index]) * 1e-6;
        const y = points[index + 1] + (viewer.y - points[index + 1]) * 1e-6;
        const cell = geometry.cellAt({ x, y });
        assert.ok(seen.has(`${cell.col},${cell.row}`), `${kind ?? "square"}: ponto ${x},${y} na casa ${cell.col},${cell.row} que o servidor não manda`);
      }
    }
  });

  it("à noite, tocha fixa acende 40 ft no ponto dela e quem vê enxerga a luz até 120 ft", () => {
    const lit = fogLit([{ pos: { col: 3, row: 4 } }], [], [{ col: 10, row: 10 }], NIGHT);
    assert.equal(lit.lights.length, 1);
    assert.equal(lit.lights[0].x, 10);
    assert.equal(lit.lights[0].y, 10);
    assert.ok(Math.abs(lit.lights[0].reach - (8 + 0.5 - 0.71)) < 1e-9);
    assert.equal(lit.far.length, 1);
    assert.equal(lit.far[0].x, 3.5);
    assert.ok(Math.abs(lit.far[0].reach - (24 - 0.71)) < 1e-9);
  });

  it("token com tocha à vista acende; oculto não; de dia, com alcance da cena ou sem visão, nada", () => {
    const carrier: FogCarrier = { pos: { col: 6, row: 6 }, torch: true };
    const [light] = fogLit([{ pos: { col: 0, row: 0 } }], [carrier], [], NIGHT).lights;
    assert.equal(light.x, 6.5);
    assert.ok(Math.abs(light.reach - (8 + 0.5 - 0.71)) < 1e-9);
    assert.deepEqual(fogLit([{ pos: { col: 0, row: 0 } }], [{ ...carrier, hidden: true }], [], NIGHT).lights, []);
    const none = { far: [], lights: [] };
    assert.deepEqual(fogLit([{ pos: { col: 0, row: 0 } }], [carrier], [{ col: 1, row: 1 }], { ...NIGHT, light: "day" }), none);
    assert.deepEqual(fogLit([{ pos: { col: 0, row: 0 } }], [carrier], [{ col: 1, row: 1 }], { ...NIGHT, range: 30 }), none);
    assert.deepEqual(fogLit([{ pos: { col: 0, row: 0 } }], [carrier], [{ col: 1, row: 1 }], { ...NIGHT, vision: false }), none);
  });

  it("trecho de 3 casas vira 2 triângulos; um hex, 4", () => {
    const run = fogCellTriangles({ "2": [1, 4] }, undefined);
    assert.equal(run.length, 12);
    for (let index = 0; index < run.length; index += 2) {
      assert.ok(run[index] >= 1 && run[index] <= 4);
      assert.ok(run[index + 1] >= 2 && run[index + 1] <= 3);
    }
    assert.equal(fogCellTriangles({ "0": [0, 1] }, "hexRows").length, 24);
  });

  it("leque sem paredes: 48 triângulos", () => {
    assert.equal(fogSightTriangles([{ x: 0, y: 0, reach: 5 }], []).length, 48 * 6);
  });

  it("ruído: RGBA do lado pedido, duas nuvens diferentes", () => {
    const data = fogNoiseData(16, 4);
    assert.equal(data.length, 16 * 16 * 4);
    let differ = false;
    for (let index = 0; index < data.length; index += 4) {
      assert.equal(data[index + 3], 255);
      if (data[index] !== data[index + 1]) differ = true;
    }
    assert.ok(differ);
  });
});
