import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { LIMITS, type ActionResult } from "@rpg/shared";
import { act, join, stateWhere, useServer, type Client } from "./helpers";

// Passo 8 (backlog, "Mesa completa"): rolagens salvas na ficha.
const { ctx, client } = useServer();
const ally = (id: string) => ctx.server.store.game.allies.find((a) => a.id === id)!;

function errorOf(res: ActionResult): string {
  assert.equal(res.ok, false, "deveria recusar");
  return res.ok ? "" : res.error;
}

let ipSeq = 1;
async function setup() {
  const g: Client = await client();
  await join(g, "Mestre");
  const ana: Client = await client(`10.78.0.${ipSeq++}`);
  await join(ana, `Ana-${ipSeq}`);
  const bia: Client = await client(`10.78.0.${ipSeq++}`);
  await join(bia, `Bia-${ipSeq}`);
  const res = await act(ana, "ally:create", { name: "Kira", hpMax: 20, dexMod: 3 });
  assert.ok(res.ok);
  return { g, ana, bia, id: res.ids![0] };
}

describe("rolagens salvas", () => {
  it("o dono salva, edita e apaga; fórmula inválida e nome vazio são recusados", async () => {
    const { ana, id } = await setup();
    const res = await act(ana, "savedRoll:upsert", { id, name: "  Furtividade ", expr: "1d20 + 7" });
    assert.ok(res.ok, res.ok ? "" : res.error);
    const rollId = res.ids![0];
    assert.deepEqual(ally(id).rolls, [{ id: rollId, name: "Furtividade", expr: "1d20+7" }], "a fórmula fica normalizada");
    assert.match(errorOf(await act(ana, "savedRoll:upsert", { id, name: "Erro", expr: "2d" })), /Não entendi/);
    assert.match(errorOf(await act(ana, "savedRoll:upsert", { id, name: " ", expr: "1d20" })), /nome da rolagem/);
    assert.ok((await act(ana, "savedRoll:upsert", { id, rollId, name: "Furtividade", expr: "2d20kh1+7" })).ok);
    assert.equal(ally(id).rolls?.[0].expr, "2d20kh1+7");
    assert.ok((await act(ana, "savedRoll:remove", { id, rollId })).ok);
    assert.equal(ally(id).rolls, undefined, "lista vazia some");
  });

  it("limite por ficha; outro jogador não mexe nem recebe as rolagens", async () => {
    const { g, ana, bia, id } = await setup();
    for (let i = 0; i < LIMITS.savedRolls; i++) assert.ok((await act(ana, "savedRoll:upsert", { id, name: `R${i}`, expr: "1d6" })).ok);
    assert.match(errorOf(await act(ana, "savedRoll:upsert", { id, name: "Mais uma", expr: "1d6" })), /Limite/);
    assert.match(errorOf(await act(bia, "savedRoll:upsert", { id, name: "Intrusa", expr: "1d6" })), /permissão/);
    const [sb, sg] = await Promise.all([
      stateWhere(bia, (s) => s.allies.some((a) => a.id === id)),
      stateWhere(g, (s) => s.allies.some((a) => a.id === id)),
      act(g, "savedRoll:upsert", { id, rollId: ally(id).rolls![0].id, name: "R0", expr: "1d8" }),
    ]);
    assert.equal(sb.allies.find((a) => a.id === id)!.rolls, undefined, "ficha pessoal: a Bia não recebe");
    assert.ok(sg.allies.find((a) => a.id === id)!.rolls?.length, "o mestre recebe");
  });
});
