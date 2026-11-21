import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { blocks, lightBlockers, triangulate, wallChains, wallRooms, type Wall } from "@rpg/shared";

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

  it("quina de desenhos diferentes: as duas pontas passam meia espessura da outra (sem dente no canto)", () => {
    const chains = wallChains([wall([0, 0], [4, 0], { style: "stone" }), wall([4, 0], [4, 4], { style: "wood", thickness: 0.4 })], "stone");
    const stone = chains.find((chain) => chain.style === "stone");
    const wood = chains.find((chain) => chain.style === "wood");
    assert.ok(stone && wood);
    const atCorner = (chain: typeof stone) => (chain.points[0].x === 4 && chain.points[0].y === 0 ? chain.extend[0] : chain.extend[1]);
    assert.ok(Math.abs(atCorner(stone) - 0.2) < 1e-9, "pedra passa metade da madeira (0,4)");
    assert.ok(Math.abs(atCorner(wood) - 0.09) < 1e-9, "madeira passa metade da pedra (0,18)");
  });

  it("T: o pé termina embaixo da que segue, sem passar", () => {
    const chains = wallChains([wall([0, 0], [6, 0]), wall([3, 0], [3, 4])], "stone");
    const stem = chains.find((chain) => chain.points.some((point) => point.y === 4));
    assert.ok(stem);
    assert.deepEqual(stem.extend, [0, 0]);
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

describe("paredes: emenda por distância e cadeia estável", () => {
  it("ponta que quase encosta (0,01 casa) numa ponta ou no corpo de outra parede emenda", () => {
    // ponta com ponta: uma cadeia só
    assert.equal(wallChains([wall([0, 0], [4, 0]), wall([4.01, 0.01], [4, 4])], "stone").length, 1);
    // ponta quase no corpo (T): a de cima é cortada no encontro e a do T termina nela
    const chains = wallChains([wall([0, 0], [8, 0]), wall([4, 0.01], [4, 4])], "stone");
    const foot = chains.find((chain) => chain.points.some((point) => point.y > 3));
    assert.ok(foot);
    assert.deepEqual(foot.ends.includes("butt"), true, "o pé do T encosta (não fica solto)");
  });

  it("duas paredes quase alinhadas sobrepostas viram uma linha só (sem X raso)", () => {
    const chains = wallChains([wall([0, 0], [6, 0]), wall([3, 0.004], [9, 0.008])], "stone");
    assert.equal(chains.length, 1);
    const xs = chains[0].points.map((point) => point.x);
    assert.equal(Math.min(...xs), 0);
    assert.equal(Math.max(...xs), 9);
  });

  it("paredes bem separadas (0,2 casa) não emendam", () => {
    assert.equal(wallChains([wall([0, 0], [4, 0]), wall([4.2, 0], [4.2, 4])], "stone").length, 2);
  });

  it("a cadeia sai igual qualquer que seja a ordem das paredes (a textura não pula depois do desfazer)", () => {
    const walls = [wall([0, 0], [4, 0]), wall([4, 0], [4, 3]), wall([4, 3], [9, 3])];
    const shape = (list: Wall[]) => wallChains(list, "stone").map((chain) => chain.points.map((point) => [point.x, point.y]));
    assert.deepEqual(shape([...walls].reverse()), shape(walls));
    assert.deepEqual(shape([walls[1], walls[2], walls[0]]), shape(walls));
    const loop = square();
    assert.deepEqual(shape([loop[2], loop[0], loop[3], loop[1]]), shape(loop));
  });
});

describe("paredes: janela em parede vazada", () => {
  it("janela conta como fechada para o cômodo e bloqueia com a persiana fechada, qualquer que seja o desenho", () => {
    const room = [wall([0, 0], [7, 0]), wall([7, 0], [7, 7]), wall([7, 7], [4, 7]), wall([4, 7], [3, 7], { window: {}, style: "fence" }), wall([3, 7], [0, 7]), wall([0, 7], [0, 0])];
    assert.equal(wallRooms(room).length, 1);
    const shut = wall([0, 0], [1, 0], { window: { closed: true }, style: "fence" });
    const open = wall([0, 0], [1, 0], { window: {}, style: "fence" });
    assert.equal(blocks(shut), true);
    assert.equal(blocks(open), false);
    assert.equal(lightBlockers([shut])[0].seeThrough, false, "a persiana fechada segura a luz");
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

  it("muralha e paliçada não fecham cômodo (pátio murado é ao ar livre), nem pelo desenho da cena", () => {
    assert.equal(wallRooms(square({ style: "rampart" })).length, 0);
    assert.equal(wallRooms(square({ style: "palisade" })).length, 0);
    assert.equal(wallRooms(square(), "palisade").length, 0);
    assert.equal(wallRooms(square(), "brick").length, 1);
  });

  it("com um buraco não é cômodo", () => {
    const walls = [wall([0, 0], [7, 0]), wall([7, 0], [7, 7]), wall([7, 7], [1, 7]), wall([0, 7], [0, 0])];
    assert.equal(wallRooms(walls).length, 0);
  });

  it("parede em T por dentro não divide o cômodo", () => {
    assert.equal(wallRooms([...square(), wall([3, 0], [3, 4])]).length, 1);
  });

  it("cômodo dentro de cômodo: os dois aparecem (a casa dentro do pátio não perde o telhado)", () => {
    const inner = [wall([3, 3], [5, 3]), wall([5, 3], [5, 5]), wall([5, 5], [3, 5]), wall([3, 5], [3, 3])];
    const rooms = wallRooms([...square(), ...inner]);
    assert.equal(rooms.length, 2);
  });
});

describe("paredes: triângulos dos cômodos (telhado)", () => {
  const area = (triangles: number[]) => {
    let sum = 0;
    for (let index = 0; index < triangles.length; index += 6) {
      const [ax, ay, bx, by, cx, cy] = triangles.slice(index, index + 6);
      sum += Math.abs((bx - ax) * (cy - ay) - (cx - ax) * (by - ay)) / 2;
    }
    return sum;
  };
  it("quadrado: 2 triângulos, área 49", () => {
    const triangles = triangulate([0, 0, 7, 0, 7, 7, 0, 7]);
    assert.equal(triangles.length, 12);
    assert.ok(Math.abs(area(triangles) - 49) < 1e-9);
  });
  it("cômodo em L (côncavo): a área é a do L, sem cobrir o canto de fora", () => {
    assert.ok(Math.abs(area(triangulate([0, 0, 4, 0, 4, 2, 2, 2, 2, 4, 0, 4])) - 12) < 1e-9);
  });
  it("cômodo com parede em T por dentro (vai e volta no contorno): a área não muda", () => {
    const [room] = wallRooms([...square(), wall([3, 0], [3, 4])]);
    assert.ok(Math.abs(area(triangulate(room)) - 49) < 1e-9);
  });
});
