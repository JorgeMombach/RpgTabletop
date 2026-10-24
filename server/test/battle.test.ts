import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { ActionResult, MapImagePayload } from "@rpg/shared";
import { act, join, stateWhere, useServer } from "./helpers";

const { ctx, client } = useServer();

const PNG = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=";

function idsOf(res: ActionResult): string[] {
  assert.ok(res.ok, res.ok ? "" : res.error);
  return res.ids ?? [];
}

/** Monta uma batalha completa: mapa, grid, template, mobs, aliado ferido com slots, combate rolando. */
async function battleInProgress() {
  const g = await client();
  await join(g, "Mestre");
  const p = await client("10.6.0.1");
  await join(p, "Ana");

  await act(g, "battle:setMap", { image: PNG });
  await act(g, "battle:grid", { cellPx: 70, offsetX: 25, offsetY: 25 });
  const [tid] = idsOf(await act(g, "template:upsert", { name: "Goblin", hpMax: 7, dexMod: 2 }));
  const mobs = idsOf(await act(g, "mob:addFromTemplate", { templateId: tid, qty: 3 }));
  await act(g, "token:move", { id: mobs[0], pos: { col: 1, row: 1 } });
  await act(g, "mob:remove", { id: mobs[2] });

  const [ally] = idsOf(await act(p, "ally:create", { name: "Thorin", hpMax: 30, dexMod: 1 }));
  await act(p, "hp:change", { id: ally, delta: -12 });
  await act(p, "slot:set", { id: ally, level: 1, max: 3, used: 2 });
  await act(p, "spell:add", { id: ally, name: "Sono", level: 1 });
  await act(p, "token:move", { id: ally, pos: { col: 2, row: 2 } });
  await act(p, "dice:roll", { expr: "1d20" });

  await act(p, "init:set", { id: ally, value: 15 });
  await act(g, "init:rollMobs", {});
  await act(g, "combat:start", {});
  await act(g, "combat:next", {});
  return { g, p, tid, mobs, ally };
}

describe("limpar campo de batalha", () => {
  it("remove mapa, mobs, iniciativa e posições; mantém aliados, grid, log e jogadores", async () => {
    const { g, p, mobs, ally } = await battleInProgress();

    const imageCleared = new Promise<MapImagePayload>((resolve) => p.once("map:image", resolve));
    const after = stateWhere(p, (s) => s.battle.mobs.length === 0);
    assert.ok((await act(g, "battle:clear", { keepTemplates: true })).ok);

    assert.equal((await imageCleared).image, null, "todos recebem o mapa vazio");
    const s = await after;
    assert.equal(s.battle.map.hasImage, false);
    assert.deepEqual({ ...s.battle.combat, turn: 0 }, { active: false, round: 0, turnIndex: 0, order: [], turn: 0 });
    assert.equal(s.battle.map.cellPx, 70, "grid continua");

    const a = s.allies.find((x) => x.id === ally)!;
    assert.equal(a.hp, 18, "vida continua como estava");
    assert.equal(a.spellSlots?.[1].used, 2, "slots continuam");
    assert.equal(a.spells?.length, 1, "magias continuam");
    assert.equal(a.pos, null, "aliado sai do mapa");
    assert.equal(a.initiative, null);

    assert.equal(s.log.length, 1, "log de dados continua");
    assert.ok(s.players.every((pl) => pl.connected), "ninguém é desconectado");

    // Mob removido antes da limpeza não volta mais.
    assert.equal((await act(g, "mob:restore", { id: mobs[2] })).ok, false);
  });

  it("com bestiário mantido, a batalha nova recomeça a numeração em 1", async () => {
    const { g, tid } = await battleInProgress();
    await act(g, "battle:clear", { keepTemplates: true });
    assert.equal(ctx.server.store.game.templates.length, 1);

    const [id] = idsOf(await act(g, "mob:addFromTemplate", { templateId: tid, qty: 1 }));
    assert.equal(ctx.server.store.game.battle.mobs.find((m) => m.id === id)?.name, "Goblin 1");
    assert.ok((await act(g, "battle:setMap", { image: PNG })).ok, "já dá para montar o próximo mapa");
  });

  it("sem manter o bestiário, os templates somem", async () => {
    const { g } = await battleInProgress();
    await act(g, "battle:clear", { keepTemplates: false });
    assert.equal(ctx.server.store.game.templates.length, 0);
  });

  it("só o mestre limpa o campo", async () => {
    const { p } = await battleInProgress();
    assert.equal((await act(p, "battle:clear", { keepTemplates: true })).ok, false);
    assert.equal(ctx.server.store.game.battle.mobs.length, 2);
  });
});
