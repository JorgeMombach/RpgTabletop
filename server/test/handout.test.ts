import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { Handout } from "@rpg/shared";
import { act, join, useServer, type Client } from "./helpers";

// Mostrar para a mesa: o mestre abre um cartão (texto e/ou imagem) na tela de todos.
const { ctx, client: connect } = useServer();

const PNG = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=";

function nextHandout(s: Client): Promise<Handout | null> {
  return new Promise((resolve) => s.once("handout", resolve));
}

describe("mostrar para a mesa", () => {
  it("o mestre mostra para todos; quem entra depois também vê; parar fecha para todos", async () => {
    const g = await connect();
    await join(g, "Mestre");
    const ana = await connect("10.46.0.1");
    await join(ana, "Ana");

    assert.equal((await act(ana, "handout:show", { text: "oi" })).ok, false, "jogador não mostra");
    assert.equal((await act(g, "handout:show", { title: "  " })).ok, false, "sem nada para mostrar");

    const arrived = nextHandout(ana);
    assert.ok((await act(g, "handout:show", { title: "Carta do barão", text: "Venham ao castelo\nà meia-noite.", image: PNG })).ok);
    const h = (await arrived)!;
    assert.equal(h.title, "Carta do barão");
    assert.equal(h.text, "Venham ao castelo\nà meia-noite.");
    assert.equal(h.image, PNG);
    assert.ok(ctx.server.store.game.log.some((e) => e.system && e.text === "O mestre mostrou: Carta do barão."));

    // Quem entra no meio recebe o que está sendo mostrado.
    const bia = await connect("10.46.0.2");
    const forBia = nextHandout(bia);
    await join(bia, "Bia");
    assert.equal((await forBia)?.title, "Carta do barão");

    const closed = nextHandout(ana);
    assert.ok((await act(g, "handout:close", {})).ok);
    assert.equal(await closed, null);
  });
});
