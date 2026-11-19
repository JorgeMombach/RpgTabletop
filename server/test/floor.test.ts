import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { act, join, nextState, useServer, type Client } from "./helpers";
import {
  decodeFloorPoint,
  encodeFloorPoint,
  floorAt,
  floorCarpetBoxes,
  paintFloor,
  validFloorByte,
  encodeLayer,
  type FloorBroadcast,
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

const { ctx, client } = useServer();
const battle = () => ctx.server.store.game.battle;

async function gm(): Promise<Client> {
  const socket = await client();
  await join(socket, "Mestre");
  return socket;
}

function nextFloors(socket: Client): Promise<FloorBroadcast> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(
      () => reject(new Error("o piso não chegou")),
      2000,
    );
    socket.once("floors", (payload: FloorBroadcast) => {
      clearTimeout(timer);
      resolve(payload);
    });
  });
}

const rect = (
  material: FloorStroke["material"],
  x0: number,
  y0: number,
  x1: number,
  y1: number,
): FloorStroke => ({
  material,
  vertical: false,
  shape: { kind: "rect", from: { x: x0, y: y0 }, to: { x: x1, y: y1 } },
});

describe("piso: tapetes", () => {
  it("cada tapete vira uma caixa (em casas), para o medalhão no meio", () => {
    const chunks: FloorChunks = {};
    paintFloor(chunks, { material: "carpet", vertical: false, shape: { kind: "rect", from: { x: 1, y: 1 }, to: { x: 4, y: 3 } } }, [], "stone");
    paintFloor(chunks, { material: "carpet", vertical: false, shape: { kind: "rect", from: { x: 10, y: 2 }, to: { x: 12, y: 6 } } }, [], "stone");
    paintFloor(chunks, { material: "flagstone", vertical: false, shape: { kind: "rect", from: { x: 0, y: 0 }, to: { x: 0.5, y: 0.5 } } }, [], "stone");
    const boxes = floorCarpetBoxes(chunks).sort((one, other) => one.x0 - other.x0);
    assert.deepEqual(boxes, [
      { x0: 0.875, y0: 0.875, x1: 4.125, y1: 3.125 },
      { x0: 9.875, y0: 1.875, x1: 12.125, y1: 6.125 },
    ]);
  });
});

describe("piso: servidor", () => {
  it("só o mestre pinta piso; entrada quebrada é recusada inteira", async () => {
    const g = await gm();
    await act(g, "floor:clear", {});
    await act(g, "wall:clear", {});
    const ana = await client("10.53.0.1");
    await join(ana, "Ana");
    const refused = await act(ana, "floor:paint", brush("plank", 4, 4));
    assert.equal(refused.ok, false);
    if (!refused.ok) assert.match(refused.error, /permissão/i);
    assert.ok((await act(g, "floor:paint", brush("plank", 4, 4))).ok);
    const before = structuredClone(battle().floors);
    const bad: unknown[] = [
      {
        material: "lava",
        vertical: false,
        shape: { kind: "brush", radius: 1, points: [4, 4] },
      },
      {
        material: "plank",
        vertical: false,
        shape: { kind: "brush", radius: 99, points: [4, 4] },
      },
      {
        material: "plank",
        vertical: false,
        shape: {
          kind: "rect",
          from: { x: Number.NaN, y: 0 },
          to: { x: 2, y: 2 },
        },
      },
      {
        material: "plank",
        vertical: "sim",
        shape: { kind: "brush", radius: 1, points: [4, 4] },
      },
      { material: "plank", vertical: false, shape: { kind: "triângulo" } },
    ];
    for (const payload of bad) {
      const res = await g.timeout(2000).emitWithAck("floor:paint", payload);
      assert.equal(res.ok, false, JSON.stringify(payload).slice(0, 60));
    }
    assert.deepEqual(battle().floors, before);
    ana.disconnect();
  });

  it("cômodo aberto: recusa com a mensagem", async () => {
    const g = await gm();
    await act(g, "floor:clear", {});
    await act(g, "wall:clear", {});
    const res = await act(g, "floor:paint", room("plank", 2, 2));
    assert.equal(res.ok, false);
    if (!res.ok) assert.match(res.error, /lugar fechado/);
  });

  it("cômodo pelas paredes da cena", async () => {
    const g = await gm();
    await act(g, "floor:clear", {});
    await act(g, "wall:clear", {});
    for (const [from, to] of [
      [
        [0, 0],
        [4, 0],
      ],
      [
        [4, 0],
        [4, 3],
      ],
      [
        [4, 3],
        [0, 3],
      ],
      [
        [0, 3],
        [0, 0],
      ],
    ]) {
      assert.ok(
        (
          await act(g, "wall:add", {
            from: { col: from[0], row: from[1] },
            to: { col: to[0], row: to[1] },
          })
        ).ok,
      );
    }
    assert.ok((await act(g, "floor:paint", room("tile", 2, 1.5))).ok);
    assert.equal(floorAt(battle().floors ?? {}, 8, 6).material, "tile");
  });

  it("restaurar volta vários pedaços de uma vez", async () => {
    const g = await gm();
    await act(g, "floor:clear", {});
    assert.ok(
      (await act(g, "floor:paint", rect("flagstone", 0, 0, 20, 20))).ok,
    );
    const keys = Object.keys(battle().floors ?? {});
    assert.ok(keys.length >= 9, `pedaços: ${keys.length}`);
    assert.ok(
      (
        await act(g, "floor:restore", {
          chunks: Object.fromEntries(keys.map((key) => [key, null])),
        })
      ).ok,
    );
    assert.equal(battle().floors, undefined);
    assert.equal(
      (await act(g, "floor:restore", { chunks: { "0,0": "não é base64" } })).ok,
      false,
    );
  });

  it("jogador recebe só os pedaços que mudaram; quem entra recebe tudo; o estado não leva o piso", async () => {
    const g = await gm();
    await act(g, "floor:clear", {});
    const ana = await client("10.53.0.2");
    const first = nextFloors(ana);
    await join(ana, "Ana");
    assert.deepEqual(await first, { reset: true, chunks: {} });
    const arrived = nextFloors(ana);
    await act(g, "floor:paint", brush("plank", 7.8, 4, 0.5));
    const update = await arrived;
    assert.equal(update.reset, false);
    assert.deepEqual(
      new Set(Object.keys(update.chunks)),
      new Set(["0,0", "1,0"]),
    );
    const bia = await client("10.53.0.3");
    const biaFirst = nextFloors(bia);
    const biaState = nextState(bia);
    await join(bia, "Bia");
    assert.deepEqual(
      new Set(Object.keys((await biaFirst).chunks)),
      new Set(["0,0", "1,0"]),
    );
    assert.equal("floors" in (await biaState).battle, false);
    ana.disconnect();
    bia.disconnect();
  });

  it("trocar o grid apaga o piso", async () => {
    const g = await gm();
    await act(g, "floor:paint", brush("plank", 4, 4));
    assert.ok(battle().floors);
    assert.ok((await act(g, "battle:grid", { grid: "hexRows" })).ok);
    assert.equal(battle().floors, undefined);
    assert.ok((await act(g, "battle:grid", { grid: "square" })).ok);
  });

  it("piso vai e volta com a cena e com o arquivo de sessão; arquivo sem piso abre sem campo; Limpar campo apaga", async () => {
    const g = await gm();
    await act(g, "floor:clear", {});
    await act(g, "floor:paint", brush("carpet", 4, 4));
    const sceneA = ctx.server.store.game.sceneId;
    assert.ok((await act(g, "scene:add", { name: "Taverna" })).ok);
    const sceneB = ctx.server.store.game.scenes.find(
      (scene) => scene.id !== sceneA,
    )?.id;
    assert.ok(sceneB);
    assert.ok((await act(g, "scene:switch", { id: sceneB })).ok);
    assert.equal(battle().floors, undefined);
    assert.ok((await act(g, "scene:switch", { id: sceneA })).ok);
    assert.equal(floorAt(battle().floors ?? {}, 16, 16).material, "carpet");
    const exported = await g.timeout(2000).emitWithAck("session:export");
    assert.ok(exported.ok);
    await act(g, "floor:clear", {});
    assert.ok(
      (await g.timeout(2000).emitWithAck("session:import", exported.file)).ok,
    );
    assert.equal(
      floorAt(battle().floors ?? {}, 16, 16).material,
      "carpet",
      "volta do arquivo",
    );
    const withFloors = (floors: unknown) => ({
      ...exported.file,
      game: {
        ...exported.file.game,
        battle: { ...exported.file.game.battle, floors },
      },
    });
    for (const floors of [
      { "0,0": "não é base64" },
      { "0,0": encodeLayer(new Uint8Array(1024).fill(32)) },
      { "a,b": encodeLayer(new Uint8Array(1024).fill(1)) },
    ]) {
      assert.equal(
        (
          await g
            .timeout(2000)
            .emitWithAck("session:import", withFloors(floors))
        ).ok,
        false,
        JSON.stringify(floors).slice(0, 40),
      );
    }
    const { floors: _dropped, ...withoutFloors } = exported.file.game.battle;
    assert.ok(
      (
        await g
          .timeout(2000)
          .emitWithAck("session:import", {
            ...exported.file,
            game: { ...exported.file.game, battle: withoutFloors },
          })
      ).ok,
    );
    assert.equal(battle().floors, undefined, "arquivo antigo, sem piso");
    await act(g, "floor:paint", brush("carpet", 4, 4));
    await act(g, "battle:clear", { keepTemplates: true });
    assert.equal(battle().floors, undefined);
  });
});
