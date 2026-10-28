import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { emptyFog, isRevealed, paintFog, roomCells, type ActionResult, type ClientState, type Wall } from "@rpg/shared";
import { act, join, stateWhere, useServer } from "./helpers";

// Névoa de guerra (G1): o mestre revela e cobre; o jogador não recebe o que está coberto.
const { ctx, client } = useServer();

function idsOf(res: ActionResult): string[] {
  assert.ok(res.ok, res.ok ? "" : res.error);
  return res.ids ?? [];
}

describe("névoa de guerra", () => {
  it("intervalos: revelar junta, cobrir corta", () => {
    const fog = { ...emptyFog(), enabled: true };
    paintFog(fog, { col: 0, row: 0, w: 5, h: 1 }, true);
    paintFog(fog, { col: 5, row: 0, w: 3, h: 1 }, true);
    paintFog(fog, { col: 10, row: 0, w: 2, h: 1 }, true);
    assert.deepEqual(fog.revealed["0"], [0, 8, 10, 12], "encostados viram um só");
    paintFog(fog, { col: 2, row: 0, w: 9, h: 1 }, false);
    assert.deepEqual(fog.revealed["0"], [0, 2, 11, 12]);
    assert.equal(isRevealed(fog, 1, 0), true);
    assert.equal(isRevealed(fog, 5, 0), false);
    paintFog(fog, { col: -5, row: 0, w: 30, h: 1 }, false);
    assert.equal(fog.revealed["0"], undefined, "linha toda coberta some");
  });

  it("jogador não recebe mobs, efeitos, desenhos e paredes cobertos; o mestre recebe tudo", async () => {
    const g = await client();
    await join(g, "Mestre");
    const ana = await client("10.50.0.1");
    await join(ana, "Ana");

    const [orc] = idsOf(await act(g, "mob:add", { name: "Orc", hpMax: 15, dexMod: 0 }));
    const [ogro] = idsOf(await act(g, "mob:add", { name: "Ogro", hpMax: 59, dexMod: -1, size: "large" }));
    await act(g, "token:move", { id: orc, pos: { col: 10, row: 10 } });
    await act(g, "token:move", { id: ogro, pos: { col: 1, row: 1 } });
    await act(g, "wall:add", { from: { col: 10, row: 9 }, to: { col: 12, row: 9 } });
    await act(g, "effect:add", { name: "Fogo", preset: "fire", area: { kind: "sphere", origin: { col: 10.5, row: 10.5 }, angle: 0, feet: 10 } });

    assert.equal((await act(ana, "fog:set", { enabled: true })).ok, false, "só o mestre");
    const covered = stateWhere(ana, (s) => s.battle.fog.enabled);
    assert.ok((await act(g, "fog:set", { enabled: true })).ok);
    let s: ClientState = await covered;
    assert.deepEqual([s.battle.mobs.length, s.battle.walls.length, s.battle.effects.length], [0, 0, 0], "tudo coberto");

    // Revela só a casa 2,2: o Ogro (2×2 a partir de 1,1) aparece; o Orc continua escondido.
    const one = stateWhere(ana, (st) => st.battle.mobs.length === 1);
    assert.ok((await act(g, "fog:paint", { reveal: true, rects: [{ col: 2, row: 2, w: 1, h: 1 }] })).ok);
    s = await one;
    assert.equal(s.battle.mobs[0].name, "Ogro");

    // Revela a sala do Orc: ele, a parede e o efeito chegam.
    const room = stateWhere(ana, (st) => st.battle.mobs.length === 2);
    await act(g, "fog:paint", { reveal: true, rects: [{ col: 9, row: 9, w: 4, h: 4 }] });
    s = await room;
    assert.deepEqual([s.battle.walls.length, s.battle.effects.length], [1, 1]);

    // Mestre: recebe tudo sempre.
    const gm = ctx.server.store.game.battle;
    assert.equal(gm.mobs.length, 2);

    // Cobrir tudo de novo.
    const again = stateWhere(ana, (st) => st.battle.mobs.length === 0);
    assert.ok((await act(g, "fog:reset", {})).ok);
    await again;

    // Andar para a casa do Orc escondido não entrega que tem alguém ali (o mestre separa os dois).
    const [lia] = idsOf(await act(ana, "ally:create", { name: "Lia", hpMax: 20, dexMod: 0, ac: 14 }));
    assert.ok((await act(ana, "token:move", { id: lia, pos: { col: 10, row: 10 } })).ok);

    // Validação.
    assert.equal((await act(g, "fog:paint", { reveal: true, rects: [] })).ok, false);
    assert.equal((await act(g, "fog:paint", { reveal: true, rects: [{ col: 0, row: 0, w: 0, h: 1 }] })).ok, false);
  });

  it("cômodo: cresce até as paredes e portas fechadas; parede diagonal vale; área aberta é recusada", () => {
    const wall = (id: string, a: [number, number], b: [number, number], door?: Wall["door"]): Wall => ({ id, from: { col: a[0], row: a[1] }, to: { col: b[0], row: b[1] }, ...(door && { door }) });
    // Sala 3×3 (casas 0–2) com uma porta no lado direito.
    const room = [
      wall("n", [0, 0], [3, 0]),
      wall("s", [0, 3], [3, 3]),
      wall("o", [0, 0], [0, 3]),
      wall("l1", [3, 0], [3, 1]),
      wall("l2", [3, 2], [3, 3]),
    ];
    const door = (open: boolean) => wall("porta", [3, 1], [3, 2], { open });
    assert.equal(roomCells({ col: 1, row: 1 }, [...room, door(false)], 100)?.length, 9);
    assert.equal(roomCells({ col: 1, row: 1 }, [...room, door(true)], 100), null, "porta aberta: vaza para fora");
    assert.equal(roomCells({ col: 1, row: 1 }, room, 100), null, "sem porta: vão aberto");

    // Triângulo: as casas abaixo da diagonal (col + row ≤ 2).
    const tri = [wall("a", [0, 0], [4, 0]), wall("b", [0, 0], [0, 4]), wall("d", [0, 4], [4, 0])];
    const cells = roomCells({ col: 0, row: 0 }, tri, 100)!;
    assert.equal(cells.length, 6);
    assert.ok(cells.every((c) => c.col + c.row <= 2));
  });

  it("fog:room revela o cômodo para o jogador; área aberta é recusada", async () => {
    const g = await client();
    await join(g, "Mestre");
    await act(g, "battle:clear", { keepTemplates: false });
    const ana = await client("10.50.0.2");
    await join(ana, "Ana");
    for (const [a, b] of [[[20, 20], [23, 20]], [[20, 23], [23, 23]], [[20, 20], [20, 23]], [[23, 20], [23, 23]]] as const) {
      await act(g, "wall:add", { from: { col: a[0], row: a[1] }, to: { col: b[0], row: b[1] } });
    }
    const [orc] = idsOf(await act(g, "mob:add", { name: "Orc", hpMax: 15, dexMod: 0 }));
    await act(g, "token:move", { id: orc, pos: { col: 22, row: 22 } });
    await act(g, "fog:set", { enabled: true });

    const seen = stateWhere(ana, (st) => st.battle.mobs.length === 1);
    assert.ok((await act(g, "fog:room", { cell: { col: 21, row: 21 }, reveal: true })).ok);
    const s = await seen;
    assert.equal(s.battle.walls.length, 4);
    assert.equal(isRevealed(ctx.server.store.game.battle.fog, 23, 21), false, "fora da sala continua coberto");

    assert.equal((await act(g, "fog:room", { cell: { col: 0, row: 0 }, reveal: true })).ok, false, "área aberta");
  });
});
