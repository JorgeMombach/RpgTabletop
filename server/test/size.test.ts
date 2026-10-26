import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { blockedCells, centeredOn, nearestCellOf, nearestFreeSpot, type ActionResult } from "@rpg/shared";
import { act, join, useServer, type Client } from "./helpers";

// Tamanho das criaturas: grandes ocupam várias casas; miúdas dividem a casa.
const { ctx, client } = useServer();
const game = () => ctx.server.store.game;

function idsOf(res: ActionResult): string[] {
  assert.ok(res.ok, res.ok ? "" : res.error);
  return res.ids ?? [];
}

function errorOf(res: ActionResult): string {
  assert.equal(res.ok, false, "deveria recusar");
  return res.ok ? "" : res.error;
}

async function gm(): Promise<Client> {
  const s = await client();
  await join(s, "Mestre");
  return s;
}

let ipSeq = 1;
async function player(name: string): Promise<Client> {
  const s = await client(`10.32.0.${ipSeq++}`);
  await join(s, name);
  return s;
}

describe("tamanho das criaturas", () => {
  it("contas do grid: espaço ocupado, lugar livre que cabe, casa mais perto da borda", () => {
    assert.equal(blockedCells([{ pos: { col: 0, row: 0 }, size: "huge" }]).length, 9);
    assert.equal(blockedCells([{ pos: { col: 0, row: 0 }, size: "tiny" }]).length, 0, "miúdo não bloqueia");
    // Dragão 2×2 ao lado de um goblin em (1,0): o canto (0,0) não serve.
    const spot = nearestFreeSpot({ col: 0, row: 0 }, [{ col: 1, row: 0 }], 2);
    assert.ok(!(spot.col <= 1 && spot.col + 1 >= 1 && spot.row <= 0 && spot.row + 1 >= 0), "não pega a casa ocupada");
    assert.deepEqual(centeredOn({ col: 5, row: 5 }, 3), { col: 4, row: 4 });
    assert.deepEqual(nearestCellOf({ col: 0, row: 0 }, 3, { col: 10, row: 1 }), { col: 2, row: 1 });
  });

  it("grande ocupa o espaço inteiro: ninguém entra embaixo e ele não pousa em cima de ninguém", async () => {
    const g = await gm();
    const [ogro] = idsOf(await act(g, "mob:add", { name: "Ogro", hpMax: 59, dexMod: -1, ac: 11, size: "large" }));
    const [goblin] = idsOf(await act(g, "mob:add", { name: "Goblin", hpMax: 7, dexMod: 2, ac: 15 }));
    assert.ok((await act(g, "token:move", { id: ogro, pos: { col: 2, row: 2 } })).ok);
    assert.match(errorOf(await act(g, "token:move", { id: goblin, pos: { col: 3, row: 3 } })), /ocupada por Ogro/);
    assert.ok((await act(g, "token:move", { id: goblin, pos: { col: 4, row: 3 } })).ok, "do lado, cabe");
    assert.match(errorOf(await act(g, "token:move", { id: ogro, pos: { col: 3, row: 2 } })), /Não cabe aí: Goblin/);
  });

  it("miúdo divide a casa; o tamanho vem do template e muda na edição", async () => {
    const g = await gm();
    const [tid] = idsOf(await act(g, "template:upsert", { name: "Rato", hpMax: 1, dexMod: 0, ac: 10, size: "tiny" }));
    const [rato] = idsOf(await act(g, "mob:addFromTemplate", { templateId: tid, qty: 1 }));
    const [goblin] = idsOf(await act(g, "mob:add", { name: "Goblin", hpMax: 7, dexMod: 2, ac: 15 }));
    await act(g, "token:move", { id: goblin, pos: { col: 1, row: 1 } });
    assert.ok((await act(g, "token:move", { id: rato, pos: { col: 1, row: 1 } })).ok, "rato entra na casa do goblin");
    assert.equal(game().battle.mobs.find((m) => m.id === rato)?.size, "tiny");
    await act(g, "combatant:update", { id: goblin, size: "medium" });
    assert.equal(game().battle.mobs.find((m) => m.id === goblin)?.size, undefined, "médio é o padrão (sem campo)");
    assert.equal((await act(g, "combatant:update", { id: goblin, size: "colossal" as never })).ok, false);
  });

  it("jogador não é barrado pelo espaço de um oculto (não entrega que há alguém ali)", async () => {
    const g = await gm();
    const ana = await player("Ana");
    const [dragao] = idsOf(await act(g, "mob:add", { name: "Dragão", hpMax: 200, dexMod: 0, ac: 19, size: "huge", hidden: true }));
    await act(g, "token:move", { id: dragao, pos: { col: 0, row: 0 } });
    const [thorin] = idsOf(await act(ana, "ally:create", { name: "Thorin", hpMax: 30, dexMod: 1, ac: 18 }));
    assert.ok((await act(ana, "token:move", { id: thorin, pos: { col: 2, row: 2 } })).ok);
  });

  it("conjurado grande nasce num lugar onde cabe inteiro", async () => {
    const ana = await player("Ana");
    const [thorin] = idsOf(await act(ana, "ally:create", { name: "Thorin", hpMax: 30, dexMod: 1, ac: 18 }));
    await act(ana, "token:move", { id: thorin, pos: { col: 5, row: 5 } });
    const [urso] = idsOf(await act(ana, "summon:add", { summonerId: thorin, qty: 1, name: "Urso", hpMax: 34, dexMod: 0, ac: 11, size: "large" }));
    const u = game().allies.find((a) => a.id === urso)!;
    assert.ok(u.pos);
    const overlapsThorin = u.pos!.col <= 5 && u.pos!.col + 1 >= 5 && u.pos!.row <= 5 && u.pos!.row + 1 >= 5;
    assert.equal(overlapsThorin, false);
  });
});
