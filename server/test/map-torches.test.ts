import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { inRows, type ActionResult, type ClientState } from "@rpg/shared";
import { exportSession, importSession } from "../src/session-file";
import { act, join, stateWhere, useServer } from "./helpers";

// Tochas fixas no mapa: o mestre coloca em qualquer ponto; a luz é a mesma da tocha dos tokens.
const { ctx, client } = useServer();
const game = () => ctx.server.store.game;

function idsOf(res: ActionResult): string[] {
  assert.ok(res.ok, res.ok ? "" : res.error);
  return res.ids ?? [];
}

describe("tochas fixas no mapa", () => {
  it("mestre põe em qualquer ponto, arrasta e apaga; jogador não mexe; desenho e posição são conferidos", async () => {
    const g = await client();
    await join(g, "Mestre");
    await act(g, "battle:clear", { keepTemplates: false });
    const ana = await client("10.60.0.1");
    await join(ana, "Ana");

    const seen = stateWhere(ana, (st) => st.battle.torches.length === 1);
    const [id] = idsOf(await act(g, "maptorch:add", { col: 3.456, row: 7.1, style: "iron" }));
    assert.deepEqual((await seen).battle.torches, [{ id, col: 3.46, row: 7.1, style: "iron" }], "fora do grid, em centésimos de casa");

    assert.equal((await act(ana, "maptorch:add", { col: 1, row: 1, style: "stick" })).ok, false);
    assert.equal((await act(ana, "maptorch:move", { id, col: 1, row: 1 })).ok, false);
    assert.equal((await act(ana, "maptorch:erase", { points: [3.46, 7.1], radius: 1 })).ok, false);
    assert.equal((await act(ana, "maptorch:clear", {})).ok, false);
    assert.equal((await act(g, "maptorch:add", { col: 1, row: 1, style: "lampião" as "stick" })).ok, false);
    assert.equal((await act(g, "maptorch:add", { col: Infinity, row: 1, style: "stick" })).ok, false);

    assert.ok((await act(g, "maptorch:move", { id, col: 9.5, row: 2.25 })).ok);
    assert.deepEqual(game().battle.torches[0], { id, col: 9.5, row: 2.25, style: "iron" });

    // Longe não apaga; a borracha passando por cima, sim.
    assert.ok((await act(g, "maptorch:erase", { points: [40, 40], radius: 0.5 })).ok);
    assert.equal(game().battle.torches.length, 1);
    assert.ok((await act(g, "maptorch:erase", { points: [9, 2.25, 10, 2.25], radius: 0.25 })).ok);
    assert.equal(game().battle.torches.length, 0);

    idsOf(await act(g, "maptorch:add", { col: 1, row: 1, style: "brazier" }));
    assert.ok((await act(g, "maptorch:clear", {})).ok);
    assert.equal(game().battle.torches.length, 0);
  });

  it("com a visão dos personagens, a luz aparece de longe; atrás da névoa, a tocha nem chega; de dia não muda nada", async () => {
    const g = await client();
    await join(g, "Mestre");
    await act(g, "battle:clear", { keepTemplates: false });
    const bia = await client("10.60.0.2");
    await join(bia, "Bia");
    const [lia] = idsOf(await act(bia, "ally:create", { name: "Lia", hpMax: 20, dexMod: 0, ac: 14 }));
    await act(bia, "token:move", { id: lia, pos: { col: 0, row: 0 } });
    await act(g, "weather:set", { light: "night" });
    await act(g, "fog:set", { enabled: true });
    let ready = stateWhere(bia, (st) => st.battle.fog.vision);
    await act(g, "fog:vision", { enabled: true });
    await ready;

    // A 15 casas (75 ft): dentro do alcance de ver uma luz, com a casa dela revelada pela própria luz.
    ready = stateWhere(bia, (st) => st.battle.torches.length === 1);
    idsOf(await act(g, "maptorch:add", { col: 15.5, row: 0.5, style: "stick" }));
    let s: ClientState = await ready;
    assert.ok(inRows(s.battle.sight, 15, 0), "a luz da tocha é vista de longe");
    assert.ok(Object.values(s.battle.sight).flat().every(Number.isInteger), "as casas vistas são inteiras, mesmo com a tocha fora do grid");

    // De dia a tocha não abre visão além da normal, mas continua no mapa se a casa for vista.
    await act(g, "maptorch:clear", {});
    // Bem longe (200 casas): ninguém vê; o mestre recebe, o jogador não.
    idsOf(await act(g, "maptorch:add", { col: 200, row: 200, style: "iron" }));
    s = await stateWhere(bia, () => true);
    await act(g, "weather:set", { light: "moon" });
    s = await stateWhere(bia, (st) => st.battle.weather.light === "moon");
    assert.equal(s.battle.torches.length, 0, "tocha coberta pela névoa não chega ao jogador");
    assert.equal(game().battle.torches.length, 1);
  });

  it("é de cada cena, some ao limpar o campo e vai no arquivo de sessão", async () => {
    const g = await client();
    await join(g, "Mestre");
    await act(g, "battle:clear", { keepTemplates: false });
    idsOf(await act(g, "maptorch:add", { col: 2.5, row: 2.5, style: "brazier" }));
    const gm = [...ctx.server.store.players.values()].find((p) => p.role === "gm")!;
    const file = JSON.parse(JSON.stringify(exportSession(ctx.server.store)));
    await act(g, "battle:clear", { keepTemplates: false });
    assert.equal(game().battle.torches.length, 0);
    importSession(ctx.server.store, gm, file);
    assert.equal(game().battle.torches[0].style, "brazier");
    // Arquivo de antes das tochas abre sem nenhuma.
    delete file.game.battle.torches;
    importSession(ctx.server.store, gm, file);
    assert.deepEqual(game().battle.torches, []);
  });
});
