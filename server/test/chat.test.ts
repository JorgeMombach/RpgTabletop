import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { ActionResult, ClientState } from "@rpg/shared";
import { act, join, stateWhere, useServer, type Client } from "./helpers";

// Passo 6 (backlog, "Mesa completa"): chat, sussurro (mestre ↔ jogador) e rolagem secreta às cegas.
const { ctx, client } = useServer();

function errorOf(res: ActionResult): string {
  assert.equal(res.ok, false, "deveria recusar");
  return res.ok ? "" : res.error;
}

let ipSeq = 1;
async function setup() {
  const g: Client = await client();
  await join(g, "Mestre");
  const ana: Client = await client(`10.76.0.${ipSeq++}`);
  const bruno: Client = await client(`10.76.0.${ipSeq++}`);
  const n = ipSeq;
  await join(ana, `Ana-${n}`);
  await join(bruno, `Bruno-${n}`);
  const id = (name: string) => [...ctx.server.store.players.values()].find((p) => p.name === name)!.id;
  return { g, ana, bruno, anaId: id(`Ana-${n}`), brunoId: id(`Bruno-${n}`), n };
}

/** Espera um marcador público chegar (todos já receberam o que veio antes) e devolve o estado. */
async function sync(from: Client, ...who: Client[]): Promise<ClientState[]> {
  const mark = `marca-${Math.random()}`;
  const waits = who.map((c) => stateWhere(c, (s) => s.log.some((e) => e.text === mark)));
  assert.ok((await act(from, "chat:send", { text: mark })).ok);
  return Promise.all(waits);
}

describe("chat e sussurro", () => {
  it("mensagem para todos aparece para todos, com o nome no padrão do log", async () => {
    const { g, ana, bruno } = await setup();
    assert.ok((await act(ana, "chat:send", { text: "  Vou pedir mais uma cerveja.  " })).ok);
    const [sg, sb] = await sync(g, g, bruno);
    for (const s of [sg, sb]) {
      const e = s.log.find((x) => x.text === "Vou pedir mais uma cerveja.");
      assert.ok(e, "todos veem");
      assert.equal(e.chat, true);
      assert.equal(e.whisper, undefined);
    }
  });

  it("sussurro do jogador vai só para o mestre; jogador não sussurra para outro jogador", async () => {
    const { g, ana, bruno, brunoId } = await setup();
    assert.ok((await act(ana, "chat:send", { text: "Leio a mente dele?", to: "gm" })).ok);
    const [sg, sa, sb] = await sync(g, g, ana, bruno);
    const e = sg.log.find((x) => x.text === "Leio a mente dele?");
    assert.ok(e, "o mestre vê");
    assert.equal(e.whisper?.to, "gm");
    assert.ok(sa.log.some((x) => x.text === "Leio a mente dele?"), "quem escreveu vê");
    assert.ok(!sb.log.some((x) => x.text === "Leio a mente dele?"), "o outro jogador não vê");
    assert.match(errorOf(await act(ana, "chat:send", { text: "psiu", to: brunoId })), /só com o mestre/);
  });

  it("sussurro do mestre vai só para o jogador escolhido", async () => {
    const { g, ana, bruno, anaId, n } = await setup();
    assert.ok((await act(g, "chat:send", { text: "O taverneiro esconde algo.", to: anaId })).ok);
    const [sa, sb] = await sync(g, ana, bruno);
    const e = sa.log.find((x) => x.text === "O taverneiro esconde algo.");
    assert.equal(e?.whisper?.toName, `Ana-${n}`);
    assert.ok(!sb.log.some((x) => x.text === "O taverneiro esconde algo."));
    assert.match(errorOf(await act(g, "chat:send", { text: "oi", to: "ninguem" })), /Jogador não encontrado/);
  });

  it("recusa mensagem vazia; corta a longa demais", async () => {
    const { g, ana } = await setup();
    assert.match(errorOf(await act(ana, "chat:send", { text: "   " })), /Escreva a mensagem/);
    assert.ok((await act(ana, "chat:send", { text: "a".repeat(900) })).ok);
    const [sg] = await sync(g, g);
    assert.ok(sg.log.some((x) => x.chat && x.text === "a".repeat(500)));
  });

  it("rolagem secreta: o mestre vê tudo; quem rolou vê só a expressão; os outros não veem", async () => {
    const { g, ana, bruno } = await setup();
    const res = await act(ana, "dice:roll", { expr: "1d20+3", secret: true, name: "Intuição" });
    assert.ok(res.ok, res.ok ? "" : res.error);
    const id = res.ids![0];
    const [sg, sa, sb] = await sync(g, g, ana, bruno);
    const gmView = sg.log.find((x) => x.id === id)!;
    assert.equal(gmView.secret, true);
    assert.ok(gmView.roll, "o mestre recebe o resultado");
    const anaView = sa.log.find((x) => x.id === id)!;
    assert.deepEqual(anaView.roll, { expr: "1d20+3", mode: "normal", terms: [], total: 0 }, "às cegas: quem rolou recebe só a expressão");
    assert.ok(!anaView.text.includes("="), `o texto não entrega o total: ${anaView.text}`);
    assert.ok(!sb.log.some((x) => x.id === id), "outro jogador não vê");
  });
});
