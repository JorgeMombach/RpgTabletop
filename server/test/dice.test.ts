import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { LIMITS, type ClientState } from "@rpg/shared";
import { roll, type Rng } from "../src/dice";
import { ActionError } from "../src/validate";
import { act, join, stateWhere, useServer } from "./helpers";

/** Rng determinístico: devolve os valores em sequência. */
function seq(...values: number[]): Rng {
  let i = 0;
  return (faces) => {
    const v = values[i++ % values.length];
    assert.ok(v >= 1 && v <= faces, `valor ${v} fora de d${faces}`);
    return v;
  };
}

describe("expressões", () => {
  it("2d6+1d4+3 mostra cada dado e soma certo", () => {
    const r = roll("2d6+1d4+3", "normal", seq(5, 2, 4));
    assert.equal(r.expr, "2d6+1d4+3");
    assert.equal(r.total, 5 + 2 + 4 + 3);
    assert.deepEqual(
      r.terms.map((t) => (t.kind === "dice" ? t.rolls : t.value)),
      [[5, 2], [4], 3],
    );
  });

  it("aceita espaços, maiúsculas, d sem quantidade, d% e subtração", () => {
    const r = roll(" D20 - 1 + 2D% ", "normal", seq(10, 50, 70));
    assert.equal(r.expr, "1d20-1+2d100");
    assert.equal(r.total, 10 - 1 + 50 + 70);
  });

  it("todos os dados do jogo", () => {
    for (const faces of [4, 6, 8, 10, 12, 20, 100]) {
      for (let i = 0; i < 200; i++) {
        const { total } = roll(`1d${faces}`);
        assert.ok(total >= 1 && total <= faces, `d${faces} deu ${total}`);
      }
    }
  });

  it("recusa expressões inválidas", () => {
    for (const bad of ["", "abc", "1d20+", "2d", "d1", "0d6", "1d20++2", "5", "1d6*2", "999d6", "1d20".repeat(30)]) {
      assert.throws(() => roll(bad), ActionError, `deveria recusar "${bad}"`);
    }
  });
});

describe("vantagem e desvantagem", () => {
  it("vantagem rola 2d20 e usa o maior", () => {
    const r = roll("1d20+5", "adv", seq(7, 15));
    assert.equal(r.total, 20);
    const d = r.terms[0];
    assert.ok(d.kind === "dice");
    assert.deepEqual([d.rolls, d.keptIndex], [[7, 15], 1]);
  });

  it("desvantagem usa o menor", () => {
    const r = roll("1d20+5", "dis", seq(7, 15));
    assert.equal(r.total, 12);
  });

  it("só vale com 1d20 na expressão", () => {
    assert.throws(() => roll("2d6", "adv"), ActionError);
    assert.throws(() => roll("2d20", "dis"), ActionError);
  });

  it("vale para o primeiro 1d20; os demais dados rolam normal", () => {
    const r = roll("1d20+1d6", "adv", seq(3, 18, 4));
    assert.equal(r.total, 18 + 4);
  });
});

describe("log compartilhado", () => {
  const { client } = useServer();

  it("rolagem aparece para todos com autor; oculta só para o mestre", async () => {
    const gm = await client();
    await join(gm, "Mestre");
    const pl = await client("10.2.0.1");
    await join(pl, "Ana");

    const seenByPlayer = stateWhere(pl, (s) => s.log.length === 1);
    assert.ok((await act(pl, "dice:roll", { expr: "1d20+3" })).ok);
    const s = await seenByPlayer;
    assert.equal(s.log[0].author, "Ana");
    assert.equal(s.log[0].roll?.expr, "1d20+3");

    const gmSees = stateWhere(gm, (st) => st.log.length === 2);
    const plSees: ClientState[] = [];
    pl.on("state:full", (st) => plSees.push(st));
    assert.ok((await act(gm, "dice:roll", { expr: "1d20", hidden: true })).ok);
    const g = await gmSees;
    assert.equal(g.log[1].hidden, true);
    await new Promise((r) => setTimeout(r, 50));
    assert.ok(plSees.length > 0 && plSees.every((st) => st.log.length === 1), "jogador não vê rolagem oculta");
  });

  it("jogador não consegue rolar oculto", async () => {
    const pl = await client("10.2.0.2");
    await join(pl, "Bia");
    const seen = stateWhere(pl, (s) => s.log.length === 1);
    await act(pl, "dice:roll", { expr: "1d6", hidden: true });
    assert.equal((await seen).log[0].hidden, undefined);
  });

  it("expressão inválida devolve erro legível", async () => {
    const pl = await client("10.2.0.3");
    await join(pl, "Caio");
    const res = await act(pl, "dice:roll", { expr: "1d20+banana" });
    assert.equal(res.ok, false);
    assert.match(res.ok ? "" : res.error, /banana/);
  });
});

// Passo 5 (backlog, "Mesa completa"): fórmulas de outros sistemas.
describe("dados de outros sistemas", () => {
  const dice = (r: ReturnType<typeof roll>, i = 0) => {
    const t = r.terms[i];
    assert.ok(t.kind === "dice");
    return t;
  };

  it("kh/kl ficam com os maiores ou menores; os outros vão riscados", () => {
    const r = roll("4d6kh3", "normal", seq(2, 6, 1, 5));
    assert.equal(r.expr, "4d6kh3");
    assert.equal(r.total, 6 + 5 + 2);
    assert.deepEqual(dice(r).dropped, [2]);
    const low = roll("2d20kl1+3", "normal", seq(17, 4));
    assert.equal(low.expr, "2d20kl1+3");
    assert.equal(low.total, 4 + 3);
    assert.deepEqual(dice(low).dropped, [0]);
    // Sem número: fica com um (Ordem Paranormal: 3d20kh).
    const op = roll("3d20kh", "normal", seq(8, 19, 11));
    assert.equal(op.expr, "3d20kh1");
    assert.equal(op.total, 19);
  });

  it("dado que explode rola de novo no máximo, e as explosões contam para o kh", () => {
    const r = roll("2d6!", "normal", seq(6, 6, 3, 2));
    assert.equal(r.expr, "2d6!");
    assert.deepEqual(dice(r).rolls, [6, 6, 3, 2]);
    assert.equal(r.total, 17);
    const k = roll("2d6!kh1", "normal", seq(6, 4, 2));
    assert.deepEqual(dice(k).rolls, [6, 4, 2]);
    assert.equal(k.total, 6, "fica com o maior dado, não com a soma da explosão");
    // Corrente sem fim (d2 sempre 2): para no limite de dados da rolagem.
    const chain = roll("1d2!", "normal", seq(2));
    assert.equal(dice(chain).rolls.length, LIMITS.dice.count);
  });

  it("dados Fate valem −1, 0 ou +1", () => {
    const r = roll("4dF+1", "normal", seq(1, 2, 3, 3));
    assert.equal(r.expr, "4dF+1");
    assert.deepEqual(dice(r).rolls, [-1, 0, 1, 1]);
    assert.equal(dice(r).fate, true);
    assert.equal(r.total, 2);
  });

  it("recusa combinações que não fazem sentido", () => {
    assert.throws(() => roll("2d6kh3"), (e: unknown) => e instanceof ActionError && /ficar com 3 de 2/.test(e.message));
    assert.throws(() => roll("4dF!"), ActionError);
    assert.throws(() => roll("2d20kh1", "adv"), (e: unknown) => e instanceof ActionError && /Vantagem/.test(e.message));
  });
});
