import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { ActionResult } from "@rpg/shared";
import { exportSession, importSession } from "../src/session-file";
import { act, join, stateWhere, useServer, type Client } from "./helpers";

// E26 — clima e luz do mapa: só o mestre muda; todos veem igual.
const { ctx, client } = useServer();
const weather = () => ctx.server.store.game.battle.weather;

function errorOf(res: ActionResult): string {
  assert.equal(res.ok, false);
  return res.ok ? "" : res.error;
}

async function gm(): Promise<Client> {
  const s = await client();
  await join(s, "Mestre");
  return s;
}

let ipSeq = 1;
async function player(name: string): Promise<Client> {
  const s = await client(`10.26.0.${ipSeq++}`);
  await join(s, name);
  return s;
}

describe("clima (E26)", () => {
  it("começa sem clima, de dia; o mestre liga e o jogador recebe igual", async () => {
    const g = await gm();
    const ana = await player("Ana");
    assert.equal(weather().kind, null);
    assert.equal(weather().light, "day");
    const seen = stateWhere(ana, (s) => s.battle.weather.kind === "storm");
    assert.ok((await act(g, "weather:set", { kind: "storm", intensity: 0.8, wind: 20, light: "night" })).ok);
    const s = await seen;
    assert.deepEqual(s.battle.weather, weather());
    assert.equal(s.battle.weather.light, "night");
    assert.ok(weather().startedAt > 0);
  });

  it("só os campos enviados mudam; a semente dos relâmpagos só muda com outro clima", async () => {
    const g = await gm();
    await act(g, "weather:set", { kind: "rain" });
    const seed = weather().startedAt;
    await act(g, "weather:set", { intensity: 1, wind: -15 });
    assert.equal(weather().kind, "rain");
    assert.equal(weather().startedAt, seed);
    assert.equal(weather().wind, -15);
    await new Promise((r) => setTimeout(r, 5));
    await act(g, "weather:set", { kind: "snow" });
    assert.notEqual(weather().startedAt, seed);
    await act(g, "weather:set", { kind: null });
    assert.equal(weather().kind, null);
    assert.equal(weather().intensity, 1, "intensidade fica para o próximo clima");
  });

  it("só o mestre muda; valores fora do permitido são recusados sem mudar nada", async () => {
    const g = await gm();
    const ana = await player("Ana");
    assert.match(errorOf(await act(ana, "weather:set", { kind: "rain" })), /Sem permissão/);
    assert.match(errorOf(await act(g, "weather:set", { kind: "tornado" as never })), /Clima desconhecido/);
    assert.equal(errorOf(await act(g, "weather:set", { kind: "rain", intensity: 5 })).length > 0, true);
    assert.equal(errorOf(await act(g, "weather:set", { wind: 90 })).length > 0, true);
    assert.match(errorOf(await act(g, "weather:set", { light: "eclipse" as never })), /Luz desconhecida/);
    assert.equal(weather().kind, null, "nada mudou pela metade");
  });

  it("limpar o campo volta para sem clima, de dia", async () => {
    const g = await gm();
    await act(g, "weather:set", { kind: "fog", light: "moon" });
    await act(g, "battle:clear", { keepTemplates: true });
    assert.equal(weather().kind, null);
    assert.equal(weather().light, "day");
  });

  it("vai no arquivo de sessão; arquivo antigo, sem clima, abre sem clima", async () => {
    const g = await gm();
    await act(g, "weather:set", { kind: "embers", intensity: 0.4, light: "dusk" });
    const file = JSON.parse(JSON.stringify(exportSession(ctx.server.store)));
    await act(g, "weather:set", { kind: null, light: "day" });
    importSession(ctx.server.store, ctx.server.store.findGm()!, file);
    assert.equal(weather().kind, "embers");
    assert.equal(weather().light, "dusk");
    delete file.game.battle.weather;
    importSession(ctx.server.store, ctx.server.store.findGm()!, file);
    assert.equal(weather().kind, null);
  });
});
