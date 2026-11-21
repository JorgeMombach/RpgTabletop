import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { encodeLayer, isChunkKey, LIMITS, type ActionResult } from "@rpg/shared";
import { parseFloorChunks } from "../src/actions/floor";
import { parseReliefChunks } from "../src/actions/relief";
import { parseTerrainChunks } from "../src/actions/terrain";
import { act, join, useServer, type Client } from "./helpers";

// Pedaços de 8 × 8 casas (terreno, relevo e piso) vindos de fora: chaves canônicas, limite da cena e pincel forjado.
const { ctx, client } = useServer();
const battle = () => ctx.server.store.game.battle;

function errorOf(res: ActionResult): string {
  assert.equal(res.ok, false, "deveria recusar");
  return res.ok ? "" : res.error;
}

async function gm(): Promise<Client> {
  const g = await client();
  await join(g, "Mestre");
  return g;
}

const grass = encodeLayer(new Uint8Array(1024).fill(200));
/** Nível 1 (escarpa) em todos os pontos. */
const reliefChunk = encodeLayer(new Uint8Array(1024).fill(3));
/** Tábua em todos os pontos. */
const floorChunk = encodeLayer(new Uint8Array(1024).fill(1));

describe("pedaços: chave canônica", () => {
  it("só `cx,cy` sem zero à esquerda nem -0", () => {
    for (const key of ["0,0", "-1,2", "12,-305", "9999,-9999"]) assert.equal(isChunkKey(key), true, key);
    for (const key of ["01,0", "-0,0", "0,-0", "00,1", "1, 2", "1,2,3", "+1,2", "10000,0", "", "a,b"]) assert.equal(isChunkKey(key), false, key);
  });

  it("restaurar com chave não canônica é recusado (terreno, relevo e piso)", async () => {
    const g = await gm();
    assert.match(errorOf(await act(g, "terrain:restore", { chunks: { "01,0": { grass } } })), /Terreno inválido/);
    assert.match(errorOf(await act(g, "relief:restore", { chunks: { "-0,0": reliefChunk } })), /Relevo inválido/);
    assert.match(errorOf(await act(g, "floor:restore", { chunks: { "0,-0": floorChunk } })), /Piso inválido/);
    assert.equal(battle().terrain, undefined);
    assert.ok((await act(g, "terrain:restore", { chunks: { "0,0": { grass } } })).ok);
    assert.deepEqual(Object.keys(battle().terrain ?? {}), ["0,0"]);
  });

  it("arquivo de sessão com chave não canônica é recusado", () => {
    assert.throws(() => parseTerrainChunks({ "01,0": { grass } }), /Terreno inválido/);
    assert.throws(() => parseReliefChunks({ "-0,1": reliefChunk }), /Relevo inválido/);
    assert.throws(() => parseFloorChunks({ "1,00": floorChunk }), /Piso inválido/);
  });
});

describe("pedaços: limite no arquivo de sessão", () => {
  const many = <T>(value: T) => Object.fromEntries(Array.from({ length: LIMITS.terrainChunks + 1 }, (_, index) => [`${index},0`, value]));

  it("pedaços demais no arquivo: a mensagem fala do arquivo, não de pintar", () => {
    assert.throws(() => parseTerrainChunks(many({ grass })), (error: Error) => /arquivo/i.test(error.message) && !/pintar/.test(error.message));
    assert.throws(() => parseReliefChunks(many(reliefChunk)), (error: Error) => /arquivo/i.test(error.message) && !/pintar/.test(error.message));
    assert.throws(() => parseFloorChunks(many(floorChunk)), (error: Error) => /arquivo/i.test(error.message) && !/pintar/.test(error.message));
  });
});

describe("piso: retângulo gigante forjado", () => {
  it("pintar um retângulo maior que o limite de pedaços é recusado na hora, sem varrer a caixa", async () => {
    const g = await gm();
    const started = performance.now();
    const res = await act(g, "floor:paint", { material: "plank", vertical: false, shape: { kind: "rect", from: { x: 0, y: 0 }, to: { x: 9000, y: 9000 } } });
    assert.match(errorOf(res), /Limite de piso/);
    assert.ok(performance.now() - started < 500, `levou ${Math.round(performance.now() - started)} ms`);
    assert.equal(battle().floors, undefined);
  });

  it("apagar num retângulo gigante passa só pelos pedaços com piso", async () => {
    const g = await gm();
    assert.ok((await act(g, "floor:paint", { material: "plank", vertical: false, shape: { kind: "rect", from: { x: 1, y: 1 }, to: { x: 3, y: 3 } } })).ok);
    const started = performance.now();
    assert.ok((await act(g, "floor:paint", { material: "erase", vertical: false, shape: { kind: "rect", from: { x: -9000, y: -9000 }, to: { x: 9000, y: 9000 } } })).ok);
    assert.ok(performance.now() - started < 500, `levou ${Math.round(performance.now() - started)} ms`);
    assert.equal(battle().floors, undefined);
  });
});
