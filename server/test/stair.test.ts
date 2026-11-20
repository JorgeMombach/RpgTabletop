import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  paintRelief,
  reliefSampler,
  stairAt,
  stairLoose,
  stairPath,
  stairPointAt,
  stairProfile,
  stairSizeProblem,
  type LightPoint,
  type ReliefChunks,
  type Stair,
  type StairSegment,
} from "@rpg/shared";

// Escadas (docs/design/escadas.md): o caminho com as viradas arredondadas, o perfil que segue o chão e o clique.
const points = (...list: [number, number][]): LightPoint[] => list.map(([x, y]) => ({ x, y }));
const near = (actual: number, expected: number, tolerance: number, message?: string) =>
  assert.ok(Math.abs(actual - expected) <= tolerance, `${message ?? ""} ${actual} ≠ ${expected} (± ${tolerance})`);
const finite = (path: ReturnType<typeof stairPath>) => {
  assert.ok(Number.isFinite(path.length), "comprimento finito");
  for (let u = 0; u <= path.length; u += path.length / 20 || 1) {
    const point = stairPointAt(path, u);
    assert.ok(Number.isFinite(point.x) && Number.isFinite(point.y), `ponto em u = ${u}`);
  }
};
const flights = (segments: StairSegment[]) => segments.filter((segment) => segment.steps > 0);
const stair = (id: string, shape: Stair["shape"], list: [number, number][], width: Stair["width"] = 1): Stair => ({
  id,
  shape,
  points: points(...list),
  width,
  material: "stone",
  exit: "up",
});

describe("escada: caminho", () => {
  it("reta: um trecho, comprimento 4", () => {
    const path = stairPath(points([0, 0], [4, 0]));
    assert.equal(path.prims.length, 1);
    assert.equal(path.prims[0].kind, "line");
    near(path.length, 4, 1e-9);
  });

  it("virada de 90°: reta, arco de raio 0,9 girando π/2, reta", () => {
    const path = stairPath(points([0, 0], [4, 0], [4, 4]));
    assert.deepEqual(
      path.prims.map((prim) => prim.kind),
      ["line", "arc", "line"],
    );
    const arc = path.prims[1];
    assert.ok(arc.kind === "arc");
    near(arc.radius, 0.9, 1e-9);
    near(Math.abs(arc.sweep), Math.PI / 2, 1e-9);
    near(path.length, 8 - 2 * 0.9 + (0.9 * Math.PI) / 2, 1e-9);
    const middle = stairPointAt(path, arc.start + (0.9 * Math.PI) / 4);
    near(Math.hypot(middle.x - arc.center.x, middle.y - arc.center.y), 0.9, 1e-9, "meio do arco a 0,9 do centro");
    near(arc.center.x, 3.1, 1e-9);
    near(arc.center.y, 0.9, 1e-9);
  });

  it("trechos curtos: o raio é cortado para caber (45% do trecho)", () => {
    const path = stairPath(points([0, 0], [1, 0], [1, 1]));
    const arc = path.prims.find((prim) => prim.kind === "arc");
    assert.ok(arc && arc.kind === "arc");
    near(arc.radius, 0.45, 1e-9);
  });

  it("pontos repetidos são ignorados", () => {
    const path = stairPath(points([0, 0], [0, 0], [3, 0]));
    near(path.length, 3, 1e-9);
    finite(path);
  });

  it("virada de 180°: sem NaN, comprimento finito", () => {
    const path = stairPath(points([0, 0], [3, 0], [0, 0]));
    finite(path);
    near(path.length, 6, 1e-6);
  });

  it("todos os pontos no mesmo lugar: comprimento 0 e o ponto é o próprio lugar", () => {
    const path = stairPath(points([2, 3], [2, 3]));
    assert.equal(path.length, 0);
    assert.deepEqual(stairPointAt(path, 0), { x: 2, y: 3 });
  });
});

describe("escada: perfil", () => {
  // chão subindo 1 nível entre x = 4 e x = 5,15 (rampa linear)
  const ramp = (x: number) => Math.min(1, Math.max(0, (x - 4) / 1.15));

  it("subida: um lance de 10 degraus com pelo menos 2,2 casas, centrado na subida, e patamares nos dois lados", () => {
    const segments = stairProfile(stairPath(points([0, 0], [10, 0])), (x) => ramp(x), "up");
    const [flight] = flights(segments);
    assert.equal(flights(segments).length, 1);
    assert.equal(flight.steps, 10);
    assert.ok(flight.to - flight.from >= 2.2 - 1e-9, `lance de ${flight.to - flight.from} casas`);
    near((flight.from + flight.to) / 2, 4.6, 0.1, "centro do lance");
    near(flight.fromLevel, 0, 1e-6);
    near(flight.toLevel, 1, 1e-6);
    const first = segments[0];
    const last = segments[segments.length - 1];
    assert.equal(first.steps, 0);
    assert.equal(last.steps, 0);
    near(first.fromLevel, 0, 1e-6);
    near(last.toLevel, 1, 1e-6);
    near(first.from, 0, 1e-9);
    near(last.to, 10, 1e-9);
  });

  it("os trechos cobrem o caminho sem buraco nem sobreposição", () => {
    const segments = stairProfile(stairPath(points([0, 0], [10, 0])), (x) => ramp(x), "up");
    for (let index = 1; index < segments.length; index++) near(segments[index].from, segments[index - 1].to, 1e-9);
    for (const segment of segments) assert.ok(segment.to > segment.from);
  });

  it("desenhada de cima para baixo: um lance de 1 para 0", () => {
    const [flight, ...rest] = flights(stairProfile(stairPath(points([10, 0], [0, 0])), (x) => ramp(x), "up"));
    assert.equal(rest.length, 0);
    near(flight.fromLevel, 1, 1e-6);
    near(flight.toLevel, 0, 1e-6);
    assert.equal(flight.steps, 10);
  });

  it("vale: desce e sobe", () => {
    // chão 0, desce a −1 entre x = 3 e 4,15, fundo plano, volta a 0 entre x = 7 e 8,15
    const valley = (x: number) => -Math.min(1, Math.max(0, (x - 3) / 1.15)) + Math.min(1, Math.max(0, (x - 7) / 1.15));
    const list = flights(stairProfile(stairPath(points([0, 0], [11, 0])), (x) => valley(x), "up"));
    assert.equal(list.length, 2);
    near(list[0].fromLevel, 0, 1e-6);
    near(list[0].toLevel, -1, 1e-6);
    near(list[1].fromLevel, -1, 1e-6);
    near(list[1].toLevel, 0, 1e-6);
  });

  it("vale em V (sem fundo plano): desce e sobe, não vira um lance só", () => {
    const valley = (x: number) => -Math.max(0, 1 - Math.abs(x - 5) / 1.15);
    const list = flights(stairProfile(stairPath(points([0, 0], [10, 0])), (x) => valley(x), "up"));
    assert.equal(list.length, 2);
    assert.ok(list[0].toLevel < list[0].fromLevel, "primeiro desce");
    assert.ok(list[1].toLevel > list[1].fromLevel, "depois sobe");
  });

  it("chão plano: solta; sobe de 0 a 1 ou desce de 0 a −1, degraus de ~0,4 casa (mínimo 2)", () => {
    const path = stairPath(points([0, 0], [3, 0]));
    const flat = () => 0;
    assert.equal(stairLoose(path, flat), true);
    const up = stairProfile(path, flat, "up");
    assert.equal(up.length, 1);
    assert.deepEqual(up[0], { from: 0, to: 3, fromLevel: 0, toLevel: 1, steps: 8 });
    const down = stairProfile(path, flat, "down");
    assert.deepEqual(down[0], { from: 0, to: 3, fromLevel: 0, toLevel: -1, steps: 8 });
    const short = stairProfile(stairPath(points([0, 0], [0.5, 0])), flat, "up");
    assert.equal(short[0].steps, 2);
  });

  it("variação de 0,2 nível: solta; de 0,3: segue o relevo", () => {
    const path = stairPath(points([0, 0], [10, 0]));
    assert.equal(stairLoose(path, (x) => ramp(x) * 0.2), true);
    assert.equal(stairLoose(path, (x) => ramp(x) * 0.3), false);
    const following = flights(stairProfile(path, (x) => ramp(x) * 0.3, "up"));
    assert.equal(following.length, 1);
    assert.equal(following[0].steps, 3);
    near(following[0].toLevel, 0.3, 1e-6);
  });

  it("chão com NaN não quebra o perfil", () => {
    const segments = stairProfile(stairPath(points([0, 0], [4, 0])), () => Number.NaN, "up");
    for (const segment of segments) assert.ok(Number.isFinite(segment.fromLevel) && Number.isFinite(segment.toLevel));
  });

  it("caminho de comprimento 0: nenhum trecho", () => {
    assert.deepEqual(stairProfile(stairPath(points([1, 1], [1, 1])), () => 0, "up"), []);
  });
});

describe("escada: sob o ponteiro", () => {
  it("escada com caminho: no meio e na beirada; fora da meia largura, nenhuma", () => {
    const list = [stair("a", "path", [[0, 0], [4, 0], [4, 4]], 2)];
    assert.equal(stairAt(list, { x: 2, y: 0 })?.id, "a");
    assert.equal(stairAt(list, { x: 2, y: 0.95 })?.id, "a", "beirada (meia largura = 1)");
    assert.equal(stairAt(list, { x: 4.9, y: 2 })?.id, "a", "beirada do segundo trecho");
    assert.equal(stairAt(list, { x: 2, y: 1.1 }), null);
    assert.equal(stairAt(list, { x: -0.5, y: 0 }), null, "antes do pé");
  });

  it("caracol pelo círculo (largura = diâmetro) e de mão pelo retângulo de 0,5", () => {
    const spiral = stair("c", "spiral", [[10, 10], [11, 10]], 2);
    const ladder = stair("m", "ladder", [[20, 0], [20, 3]]);
    assert.equal(stairAt([spiral], { x: 10.9, y: 10.2 })?.id, "c");
    assert.equal(stairAt([spiral], { x: 11.1, y: 10.2 }), null);
    assert.equal(stairAt([ladder], { x: 20.2, y: 1.5 })?.id, "m");
    assert.equal(stairAt([ladder], { x: 20.3, y: 1.5 }), null);
    assert.equal(stairAt([ladder], { x: 20, y: 3.2 }), null);
  });

  it("onde duas se cruzam, vale a de cima", () => {
    const list = [stair("baixo", "path", [[0, 2], [6, 2]]), stair("cima", "path", [[3, 0], [3, 5]])];
    assert.equal(stairAt(list, { x: 3, y: 2 })?.id, "cima");
  });

  it("formatos diferentes: vale o que o desenho põe por cima (caminho, depois caracol, depois de mão)", () => {
    const ladder = stair("mao", "ladder", [[3, 0], [3, 4]]);
    const path = stair("caminho", "path", [[0, 2], [6, 2]]);
    assert.equal(stairAt([ladder, path], { x: 3, y: 2 })?.id, "mao");
  });
});

describe("relevo: altura em qualquer ponto", () => {
  it("sem relevo, 0", () => {
    assert.equal(reliefSampler({})(5.3, 7.1), 0);
  });

  it("com um patamar de nível 1 pintado: 1 no meio e 0 longe", () => {
    const chunks: ReliefChunks = {};
    paintRelief(chunks, { level: 1, soft: false, radius: 2.5, points: [20, 20] });
    const sample = reliefSampler(chunks);
    near(sample(20, 20), 1, 1e-6);
    assert.equal(sample(60, 60), 0);
    assert.equal(sample(-40, 3), 0);
  });
});

describe("escada: tamanho para o servidor", () => {
  it("curta, longa ou boa, por formato", () => {
    assert.equal(stairSizeProblem("path", points([0, 0], [0.5, 0])), "short");
    assert.equal(stairSizeProblem("path", points([0, 0], [41, 0])), "long");
    assert.equal(stairSizeProblem("path", points([0, 0], [3, 0], [3, 3])), null);
    assert.equal(stairSizeProblem("path", points([0, 0])), "short");
    assert.equal(stairSizeProblem("ladder", points([0, 0], [0, 0.5])), "short");
    assert.equal(stairSizeProblem("ladder", points([0, 0], [0, 5])), "long");
    assert.equal(stairSizeProblem("ladder", points([0, 0], [0, 4])), null);
    assert.equal(stairSizeProblem("spiral", points([2, 2], [2, 2])), "short");
    assert.equal(stairSizeProblem("spiral", points([2, 2], [3, 2])), null);
  });
});
