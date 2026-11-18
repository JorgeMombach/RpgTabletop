import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { wallChains, wallRooms, type Wall } from "@rpg/shared";

// Paredes emendadas (docs/design/paredes.md): cadeias para o desenho e cômodos para o telhado invisível.
let nextId = 0;
const wall = (from: [number, number], to: [number, number], extra: Partial<Wall> = {}): Wall => ({ id: `w${nextId++}`, from: { col: from[0], row: from[1] }, to: { col: to[0], row: to[1] }, ...extra });
const area = (flat: number[]) => {
  let sum = 0;
  for (let index = 0; index < flat.length; index += 2) {
    const next = (index + 2) % flat.length;
    sum += flat[index] * flat[next + 1] - flat[next] * flat[index + 1];
  }
  return Math.abs(sum / 2);
};
const square = (extra: Partial<Wall> = {}) => [wall([0, 0], [7, 0]), wall([7, 0], [7, 7]), wall([7, 7], [0, 7], extra), wall([0, 7], [0, 0])];

describe("paredes: emenda", () => {
  it("quadrado de 4 paredes soltas vira 1 cadeia fechada com 4 pontos e 1 cômodo de área 49", () => {
    const chains = wallChains(square(), "stone");
    assert.equal(chains.length, 1);
    assert.equal(chains[0].closed, true);
    assert.equal(chains[0].points.length, 4);
    assert.deepEqual(chains[0].ends, ["closed", "closed"]);
    const rooms = wallRooms(square());
    assert.equal(rooms.length, 1);
    assert.ok(Math.abs(area(rooms[0]) - 49) < 1e-6);
  });

  it("traço sobreposto no mesmo alinhamento vira 1 cadeia de (0,0) a (8,0)", () => {
    const chains = wallChains([wall([0, 0], [5, 0]), wall([3, 0], [8, 0])], "stone");
    assert.equal(chains.length, 1);
    const xs = chains[0].points.map((point) => point.x).sort((a, b) => a - b);
    assert.equal(xs[0], 0);
    assert.equal(xs[xs.length - 1], 8);
    assert.ok(chains[0].points.every((point) => point.y === 0));
  });

  it("T: a de cima continua inteira e a do T termina por baixo dela", () => {
    const chains = wallChains([wall([0, 0], [6, 0]), wall([3, 0], [3, 4])], "stone");
    assert.equal(chains.length, 2);
    const top = chains.find((chain) => chain.points.every((point) => point.y === 0));
    const stem = chains.find((chain) => chain.points.some((point) => point.y === 4));
    assert.ok(top && stem);
    assert.equal(top.points.length, 3);
    assert.deepEqual([top.points[0].x, top.points[2].x].sort((a, b) => a - b), [0, 6]);
    assert.ok(stem.ends.includes("butt"));
    assert.ok(stem.ends.includes("free"));
  });

  it("X: duas paredes que se cruzam viram 2 cadeias retas", () => {
    const chains = wallChains([wall([0, 2], [4, 2]), wall([2, 0], [2, 4])], "stone");
    assert.equal(chains.length, 2);
    for (const chain of chains) {
      const first = chain.points[0];
      const last = chain.points[chain.points.length - 1];
      assert.equal(Math.hypot(last.x - first.x, last.y - first.y), 4);
    }
  });

  it("desenho diferente no canto: pedra e madeira só se encostam", () => {
    const chains = wallChains([wall([0, 0], [4, 0], { style: "stone" }), wall([4, 0], [4, 4], { style: "wood" })], "stone");
    assert.equal(chains.length, 2);
    for (const chain of chains) assert.ok(chain.ends.includes("butt"));
    assert.deepEqual(chains.map((chain) => chain.style).sort(), ["stone", "wood"]);
  });

  it("pontas a 0,0004 casa uma da outra emendam", () => {
    const chains = wallChains([wall([0, 0], [4, 0]), wall([4.0004, 0], [4, 4])], "stone");
    assert.equal(chains.length, 1);
  });

  it("a cadeia guarda de quais paredes veio (cliques continuam por parede)", () => {
    const walls = square();
    const [chain] = wallChains(walls, "stone");
    assert.deepEqual([...chain.wallIds].sort(), walls.map((item) => item.id).sort());
  });
});

describe("paredes: cômodos", () => {
  it("porta conta como fechada; porta e janela ficam fora das cadeias", () => {
    const walls = [wall([0, 0], [6, 0]), wall([6, 0], [6, 6]), wall([6, 6], [3, 6]), wall([3, 6], [2, 6], { door: { open: true } }), wall([2, 6], [0, 6]), wall([0, 6], [0, 0])];
    assert.equal(wallRooms(walls).length, 1);
    for (const chain of wallChains(walls, "stone")) assert.ok(!chain.wallIds.includes(walls[3].id));
  });

  it("cercado (parede de cerca) não é cômodo", () => {
    assert.equal(wallRooms(square({ style: "fence" })).length, 0);
  });

  it("com um buraco não é cômodo", () => {
    const walls = [wall([0, 0], [7, 0]), wall([7, 0], [7, 7]), wall([7, 7], [1, 7]), wall([0, 7], [0, 0])];
    assert.equal(wallRooms(walls).length, 0);
  });

  it("parede em T por dentro não divide o cômodo", () => {
    assert.equal(wallRooms([...square(), wall([3, 0], [3, 4])]).length, 1);
  });
});
