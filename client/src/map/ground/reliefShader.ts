/**
 * Shaders do relevo (docs/design/relevo.md; teste aprovado em docs/design/relevo-teste.html). Rodam uma vez por
 * pedaço, quando o relevo ou a luz da cena mudam, e o resultado fica guardado num atlas: o desenho de cada quadro só
 * lê (abordagem A). A janela de altura do pedaço (com margem, 8 pontos por casa) chega numa textura RG32F: altura em
 * níveis e suavidade (1 = encosta suave, sem rocha).
 */

/** Leitura da janela: B-spline cúbica com 16 leituras exatas (a inclinação varia sem degraus entre os pontos). */
const WINDOW = `
uniform sampler2D uWindow;   // r = altura (níveis), g = suavidade
uniform float uWindowSide;   // pontos de lado
uniform float uPerCell;      // pontos por casa (8)
uniform float uMargin;       // casas de margem em volta do pedaço
uniform float uChunkCells;   // casas de lado do pedaço (8)

vec2 fetchWindow(ivec2 p) { return texelFetch(uWindow, clamp(p, ivec2(0), ivec2(int(uWindowSide) - 1)), 0).rg; }
// Posição em casas, a partir do canto do pedaço.
vec2 windowCubic(vec2 cell) {
  vec2 g = (cell + uMargin) * uPerCell;
  vec2 i = floor(g), f = g - i;
  vec2 f2 = f * f, f3 = f2 * f;
  vec2 w0 = (-f3 + 3.0 * f2 - 3.0 * f + 1.0) / 6.0, w1 = (3.0 * f3 - 6.0 * f2 + 4.0) / 6.0;
  vec2 w2 = (-3.0 * f3 + 3.0 * f2 + 3.0 * f + 1.0) / 6.0, w3 = f3 / 6.0;
  ivec2 base = ivec2(i) - 1;
  vec2 sum = vec2(0.0);
  for (int y = 0; y < 4; y++) {
    float wy = y == 0 ? w0.y : y == 1 ? w1.y : y == 2 ? w2.y : w3.y;
    vec2 row = fetchWindow(base + ivec2(0, y)) * w0.x + fetchWindow(base + ivec2(1, y)) * w1.x + fetchWindow(base + ivec2(2, y)) * w2.x + fetchWindow(base + ivec2(3, y)) * w3.x;
    sum += row * wy;
  }
  return sum;
}
// Leitura simples (bilinear) para a sombra: muitas por ponto.
float windowLinear(vec2 cell) {
  vec2 g = (cell + uMargin) * uPerCell;
  vec2 i = floor(g), f = g - i;
  ivec2 p = ivec2(i);
  float a = fetchWindow(p).r, b = fetchWindow(p + ivec2(1, 0)).r, c = fetchWindow(p + ivec2(0, 1)).r, d = fetchWindow(p + ivec2(1, 1)).r;
  return mix(mix(a, b, f.x), mix(c, d, f.x), f.y);
}
float hashCell(vec2 p) { p = fract(p * vec2(123.34, 456.21)); p += dot(p, p + 45.32); return fract(p.x * p.y); }
float valueNoise(vec2 p) { vec2 i = floor(p), f = fract(p); vec2 u = f * f * (3.0 - 2.0 * f); return mix(mix(hashCell(i), hashCell(i + vec2(1, 0)), u.x), mix(hashCell(i + vec2(0, 1)), hashCell(i + vec2(1, 1)), u.x), u.y); }
`;

/**
 * Campos de um pedaço (dois alvos): A = altura em 16 bits (r, g), rocha (b), suave (a); B = normal grossa (r, g),
 * inclinação (b) e "tem relevo" (a). A borda da escarpa fica irregular por um desvio de ~0,18 casa na posição lida.
 */
export const BAKE_FIELDS_FRAGMENT = `#version 300 es
precision highp float;
layout(location = 0) out vec4 outA;
layout(location = 1) out vec4 outB;
uniform vec2 uSlotOrigin;  // canto do lugar no atlas (px)
uniform float uSlotSize;   // lado do lugar (px)
uniform vec2 uChunkOrigin; // canto do pedaço no mapa (casas)
${WINDOW}
void main() {
  vec2 local = (gl_FragCoord.xy - uSlotOrigin) / uSlotSize * uChunkCells;
  vec2 world = uChunkOrigin + local;
  // Borda irregular: a posição lida desvia um pouco (mesmo desvio em qualquer pedaço: pela posição no mapa).
  vec2 warp = (vec2(valueNoise(world * 2.2), valueNoise(world * 2.2 + 17.0)) - 0.5) * 0.36;
  vec2 sample0 = windowCubic(local + warp);
  float h = sample0.r;
  float soft = clamp(sample0.g, 0.0, 1.0);
  float e = 1.0 / uSlotSize * uChunkCells;
  float hx = windowCubic(local + warp + vec2(e, 0.0)).r - windowCubic(local + warp - vec2(e, 0.0)).r;
  float hy = windowCubic(local + warp + vec2(0.0, e)).r - windowCubic(local + warp - vec2(0.0, e)).r;
  vec2 grad = vec2(hx, hy) / (2.0 * e);
  float slope = length(grad);
  // Um nível tem 1,4 casa de altura (para a luz); a encosta suave é marcada um pouco mais (senão quase não se lê).
  float lift = mix(1.0, 1.8, soft) * 1.4;
  vec3 n = normalize(vec3(-grad * lift, 1.0));
  float rock = smoothstep(0.3, 0.8, slope) * (1.0 - soft);
  float stored = clamp((h + 2.0) / 5.0, 0.0, 1.0) * 65535.0;
  outA = vec4(floor(stored / 256.0) / 255.0, mod(stored, 256.0) / 255.0, rock, soft);
  outB = vec4(n.xy * 0.5 + 0.5, clamp(slope / 4.0, 0.0, 1.0), 1.0);
}`;

/**
 * Sombra do relevo de um pedaço para a luz da cena: do ponto, anda na direção do sol (\`uSunDir\` é para onde a sombra
 * cai) subindo \`uRise\` níveis por casa; se o relevo passa acima, sombra. Alcança até a margem da janela.
 */
export const BAKE_SHADOW_FRAGMENT = `#version 300 es
precision highp float;
out vec4 outColor;
uniform vec2 uSlotOrigin;
uniform float uSlotSize;
uniform vec2 uSunDir;   // para onde a sombra cai (unitário, no mapa)
uniform float uRise;    // níveis que o raio sobe por casa andada
${WINDOW}
void main() {
  vec2 local = (gl_FragCoord.xy - uSlotOrigin) / uSlotSize * uChunkCells;
  const float STEP = 0.1;
  float ray = windowLinear(local) + 0.02;
  float shadow = 1.0;
  for (int i = 1; i <= 80; i++) {
    float t = float(i) * STEP;
    if (t > uMargin) break;
    float diff = windowLinear(local - uSunDir * t) - (ray + uRise * t);
    shadow = min(shadow, clamp(1.0 - (diff - 0.03) * 3.0, 0.0, 1.0));
    if (ray + uRise * t > 3.5) break;
  }
  outColor = vec4(shadow, 0.0, 0.0, 1.0);
}`;
