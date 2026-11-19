import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { chunkKey, decodeLayer, encodeLayer, paintTerrain, terrainAt, terrainBounds, terrainWeights, TERRAINS, type TerrainChunks, type TerrainStroke } from "@rpg/shared";

// Terreno pintado (entrega 1 da criação de mapa): as contas do pincel e da mistura, puras.
const stroke = (terrain: TerrainStroke["terrain"], points: number[], radius = 1, strength = 1): TerrainStroke => ({ terrain, radius, strength, points });
const sum = (values: Partial<Record<string, number>>) => Object.values(values).reduce<number>((total, value) => total + (value ?? 0), 0);

describe("terreno: contas do pincel", () => {
  it("pincel sobe no centro e cai na borda", () => {
    const chunks: TerrainChunks = {};
    paintTerrain(chunks, stroke("grass", [4, 4]));
    const center = terrainAt(chunks, 4, 4).grass ?? 0;
    const side = terrainAt(chunks, 4.5, 4).grass ?? 0;
    assert.ok(center > side, `${center} > ${side}`);
    assert.ok(side > 0);
    assert.equal(terrainAt(chunks, 5.2, 4).grass ?? 0, 0);
  });

  it("o que entra empurra os outros", () => {
    const chunks: TerrainChunks = {};
    for (let i = 0; i < 4; i++) paintTerrain(chunks, stroke("grass", [4, 4]));
    assert.equal(terrainAt(chunks, 4, 4).grass, 255);
    paintTerrain(chunks, stroke("dirt", [4, 4]));
    const after = terrainAt(chunks, 4, 4);
    assert.ok((after.dirt ?? 0) > 0, "a terra entrou");
    assert.ok((after.grass ?? 0) < 255, "a grama cedeu");
    assert.ok(sum(after) <= 255);
  });

  it("borracha desce tudo", () => {
    const chunks: TerrainChunks = {};
    paintTerrain(chunks, stroke("grass", [4, 4]));
    paintTerrain(chunks, stroke("stone", [4, 4]));
    const before = sum(terrainAt(chunks, 4, 4));
    paintTerrain(chunks, stroke("erase", [4, 4]));
    const after = terrainAt(chunks, 4, 4);
    assert.ok(sum(after) < before);
    assert.ok(Object.values(after).every((value) => (value ?? 0) >= 0));
    for (let i = 0; i < 6; i++) paintTerrain(chunks, stroke("erase", [4, 4], 2));
    assert.deepEqual(terrainAt(chunks, 4, 4), {});
    assert.equal(chunkKey(0, 0) in chunks, false, "pedaço vazio sai");
  });

  it("passada atravessa pedaços", () => {
    const chunks: TerrainChunks = {};
    const changed = paintTerrain(chunks, stroke("grass", [6, 4, 7, 4, 8, 4, 9, 4, 10, 4]));
    assert.deepEqual(new Set(changed), new Set(["0,0", "1,0"]));
    assert.ok((terrainAt(chunks, 7.9, 4).grass ?? 0) > 0);
    assert.ok((terrainAt(chunks, 8.1, 4).grass ?? 0) > 0);
  });

  it("codificação", () => {
    const bytes = new Uint8Array(1024).map((_, i) => (i * 37) % 256);
    assert.deepEqual(decodeLayer(encodeLayer(bytes)), bytes);
    assert.equal(decodeLayer("xx"), null);
    assert.equal(decodeLayer(encodeLayer(new Uint8Array(1023))), null);
  });

  it("ponto fora de qualquer pedaço", () => {
    const chunks: TerrainChunks = {};
    assert.deepEqual(terrainAt(chunks, 50, 50), {});
    const changed = paintTerrain(chunks, stroke("water", [-2, -3]));
    assert.ok(changed.includes("-1,-1"));
    assert.ok((terrainAt(chunks, -2, -3).water ?? 0) > 0);
  });
});

// Terreno em retângulo: os cantos nas casas (ou meia casa), cada ponto de dentro recebe o terreno com a força do pincel.
describe("terreno: retângulo", () => {
  const rect = (terrain: TerrainStroke["terrain"], from: [number, number], to: [number, number], strength = 1): TerrainStroke => ({
    terrain,
    radius: 1,
    strength,
    points: [],
    rect: { from: { x: from[0], y: from[1] }, to: { x: to[0], y: to[1] } },
  });

  it("força 1 cobre por inteiro de canto a canto, inclusive a borda; fora, nada", () => {
    const chunks: TerrainChunks = {};
    paintTerrain(chunks, rect("sand", [3, 2], [1, 4]));
    assert.deepEqual(terrainAt(chunks, 1, 2), { sand: 255 }, "canto");
    assert.deepEqual(terrainAt(chunks, 2, 3), { sand: 255 }, "meio");
    assert.deepEqual(terrainAt(chunks, 3, 4), { sand: 255 }, "canto oposto (cantos em qualquer ordem)");
    assert.deepEqual(terrainAt(chunks, 3.25, 3), {}, "um ponto para fora");
    assert.deepEqual(terrainAt(chunks, 2, 1.75), {});
  });

  it("por cima de outro terreno, toma o lugar; com força menor, mistura", () => {
    const chunks: TerrainChunks = {};
    paintTerrain(chunks, rect("grass", [0, 0], [4, 4]));
    paintTerrain(chunks, rect("dirt", [1, 1], [2, 2]));
    assert.deepEqual(terrainAt(chunks, 1.5, 1.5), { dirt: 255 });
    paintTerrain(chunks, rect("stone", [3, 3], [4, 4], 0.5));
    const mixed = terrainAt(chunks, 3.5, 3.5);
    assert.ok((mixed.stone ?? 0) > 100 && (mixed.grass ?? 0) > 100, JSON.stringify(mixed));
  });

  it("borracha em retângulo apaga só ali", () => {
    const chunks: TerrainChunks = {};
    paintTerrain(chunks, rect("grass", [0, 0], [4, 4]));
    paintTerrain(chunks, rect("erase", [0, 0], [2, 4]));
    assert.deepEqual(terrainAt(chunks, 1, 1), {});
    assert.deepEqual(terrainAt(chunks, 3, 1), { grass: 255 });
  });
});

// Terreno na placa de vídeo (docs/design/renderizador-chao.md): área pintada e pesos no formato das texturas.
describe("terreno: pesos para a placa de vídeo", () => {
  const layerWith = (index: number, value: number) => {
    const bytes = new Uint8Array(1024);
    bytes[index] = value;
    return encodeLayer(bytes);
  };

  it("área do terreno: cobre os pedaços pintados; vazio = null", () => {
    const chunks: TerrainChunks = { "0,0": { grass: layerWith(0, 9) }, "2,-1": { dirt: layerWith(0, 9) } };
    assert.deepEqual(terrainBounds(chunks), { cx: 0, cy: -1, cols: 3, rows: 2 });
    assert.equal(terrainBounds({}), null);
  });

  it("pesos: um texel por ponto fino, na ordem de TERRAINS", () => {
    const index = 2 * 32 + 3;
    const chunks: TerrainChunks = { "0,0": { grass: layerWith(index, 200), water: layerWith(index, 55) } };
    const weights = terrainWeights(chunks, { cx: 0, cy: 0, cols: 1, rows: 1 });
    assert.equal(weights.width, 32);
    assert.equal(weights.height, 32);
    const texel = (2 * weights.width + 3) * 4;
    assert.equal(weights.first[texel], 200);
    assert.equal(weights.second[texel + 3], 55, "água: depois da areia");
    assert.equal(weights.first.reduce((total, value) => total + value, 0), 200);
    assert.equal(weights.second.reduce((total, value) => total + value, 0), 55);
  });

  it("pesos num retângulo com pedaços negativos: cada pedaço no lugar dele", () => {
    const chunks: TerrainChunks = { "-1,0": { stone: layerWith(0, 77) } };
    const weights = terrainWeights(chunks, { cx: -1, cy: 0, cols: 2, rows: 1 });
    assert.equal(weights.width, 64);
    assert.equal(weights.second[0], 77);
  });

  it("pesos de só alguns pedaços: um bloco 32 × 32 por chave", () => {
    const chunks: TerrainChunks = { "0,0": { grassDry: layerWith(5, 120) }, "1,0": { dirtDark: layerWith(7, 30) } };
    const weights = terrainWeights(chunks, { cx: 0, cy: 0, cols: 2, rows: 1 }, ["1,0", "0,0"]);
    assert.equal(weights.width, 32);
    assert.equal(weights.height, 64);
    assert.equal(weights.first[7 * 4 + 3], 30, "primeiro bloco = 1,0");
    assert.equal(weights.first[(32 * 32 + 5) * 4 + 1], 120, "segundo bloco = 0,0");
  });

  it("areia pinta e fica no canal b da segunda textura; a água funda vai para a terceira", () => {
    const chunks: TerrainChunks = {};
    paintTerrain(chunks, { terrain: "sand", radius: 1, strength: 1, points: [4, 4] });
    assert.ok((terrainAt(chunks, 4, 4).sand ?? 0) > 0);
    const weights = terrainWeights(chunks, { cx: 0, cy: 0, cols: 1, rows: 1 });
    const texel = (16 * weights.width + 16) * 4;
    assert.ok(weights.second[texel + 2] > 0, "areia: sétimo terreno");
    const deep: TerrainChunks = {};
    paintTerrain(deep, { terrain: "waterDark", radius: 1, strength: 1, points: [4, 4] });
    assert.ok(terrainWeights(deep, { cx: 0, cy: 0, cols: 1, rows: 1 }).third[texel] > 0, "água funda: nono terreno, terceira textura");
  });

  it("areia fica entre a pedra clara e a água", () => {
    assert.equal(TERRAINS.indexOf("sand"), TERRAINS.indexOf("stoneLight") + 1);
    assert.equal(TERRAINS.indexOf("water"), TERRAINS.indexOf("sand") + 1);
  });

  it("pedaço antigo sem areia: terceira textura vazia", () => {
    const chunks: TerrainChunks = { "0,0": { grass: layerWith(10, 90) } };
    const weights = terrainWeights(chunks, { cx: 0, cy: 0, cols: 1, rows: 1 });
    assert.equal(weights.first[10 * 4], 90);
    assert.equal(weights.third.reduce((total, value) => total + value, 0), 0);
  });
});
