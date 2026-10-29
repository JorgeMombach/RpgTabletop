import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { emptyFog, inRows, isRevealed, paintFog, roomCells, sightCells, type ActionResult, type ClientState, type Wall } from "@rpg/shared";
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

  it("visão: raio em volta do token e parede bloqueia", () => {
    // Parede vertical na coluna 3, do alto até embaixo da área.
    const wall: Wall = { id: "w", from: { col: 3, row: -10 }, to: { col: 3, row: 10 } };
    const cells = sightCells([{ pos: { col: 0, row: 0 }, span: 1, feet: 20 }], [wall], 5);
    const has = (col: number, row: number) => cells.some((c) => c.col === col && c.row === row);
    assert.ok(has(0, 0) && has(2, 0) && has(-4, 0) && has(0, 4), "dentro do raio de 4 casas");
    assert.ok(!has(-5, 0) && !has(0, 5), "fora do raio");
    assert.ok(!has(3, 0) && !has(4, 1), "atrás da parede");
  });

  it("visão dos personagens: aliado revela em volta; inimigo fora da visão some, o explorado fica; porta aberta deixa ver", async () => {
    const g = await client();
    await join(g, "Mestre");
    await act(g, "battle:clear", { keepTemplates: false });
    const bia = await client("10.50.0.3");
    await join(bia, "Bia");
    // Corredor: parede com porta fechada na coluna 5 (linhas 0–1 porta, o resto parede).
    await act(g, "wall:add", { from: { col: 5, row: -20 }, to: { col: 5, row: 0 } });
    await act(g, "wall:add", { from: { col: 5, row: 1 }, to: { col: 5, row: 20 } });
    await act(g, "wall:add", { from: { col: 5, row: 0 }, to: { col: 5, row: 1 }, door: true });
    const door = ctx.server.store.game.battle.walls.find((w) => w.door)!;
    const [orc] = idsOf(await act(g, "mob:add", { name: "Orc", hpMax: 15, dexMod: 0 }));
    await act(g, "token:move", { id: orc, pos: { col: 6, row: 0 } });
    const [lia] = idsOf(await act(bia, "ally:create", { name: "Lia", hpMax: 20, dexMod: 0, ac: 14 }));
    await act(bia, "token:move", { id: lia, pos: { col: 2, row: 0 } });
    await act(g, "fog:set", { enabled: true });
    // Noite: 20 ft (4 casas) sem visão no escuro.
    await act(g, "weather:set", { light: "night" });

    let ready = stateWhere(bia, (st) => st.battle.fog.vision);
    assert.ok((await act(g, "fog:vision", { enabled: true })).ok);
    let s: ClientState = await ready;
    assert.ok(inRows(s.battle.sight, 2, 0) && inRows(s.battle.sight, 4, 0), "vê até a porta");
    assert.ok(!inRows(s.battle.sight, 6, 0), "porta fechada bloqueia");
    assert.equal(s.battle.mobs.length, 0);

    // Abre a porta: vê o Orc do outro lado.
    ready = stateWhere(bia, (st) => st.battle.mobs.length === 1);
    await act(bia, "door:set", { id: door.id, open: true });
    s = await ready;
    assert.ok(inRows(s.battle.sight, 6, 0));

    // Lia se afasta: o Orc some, mas a área continua explorada (e a parede, lembrada).
    ready = stateWhere(bia, (st) => st.battle.mobs.length === 0);
    await act(bia, "token:move", { id: lia, pos: { col: -10, row: 0 } });
    s = await ready;
    assert.ok(!inRows(s.battle.sight, 6, 0));
    assert.ok(inRows(s.battle.fog.explored, 6, 0), "explorado fica");
    assert.ok(s.battle.walls.length > 0, "paredes do explorado continuam");

    // Visão no escuro: 60 ft (12 casas) à noite.
    ready = stateWhere(bia, (st) => inRows(st.battle.sight, 2, 0));
    await act(bia, "combatant:update", { id: lia, darkvision: true });
    await ready;

    // Cobrir tudo esquece o explorado.
    ready = stateWhere(bia, (st) => !inRows(st.battle.fog.explored, 6, 0));
    await act(g, "fog:reset", {});
    await ready;
  });

  it("tocha: quem segura enxerga 40 ft no escuro; a luz de um inimigo aparece de longe; oculto não ilumina", async () => {
    const g = await client();
    await join(g, "Mestre");
    await act(g, "battle:clear", { keepTemplates: false });
    const caio = await client("10.50.0.4");
    await join(caio, "Caio");
    const [kael] = idsOf(await act(caio, "ally:create", { name: "Kael", hpMax: 12, dexMod: 0, ac: 12 }));
    await act(caio, "token:move", { id: kael, pos: { col: 0, row: 0 } });
    const [gob] = idsOf(await act(g, "mob:add", { name: "Goblin", hpMax: 7, dexMod: 2 }));
    await act(g, "token:move", { id: gob, pos: { col: 15, row: 0 } });
    await act(g, "weather:set", { light: "night" });
    await act(g, "fog:set", { enabled: true });
    let ready = stateWhere(caio, (st) => st.battle.fog.vision);
    await act(g, "fog:vision", { enabled: true });
    let s: ClientState = await ready;
    assert.ok(!inRows(s.battle.sight, 6, 0), "sem tocha: 20 ft (4 casas)");

    assert.equal((await act(caio, "torch:set", { id: gob, lit: true })).ok, false, "jogador não mexe na tocha do mob");
    ready = stateWhere(caio, (st) => inRows(st.battle.sight, 7, 0));
    assert.ok((await act(caio, "torch:set", { id: kael, lit: true })).ok);
    s = await ready;
    assert.ok(!inRows(s.battle.sight, 10, 0), "com tocha: 40 ft (8 casas)");

    // Goblin com tocha a 75 ft: a área dele aparece, e ele junto.
    ready = stateWhere(caio, (st) => st.battle.mobs.length === 1);
    await act(g, "torch:set", { id: gob, lit: true });
    s = await ready;
    assert.ok(inRows(s.battle.sight, 15, 0));
    assert.equal(s.battle.mobs[0].torch, true);

    // Oculto não se entrega pela luz.
    ready = stateWhere(caio, (st) => st.battle.mobs.length === 0 && !inRows(st.battle.sight, 15, 0));
    await act(g, "combatant:setHidden", { id: gob, hidden: true });
    await ready;
  });

  it("tocha atrás de porta fechada não aparece; fechar a porta depois de ver esconde o inimigo e deixa a sala explorada", async () => {
    const g = await client();
    await join(g, "Mestre");
    await act(g, "battle:clear", { keepTemplates: false });
    const duda = await client("10.50.0.5");
    await join(duda, "Duda");
    // Sala nas colunas 6–11, linhas 0–5, com porta na parede da esquerda (linha 2).
    const w = (a: [number, number], b: [number, number], door?: boolean) => act(g, "wall:add", { from: { col: a[0], row: a[1] }, to: { col: b[0], row: b[1] }, door });
    await w([6, 0], [12, 0]);
    await w([6, 6], [12, 6]);
    await w([12, 0], [12, 6]);
    await w([6, 0], [6, 2]);
    await w([6, 3], [6, 6]);
    await w([6, 2], [6, 3], true);
    const door = ctx.server.store.game.battle.walls.find((x) => x.door)!;
    const [orc] = idsOf(await act(g, "mob:add", { name: "Orc", hpMax: 15, dexMod: 0 }));
    await act(g, "token:move", { id: orc, pos: { col: 9, row: 2 } });
    await act(g, "torch:set", { id: orc, lit: true });
    // Duda na frente da porta, do lado de fora.
    const [lia] = idsOf(await act(duda, "ally:create", { name: "Lia", hpMax: 20, dexMod: 0, ac: 14 }));
    await act(duda, "token:move", { id: lia, pos: { col: 2, row: 2 } });
    await act(g, "weather:set", { light: "night" });
    await act(g, "fog:set", { enabled: true });
    let ready = stateWhere(duda, (st) => st.battle.fog.vision);
    await act(g, "fog:vision", { enabled: true });
    let s: ClientState = await ready;
    assert.equal(s.battle.mobs.length, 0, "porta fechada: nem o Orc nem a luz dele");
    assert.ok(!inRows(s.battle.sight, 9, 2) && !inRows(s.battle.sight, 7, 2));

    ready = stateWhere(duda, (st) => st.battle.mobs.length === 1);
    await act(duda, "door:set", { id: door.id, open: true });
    s = await ready;
    assert.ok(inRows(s.battle.sight, 9, 2), "porta aberta: vê pelo vão a sala iluminada");

    ready = stateWhere(duda, (st) => st.battle.mobs.length === 0);
    await act(duda, "door:set", { id: door.id, open: false });
    s = await ready;
    assert.ok(!inRows(s.battle.sight, 9, 2), "porta fechada de novo: não vê mais");
    assert.ok(inRows(s.battle.fog.explored, 9, 2), "a sala fica explorada (lembrada)");
    assert.deepEqual(s.battle.fog.lastSeen, [{ id: orc, name: "Orc", pos: { col: 9, row: 2 }, span: 1 }], "marca onde foi visto por último");

    // O Orc anda lá dentro, sem ninguém ver: a marca fica onde ele foi visto.
    await act(g, "token:move", { id: orc, pos: { col: 10, row: 4 } });
    assert.deepEqual(ctx.server.store.game.battle.fog.lastSeen.map((m) => m.pos), [{ col: 9, row: 2 }]);

    // Porta aberta de novo: a Lia vê o lugar da marca (vazio agora) e a marca some.
    ready = stateWhere(duda, (st) => st.battle.fog.lastSeen.length === 0);
    await act(duda, "door:set", { id: door.id, open: true });
    await ready;

    // Saiu da vista e o mestre ocultou: sem marca.
    await act(duda, "door:set", { id: door.id, open: false });
    await act(g, "combatant:setHidden", { id: orc, hidden: true });
    assert.equal(ctx.server.store.game.battle.fog.lastSeen.length, 0);
  });

  it("cobrir tudo esconde os inimigos de uma vez, sem deixar \"?\"; alcance por cena limita a visão", async () => {
    const g = await client();
    await join(g, "Mestre");
    await act(g, "battle:clear", { keepTemplates: false });
    const eva = await client("10.50.0.6");
    await join(eva, "Eva");
    const [lia] = idsOf(await act(eva, "ally:create", { name: "Lia", hpMax: 20, dexMod: 0, ac: 14 }));
    await act(eva, "token:move", { id: lia, pos: { col: 0, row: 0 } });
    const [orc] = idsOf(await act(g, "mob:add", { name: "Orc", hpMax: 15, dexMod: 0 }));
    const [npc] = idsOf(await act(g, "npc:add", { name: "Mercador", hpMax: 5, dexMod: 0 }));
    // De dia, 120 ft (24 casas): os dois a 20 casas aparecem.
    await act(g, "token:move", { id: orc, pos: { col: 20, row: 0 } });
    await act(g, "token:move", { id: npc, pos: { col: 20, row: 2 } });
    await act(g, "weather:set", { light: "day" });
    await act(g, "fog:set", { enabled: true });
    let ready = stateWhere(eva, (st) => st.battle.mobs.length === 1 && st.battle.npcs.length === 1);
    await act(g, "fog:vision", { enabled: true });
    await ready;

    // Alcance da cena em 30 ft (6 casas): somem, sem marca de "visto por último" (foi o mestre).
    ready = stateWhere(eva, (st) => st.battle.mobs.length === 0 && st.battle.npcs.length === 0);
    assert.ok((await act(g, "fog:range", { feet: 30 })).ok);
    let s: ClientState = await ready;
    assert.equal(s.battle.fog.range, 30);
    assert.ok(inRows(s.battle.sight, 6, 0) && !inRows(s.battle.sight, 8, 0), "30 ft = 6 casas");
    assert.deepEqual(s.battle.fog.lastSeen, []);
    assert.equal((await act(eva, "fog:range", { feet: 60 })).ok, false, "só o mestre muda o alcance");
    assert.equal((await act(g, "fog:range", { feet: 2 })).ok, false);

    // Pela luz de novo; o mestre revela onde estão e depois cobre tudo: um clique basta, sem "?".
    await act(g, "fog:range", { feet: null });
    await act(g, "token:move", { id: orc, pos: { col: 40, row: 0 } });
    await act(g, "token:move", { id: npc, pos: { col: 40, row: 2 } });
    ready = stateWhere(eva, (st) => st.battle.mobs.length === 1 && st.battle.npcs.length === 1);
    await act(g, "fog:paint", { reveal: true, rects: [{ col: 38, row: 0, w: 5, h: 5 }] });
    await ready;
    ready = stateWhere(eva, (st) => st.battle.mobs.length === 0 && st.battle.npcs.length === 0);
    await act(g, "fog:reset", {});
    s = await ready;
    assert.deepEqual(s.battle.fog.lastSeen, [], "cobrir tudo não deixa \"?\"");
    assert.ok(inRows(s.battle.fog.explored, 0, 0), "o que a Lia vê agora volta a ficar explorado");
  });

  it("mob caído: o jogador sabe que caiu, sem receber a vida", async () => {
    const g = await client();
    await join(g, "Mestre");
    await act(g, "battle:clear", { keepTemplates: false });
    const fil = await client("10.50.0.7");
    await join(fil, "Fil");
    const [orc] = idsOf(await act(g, "mob:add", { name: "Orc", hpMax: 15, dexMod: 0 }));
    let s: ClientState = await stateWhere(fil, (st) => st.battle.mobs.length === 1);
    assert.equal(s.battle.mobs[0].down, undefined);
    const ready = stateWhere(fil, (st) => st.battle.mobs[0]?.down === true);
    await act(g, "hp:change", { id: orc, delta: -20 });
    s = await ready;
    assert.equal(s.battle.mobs[0].hp, undefined);
  });
});
