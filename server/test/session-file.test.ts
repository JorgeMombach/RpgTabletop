import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { SESSION_FILE_FORMAT, type ActionResult, type SessionFile } from "@rpg/shared";
import { Store } from "../src/store";
import { act, join, MAX, stateWhere, useServer, type Client } from "./helpers";

const { ctx, client } = useServer();

// PNG 1×1 válido.
const PNG = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=";

function idsOf(res: ActionResult): string[] {
  assert.ok(res.ok, res.ok ? "" : res.error);
  return res.ids ?? [];
}

async function gm(): Promise<Client> {
  const s = await client();
  await join(s, "Mestre");
  return s;
}

let ipSeq = 1;
async function player(name: string): Promise<Client> {
  const s = await client(`10.9.1.${ipSeq++}`);
  await join(s, name);
  return s;
}

async function exportFile(s: Client): Promise<SessionFile> {
  const res = await s.timeout(2000).emitWithAck("session:export");
  assert.ok(res.ok, res.ok ? "" : res.error);
  return res.file;
}

function importFile(s: Client, file: unknown): Promise<ActionResult> {
  return s.timeout(2000).emitWithAck("session:import", file);
}

/** Simula fechar e abrir o app: estado novo, ninguém conectado. */
async function restart() {
  for (const p of ctx.server.store.players.values()) p.sockets.clear();
  Object.assign(ctx.server.store, new Store(MAX));
}

/** Uma sessão com um pouco de tudo. */
async function busySession() {
  const g = await gm();
  const ana = await player("Ana");
  const [thorin] = idsOf(await act(ana, "ally:create", { name: "Thorin", hpMax: 30, dexMod: 1 }));
  await act(ana, "hp:change", { id: thorin, delta: -8 });
  await act(ana, "slot:set", { id: thorin, level: 1, max: 3, used: 1 });
  await act(ana, "spell:add", { id: thorin, name: "Escudo", level: 1, note: "+5 CA" });
  await act(ana, "condition:add", { id: thorin, name: "Abençoado", rounds: 3 });
  const [tid] = idsOf(await act(g, "template:upsert", { name: "Goblin", hpMax: 7, dexMod: 2, notes: "Covarde" }));
  const [g1, g2] = idsOf(await act(g, "mob:addFromTemplate", { templateId: tid, qty: 2 }));
  const [npc] = idsOf(await act(g, "npc:add", { name: "Guarda", hpMax: 11, dexMod: 0 }));
  await act(g, "battle:setMap", { image: PNG });
  await act(g, "battle:grid", { cellPx: 70, rotation: 90, imageScale: 1.5 });
  await act(g, "token:move", { id: g1, pos: { col: 3, row: 4 } });
  await act(g, "init:set", { id: g1, value: 15 });
  await act(ana, "init:set", { id: thorin, value: 18 });
  await act(g, "combat:start", {});
  await act(ana, "effect:add", { name: "Teia", preset: "web", casterId: thorin, rounds: 5, concentration: true, area: { kind: "cube", origin: { col: 1, row: 1 }, angle: 0, feet: 20 } });
  await act(ana, "dice:roll", { expr: "1d20+5", kind: "attack" });
  return { g, ana, thorin, tid, g1, g2, npc };
}

describe("salvar e carregar sessão", () => {
  it("exportar → fechar o app → abrir → importar recupera o estado completo", async () => {
    const { g, thorin } = await busySession();
    const file = await exportFile(g);
    const before = structuredClone(ctx.server.store.game);
    g.disconnect();

    await restart();
    const g2 = await gm();
    assert.ok((await importFile(g2, JSON.parse(JSON.stringify(file)))).ok);

    const after = ctx.server.store.game;
    const gmId = [...ctx.server.store.players.values()].find((p) => p.role === "gm")!.id;
    // Dono do personagem e autores do log mudam de id (jogadores novos); o resto é igual.
    const strip = (game: typeof before) => {
      const copy: typeof before = JSON.parse(JSON.stringify(game));
      copy.allies.forEach((a) => delete a.ownerId);
      copy.battle.effects.forEach((e) => (e.ownerId = ""));
      copy.log.forEach((e) => (e.authorId = ""));
      copy.battle.map.imageVersion = 0;
      return copy;
    };
    assert.deepEqual(strip(after), strip(before));
    assert.equal(after.battle.map.image, PNG);
    assert.equal(after.allies.find((a) => a.id === thorin)?.hp, 22);
    assert.equal(after.battle.combat.active, true);
    assert.equal(ctx.server.store.mobCounters.size, 1, "numeração dos mobs continua");
    assert.notEqual(after.allies[0].ownerId, gmId);
  });

  it("jogador volta com o mesmo nome e reencontra o personagem", async () => {
    const { g, thorin } = await busySession();
    const file = await exportFile(g);
    await restart();
    const g2 = await gm();
    await importFile(g2, file);

    const ana = await client("10.9.9.9");
    const seen = stateWhere(ana, (s) => s.allies.length === 1);
    await join(ana, "ana"); // sem token, nome em outra caixa
    const s = await seen;
    assert.equal(s.allies[0].ownerId, s.self.id, "personagem é dele");
    assert.ok((await act(ana, "hp:change", { id: thorin, delta: -1 })).ok);
    assert.equal(ctx.server.store.game.battle.effects[0].ownerId, s.self.id, "efeito também");

    const impostora = await client("10.9.9.8");
    await join(impostora, "Ana");
    assert.equal((await act(impostora, "hp:change", { id: thorin, delta: -1 })).ok, false, "só o primeiro assume");
  });

  it("jogador já conectado com o mesmo nome é religado na hora", async () => {
    const { g } = await busySession();
    const file = await exportFile(g);
    await restart();
    const g2 = await gm();
    await player("Ana");
    const anaId = [...ctx.server.store.players.values()].find((p) => p.name === "Ana")!.id;
    await importFile(g2, file);
    assert.equal(ctx.server.store.game.allies[0].ownerId, anaId);
  });

  it("o arquivo não leva tokens de sessão nem a chave de mestre", async () => {
    const { g } = await busySession();
    const json = JSON.stringify(await exportFile(g));
    for (const p of ctx.server.store.players.values()) assert.ok(!json.includes(p.token), "token de " + p.name);
    assert.ok(!json.includes(ctx.server.host.gmKey));
  });

  it("arquivo inválido ou de formato futuro é recusado com mensagem clara, sem mexer no estado", async () => {
    const { g } = await busySession();
    const file = await exportFile(g);
    const before = JSON.stringify(ctx.server.store.game);

    const cases: [unknown, RegExp][] = [
      ["texto", /Arquivo inválido/],
      [{ ...file, app: "outro-app" }, /não é uma sessão do Jamal's Tabletop/],
      [{ ...file, format: SESSION_FILE_FORMAT + 1 }, /versão mais nova do app/],
      [{ ...file, game: { ...file.game, allies: [{ ...file.game.allies[0], hp: 999 }] } }, /vida/],
      [{ ...file, game: { ...file.game, battle: { ...file.game.battle, combat: { ...file.game.battle.combat, order: ["fantasma"] } } } }, /ordem de iniciativa/],
      [{ ...file, game: { ...file.game, battle: { ...file.game.battle, map: { ...file.game.battle.map, image: "javascript:alert(1)" } } } }, /Mapa/],
    ];
    for (const [bad, message] of cases) {
      const res = await importFile(g, bad);
      assert.equal(res.ok, false);
      assert.match(res.ok ? "" : res.error, message);
    }
    assert.equal(JSON.stringify(ctx.server.store.game), before);
  });

  it("só o mestre salva e carrega", async () => {
    const { g, ana } = await busySession();
    const file = await exportFile(g);
    const res = await ana.timeout(2000).emitWithAck("session:export");
    assert.equal(res.ok, false);
    assert.equal((await importFile(ana, file)).ok, false);
  });
});
