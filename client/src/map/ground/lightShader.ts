import { NO_UNROLL } from "./glKit";
/**
 * Shaders da luz (docs/design/luz.md), do teste aprovado (`docs/design/luz-teste.html`). Em vez de testar cada parede
 * em cada pixel (o teste), o recorte de cada tocha e a sombra de cada parede são polígonos (contas de
 * `shared/src/light.ts`) desenhados pela placa: a mesma imagem, com o custo de uns poucos triângulos.
 *
 * O mapa de luz é guardado pela metade (0–1 = luz de 0 a 2), para caber a luz forte perto da tocha numa textura comum.
 */

/** O teste foi feito a 48 px por casa; a tocha fixa usa a chama do teste em 0,55 (≈ 0,75 casa com o cabo). */
export const TEST_CELL = 48;
export const FLAME_SCALE = 0.55;

const NOISE = `
float hash(vec2 p) { p = fract(p * vec2(123.34, 456.21)); p += dot(p, p + 45.32); return fract(p.x * p.y); }
float noise(vec2 p) { vec2 i = floor(p), f = fract(p); vec2 u = f * f * (3.0 - 2.0 * f);
  return mix(mix(hash(i), hash(i + vec2(1, 0)), u.x), mix(hash(i + vec2(0, 1)), hash(i + vec2(1, 1)), u.x), u.y); }
// Cor da chama no instante: oscila entre laranja e amarelo (a luz no chão acompanha).
float flameShift(float seed) { return noise(vec2(uTime * 2.3 + seed * 5.0, seed * 3.1)); }
vec3 flameColor(float seed) { return mix(vec3(1.0, 0.5, 0.18), vec3(1.0, 0.8, 0.38), flameShift(seed)); }
float flicker(float seed) { return 0.86 + 0.14 * noise(vec2(uTime * 7.0 + seed * 13.0, seed)); }
`;

/** Polígonos em casas (recortes, sombras, quadrados das chamas) levados para a tela. */
export const GEOMETRY_VERTEX = `#version 300 es
in vec2 aCell;
uniform vec4 uMapGrid;     // offsetX, offsetY, cellPx do mapa e 0
uniform vec3 uStage;       // x, y e escala do palco (mapa -> tela)
uniform vec2 uScreen;      // tamanho da tela (px CSS)
out vec2 vCell;
void main() {
  vCell = aCell;
  vec2 screen = (uMapGrid.xy + aCell * uMapGrid.z) * uStage.z + uStage.xy;
  vec2 clip = screen / uScreen * 2.0 - 1.0;
  gl_Position = vec4(clip.x, -clip.y, 0.0, 1.0);
}`;

/** Sombra do sol: soma a sua parte na máscara (5 sombras um pouco diferentes = borda macia). */
export const SHADOW_FRAGMENT = `#version 300 es
precision highp float;
${NO_UNROLL}
out vec4 outColor;
uniform float uWeight;
void main() { outColor = vec4(uWeight, 0.0, 0.0, 1.0); }`;

/**
 * Ambiente + sol fora da sombra (guardado pela metade). Debaixo do telhado invisível (cômodo fechado,
 * docs/design/paredes.md): sem sombra e só uma parte do sol (`uIndoor`).
 */
export const AMBIENT_FRAGMENT = `#version 300 es
precision highp float;
${NO_UNROLL}
out vec4 outColor;
uniform sampler2D uShadow, uRoof;
uniform vec2 uCanvas;
uniform vec3 uAmbient, uSun;
uniform float uIndoor;
void main() {
  vec2 at = gl_FragCoord.xy / uCanvas;
  float shadow = clamp(texture(uShadow, at).r, 0.0, 1.0);
  float roof = clamp(texture(uRoof, at).r, 0.0, 1.0);
  outColor = vec4((uAmbient + uSun * mix(1.0 - shadow, uIndoor, roof)) * 0.5, 1.0);
}`;

/**
 * Leitura do mapa de alturas (docs/design/sombras.md): a altura em casas num ponto do mapa (fora da área: chão) e,
 * em `heightsAt`, tudo o que o mapa guarda ali, em casas: topo (x), onde começa a copa do ponto, tronco incluído (y,
 * 0 fora de copa) e onde começa o que bloqueia (w; a copa começa no alto, o resto no chão; sem nada, 4). E o começo
 * dos passos, um pouco diferente em cada pixel (a borda da sombra sai macia, sem degraus).
 */
export const HEIGHT_SAMPLE = `
uniform sampler2D uHeights;
uniform vec4 uHeightArea;   // canto e tamanho, em casas
vec4 heightsAt(vec2 cell) {
  vec2 uv = (cell - uHeightArea.xy) / uHeightArea.zw;
  if (uv.x < 0.0 || uv.y < 0.0 || uv.x > 1.0 || uv.y > 1.0) return vec4(0.0, 0.0, 0.0, 4.0);
  return textureLod(uHeights, vec2(uv.x, 1.0 - uv.y), 0.0) * 4.0;
}
float heightAt(vec2 cell) { return heightsAt(cell).x; }
float stepJitter() { return fract(52.9829189 * fract(dot(gl_FragCoord.xy, vec2(0.06711056, 0.00583715)))); }
`;


/** Luz de uma tocha dentro do recorte dela: cai devagar, tremula e tem a cor da chama (somada, pela metade). */
export const TORCH_FRAGMENT = `#version 300 es
precision highp float;
${NO_UNROLL}
in vec2 vCell;
out vec4 outColor;
uniform vec2 uCenter;
uniform float uReach, uSeed, uStrength, uWeight, uTime;
uniform float uTorchHeight, uTorchSkip;
uniform int uUseHeights;
${NOISE}
${HEIGHT_SAMPLE}
/**
 * Quanto de sombra de objetos e tokens (docs/design/sombras.md): do ponto até a tocha, o raio vai da altura do ponto à
 * da chama; quem o raio atravessar faz sombra (o portador, dentro de uTorchSkip, não conta). A conta da página
 * aprovada, com a copa começando no alto: a tocha abaixo dela passa por baixo e ilumina o chão embaixo da copa.
 */
float heightShade() {
  if (uUseHeights == 0) return 0.0;
  vec4 here = heightsAt(vCell);
  // embaixo da copa, com a tocha abaixo dela: o ponto recebe como chão (no tronco, sem a sombra dele mesmo)
  bool under = uTorchHeight < here.y;
  float h0 = under ? 0.0 : here.x;
  vec2 to = uCenter - vCell;
  float dist = length(to);
  float jitter = stepJitter();
  float shade = 0.0;
  for (int i = 0; i < 16 + uNoUnroll; i++) {
    float k = (float(i) + jitter) / 17.0;
    vec2 at = vCell + to * k;
    vec4 span = heightsAt(at);
    float ray = mix(h0, uTorchHeight, k);
    // dentro do objeto: abaixo do topo e, na copa, acima do começo (no chão, o começo não conta: a sombra no pé fica)
    float inside = span.w > 0.001 ? min(span.x - ray, ray - span.w) : span.x - ray;
    float above = distance(at, uCenter) < uTorchSkip || (under && distance(at, vCell) < 0.2) ? -1.0 : inside;
    shade = max(shade, smoothstep(0.02, 0.06 + dist * (1.0 - k) * 0.04, above));
  }
  return shade;
}
void main() {
  float d = distance(vCell, uCenter);
  float wobble = 1.0 + 0.04 * (noise(vec2(uTime * 3.0, uSeed * 7.0)) - 0.5);
  float fall = pow(max(1.0 - d / (uReach * wobble), 0.0), 1.7);
  vec3 warm = mix(vec3(1.0, 0.6, 0.3), vec3(1.0, 0.78, 0.45), flameShift(uSeed));
  outColor = vec4(warm * fall * uStrength * flicker(uSeed) * 1.6 * uWeight * 0.5 * (1.0 - heightShade()), 1.0);
}`;

/** Mapa de luz para a tela: dobra de volta e aplica o brilho mínimo (o do mestre). */
export const LIGHT_OUT_FRAGMENT = `#version 300 es
precision highp float;
${NO_UNROLL}
out vec4 outColor;
uniform sampler2D uLight;
uniform vec2 uCanvas;
uniform vec3 uFloor;
void main() {
  vec3 light = texture(uLight, gl_FragCoord.xy / uCanvas).rgb * 2.0;
  // Um tico de ruído some com os degraus da queda da luz (anéis) na imagem de 8 bits.
  float dither = (fract(sin(dot(gl_FragCoord.xy, vec2(12.9898, 78.233))) * 43758.5453) - 0.5) / 255.0;
  outColor = vec4(min(max(light, uFloor), vec3(1.0)) + dither, 1.0);
}`;

/**
 * Chama, faíscas e brilho de uma tocha (no quadrado em volta dela). Tocha fixa (\`uFixed\` 1): a chama do teste, em
 * camadas, com a segunda língua; tocha do token: só o brilho (a chama vai no selo, desenhado com o token).
 */
export const FLAME_FRAGMENT = `#version 300 es
precision highp float;
${NO_UNROLL}
in vec2 vCell;
out vec4 outColor;
uniform vec2 uFlame;      // base da chama (fixa) ou centro do token, em casas
uniform float uSeed, uTime, uTorch, uFixed;
${NOISE}
// Chama vista de cima, em gota para cima: q em unidades da chama, base em (0, 0). Cor pré-multiplicada e cobertura.
vec4 flame(vec2 q, float seed) {
  float t = uTime;
  float height = 1.0 + 0.36 * (noise(vec2(t * 9.0, seed)) - 0.5);
  float up = clamp(-q.y / height, 0.0, 1.2);
  q.x += (noise(vec2(q.y * 2.5 - t * 7.0, seed * 4.0)) - 0.5) * 0.7 * up;
  q.x += sin(t * 5.3 + seed * 2.0) * 0.12 * up;
  float width = q.y > 0.0 ? sqrt(max(0.0, 0.36 - q.y * q.y * 4.0)) : 0.6 * pow(max(1.0 - up / height, 0.0), 0.9);
  float edge = abs(q.x) - width;
  float body = 1.0 - smoothstep(-0.08, 0.06, edge);
  body *= 1.0 - smoothstep(height * 0.92, height * 1.02, -q.y);
  body *= 1.0 - smoothstep(0.26, 0.31, q.y);
  float inner = 1.0 - smoothstep(-0.3, -0.08, edge + 0.04);
  float core = (1.0 - smoothstep(-0.2, -0.02, edge + 0.2)) * smoothstep(0.85, 0.15, up);
  vec3 color = mix(vec3(0.92, 0.32, 0.1), flameColor(seed), inner);
  color = mix(color, vec3(1.0, 0.94, 0.7), core);
  return vec4(color * body, body);
}
void main() {
  // Em px do teste (48 por casa), na escala da tocha.
  vec2 local = (vCell - uFlame) * ${TEST_CELL}.0 / (uFixed > 0.5 ? ${FLAME_SCALE} : 1.0);
  float d = length(local);
  vec3 color = flameColor(uSeed) * exp(-d / (10.0 * flicker(uSeed))) * uTorch * 0.5;
  float cover = 0.0;
  if (uFixed > 0.5) {
    vec2 side = vec2(sin(uTime * 4.1 + uSeed) * 4.0, -1.0);
    vec4 tongue = flame((local - side) / vec2(11.0, 20.0), uSeed + 0.37);
    vec4 fire = flame(local / vec2(17.0, 32.0), uSeed);
    vec3 flames = tongue.rgb * (1.0 - fire.a) + fire.rgb * mix(0.9, 1.15, flameShift(uSeed));
    cover = max(fire.a, tongue.a);
    color = color * (1.0 - cover) + flames;
    for (int k = 0; k < 5 + uNoUnroll; k++) {
      float seed = uSeed * 17.0 + float(k) * 3.7;
      float life = fract(uTime * (0.55 + 0.25 * hash(vec2(seed, 1.0))) + hash(vec2(seed, 2.0)));
      vec2 spark = vec2((hash(vec2(seed, 3.0)) - 0.5) * 12.0 + sin(uTime * 3.0 + seed) * 4.0 * life, -14.0 - life * 46.0);
      float glint = 1.0 - smoothstep(0.6, 1.6, distance(local, spark));
      color += vec3(1.0, 0.65, 0.25) * glint * (1.0 - life) * uTorch;
    }
  }
  // Somado por cima (mistura "tela" na camada). A cor vai pré-multiplicada de verdade (alfa ≥ cada canal): com alfa
  // zero e cor acesa, o navegador pode zerar o brilho ao copiar a imagem. Com a mistura "tela", dá o mesmo resultado.
  outColor = vec4(color, clamp(max(cover, max(color.r, max(color.g, color.b))), 0.0, 1.0));
}`;


/**
 * Sombra do sol ou da lua de objetos e tokens (docs/design/sombras.md), na máscara de sombra (pela maior): do ponto,
 * anda até a luz; quem estiver acima do raio (que sobe 1/shadowCells por casa) faz sombra. A conta da página aprovada.
 */
export const HEIGHT_SUN_FRAGMENT = `#version 300 es
precision highp float;
${NO_UNROLL}
out vec4 outColor;
uniform vec4 uMapGrid;
uniform vec3 uStage;
uniform vec2 uScreen, uCanvas;
uniform vec2 uSunDir;        // para onde a sombra cai
uniform float uShadowCells;  // comprimento da sombra por casa de altura
${HEIGHT_SAMPLE}
void main() {
  vec2 screen = vec2(gl_FragCoord.x, uCanvas.y - gl_FragCoord.y) * (uScreen / uCanvas);
  vec2 p = ((screen - uStage.xy) / uStage.z - uMapGrid.xy) / uMapGrid.z;
  float h0 = heightAt(p);
  float jitter = stepJitter();
  float reach = 2.6 * uShadowCells;
  float shade = 0.0;
  for (int i = 0; i < 32 + uNoUnroll; i++) {
    float d = (float(i) + jitter) / 32.0 * reach;
    float above = heightAt(p - uSunDir * d) - (h0 + d / uShadowCells);
    shade = max(shade, smoothstep(0.02, 0.06 + d * 0.05, above));
  }
  outColor = vec4(shade * 0.85, 0.0, 0.0, 1.0);
}`;
