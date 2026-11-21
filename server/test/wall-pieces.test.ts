import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  CELL_CANDIDATES,
  packPieces,
  PIECE_FLOATS,
  wallCellIndex,
  wallPieces,
  WALL_THICKNESS,
  type Wall,
  type WallPiece,
} from "@rpg/shared";

// Paredes na placa de vídeo (docs/design/relevo.md, etapa 2): peças que o shader desenha e o índice por casa.
const T = WALL_THICKNESS.default;
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
const near = (value: number, expected: number) =>
  assert.ok(Math.abs(value - expected) < 1e-9, `${value} ≠ ${expected}`);

describe("paredes na placa de vídeo: peças", () => {
  it("parede em L vira dois trechos com o veio contínuo", () => {
    const pieces = wallPieces(
      [wall("a", [0, 0], [4, 0]), wall("b", [4, 0], [4, 3])],
      "stone",
      { gm: true },
    );
    assert.equal(pieces.length, 2);
    assert.ok(
      pieces.every((piece) => piece.kind === "wall" && piece.style === "stone"),
    );
    const [first, second] = [...pieces].sort(
      (one, other) => one.along - other.along,
    );
    near(first.along, 0);
    near(
      second.along,
      Math.hypot(first.b.x - first.a.x, first.b.y - first.a.y),
    );
    // Na junta da quina, meia espessura; nas pontas soltas, um pouco além da ponta.
    near(first.reach[1], T / 2);
    near(second.reach[0], T / 2);
    near(first.reach[0], T * 0.12);
    near(second.reach[1], T * 0.12);
  });

  it("encontro em T no meio de uma reta continua um trecho só", () => {
    const pieces = wallPieces(
      [
        wall("a", [0, 0], [4, 0]),
        wall("b", [4, 0], [8, 0]),
        wall("c", [4, 0], [4, 3]),
      ],
      "stone",
      { gm: true },
    );
    assert.equal(pieces.length, 2);
    const straight = pieces.find(
      (piece) => Math.abs(piece.a.y) < 1e-9 && Math.abs(piece.b.y) < 1e-9,
    );
    assert.ok(straight);
    assert.deepEqual(
      [straight.a.x, straight.b.x].sort((one, other) => one - other),
      [0, 8],
    );
  });

  it("porta usa a dobradiça e o giro do layout", () => {
    const pieces = wallPieces(
      [
        wall("a", [2, 0], [3, 0], { door: { open: false } }),
        wall("b", [3, 0], [4, 0], { door: { open: true } }),
      ],
      "stone",
      { gm: true },
    );
    assert.equal(pieces.length, 2);
    const [left, right] = [...pieces].sort((one, other) => one.a.x - other.a.x);
    assert.ok(left.door && right.door);
    assert.equal(left.door.double, true);
    assert.equal(right.door.double, true);
    assert.equal(left.door.swing, -right.door.swing);
    // Dobradiças nas pontas de fora.
    assert.deepEqual([left.a.x, right.a.x], [2, 4]);
    assert.equal(right.door.open, true);
  });

  it("jogador não recebe marca de trancada nem de secreta", () => {
    const walls = [
      wall("a", [0, 0], [1, 0], {
        door: { open: false, locked: true, secret: true },
      }),
    ];
    const [player] = wallPieces(walls, "stone", { gm: false });
    assert.equal(player.door?.locked, false);
    assert.equal(player.door?.secret, false);
    const [master] = wallPieces(walls, "stone", { gm: true });
    assert.equal(master.door?.locked, true);
    assert.equal(master.door?.secret, true);
  });

  it("janela fechada", () => {
    const pieces = wallPieces(
      [wall("a", [0, 0], [1, 0], { window: { closed: true } })],
      "brick",
      { gm: false },
    );
    assert.equal(pieces.length, 1);
    assert.equal(pieces[0].kind, "window");
    assert.equal(pieces[0].window?.closed, true);
    const packed = packPieces(pieces);
    assert.equal(packed.length, PIECE_FLOATS);
    assert.equal(packed[10], 2, "tipo janela");
    assert.equal(packed[11], 16, "bandeira de janela fechada");
  });
});

describe("paredes na placa de vídeo: índice por casa", () => {
  it("índice por casa acha a parede e respeita o teto", () => {
    const one = wallCellIndex(
      wallPieces([wall("a", [0, 0.5], [10, 0.5])], "stone", { gm: true }),
    );
    assert.ok(one);
    const cellOf = (
      index: NonNullable<typeof one>,
      col: number,
      row: number,
    ) => {
      if (
        col < index.col ||
        row < index.row ||
        col >= index.col + index.cols ||
        row >= index.row + index.rows
      )
        return [];
      const at = (row - index.row) * index.cols + (col - index.col);
      return [
        ...index.list.subarray(
          index.start[at],
          index.start[at] + index.count[at],
        ),
      ];
    };
    assert.deepEqual(cellOf(one, 5, 0), [0]);
    assert.deepEqual(cellOf(one, 5, 5), []);

    const rows = Array.from({ length: 12 }, (_, index) => 0.2 + index * 0.05);
    const pieces = wallPieces(
      rows.map((y, index) => wall(`w${index}`, [0, y], [10, y])),
      "stone",
      { gm: true },
    );
    const many = wallCellIndex(pieces);
    assert.ok(many);
    const listed = cellOf(many, 5, 0);
    assert.equal(listed.length, CELL_CANDIDATES);
    const byDistance = pieces
      .map((piece, index) => ({ index, distance: Math.abs(piece.a.y - 0.5) }))
      .sort((one, other) => one.distance - other.distance);
    const nearest = new Set(
      byDistance.slice(0, CELL_CANDIDATES).map((entry) => entry.index),
    );
    // Empate na 8ª posição: vale qualquer uma das empatadas.
    const cut = byDistance[CELL_CANDIDATES - 1].distance;
    for (const index of listed)
      assert.ok(
        nearest.has(index) ||
          Math.abs(Math.abs(pieces[index].a.y - 0.5) - cut) < 1e-9,
        `peça ${index} longe do centro`,
      );
  });

  it("sem paredes, sem índice", () => {
    assert.equal(wallCellIndex([]), null);
  });
});

describe("paredes na placa de vídeo: aberturas fora do índice", () => {
  it("portas e janelas não ocupam vagas do índice por casa", () => {
    const door = (index: number): WallPiece => ({
      kind: "door",
      style: "stone",
      a: { x: 5 + index * 0.05, y: 0.5 },
      b: { x: 6 + index * 0.05, y: 0.5 },
      thickness: T,
      along: 0,
      reach: [0, 0],
      seed: 0,
      door: {
        open: false,
        swing: 1,
        double: false,
        locked: false,
        secret: false,
      },
    });
    const wallPiece: WallPiece = {
      kind: "wall",
      style: "stone",
      a: { x: 0, y: 1.2 },
      b: { x: 10, y: 1.2 },
      thickness: T,
      along: 0,
      reach: [0, 0],
      seed: 0,
    };
    const pieces = [
      ...Array.from({ length: 9 }, (_, index) => door(index)),
      wallPiece,
    ];
    const index = wallCellIndex(pieces);
    assert.ok(index);
    const at = (0 - index.row) * index.cols + (5 - index.col);
    assert.deepEqual(
      [
        ...index.list.subarray(
          index.start[at],
          index.start[at] + index.count[at],
        ),
      ],
      [9],
    );
    assert.equal(
      wallCellIndex(pieces.slice(0, 9)),
      null,
      "só aberturas: sem índice",
    );
  });
});
