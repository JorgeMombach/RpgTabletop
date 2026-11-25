import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { propClearance, touchesWall, type ActionResult, type Wall } from "@rpg/shared";
import { scatter } from "../../client/src/map/scatter";
import { act, join, useServer } from "./helpers";

// Nada em cima de parede, exceto portas e janelas (docs/design/ajustes-rapidos.md): tocha, baú e objeto.
const { ctx, client } = useServer();
const game = () => ctx.server.store.game;
const WALL_ERROR = "Aí tem uma parede.";

function idsOf(res: ActionResult): string[] {
  assert.ok(res.ok, res.ok ? "" : res.error);
  return res.ids ?? [];
}

function refused(res: ActionResult) {
  assert.equal(res.ok, false);
  assert.equal(res.ok ? "" : res.error, WALL_ERROR);
}

async function gmWithWall(from: { col: number; row: number }, to: { col: number; row: number }) {
  const gm = await client();
  await join(gm, "Mestre");
  await act(gm, "battle:clear", { keepTemplates: false });
  idsOf(await act(gm, "wall:add", { from, to }));
  return gm;
}

describe("nada em cima de parede", () => {
  it("touchesWall: perto da linha encosta; porta e janela não contam", () => {
    const wall: Wall = { id: "w", from: { col: 0, row: 0 }, to: { col: 4, row: 0 } };
    assert.equal(touchesWall({ x: 2, y: 0.1 }, 0.2, [wall]), true);
    assert.equal(touchesWall({ x: 2, y: 0.5 }, 0.2, [wall]), false);
    assert.equal(touchesWall({ x: 4.15, y: 0 }, 0.2, [wall]), true, "na ponta");
    assert.equal(touchesWall({ x: 4.3, y: 0 }, 0.2, [wall]), false, "depois da ponta");
    assert.equal(touchesWall({ x: 2, y: 0.1 }, 0.2, [{ ...wall, door: { open: false } }]), false);
    assert.equal(touchesWall({ x: 2, y: 0.1 }, 0.2, [{ ...wall, door: { open: true } }]), false);
    assert.equal(touchesWall({ x: 2, y: 0.1 }, 0.2, [{ ...wall, window: { closed: true } }]), false);
    assert.equal(touchesWall({ x: 2, y: 0.1 }, 0.2, [{ ...wall, window: {} }]), false);
  });

  it("tocha: pôr e mover em cima de parede é recusado; perto, não", async () => {
    const gm = await gmWithWall({ col: 0, row: 0 }, { col: 4, row: 0 });
    refused(await act(gm, "maptorch:add", { col: 2, row: 0.1, style: "stick" }));
    const [id] = idsOf(await act(gm, "maptorch:add", { col: 2, row: 1, style: "stick" }));
    refused(await act(gm, "maptorch:move", { id, col: 2, row: 0.05 }));
    assert.deepEqual(game().battle.torches.map((torch) => [torch.col, torch.row]), [[2, 1]], "a recusa não mexe na tocha");
  });

  it("tocha na linha de uma porta passa", async () => {
    const gm = await client();
    await join(gm, "Mestre");
    await act(gm, "battle:clear", { keepTemplates: false });
    idsOf(await act(gm, "wall:add", { from: { col: 0, row: 0 }, to: { col: 4, row: 0 }, door: true }));
    idsOf(await act(gm, "maptorch:add", { col: 2, row: 0, style: "iron" }));
  });

  it("baú: casa cortada no meio por parede é recusada", async () => {
    const gm = await gmWithWall({ col: 0, row: 1.5 }, { col: 4, row: 1.5 });
    refused(await act(gm, "chest:add", { col: 1, row: 1, style: "wood" }));
    const [id] = idsOf(await act(gm, "chest:add", { col: 1, row: 3, style: "wood" }));
    refused(await act(gm, "chest:move", { id, col: 2, row: 1 }));
  });

  it("objeto: em cima é recusado; estante encostada passa; o lote inteiro é conferido", async () => {
    const gm = await gmWithWall({ col: 0, row: 0 }, { col: 4, row: 0 });
    refused(await act(gm, "prop:add", { kind: "tree", col: 2, row: 0.05 }));
    idsOf(await act(gm, "prop:add", { kind: "shelf", col: 2, row: 0.5 }));
    refused(await act(gm, "prop:addMany", { items: [{ kind: "bush", col: 1, row: 2 }, { kind: "bush", col: 3, row: 0 }] }));
    assert.equal(game().battle.props.length, 1, "nada do lote recusado entrou");
  });

  it("objeto antigo em cima de parede pode girar sem mover", async () => {
    const gm = await client();
    await join(gm, "Mestre");
    await act(gm, "battle:clear", { keepTemplates: false });
    const [id] = idsOf(await act(gm, "prop:add", { kind: "barrel", col: 2, row: 0 }));
    idsOf(await act(gm, "wall:add", { from: { col: 0, row: 0 }, to: { col: 4, row: 0 } }));
    assert.equal((await act(gm, "prop:update", { id, rotation: 90 })).ok, true);
    refused(await act(gm, "prop:update", { id, col: 2.01 }));
    refused(await act(gm, "prop:update", { id, size: 1.5 }));
  });

  it("espalhar pula só quem cairia na parede", () => {
    const walls: Wall[] = [{ id: "w", from: { col: 0, row: 2 }, to: { col: 6, row: 2 } }];
    const cells = new Set<string>();
    for (let col = 0; col < 6; col++) for (let row = 0; row < 4; row++) cells.add(`${col},${row}`);
    let seed = 1;
    const random = () => ((seed = (seed * 16807) % 2147483647) - 1) / 2147483646;
    const items = scatter("forest", cells, 1, [], random, "square", walls);
    assert.ok(items.length > 0);
    for (const item of items) assert.equal(touchesWall({ x: item.col, y: item.row }, propClearance(item.kind, item.size), walls), false);
  });
});
