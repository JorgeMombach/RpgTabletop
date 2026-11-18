import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { blockersNear, lightBlockers, lightPolygon, stopAtWall, sunShadows, windowSunPatches, type Segment, type Wall } from "@rpg/shared";

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

  it("janela: aberta fica de fora do que segura a luz; fechada é sólida", () => {
    const blockers = lightBlockers([wall([0, 0], [2, 0], { window: {} }), wall([2, 0], [4, 0], { window: { closed: true } })]);
    assert.equal(blockers.length, 1);
    assert.equal(blockers[0].x1, 2);
    assert.equal(blockers[0].seeThrough, false);
  });

  it("tocha encostada na parede: a luz sai do lado da base, um tico antes da parede", () => {
    const wallAbove: Segment = { x1: 0, y1: 1, x2: 5, y2: 1, seeThrough: false };
    // Base logo abaixo da parede; a chama (desenho) fica acima dela.
    const origin = stopAtWall({ x: 2.5, y: 1.3 }, { x: 2.5, y: 0.8 }, [wallAbove]);
    assert.equal(origin.x, 2.5);
    assert.ok(origin.y > 1 && origin.y < 1.05, `ficou do lado certo: ${origin.y}`);
    // Sem parede no caminho, vai até o ponto pedido; parede vazada não segura.
    assert.deepEqual(stopAtWall({ x: 2.5, y: 3 }, { x: 2.5, y: 2.5 }, [wallAbove]), { x: 2.5, y: 2.5 });
    assert.deepEqual(stopAtWall({ x: 2.5, y: 1.3 }, { x: 2.5, y: 0.8 }, [{ ...wallAbove, seeThrough: true }]), { x: 2.5, y: 0.8 });
  });

  it("paredes ao alcance: uma porta longe não entra na conta da tocha", () => {
    const near: Segment = { x1: 1, y1: -1, x2: 1, y2: 1, seeThrough: false };
    const far: Segment = { x1: 20, y1: 0, x2: 21, y2: 0, seeThrough: false };
    const long: Segment = { x1: -30, y1: 3, x2: 30, y2: 3, seeThrough: false };
    assert.deepEqual(blockersNear({ x: 0, y: 0 }, 4, [near, far, long]), [near, long]);
  });

  it("sol pela janela: entra no cômodo do lado oposto ao sol, com o comprimento pedido", () => {
    const room = [0, 0, 4, 0, 4, 4, 0, 4];
    const window: Segment = { x1: 1, y1: 0, x2: 2, y2: 0, seeThrough: false };
    // Sombras caem para o sul (sol ao norte): a luz entra pela janela de cima.
    assert.deepEqual(windowSunPatches([window], [room], { x: 0, y: 1 }, 1.5), [[1, 0, 2, 0, 2, 1.5, 1, 1.5]]);
  });

  it("sol do lado de dentro: nenhum retângulo", () => {
    const room = [0, 0, 4, 0, 4, 4, 0, 4];
    assert.deepEqual(windowSunPatches([{ x1: 1, y1: 0, x2: 2, y2: 0, seeThrough: false }], [room], { x: 0, y: -1 }, 1.5), []);
  });

  it("janela sem cômodo de um lado só (sem cômodo, ou entre dois cômodos): nenhum retângulo", () => {
    const window: Segment = { x1: 1, y1: 0, x2: 2, y2: 0, seeThrough: false };
    assert.deepEqual(windowSunPatches([window], [], { x: 0, y: 1 }, 1.5), []);
    const north = [0, -4, 4, -4, 4, 0, 0, 0];
    const south = [0, 0, 4, 0, 4, 4, 0, 4];
    assert.deepEqual(windowSunPatches([window], [north, south], { x: 0, y: 1 }, 1.5), []);
  });
});
