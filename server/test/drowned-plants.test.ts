import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { paintTerrain, type MapProp, type PropKind, type TerrainChunks } from "@rpg/shared";
import { drownedPlants } from "../../client/src/map/terrain/drownedPlants";

// A água apaga as plantas (docs/design/ajustes-rapidos.md): só as com o pé na água, só as que a passada afogou.
const prop = (kind: PropKind, col: number, row: number): MapProp => ({ id: `${kind}-${col}-${row}`, kind, col, row, size: 1, rotation: 0, seed: 0, above: false, blocks: false });
const grass = (): TerrainChunks => {
  const chunks: TerrainChunks = {};
  paintTerrain(chunks, { terrain: "grass", radius: 6, strength: 1, points: [5, 5] });
  return chunks;
};
const watered = (base: TerrainChunks): TerrainChunks => {
  const chunks = { ...base };
  paintTerrain(chunks, { terrain: "water", radius: 2, strength: 1, points: [5, 5] });
  return chunks;
};

describe("a água apaga as plantas", () => {
  it("só plantas com o pé na água somem", () => {
    const before = grass();
    const after = watered(before);
    const props = [prop("tree", 5, 5), prop("boulder", 5, 5.2), prop("bush", 6.95, 5), prop("flowers", 12, 12), prop("pine", 4.5, 5.5)];
    assert.deepEqual(
      drownedPlants(props, before, after).map((plant) => plant.kind),
      ["tree", "pine"],
    );
  });

  it("planta que já estava na água não conta de novo", () => {
    const before = watered(grass());
    const after = watered(before);
    assert.deepEqual(drownedPlants([prop("tree", 5, 5)], before, after), []);
  });
});
