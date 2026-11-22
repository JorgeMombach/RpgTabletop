import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { HELD_TORCH_ABOVE, tokenCaster, tokenGroundShadow, TOKEN_HEIGHT, TORCH_HEIGHT } from "../../client/src/map/ground/shadowCasters";

/** Sombra por objeto (docs/design/sombras.md): alturas de tokens e tochas no mapa de alturas. */

describe("alturas da sombra por objeto", () => {
  it("token pelo tamanho e tocha pelo desenho", () => {
    assert.deepEqual(TOKEN_HEIGHT, { tiny: 0.5, small: 0.9, medium: 1.2, large: 2, huge: 3, gargantuan: 4 });
    assert.deepEqual(TORCH_HEIGHT, { stick: 1.2, iron: 1.6, brazier: 0.6 });
    assert.equal(HELD_TORCH_ABOVE, 0.3);
  });

  it("o disco do token tem o raio da metade do span e a altura do tamanho", () => {
    assert.deepEqual(tokenCaster("a", { x: 2, y: 3 }, 2, "large"), { id: "a", x: 2, y: 3, radius: 1, height: 2 });
  });

  it("a sombrinha fixa do token só sai com o chão na placa e a luz da cena", () => {
    assert.equal(tokenGroundShadow(true, true), false);
    assert.equal(tokenGroundShadow(true, false), true);
    assert.equal(tokenGroundShadow(false, true), true);
    assert.equal(tokenGroundShadow(false, false), true);
  });
});
