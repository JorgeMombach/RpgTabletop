import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { ActionResult, LootInput } from "@rpg/shared";
import { exportSession, importSession } from "../src/session-file";
import { act, join, stateWhere, useServer, type Client } from "./helpers";

// Abertura do baú (docs/design/baus.md, seção 3): contagem, Quero, d20, Pegar e Dar para…
const { ctx, client } = useServer();
const store = () => ctx.server.store;
const game = () => store().game;

function idsOf(res: ActionResult): string[] {
  assert.ok(res.ok, res.ok ? "" : res.error);
  return res.ids ?? [];
}
function errorOf(res: ActionResult): string {
  assert.equal(res.ok, false, "deveria recusar");
  return res.ok ? "" : res.error;
}
const settle = (ms: number) => new Promise((r) => setTimeout(r, ms));

const LOOT: LootInput[] = [
  { kind: "coins", coins: { gp: 100 } },
  { kind: "item", name: "Poção de cura", qty: 3 },
  { kind: "weapon", name: "Machado de batalha", qty: 1, bonus: 5, damage: "1d8+3" },
  { kind: "item", name: "Capa élfica", qty: 1 },
];

let ip = 1;
async function player(name: string, character: string | null = name + "zinho"): Promise<{ s: Client; ally?: string }> {
  const s = await client(`10.74.0.${ip++}`);
  await join(s, name);
  const ally = character ? idsOf(await act(s, "ally:create", { name: character, hpMax: 10, dexMod: 0 }))[0] : undefined;
  return { s, ally };
}

async function setup(ms = 150) {
  const g = await client();
  await join(g, "Mestre");
  store().lootMsOverride = ms;
  const lia = await player("Lia");
  const kael = await player("Kael");
  const [bau] = idsOf(await act(g, "chest:add", { col: 2, row: 2, style: "wood" }));
  await act(g, "chest:update", { id: bau, name: "Baú do capitão", style: "wood", locked: false, hidden: false, loot: LOOT });
  const loot = (i: number) => game().battle.chests[0].loot.find((e) => e.kind === LOOT[i].kind && ("name" in e ? e.name === (LOOT[i] as { name: string }).name : true));
  const ally = (id: string) => game().allies.find((a) => a.id === id)!;
  return { g, lia, kael, bau, loot, ally };
}

describe("abrir o baú", () => {
  it("trancado só o mestre abre; abrir mostra o loot a todos e começa a contagem", async () => {
    const { g, lia, bau } = await setup();
    await act(g, "chest:update", { id: bau, name: "Baú do capitão", style: "wood", locked: true, hidden: false, loot: LOOT });
    assert.match(errorOf(await act(lia.s, "chest:open", { id: bau })), /Está trancado/);
    await act(g, "chest:update", { id: bau, name: "Baú do capitão", style: "wood", locked: false, hidden: false, loot: LOOT });
    const seen = stateWhere(lia.s, (s) => s.battle.lootCount !== null && s.battle.chests[0]?.loot.length === 4);
    assert.ok((await act(lia.s, "chest:open", { id: bau })).ok);
    const s = await seen;
    assert.equal(s.battle.lootCount!.chestId, bau);
    assert.ok(s.battle.lootCount!.remainingMs > 0 && s.battle.lootCount!.remainingMs <= 150);
    assert.equal(game().battle.chests[0].opened, true);
  });

  it("durante a contagem: Quero liga e desliga; Pegar recusa; o mestre não marca Quero", async () => {
    const { g, lia, bau, loot } = await setup(5000);
    await act(lia.s, "chest:open", { id: bau });
    const capa = loot(3)!.id;
    assert.match(errorOf(await act(lia.s, "loot:take", { chestId: bau, lootId: capa })), /espere a contagem/);
    assert.ok((await act(lia.s, "loot:want", { chestId: bau, lootId: capa, want: true })).ok);
    const liaId = [...store().players.values()].find((p) => p.name === "Lia")!.id;
    assert.deepEqual(store().lootCount!.wants[capa], [liaId]);
    assert.ok((await act(lia.s, "loot:want", { chestId: bau, lootId: capa, want: false })).ok);
    assert.equal(store().lootCount!.wants[capa]?.length ?? 0, 0);
    assert.equal((await act(g, "loot:want", { chestId: bau, lootId: capa, want: true })).ok, false);
    assert.equal((await act(lia.s, "loot:end", {})).ok, false, "só o mestre encerra");
  });

  it("fim da contagem: d20 na disputa, rodízio, moedas divididas, log; depois Pegar", async () => {
    const { lia, kael, bau, loot, ally } = await setup(200);
    await act(lia.s, "chest:open", { id: bau });
    const [ouro, pocao, machado, capa] = [0, 1, 2, 3].map((i) => loot(i)!.id);
    for (const s of [lia.s, kael.s]) {
      await act(s, "loot:want", { chestId: bau, lootId: ouro, want: true });
      await act(s, "loot:want", { chestId: bau, lootId: pocao, want: true });
    }
    await act(kael.s, "loot:want", { chestId: bau, lootId: machado, want: true });
    await settle(350);

    assert.equal(store().lootCount, null, "a contagem acabou sozinha");
    const l = ally(lia.ally!);
    const k = ally(kael.ally!);
    assert.equal((l.coins?.gp ?? 0) + (k.coins?.gp ?? 0), 100);
    assert.ok(Math.abs((l.coins?.gp ?? 0) - (k.coins?.gp ?? 0)) <= 0, "100 por 2 dá 50 cada");
    const potions = (a: typeof l) => a.inventory?.find((i) => i.name === "Poção de cura")?.qty ?? 0;
    assert.deepEqual([potions(l), potions(k)].sort(), [1, 2]);
    const axe = k.inventory!.find((i) => i.name === "Machado de batalha")!;
    assert.deepEqual([axe.qty, axe.bonus, axe.damage, axe.wielded], [1, 5, "1d8+3", undefined], "arma chega guardada");
    assert.deepEqual(game().battle.chests[0].loot.map((e) => e.id), [capa], "sobrou só a capa");
    assert.ok(game().log.some((e) => e.text.includes("Liazinho levou") && e.text.includes("do Baú do capitão") && e.text.includes("d20")));
    assert.equal(store().lootResults?.chestId, bau);

    // Depois: quem clicar primeiro leva; o segundo é recusado.
    assert.ok((await act(kael.s, "loot:take", { chestId: bau, lootId: capa })).ok);
    assert.match(errorOf(await act(lia.s, "loot:take", { chestId: bau, lootId: capa })), /já foi levado/);
    assert.equal(game().battle.chests[0].loot.length, 0);
  });

  it("Pegar parcial na pilha; item igual soma quantidade", async () => {
    const { lia, bau, loot, ally } = await setup(0);
    await act(lia.s, "chest:open", { id: bau });
    assert.equal(store().lootCount, null, "tempo 0: sem contagem");
    const pocao = loot(1)!.id;
    assert.ok((await act(lia.s, "loot:take", { chestId: bau, lootId: pocao, qty: 1 })).ok);
    assert.ok((await act(lia.s, "loot:take", { chestId: bau, lootId: pocao, qty: 1 })).ok);
    assert.equal(ally(lia.ally!).inventory!.filter((i) => i.name === "Poção de cura").length, 1, "uma linha só");
    assert.equal(ally(lia.ally!).inventory![0].qty, 2);
    const left = loot(1)!;
    assert.equal(left.kind === "item" ? left.qty : 0, 1, "sobrou uma no baú");
  });

  it("Dar para… do mestre durante a contagem tira o item da disputa; Encerrar resolve na hora", async () => {
    const { g, lia, kael, bau, loot, ally } = await setup(5000);
    await act(lia.s, "chest:open", { id: bau });
    const machado = loot(2)!.id;
    await act(lia.s, "loot:want", { chestId: bau, lootId: machado, want: true });
    await act(kael.s, "loot:want", { chestId: bau, lootId: machado, want: true });
    assert.equal((await act(lia.s, "loot:give", { chestId: bau, lootId: machado, to: lia.ally!, qty: 1 })).ok, false, "só o mestre dá");
    assert.ok((await act(g, "loot:give", { chestId: bau, lootId: machado, to: kael.ally!, qty: 1 })).ok);
    assert.equal(ally(kael.ally!).inventory![0].name, "Machado de batalha");
    assert.equal(store().lootCount!.wants[machado], undefined);
    assert.ok((await act(g, "loot:end", {})).ok);
    assert.equal(store().lootCount, null);
    assert.equal(ally(lia.ally!).inventory?.some((i) => i.name === "Machado de batalha") ?? false, false);
  });

  it("sem personagem não quer nem pega; só uma contagem por vez; apagar o baú cancela", async () => {
    const { g, lia, bau, loot } = await setup(5000);
    const semNada = await player("Nina", null);
    await act(lia.s, "chest:open", { id: bau });
    assert.match(errorOf(await act(semNada.s, "loot:want", { chestId: bau, lootId: loot(3)!.id, want: true })), /Crie seu personagem antes/);
    const [outro] = idsOf(await act(g, "chest:add", { col: 5, row: 5, style: "iron" }));
    assert.match(errorOf(await act(lia.s, "chest:open", { id: outro })), /Espere a escolha do outro baú acabar/);
    await act(lia.s, "loot:want", { chestId: bau, lootId: loot(3)!.id, want: true });
    assert.ok((await act(g, "chest:remove", { id: bau })).ok);
    assert.equal(store().lootCount, null);
    assert.equal(game().allies.find((a) => a.id === lia.ally)!.inventory, undefined, "nada entregue");
  });

  it("arquivo salvo durante a contagem volta aberto, sem disputa; o tempo vai no arquivo", async () => {
    const { g, lia, bau } = await setup(5000);
    assert.ok((await act(g, "loot:seconds", { seconds: 45 })).ok);
    assert.equal((await act(lia.s, "loot:seconds", { seconds: 5 })).ok, false);
    assert.match(errorOf(await act(g, "loot:seconds", { seconds: 500 })), /Tempo/);
    await act(lia.s, "chest:open", { id: bau });
    const gm = [...store().players.values()].find((p) => p.role === "gm")!;
    importSession(store(), gm, JSON.parse(JSON.stringify(exportSession(store()))));
    assert.equal(store().lootCount, null);
    assert.equal(game().battle.chests[0].opened, true);
    assert.equal(game().lootSeconds, 45);
  });
});

describe("revisão: vazamentos e limites", () => {
  it("o mestre não abre baú invisível; baú coberto aberto pelo mestre não chega aos jogadores", async () => {
    const { g, lia, bau } = await setup(5000);
    await act(g, "chest:update", { id: bau, name: "Baú do capitão", style: "wood", locked: false, hidden: true, loot: LOOT });
    assert.match(errorOf(await act(g, "chest:open", { id: bau })), /Revele o baú/);
    await act(g, "chest:update", { id: bau, name: "Baú do capitão", style: "wood", locked: false, hidden: false, loot: LOOT });
    await act(g, "fog:set", { enabled: true });
    assert.ok((await act(g, "chest:open", { id: bau })).ok);
    // Sincroniza pelo tempo do loot, mudado depois da abertura.
    const seen = stateWhere(lia.s, (st) => st.lootSeconds === 33);
    await act(g, "loot:seconds", { seconds: 33 });
    const s = await seen;
    assert.equal(s.battle.lootCount, null, "a disputa de um baú coberto não vai para quem não o vê");
    assert.equal(s.log.some((e) => e.text.includes("Baú do capitão")), false, "nem o aviso no log");
  });

  it("jogador não pega de baú que deixou de ver", async () => {
    const { g, lia, bau, loot } = await setup(0);
    await act(lia.s, "chest:open", { id: bau });
    await act(g, "chest:update", { id: bau, name: "Baú do capitão", style: "wood", locked: false, hidden: true, loot: LOOT });
    assert.match(errorOf(await act(lia.s, "loot:take", { chestId: bau, lootId: loot(3)!.id })), /Baú não encontrado/);
  });

  it("pilha que passa do limite da ficha: entrega o que cabe e o resto fica no baú", async () => {
    const { g, lia, bau, loot, ally } = await setup(0);
    await act(lia.s, "item:upsert", { id: lia.ally!, name: "Flecha", qty: 9990 });
    await act(g, "chest:update", { id: bau, name: "Baú do capitão", style: "wood", locked: false, hidden: false, loot: [{ kind: "item", name: "Flecha", qty: 20 }] });
    await act(lia.s, "chest:open", { id: bau });
    assert.ok((await act(lia.s, "loot:take", { chestId: bau, lootId: game().battle.chests[0].loot[0].id })).ok);
    assert.equal(ally(lia.ally!).inventory![0].qty, 9999);
    const left = loot(0) ?? game().battle.chests[0].loot[0];
    assert.equal(left.kind === "item" ? left.qty : 0, 11, "o que não coube continua no baú");
    assert.match(errorOf(await act(lia.s, "loot:take", { chestId: bau, lootId: left.id })), /está cheia/);
  });

  it("Limpar campo no meio da contagem cancela a disputa", async () => {
    const { g, lia, bau } = await setup(5000);
    await act(lia.s, "chest:open", { id: bau });
    assert.ok(store().lootCount);
    await act(g, "battle:clear", { keepTemplates: true });
    assert.equal(store().lootCount, null);
  });
});
