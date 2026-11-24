import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { roofArea, roofTriangles, weatherClock, WEATHER_GLOWS, windCells } from "../../client/src/map/weather/weatherLayout";

/** Clima vivendo no mapa (docs/design/clima.md): relógio, vento, telhado e quem brilha. */

describe("conta do clima", () => {
  it("acúmulo cresce até 2 minutos, pela intensidade; relógio adiantado não fica negativo", () => {
    assert.deepEqual(weatherClock(0, 60000, 1), { time: 60, accumulation: 0.5 });
    assert.equal(weatherClock(0, 600000, 0.5).accumulation, 0.5);
    assert.deepEqual(weatherClock(10000, 0, 1), { time: 0, accumulation: 0 });
  });

  it("vento: 0 cai reto; 45° anda uma casa de lado por casa", () => {
    assert.equal(windCells(0), 0);
    assert.ok(Math.abs(windCells(45) - 1) < 1e-9);
    assert.ok(Math.abs(windCells(-45) + 1) < 1e-9);
  });

  it("telhado: um cômodo quadrado vira 2 triângulos; sem cômodo, sem área; mapa enorme tem teto", () => {
    const square = roofTriangles([[0, 0, 4, 0, 4, 4, 0, 4]]);
    assert.equal(square.length, 12);
    assert.equal(roofArea(new Float32Array(), 2048), null);
    assert.deepEqual(roofArea(square, 2048), { x: -1, y: -1, cols: 6, rows: 6 });
    const huge = roofArea(roofTriangles([[0, 0, 1000, 0, 1000, 10, 0, 10]]), 2048);
    assert.ok(huge && huge.cols * 8 <= 2048);
  });

  it("brilham sozinhos: brasas, vagalumes, luzes mágicas e esporos", () => {
    assert.deepEqual([...WEATHER_GLOWS].sort(), ["embers", "fireflies", "magic", "spores"]);
  });
});
