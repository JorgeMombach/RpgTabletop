import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { bridgeAt, bridgeDeckHeight, bridgeLength, snapBridgeEnd, type Bridge } from "@rpg/shared";

// Pontes (docs/design/pontes.md): pontas em casas, largura de 1 a 3, três tipos; as contas da ferramenta.
const bridge = (id: string, from: [number, number], to: [number, number], width: Bridge["width"] = 2): Bridge => ({
  id,
  from: { x: from[0], y: from[1] },
  to: { x: to[0], y: to[1] },
  width,
  kind: "plank",
});

describe("ponte: contas", () => {
  it("as pontas encaixam na meia casa (meio das casas e linhas); livres, em centésimos", () => {
    assert.deepEqual(snapBridgeEnd({ x: 2.3, y: 4.74 }, false), { x: 2.5, y: 4.5 });
    assert.deepEqual(snapBridgeEnd({ x: 2.3, y: 4.74 }, true), { x: 2.3, y: 4.74 });
    assert.deepEqual(snapBridgeEnd({ x: 2.3456, y: 4.7449 }, true), { x: 2.35, y: 4.74 });
  });

  it("a ponte sob o ponteiro: no tabuleiro e na beirada; fora da largura ou além da ponta, nenhuma", () => {
    const bridges = [bridge("a", [2, 3], [8, 3], 2)];
    assert.equal(bridgeAt(bridges, { x: 5, y: 3 })?.id, "a");
    assert.equal(bridgeAt(bridges, { x: 5, y: 3.95 })?.id, "a", "beirada (meia largura = 1)");
    assert.equal(bridgeAt(bridges, { x: 5, y: 4.1 }), null, "0,1 casa fora da largura");
    assert.equal(bridgeAt(bridges, { x: 8.1, y: 3 }), null, "além da ponta");
  });

  it("onde duas se cruzam, vale a de cima (a última da lista)", () => {
    const bridges = [bridge("baixo", [2, 3], [8, 3]), bridge("cima", [5, 0], [5, 6])];
    assert.equal(bridgeAt(bridges, { x: 5, y: 3 })?.id, "cima");
  });

  it("comprimento de ponta a ponta", () => {
    assert.equal(bridgeLength(bridge("a", [1, 1], [4, 5])), 5);
  });

  it("altura do tabuleiro (níveis): pousa em terra firme, sobe só sobre o vão; nunca corta o chão", () => {
    assert.equal(bridgeDeckHeight(1, 0, false, "stone"), 1, "rampa um nível acima do chão");
    assert.equal(bridgeDeckHeight(0, 0, true, "plank"), 0.3, "tábuas sobre a água");
    assert.equal(bridgeDeckHeight(0, 0, true, "stone"), 0.55);
    assert.equal(bridgeDeckHeight(0, 0, true, "rope"), 0.12);
    assert.equal(bridgeDeckHeight(0, 0, false, "plank"), 0, "pousada na margem");
    assert.equal(bridgeDeckHeight(0, 1, false, "plank"), 0, "morro no meio: acompanha o chão");
    assert.ok(Math.abs(bridgeDeckHeight(2, -1, true, "rope") - 3.12) < 1e-9, "cânion com água no fundo");
  });
});
