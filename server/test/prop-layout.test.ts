import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { PROP_KINDS, type MapProp } from "@rpg/shared";
import { PROP_CAST, PROP_EXTENT, PropAtlas, propBounds, propRow } from "../../client/src/map/props/propLayout";

/** Objetos na placa de vídeo (docs/design/objetos.md): a conta pura do atlas e das linhas. */

const tree: MapProp = { id: "a", kind: "tree", col: 5, row: 4, size: 2, rotation: 45, seed: 7, above: true, blocks: true };

describe("atlas das formas dos objetos", () => {
  it("a mesma chave fica no mesmo lugar; só a primeira vez precisa assar", () => {
    const atlas = new PropAtlas(2048, { small: 1, large: 1 });
    const first = atlas.slotFor("tree|7|0", "large", 1);
    const again = atlas.slotFor("tree|7|0", "large", 2);
    assert.ok(first && again);
    assert.equal(first.fresh, true);
    assert.equal(again.fresh, false);
    assert.deepEqual(again.slot, first.slot);
  });

  it("sementes diferentes ganham lugares diferentes", () => {
    const atlas = new PropAtlas(2048, { small: 1, large: 1 });
    const first = atlas.slotFor("tree|7|0", "large", 1);
    const second = atlas.slotFor("tree|8|0", "large", 1);
    assert.ok(first && second);
    assert.notDeepEqual(first.slot, second.slot);
  });

  it("cheio: sai a usada há mais tempo; se todas são deste quadro, não há lugar", () => {
    // lado grande na resolução 0 = 164 px: um atlas de 328 px tem 2 × 2 lugares
    const atlas = new PropAtlas(328, { small: 0, large: 1 });
    const keys = ["tree|1|0", "tree|2|0", "tree|3|0", "tree|4|0"];
    keys.forEach((key, index) => assert.ok(atlas.slotFor(key, "large", index + 1)));
    const reused = atlas.slotFor(keys[0], "large", 5);
    assert.ok(reused);
    // a 1 foi usada de novo no quadro 5; a 2 (quadro 2) é a mais antiga agora
    const newcomer = atlas.slotFor("tree|5|0", "large", 10);
    assert.ok(newcomer);
    assert.equal(newcomer.fresh, true);
    assert.equal(atlas.slotFor(keys[1], "large", 10)?.fresh, true, "a 2 saiu e volta assando de novo");
    // todos os lugares usados no quadro 11: não cabe mais
    const full = new PropAtlas(328, { small: 0, large: 1 });
    keys.forEach((key) => full.slotFor(key, "large", 11));
    assert.equal(full.slotFor("tree|9|0", "large", 11), null);
  });

  it("a resolução cai quando não cabe e volta com folga de 1/4", () => {
    const atlas = new PropAtlas(2048, { small: 1, large: 2 });
    assert.equal(atlas.tierFor({ small: 10, large: 10 }), 0);
    // 2 camadas de 12 × 12 lugares grandes na resolução 0 = 288
    assert.equal(atlas.tierFor({ small: 10, large: 300 }), 1);
    assert.equal(atlas.tierFor({ small: 10, large: 250 }), 1, "sem folga ainda");
    assert.equal(atlas.tierFor({ small: 10, large: 200 }), 0);
  });
});

describe("linha de dados de cada objeto", () => {
  const slot = { layer: 1, x: 164, y: 328, side: 164 };

  it("leva posição, tamanho, giro em radianos, tipo, semente, base e o lugar no atlas", () => {
    const row = propRow({ prop: tree, base: 2.8, faded: false, drag: null }, slot);
    assert.equal(row.length, 12);
    assert.deepEqual([...row.slice(0, 3)], [5, 4, 2]);
    assert.ok(Math.abs(row[3] - Math.PI / 4) < 1e-6);
    assert.equal(row[4], PROP_KINDS.indexOf("tree"));
    assert.equal(row[5], 7);
    assert.ok(Math.abs(row[6] - 2.8) < 1e-6);
    assert.equal(row[7], 0);
    assert.deepEqual([...row.slice(8)], [1, 164, 328, 164]);
  });

  it("arrastado usa a posição do arrasto; transparente vai como 1", () => {
    const row = propRow({ prop: tree, base: 0, faded: true, drag: { col: 9, row: 1.5, size: 1, rotation: 90 } }, slot);
    assert.deepEqual([...row.slice(0, 3)], [9, 1.5, 1]);
    assert.ok(Math.abs(row[3] - Math.PI / 2) < 1e-6);
    assert.equal(row[7], 1);
  });

  it("a caixa cobre o desenho inteiro girado", () => {
    const box = propBounds(tree, null);
    const half = PROP_EXTENT.tree * 2 * Math.SQRT2;
    assert.ok(Math.abs(box.left - (5 - half)) < 1e-6);
    assert.ok(Math.abs(box.right - (5 + half)) < 1e-6);
    assert.ok(Math.abs(box.top - (4 - half)) < 1e-6);
    assert.ok(Math.abs(box.bottom - (4 + half)) < 1e-6);
  });

  it("todo tipo tem altura de sombra definida", () => {
    for (const kind of PROP_KINDS) assert.ok(PROP_CAST[kind] >= 0, kind);
    assert.equal(PROP_CAST.tree, 1.25);
    assert.equal(PROP_CAST.cart, 0.55);
  });
});
