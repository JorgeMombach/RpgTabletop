import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { ActionResult, Combatant, SessionFile } from "@rpg/shared";
import { allCombatants } from "../src/combat";
import { act, join, stateWhere, useServer, type Client } from "./helpers";

// E21 — quem está na luta: iniciativa só de quem está em campo, mobs ocultos e marca de animal.
const { ctx, client } = useServer();

function idsOf(res: ActionResult): string[] {
  assert.ok(res.ok, res.ok ? "" : res.error);
  return res.ids ?? [];
}

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
  const s = await client(`10.21.0.${ipSeq++}`);
  await join(s, name);
  return s;
}

const game = () => ctx.server.store.game;
const find = (id: string) => allCombatants(ctx.server.store).find((c) => c.id === id) as Combatant;
const order = () => game().battle.combat.order;

async function mobAt(g: Client, name: string, col: number | null, extra: { hidden?: boolean } = {}): Promise<string> {
  const [id] = idsOf(await act(g, "mob:add", { name, hpMax: 7, dexMod: 1, ...extra }));
  if (col !== null) assert.ok((await act(g, "token:move", { id, pos: { col, row: 0 } })).ok);
  return id;
}

describe("iniciativa só de quem está em campo", () => {
  it("rolar mobs inclui só mobs no mapa e visíveis; NPCs ficam para o mestre rolar um a um", async () => {
    const g = await gm();
    const inMap = await mobAt(g, "Goblin 1", 0);
    const offMap = await mobAt(g, "Goblin 2", null);
    const hidden = await mobAt(g, "Goblin 3", 2, { hidden: true });
    const [npc] = idsOf(await act(g, "npc:add", { name: "Guarda", hpMax: 11, dexMod: 0 }));
    await act(g, "token:move", { id: npc, pos: { col: 3, row: 0 } });

    assert.ok((await act(g, "init:rollMobs", {})).ok);
    assert.deepEqual(order(), [inMap]);
    assert.equal(find(offMap).initiative, null);
    assert.equal(find(hidden).initiative, null);
    assert.equal(find(npc).initiative, null);

    // O NPC entra quando o mestre rola a dele.
    assert.ok((await act(g, "init:roll", { id: npc })).ok);
    assert.equal(order().length, 2);
  });

  it("sem mob visível no mapa, avisa em vez de não fazer nada", async () => {
    const g = await gm();
    await mobAt(g, "Goblin", null);
    await mobAt(g, "Espreitador", 1, { hidden: true });
    assert.match(errorOf(await act(g, "init:rollMobs", {})), /Nenhum mob visível no mapa/);
  });

  it("rolar de novo inclui os NPCs que já lutavam, e não os outros", async () => {
    const g = await gm();
    const goblin = await mobAt(g, "Goblin", 0);
    const [aliado] = idsOf(await act(g, "npc:add", { name: "Escudeiro", hpMax: 10, dexMod: 1 }));
    const [taverneiro] = idsOf(await act(g, "npc:add", { name: "Taverneiro", hpMax: 4, dexMod: 0 }));
    await act(g, "init:set", { id: aliado, value: 12 });
    await act(g, "init:rollMobs", {});
    await act(g, "combat:start", {});

    assert.ok((await act(g, "init:rerollAll", {})).ok);
    assert.deepEqual(new Set(order()), new Set([goblin, aliado]));
    assert.equal(find(taverneiro).initiative, null);
  });
});

describe("mobs ocultos", () => {
  it("jogador não recebe o oculto (nem nome nem id); o mestre recebe", async () => {
    const g = await gm();
    const [tid] = idsOf(await act(g, "template:upsert", { name: "Espreitador", hpMax: 30, dexMod: 3 }));
    const [hidden] = idsOf(await act(g, "mob:addFromTemplate", { templateId: tid, qty: 1, hidden: true }));
    const [npc] = idsOf(await act(g, "npc:addFromTemplate", { templateId: tid, hidden: true }));
    const visible = await mobAt(g, "Goblin", 0);
    await act(g, "token:move", { id: hidden, pos: { col: 4, row: 4 } });

    const p = await client("10.21.1.1");
    const arrived = stateWhere(p, (s) => s.battle.mobs.length === 1);
    await join(p, "Ana");
    const json = JSON.stringify(await arrived);
    assert.ok(json.includes(visible));
    for (const secret of [hidden, npc, "Espreitador"]) assert.ok(!json.includes(secret), `vazou ${secret}`);

    const gs = await stateWhere(g, (s) => s.battle.mobs.length === 2);
    assert.equal(gs.battle.mobs.find((m) => m.id === hidden)?.hidden, true);
    assert.equal(gs.battle.npcs[0].hidden, true);
  });

  it("oculto fica fora da iniciativa: não rola, não recebe valor, e ocultar tira da ordem", async () => {
    const g = await gm();
    const a = await mobAt(g, "A", 0);
    const b = await mobAt(g, "B", 1);
    await act(g, "init:set", { id: a, value: 15 });
    await act(g, "init:set", { id: b, value: 10 });
    await act(g, "combat:start", {});

    assert.ok((await act(g, "combatant:setHidden", { id: a, hidden: true })).ok);
    assert.deepEqual(order(), [b]);
    assert.equal(find(a).initiative, null);
    assert.equal(game().battle.combat.order[game().battle.combat.turnIndex], b, "a vez passa adiante");
    assert.match(errorOf(await act(g, "init:roll", { id: a })), /oculto/);
    assert.match(errorOf(await act(g, "init:set", { id: a, value: 3 })), /oculto/);
  });

  it("revelar com o combate em andamento rola a iniciativa e entra na ordem sem mudar a vez", async () => {
    const g = await gm();
    const a = await mobAt(g, "A", 0);
    const espreitador = await mobAt(g, "Espreitador", 1, { hidden: true });
    await act(g, "init:set", { id: a, value: 15 });
    await act(g, "combat:start", {});

    assert.ok((await act(g, "combatant:setHidden", { id: espreitador, hidden: false })).ok);
    const e = find(espreitador);
    assert.equal(e.hidden, undefined);
    assert.notEqual(e.initiative, null);
    assert.deepEqual(new Set(order()), new Set([a, espreitador]));
    const { combat } = game().battle;
    assert.equal(combat.order[combat.turnIndex], a);
    const log = game().log[0];
    assert.equal(log.label, "Iniciativa (revelado)");
    assert.equal(log.as, "Espreitador");
    assert.equal(log.hidden, true, "a rolagem fica só para o mestre");
  });

  it("revelar fora da iniciativa só mostra o mob", async () => {
    const g = await gm();
    const m = await mobAt(g, "Espreitador", 1, { hidden: true });
    assert.ok((await act(g, "combatant:setHidden", { id: m, hidden: false })).ok);
    assert.equal(find(m).initiative, null);
    assert.deepEqual(order(), []);
  });

  it("só o mestre oculta, e só mobs e NPCs", async () => {
    const g = await gm();
    const ana = await player("Ana");
    const m = await mobAt(g, "Goblin", 0);
    const [ally] = idsOf(await act(ana, "ally:create", { name: "Thorin", hpMax: 20, dexMod: 1 }));
    assert.equal((await act(ana, "combatant:setHidden", { id: m, hidden: true })).ok, false);
    assert.equal((await act(ana, "combatant:setHidden", { id: ally, hidden: true })).ok, false);
    assert.match(errorOf(await act(g, "combatant:setHidden", { id: ally, hidden: true })), /Só mobs e NPCs/);
    // Criar aliado "oculto" é ignorado.
    const [gmAlly] = idsOf(await act(g, "ally:create", { name: "Batedor", hpMax: 9, dexMod: 2, hidden: true }));
    assert.equal(find(gmAlly).hidden, undefined);
  });

  it("jogador pode entrar na casa de um oculto (a recusa entregaria que há alguém ali); o mestre não", async () => {
    const g = await gm();
    const ana = await player("Ana");
    const [ally] = idsOf(await act(ana, "ally:create", { name: "Thorin", hpMax: 20, dexMod: 1 }));
    await mobAt(g, "Espreitador", 5, { hidden: true });
    const goblin = await mobAt(g, "Goblin", 6);
    assert.ok((await act(ana, "token:move", { id: ally, pos: { col: 5, row: 0 } })).ok);
    assert.match(errorOf(await act(ana, "token:move", { id: ally, pos: { col: 6, row: 0 } })), /ocupada/);
    assert.match(errorOf(await act(g, "token:move", { id: goblin, pos: { col: 5, row: 0 } })), /ocupada/);
  });
});

describe("animais", () => {
  it("template de animal gera mobs e NPCs com a marca; dá para marcar e desmarcar na edição", async () => {
    const g = await gm();
    const ana = await player("Ana");
    const [tid] = idsOf(await act(g, "template:upsert", { name: "Lobo", hpMax: 11, dexMod: 2, animal: true }));
    assert.equal(game().templates[0].animal, true);
    const [lobo] = idsOf(await act(g, "mob:addFromTemplate", { templateId: tid, qty: 1 }));
    const [cavalo] = idsOf(await act(g, "npc:add", { name: "Cavalo", hpMax: 13, dexMod: 1, animal: true }));
    assert.equal(find(lobo).animal, true);
    assert.equal(find(cavalo).animal, true);

    // A marca não é segredo: o jogador vê a pata.
    const seen = await stateWhere(ana, (s) => s.battle.npcs.length === 1);
    assert.equal(seen.battle.npcs[0].animal, true);

    assert.ok((await act(g, "combatant:update", { id: cavalo, animal: false })).ok);
    assert.equal(find(cavalo).animal, undefined);
    // Editar o template sem a marca tira dele (mobs já criados ficam como estão).
    await act(g, "template:upsert", { id: tid, name: "Lobo", hpMax: 11, dexMod: 2, animal: false });
    assert.equal(game().templates[0].animal, undefined);
    assert.equal(find(lobo).animal, true);
  });

  it("o próprio jogador pode marcar o personagem como animal (ex.: companheiro)", async () => {
    const ana = await player("Ana");
    const [ally] = idsOf(await act(ana, "ally:create", { name: "Rex", hpMax: 9, dexMod: 2, animal: true }));
    assert.equal(find(ally).animal, true);
  });
});

describe("chefe", () => {
  it("template de chefe gera mobs e NPCs marcados; o jogador vê a marca; aliado nunca é chefe", async () => {
    const g = await gm();
    const ana = await player("Ana");
    const [tid] = idsOf(await act(g, "template:upsert", { name: "Avanthir", hpMax: 200, dexMod: 0, boss: true }));
    assert.equal(game().templates[0].boss, true);
    const [dragao] = idsOf(await act(g, "mob:addFromTemplate", { templateId: tid, qty: 1 }));
    const [npc] = idsOf(await act(g, "npc:addFromTemplate", { templateId: tid }));
    assert.equal(find(dragao).boss, true);
    assert.equal(find(npc).boss, true);

    // A moldura de chefe não é segredo (as fases, sim).
    const seen = await stateWhere(ana, (s) => s.battle.mobs.length === 1);
    assert.equal(seen.battle.mobs[0].boss, true);

    assert.ok((await act(g, "combatant:update", { id: dragao, boss: false })).ok);
    assert.equal(find(dragao).boss, undefined);
    const [thorin] = idsOf(await act(ana, "ally:create", { name: "Thorin", hpMax: 20, dexMod: 1, boss: true }));
    assert.equal(find(thorin).boss, undefined);
  });
});

describe("arquivo de sessão", () => {
  const exportFile = (s: Client) => s.timeout(2000).emitWithAck("session:export");
  const importFile = (s: Client, file: unknown) => s.timeout(2000).emitWithAck("session:import", file);

  it("guarda oculto e animal; arquivo com oculto na ordem de iniciativa é recusado", async () => {
    const g = await gm();
    const [tid] = idsOf(await act(g, "template:upsert", { name: "Lobo", hpMax: 11, dexMod: 2, animal: true }));
    const [lobo] = idsOf(await act(g, "mob:addFromTemplate", { templateId: tid, qty: 1, hidden: true }));
    const res = await exportFile(g);
    assert.ok(res.ok);
    const file = JSON.parse(JSON.stringify(res.file)) as SessionFile;

    await act(g, "battle:clear", { keepTemplates: false });
    assert.ok((await importFile(g, file)).ok);
    assert.equal(find(lobo).hidden, true);
    assert.equal(find(lobo).animal, true);
    assert.equal(game().templates[0].animal, true);

    file.game.battle.combat.order = [lobo];
    assert.match(errorOf(await importFile(g, file)), /ordem de iniciativa/);
  });
});

describe("conjurados", () => {
  async function playerWithChar() {
    const ana = await player("Ana");
    const [thorin] = idsOf(await act(ana, "ally:create", { name: "Thorin", hpMax: 20, dexMod: 1 }));
    await act(ana, "token:move", { id: thorin, pos: { col: 5, row: 5 } });
    return { ana, thorin };
  }

  it("jogador conjura para o próprio personagem: aliado dele, ao lado, e só ele (e o mestre) controla", async () => {
    const g = await gm();
    const { ana, thorin } = await playerWithChar();
    const bia = await player("Bia");
    const [sapo] = idsOf(await act(ana, "summon:add", { summonerId: thorin, name: "Sapo", hpMax: 1, dexMod: 1, qty: 1, animal: true }));
    const s = find(sapo);
    assert.equal(s.type, "ally");
    assert.equal(s.summonerId, thorin);
    assert.equal(s.ownerId, find(thorin).ownerId);
    assert.equal(s.animal, true);
    assert.ok(s.pos && Math.max(Math.abs(s.pos.col - 5), Math.abs(s.pos.row - 5)) === 1, "na casa livre mais perto");

    assert.ok((await act(ana, "token:move", { id: sapo, pos: { col: 9, row: 9 } })).ok);
    assert.equal((await act(bia, "token:move", { id: sapo, pos: { col: 8, row: 8 } })).ok, false);
    assert.equal((await act(bia, "summon:add", { summonerId: thorin, name: "X", hpMax: 1, dexMod: 0, qty: 1 })).ok, false);
    assert.ok((await act(g, "token:move", { id: sapo, pos: { col: 7, row: 7 } })).ok, "o mestre também");
    // Conjurado não conta como o "um personagem" do jogador (e o limite continua valendo).
    assert.match(errorOf(await act(ana, "ally:create", { name: "Outro", hpMax: 5, dexMod: 0 })), /já tem um personagem/);
  });

  it("mestre conjura 3 esqueletos para o necromante: mobs numerados, em casas diferentes", async () => {
    const g = await gm();
    const ana = await player("Ana");
    const nec = await mobAt(g, "Necromante", 0);
    const ids = idsOf(await act(g, "summon:add", { summonerId: nec, name: "Esqueleto", hpMax: 13, dexMod: 2, qty: 3 }));
    assert.deepEqual(ids.map((id) => find(id).name), ["Esqueleto 1", "Esqueleto 2", "Esqueleto 3"]);
    assert.ok(ids.every((id) => find(id).type === "mob" && find(id).summonerId === nec));
    const cells = new Set([nec, ...ids].map((id) => JSON.stringify(find(id).pos)));
    assert.equal(cells.size, 4, "ninguém na mesma casa");
    assert.equal((await act(ana, "token:move", { id: ids[0], pos: { col: 9, row: 9 } })).ok, false);
    assert.match(errorOf(await act(g, "summon:add", { summonerId: ids[0], name: "Y", hpMax: 1, dexMod: 0, qty: 1 })), /Um invocado não invoca/);
  });

  it("conjurado de um oculto nasce oculto; iniciativa própria (entra no Rolar mobs em campo)", async () => {
    const g = await gm();
    const nec = await mobAt(g, "Necromante", 0);
    const espreitador = await mobAt(g, "Espreitador", 4, { hidden: true });
    const [esq] = idsOf(await act(g, "summon:add", { summonerId: nec, name: "Esqueleto", hpMax: 13, dexMod: 2, qty: 1 }));
    const [sombra] = idsOf(await act(g, "summon:add", { summonerId: espreitador, name: "Sombra", hpMax: 9, dexMod: 2, qty: 1 }));
    assert.equal(find(sombra).hidden, true);
    await act(g, "init:rollMobs", {});
    assert.deepEqual(new Set(order()), new Set([nec, esq]));
  });

  it("remover o conjurador leva os conjurados; o Desfazer traz todos de volta, na mesma ordem", async () => {
    const g = await gm();
    const nec = await mobAt(g, "Necromante", 0);
    const goblin = await mobAt(g, "Goblin", 9);
    const ids = idsOf(await act(g, "summon:add", { summonerId: nec, name: "Esqueleto", hpMax: 13, dexMod: 2, qty: 2 }));
    await act(g, "init:set", { id: ids[0], value: 18 });
    await act(g, "init:set", { id: nec, value: 12 });
    const before = { mobs: game().battle.mobs.map((m) => m.id), order: [...order()] };

    assert.ok((await act(g, "mob:remove", { id: nec })).ok);
    assert.deepEqual(game().battle.mobs.map((m) => m.id), [goblin]);
    assert.deepEqual(order(), []);

    assert.ok((await act(g, "mob:restore", { id: nec })).ok);
    assert.deepEqual(game().battle.mobs.map((m) => m.id), before.mobs);
    assert.deepEqual(order(), before.order);
  });

  it("remover o personagem leva os conjurados dele; limpar o campo tira todos os conjurados", async () => {
    const g = await gm();
    const { ana, thorin } = await playerWithChar();
    await act(ana, "summon:add", { summonerId: thorin, name: "Sapo", hpMax: 1, dexMod: 1, qty: 1 });
    assert.ok((await act(ana, "ally:remove", { id: thorin })).ok);
    assert.equal(game().allies.length, 0);

    const [lia] = idsOf(await act(g, "ally:create", { name: "Lia", hpMax: 10, dexMod: 2 }));
    await act(g, "summon:add", { summonerId: lia, name: "Coruja", hpMax: 1, dexMod: 3, qty: 1 });
    await act(g, "battle:clear", { keepTemplates: true });
    assert.deepEqual(game().allies.map((a) => a.name), ["Lia"]);
  });

  it("conjurado de concentração some quando o conjurador perde a Concentração; os outros ficam", async () => {
    const g = await gm();
    const druida = await mobAt(g, "Druida", 0);
    const lobos = idsOf(await act(g, "summon:add", { summonerId: druida, name: "Lobo", hpMax: 11, dexMod: 2, qty: 2, concentration: true }));
    const [corvo] = idsOf(await act(g, "summon:add", { summonerId: druida, name: "Corvo", hpMax: 1, dexMod: 2, qty: 1 }));
    const conc = find(druida).conditions.find((k) => k.name === "Concentração");
    assert.ok(conc, "o conjurador ganha a condição");
    assert.equal(find(lobos[0]).summonConcentration, true);

    assert.ok((await act(g, "condition:remove", { id: druida, conditionId: conc.id })).ok);
    assert.ok(lobos.every((id) => !find(id)));
    assert.ok(find(corvo));
    assert.ok(game().log.some((e) => e.system && /Lobo 1 de Druida sumiu/.test(e.text)));
  });

  it("arquivo de sessão guarda os conjurados e recusa conjurado sem conjurador", async () => {
    const g = await gm();
    const nec = await mobAt(g, "Necromante", 0);
    const [esq] = idsOf(await act(g, "summon:add", { summonerId: nec, name: "Esqueleto", hpMax: 13, dexMod: 2, qty: 1, concentration: true }));
    const res = await g.timeout(2000).emitWithAck("session:export");
    assert.ok(res.ok);
    const file = JSON.parse(JSON.stringify(res.file)) as SessionFile;
    await act(g, "battle:clear", { keepTemplates: false });
    assert.ok((await g.timeout(2000).emitWithAck("session:import", file)).ok);
    assert.equal(find(esq).summonerId, nec);
    assert.equal(find(esq).summonConcentration, true);

    file.game.battle.mobs = file.game.battle.mobs.filter((m) => m.id !== nec);
    file.game.battle.combat.order = [];
    assert.match(errorOf(await g.timeout(2000).emitWithAck("session:import", file)), /invocado sem invocador/);
  });
});

describe("conjurados: duração e onde aparecem", () => {
  it("duração conta no início do turno de quem conjurou e o conjurado some ao zerar", async () => {
    const g = await gm();
    const clerigo = await mobAt(g, "Clérigo", 0);
    const outro = await mobAt(g, "Goblin", 5);
    const [arma] = idsOf(await act(g, "summon:add", { summonerId: clerigo, name: "Arma espiritual", hpMax: 1, dexMod: 0, qty: 1, rounds: 2 }));
    const [guardiao] = idsOf(await act(g, "summon:add", { summonerId: clerigo, name: "Guardião", hpMax: 10, dexMod: 0, qty: 1 }));
    await act(g, "init:set", { id: clerigo, value: 20 });
    await act(g, "init:set", { id: outro, value: 10 });

    await act(g, "combat:start", {}); // turno do clérigo: 2 → 1
    assert.equal(find(arma).summonRounds, 1);
    await act(g, "combat:next", {}); // goblin: não conta
    assert.equal(find(arma).summonRounds, 1);
    await act(g, "combat:next", {}); // clérigo de novo: 1 → 0, some
    assert.equal(find(arma), undefined);
    assert.ok(find(guardiao), "sem duração fica");
    assert.ok(game().log.some((e) => e.system && e.text === "Arma espiritual de Clérigo sumiu (duração acabou)."));
  });

  it("near: false deixa fora do mapa para escolher onde (o app não limita o alcance)", async () => {
    const g = await gm();
    const clerigo = await mobAt(g, "Clérigo", 0);
    const [g1] = idsOf(await act(g, "summon:add", { summonerId: clerigo, name: "Guardião", hpMax: 10, dexMod: 0, qty: 1, near: false }));
    assert.equal(find(g1).pos, null);
    assert.ok((await act(g, "token:move", { id: g1, pos: { col: 30, row: 30 } })).ok);
    assert.match(errorOf(await act(g, "summon:add", { summonerId: clerigo, name: "X", hpMax: 1, dexMod: 0, qty: 1, rounds: 0 })), /Duração/);
  });
});
