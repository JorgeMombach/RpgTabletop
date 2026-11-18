import { TERRAINS } from "@rpg/shared";
import { TERRAIN_ART, type DetailKind } from "../terrain/terrainArt";

/**
 * Shader do terreno pintado na placa de vídeo (docs/design/renderizador-chao.md): a mesma conta de `renderChunk.ts`
 * (camadas na ordem dos terrenos, borda irregular por ruído, borda um pouco escurecida), por pixel. Aquarela repete a
 * cada 8 casas e o detalhe a cada 16 (`DETAIL_PERIOD`). A água pintada só entra durante a passada do pincel (`uWaterDraft`):
 * fora dela, quem desenha a água é o passo da água.
 */

/** Ordem dos tipos de detalhe nas unidades de textura. */
export const DETAIL_KINDS: DetailKind[] = ["grass", "dirt", "stone", "water"];

/** Um triângulo que cobre a tela inteira. */
export const FULLSCREEN_VERTEX = `#version 300 es
in vec2 aPos;
void main() { gl_Position = vec4(aPos, 0.0, 1.0); }`;

const layer = (index: number) => {
  const terrain = TERRAINS[index];
  const detail = DETAIL_KINDS.indexOf(TERRAIN_ART[terrain].detail);
  const channel = "rgba"[index % 4];
  const weights = ["first", "second", "third"][index >> 2];
  const water = terrain === "water" || terrain === "waterDark";
  return `
  {
    // ${terrain}
    float value = ${weights}.${channel}${water ? " * uWaterDraft" : ""};
    float alpha = edgeSmooth(value + noise);
    if (alpha > 0.0) {
      vec4 tint = texture(uWatercolor${index}, cell / 8.0);
      vec4 detail = texture(uDetail${detail}, cell / ${16}.0);
      vec3 texel = mix(tint.rgb, detail.rgb, detail.a);
      float shade = 1.0 - 0.32 * min(1.0, alpha * (1.0 - alpha) * 4.0);
      color = color * (1.0 - alpha) + texel * shade * alpha;
      cover = cover * (1.0 - alpha) + alpha;
    }
  }`;
};

export const TERRAIN_FRAGMENT = `#version 300 es
precision highp float;
precision highp int;
out vec4 outColor;
uniform sampler2D uWeightsA, uWeightsB, uWeightsC;
${TERRAINS.map((_, index) => `uniform sampler2D uWatercolor${index};`).join("\n")}
${DETAIL_KINDS.map((_, index) => `uniform sampler2D uDetail${index};`).join("\n")}
uniform vec2 uWeightsOrigin;  // ponto fino do primeiro texel (com a borda de um texel vazio)
uniform vec2 uWeightsSize;    // tamanho das texturas de pesos (texels)
uniform vec4 uMapGrid;        // offsetX, offsetY, cellPx do mapa e 0
uniform vec3 uStage;          // x, y e escala do palco (mapa -> tela)
uniform vec2 uScreen;         // tamanho da tela (px CSS)
uniform vec2 uCanvas;         // tamanho do canvas (px do aparelho)
uniform float uWaterDraft;    // 1 = passada do pincel: a aquarela da água aparece

// O mesmo sorteio de renderChunk.ts (contas de inteiros de 32 bits): a borda irregular sai igual.
float cornerHash(int x, int y) {
  uint h = uint(x) * 374761393u + uint(y) * 668265263u;
  h = (h ^ (h >> 13u)) * 1274126177u;
  return float(h ^ (h >> 16u)) / 4294967296.0;
}
float valueNoise(vec2 p) {
  vec2 cellStart = floor(p);
  vec2 f = p - cellStart;
  vec2 u = f * f * (3.0 - 2.0 * f);
  int xi = int(cellStart.x), yi = int(cellStart.y);
  float a = cornerHash(xi, yi), b = cornerHash(xi + 1, yi), c = cornerHash(xi, yi + 1), d = cornerHash(xi + 1, yi + 1);
  return a + (b - a) * u.x + (c - a) * u.y + (a - b - c + d) * u.x * u.y;
}
// Ruído da borda (renderChunk.ts: edgeNoise), pela posição no mapa em casas.
float edgeNoise(vec2 p) {
  float sum = 0.0, amplitude = 0.5, frequency = 1.82;
  for (int octave = 0; octave < 4; octave++) {
    sum += amplitude * valueNoise(p * frequency);
    frequency *= 2.03;
    amplitude *= 0.5;
  }
  return sum - 0.5;
}
// Cobertura da camada: EDGE_LOW 0,32 a EDGE_HIGH 0,6, suavizada.
float edgeSmooth(float value) {
  float t = clamp((value - 0.32) / (0.6 - 0.32), 0.0, 1.0);
  return t * t * (3.0 - 2.0 * t);
}

void main() {
  vec2 screen = vec2(gl_FragCoord.x, uCanvas.y - gl_FragCoord.y) * (uScreen / uCanvas);
  vec2 mapPx = (screen - uStage.xy) / uStage.z;
  vec2 cell = (mapPx - uMapGrid.xy) / uMapGrid.z;
  vec2 uv = (cell * 4.0 - uWeightsOrigin + 0.5) / uWeightsSize;
  vec4 first = texture(uWeightsA, uv);
  vec4 second = texture(uWeightsB, uv);
  vec4 third = texture(uWeightsC, uv);
  float strongest = max(max(max(first.r, first.g), max(first.b, first.a)), max(max(second.r, second.g), max(second.b, max(second.a * uWaterDraft, third.r * uWaterDraft))));
  // Nada pintado perto: transparente (aparece a imagem do mapa ou a mesa).
  if (strongest <= 0.32 - 0.21) { outColor = vec4(0.0); return; }
  float noise = edgeNoise(cell) * 0.42;
  vec3 color = vec3(0.0);
  float cover = 0.0;
  ${TERRAINS.map((_, index) => layer(index)).join("")}
  // Cor pré-multiplicada pela cobertura (como o canvas espera).
  outColor = vec4(color, cover);
}`;

/** Copia a textura do terreno (do tamanho da tela) para a tela. */
export const BLIT_FRAGMENT = `#version 300 es
precision highp float;
out vec4 outColor;
uniform sampler2D uImage;
uniform vec2 uCanvas;
void main() { outColor = texture(uImage, gl_FragCoord.xy / uCanvas); }`;
