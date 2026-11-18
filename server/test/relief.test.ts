import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { distanceField, encodeLayer, paintRelief, reliefAffected, reliefAt, reliefHeights, RELIEF_MARGIN, RELIEF_PER_CELL, type ActionResult, type ReliefBroadcast, type ReliefChunks, type ReliefStroke } from "@rpg/shared";
import { act, join, nextState, useServer, type Client } from "./helpers";

// Relevo (docs/design/relevo.md): níveis de −2 a +3 e tipo de borda (escarpa ou suave) na grade fina do terreno.
const stroke = (level: number, soft = false, points = [4, 4], radius = 1): ReliefStroke => ({ level, soft, radius, points });

describe("relevo: contas do pincel", () => {
  it("pintar nível 2 escarpa num raio de 1 casa marca os pontos de dentro, não os de fora", () => {
    const chunks: ReliefChunks = {};
    const changed = paintRelief(chunks, stroke(2));
    assert.deepEqual(changed, ["0,0"]);
    assert.deepEqual(reliefAt(chunks, 16, 16), { level: 2, soft: false });
    assert.deepEqual(reliefAt(chunks, 16 + 3, 16), { level: 2, soft: false }, "0,75 casa do centro");
    assert.deepEqual(reliefAt(chunks, 16 + 5, 16), { level: 0, soft: false }, "1,25 casa do centro");
  });

  it("suave fica guardado; nível negativo também", () => {
    const chunks: ReliefChunks = {};
    paintRelief(chunks, stroke(1, true));
    assert.deepEqual(reliefAt(chunks, 16, 16), { level: 1, soft: true });
    paintRelief(chunks, stroke(-2, false, [12, 4]));
    assert.deepEqual(reliefAt(chunks, 48, 16), { level: -2, soft: false });
  });

  it("aplainar (nível 0 escarpa) apaga o pedaço que ficou todo chão", () => {
    const chunks: ReliefChunks = {};
    paintRelief(chunks, stroke(2));
    paintRelief(chunks, stroke(0, false, [4, 4], 1.5));
    assert.deepEqual(chunks, {});
  });

  it("pedaço sem relevo é chão escarpa", () => {
    assert.deepEqual(reliefAt({}, -100, 40), { level: 0, soft: false });
  });
});

// ---------- servidor ----------
const { ctx, client } = useServer();
const battle = () => ctx.server.store.game.battle;

function errorOf(res: ActionResult): string {
  assert.equal(res.ok, false, "deveria recusar");
  return res.ok ? "" : res.error;
}

async function gm(): Promise<Client> {
  const socket = await client();
  await join(socket, "Mestre");
  return socket;
}

function nextRelief(socket: Client): Promise<ReliefBroadcast> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error("o relevo não chegou")), 2000);
    socket.once("relief", (payload: ReliefBroadcast) => {
      clearTimeout(timer);
      resolve(payload);
    });
  });
}

let ipSeq = 1;
async function player(name: string): Promise<{ socket: Client; first: Promise<ReliefBroadcast> }> {
  const socket = await client(`10.52.0.${ipSeq++}`);
  const first = nextRelief(socket);
  await join(socket, name);
  return { socket, first };
}

describe("relevo: servidor", () => {
  it("só o mestre pinta; nível fora de −2..3 ou quebrado é recusado inteiro", async () => {
    const g = await gm();
    await act(g, "relief:clear", {});
    const { socket: ana } = await player("Ana");
    assert.match(errorOf(await act(ana, "relief:paint", stroke(1))), /permissão/i);
    assert.ok((await act(g, "relief:paint", stroke(1))).ok);
    const before = structuredClone(battle().relief);
    for (const bad of [stroke(4), stroke(-3), stroke(1.5), { ...stroke(1), soft: "sim" }, { ...stroke(1), radius: 99 }, { ...stroke(1), points: [4] }]) {
      assert.equal((await act(g, "relief:paint", bad as ReliefStroke)).ok, false, JSON.stringify(bad).slice(0, 60));
    }
    assert.deepEqual(battle().relief, before);
    ana.disconnect();
  });

  it("jogador recebe só os pedaços que mudaram; quem entra recebe tudo; o estado não leva o relevo", async () => {
    const g = await gm();
    await act(g, "relief:clear", {});
    const { socket: ana, first } = await player("Ana");
    assert.deepEqual(await first, { reset: true, chunks: {} });
    const arrived = nextRelief(ana);
    await act(g, "relief:paint", stroke(1, false, [6, 4, 10, 4]));
    const update = await arrived;
    assert.equal(update.reset, false);
    assert.deepEqual(new Set(Object.keys(update.chunks)), new Set(["0,0", "1,0"]));
    const bia = await client("10.52.0.90");
    const biaFirst = nextRelief(bia);
    const biaState = nextState(bia);
    await join(bia, "Bia");
    assert.deepEqual(new Set(Object.keys((await biaFirst).chunks)), new Set(["0,0", "1,0"]));
    assert.equal("relief" in (await biaState).battle, false);
    ana.disconnect();
    bia.disconnect();
  });

  it("restaurar, trocar de cena, limpar campo e arquivo de sessão", async () => {
    const g = await gm();
    await act(g, "relief:clear", {});
    await act(g, "relief:paint", stroke(2));
    const saved = battle().relief?.["0,0"];
    assert.ok(saved);
    await act(g, "relief:paint", stroke(-1, true, [12, 4]));
    assert.ok((await act(g, "relief:restore", { chunks: { "0,0": null, "1,0": saved } })).ok);
    assert.deepEqual(Object.keys(battle().relief ?? {}), ["1,0"]);
    assert.equal((await act(g, "relief:restore", { chunks: { "0,0": "não é base64" } })).ok, false);
    // cena
    const sceneA = ctx.server.store.game.sceneId;
    assert.ok((await act(g, "scene:add", { name: "Deserto" })).ok);
    const sceneB = ctx.server.store.game.scenes.find((scene) => scene.id !== sceneA)!.id;
    assert.ok((await act(g, "scene:switch", { id: sceneB })).ok);
    assert.equal(battle().relief, undefined);
    assert.ok((await act(g, "scene:switch", { id: sceneA })).ok);
    assert.deepEqual(Object.keys(battle().relief ?? {}), ["1,0"]);
    // arquivo de sessão
    const exported = await g.timeout(2000).emitWithAck("session:export");
    assert.ok(exported.ok);
    await act(g, "relief:clear", {});
    assert.ok((await g.timeout(2000).emitWithAck("session:import", exported.file)).ok);
    assert.deepEqual(Object.keys(battle().relief ?? {}), ["1,0"], "volta do arquivo");
    const withRelief = (relief: unknown) => ({ ...exported.file, game: { ...exported.file.game, battle: { ...exported.file.game.battle, relief } } });
    for (const relief of [{ "0,0": "não é base64" }, { "0,0": encodeLayer(new Uint8Array(1023)) }, { "0,0": encodeLayer(new Uint8Array(1024).fill(77)) }, { "a,b": encodeLayer(new Uint8Array(1024).fill(2)) }]) {
      assert.equal((await g.timeout(2000).emitWithAck("session:import", withRelief(relief))).ok, false, JSON.stringify(relief).slice(0, 40));
    }
    // limpar campo
    await act(g, "battle:clear", { keepTemplates: true });
    assert.equal(battle().relief, undefined);
  });
});

describe("relevo: altura por pedaço", () => {
  /** Altura (em níveis) no ponto `x, y` (casas), lida da janela do pedaço com interpolação linear. */
  const heightAt = (chunks: ReliefChunks, key: string, x: number, y: number) => {
    const [cx, cy] = key.split(",").map(Number);
    const heights = reliefHeights(chunks, key);
    const side = (8 + 2 * RELIEF_MARGIN) * RELIEF_PER_CELL + 1;
    const gx = (x - (cx * 8 - RELIEF_MARGIN)) * RELIEF_PER_CELL;
    const gy = (y - (cy * 8 - RELIEF_MARGIN)) * RELIEF_PER_CELL;
    const x0 = Math.floor(gx);
    const y0 = Math.floor(gy);
    const fx = gx - x0;
    const fy = gy - y0;
    const at = (i: number, j: number) => heights[j * side + i];
    return (at(x0, y0) * (1 - fx) + at(x0 + 1, y0) * fx) * (1 - fy) + (at(x0, y0 + 1) * (1 - fx) + at(x0 + 1, y0 + 1) * fx) * fy;
  };

  it("tamanho da janela: o pedaço e a margem, 8 pontos por casa", () => {
    const side = (8 + 2 * RELIEF_MARGIN) * RELIEF_PER_CELL + 1;
    assert.equal(reliefHeights({}, "0,0").length, side * side);
  });

  it("escarpa: no topo do patamar a altura é 1; a 1,15 casa da borda, do lado de baixo, é 0", () => {
    const chunks: ReliefChunks = {};
    paintRelief(chunks, stroke(1, false, [4, 4], 3));
    assert.ok(Math.abs(heightAt(chunks, "0,0", 4, 4) - 1) < 1e-6);
    assert.ok(Math.abs(heightAt(chunks, "0,0", 6.5, 4) - 1) < 1e-6, "dentro do patamar");
    assert.ok(heightAt(chunks, "0,0", 7 + 1.3, 4) < 0.02, "pé da face");
    const middle = heightAt(chunks, "0,0", 7.5, 4);
    assert.ok(middle > 0.2 && middle < 0.8, `meio da face: ${middle}`);
  });

  it("suave: na borda pintada a altura fica no meio; 1,25 casa para fora, perto de 0; para dentro, perto de 1", () => {
    const chunks: ReliefChunks = {};
    paintRelief(chunks, stroke(1, true, [4, 4], 3));
    const edge = heightAt(chunks, "0,0", 7, 4);
    assert.ok(edge > 0.35 && edge < 0.65, `borda: ${edge}`);
    assert.ok(heightAt(chunks, "0,0", 8.4, 4) < 0.1);
    assert.ok(heightAt(chunks, "0,0", 5.6, 4) > 0.9);
  });

  it("suave: um monte de raio 1 casa não chega a 1 (topo arredondado)", () => {
    const chunks: ReliefChunks = {};
    paintRelief(chunks, stroke(1, true, [4, 4], 1));
    const top = heightAt(chunks, "0,0", 4, 4);
    assert.ok(top > 0.5 && top < 0.99, `topo: ${top}`);
  });

  it("distância exata (não por chanfro): de um ponto até (6, 8) e (8, 6) é 10, e até (0, 10) também", () => {
    const side = 41;
    const mask = new Uint8Array(side * side);
    mask[20 * side + 20] = 1;
    const distance = distanceField(mask, side, side);
    for (const [dx, dy] of [[6, 8], [8, 6], [0, 10], [-6, -8], [10, 0]]) assert.ok(Math.abs(distance[(20 + dy) * side + 20 + dx] - 10) < 1e-6, `${dx},${dy}`);
    assert.equal(distance[20 * side + 20], 0);
  });

  it("dois níveis: a face desce de 2 a 1, fica em 1 e depois desce de 1 a 0", () => {
    const chunks: ReliefChunks = {};
    paintRelief(chunks, stroke(1, false, [4, 4], 4));
    paintRelief(chunks, stroke(2, false, [4, 4], 1.5));
    assert.ok(Math.abs(heightAt(chunks, "0,0", 4, 4) - 2) < 1e-6);
    assert.ok(Math.abs(heightAt(chunks, "0,0", 7, 4) - 1) < 1e-6, "patamar do meio");
    assert.ok(heightAt(chunks, "0,0", 8 + 1.3, 4) < 0.02, "chão");
  });

  it("pedaço vizinho sem relevo próprio tem a face do vizinho na margem", () => {
    const chunks: ReliefChunks = {};
    paintRelief(chunks, stroke(1, false, [4, 4], 3.8));
    assert.equal(chunks["1,0"], undefined);
    const face = heightAt(chunks, "1,0", 8.2, 4);
    assert.ok(face > 0.1 && face < 0.9, `face no vizinho: ${face}`);
  });

  it("pedaços afetados: o tocado e os vizinhos até a margem", () => {
    assert.deepEqual(new Set(reliefAffected(["0,0"])), new Set(["-1,-1", "0,-1", "1,-1", "-1,0", "0,0", "1,0", "-1,1", "0,1", "1,1"]));
  });
});
