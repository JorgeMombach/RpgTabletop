import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { chunkKey, decodeLayer, encodeLayer, paintTerrain, terrainAt, type TerrainChunks, type TerrainStroke } from "@rpg/shared";

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
