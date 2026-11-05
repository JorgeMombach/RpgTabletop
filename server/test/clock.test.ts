import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { ActionResult } from "@rpg/shared";
import { lightFor } from "../src/actions/clock";
import { act, join, stateWhere, useServer, type Client } from "./helpers";

// Passo 15: calendário e hora do jogo.
const { ctx, client } = useServer();
const game = () => ctx.server.store.game;

function errorOf(res: ActionResult): string {
  assert.equal(res.ok, false, "deveria recusar");
  return res.ok ? "" : res.error;
}

describe("hora do jogo", () => {
  it("a luz segue a hora: dia, entardecer (amanhecer e fim de tarde) e noite", () => {
    assert.equal(lightFor(4 * 60 + 59), "night");
    assert.equal(lightFor(5 * 60), "dusk");
    assert.equal(lightFor(6 * 60), "day");
    assert.equal(lightFor(17 * 60 + 59), "day");
    assert.equal(lightFor(18 * 60), "dusk");
    assert.equal(lightFor(20 * 60), "night");
  });

  it("só o mestre liga, acerta, avança e desliga; todos veem a hora", async () => {
    const g: Client = await client();
    await join(g, "Mestre");
    const ana: Client = await client("10.84.0.1");
    await join(ana, "Ana");
    assert.equal(game().clock, null, "começa desligado");
    assert.match(errorOf(await act(ana, "clock:set", { clock: { day: 1, minutes: 0, lightFollows: false } })), /permissão/);

    assert.ok((await act(g, "clock:set", { clock: { day: 3, minutes: 14 * 60, lightFollows: false } })).ok);
    await stateWhere(ana, (s) => s.clock?.day === 3 && s.clock.minutes === 840);
    assert.match(errorOf(await act(ana, "clock:advance", { minutes: 60 })), /permissão/);

    // Descanso longo: passa da meia-noite e vira o dia; o log avisa todos.
    game().clock!.minutes = 20 * 60;
    assert.ok((await act(g, "clock:advance", { minutes: 8 * 60 })).ok);
    assert.deepEqual(game().clock, { day: 4, minutes: 4 * 60 });
    const last = game().log.at(-1)!;
    assert.equal(last.textKey, "Agora é dia {day}, {time}.");
    assert.deepEqual(last.textParams, { day: 4, time: "04:00" });
    assert.equal(last.hidden, undefined);

    assert.match(errorOf(await act(g, "clock:advance", { minutes: 0 })), /Minutos/);
    assert.match(errorOf(await act(g, "clock:set", { clock: { day: 0, minutes: 0, lightFollows: false } })), /Dia/);
    assert.match(errorOf(await act(g, "clock:set", { clock: { day: 1, minutes: 1440, lightFollows: false } })), /Hora/);
    assert.ok((await act(g, "clock:set", { clock: null })).ok);
    assert.equal(game().clock, null);
    assert.match(errorOf(await act(g, "clock:advance", { minutes: 60 })), /Ligue/);
  });

  it("com a luz acompanhando, acertar e avançar mudam a luz do clima", async () => {
    const g: Client = await client();
    await join(g, "Mestre");
    assert.ok((await act(g, "clock:set", { clock: { day: 1, minutes: 12 * 60, lightFollows: true } })).ok);
    assert.equal(game().battle.weather.light, "day");
    assert.ok((await act(g, "clock:advance", { minutes: 6 * 60 + 30 })).ok);
    assert.equal(game().battle.weather.light, "dusk");
    assert.ok((await act(g, "clock:advance", { minutes: 3 * 60 })).ok);
    assert.equal(game().battle.weather.light, "night");
    assert.equal(game().clock?.lightFollows, true);
  });
});
