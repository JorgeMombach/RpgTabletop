import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { encodeLayer, fieldScale, toHalfFloat, riverField, signedDistance, TERRAIN_CHUNK_SIDE, TERRAIN_FINE, waterBounds, waterField, type TerrainChunks, type TerrainId, type WaterCurrent } from "@rpg/shared";

// Água animada (docs/design/agua.md): máscara da água a partir do terreno, distância com sinal e coordenadas do rio.

/** Terreno com `terrain` em 255 nos pontos finos cujas casas (x, y) passam em `inside` (pode cruzar pedaços). */
function paint(chunks: TerrainChunks, terrain: TerrainId, inside: (col: number, row: number) => boolean, cols: number, rows: number) {
  const layers = new Map<string, Uint8Array>();
  for (let j = 0; j < rows * TERRAIN_FINE; j++) {
    for (let i = 0; i < cols * TERRAIN_FINE; i++) {
      if (!inside(i / TERRAIN_FINE, j / TERRAIN_FINE)) continue;
      const key = `${Math.floor(i / TERRAIN_CHUNK_SIDE)},${Math.floor(j / TERRAIN_CHUNK_SIDE)}`;
      const bytes = layers.get(key) ?? new Uint8Array(TERRAIN_CHUNK_SIDE * TERRAIN_CHUNK_SIDE);
      bytes[(j % TERRAIN_CHUNK_SIDE) * TERRAIN_CHUNK_SIDE + (i % TERRAIN_CHUNK_SIDE)] = 255;
      layers.set(key, bytes);
    }
  }
  for (const [key, bytes] of layers) chunks[key] = { ...chunks[key], [terrain]: encodeLayer(bytes) };
  return chunks;
}

const at = (values: Float32Array, width: number, x: number, y: number, stride = 1, channel = 0) => values[(y * width + x) * stride + channel];

describe("água: distância com sinal", () => {
  it("ponto e retângulo: distância exata", () => {
    const dot = new Uint8Array(81);
    dot[4 * 9 + 4] = 1;
    const sdfDot = signedDistance(dot, 9, 9);
    assert.equal(at(sdfDot, 9, 4, 4), 0.5);
    assert.ok(Math.abs(at(sdfDot, 9, 0, 0) + (Math.sqrt(32) - 0.5)) < 1e-4);

    const rect = new Uint8Array(40 * 30);
    for (let y = 10; y < 20; y++) for (let x = 10; x < 30; x++) rect[y * 40 + x] = 1;
    const sdfRect = signedDistance(rect, 40, 30);
    assert.equal(Math.max(...sdfRect), 4.5);
    assert.equal(at(sdfRect, 40, 20, 10), 0.5, "beira de dentro");
    assert.equal(at(sdfRect, 40, 20, 9), -0.5, "beira de fora");
  });

  it("tudo água ou nada de água: valores finitos", () => {
    const all = signedDistance(new Uint8Array(16).fill(1), 4, 4);
    const none = signedDistance(new Uint8Array(16), 4, 4);
    assert.ok(all.every((value) => Number.isFinite(value) && value > 0));
    assert.ok(none.every((value) => Number.isFinite(value) && value < 0));
  });
});

describe("água: máscara a partir do terreno", () => {
  it("água nas casas 2 a 5: dentro no meio, fora na beira; água funda marca o fundo", () => {
    const shallow = paint({}, "water", (x, y) => x >= 2 && x < 6 && y >= 2 && y < 6, 8, 8);
    const field = waterField(shallow, { col: 0, row: 0, cols: 8, rows: 8 }, 8);
    assert.equal(field.width, 64);
    assert.equal(field.height, 64);
    assert.ok(at(field.sdf, 64, 32, 32) > 0, "meio da água");
    assert.ok(at(field.sdf, 64, 4, 4) < 0, "casa 0 é terra");
    assert.ok(at(field.deep, 64, 32, 32) < 0.01);

    const deep = paint({}, "waterDark", (x, y) => x >= 2 && x < 6 && y >= 2 && y < 6, 8, 8);
    assert.ok(at(waterField(deep, { col: 0, row: 0, cols: 8, rows: 8 }, 8).deep, 64, 32, 32) > 0.99);
  });

  it("grupos de água separados viram retângulos separados; encostados, um só", () => {
    const apart = paint({}, "water", (x, y) => y < 3 && (x < 3 || (x >= 40 && x < 43)), 48, 4);
    const rects = waterBounds(apart, 2);
    assert.equal(rects.length, 2);
    assert.ok(rects.every((rect) => rect.cols >= 3 + 4 - 1 && rect.rows >= 3));
    const touching = paint({}, "water", (x, y) => y < 3 && x < 10, 48, 4);
    assert.equal(waterBounds(touching, 2).length, 1);
    assert.deepEqual(waterBounds({}, 2), []);
  });
});

describe("água: coordenadas do rio", () => {
  // Faixa de água horizontal de 4 casas de altura (linhas 4 a 8), 40 casas de comprimento; mais um lago grande à parte.
  const chunks = paint({}, "water", (x, y) => (y >= 4 && y < 8 && x < 40) || (x >= 44 && x < 64 && y >= 0 && y < 20), 64, 20);
  const field = waterField(chunks, { col: 0, row: 0, cols: 64, rows: 20 }, 4);
  const line: WaterCurrent = { id: "rio", points: [1, 6, 39, 6] };
  const river = riverField(field, [line]);
  const value = (cellX: number, cellY: number, channel: number) => at(river, field.width, Math.floor(cellX * 4), Math.floor(cellY * 4), 4, channel);

  it("ao longo cresce no sentido da linha; o lado tem sinal; força 1 na linha", () => {
    assert.ok(Math.abs(value(12.5, 6, 0) - value(10, 6, 0) - 10) < 0.6, "2,5 casas = 10 px do campo");
    assert.ok(value(10, 4.5, 1) * value(10, 7.5, 1) < 0, "lados opostos, sinais opostos");
    assert.equal(value(10, 6, 2), 1);
  });

  it("lago longe da linha: força zero; fim da linha: a força cai", () => {
    assert.equal(value(54, 10, 2), 0);
    assert.ok(value(38.5, 6, 2) < 0.3);
  });

  it("linha só em terra e linhas cruzadas não quebram", () => {
    const onLand = riverField(field, [{ id: "seco", points: [1, 15, 30, 15] }]);
    assert.ok(onLand.every((number) => Number.isFinite(number)));
    assert.equal(at(onLand, field.width, 40, 24, 4, 2), 0, "água do rio sem linha por perto");
    const crossed = riverField(field, [line, { id: "contra", points: [39, 5, 1, 7] }]);
    assert.ok(crossed.every((number) => Number.isFinite(number)));
  });
});

describe("água: limites (revisão final)", () => {
  it("escala do campo: 20 px por casa até o teto; grupo grande desce para caber", () => {
    assert.equal(fieldScale({ col: 0, row: 0, cols: 30, rows: 20 }, 20, 2048), 20);
    assert.equal(fieldScale({ col: 0, row: 0, cols: 160, rows: 40 }, 20, 2048), 12.8);
    assert.ok(fieldScale({ col: 0, row: 0, cols: 900, rows: 900 }, 20, 2048) * 900 <= 2048);
  });

  it("meia precisão arredonda para o mais perto (não trunca)", () => {
    // 1 + 3/4 do passo de 2^-10 fica mais perto de 1 + 2^-10 que de 1.
    const value = 1 + 0.75 * 2 ** -10;
    assert.equal(toHalfFloat(value), 0x3c01);
    assert.equal(toHalfFloat(1), 0x3c00);
    assert.equal(toHalfFloat(-2), 0xc000);
    assert.equal(toHalfFloat(0), 0);
    assert.equal(toHalfFloat(1e9), 0x7bff, "grande demais: o maior finito");
  });
});
