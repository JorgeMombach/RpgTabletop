import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { ActionResult, ActionPayloads, JournalEntry } from "@rpg/shared";
import { act, join, useServer, type Client } from "./helpers";

// Passo 14 (docs/design/diario.md): diário da campanha, caderno do mestre que ele libera aos poucos.
const { ctx, client } = useServer();
const journal = () => ctx.server.store.game.journal;
const version = () => ctx.server.store.journalVersion;

function errorOf(res: ActionResult): string {
  assert.equal(res.ok, false, "deveria recusar");
  return res.ok ? "" : res.error;
}

/** id do que a ação criou (falha o teste se ela recusou). */
function idOf(res: ActionResult): string {
  assert.ok(res.ok, res.ok ? "" : res.error);
  return res.ids![0];
}

async function gm() {
  const g: Client = await client();
  await join(g, "Mestre");
  return g;
}

async function player(ip = "10.47.0.1", name = "Ana") {
  const p: Client = await client(ip);
  await join(p, name);
  return p;
}

const entry = (over: Partial<ActionPayloads["journal:upsert"]> = {}): ActionPayloads["journal:upsert"] => ({
  title: "Sessão 4 — A queda da ponte",
  tag: "session",
  text: "A ponte caiu.\n\nSaque: 34 po.",
  ...over,
});

describe("diário: ações", () => {
  it("jogador não cria, edita, libera nem apaga", async () => {
    const g = await gm();
    const id = idOf(await act(g, "journal:upsert", entry()));
    const ana = await player();
    const before = structuredClone(journal());
    errorOf(await act(ana, "journal:upsert", entry({ title: "Minha" })));
    errorOf(await act(ana, "journal:upsert", entry({ id, title: "Outra" })));
    errorOf(await act(ana, "journal:share", { id, shared: true }));
    errorOf(await act(ana, "journal:remove", { id }));
    assert.deepEqual(journal(), before);
  });

  it("mestre cria, edita, libera e apaga", async () => {
    const g = await gm();
    const v0 = version();
    const id = idOf(await act(g, "journal:upsert", entry({ note: "O cocheiro é espião.", day: 12 })));
    assert.equal(version(), v0 + 1);
    const created = journal().find((e) => e.id === id)!;
    assert.equal(created.title, "Sessão 4 — A queda da ponte");
    assert.equal(created.text, "A ponte caiu.\n\nSaque: 34 po.", "quebras de linha ficam");
    assert.equal(created.note, "O cocheiro é espião.");
    assert.equal(created.day, 12);
    assert.equal(created.shared, undefined);
    const t0 = created.updatedAt;

    await new Promise((r) => setTimeout(r, 5));
    assert.deepEqual(idOf(await act(g, "journal:upsert", entry({ id, title: "Sessão 4", tag: "session" }))), id);
    const edited = journal().find((e) => e.id === id)!;
    assert.equal(edited.title, "Sessão 4");
    assert.equal(edited.note, undefined, "editar sem nota apaga a nota");
    assert.ok(edited.updatedAt > t0);
    assert.equal(version(), v0 + 2);

    assert.ok((await act(g, "journal:share", { id, shared: true })).ok);
    assert.equal(journal()[0].shared, true);
    assert.ok((await act(g, "journal:share", { id, shared: false })).ok);
    assert.equal(journal()[0].shared, undefined);
    assert.equal(version(), v0 + 4);

    assert.ok((await act(g, "journal:remove", { id })).ok);
    assert.deepEqual(journal(), []);
    assert.equal(version(), v0 + 5);
  });

  it("validação recusa sem mudar nada", async () => {
    const g = await gm();
    const id = idOf(await act(g, "journal:upsert", entry()));
    const before = structuredClone(journal());
    const bad: ActionPayloads["journal:upsert"][] = [
      entry({ title: "   " }),
      entry({ title: "a".repeat(81) }),
      entry({ tag: "boss" as never }),
      entry({ text: "a".repeat(4001) }),
      entry({ note: "a".repeat(2001) }),
      entry({ day: 0 }),
      entry({ day: 100_000 }),
      entry({ tag: "npc", done: true }),
      entry({ id: "nao-existe" }),
    ];
    for (const payload of bad) errorOf(await act(g, "journal:upsert", payload));
    assert.match(errorOf(await act(g, "journal:share", { id: "nao-existe", shared: true })), /não existe mais/);
    assert.match(errorOf(await act(g, "journal:remove", { id: "nao-existe" })), /não existe mais/);
    assert.deepEqual(journal(), before);
    assert.ok(id);
  });

  it("até 200 entradas", async () => {
    const g = await gm();
    for (let i = 0; i < 200; i++) idOf(await act(g, "journal:upsert", entry({ title: `Entrada ${i}` })));
    assert.equal(errorOf(await act(g, "journal:upsert", entry({ title: "Demais" }))), "Limite de 200 entradas no diário.");
    assert.equal(journal().length, 200);
  });

  it("nota vazia e falsos não ficam guardados; missão guarda concluída", async () => {
    const g = await gm();
    const id = idOf(await act(g, "journal:upsert", entry({ note: "   ", shared: false, done: false, day: null })));
    const e = journal().find((x) => x.id === id)!;
    assert.equal("note" in e, false);
    assert.equal("shared" in e, false);
    assert.equal("done" in e, false);
    assert.equal("day" in e, false);
    const quest = idOf(await act(g, "journal:upsert", entry({ title: "Amuleto do barão", tag: "quest", done: true, shared: true })));
    const q: JournalEntry = journal().find((x) => x.id === quest)!;
    assert.equal(q.done, true);
    assert.equal(q.shared, true);
  });

  it("limpar campo mantém o diário", async () => {
    const g = await gm();
    idOf(await act(g, "journal:upsert", entry()));
    const before = structuredClone(journal());
    assert.ok((await act(g, "battle:clear", { keepTemplates: true })).ok);
    assert.deepEqual(journal(), before);
    assert.ok((await act(g, "battle:clear", { keepTemplates: false })).ok);
    assert.deepEqual(journal(), before);
  });
});
