import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  decodeFloorPoint,
  encodeFloorPoint,
  floorAt,
  paintFloor,
  validFloorByte,
  type FloorChunks,
  type FloorStroke,
  type Wall,
} from "@rpg/shared";

// Pisos (docs/design/pisos.md): um byte por ponto da grade fina (material e sentido), pintado por pincel, retângulo
// ou cômodo fechado por paredes.
const wall = (
  id: string,
  from: [number, number],
  to: [number, number],
  extra: Partial<Wall> = {},
): Wall => ({
  id,
  from: { col: from[0], row: from[1] },
  to: { col: to[0], row: to[1] },
  ...extra,
});
/** Quadrado de paredes de (x0, y0) a (x1, y1). */
const square = (
  prefix: string,
  x0: number,
  y0: number,
  x1: number,
  y1: number,
  extra: Partial<Wall> = {},
): Wall[] => [
  wall(`${prefix}a`, [x0, y0], [x1, y0], extra),
  wall(`${prefix}b`, [x1, y0], [x1, y1], extra),
  wall(`${prefix}c`, [x1, y1], [x0, y1], extra),
  wall(`${prefix}d`, [x0, y1], [x0, y0], extra),
];
const brush = (
  material: FloorStroke["material"],
  x: number,
  y: number,
  radius = 1,
): FloorStroke => ({
  material,
  vertical: false,
  shape: { kind: "brush", radius, points: [x, y] },
});
const room = (
  material: FloorStroke["material"],
  x: number,
  y: number,
): FloorStroke => ({
  material,
  vertical: false,
  shape: { kind: "room", at: { x, y } },
});

describe("piso: contas", () => {
  it("byte do piso: material, sentido e reservados", () => {
    assert.equal(encodeFloorPoint({ material: "tile", vertical: true }), 20);
    assert.deepEqual(decodeFloorPoint(20), {
      material: "tile",
      vertical: true,
    });
    assert.ok(validFloorByte(0));
    assert.ok(validFloorByte(22));
    assert.equal(validFloorByte(7), false, "material 7 não existe");
    assert.equal(validFloorByte(32), false, "bit reservado");
  });

  it("pincel pinta dentro do raio; borracha tira e o pedaço vazio some", () => {
    const chunks: FloorChunks = {};
    paintFloor(chunks, brush("plank", 4, 4), [], "stone");
    assert.equal(floorAt(chunks, 16, 16).material, "plank");
    assert.equal(floorAt(chunks, 21, 16).material, null);
    paintFloor(chunks, brush("erase", 4, 4, 2), [], "stone");
    assert.equal(Object.keys(chunks).length, 0);
  });

  it("retângulo inclui as bordas", () => {
    const chunks: FloorChunks = {};
    paintFloor(
      chunks,
      {
        material: "flagstone",
        vertical: false,
        shape: { kind: "rect", from: { x: 1, y: 1 }, to: { x: 3, y: 2 } },
      },
      [],
      "stone",
    );
    assert.equal(floorAt(chunks, 4, 4).material, "flagstone");
    assert.equal(floorAt(chunks, 12, 8).material, "flagstone");
    assert.equal(floorAt(chunks, 3, 4).material, null);
    assert.equal(floorAt(chunks, 13, 8).material, null);
  });

  it("cômodo preenche até a linha da parede (porta fechada conta como parede)", () => {
    const walls = [
      wall("a", [0, 0], [4, 0]),
      wall("b", [4, 0], [4, 3]),
      wall("c1", [4, 3], [3, 3]),
      wall("door", [3, 3], [2, 3], { door: { open: false } }),
      wall("c2", [2, 3], [0, 3]),
      wall("d", [0, 3], [0, 0]),
    ];
    const chunks: FloorChunks = {};
    assert.ok(paintFloor(chunks, room("plank", 2, 1.5), walls, "stone"));
    assert.equal(floorAt(chunks, 0, 0).material, "plank");
    assert.equal(floorAt(chunks, 16, 12).material, "plank");
    assert.equal(floorAt(chunks, 17, 6).material, null);
  });

  it("fora de lugar fechado: null e nada muda", () => {
    const walls = [
      wall("a", [0, 0], [4, 0]),
      wall("b", [4, 0], [4, 3]),
      wall("d", [0, 3], [0, 0]),
    ];
    const chunks: FloorChunks = {};
    assert.equal(
      paintFloor(chunks, room("plank", 2, 1.5), walls, "stone"),
      null,
    );
    assert.deepEqual(chunks, {});
  });

  it("cômodo solto dentro do salão fica de fora", () => {
    const walls = [
      ...square("hall", 0, 0, 10, 10),
      ...square("inner", 4, 4, 6, 6),
    ];
    const chunks: FloorChunks = {};
    assert.ok(paintFloor(chunks, room("tile", 1, 1), walls, "stone"));
    assert.equal(floorAt(chunks, 4, 4).material, "tile");
    assert.equal(
      floorAt(chunks, 20, 20).material,
      null,
      "dentro do cômodo solto",
    );
    assert.ok(paintFloor(chunks, room("carpet", 5, 5), walls, "stone"));
    assert.equal(floorAt(chunks, 20, 20).material, "carpet");
  });

  it("cerca fecha o pátio", () => {
    const chunks: FloorChunks = {};
    assert.ok(
      paintFloor(
        chunks,
        room("flagstone", 2, 1.5),
        square("yard", 0, 0, 4, 3, { style: "fence" }),
        "stone",
      ),
    );
    assert.equal(floorAt(chunks, 8, 6).material, "flagstone");
  });

  it("pintar outro material por cima troca; o sentido fica guardado", () => {
    const chunks: FloorChunks = {};
    paintFloor(
      chunks,
      { ...brush("plank", 4, 4), vertical: true },
      [],
      "stone",
    );
    assert.deepEqual(floorAt(chunks, 16, 16), {
      material: "plank",
      vertical: true,
    });
    paintFloor(chunks, brush("tile", 4, 4), [], "stone");
    assert.deepEqual(floorAt(chunks, 16, 16), {
      material: "tile",
      vertical: false,
    });
  });
});
