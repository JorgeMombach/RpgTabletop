import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { isRevealed, LIMITS, propOccluders, sightCells, type ActionResult, type MapProp } from "@rpg/shared";
import { exportSession, importSession } from "../src/session-file";
import { act, join, stateWhere, useServer, type Client } from "./helpers";

// Cenário, passo 2 (docs/design/cenario.md): objetos no mapa (árvore, pedregulho, barril…), só do mestre.
const { ctx, client } = useServer();
const props = () => ctx.server.store.game.battle.props;

function idsOf(res: ActionResult): string[] {
  assert.ok(res.ok, res.ok ? "" : res.error);
  return res.ids ?? [];
}

function errorOf(res: ActionResult): string {
  assert.equal(res.ok, false, "deveria recusar");
  return res.ok ? "" : res.error;
}

let ipSeq = 1;
async function setup() {
  const g: Client = await client();
  await join(g, "Mestre");
  const ana: Client = await client(`10.74.0.${ipSeq++}`);
  await join(ana, "Ana");
  return { g, ana };
}

describe("objetos no mapa", () => {
  it("o mestre põe objetos; o tipo dá a camada e se bloqueia a visão; jogador e tipo inválido são recusados", async () => {
    const { g, ana } = await setup();
    const [arvore] = idsOf(await act(g, "prop:add", { kind: "tree", col: 3.456, row: 2, seed: 42 }));
    const [barril] = idsOf(await act(g, "prop:add", { kind: "barrel", col: 5, row: 5 }));
    const a = props().find((p) => p.id === arvore)!;
    assert.deepEqual({ ...a, id: "" }, { id: "", kind: "tree", col: 3.46, row: 2, size: 1, rotation: 0, seed: 42, above: true, blocks: true } satisfies MapProp);
    const b = props().find((p) => p.id === barril)!;
    assert.equal(b.above, false);
    assert.equal(b.blocks, false);
    assert.ok(Number.isInteger(b.seed) && b.seed >= 0, "sem semente: o servidor sorteia");
    assert.match(errorOf(await act(ana, "prop:add", { kind: "tree", col: 1, row: 1 })), /permissão/);
    assert.match(errorOf(await act(g, "prop:add", { kind: "dragão" as "tree", col: 1, row: 1 })), /Objeto inválido/);
    assert.match(errorOf(await act(g, "prop:add", { kind: "tree", col: LIMITS.gridCoord + 1, row: 1 })), /Lugar do objeto inválido/);
    assert.equal(props().length, 2);
  });

  it("mexer: lugar, tamanho, giro, semente, camada e bloqueio; valor inválido não muda nada", async () => {
    const { g } = await setup();
    const [id] = idsOf(await act(g, "prop:add", { kind: "crate", col: 1, row: 1 }));
    assert.ok((await act(g, "prop:update", { id, col: 2.5, row: 3, size: 1.75, rotation: -90, seed: 7, above: true, blocks: true })).ok);
    const p = props()[0];
    assert.deepEqual([p.col, p.row, p.size, p.rotation, p.seed, p.above, p.blocks], [2.5, 3, 1.75, 270, 7, true, true]);
    assert.match(errorOf(await act(g, "prop:update", { id, size: 9 })), /Tamanho/);
    assert.match(errorOf(await act(g, "prop:update", { id, col: 9, size: 0 })), /Tamanho/);
    assert.equal(props()[0].col, 2.5, "a recusa não mexe em nada");
    assert.match(errorOf(await act(g, "prop:update", { id: "nada", size: 1 })), /Objeto não encontrado/);
  });

  it("apagar vários de uma vez; id desconhecido recusa sem apagar nenhum", async () => {
    const { g } = await setup();
    const [a] = idsOf(await act(g, "prop:add", { kind: "stones", col: 1, row: 1 }));
    const [b] = idsOf(await act(g, "prop:add", { kind: "stump", col: 2, row: 1 }));
    idsOf(await act(g, "prop:add", { kind: "log", col: 3, row: 1 }));
    assert.match(errorOf(await act(g, "prop:remove", { ids: [a, "nada"] })), /Objeto não encontrado/);
    assert.equal(props().length, 3);
    assert.ok((await act(g, "prop:remove", { ids: [a, b] })).ok);
    assert.deepEqual(
      props().map((p) => p.kind),
      ["log"],
    );
  });

  it("pincel de espalhar: vários objetos num envio só; um inválido ou passar do limite recusa a pincelada inteira", async () => {
    const { g, ana } = await setup();
    const items = [
      { kind: "tree" as const, col: 1.2, row: 1.3, size: 1.1, rotation: 40, seed: 5 },
      { kind: "bush" as const, col: 2.5, row: 2.5, size: 0.9, rotation: 0, seed: 6 },
    ];
    const ids = idsOf(await act(g, "prop:addMany", { items }));
    assert.equal(ids.length, 2);
    assert.deepEqual(
      props().map((p) => [p.kind, p.size, p.above, p.blocks]),
      [
        ["tree", 1.1, true, true],
        ["bush", 0.9, false, false],
      ],
    );
    assert.match(errorOf(await act(ana, "prop:addMany", { items })), /permissão/);
    assert.match(errorOf(await act(g, "prop:addMany", { items: [items[0], { ...items[1], kind: "dragão" as "bush" }] })), /Objeto inválido/);
    assert.match(errorOf(await act(g, "prop:addMany", { items: [] })), /Objeto inválido/);
    const many = Array.from({ length: LIMITS.props - 1 }, (_, i) => ({ kind: "stones" as const, col: i % 30, row: Math.floor(i / 30), size: 1, rotation: 0, seed: i }));
    assert.match(errorOf(await act(g, "prop:addMany", { items: many })), /Limite de/);
    assert.equal(props().length, 2, "a recusa não põe nada");
  });

  it("objeto que bloqueia atrapalha a visão pelo pé; o que não bloqueia, não", () => {
    const base: MapProp = { id: "p", kind: "boulder", col: 3.5, row: 3.5, size: 1, rotation: 0, seed: 1, above: false, blocks: true };
    const viewer = [{ pos: { col: 1, row: 3 }, span: 1, feet: 30 }];
    const sees = (p: MapProp) => sightCells(viewer, propOccluders([p]), 5).some((c) => c.col === 6 && c.row === 3);
    assert.equal(sees(base), false, "pedregulho tapa a casa de trás");
    assert.equal(sees({ ...base, blocks: false }), true);
    assert.equal(propOccluders([{ ...base, blocks: false }]).length, 0);
  });

  it("a visão dos personagens refaz a conta quando um objeto passa a bloquear e quando o desenho da parede muda", async () => {
    const { g, ana } = await setup();
    const [lia] = idsOf(await act(ana, "ally:create", { name: "Lia", hpMax: 10, dexMod: 0 }));
    await act(ana, "token:move", { id: lia, pos: { col: 1, row: 3 } });
    await act(g, "fog:set", { enabled: true });
    await act(g, "fog:vision", { enabled: true });
    const [pedra] = idsOf(await act(g, "prop:add", { kind: "boulder", col: 3.5, row: 3.5 }));
    await act(g, "prop:update", { id: pedra, blocks: false });
    let s = await stateWhere(ana, (x) => x.battle.props.length === 1 && !x.battle.props[0].blocks);
    assert.ok(isRevealed({ ...s.battle.fog, revealed: s.battle.sight }, 6, 3), "sem bloquear, vê atrás da pedra");
    await act(g, "prop:update", { id: pedra, blocks: true });
    s = await stateWhere(ana, (x) => x.battle.props[0]?.blocks === true);
    assert.equal(isRevealed({ ...s.battle.fog, revealed: s.battle.sight }, 6, 3), false, "bloqueando, não vê");
    // Parede: cerca deixa ver; trocada para tijolo, passa a tapar.
    await act(g, "prop:remove", { ids: [pedra] });
    const [muro] = idsOf(await act(g, "wall:add", { from: { col: 4, row: 0 }, to: { col: 4, row: 8 }, style: "fence" }));
    s = await stateWhere(ana, (x) => x.battle.props.length === 0 && x.battle.walls.length === 1);
    assert.ok(isRevealed({ ...s.battle.fog, revealed: s.battle.sight }, 6, 3));
    await act(g, "wall:style", { ids: [muro], style: "brick" });
    s = await stateWhere(ana, (x) => x.battle.walls[0]?.style === "brick");
    assert.equal(isRevealed({ ...s.battle.fog, revealed: s.battle.sight }, 6, 3), false);
  });

  it("com névoa, o jogador só recebe o objeto em parte revelada", async () => {
    const { g, ana } = await setup();
    await act(g, "fog:set", { enabled: true });
    await act(g, "fog:paint", { reveal: true, rects: [{ col: 0, row: 0, w: 3, h: 3 }] });
    const [perto] = idsOf(await act(g, "prop:add", { kind: "barrel", col: 1.5, row: 1.5 }));
    await act(g, "prop:add", { kind: "barrel", col: 20.5, row: 20.5 });
    const s = await stateWhere(ana, (x) => x.battle.props.length > 0);
    assert.deepEqual(
      s.battle.props.map((p) => p.id),
      [perto],
    );
  });

  it("fica em cada cena, vai no arquivo de sessão e Limpar campo tira", async () => {
    const { g } = await setup();
    idsOf(await act(g, "prop:add", { kind: "pillar", col: 4, row: 4, size: 1.5, rotation: 45, seed: 9 }));
    const before = structuredClone(props());
    const [cena] = idsOf(await act(g, "scene:add", { name: "Floresta" }));
    const first = ctx.server.store.game.sceneId;
    await act(g, "scene:switch", { id: cena });
    assert.equal(props().length, 0, "cena nova sem objetos");
    await act(g, "scene:switch", { id: first });
    assert.deepEqual(props(), before);
    const master = [...ctx.server.store.players.values()].find((p) => p.role === "gm")!;
    importSession(ctx.server.store, master, JSON.parse(JSON.stringify(exportSession(ctx.server.store))));
    assert.deepEqual(props(), before);
    await act(g, "battle:clear", { keepTemplates: true });
    assert.equal(props().length, 0);
  });
});
