import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { LIMITS, parseUvtt, UvttError, type ActionResult } from "@rpg/shared";
import { act, join, useServer, type Client } from "./helpers";

// Passo 9 (backlog, "Mesa completa"): mapa do Dungeondraft e similares (Universal VTT).
const { ctx, client } = useServer();
const B64 = "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=";
const PNG = `data:image/png;base64,${B64}`;
const battle = () => ctx.server.store.game.battle;

function errorOf(res: ActionResult): string {
  assert.equal(res.ok, false, "deveria recusar");
  return res.ok ? "" : res.error;
}

/** Arquivo pequeno no formato: uma sala com origem deslocada, uma curva cheia de pontos, duas portas e uma luz. */
function sample(extra: Record<string, unknown> = {}) {
  return {
    format: 0.3,
    resolution: { map_origin: { x: 1, y: 1 }, map_size: { x: 10, y: 8 }, pixels_per_grid: 140 },
    line_of_sight: [
      [{ x: 1, y: 1 }, { x: 6, y: 1 }, { x: 6, y: 5 }, { x: 1, y: 5 }, { x: 1, y: 1 }],
      // Quase reta: os pontos do meio somem.
      Array.from({ length: 21 }, (_, i) => ({ x: 7 + i * 0.2, y: 2 + (i % 2) * 0.01 })),
    ],
    portals: [
      { position: { x: 3.5, y: 5 }, bounds: [{ x: 3, y: 5 }, { x: 4, y: 5 }], rotation: 0, closed: true, freestanding: false },
      { position: { x: 6, y: 2.5 }, bounds: [{ x: 6, y: 2 }, { x: 6, y: 3 }], rotation: 1.57, closed: false, freestanding: false },
    ],
    lights: [{ position: { x: 3, y: 3 }, range: 5, intensity: 1, color: "ffeccd8b", shadows: true }],
    image: B64,
    ...extra,
  };
}

describe("mapa Universal VTT", () => {
  it("lê imagem, tamanho, paredes (simplificadas), portas e luzes, a partir da origem do mapa", () => {
    const s = parseUvtt(sample());
    assert.equal(s.mime, "image/png");
    assert.deepEqual([s.cols, s.rows], [10, 8]);
    const walls = s.walls.filter((w) => !w.door);
    assert.equal(walls.length, 5, "4 lados da sala + 1 reta da curva");
    assert.deepEqual(walls[0], { from: { col: 0, row: 0 }, to: { col: 5, row: 0 } });
    const doors = s.walls.filter((w) => w.door);
    assert.deepEqual(doors, [
      { from: { col: 2, row: 4 }, to: { col: 3, row: 4 }, door: { open: false } },
      { from: { col: 5, row: 1 }, to: { col: 5, row: 2 }, door: { open: true } },
    ]);
    assert.deepEqual(s.lights, [{ col: 2, row: 2 }]);
  });

  it("recusa o que não é mapa, sem imagem, ou com paredes demais mesmo simplificando", () => {
    assert.throws(() => parseUvtt({ hello: 1 }), (e: unknown) => e instanceof UvttError && e.message === "uvtt.notMap");
    assert.throws(() => parseUvtt(sample({ image: "" })), (e: unknown) => e instanceof UvttError && e.message === "uvtt.noImage");
    // Zigue-zague forte: nenhuma simplificação junta os segmentos.
    const zigzag = Array.from({ length: LIMITS.walls + 50 }, (_, i) => ({ x: i, y: (i % 2) * 3 }));
    assert.throws(() => parseUvtt(sample({ line_of_sight: [zigzag] })), (e: unknown) => e instanceof UvttError && e.message === "uvtt.tooManyWalls");
  });

  it("a ação troca imagem, grid e paredes de uma vez; tochas entram junto; jogador e parede inválida são recusados", async () => {
    const g: Client = await client();
    await join(g, "Mestre");
    const ana: Client = await client("10.79.0.1");
    await join(ana, "Ana");
    assert.ok((await act(g, "wall:add", { from: { col: 0, row: 0 }, to: { col: 9, row: 0 } })).ok);
    assert.ok((await act(g, "maptorch:add", { col: 1, row: 1, style: "stick" })).ok);
    assert.ok((await act(g, "battle:grid", { offsetX: 13, offsetY: 7, rotation: 90, imageScale: 2 })).ok);
    const s = parseUvtt(sample());
    const payload = { image: PNG, cellPx: 70, walls: s.walls, torches: s.lights };

    assert.match(errorOf(await act(ana, "map:importUvtt", payload)), /permissão/);
    const bad = await act(g, "map:importUvtt", { ...payload, walls: [...s.walls, { from: { col: 0, row: 0 }, to: { col: 0, row: 0 } }] });
    assert.match(errorOf(bad), /curta demais/);
    assert.equal(battle().walls.length, 1, "recusado inteiro: nada muda");

    const version = battle().map.imageVersion;
    assert.ok((await act(g, "map:importUvtt", payload)).ok);
    const { map, walls, torches } = battle();
    assert.equal(map.image, PNG);
    assert.equal(map.imageVersion, version + 1);
    assert.deepEqual([map.cellPx, map.offsetX, map.offsetY, map.rotation, map.imageScale], [70, 0, 0, 0, 1]);
    assert.equal(walls.length, s.walls.length, "as paredes antigas saem");
    assert.equal(walls.filter((w) => w.door).length, 2);
    assert.equal(torches.length, 2, "a tocha que já estava continua");

    // Sem paredes no pedido: as da cena ficam.
    assert.ok((await act(g, "map:importUvtt", { image: PNG, cellPx: 50 })).ok);
    assert.equal(battle().walls.length, s.walls.length);
  });
});
