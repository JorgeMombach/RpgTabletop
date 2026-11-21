import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  canPass,
  cellsAroundPoint,
  cellsAroundPointIn,
  cellsWithCenterIn,
  geometryOf,
  roomCells,
  sightCells,
  sizeOfSpan,
  wallAnchor,
  type CellPoint,
  type GridKind,
  type GridPos,
  type Wall,
} from "@rpg/shared";

// Névoa e visão no grid hex (Passo 16, fase 3): as mesmas contas, com os centros e vizinhos da geometria.
const keyOf = (cell: GridPos) => `${cell.col},${cell.row}`;
const sameSet = (a: GridPos[], b: GridPos[]) => assert.deepEqual(new Set(a.map(keyOf)), new Set(b.map(keyOf)));
const wall = (id: string, from: CellPoint, to: CellPoint): Wall => ({ id, from: { col: from.x, row: from.y }, to: { col: to.x, row: to.y } });

describe("névoa e visão: quadrado igual a antes", () => {
  it("quadrado igual a antes", () => {
    const walls: Wall[] = [
      { id: "a", from: { col: 0, row: 0 }, to: { col: 4, row: 0 } },
      { id: "b", from: { col: 4, row: 0 }, to: { col: 4, row: 4 } },
      { id: "c", from: { col: 0, row: 4 }, to: { col: 4, row: 4 } },
      { id: "d", from: { col: 0, row: 0 }, to: { col: 0, row: 4 } },
    ];
    assert.deepEqual(roomCells({ col: 1, row: 1 }, walls, 100, "square"), roomCells({ col: 1, row: 1 }, walls, 100));
    assert.equal(canPass({ col: 3, row: 1 }, { col: 4, row: 1 }, walls, "square"), canPass({ col: 3, row: 1 }, { col: 4, row: 1 }, walls));
    const viewers = [{ pos: { col: 1, row: 1 }, span: 1, feet: 30 }];
    assert.deepEqual(sightCells(viewers, walls, 5, [], 120, "square"), sightCells(viewers, walls, 5));
    assert.deepEqual(wallAnchor({ x: 2.4, y: 3.6 }, "square"), { x: 2, y: 4 });
    assert.deepEqual(wallAnchor({ x: 2.4, y: 3.6 }, undefined), { x: 2, y: 4 });
    assert.deepEqual(cellsAroundPointIn({ x: 2, y: 3 }, undefined), cellsAroundPoint(2, 3));
    assert.deepEqual(cellsAroundPointIn({ x: 2.5, y: 3.5 }, "square"), cellsAroundPoint(2.5, 3.5));
    assert.deepEqual([1, 2, 3, 4].map(sizeOfSpan), [undefined, "large", "huge", "gargantuan"]);
  });
});

for (const kind of ["hexRows", "hexCols"] as const satisfies readonly GridKind[]) {
  const geo = geometryOf(kind);
  const flip = kind === "hexCols";
  const at = (lane: number, line: number): GridPos => (flip ? { col: line, row: lane } : { col: lane, row: line });
  const positions = [at(4, 4), at(4, 5), at(-3, -1)];

  /** O lado comum a duas casas vizinhas: os dois vértices que elas dividem. */
  function sharedSide(a: GridPos, b: GridPos): [CellPoint, CellPoint] {
    const other = geo.polygon(b);
    const shared = geo.polygon(a).filter((corner) => other.some((p) => Math.hypot(p.x - corner.x, p.y - corner.y) < 1e-6));
    assert.equal(shared.length, 2, "vizinhas dividem um lado");
    return [shared[0], shared[1]];
  }

  describe(`névoa e visão no ${kind}`, () => {
    it("parede no lado do hex bloqueia", () => {
      for (const pos of positions) {
        const around = geo.neighbors(pos);
        const [from, to] = sharedSide(pos, around[0]);
        const walls = [wall("w", from, to)];
        assert.equal(canPass(pos, around[0], walls, kind), false);
        for (const other of around.slice(1)) assert.equal(canPass(pos, other, walls, kind), true);
      }
    });

    it("cômodo hex fecha nas paredes", () => {
      const pos = at(5, 5);
      const room = geo.footprint(pos, "huge");
      const inside = new Set(room.map(keyOf));
      const walls: Wall[] = [];
      for (const cell of room) {
        for (const neighbor of geo.neighbors(cell)) {
          if (inside.has(keyOf(neighbor))) continue;
          const [from, to] = sharedSide(cell, neighbor);
          walls.push(wall(`w${walls.length}`, from, to));
        }
      }
      const found = roomCells(pos, walls, 100, kind);
      assert.ok(found);
      sameSet(found, room);
      assert.equal(roomCells(pos, [], 50, kind), null, "sem paredes não fecha");
    });

    it("visão hex", () => {
      const pos = at(0, 0);
      const seen = sightCells([{ pos, span: 1, feet: 30 }], [], 5, [], 120, kind);
      const keys = new Set(seen.map(keyOf));
      for (let lane = -10; lane <= 10; lane++) {
        for (let line = -10; line <= 10; line++) {
          const cell = at(lane, line);
          const distance = geo.distance(pos, cell);
          if (distance <= 6) assert.ok(keys.has(keyOf(cell)), `vê ${keyOf(cell)} a ${distance}`);
          if (distance >= 8) assert.equal(keys.has(keyOf(cell)), false, `não vê ${keyOf(cell)} a ${distance}`);
        }
      }
      // Parede comprida entre ele e um hex a 3 de distância, na mesma linha (ou coluna).
      const target = at(3, 0);
      const middle = (geo.center(pos).x + geo.center(target).x) / 2;
      const across = (geo.center(pos).y + geo.center(target).y) / 2;
      const blocker = flip
        ? wall("w", { x: across - 3, y: middle }, { x: across + 3, y: middle })
        : wall("w", { x: middle, y: across - 3 }, { x: middle, y: across + 3 });
      const behind = sightCells([{ pos, span: 1, feet: 30 }], [blocker], 5, [], 120, kind);
      assert.equal(behind.some((cell) => keyOf(cell) === keyOf(target)), false, "atrás da parede");
      // Grande: as 3 casas da própria forma contam como vistas.
      const large = sightCells([{ pos, span: 2, feet: 5, size: "large" }], [], 5, [], 120, kind);
      const largeKeys = new Set(large.map(keyOf));
      for (const cell of geo.footprint(pos, "large")) assert.ok(largeKeys.has(keyOf(cell)));
      // Tocha fixa: a luz sai do ponto exato.
      const torch = geo.center(at(6, 6));
      const lit = sightCells([{ pos: geo.cellAt(torch), span: 1, feet: 5, point: torch }], [], 5, [], 120, kind);
      assert.ok(lit.some((cell) => keyOf(cell) === keyOf(at(6, 6))));
    });

    it("encaixe da parede", () => {
      const pos = at(3, 3);
      const corners = geo.polygon(pos);
      for (let i = 0; i < corners.length; i++) {
        const corner = corners[i];
        const nearCorner = wallAnchor({ x: corner.x + 0.03, y: corner.y - 0.02 }, kind);
        assert.ok(Math.abs(nearCorner.x - corner.x) <= 0.006 && Math.abs(nearCorner.y - corner.y) <= 0.006, "vértice");
        const next = corners[(i + 1) % corners.length];
        const side = { x: (corner.x + next.x) / 2, y: (corner.y + next.y) / 2 };
        const nearSide = wallAnchor({ x: side.x + 0.02, y: side.y + 0.01 }, kind);
        assert.ok(Math.abs(nearSide.x - side.x) <= 0.006 && Math.abs(nearSide.y - side.y) <= 0.006, "meio do lado");
      }
    });

    it("casas em volta de um ponto", () => {
      const pos = at(2, 2);
      assert.deepEqual(cellsAroundPointIn(geo.center(pos), kind), [pos]);
      const around = cellsAroundPointIn(geo.polygon(pos)[0], kind);
      assert.equal(around.length, 3);
      for (const a of around) for (const b of around) if (a !== b) assert.equal(geo.distance(a, b), 1);
      assert.ok(around.some((cell) => keyOf(cell) === keyOf(pos)));
    });

    it("retângulo da névoa", () => {
      const a = { x: 1.2, y: 0.4 };
      const b = { x: 5.7, y: 3.9 };
      const cells = cellsWithCenterIn(a, b, kind);
      assert.ok(cells.length > 0);
      const inBox = (p: CellPoint) => p.x >= 1.2 && p.x <= 5.7 && p.y >= 0.4 && p.y <= 3.9;
      for (const cell of cells) assert.ok(inBox(geo.center(cell)), `centro dentro: ${keyOf(cell)}`);
      const keys = new Set(cells.map(keyOf));
      for (let col = -2; col <= 10; col++) {
        for (let row = -2; row <= 10; row++) if (inBox(geo.center({ col, row }))) assert.ok(keys.has(`${col},${row}`), `faltou ${col},${row}`);
      }
      // A ordem dos cantos não importa.
      sameSet(cellsWithCenterIn(b, a, kind), cells);
    });
  });
}
