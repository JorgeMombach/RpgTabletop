import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { PingBroadcast } from "@rpg/shared";
import { join, useServer, type Client } from "./helpers";

// Ping no mapa: efêmero, repassado a todos (inclusive quem pingou).
const { client } = useServer();

function collect(s: Client): PingBroadcast[] {
  const got: PingBroadcast[] = [];
  s.on("ping", (p) => got.push(p));
  return got;
}

const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));

describe("ping no mapa", () => {
  it("chega para todos com o nome; ponto inválido e enxurrada são ignorados", async () => {
    const g = await client();
    await join(g, "Mestre");
    const ana = await client("10.38.0.1");
    await join(ana, "Ana");
    const seenByGm = collect(g);
    const seenByAna = collect(ana);

    ana.emit("map:ping", { col: 3.5, row: 2.25 });
    ana.emit("map:ping", { col: 4, row: 4 }); // logo em seguida: ignorado
    ana.emit("map:ping", { col: "x", row: 1 } as never);
    await wait(150);
    assert.equal(seenByGm.length, 1);
    assert.equal(seenByAna.length, 1, "quem pingou também vê");
    assert.deepEqual(seenByGm[0].at, { col: 3.5, row: 2.25 });
    assert.equal(seenByGm[0].name, "Ana");

    await wait(400);
    g.emit("map:ping", { col: 1, row: 1 });
    await wait(150);
    assert.equal(seenByAna.length, 2);
  });

  it("quem não entrou na sessão não pinga", async () => {
    const g = await client();
    await join(g, "Mestre");
    const seen = collect(g);
    const stranger = await client("10.38.0.9");
    stranger.emit("map:ping", { col: 1, row: 1 });
    await wait(150);
    assert.equal(seen.length, 0);
  });
});
