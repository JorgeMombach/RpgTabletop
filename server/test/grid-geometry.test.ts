import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  blockedCells,
  cellDistance,
  centeredOn,
  footprint,
  geometryOf,
  freeSpotNear,
  nearestCellOf,
  nearestFreeSpot,
  occupiedCells,
  sharesCell,
  sizeSpan,
  SIZES,
  type GridKind,
  type GridPos,
  type Size,
} from "@rpg/shared";

// Geometria das três grades (Passo 16): o quadrado é o de sempre; o hex usa coordenadas offset.
const ROOT3 = Math.sqrt(3);
const SIZE_LIST = Object.keys(SIZES) as Size[];
const keyOf = (cell: GridPos) => `${cell.col},${cell.row}`;
const close = (actual: number, expected: number, message?: string) =>
  assert.ok(Math.abs(actual - expected) < 1e-9, message ?? `${actual} ≠ ${expected}`);

const SAMPLE_POSITIONS: GridPos[] = [
  { col: 0, row: 0 },
  { col: 3, row: 1 },
  { col: -2, row: 5 },
  { col: 7, row: -4 },
];

describe("geometria do grid", () => {
  it("quadrado = grid.ts", () => {
    const square = geometryOf("square");
    assert.equal(geometryOf(undefined).kind, "square", "ausente = quadrado");
    for (const pos of SAMPLE_POSITIONS) {
      for (const size of [undefined, ...SIZE_LIST]) {
        assert.deepEqual(square.footprint(pos, size), footprint(pos, sizeSpan(size)));
        assert.deepEqual(square.centeredOn(pos, size), centeredOn(pos, sizeSpan(size)));
        assert.deepEqual(square.nearestCellOf(pos, size, { col: 10, row: 1 }), nearestCellOf(pos, sizeSpan(size), { col: 10, row: 1 }));
        assert.equal(square.drawSpan(size), sizeSpan(size));
      }
      for (const other of SAMPLE_POSITIONS) assert.equal(square.distance(pos, other), cellDistance(pos, other));
    }
    const combatants = [
      { pos: { col: 0, row: 0 }, size: "huge" as const },
      { pos: { col: 5, row: 5 }, size: "tiny" as const },
      { pos: null },
      { pos: { col: 2, row: 7 } },
    ];
    assert.deepEqual(occupiedCells(combatants, "square"), blockedCells(combatants));
    const occupied = [{ col: 1, row: 0 }, { col: 0, row: 1 }];
    for (const size of [undefined, ...SIZE_LIST]) {
      assert.deepEqual(
        freeSpotNear({ col: 0, row: 0 }, occupied, size, "square"),
        nearestFreeSpot({ col: 0, row: 0 }, occupied, sizeSpan(size), sharesCell(size)),
      );
    }
    assert.deepEqual(square.center({ col: 0, row: 0 }), { x: 0.5, y: 0.5 });
    assert.deepEqual(square.cellAt({ x: 2.3, y: -0.2 }), { col: 2, row: -1 });
    assert.deepEqual(square.period, { x: 1, y: 1 });
    assert.equal(square.columnStep, 1);
    assert.equal(square.neighbors({ col: 0, row: 0 }).length, 4);
    assert.equal(square.polygon({ col: 0, row: 0 }).length, 4);
  });

  for (const kind of ["hexRows", "hexCols"] as const satisfies readonly GridKind[]) {
    const geo = geometryOf(kind);
    // hexCols é o hexRows espelhado na diagonal: troca x↔y e col↔row.
    const flip = kind === "hexCols";
    const along = (point: { x: number; y: number }) => (flip ? point.y : point.x);
    const across = (point: { x: number; y: number }) => (flip ? point.x : point.y);
    const at = (lane: number, line: number): GridPos => (flip ? { col: line, row: lane } : { col: lane, row: line });
    // Posições em linha (pontas para cima) ou coluna (lado em cima) par e ímpar.
    const parityPositions = [at(0, 0), at(0, 1), at(4, 3), at(-3, -1), at(2, -2)];

    describe(kind, () => {
      it("hex: centro ↔ casa", () => {
        for (let col = -3; col <= 3; col++) {
          for (let row = -3; row <= 3; row++) {
            const pos = { col, row };
            assert.deepEqual(geo.cellAt(geo.center(pos)), pos);
            // Um ponto perto do centro (dentro do hex) também cai nele.
            const center = geo.center(pos);
            assert.deepEqual(geo.cellAt({ x: center.x + 0.2, y: center.y - 0.2 }), pos);
          }
        }
        const origin = geo.center({ col: 0, row: 0 });
        close(along(origin), 0.5);
        close(across(origin), 1 / ROOT3);
        close(along(geo.center(at(0, 1))), 1, "linha (ou coluna) ímpar deslocada meio hex");
        close(across(geo.center(at(0, 2))) - across(origin), ROOT3);
        close(along(geo.period), 1);
        close(across(geo.period), ROOT3);
        close(geo.columnStep, flip ? ROOT3 / 2 : 1);
        assert.equal(geo.polygon({ col: 0, row: 0 }).length, 6);
      });

      it("hex: vizinhos e distância", () => {
        for (const pos of parityPositions) {
          const around = geo.neighbors(pos);
          assert.equal(around.length, 6);
          assert.equal(new Set(around.map(keyOf)).size, 6, "vizinhos distintos");
          for (const neighbor of around) {
            assert.equal(geo.distance(pos, neighbor), 1);
            // Vizinho de verdade: centros a 1 casa de distância.
            const a = geo.center(pos);
            const b = geo.center(neighbor);
            close(Math.hypot(a.x - b.x, a.y - b.y), 1);
          }
        }
        assert.equal(geo.distance(at(0, 0), at(3, 0)), 3);
        for (const a of parityPositions) for (const b of parityPositions) assert.equal(geo.distance(a, b), geo.distance(b, a));
      });

      it("hex: formas dos tamanhos", () => {
        for (const pos of parityPositions) {
          for (const size of [undefined, "tiny", "small", "medium"] as const) assert.deepEqual(geo.footprint(pos, size), [pos]);
          const large = geo.footprint(pos, "large");
          assert.equal(large.length, 3);
          assert.ok(large.some((cell) => keyOf(cell) === keyOf(pos)), "contém pos");
          for (const a of large) for (const b of large) if (a !== b) assert.equal(geo.distance(a, b), 1, "triângulo");
          const huge = geo.footprint(pos, "huge");
          assert.deepEqual(new Set(huge.map(keyOf)), new Set([pos, ...geo.neighbors(pos)].map(keyOf)));
          const gargantuan = geo.footprint(pos, "gargantuan");
          assert.equal(new Set(gargantuan.map(keyOf)).size, 19);
          assert.ok(gargantuan.every((cell) => geo.distance(pos, cell) <= 2));
          // Centro do desenho = média dos centros da forma.
          const center = geo.shapeCenter(pos, "large");
          const centers = large.map((cell) => geo.center(cell));
          close(center.x, centers.reduce((sum, point) => sum + point.x, 0) / 3);
          close(center.y, centers.reduce((sum, point) => sum + point.y, 0) / 3);
          assert.deepEqual(geo.shapeCenter(pos, "huge"), geo.center(pos));
          // A casa da forma mais perto de um alvo distante fica na borda dela.
          const target = at(20, 0);
          const nearest = geo.nearestCellOf(pos, "gargantuan", target);
          assert.equal(geo.distance(nearest, target), geo.distance(pos, target) - 2);
        }
        assert.deepEqual(
          [undefined, "large", "huge", "gargantuan"].map((size) => geo.drawSpan(size as Size | undefined)),
          [1, 2, 3, 5],
        );
        assert.deepEqual(occupiedCells([{ pos: at(0, 0), size: "tiny" }], kind), [], "miúdo não bloqueia");
        assert.equal(occupiedCells([{ pos: at(0, 0), size: "huge" }, { pos: null }], kind).length, 7);
      });

      it("hex: lugar livre", () => {
        const start = at(0, 0);
        assert.deepEqual(freeSpotNear(start, [], "large", kind), start, "sem ninguém, fica onde está");
        assert.deepEqual(freeSpotNear(start, [start], "tiny", kind), start, "miúdo divide a casa");
        const blocker = geo.footprint(start, "large")[2];
        const spot = freeSpotNear(start, [blocker], "large", kind);
        const taken = new Set([keyOf(blocker)]);
        assert.ok(geo.footprint(spot, "large").every((cell) => !taken.has(keyOf(cell))), "forma inteira livre");
        assert.ok(geo.distance(start, spot) <= 2, "perto de onde estava");
        assert.notDeepEqual(spot, start);
      });
    });
  }
});
