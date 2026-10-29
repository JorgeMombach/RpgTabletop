import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { ActionResult, Area, AreaBroadcast, MapImagePayload, RulerBroadcast } from "@rpg/shared";
import { validArea } from "../src/validate";
import { act, join, stateWhere, useServer, type Client } from "./helpers";

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
  const s = await client(`10.3.0.${ipSeq++}`);
  await join(s, name);
  return s;
}

function nextImage(s: Client): Promise<MapImagePayload> {
  return new Promise((resolve) => s.once("map:image", resolve));
}

const map = () => ctx.server.store.game.battle.map;

describe("imagem do mapa", () => {
  it("mestre sobe o mapa e todos recebem; quem entra depois também", async () => {
    const g = await gm();
    const p = await player("Ana");

    const got = nextImage(p);
    assert.ok((await act(g, "battle:setMap", { image: PNG })).ok);
    assert.equal((await got).image, PNG);

    const late = await client("10.3.9.9");
    const lateGot = nextImage(late);
    await join(late, "Bia");
    assert.equal((await lateGot).image, PNG);
  });

  it("a imagem não vai no estado, só a flag", async () => {
    const g = await gm();
    const next = stateWhere(g, (st) => st.battle.map.hasImage);
    await act(g, "battle:setMap", { image: PNG });
    const s = await next;
    assert.ok(!JSON.stringify(s).includes("base64"));
  });

  it("jogador não troca o mapa; formatos inválidos são recusados", async () => {
    const g = await gm();
    const p = await player("Ana");
    assert.equal((await act(p, "battle:setMap", { image: PNG })).ok, false);
    for (const bad of ["oi", "data:image/svg+xml;base64,PHN2Zz4=", "javascript:alert(1)"]) {
      assert.equal((await act(g, "battle:setMap", { image: bad })).ok, false, bad);
    }
    assert.equal(map().image, null);
  });

  it("quem ficou sem a imagem pede de novo; quem não entrou, não recebe", async () => {
    const g = await gm();
    await act(g, "battle:setMap", { image: PNG });
    const p = await player("Caio");
    const again = nextImage(p);
    p.emit("map:imageRequest");
    const got = await again;
    assert.equal(got.image, PNG);
    assert.equal(got.version, map().imageVersion);

    const stranger = await client("10.3.9.8");
    let leaked = false;
    stranger.once("map:image", () => (leaked = true));
    stranger.emit("map:imageRequest");
    await new Promise((r) => setTimeout(r, 150));
    assert.equal(leaked, false);
  });

  it("remover o mapa avisa todos", async () => {
    const g = await gm();
    await act(g, "battle:setMap", { image: PNG });
    const got = nextImage(g);
    await act(g, "battle:setMap", { image: null });
    assert.equal((await got).image, null);
  });
});

describe("grid", () => {
  it("mestre calibra tamanho e deslocamento; offset fica dentro de um quadrado", async () => {
    const g = await gm();
    assert.ok((await act(g, "battle:grid", { cellPx: 70.5, offsetX: 150, offsetY: -10, showGrid: false })).ok);
    assert.equal(map().cellPx, 70.5);
    assert.equal(map().offsetX, 9);
    assert.equal(map().offsetY, 60.5);
    assert.equal(map().showGrid, false);
  });

  it("recusa valores fora do limite e jogador não mexe", async () => {
    const g = await gm();
    const p = await player("Ana");
    assert.equal((await act(g, "battle:grid", { cellPx: 2 })).ok, false);
    assert.equal((await act(p, "battle:grid", { cellPx: 60 })).ok, false);
    assert.equal(map().cellPx, 50);
  });
});

describe("tokens", () => {
  it("jogador move só o próprio token; mestre move qualquer um", async () => {
    const g = await gm();
    const ana = await player("Ana");
    const bia = await player("Bia");
    const [anaId] = idsOf(await act(ana, "ally:create", { name: "Thorin", hpMax: 30, dexMod: 1 }));
    const [biaId] = idsOf(await act(bia, "ally:create", { name: "Lyra", hpMax: 20, dexMod: 3 }));
    const [mobId] = idsOf(await act(g, "mob:add", { name: "Goblin", hpMax: 7, dexMod: 2 }));

    assert.ok((await act(ana, "token:move", { id: anaId, pos: { col: 3, row: 4 } })).ok);
    assert.equal((await act(ana, "token:move", { id: biaId, pos: { col: 0, row: 0 } })).ok, false);
    assert.equal((await act(ana, "token:move", { id: mobId, pos: { col: 0, row: 0 } })).ok, false);
    assert.ok((await act(g, "token:move", { id: biaId, pos: { col: 9, row: 9 } })).ok);
    assert.ok((await act(g, "token:move", { id: mobId, pos: { col: 5, row: 5 } })).ok);

    const s = await stateWhere(bia, (st) => st.battle.mobs[0]?.pos?.col === 5);
    assert.deepEqual(s.allies.map((a) => a.pos), [{ col: 3, row: 4 }, { col: 9, row: 9 }]);

    assert.ok((await act(ana, "token:move", { id: anaId, pos: null })).ok, "tirar do mapa");
  });

  it("dois tokens não ocupam a mesma casa", async () => {
    const g = await gm();
    const [a] = idsOf(await act(g, "mob:add", { name: "Goblin 1", hpMax: 7, dexMod: 0 }));
    const [b] = idsOf(await act(g, "npc:add", { name: "Guarda", hpMax: 7, dexMod: 0 }));
    assert.ok((await act(g, "token:move", { id: a, pos: { col: 2, row: 2 } })).ok);
    const res = await act(g, "token:move", { id: b, pos: { col: 2, row: 2 } });
    assert.equal(res.ok, false);
    assert.match(res.ok ? "" : res.error, /ocupada por Goblin 1/);
    assert.ok((await act(g, "token:move", { id: a, pos: { col: 2, row: 2 } })).ok, "ficar na própria casa vale");
    assert.ok((await act(g, "token:move", { id: a, pos: null })).ok);
    assert.ok((await act(g, "token:move", { id: b, pos: { col: 2, row: 2 } })).ok, "casa liberada");
  });

  it("movimento é livre (sem limite de distância), mas a coordenada é validada", async () => {
    const p = await player("Ana");
    const [id] = idsOf(await act(p, "ally:create", { name: "Thorin", hpMax: 30, dexMod: 1 }));
    assert.ok((await act(p, "token:move", { id, pos: { col: 0, row: 0 } })).ok);
    assert.ok((await act(p, "token:move", { id, pos: { col: 500, row: 500 } })).ok);
    assert.equal((await act(p, "token:move", { id, pos: { col: 1.5, row: 0 } })).ok, false);
    assert.equal((await act(p, "token:move", { id, pos: { col: 1e9, row: 0 } })).ok, false);
  });
});

describe("avatar", () => {
  it("aceita imagem pequena, remove com null e recusa formato inválido", async () => {
    const p = await player("Ana");
    const [id] = idsOf(await act(p, "ally:create", { name: "Thorin", hpMax: 30, dexMod: 1, avatar: PNG }));
    const ally = () => ctx.server.store.game.allies.find((a) => a.id === id)!;
    assert.equal(ally().avatar, PNG);

    assert.equal((await act(p, "combatant:update", { id, avatar: "data:text/html;base64,PGI+" })).ok, false);
    assert.equal(ally().avatar, PNG);

    assert.ok((await act(p, "combatant:update", { id, avatar: null })).ok);
    assert.equal(ally().avatar, undefined);
  });

  it("mobs herdam o avatar do template", async () => {
    const g = await gm();
    const [tid] = idsOf(await act(g, "template:upsert", { name: "Goblin", hpMax: 7, dexMod: 2, avatar: PNG }));
    const [mid] = idsOf(await act(g, "mob:addFromTemplate", { templateId: tid, qty: 1 }));
    assert.equal(ctx.server.store.game.battle.mobs.find((m) => m.id === mid)?.avatar, PNG);
  });
});

describe("régua", () => {
  it("é repassada aos outros (não a quem mede) e some quando a pessoa sai", async () => {
    const g = await gm();
    const p = await player("Ana");
    const ownEcho: RulerBroadcast[] = [];
    p.on("ruler", (r) => ownEcho.push(r));

    const seen = new Promise<RulerBroadcast>((resolve) => g.once("ruler", resolve));
    p.emit("ruler:update", { from: { col: 0, row: 0 }, to: { col: 6, row: 0 } });
    const r = await seen;
    assert.equal(r.name, "Ana");
    assert.deepEqual(r.ruler, { from: { col: 0, row: 0 }, to: { col: 6, row: 0 } });

    const cleared = new Promise<RulerBroadcast>((resolve) => g.once("ruler", resolve));
    p.disconnect();
    assert.equal((await cleared).ruler, null);
    assert.equal(ownEcho.length, 0);
  });

  it("régua malformada vira null", async () => {
    const g = await gm();
    const p = await player("Ana");
    const seen = new Promise<RulerBroadcast>((resolve) => g.once("ruler", resolve));
    p.emit("ruler:update", { from: { col: "x", row: 0 }, to: { col: 1, row: 1 } } as never);
    assert.equal((await seen).ruler, null);
  });
});

describe("rotação e escala do mapa (E17)", () => {
  it("gira em passos de 90° e escala a imagem sem mexer no grid nem nos tokens", async () => {
    const g = await gm();
    const [mob] = idsOf(await act(g, "mob:add", { name: "Goblin", hpMax: 7, dexMod: 0 }));
    await act(g, "token:move", { id: mob, pos: { col: 3, row: 4 } });
    await act(g, "battle:setMap", { image: PNG });

    assert.ok((await act(g, "battle:grid", { rotation: 90, imageScale: 1.5 })).ok);
    assert.equal(map().rotation, 90);
    assert.equal(map().imageScale, 1.5);
    assert.ok((await act(g, "battle:grid", { rotation: -90 })).ok);
    assert.equal(map().rotation, 270, "−90 = 270");
    assert.equal(map().cellPx, 50, "grid não muda");
    assert.deepEqual(ctx.server.store.game.battle.mobs[0].pos, { col: 3, row: 4 }, "token não muda");
  });

  it("recusa ângulo fora dos passos de 90° e escala fora do limite, sem alterar nada", async () => {
    const g = await gm();
    assert.equal((await act(g, "battle:grid", { rotation: 45, cellPx: 60 })).ok, false);
    assert.equal((await act(g, "battle:grid", { imageScale: 0 })).ok, false);
    assert.equal((await act(g, "battle:grid", { imageScale: 50 })).ok, false);
    assert.equal(map().cellPx, 50);
    assert.deepEqual([map().rotation, map().imageScale], [0, 1]);
  });

  it("imagem nova volta para 0° e escala 1; limpar o campo também", async () => {
    const g = await gm();
    await act(g, "battle:setMap", { image: PNG });
    await act(g, "battle:grid", { rotation: 180, imageScale: 2 });
    await act(g, "battle:setMap", { image: PNG });
    assert.deepEqual([map().rotation, map().imageScale], [0, 1]);
    await act(g, "battle:grid", { rotation: 180, imageScale: 2 });
    await act(g, "battle:clear", { keepTemplates: true });
    assert.deepEqual([map().rotation, map().imageScale], [0, 1]);
  });
});

describe("áreas de magia (E17)", () => {
  it("área é repassada aos outros com o nome de quem desenhou e some ao sair", async () => {
    const g = await gm();
    const p = await player("Ana");
    const cone: Area = { kind: "cone", origin: { col: 2.5, row: 3 }, angle: Math.PI / 2, feet: 15 };
    const seen = new Promise<AreaBroadcast>((resolve) => g.once("area", resolve));
    p.emit("area:update", cone);
    const a = await seen;
    assert.equal(a.name, "Ana");
    assert.deepEqual(a.area, cone);

    const cleared = new Promise<AreaBroadcast>((resolve) => g.once("area", resolve));
    p.disconnect();
    assert.equal((await cleared).area, null);
  });

  it("área malformada vira null", () => {
    const ok: Area = { kind: "sphere", origin: { col: 0, row: 0 }, angle: 0, feet: 20 };
    assert.deepEqual(validArea(ok), ok);
    for (const bad of [
      { ...ok, kind: "hexagono" },
      { ...ok, origin: { col: 0.3, row: 0 } },
      { ...ok, feet: 0 },
      { ...ok, feet: 12.5 },
      { ...ok, angle: Number.NaN },
      null,
      "cone",
    ]) {
      assert.equal(validArea(bad), null, JSON.stringify(bad));
    }
  });
});
