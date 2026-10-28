import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { ActionResult } from "@rpg/shared";
import { act, join, useServer } from "./helpers";

// Descanso: cada jogador no seu (fora de combate), o mestre para todos; tudo vai para o log.
const { ctx, client } = useServer();
const game = () => ctx.server.store.game;

function idsOf(res: ActionResult): string[] {
  assert.ok(res.ok, res.ok ? "" : res.error);
  return res.ids ?? [];
}

function errorOf(res: ActionResult): string {
  assert.equal(res.ok, false, "deveria recusar");
  return res.ok ? "" : res.error;
}

describe("descanso", () => {
  it("jogador descansa o seu fora de combate e aparece no log; em combate só o mestre", async () => {
    const g = await client();
    await join(g, "Mestre");
    const ana = await client("10.43.0.1");
    await join(ana, "Ana");
    const [thorin] = idsOf(await act(ana, "ally:create", { name: "Thorin", hpMax: 30, dexMod: 1, ac: 18 }));
    await act(ana, "hp:change", { id: thorin, delta: -12 });

    assert.ok((await act(ana, "rest", { id: thorin, kind: "long" })).ok);
    assert.equal(game().allies[0].hp, 30);
    assert.ok(game().log.some((e) => e.system && e.text === "Thorin (Ana) fez um descanso longo."));

    await act(ana, "init:set", { id: thorin, value: 12 });
    await act(g, "combat:start", {});
    await act(ana, "hp:change", { id: thorin, delta: -5 });
    assert.match(errorOf(await act(ana, "rest", { id: thorin, kind: "short" })), /fora de combate/);
    assert.ok((await act(g, "rest", { id: thorin, kind: "long" })).ok, "o mestre pode sempre");
    assert.ok(game().log.some((e) => e.text === "Thorin (Mestre) fez um descanso longo."));
    await act(g, "combat:end", {});
  });

  it("mestre dá descanso para todos os aliados; jogador não", async () => {
    const g = await client();
    await join(g, "Mestre");
    const bia = await client("10.43.0.2");
    await join(bia, "Bia");
    const [lia] = idsOf(await act(bia, "ally:create", { name: "Lia", hpMax: 15, dexMod: 3, ac: 13 }));
    await act(bia, "hp:change", { id: lia, delta: -10 });
    assert.equal((await act(bia, "rest:all", { kind: "long" })).ok, false);
    assert.ok((await act(g, "rest:all", { kind: "long" })).ok);
    assert.ok(game().allies.every((a) => a.hp === a.hpMax));
    assert.ok(game().log.some((e) => e.system && e.text.startsWith("Mestre: descanso longo para o grupo (")));
  });
});
