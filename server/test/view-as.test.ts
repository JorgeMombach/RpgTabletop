import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { ClientState } from "@rpg/shared";
import { act, join, useServer, type Client } from "./helpers";

// Passo 11 (backlog, "Mesa completa"): o mestre vê o mapa como um jogador, sem abrir outra aba.
const { ctx, client } = useServer();

function nextPreview(c: Client): Promise<ClientState | null> {
  return new Promise((resolve) => c.once("view:preview", resolve));
}

describe("ver como jogador", () => {
  it("o mestre recebe o estado do jogador escolhido (com os mesmos filtros) e de novo a cada mudança; null para", async () => {
    const g: Client = await client();
    await join(g, "Mestre");
    const ana: Client = await client("10.81.0.1");
    await join(ana, "Ana");
    const anaId = [...ctx.server.store.players.values()].find((p) => p.name === "Ana")!.id;
    const mob = await act(g, "mob:add", { name: "Espião", hpMax: 9, dexMod: 2, hidden: true });
    assert.ok(mob.ok);

    let p = nextPreview(g);
    g.emit("view:as", anaId);
    const first = await p;
    assert.equal(first?.self.id, anaId, "a visão é a da Ana");
    assert.equal(first?.self.role, "player");
    assert.ok(!first?.battle.mobs.some((m) => m.name === "Espião"), "mob oculto: a Ana não recebe, então o mestre não vê");
    assert.equal(first?.host, undefined, "nem a chave de mestre vai na visão do jogador");

    p = nextPreview(g);
    assert.ok((await act(g, "mob:add", { name: "Orc", hpMax: 15, dexMod: 1 })).ok);
    assert.ok((await p)?.battle.mobs.some((m) => m.name === "Orc"), "acompanha as mudanças");

    p = nextPreview(g);
    g.emit("view:as", null);
    assert.equal(await p, null);
  });

  it("jogador não pede a visão de outro: o servidor ignora", async () => {
    const ana: Client = await client("10.81.0.2");
    await join(ana, "Ana-2");
    const bia: Client = await client("10.81.0.3");
    await join(bia, "Bia-2");
    const biaId = [...ctx.server.store.players.values()].find((p) => p.name === "Bia-2")!.id;
    let got = false;
    ana.on("view:preview", () => (got = true));
    ana.emit("view:as", biaId);
    await act(ana, "chat:send", { text: "oi" });
    await new Promise((r) => setTimeout(r, 100));
    assert.equal(got, false);
  });
});
