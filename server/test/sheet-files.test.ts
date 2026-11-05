import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { characterSheet, footprint, templateSheet, type ActionResult, type CharacterSheet, type MobTemplate, type SheetCheckResult } from "@rpg/shared";
import { act, join, useServer, type Client } from "./helpers";

// Fase 4 (docs/design/salvar-importar.md): fichas em arquivo, comparadas pelo id, sem estado de batalha.
const { ctx, client } = useServer();
const game = () => ctx.server.store.game;
const ally = (id: string) => game().allies.find((a) => a.id === id)!;

function idsOf(res: ActionResult): string[] {
  assert.ok(res.ok, res.ok ? "" : res.error);
  return res.ids ?? [];
}

function errorOf(res: { ok: boolean; error?: string }): string {
  assert.equal(res.ok, false, "deveria recusar");
  return res.error ?? "";
}

const file = (kind: "characters" | "monsters", items: unknown[]) => ({ app: "jamals-tabletop", kind, format: 1, appVersion: "2.13.0", savedAt: "2026-11-04T10:00:00.000Z", items });

async function check(socket: Client, f: unknown): Promise<SheetCheckResult> {
  return socket.timeout(5000).emitWithAck("sheets:check", f);
}

let ipSeq = 1;
async function player(name: string) {
  const c: Client = await client(`10.75.0.${ipSeq++}`);
  await join(c, name);
  return c;
}
async function gm() {
  const g: Client = await client();
  await join(g, "Mestre");
  return g;
}

describe("fichas em arquivo", () => {
  it("a ficha leva só o que não é estado de batalha: espaços e recursos descansados, invocação marcada", () => {
    const s = characterSheet({
      id: "x",
      name: "Lobo",
      type: "ally",
      hp: 3,
      hpMax: 11,
      dexMod: 2,
      color: "#3b6ea8",
      pos: { col: 1, row: 2 },
      initiative: 14,
      initRoll: 12,
      conditions: [{ id: "c", name: "Caído", rounds: null }],
      torch: true,
      summonerId: "thorin",
      spellSlots: { 1: { max: 2, used: 2 }, 2: { max: 0, used: 0 }, 3: { max: 0, used: 0 }, 4: { max: 0, used: 0 }, 5: { max: 0, used: 0 }, 6: { max: 0, used: 0 }, 7: { max: 0, used: 0 }, 8: { max: 0, used: 0 }, 9: { max: 0, used: 0 } },
      resources: [{ id: "r", name: "Fúria", max: 3, used: 2, recharge: "long" }],
      gmNotes: "segredo",
    });
    assert.deepEqual(Object.keys(s).sort(), ["color", "dexMod", "gmNotes", "hpMax", "id", "name", "resources", "spellSlots", "summon"]);
    assert.equal(s.spellSlots![1].used, 0);
    assert.equal(s.resources![0].used, 0);
    assert.equal(s.summon, true);
  });

  it("recusa arquivo que não é ficha, de formato mais novo ou vazio; jogador não importa monstros", async () => {
    const g = await gm();
    const ana = await player("Ana-1");
    assert.match(errorOf(await check(g, { app: "jamals-tabletop", format: 2, players: [] })), /não é uma ficha/);
    assert.match(errorOf(await check(g, { ...file("characters", [{ id: "a" }]), format: 99 })), /versão mais nova/);
    assert.match(errorOf(await check(g, file("characters", []))), /nenhuma ficha/);
    assert.match(errorOf(await check(g, file("characters", [{ id: "a", name: "A", hpMax: 0, dexMod: 0, color: "#ffffff" }]))), /vida máxima/);
    const ogro: MobTemplate = { id: "ogro", name: "Ogro", hpMax: 59, dexMod: -1, color: "#8a3b2e" };
    assert.match(errorOf(await check(ana, file("monsters", [ogro]))), /permissão/);
    assert.match(errorOf(await act(ana, "sheets:import", { file: file("monsters", [ogro]) })), /permissão/);
  });

  it("personagem novo entra limpo, com o id do arquivo e de quem importou; jogador não traz notas do mestre", async () => {
    const ana = await player("Ana-2");
    const sheet: CharacterSheet = { id: "thorin-2", name: "Thorin", hpMax: 42, dexMod: 1, color: "#3b6ea8", gmNotes: "não devia vir", inventory: [{ id: "i1", name: "Corda", qty: 1 }] };
    const res = await check(ana, file("characters", [sheet]));
    assert.ok(res.ok);
    assert.equal(res.items[0].status, "new");
    const [id] = idsOf(await act(ana, "sheets:import", { file: file("characters", [sheet]) }));
    assert.equal(id, "thorin-2");
    const t = ally(id);
    assert.equal(t.hp, 42);
    assert.equal(t.pos, null);
    assert.deepEqual(t.conditions, []);
    assert.equal(t.gmNotes, undefined);
    assert.equal(t.ownerId, [...ctx.server.store.players.values()].find((p) => p.name === "Ana-2")!.id);
    // Um personagem só por jogador: um segundo principal no mesmo arquivo é recusado.
    const bia = await player("Bia-2");
    assert.match(errorOf(await check(bia, file("characters", [{ ...sheet, id: "p1" }, { ...sheet, id: "p2" }]))), /já tem um personagem/);
  });

  it("mesma ficha diferente: substituir troca só a ficha, avisa no log e o mestre desfaz", async () => {
    const g = await gm();
    const ana = await player("Ana-3");
    const [id] = idsOf(await act(ana, "ally:create", { name: "Thorin", hpMax: 30, dexMod: 1 }));
    const t = ally(id);
    Object.assign(t, { hp: 25, pos: { col: 4, row: 4 }, conditions: [{ id: "c1", name: "Envenenado", rounds: null }], gmNotes: "trai o grupo" });

    const same = await check(ana, file("characters", [characterSheet(t, false)]));
    assert.ok(same.ok);
    assert.equal(same.items[0].status, "same");

    const newer: CharacterSheet = { ...characterSheet(t, false), hpMax: 20, inventory: [{ id: "i1", name: "Poção de cura", qty: 2 }] };
    const res = await check(ana, file("characters", [newer]));
    assert.ok(res.ok);
    assert.equal(res.items[0].status, "differs");
    assert.equal(res.items[0].canCopy, false, "o personagem principal só substitui");
    assert.equal((res.items[0].table as CharacterSheet).hpMax, 30);
    assert.equal((res.items[0].table as CharacterSheet).gmNotes, undefined, "o jogador não recebe as notas do mestre");

    // Sem escolha (ou com cópia proibida), nada muda.
    assert.match(errorOf(await act(ana, "sheets:import", { file: file("characters", [newer]) })), /Escolha o que fazer com Thorin/);
    assert.match(errorOf(await act(ana, "sheets:import", { file: file("characters", [newer]), choices: { [id]: "copy" } })), /só pode substituir/);
    assert.equal(t.hpMax, 30);

    idsOf(await act(ana, "sheets:import", { file: file("characters", [newer]), choices: { [id]: "replace" } }));
    assert.equal(t.hpMax, 20);
    assert.equal(t.hp, 20, "vida atual limitada à máxima nova");
    assert.deepEqual(t.pos, { col: 4, row: 4 });
    assert.equal(t.conditions.length, 1);
    assert.equal(t.gmNotes, "trai o grupo", "as notas do mestre ficam");
    assert.equal(t.inventory?.[0].name, "Poção de cura");
    const log = game().log.at(-1)!;
    assert.equal(log.textKey, "{who} substituiu {name} pela ficha do arquivo.");
    assert.equal(log.textParams?.id, id);

    assert.match(errorOf(await act(ana, "sheet:undo", { id })), /permissão/);
    idsOf(await act(g, "sheet:undo", { id }));
    assert.equal(t.hpMax, 30);
    assert.equal(t.inventory, undefined);
    assert.equal(t.gmNotes, "trai o grupo");
    assert.match(errorOf(await act(g, "sheet:undo", { id })), /Não há ficha anterior/);
  });

  it("ficha maior no mapa: se o token passaria a encostar em outro, só ele vai para a casa livre mais próxima", async () => {
    const g = await gm();
    const ana = await player("Ana-6");
    const [id] = idsOf(await act(ana, "ally:create", { name: "Druida", hpMax: 30, dexMod: 1 }));
    const [orc] = idsOf(await act(g, "mob:add", { name: "Orc-6", hpMax: 15, dexMod: 1 }));
    const t = ally(id);
    const mob = game().battle.mobs.find((m) => m.id === orc)!;
    t.pos = { col: 40, row: 40 };
    mob.pos = { col: 41, row: 41 };
    const big = { ...characterSheet(t, false), size: "large" as const };
    idsOf(await act(ana, "sheets:import", { file: file("characters", [big]), choices: { [id]: "replace" } }));
    assert.equal(t.size, "large");
    assert.notDeepEqual(t.pos, { col: 40, row: 40 }, "2×2 em 40,40 cobriria o orc em 41,41");
    const cells = footprint(t.pos!, 2).map((c) => `${c.col},${c.row}`);
    assert.ok(!cells.includes("41,41"), `encostou no orc: ${cells.join(" ")}`);
    assert.deepEqual(mob.pos, { col: 41, row: 41 }, "o orc não sai do lugar");
    // Com espaço livre, ninguém se mexe.
    const [id2] = idsOf(await act(g, "ally:create", { name: "Golem-6", hpMax: 30, dexMod: 0 }));
    const golem = ally(id2);
    golem.pos = { col: 60, row: 60 };
    idsOf(await act(g, "sheets:import", { file: file("characters", [{ ...characterSheet(golem), size: "huge" as const }]), choices: { [id2]: "replace" } }));
    assert.deepEqual(golem.pos, { col: 60, row: 60 });
  });

  it("o personagem de outro jogador nunca é substituído: o arquivo entra como cópia, com id novo", async () => {
    const ana = await player("Ana-4");
    const bia = await player("Bia-4");
    const [id] = idsOf(await act(ana, "ally:create", { name: "Thorin", hpMax: 30, dexMod: 1 }));
    const res = await check(bia, file("characters", [{ ...characterSheet(ally(id), false), hpMax: 99 }]));
    assert.ok(res.ok);
    assert.equal(res.items[0].status, "new");
    assert.equal(res.items[0].table, undefined, "nada da ficha da Ana vai para a Bia");
    const [copy] = idsOf(await act(bia, "sheets:import", { file: file("characters", [{ ...characterSheet(ally(id), false), hpMax: 99 }]) }));
    assert.notEqual(copy, id);
    assert.equal(ally(id).hpMax, 30);
    assert.equal(ally(copy).hpMax, 99);
  });

  it("invocação do jogador fica ligada ao personagem dele; sem personagem, é recusada", async () => {
    const ana = await player("Ana-5");
    const lobo: CharacterSheet = { id: "lobo-5", name: "Lobo", hpMax: 11, dexMod: 2, color: "#8a6a3b", animal: true, summon: true };
    assert.match(errorOf(await check(ana, file("characters", [lobo]))), /Importe primeiro o seu personagem/);
    const [main] = idsOf(await act(ana, "ally:create", { name: "Ranger", hpMax: 30, dexMod: 3 }));
    const [id] = idsOf(await act(ana, "sheets:import", { file: file("characters", [lobo]) }));
    assert.equal(ally(id).summonerId, main);
    assert.equal(ally(id).animal, true);
    // Uma segunda cópia da invocação é permitida.
    const res = await check(ana, file("characters", [{ ...lobo, hpMax: 15 }]));
    assert.ok(res.ok);
    assert.equal(res.items[0].canCopy, true);
    const [copy] = idsOf(await act(ana, "sheets:import", { file: file("characters", [{ ...lobo, hpMax: 15 }]), choices: { [lobo.id]: "copy" } }));
    assert.equal(ally(copy).name, "Lobo (2)");
    assert.equal(ally(copy).summonerId, main);
  });

  it("mestre: monstros novos entram, iguais ficam, diferentes seguem a escolha (substituir, cópia, pular)", async () => {
    const g = await gm();
    const base = (id: string, name: string): MobTemplate => ({ id, name, hpMax: 10, dexMod: 0, color: "#8a3b2e" });
    idsOf(await act(g, "sheets:import", { file: file("monsters", [base("m-igual", "Goblin"), base("m-sub", "Ogro"), base("m-copia", "Lich"), base("m-pula", "Rato")]) }));
    const before = game().templates.length;
    const f = file("monsters", [base("m-novo", "Troll"), base("m-igual", "Goblin"), { ...base("m-sub", "Ogro"), hpMax: 68, attacks: [{ id: "a", name: "Pedra", bonus: 6 }] }, { ...base("m-copia", "Lich"), hpMax: 99 }, { ...base("m-pula", "Rato"), hpMax: 2 }]);
    const res = await check(g, f);
    assert.ok(res.ok);
    assert.deepEqual(res.items.map((i) => i.status), ["new", "same", "differs", "differs", "differs"]);
    assert.match(errorOf(await act(g, "sheets:import", { file: f, choices: { "m-sub": "replace", "m-copia": "copy" } })), /Escolha o que fazer com Rato/);
    assert.equal(game().templates.length, before, "recusado inteiro");
    idsOf(await act(g, "sheets:import", { file: f, choices: { "m-sub": "replace", "m-copia": "copy", "m-pula": "skip" } }));
    const tpl = (id: string) => game().templates.find((t) => t.id === id);
    assert.equal(game().templates.length, before + 2);
    assert.ok(tpl("m-novo"));
    assert.equal(tpl("m-sub")!.hpMax, 68);
    assert.equal(tpl("m-sub")!.attacks?.[0].name, "Pedra");
    assert.equal(tpl("m-copia")!.hpMax, 10);
    assert.ok(game().templates.some((t) => t.name === "Lich (2)" && t.hpMax === 99));
    assert.equal(tpl("m-pula")!.hpMax, 10);
    assert.deepEqual(templateSheet(tpl("m-igual")!), base("m-igual", "Goblin"));
  });
});
