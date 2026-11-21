import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { FrameWatch, gust, windOf, type WeatherState } from "@rpg/shared";

// Vento nas plantas (docs/design/vento.md): força pelo clima, rajada que atravessa o mapa e o detector de aparelho lento.
const weather = (partial: Pick<WeatherState, "kind" | "intensity" | "wind">): WeatherState => ({ light: "day", startedAt: 0, ...partial });

describe("vento: contas", () => {
  it("brisa sem clima, mais forte em clima de vento", () => {
    assert.deepEqual(windOf(null), { strength: 1, direction: 1 });
    assert.deepEqual(windOf(weather({ kind: "rain", intensity: 1, wind: 20 })), { strength: 1, direction: 1 });
    assert.deepEqual(windOf(weather({ kind: "leaves", intensity: 0.6, wind: -30 })), { strength: 1.6, direction: -1 });
    for (const kind of ["blizzard", "sand", "storm"] as const) assert.equal(windOf(weather({ kind, intensity: 1, wind: 0 })).strength, 2);
  });

  it("a rajada anda 8 casas por segundo no sentido do vento", () => {
    assert.ok(Math.abs(gust(3, 2, 5, 7, 1) - gust(4, 10, 5, 7, 1)) < 1e-9);
    assert.ok(Math.abs(gust(3, 2, 5, 7, -1) - gust(4, -6, 5, 7, -1)) < 1e-9);
  });

  it("a rajada fica entre -0,9 e 0,9", () => {
    for (let t = 0; t < 60; t += 0.37) assert.ok(Math.abs(gust(t, t * 3, t, 11, 1)) <= 0.9 + 1e-9);
  });

  it("detector: 30 quadros por segundo aguenta; 12 por segundo não", () => {
    const smooth = new FrameWatch();
    for (let i = 0; i < 300; i++) assert.equal(smooth.tick(33), true);
    const slow = new FrameWatch();
    let ok = true;
    for (let i = 0; i < 60; i++) ok = slow.tick(80);
    assert.equal(ok, false);
    assert.equal(slow.tick(16), false, "desligado continua desligado");
  });

  it("detector: um quadro enorme (aba voltando) não desliga", () => {
    const watch = new FrameWatch();
    for (let i = 0; i < 100; i++) watch.tick(33);
    assert.equal(watch.tick(5000), true);
    for (let i = 0; i < 100; i++) assert.equal(watch.tick(33), true);
  });
});
