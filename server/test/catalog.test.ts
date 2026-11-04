import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { ActionResult, CatalogCollection } from "@rpg/shared";
import { act, join, useServer, type Client } from "./helpers";

// Passo 12, fase A (docs/design/catalogo-srd.md): catálogo de monstros embutido; copiar para o bestiário.
const { ctx, client } = useServer();
const templates = () => ctx.server.store.game.templates;
const tpl = (id: string) => templates().find((t) => t.id === id);

function errorOf(res: ActionResult): string {
  assert.equal(res.ok, false, "deveria recusar");
  return res.ok ? "" : res.error;
}

async function gm() {
  const g: Client = await client();
  await join(g, "Mestre");
  return g;
}

describe("catálogo de monstros", () => {
  it("a lista é só do mestre e traz o SRD 5.1", async () => {
    const g = await gm();
    const res: { ok: boolean; collections?: CatalogCollection[]; error?: string } = await g.timeout(5000).emitWithAck("catalog:list");
    assert.ok(res.ok);
    assert.equal(res.collections?.[0].name, "SRD 5.1");
    assert.ok(res.collections?.[0].entries.some((e) => e.id === "srd:goblin"));
    const ana: Client = await client("10.82.0.1");
    await join(ana, "Ana");
    const no: { ok: boolean; error?: string } = await ana.timeout(5000).emitWithAck("catalog:list");
    assert.equal(no.ok, false);
    assert.match(errorOf(await act(ana, "catalog:add", { entryId: "srd:goblin", lang: "pt-BR" })), /permissão/);
  });

  it("adicionar copia como modelo no idioma do mestre, com a origem como id; de novo, pede para copiar", async () => {
    const g = await gm();
    const res = await act(g, "catalog:add", { entryId: "srd:young-red-dragon", lang: "es" });
    assert.ok(res.ok, res.ok ? "" : res.error);
    const d = tpl("srd:young-red-dragon")!;
    assert.equal(d.name, "Dragón rojo joven");
    assert.equal(d.source, "srd:young-red-dragon");
    assert.deepEqual([d.hpMax, d.ac, d.dexMod, d.size], [178, 18, 0, "large"]);
    assert.equal(d.attacks?.[0].name, "Mordisco");
    assert.equal(d.attacks?.[0].damage, "2d10+1d6+6");
    assert.equal(d.color, "#a8323a", "cor do tipo dragão");
    assert.match(d.notes ?? "", /ND 10/);

    assert.match(errorOf(await act(g, "catalog:add", { entryId: "srd:young-red-dragon", lang: "es" })), /já está no bestiário/);
    const again = await act(g, "catalog:add", { entryId: "srd:young-red-dragon", lang: "pt-BR", copy: true });
    assert.ok(again.ok);
    const copy = tpl(again.ids![0])!;
    assert.notEqual(copy.id, "srd:young-red-dragon");
    assert.equal(copy.name, "Dragão Vermelho Jovem (2)");
    assert.equal(copy.source, "srd:young-red-dragon");
    assert.match(errorOf(await act(g, "catalog:add", { entryId: "srd:beholder", lang: "pt-BR" })), /não está no catálogo/);
  });

  it("pôr no mapa cria o modelo e os mobs; já no bestiário, usa o modelo editado do mestre", async () => {
    const g = await gm();
    const mobs = () => ctx.server.store.game.battle.mobs;
    const before = mobs().length;
    const res = await act(g, "catalog:add", { entryId: "srd:goblin", lang: "pt-BR", place: 3 });
    assert.ok(res.ok, res.ok ? "" : res.error);
    assert.ok(tpl("srd:goblin"));
    assert.equal(mobs().length, before + 3);
    assert.ok(mobs().slice(-3).every((m) => m.templateId === "srd:goblin" && m.hpMax === 7));

    // O mestre muda a vida do modelo: os próximos do catálogo saem com a dele.
    assert.ok((await act(g, "template:upsert", { ...tpl("srd:goblin")!, hpMax: 9 })).ok);
    assert.ok((await act(g, "catalog:add", { entryId: "srd:goblin", lang: "pt-BR", place: 1 })).ok);
    assert.equal(mobs().at(-1)!.hpMax, 9);
    assert.equal(templates().filter((t) => t.source === "srd:goblin").length, 1, "não duplicou o modelo");
  });

  it("restaurar original volta os números do catálogo; nome, cor e imagem ficam", async () => {
    const g = await gm();
    assert.ok((await act(g, "catalog:add", { entryId: "srd:ogre", lang: "pt-BR" })).ok);
    assert.ok((await act(g, "template:upsert", { ...tpl("srd:ogre")!, name: "Ogro Chefe", hpMax: 90, ac: 14, color: "#123456", attacks: [] })).ok);
    assert.ok((await act(g, "template:restore", { id: "srd:ogre", lang: "pt-BR" })).ok);
    const o = tpl("srd:ogre")!;
    assert.deepEqual([o.name, o.color, o.hpMax, o.ac, o.attacks?.length], ["Ogro Chefe", "#123456", 59, 11, 2]);
    assert.ok((await act(g, "template:upsert", { name: "Caseiro", hpMax: 5, dexMod: 0 })).ok);
    const own = templates().find((t) => t.name === "Caseiro")!;
    assert.match(errorOf(await act(g, "template:restore", { id: own.id, lang: "pt-BR" })), /não veio do catálogo/);
  });
});

describe("catálogo SRD 5.1 completo", () => {
  it("323 monstros, todos traduzidos, com ataques lidos do texto do SRD", async () => {
    const { SRD51 } = await import("../src/catalog/srd51");
    const all = SRD51.entries;
    assert.equal(all.length, 323);
    assert.equal(new Set(all.map((e) => e.id)).size, 323, "ids sem repetir");
    for (const e of all) {
      for (const lang of ["pt-BR", "en", "es"] as const) assert.ok(e.name[lang], `${e.id} sem nome em ${lang}`);
      for (const a of e.attacks) for (const lang of ["pt-BR", "en", "es"] as const) assert.ok(a.name[lang], `${e.id}: ataque sem nome em ${lang}`);
    }
    const by = (id: string) => all.find((e) => e.id === id)!;
    // Alternativa "com as duas mãos" não soma; "plus" soma; dano de salvaguarda não entra.
    assert.equal(by("srd:guard").attacks[0].damage, "1d6+1");
    assert.equal(by("srd:mummy").attacks[0].damage, "5d6+3");
    assert.equal(by("srd:imp").attacks[0].damage, "1d4+3");
    assert.deepEqual(by("srd:wight").name, { "pt-BR": "Inumano", en: "Wight", es: "Tumulario" });
    assert.deepEqual(by("srd:ancient-gold-dragon").name, { "pt-BR": "Dragão de Ouro Ancião", en: "Ancient Gold Dragon", es: "Dragón de oro anciano" });
    assert.equal(by("srd:kobold").cr, "1/8");
  });
});

describe("habilidades do catálogo (fase C)", () => {
  it("o mestre recebe o texto nos três idiomas; jogador não; sem tradução ainda, null", async () => {
    const g = await gm();
    type Res = { ok: boolean; details?: import("@rpg/shared").CatalogDetails | null };
    const res: Res = await g.timeout(5000).emitWithAck("catalog:details", "srd:basilisk");
    assert.ok(res.ok);
    const pt = res.details!["pt-BR"];
    assert.equal(pt.traits[0].name, "Olhar Petrificante");
    assert.match(pt.traits[0].desc, /teste de resistência de Constituição CD 12/);
    assert.ok(pt.lines.some((l) => l.label === "Sentidos" && /visão no escuro 60 ft/.test(l.text)));
    assert.equal(res.details!.en.traits[0].name, "Petrifying Gaze");
    // Custo da ação lendária vem do dado da fonte.
    const sphinx: Res = await g.timeout(5000).emitWithAck("catalog:details", "srd:androsphinx");
    assert.ok(sphinx.details!.es.legendary.some((l) => l.name === "Teletransporte (cuesta 2 acciones)"));
    const none: Res = await g.timeout(5000).emitWithAck("catalog:details", "srd:zombie");
    assert.equal(none.details, null);
    const ana: Client = await client("10.82.0.9");
    await join(ana, "Ana-c");
    const no: Res = await ana.timeout(5000).emitWithAck("catalog:details", "srd:basilisk");
    assert.equal(no.ok, false);
  });
});
