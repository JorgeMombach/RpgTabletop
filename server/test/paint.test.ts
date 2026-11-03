import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { LIMITS, type ActionResult } from "@rpg/shared";
import { exportSession, importSession } from "../src/session-file";
import { act, join, stateWhere, useServer, type Client } from "./helpers";

// Pincel de efeitos (Fase 6): o mestre pinta casas com um efeito; o mesmo tipo vira um efeito só.
const { ctx, client } = useServer();
const battle = () => ctx.server.store.game.battle;
const painted = () => battle().effects.filter((e) => e.cells);
/** Casas como "col,row", em ordem, para comparar sem depender da ordem do envio. */
const cellsOf = (cells: number[] | undefined) => {
  const out: string[] = [];
  for (let i = 0; i + 1 < (cells?.length ?? 0); i += 2) out.push(`${cells![i]},${cells![i + 1]}`);
  return out.sort();
};

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
  const s = await client(`10.72.0.${ipSeq++}`);
  await join(s, name);
  return s;
}

describe("pincel de efeitos", () => {
  it("pintar o mesmo tipo junta num efeito só; outro tipo vira outro efeito", async () => {
    const g = await gm();
    const [fire] = idsOf(await act(g, "effect:paint", { preset: "fire", cells: [1, 1, 2, 1] }));
    // Casa repetida não duplica.
    assert.deepEqual(idsOf(await act(g, "effect:paint", { preset: "fire", cells: [2, 1, 2, 2] })), [fire]);
    const [grease] = idsOf(await act(g, "effect:paint", { preset: "grease", cells: [2, 2, 3, 3] }));
    assert.notEqual(grease, fire);

    const [f, gr] = painted();
    assert.equal(f.name, "", "sem nome próprio: cada tela mostra \"Fogo (pintado)\" no idioma dela");
    assert.equal(f.preset, "fire");
    assert.deepEqual(cellsOf(f.cells), ["1,1", "2,1", "2,2"]);
    assert.deepEqual(cellsOf(gr.cells), ["2,2", "3,3"], "tipos diferentes podem dividir a casa");
    // Pintura não tem conjurador nem duração: fica até o mestre tirar.
    assert.equal(f.casterId, null);
    assert.equal(f.rounds, null);
    assert.equal(f.active, true);
  });

  it("apagar tira as casas de qualquer pintura (ou só do tipo pedido); pintura sem casas some", async () => {
    const g = await gm();
    await act(g, "effect:paint", { preset: "fire", cells: [1, 1, 2, 1] });
    await act(g, "effect:paint", { preset: "grease", cells: [2, 1, 5, 5] });
    await act(g, "effect:paint", { preset: "ice", cells: [7, 7] });

    assert.ok((await act(g, "effect:paint", { erase: true, preset: "grease", cells: [2, 1] })).ok);
    assert.deepEqual(cellsOf(painted().find((e) => e.preset === "fire")!.cells), ["1,1", "2,1"], "o filtro poupa o fogo");
    assert.deepEqual(cellsOf(painted().find((e) => e.preset === "grease")!.cells), ["5,5"]);

    assert.ok((await act(g, "effect:paint", { erase: true, cells: [1, 1, 2, 1, 5, 5] })).ok);
    assert.deepEqual(
      painted().map((e) => e.preset),
      ["ice"],
    );
  });

  it("pintura desligada não recebe casas novas: pintar de novo cria outra", async () => {
    const g = await gm();
    const [a] = idsOf(await act(g, "effect:paint", { preset: "fire", cells: [1, 1] }));
    await act(g, "effect:toggle", { id: a, active: false });
    const [b] = idsOf(await act(g, "effect:paint", { preset: "fire", cells: [3, 3] }));
    assert.notEqual(a, b);
  });

  it("só o mestre pinta; casas inválidas e excesso são recusados sem mudar nada", async () => {
    const g = await gm();
    const ana = await player("Ana");
    assert.match(errorOf(await act(ana, "effect:paint", { preset: "fire", cells: [1, 1] })), /mestre/);
    assert.match(errorOf(await act(g, "effect:paint", { preset: "fire", cells: [1] })), /Casas/);
    assert.match(errorOf(await act(g, "effect:paint", { preset: "fire", cells: [1.5, 1] })), /Casas/);
    assert.match(errorOf(await act(g, "effect:paint", { preset: "fire", cells: [LIMITS.gridCoord + 1, 1] })), /Casas/);
    assert.match(errorOf(await act(g, "effect:paint", { preset: "lava" as "fire", cells: [1, 1] })), /Efeito inválido/);
    assert.match(errorOf(await act(g, "effect:paint", { preset: "fire", cells: [] })), /Casas/);
    const many = Array.from({ length: LIMITS.paintCells + 1 }, (_, i) => [i % 1000, Math.floor(i / 1000)]).flat();
    assert.match(errorOf(await act(g, "effect:paint", { preset: "fire", cells: many })), /Limite/);
    assert.equal(painted().length, 0);
  });

  it("pintura não anda com token", async () => {
    const g = await gm();
    const [id] = idsOf(await act(g, "effect:paint", { preset: "web", cells: [1, 1] }));
    assert.match(errorOf(await act(g, "effect:follow", { id, follow: true })), /pintad/);
  });

  it("transformar uma pintura muda o tipo e mantém as casas", async () => {
    const g = await gm();
    const [id] = idsOf(await act(g, "effect:paint", { preset: "grease", cells: [1, 1, 2, 1] }));
    assert.ok((await act(g, "effect:transform", { id, preset: "fire" })).ok);
    assert.equal(painted()[0].preset, "fire");
    assert.deepEqual(cellsOf(painted()[0].cells), ["1,1", "2,1"]);
  });

  it("com névoa, o jogador só recebe a pintura que tem alguma casa revelada", async () => {
    const g = await gm();
    const ana = await player("Ana");
    await act(g, "fog:set", { enabled: true });
    await act(g, "fog:paint", { reveal: true, rects: [{ col: 0, row: 0, w: 3, h: 3 }] });
    await act(g, "effect:paint", { preset: "ice", cells: [20, 20, 21, 20] });
    const [fire] = idsOf(await act(g, "effect:paint", { preset: "fire", cells: [20, 21, 2, 2] }));
    const s = await stateWhere(ana, (x) => x.battle.effects.length > 0);
    assert.deepEqual(
      s.battle.effects.map((e) => e.id),
      [fire],
    );
  });

  it("vai no arquivo de sessão", async () => {
    const g = await gm();
    await act(g, "effect:paint", { preset: "plants", cells: [4, 4, 5, 4] });
    const file = JSON.parse(JSON.stringify(exportSession(ctx.server.store)));
    await act(g, "effect:paint", { erase: true, cells: [4, 4, 5, 4] });
    assert.equal(painted().length, 0);
    const master = [...ctx.server.store.players.values()].find((p) => p.role === "gm")!;
    importSession(ctx.server.store, master, file);
    assert.deepEqual(cellsOf(painted()[0]?.cells), ["4,4", "5,4"]);
  });
});
