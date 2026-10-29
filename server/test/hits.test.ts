import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { ActionResult, HpHit } from "@rpg/shared";
import { act, join, type Client, useServer } from "./helpers";

// L6: o número que sobe do token (golpe ou cura), para todos, sem revelar a vida dos mobs.
const { client } = useServer();

function idsOf(res: ActionResult): string[] {
  assert.ok(res.ok, res.ok ? "" : res.error);
  return res.ids ?? [];
}

/** Junta os golpes que chegam a este socket. */
function collect(s: Client): HpHit[] {
  const got: HpHit[] = [];
  s.on("fx:hp", (hits) => got.push(...hits));
  return got;
}

const settle = () => new Promise((r) => setTimeout(r, 120));

async function setup() {
  const g = await client();
  await join(g, "Mestre");
  const ana = await client("10.60.0.1");
  await join(ana, "Ana");
  return { g, ana, gmHits: collect(g), anaHits: collect(ana) };
}

describe("golpes e curas (fx:hp)", () => {
  it("o jogador recebe o número do golpe no mob, mas nunca a vida dele", async () => {
    const { g, ana, gmHits, anaHits } = await setup();
    const [goblin] = idsOf(await act(g, "mob:add", { name: "Goblin", hpMax: 12, dexMod: 0 }));
    await settle();
    await act(g, "hp:change", { id: goblin, delta: -5 });
    await act(g, "hp:change", { id: goblin, delta: 2 });
    await settle();
    assert.deepEqual(anaHits, [{ id: goblin, delta: -5 }, { id: goblin, delta: 2 }]);
    assert.deepEqual(gmHits, anaHits);
    // A vida continua escondida no estado do jogador.
    const seen = await new Promise<Record<string, unknown>>((r) => {
      ana.once("state:full", (s) => r(s.battle.mobs[0] as unknown as Record<string, unknown>));
      void act(g, "hp:change", { id: goblin, delta: -1 });
    });
    assert.equal(seen.hp, undefined);
  });

  it("mob oculto: o mestre vê o golpe, o jogador não", async () => {
    const { g, gmHits, anaHits } = await setup();
    const [espreita] = idsOf(await act(g, "mob:add", { name: "Espreita", hpMax: 10, dexMod: 0, hidden: true }));
    await settle();
    await act(g, "hp:change", { id: espreita, delta: -3 });
    await settle();
    assert.deepEqual(gmHits, [{ id: espreita, delta: -3 }]);
    assert.deepEqual(anaHits, []);
  });

  it("vida temporária conta; troca de fase do chefe não vira cura", async () => {
    const { g, gmHits } = await setup();
    const [chefe] = idsOf(await act(g, "mob:add", { name: "Lich", hpMax: 10, dexMod: 0, phases: [{ hpMax: 30 }] }));
    await settle();
    await act(g, "hp:temp", { id: chefe, value: 5 });
    await settle();
    assert.deepEqual(gmHits, [{ id: chefe, delta: 5 }]);
    gmHits.length = 0;
    // Zera a fase 1: a fase 2 começa com 30 de vida; nada de "+30" voando.
    await act(g, "hp:change", { id: chefe, delta: -15 });
    await settle();
    assert.deepEqual(gmHits, []);
  });
});
