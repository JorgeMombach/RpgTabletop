import { NO_UNROLL } from "./glKit";
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
  for (int y = 0; y < 4 + uNoUnroll; y++) {
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
${NO_UNROLL}
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
${NO_UNROLL}
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
  // até a margem da janela (12 casas, RELIEF_MARGIN) em passos de 0,1
  for (int i = 1; i <= 120 + uNoUnroll; i++) {
    float t = float(i) * STEP;
    if (t > uMargin) break;
    float diff = windowLinear(local - uSunDir * t) - (ray + uRise * t);
    // Perto da margem da janela a sombra some aos poucos (sem corte reto onde a janela acaba).
    float reach = 1.0 - smoothstep(uMargin - 3.0, uMargin - 0.2, t);
    shadow = min(shadow, 1.0 - (1.0 - clamp(1.0 - (diff - 0.03) * 3.0, 0.0, 1.0)) * reach);
    if (ray + uRise * t > 3.5) break;
  }
  outColor = vec4(shadow, 0.0, 0.0, 1.0);
}`;

// ---------- Desenho de cada quadro (lê o atlas) ----------

/** Leitura do atlas por posição no mapa (casas): índice pedaço → lugar, campos e sombra. */
export const RELIEF_SAMPLE = `
uniform sampler2D uReliefIndex, uReliefA, uReliefB, uReliefShadow, uReliefShadowPrevious;
uniform vec4 uReliefRect;       // pedaço do canto, colunas e linhas do índice
uniform float uReliefPerRow;    // lugares por linha do atlas
uniform float uReliefSlot;      // lado de um lugar (px)
uniform float uReliefAtlas;     // lado do atlas (px)
uniform float uReliefShadowMix; // 0 = só a sombra anterior, 1 = só a atual
uniform float uReliefSunless;   // 1 = sem sol (noite): sem sombra de relevo

// Ponto do atlas (px, sem dividir) da posição \`cell\`; false = sem relevo ali.
bool reliefTexel(vec2 cell, out vec2 texel) {
  vec2 chunk = floor(cell / 8.0);
  vec2 local = chunk - uReliefRect.xy;
  texel = vec2(0.0);
  if (local.x < 0.0 || local.y < 0.0 || local.x >= uReliefRect.z || local.y >= uReliefRect.w) return false;
  vec4 entry = texelFetch(uReliefIndex, ivec2(local), 0);
  if (entry.a < 0.5) return false;
  float slot = floor(entry.r * 255.0 + 0.5) + floor(entry.g * 255.0 + 0.5) * 256.0;
  vec2 origin = vec2(mod(slot, uReliefPerRow), floor(slot / uReliefPerRow)) * uReliefSlot;
  // Dentro do lugar, meia amostra longe da beirada (o filtro não pega o vizinho).
  texel = origin + clamp((cell - chunk * 8.0) / 8.0 * uReliefSlot, 0.5, uReliefSlot - 0.5);
  return true;
}
// Altura (16 bits em dois canais): interpolada à mão (o filtro misturaria os bytes).
float reliefHeight(vec2 texel) {
  vec2 p = texel - 0.5;
  vec2 i = floor(p), f = p - i;
  float h[4];
  for (int k = 0; k < 4 + uNoUnroll; k++) {
    vec4 a = texelFetch(uReliefA, ivec2(i) + ivec2(k % 2, k / 2), 0);
    h[k] = (floor(a.r * 255.0 + 0.5) * 256.0 + floor(a.g * 255.0 + 0.5)) / 65535.0 * 5.0 - 2.0;
  }
  return mix(mix(h[0], h[1], f.x), mix(h[2], h[3], f.x), f.y);
}
float reliefShadowAt(vec2 texel) {
  if (uReliefSunless > 0.5) return 1.0;
  vec2 uv = texel / uReliefAtlas;
  return mix(texture(uReliefShadowPrevious, uv).r, texture(uReliefShadow, uv).r, uReliefShadowMix);
}
`;

export const SCREEN = `
uniform vec4 uMapGrid;   // offsetX, offsetY, cellPx do mapa e 0
uniform vec3 uStage;     // x, y e escala do palco (mapa -> tela)
uniform vec2 uScreen;    // tela (px CSS)
uniform vec2 uCanvas;    // canvas (px do aparelho)
vec2 screenCell() {
  vec2 screen = vec2(gl_FragCoord.x, uCanvas.y - gl_FragCoord.y) * (uScreen / uCanvas);
  return ((screen - uStage.xy) / uStage.z - uMapGrid.xy) / uMapGrid.z;
}
`;

/**
 * Relevo por cima do chão e da água (cor pré-multiplicada): a rocha da escarpa, opaca (o teste aprovado, técnica
 * "Mistura": aquarela de pedra + camadas + blocos + grão + contorno de tinta em pixels), e a luz da encosta onde não
 * é rocha, relativa ao chão plano (escurece o lado contra o sol; clareia o outro somando). A luz absoluta e a sombra
 * projetada são do passo da luz.
 */
export const RELIEF_DRAW_FRAGMENT = `#version 300 es
precision highp float;
${NO_UNROLL}
out vec4 outColor;
uniform sampler2D uStone, uStoneLight;
uniform vec3 uLightDir;      // de onde vem a luz (unitário; z = altura)
uniform float uLightAmount;  // força do sombreado das encostas (noite: menos)
uniform float uAmbientLum, uSunLum; // brilho do ambiente e do sol da cena (a conta do teste: ambiente + sol)
${RELIEF_SAMPLE}
${SCREEN}
float hashCell(vec2 p) { p = fract(p * vec2(123.34, 456.21)); p += dot(p, p + 45.32); return fract(p.x * p.y); }
float valueNoise(vec2 p) { vec2 i = floor(p), f = fract(p); vec2 u = f * f * (3.0 - 2.0 * f); return mix(mix(hashCell(i), hashCell(i + vec2(1, 0)), u.x), mix(hashCell(i + vec2(0, 1)), hashCell(i + vec2(1, 1)), u.x), u.y); }
float fbm(vec2 p) { float s = 0.0, a = 0.5; for (int i = 0; i < 5 + uNoUnroll; i++) { s += a * valueNoise(p); p *= 2.03; a *= 0.5; } return s; }
vec2 hash2(vec2 p) { return fract(sin(vec2(dot(p, vec2(127.1, 311.7)), dot(p, vec2(269.5, 183.3)))) * 43758.5453); }
// Blocos de rocha (Voronoi): id do bloco e distância até a borda (racha).
vec3 voronoi(vec2 p) {
  vec2 i = floor(p), f = fract(p);
  float d1 = 9.0, d2 = 9.0;
  vec2 id = vec2(0);
  for (int y = -1; y <= 1 + uNoUnroll; y++) for (int x = -1; x <= 1 + uNoUnroll; x++) {
    vec2 o = vec2(x, y), r = o + hash2(i + o) - f;
    float d = dot(r, r);
    if (d < d1) { d2 = d1; d1 = d; id = i + o; } else if (d < d2) d2 = d;
  }
  return vec3(id, sqrt(d2) - sqrt(d1));
}
// Relevo fino da rocha: saliências e pedrinhas (só para a luz).
float rockBumps(vec2 c) { return (fbm(c * 9.0) - 0.5) * 0.06 + (valueNoise(c * 27.0) - 0.5) * 0.022; }

void main() {
  vec2 c = screenCell();
  vec2 texel;
  if (!reliefTexel(c, texel)) { outColor = vec4(0.0); return; }
  vec2 uv = texel / uReliefAtlas;
  vec4 a = texture(uReliefA, uv);
  vec4 b = texture(uReliefB, uv);
  float rock = a.b;
  float soft = a.a;
  vec3 n = normalize(vec3(b.rg * 2.0 - 1.0, 1.0));
  float h = reliefHeight(texel);
  // Luz relativa ao chão plano (a conta do teste aprovado: ambiente + sol × face): 1 no plano, menos de costas para a
  // luz (o ambiente segura), mais de frente.
  float flatLit = max(uLightDir.z, 0.35);
  float flatLight = uAmbientLum + uSunLum * 0.8;
  if (rock < 0.01) {
    float shade = (uAmbientLum + uSunLum * 0.8 * max(dot(n, uLightDir), 0.0) / flatLit) / flatLight;
    shade = mix(1.0, shade, uLightAmount);
    // Escurecer: preto com alfa; clarear: soma (cor sem alfa).
    outColor = shade < 1.0 ? vec4(0.0, 0.0, 0.0, (1.0 - shade) * 0.85) : vec4(vec3(min(shade - 1.0, 0.4) * 0.35), 0.0);
    return;
  }
  // ---- rocha (do teste aprovado)
  vec3 cellA = voronoi(c * 1.5 + vec2(0.0, h * 1.2));
  vec2 tilt = (hash2(cellA.xy) - 0.5) * 1.1;
  float e = 0.03;
  // as quatro amostras num laço: uma cópia só do relevo da rocha no programa compilado
  float bumpRight = 0.0, bumpLeft = 0.0, bumpUp = 0.0, bumpDown = 0.0;
  for (int k = 0; k < 4 + uNoUnroll; k++) {
    float bumpAt = rockBumps(c + (k == 0 ? vec2(e, 0.0) : k == 1 ? vec2(-e, 0.0) : k == 2 ? vec2(0.0, e) : vec2(0.0, -e)));
    if (k == 0) bumpRight = bumpAt; else if (k == 1) bumpLeft = bumpAt; else if (k == 2) bumpUp = bumpAt; else bumpDown = bumpAt;
  }
  vec2 bump = vec2(bumpRight - bumpLeft, bumpUp - bumpDown) / (2.0 * e);
  vec3 rn = normalize(n + vec3(tilt * rock - bump * 1.4, 0.0));
  float crack = rock * (1.0 - smoothstep(0.01, 0.05, cellA.z)) * smoothstep(0.45, 0.65, fbm(c * 1.7 + 9.0));
  float layer = fract(h * 2.5 + fbm(c * 0.8) * 0.35);
  float ledge = 1.0 - smoothstep(0.0, 0.1, layer);
  float underLedge = smoothstep(0.75, 1.0, layer);
  float strata = fract(h * 4.0 + fbm(c * vec2(0.6, 1.4)) * 0.9);
  vec3 painted = texture(uStone, c * 0.22 + vec2(0.0, h * 0.35)).rgb;
  painted = mix(painted, texture(uStoneLight, c * 0.31).rgb, 0.35) * vec3(1.02, 0.95, 0.86);
  vec3 col = painted * (0.82 + 0.3 * smoothstep(0.2, 0.6, strata));
  col *= 0.84 + 0.32 * fbm(c * 13.0);
  col = mix(col, col * 1.35, step(0.95, hashCell(floor(c * 52.0))) * 0.7);
  col *= 1.0 - step(0.965, hashCell(floor(c * 37.0) + 3.0)) * 0.35;
  // Luz da face (relativa, como acima) e os traços do teste.
  float shade = (uAmbientLum + uSunLum * 0.8 * max(dot(rn, uLightDir), 0.0) / flatLit) / flatLight;
  col *= clamp(mix(1.0, shade, max(uLightAmount, 0.5)), 0.3, 1.6);
  float below = ceil(h - 0.001) - h;
  col *= 1.0 - smoothstep(0.65, 1.0, below) * 0.35;       // pé da face mais escuro
  col += (1.0 - smoothstep(0.0, 0.08, below)) * 0.12;     // aresta de cima clara
  col *= 1.0 - crack * 0.35;
  col += ledge * 0.1;
  col *= 1.0 - underLedge * 0.18;
  // Contorno de tinta na aresta de cima, com largura fixa em pixels.
  float rim = 1.0 - smoothstep(0.0, max(fwidth(below) * 1.8, 0.0015), below);
  col = mix(col, vec3(0.1, 0.075, 0.06), rim * 0.9);
  float alpha = smoothstep(0.0, 0.25, rock);
  outColor = vec4(col * alpha, alpha);
}`;

/** Sombra do relevo na máscara de sombra do passo da luz (mistura pelo maior): 1 − iluminado. */
export const RELIEF_SHADOW_MASK_FRAGMENT = `#version 300 es
precision highp float;
${NO_UNROLL}
out vec4 outColor;
${RELIEF_SAMPLE}
${SCREEN}
void main() {
  vec2 texel;
  if (!reliefTexel(screenCell(), texel)) { outColor = vec4(0.0); return; }
  outColor = vec4(1.0 - reliefShadowAt(texel), 0.0, 0.0, 1.0);
}`;
