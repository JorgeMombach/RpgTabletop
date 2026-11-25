import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { encodeLayer, terrainAt, type ActionResult, type TerrainBroadcast, type TerrainChunks, type TerrainStroke } from "@rpg/shared";
import { act, join, nextState, useServer, type Client } from "./helpers";

// Terreno pintado no servidor: só o mestre pinta, os pedaços vão por evento próprio e vão no arquivo de sessão.
const { ctx, client } = useServer();
const battle = () => ctx.server.store.game.battle;
const paint: TerrainStroke = { terrain: "grass", radius: 1, strength: 1, points: [4, 4] };

function idsOf(res: ActionResult): string[] {
  assert.ok(res.ok, res.ok ? "" : res.error);
  return res.ids ?? [];
}

function errorOf(res: ActionResult): string {
  assert.equal(res.ok, false, "deveria recusar");
  return res.ok ? "" : res.error;
}

async function gm(): Promise<Client> {
  const socket = await client();
  await join(socket, "Mestre");
  return socket;
}

function nextTerrain(socket: Client): Promise<TerrainBroadcast> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error("o terreno não chegou")), 2000);
    socket.once("terrain", (payload: TerrainBroadcast) => {
      clearTimeout(timer);
      resolve(payload);
    });
  });
}

let ipSeq = 1;
async function player(name: string): Promise<{ socket: Client; first: Promise<TerrainBroadcast> }> {
  const socket = await client(`10.51.0.${ipSeq++}`);
  const first = nextTerrain(socket);
  await join(socket, name);
  return { socket, first };
}

const layer = (value: number) => encodeLayer(new Uint8Array(1024).fill(value));

describe("terreno: servidor", () => {
  it("neve e terra batida: o mestre pinta e o terreno guarda como os outros", async () => {
    const gm = await client();
    await join(gm, "Mestre");
    await act(gm, "battle:clear", { keepTemplates: false });
    for (const terrain of ["snow", "packedEarth"] as const) {
      const at = terrain === "snow" ? 4 : 12;
      const res = await act(gm, "terrain:paint", { terrain, radius: 1, strength: 1, points: [at, 4] });
      assert.ok(res.ok, res.ok ? "" : res.error);
      assert.ok((terrainAt(battle().terrain ?? {}, at, 4)[terrain] ?? 0) > 200, terrain);
    }
  });

  it("só o mestre pinta", async () => {
    const g = await gm();
    await act(g, "terrain:clear", {});
    const { socket: ana } = await player("Ana");
    assert.match(errorOf(await act(ana, "terrain:paint", paint)), /permissão/i);
    assert.ok((await act(g, "terrain:paint", paint)).ok);
    assert.ok(battle().terrain?.["0,0"]?.grass);
    ana.disconnect();
  });

  it("passada inválida recusada inteira", async () => {
    const g = await gm();
    await act(g, "terrain:clear", {});
    await act(g, "terrain:paint", paint);
    const before = structuredClone(battle().terrain);
    const bad: TerrainStroke[] = [
      { ...paint, terrain: "lava" as TerrainStroke["terrain"] },
      { ...paint, radius: 7 },
      { ...paint, strength: 0 },
      { ...paint, points: Array.from({ length: 4002 }, () => 4) },
      { ...paint, points: [4, Number.NaN] },
      { ...paint, points: [4] },
      // retângulo: cantos inválidos, lado grande demais (a conta não pode travar o servidor)
      { ...paint, points: [], rect: { from: { x: 0, y: 0 }, to: { x: Number.NaN, y: 2 } } },
      { ...paint, points: [], rect: { from: { x: 0, y: 0 }, to: { x: 500, y: 2 } } },
      { ...paint, points: [], rect: { from: { x: 0, y: 0 } } as unknown as TerrainStroke["rect"] },
    ];
    for (const stroke of bad) assert.equal((await act(g, "terrain:paint", stroke)).ok, false, JSON.stringify(stroke).slice(0, 80));
    assert.deepEqual(battle().terrain, before);
  });

  it("retângulo: o mestre pinta de canto a canto, sem pontos de pincel", async () => {
    const g = await gm();
    await act(g, "terrain:clear", {});
    assert.ok((await act(g, "terrain:paint", { ...paint, terrain: "sand", points: [], rect: { from: { x: 1, y: 1 }, to: { x: 3, y: 2 } } })).ok);
    assert.ok(battle().terrain?.["0,0"]?.sand);
  });

  it("limite de pedaços", async () => {
    const g = await gm();
    await act(g, "terrain:clear", {});
    const full: TerrainChunks = {};
    for (let i = 0; i < 400; i++) full[`${i % 20},${Math.floor(i / 20)}`] = { grass: layer(9) };
    battle().terrain = full;
    errorOf(await act(g, "terrain:paint", { ...paint, points: [-20, -20] }));
    assert.equal(Object.keys(battle().terrain ?? {}).length, 400);
    await act(g, "terrain:clear", {});
  });

  it("jogador recebe os pedaços que mudaram e quem entra recebe tudo", async () => {
    const g = await gm();
    await act(g, "terrain:clear", {});
    const { socket: ana, first } = await player("Ana");
    assert.deepEqual(await first, { reset: true, chunks: {} });
    const arrived = nextTerrain(ana);
    await act(g, "terrain:paint", { ...paint, points: [6, 4, 10, 4] });
    const update = await arrived;
    assert.equal(update.reset, false);
    assert.deepEqual(new Set(Object.keys(update.chunks)), new Set(["0,0", "1,0"]));
    const bia = await client("10.51.0.90");
    const biaFirst = nextTerrain(bia);
    const biaState = nextState(bia);
    await join(bia, "Bia");
    const all = await biaFirst;
    assert.equal(all.reset, true);
    assert.deepEqual(new Set(Object.keys(all.chunks)), new Set(["0,0", "1,0"]));
    assert.equal("terrain" in (await biaState).battle, false, "o estado não leva o terreno");
    ana.disconnect();
    bia.disconnect();
  });

  it("trocar de cena troca o terreno", async () => {
    const g = await gm();
    await act(g, "terrain:clear", {});
    await act(g, "terrain:paint", paint);
    const sceneA = ctx.server.store.game.sceneId;
    idsOf(await act(g, "scene:add", { name: "Floresta" }));
    const sceneB = ctx.server.store.game.scenes.find((scene) => scene.id !== sceneA)!.id;
    const { socket: ana, first } = await player("Ana");
    await first;
    let arrived = nextTerrain(ana);
    assert.ok((await act(g, "scene:switch", { id: sceneB })).ok);
    assert.deepEqual(await arrived, { reset: true, chunks: {} });
    arrived = nextTerrain(ana);
    assert.ok((await act(g, "scene:switch", { id: sceneA })).ok);
    const back = await arrived;
    assert.equal(back.reset, true);
    assert.deepEqual(Object.keys(back.chunks), ["0,0"]);
    ana.disconnect();
  });

  it("restaurar e limpar", async () => {
    const g = await gm();
    await act(g, "terrain:clear", {});
    await act(g, "terrain:paint", paint);
    const saved = structuredClone(battle().terrain!["0,0"]);
    await act(g, "terrain:paint", { ...paint, terrain: "water", points: [12, 4] });
    assert.ok((await act(g, "terrain:restore", { chunks: { "0,0": null, "1,0": saved } })).ok);
    assert.deepEqual(Object.keys(battle().terrain ?? {}), ["1,0"]);
    const broken = { "0,0": { grass: "não é base64" }, "1,0": null };
    assert.equal((await act(g, "terrain:restore", { chunks: broken })).ok, false);
    assert.deepEqual(Object.keys(battle().terrain ?? {}), ["1,0"], "recusado inteiro");
    assert.ok((await act(g, "terrain:clear", {})).ok);
    assert.equal(battle().terrain, undefined);
    await act(g, "terrain:paint", paint);
    await act(g, "battle:clear", { keepTemplates: true });
    assert.equal(battle().terrain, undefined, "limpar campo apaga o terreno");
  });

  it("trocar o grid não apaga o terreno; arquivo de sessão", async () => {
    const g = await gm();
    await act(g, "terrain:clear", {});
    await act(g, "terrain:paint", paint);
    await act(g, "battle:grid", { grid: "hexRows" });
    assert.ok(battle().terrain?.["0,0"]);
    await act(g, "battle:grid", { grid: "square" });
    const exported = await g.timeout(2000).emitWithAck("session:export");
    assert.ok(exported.ok, exported.ok ? "" : exported.error);
    const file = exported.file;
    await act(g, "terrain:clear", {});
    assert.ok((await g.timeout(2000).emitWithAck("session:import", file)).ok);
    assert.ok(battle().terrain?.["0,0"]?.grass, "volta do arquivo");
    const { terrain: _removed, ...oldBattle } = file.game.battle;
    assert.ok((await g.timeout(2000).emitWithAck("session:import", { ...file, game: { ...file.game, battle: oldBattle } })).ok);
    assert.equal(battle().terrain, undefined, "arquivo antigo abre sem terreno");
    const withTerrain = (terrain: unknown) => ({ ...file, game: { ...file.game, battle: { ...file.game.battle, terrain } } });
    const tooMany: TerrainChunks = {};
    for (let i = 0; i < 401; i++) tooMany[`${i},0`] = { grass: layer(1) };
    const broken = [
      { "0,0": { grass: "não é base64" } },
      { "0,0": { grass: encodeLayer(new Uint8Array(1023)) } },
      { "0,0": { lava: layer(1) } },
      { "a,b": { grass: layer(1) } },
      tooMany,
    ];
    for (const terrain of broken) assert.equal((await g.timeout(2000).emitWithAck("session:import", withTerrain(terrain))).ok, false);
  });
});
