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

  /** Quadros iguais a partir de `from` (ms), até acabarem ou o detector parar; devolve o resultado e a hora em que parou. */
  function feed(watch: FrameWatch, from: number, count: number, frameMs: number, busy = false): { ok: boolean; at: number } {
    let ok = true;
    let at = from;
    for (let i = 0; i < count; i++) {
      at += frameMs;
      ok = watch.tick(frameMs, at, busy);
      if (!ok) break;
    }
    return { ok, at };
  }

  it("detector: 30 quadros por segundo aguenta; 12 por segundo não", () => {
    assert.equal(feed(new FrameWatch(), 0, 300, 33).ok, true);
    const slow = new FrameWatch();
    const { ok, at } = feed(slow, 0, 60, 80);
    assert.equal(ok, false);
    assert.equal(slow.tick(16, at + 16, false), false, "parado até a hora de tentar de novo");
  });

  it("detector: um quadro enorme (aba voltando) não desliga", () => {
    const watch = new FrameWatch();
    const { at } = feed(watch, 0, 100, 33);
    assert.equal(watch.tick(5000, at + 5000, false), true);
    assert.equal(feed(watch, at + 5000, 100, 33).ok, true);
  });

  it("detector: quadros lentos com o mapa ocupado não contam", () => {
    assert.equal(feed(new FrameWatch(), 0, 60, 80, true).ok, true);
  });

  it("detector: parou, tenta de novo depois de 5 s, depois de 15 s", () => {
    const watch = new FrameWatch();
    const first = feed(watch, 0, 60, 80);
    assert.equal(first.ok, false);
    assert.equal(watch.resumeAt, first.at + 5000);
    assert.equal(watch.tick(16, first.at + 4999, false), false);
    assert.equal(watch.tick(16, first.at + 5000, false), true, "volta na hora");
    const second = feed(watch, first.at + 5000, 60, 80);
    assert.equal(second.ok, false);
    assert.equal(watch.resumeAt, second.at + 15000, "a espera cresce");
  });

  it("detector: 60 s animando bem zera a espera", () => {
    const watch = new FrameWatch();
    const first = feed(watch, 0, 60, 80);
    const second = feed(watch, first.at + 5000, 60, 80);
    const calm = feed(watch, second.at + 15000, 3700, 16.7);
    assert.equal(calm.ok, true);
    const third = feed(watch, calm.at, 60, 80);
    assert.equal(third.ok, false);
    assert.equal(watch.resumeAt, third.at + 5000);
  });
});
