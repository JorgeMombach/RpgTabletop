import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { lightBlockers, lightPolygon, sunShadows, type Segment, type Wall } from "@rpg/shared";

// Luz (docs/design/luz.md): o que segura a luz, o recorte de cada tocha pelas paredes e a sombra do sol.
const wall = (from: [number, number], to: [number, number], extra: Partial<Wall> = {}): Wall => ({ id: `${from}-${to}`, from: { col: from[0], row: from[1] }, to: { col: to[0], row: to[1] }, ...extra });
const points = (flat: number[]) => Array.from({ length: flat.length / 2 }, (_, index) => ({ x: flat[index * 2], y: flat[index * 2 + 1] }));

describe("luz: geometria", () => {
  it("o que segura a luz: parede e porta fechada; porta aberta não; vazada marcada", () => {
    const blockers = lightBlockers([
      wall([0, 0], [2, 0], { style: "stone" }),
      wall([2, 0], [3, 0], { door: { open: false } }),
      wall([3, 0], [4, 0], { door: { open: true } }),
      wall([4, 0], [6, 0], { style: "fence" }),
    ]);
    assert.equal(blockers.length, 3);
    assert.deepEqual(
      blockers.map((segment) => segment.seeThrough),
      [false, false, true],
    );
    assert.deepEqual(blockers[0], { x1: 0, y1: 0, x2: 2, y2: 0, seeThrough: false });
  });

  it("sem paredes, o recorte é o círculo do alcance", () => {
    const polygon = points(lightPolygon({ x: 5, y: 5 }, 2, []));
    assert.equal(polygon.length, 48);
    for (const point of polygon) assert.ok(Math.abs(Math.hypot(point.x - 5, point.y - 5) - 2) < 1e-9);
  });

  it("parede entre a luz e o ponto: o recorte para nela", () => {
    const blockers: Segment[] = [{ x1: 6, y1: 3, x2: 6, y2: 7, seeThrough: false }];
    const polygon = points(lightPolygon({ x: 5, y: 5 }, 4, blockers));
    const past = polygon.filter((point) => point.y > 4 && point.y < 6 && point.x > 6.001);
    assert.deepEqual(past, []);
    assert.ok(polygon.some((point) => point.x < 1.5), "do outro lado, vai até o alcance");
  });

  it("vazada não segura a luz", () => {
    const blockers: Segment[] = [{ x1: 6, y1: 3, x2: 6, y2: 7, seeThrough: true }];
    const polygon = points(lightPolygon({ x: 5, y: 5 }, 4, blockers));
    assert.ok(polygon.some((point) => point.y > 4 && point.y < 6 && point.x > 8.9));
  });

  it("sombra do sol: quadrilátero deslocado; vazada com um terço", () => {
    const solid: Segment = { x1: 0, y1: 0, x2: 2, y2: 0, seeThrough: false };
    const fence: Segment = { ...solid, seeThrough: true };
    assert.deepEqual(sunShadows([solid], { x: 0, y: 1 }, 3), [[0, 0, 2, 0, 2, 3, 0, 3]]);
    assert.deepEqual(sunShadows([fence], { x: 0, y: 1 }, 3), [[0, 0, 2, 0, 2, 1, 0, 1]]);
  });
});
