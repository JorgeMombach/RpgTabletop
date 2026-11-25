import { NO_UNROLL } from "./glKit";
/**
 * Shaders da água animada (docs/design/agua.md), portados do teste aprovado (`docs/design/agua-teste.html`). Os
 * números vêm do teste, feito a 48 px por casa: por isso as contas usam `px` = posição em casas × 48 (as mesmas escalas
 * de ruído, larguras e alturas do teste, em qualquer zoom). Diferença do teste: o barranco entra na água pintada (a
 * crista, altura 0, fica na borda pintada; fora dela nada é desenhado).
 *
 * Dois passos: o que não se mexe (barranco, fundo, luz, sombra, profundidade) é "assado" em texturas do tamanho da
 * tela quando a visão ou a água mudam (`BAKE_FRAGMENT`, nítido em qualquer zoom: etapa 3 do relevo, teste aprovado em
 * `docs/design/agua-hd-teste.html`); a cada quadro só a superfície da água é calculada (`WATER_FRAGMENT`), lendo o
 * assado pela posição na tela.
 */

/** Pedras por grupo de água que o shader considera (as demais ficam sem espuma). */
export const MAX_ROCKS = 16;

/** Profundidade e distância da água guardadas em 0–1 na textura assada. */
const DEPTH_RANGE = "64.0";
const WATER_RANGE = "136.0";
const WATER_OFFSET = "8.0";

const COMMON = `
const float UNIT = 48.0;            // px do teste por casa
const vec3 LIGHT = normalize(vec3(-0.55, -0.62, 0.56));
uniform vec4 uRectCells;            // canto e tamanho do grupo, em casas
uniform float uPerCell;
uniform sampler2D uSdfDeep;
uniform sampler2D uShore;           // tipo de costa do mar por pixel (0 nada, 1 praia, 2 pedra, 3 margem; docs/design/mar.md)
uniform highp sampler2D uRiver;     // RGBA32F: sem filtro de textura em todo aparelho, a interpolação é feita aqui

// Sorteio pelos bits do número (inteiros de 32 bits): igual perto e longe da origem do mapa.
float hash(vec2 p) {
  highp uvec2 q = floatBitsToUint(p);
  highp uint h = (q.x * 1597334677u) ^ (q.y * 3812015801u);
  h ^= h >> 16u; h *= 2246822519u; h ^= h >> 13u; h *= 3266489917u; h ^= h >> 16u;
  return float(h) * (1.0 / 4294967296.0);
}
float noise(vec2 p) {
  vec2 i = floor(p), f = fract(p); vec2 u = f * f * f * (f * (f * 6.0 - 15.0) + 10.0);
  return mix(mix(hash(i), hash(i + vec2(1, 0)), u.x), mix(hash(i + vec2(0, 1)), hash(i + vec2(1, 1)), u.x), u.y);
}
float fbm(vec2 p) { float v = 0.0, a = 0.5; mat2 r = mat2(0.8, 0.6, -0.6, 0.8); for (int k = 0; k < 5 + uNoUnroll; k++) { v += a * noise(p); p = r * p * 2.02 + 17.1; a *= 0.5; } return v; }
float fbm4(vec2 p) { float v = 0.0, a = 0.5; mat2 r = mat2(0.8, 0.6, -0.6, 0.8); for (int k = 0; k < 4 + uNoUnroll; k++) { v += a * noise(p); p = r * p * 2.02 + 17.1; a *= 0.5; } return v / 0.9375; }
vec2 hash2(vec2 p) { return vec2(hash(p), hash(p + vec2(31.7, 17.3))); }
// Voronoi: id, distância ao ponto mais perto e folga até a borda (pedrinhas do barranco, bolhas da espuma).
vec4 voronoi(vec2 p) { vec2 i = floor(p), f = fract(p); float d1 = 9.0, d2 = 9.0; vec2 id = vec2(0); for (int y = -1; y <= 1 + uNoUnroll; y++) for (int x = -1; x <= 1 + uNoUnroll; x++) { vec2 o = vec2(x, y), r = o + hash2(i + o) - f; float d = dot(r, r); if (d < d1) { d2 = d1; d1 = d; id = i + o; } else if (d < d2) d2 = d; } return vec4(id, sqrt(d1), sqrt(d2) - sqrt(d1)); }

// Posição (px do teste) -> coordenada da textura do grupo; px do campo -> px do teste.
vec2 fieldUv(vec2 px) { return (px / UNIT - uRectCells.xy) / uRectCells.zw; }
float toUnit(float fieldPx) { return fieldPx * UNIT / uPerCell; }
float lambert(vec3 n) { return max(dot(n, LIGHT), 0.0) / LIGHT.z; }
// Mar (docs/design/mar.md): a parte de mar (canal A do campo) e o tipo de costa perto dele.
float seaAt(vec2 px) { return texture(uSdfDeep, fieldUv(px)).a; }
int shoreAt(vec2 px) { return int(texture(uShore, fieldUv(px)).r * 255.0 + 0.5); }
// Costa do mar: dentro do mar ou na terra junto dele (a beira com ruído passa um pouco para o lado da terra, onde a
// parte de mar é pequena: sem isto ali caía o barranco de terra do lago, uma faixa escura na areia da praia).
bool seaCoast(vec2 px) { return seaAt(px) > 0.5 || shoreAt(px) > 0; }
// Quanto de praia (x), pedra (y) e margem (z) há em volta (5 amostras a meia casa): a passagem de um tipo para o outro
// fica suave em vez de um corte reto.
vec3 shoreMix(vec2 px) {
  vec3 total = vec3(0.0);
  for (int k = 0; k < 5; k++) {
    vec2 offset = k == 0 ? vec2(0.0) : vec2(k == 1 ? 1.0 : k == 2 ? -1.0 : 0.0, k == 3 ? 1.0 : k == 4 ? -1.0 : 0.0) * UNIT * 0.5;
    int kind = shoreAt(px + offset);
    total += vec3(kind == 1 ? 1.0 : 0.0, kind == 2 ? 1.0 : 0.0, kind == 3 ? 1.0 : 0.0);
  }
  return total / 5.0;
}
// Distância (px do teste) até a borda do campo: a borda aberta do mar some aos poucos ali.
float fieldEdge(vec2 px) { vec2 c = px / UNIT - uRectCells.xy; return min(min(c.x, c.y), min(uRectCells.z - c.x, uRectCells.w - c.y)) * UNIT; }
// Coordenadas do rio, interpoladas à mão entre os 4 texels (precisão cheia em "ao longo").
vec4 riverSample(vec2 uv) {
  ivec2 size = textureSize(uRiver, 0);
  vec2 p = uv * vec2(size) - 0.5;
  ivec2 i = ivec2(floor(p));
  vec2 f = fract(p);
  ivec2 top = size - 1;
  vec4 a = texelFetch(uRiver, clamp(i, ivec2(0), top), 0);
  vec4 b = texelFetch(uRiver, clamp(i + ivec2(1, 0), ivec2(0), top), 0);
  vec4 c = texelFetch(uRiver, clamp(i + ivec2(0, 1), ivec2(0), top), 0);
  vec4 d = texelFetch(uRiver, clamp(i + ivec2(1, 1), ivec2(0), top), 0);
  return mix(mix(a, b, f.x), mix(c, d, f.x), f.y);
}
`;

/** Retângulo do grupo: na tela (passo da água) ou ocupando a textura inteira (passo de assar). */
export const WATER_VERTEX = `#version 300 es
in vec2 aCorner;
uniform vec4 uRectCells;
uniform vec4 uMapGrid;     // offsetX, offsetY, cellPx do mapa e 0
uniform vec3 uStage;       // x, y e escala do palco (mapa -> tela)
uniform vec2 uScreen;      // tamanho da tela (px CSS)
uniform float uBake;       // 1 = assando (a textura inteira)
out vec2 vCell;
void main() {
  vCell = uRectCells.xy + aCorner * uRectCells.zw;
  if (uBake > 0.5) { gl_Position = vec4(aCorner * 2.0 - 1.0, 0.0, 1.0); return; }
  vec2 mapPx = uMapGrid.xy + vCell * uMapGrid.z;
  vec2 screen = mapPx * uStage.z + uStage.xy;
  vec2 clip = screen / uScreen * 2.0 - 1.0;
  gl_Position = vec4(clip.x, -clip.y, 0.0, 1.0);
}`;

/**
 * Passo de assar: cor do terreno já iluminada (barranco e fundo) e a borda (alpha) em uma textura; profundidade,
 * sombra e distância da água na outra.
 */
export const BAKE_FRAGMENT = `#version 300 es
precision highp float;
${NO_UNROLL}
in vec2 vCell;
layout(location = 0) out vec4 outTerrain;
layout(location = 1) out vec4 outData;
uniform sampler2D uDirt;
uniform float uPxUnits;     // px do teste (48 por casa) por pixel do aparelho
${COMMON}
/** Quanto de um detalhe com período period (px do teste) ainda aparece: some (vira a média) abaixo de ~2 pixels. */
float detailPx(float period) { return 1.0 - smoothstep(0.35, 0.8, uPxUnits / period); }
const float BANK = 14.0;            // altura do barranco
const float DEEP = 22.0;            // fundo da água abaixo da beira

// Distância da borda pintada (+ dentro), com a beira tremida em duas escalas.
float sdfAt(vec2 px) {
  return toUnit(texture(uSdfDeep, fieldUv(px)).r) + (fbm(px / 60.0) - 0.5) * 10.0 + (fbm(px / 9.0) - 0.5) * 2.5;
}
float bankWidth(vec2 px) { return mix(10.0, 30.0, fbm(px / 140.0 + 3.0)); }
// Margem suave (docs/design/estruturas-ajustes.md, teste em rios-teste.html): o barranco nunca passa de 40% da meia
// largura da água em volta (o rio fino mostra água) e a altura acompanha a largura; todas as margens 35% mais rasas.
float halfWidthAt(vec2 px) { return texture(uSdfDeep, fieldUv(px)).b; }
float bankW(vec2 px) {
  // mar: praia larga e rasa (a areia molhada onde a onda sobe), costa de pedra curta e funda, margem rasa; aberto, nada
  if (seaCoast(px)) return dot(shoreMix(px), vec3(UNIT, UNIT * 0.15, UNIT * 0.4));
  return min(bankWidth(px), halfWidthAt(px) * UNIT * 0.4);
}
float bankH(vec2 px) {
  if (seaCoast(px)) return dot(shoreMix(px), vec3(BANK * 0.25, BANK * 0.9, BANK * 0.4));
  return BANK * clamp(halfWidthAt(px) / 1.5, 0.4, 1.0) * 0.65;
}
// Altura: 0 fora e na crista (borda pintada), barranco descendo até a água, fundo descendo até o meio.
float heightAt(vec2 px) {
  float s = sdfAt(px);
  if (s <= 0.0) return 0.0;
  float bw = bankW(px);
  float bh = bankH(px);
  if (s < bw) { float x = s / bw; return -bh * x * x * (3.0 - 2.0 * x); }
  float w = s - bw;
  return -bh - DEEP * (1.0 + texture(uSdfDeep, fieldUv(px)).g) * (1.0 - exp(-w / 28.0));
}
// Relevo fino do barranco e do fundo: pedrinhas achatadas e grão, só para a luz.
float detailHeight(vec2 px) {
  vec4 v = voronoi(px / 3.0 + fbm(px / 2.0) * 0.6);
  float r = 0.18 + 0.14 * hash(v.xy + 1.0);
  float pebble = hash(v.xy) > 0.86 ? sqrt(max(0.0, 1.0 - pow(v.z / r, 2.0))) * 0.6 : 0.0;
  return pebble * 1.4 * detailPx(6.0) + (noise(px / 1.6) - 0.5) * 0.25 * detailPx(1.6) + (fbm(px / 6.0) - 0.5) * 0.6 * detailPx(3.0);
}
vec3 terrainNormal(vec2 px) {
  float e = 0.4;
  // As quatro amostras num laço: uma cópia só da altura e do relevo fino no programa compilado (no Direct3D, as
  // quatro chamadas soltas viravam quatro cópias e o bake levava ~4 s para compilar; assim, ~1,7 s).
  float right = 0.0, left = 0.0, up = 0.0, down = 0.0;
  for (int k = 0; k < 4 + uNoUnroll; k++) {
    vec2 at = px + (k == 0 ? vec2(e, 0) : k == 1 ? vec2(-e, 0) : k == 2 ? vec2(0, e) : vec2(0, -e));
    float height = heightAt(at) + detailHeight(at);
    if (k == 0) right = height; else if (k == 1) left = height; else if (k == 2) up = height; else down = height;
  }
  float hx = right - left;
  float hy = up - down;
  return normalize(vec3(-hx / (2.0 * e), -hy / (2.0 * e), 1.0));
}
// Sombra: anda na direção da luz; se o terreno sobe acima do raio, está na sombra (suave).
float shadowAt(vec2 px, float h0) {
  vec2 dir = normalize(LIGHT.xy);
  float rise = LIGHT.z / length(LIGHT.xy);
  float lit = 1.0;
  for (int k = 1; k <= 10 + uNoUnroll; k++) {
    float d = float(k) * 4.5;
    float over = heightAt(px + dir * d) - (h0 + d * rise);
    lit = min(lit, clamp(1.0 - over / 3.0, 0.0, 1.0));
  }
  return lit;
}
// Terra do barranco e do fundo: tons quentes em camadas suaves seguindo a curva de nível; lama perto da água.
vec3 earthMaterial(vec2 px, float h, float s, float bw) {
  vec3 dirt = textureLod(uDirt, px / 300.0, max(0.0, log2(max(float(textureSize(uDirt, 0).x) / 300.0 * uPxUnits, 1e-6)))).rgb;
  float x = clamp(-h / max(bankH(px), 1e-3), 0.0, 1.2);
  float strata = 0.94 + 0.06 * sin(h * 0.9 + fbm(px / 18.0) * 9.0);
  vec3 earth = mix(vec3(0.42, 0.31, 0.2), vec3(0.6, 0.48, 0.32), fbm(px / 40.0)) * (0.7 + 0.6 * dot(dirt, vec3(0.33))) * strata;
  earth = mix(earth, vec3(0.3, 0.26, 0.2), smoothstep(0.75, 1.0, x));
  // Grão, pedrinhas e a faixa de terra molhada logo acima da água.
  earth *= 0.92 + 0.16 * mix(0.5, noise(px / 1.3), detailPx(1.3));
  vec4 v = voronoi(px / 3.0 + fbm(px / 2.0) * 0.6);
  float r = 0.18 + 0.14 * hash(v.xy + 1.0);
  float pebble = hash(v.xy) > 0.86 ? smoothstep(r, r * 0.75, v.z) : 0.0;
  earth = mix(earth, earth * mix(vec3(1.25, 1.2, 1.12), vec3(0.85, 0.82, 0.8), hash(v.xy + 5.0)) * (0.9 + 0.2 * noise(px * 1.5)), pebble * 0.8 * detailPx(6.0));
  float wet = smoothstep(bw - 7.0, bw, s) * step(s, bw + 1.0);
  earth = mix(earth, earth * vec3(0.62, 0.6, 0.58), wet);
  // praia do mar: a faixa é de areia, mais escura e lisa conforme chega na água (molhada)
  vec3 kinds = seaCoast(px) ? shoreMix(px) : vec3(0.0);
  // costa de pedra: a face é rocha cinza, com veios, não barranco de terra
  if (kinds.y > 0.0) earth = mix(earth, vec3(0.4, 0.39, 0.37) * (0.8 + 0.35 * fbm(px / vec2(14.0, 4.0))) * (0.92 + 0.16 * mix(0.5, noise(px / 1.5), detailPx(1.5))), kinds.y);
  float beach = kinds.x;
  if (beach > 0.0) {
    vec3 sandColor = mix(vec3(0.78, 0.68, 0.5), vec3(0.88, 0.79, 0.6), fbm(px / 60.0)) * (0.95 + 0.08 * mix(0.5, noise(px), detailPx(1.0)));
    float soak = smoothstep(0.0, max(bw, 1.0), s);
    earth = mix(earth, mix(sandColor, sandColor * vec3(0.72, 0.68, 0.62), soak), beach);
  }
  return earth;
}

void main() {
  vec2 px = vCell * UNIT;
  float s = sdfAt(px);
  float fringe = s + (fbm(px / 6.0) - 0.5) * 6.0 + (fbm(px / 23.0) - 0.5) * 5.0;
  float alpha = smoothstep(0.0, 4.0, fringe);
  // Costa do mar: depois de pintado, o mar não é desenhado pelo terreno, e na borda irregular da areia (ou da pedra)
  // aparecia a mesa por baixo, uma faixa escura. A beira avança sobre a terra com a areia seca (ou a pedra) daqui.
  if (seaCoast(px)) alpha = max(alpha, smoothstep(-UNIT * 0.3, -UNIT * 0.12, fringe));
  // borda aberta do mar: some aos poucos nas últimas casas do campo (onde a pintura acabou sem nada do lado)
  if (seaAt(px) > 0.5) alpha *= smoothstep(0.0, UNIT * 1.5, fieldEdge(px));
  float bw = bankW(px);
  float h = heightAt(px);
  float w = s - bw;
  float sh = shadowAt(px, w > 0.0 ? -bankH(px) : h);
  float crest = 1.0 - smoothstep(0.0, 3.5, abs(s - 2.5));
  float foot = smoothstep(bw - 6.0, bw, s) * (1.0 - smoothstep(bw, bw + 6.0, s));
  // margem suave: menos contraste na luz do barranco, na base escura e na crista
  vec3 terrain = earthMaterial(px, h, s, bw) * (0.55 + 0.45 * lambert(terrainNormal(px)) * mix(0.7, 1.0, sh)) * (1.0 - 0.08 * foot) * (1.0 - 0.1 * crest);
  outTerrain = vec4(terrain, alpha);
  outData = vec4(clamp(max(-bankH(px) - h, 0.0) / ${DEPTH_RANGE}, 0.0, 1.0), sh, clamp((w + ${WATER_OFFSET}) / ${WATER_RANGE}, 0.0, 1.0), 1.0);
}`;

/** Passo da água, a cada quadro: superfície, cor pela profundidade, espuma, pedras, ondinhas do lago. */
export const WATER_FRAGMENT = `#version 300 es
precision highp float;
${NO_UNROLL}
in vec2 vCell;
out vec4 outColor;
uniform sampler2D uBakedTerrain, uBakedData;   // do tamanho da tela
uniform float uTime;
uniform vec2 uCanvas;       // canvas (px do aparelho)
uniform float uCellDevice;  // px do aparelho por casa
uniform vec3 uRocks[${MAX_ROCKS}];
uniform int uRockCount;
${COMMON}

// Rio: duas camadas (lenta nas margens, rápida no meio) andando ao longo da linha, com redemoinhos; lago: deriva.
float riverLayer(vec4 r, float speed, float seed) {
  vec2 q = vec2(r.x - uTime * speed, r.y) + seed;
  float swirl = fbm4(q / 46.0) * 26.0;
  return fbm4(vec2((q.x + swirl) / 40.0, (q.y - swirl * 0.4) / 17.0)) * 0.62 + fbm4(vec2((q.x + swirl * 0.5) / 15.0, q.y / 8.0) + 7.0) * 0.38;
}
float riverProfile(vec4 r) { return 1.0 - pow(clamp(abs(r.y) / 52.0, 0.0, 1.0), 2.0); }

// ---------- mar (docs/design/mar.md, teste aprovado em mar-teste.html) ----------
// Ondulação em casas: longe da costa, ondas em várias direções e tamanhos, tortas por ruído (sem padrão repetido);
// perto dela (coast), frentes paralelas à costa que encurtam e quebram. d = casas até a costa.
float swellAt(vec2 c, float d, float coast) {
  vec2 q = c + (vec2(fbm(c * 0.18), fbm(c * 0.18 + 9.0)) - 0.5) * 3.0;
  float open = 0.0;
  open += 0.34 * sin(dot(q, normalize(vec2(-1.0, 0.18))) * 2.6 + uTime * 1.5);
  open += 0.24 * sin(dot(q, normalize(vec2(-1.0, -0.45))) * 3.7 + uTime * 1.9 + 1.3);
  open += 0.18 * sin(dot(q, normalize(vec2(-0.7, 0.75))) * 5.3 + uTime * 2.4 + 2.1);
  open += 0.12 * sin(dot(q, normalize(vec2(-1.0, 0.05))) * 8.1 + uTime * 3.1 + 4.0);
  open += 0.12 * (fbm(q * 1.4 + vec2(uTime * 0.35, 0.0)) - 0.5) * 2.0;
  open = 0.5 + 0.5 * open;
  float near = coast * (1.0 - smoothstep(1.5, 5.0, d));
  float warp = fbm(vec2(c.y * 0.3 + c.x * 0.1, d * 0.2) + 3.0) * 2.0;
  float shore = 0.5 + 0.5 * sin(d * 6.2831853 / mix(1.4, 2.4, smoothstep(0.0, 5.0, d)) + uTime * 1.6 + warp);
  return mix(open, shore, near * 0.85);
}
// Cor do mar (turquesa no raso, azul fundo longe), luz e brilho da ondulação, e a espuma (cristas quebrando perto da
// costa, carneirinhos ao largo, renda no raso) no alpha.
vec4 seaSurface(vec2 c, float d, float coast) {
  float deep = smoothstep(0.0, 7.0, d) * coast + (1.0 - coast);
  vec3 col = mix(vec3(0.2, 0.55, 0.56), vec3(0.07, 0.33, 0.45), smoothstep(0.0, 0.45, deep));
  col = mix(col, vec3(0.03, 0.14, 0.28), smoothstep(0.4, 1.0, deep));
  float e = 0.05;
  float h = swellAt(c, d, coast);
  float hx = swellAt(c + vec2(e, 0.0), d + e, coast) - h;
  float hy = swellAt(c + vec2(0.0, e), d, coast) - h;
  float chop = (fbm(c * 3.0 + uTime * vec2(0.3, 0.2)) - 0.5) * 0.6;
  vec3 n = normalize(vec3(-hx / e * 0.35 + chop * 0.3, -hy / e * 0.35 + chop * 0.3, 1.0));
  float diffuse = max(dot(n, LIGHT), 0.0);
  float spec = pow(max(dot(n, normalize(LIGHT + vec3(0.0, 0.0, 1.0))), 0.0), 90.0);
  col = col * (0.7 + 0.45 * diffuse) + vec3(1.0, 0.96, 0.85) * spec * 0.9;
  float crest = smoothstep(0.82, 0.97, h);
  float breaking = coast * (1.0 - smoothstep(0.2, 1.8, d));
  float foam = crest * breaking * smoothstep(0.35, 0.6, fbm(c * 4.0 + vec2(0.0, uTime * 0.5)));
  float whitecap = smoothstep(0.93, 0.99, h) * smoothstep(0.66, 0.74, fbm(c * 1.2 + uTime * 0.15)) * (1.0 - coast * (1.0 - smoothstep(2.0, 6.0, d)));
  foam = max(foam, whitecap * 0.8);
  float lace = (1.0 - smoothstep(0.0, 1.2, d)) * coast * smoothstep(0.5, 0.65, fbm(c * 6.0 + uTime * vec2(0.1, 0.25)));
  return vec4(col, max(foam, lace * 0.55));
}

void main() {
  vec2 px = vCell * UNIT;
  vec2 uv = fieldUv(px);
  vec2 screenUv = gl_FragCoord.xy / uCanvas;
  vec4 baked = texture(uBakedTerrain, screenUv);
  if (baked.a <= 0.0) { outColor = vec4(0.0); return; }
  vec4 data = texture(uBakedData, screenUv);
  vec3 color = baked.rgb;
  float w = data.b * ${WATER_RANGE} - ${WATER_OFFSET};
  if (seaCoast(px)) {
    // Mar: casas até a costa (do pé da margem), a costa por perto, e a onda que sobe na praia. A distância vem do campo
    // (meia precisão), não do "assado" (8 bits, de -8 a 128 px): a praia tem 1 casa e o azul fundo chega a 7.
    vec2 c = px / UNIT;
    vec3 kinds = shoreMix(px);
    // (na borda aberta o campo não tem terra: a costa fica longe e ali é mar aberto)
    float coastCells = toUnit(texture(uSdfDeep, uv).r) / UNIT;
    float coast = 1.0 - smoothstep(5.0, 7.0, coastCells);
    // do pé da margem (praia 1 casa, pedra 0,15, margem 0,4), com a beira um pouco torta
    float seaW = coastCells + (fbm(c * 0.8) - 0.5) * 0.4 - dot(kinds, vec3(1.0, 0.15, 0.4));
    float d = max(seaW, 0.0);
    float runup = kinds.x * (0.25 + 0.35 * (0.5 + 0.5 * sin(uTime * 0.8 + c.y * 0.35 + c.x * 0.2 + fbm(c * 0.3) * 3.0)));
    float reach = seaW + runup;
    vec4 surface = seaSurface(c, d, coast);
    vec3 seaColor = surface.rgb * mix(0.55, 1.0, data.g);
    float foam = surface.a;
    if (kinds.x > 0.0) {
      // praia: a ponta da onda na areia, e a lâmina fina (a areia aparece por baixo)
      foam = max(foam, kinds.x * (1.0 - smoothstep(0.0, 0.18, abs(reach))) * smoothstep(0.3, 0.55, fbm(c * 5.0 + uTime * 0.4)));
      seaColor = mix(seaColor, mix(baked.rgb * vec3(0.7, 0.75, 0.72) + vec3(0.04, 0.1, 0.1), seaColor, smoothstep(0.0, 0.5, reach)), kinds.x);
    }
    if (kinds.y > 0.0) {
      // costa de pedra e penhasco: a onda bate na base, com espuma que pulsa
      float pulse = pow(0.5 + 0.5 * sin(uTime * 1.6 + c.y * 0.5 + c.x * 0.3 + fbm(vec2(c.y, 3.0)) * 4.0), 3.0);
      float base = 1.0 - smoothstep(0.0, 0.9 + pulse * 0.6, d);
      foam = max(foam, kinds.y * base * smoothstep(0.25, 0.5, fbm(c * 4.0 + uTime * 0.6)) * (0.6 + 0.4 * pulse));
    }
    // pedras: anel de espuma, mais forte que no lago
    for (int k = 0; k < ${MAX_ROCKS} + uNoUnroll; k++) {
      if (k >= uRockCount) break;
      float dr = length(px - uRocks[k].xy * UNIT) / UNIT - uRocks[k].z;
      if (dr < 0.6) foam = max(foam, (1.0 - smoothstep(0.0, 0.35 + 0.15 * sin(uTime * 2.0 + float(k)), dr)) * smoothstep(0.3, 0.55, fbm(c * 6.0 + uTime * 0.7)));
    }
    vec4 bubble = voronoi(c * 14.0 + uTime * 0.2);
    float bubbles = 0.75 + 0.25 * smoothstep(0.02, 0.12, bubble.w);
    seaColor = mix(seaColor, vec3(0.92, 0.97, 0.96), clamp(foam * bubbles, 0.0, 1.0) * 0.85);
    vec3 seaOut = mix(baked.rgb, seaColor, smoothstep(-0.02, 0.06, reach));
    seaOut = pow(seaOut, vec3(0.95));
    outColor = vec4(seaOut * baked.a, baked.a);
    return;
  }
  if (w > -1.0) {
    float depth = data.r * ${DEPTH_RANGE};
    float sh = data.g;
    vec4 raw = riverSample(uv);
    vec4 riv = vec4(toUnit(raw.x), toUnit(raw.y), raw.z, raw.w);
    float strength = riv.z;
    float strong = max(strength, 0.15);
    float profile = riverProfile(riv);
    float flowing = strength > 0.001 ? mix(riverLayer(riv, 26.0 * strong, 0.0), riverLayer(riv, 64.0 * strong, 31.0), profile) : 0.5;
    vec2 drift = px + vec2(uTime * 3.0, uTime * 2.0);
    float still = fbm4(drift / 40.0) * 0.6 + fbm4(drift / 14.0 + 3.0) * 0.4;
    float w0 = mix(still, flowing, smoothstep(0.0, 1.0, strength));
    // Ondinhas finas por cima (somem quando ficariam menores que um pixel).
    float pxUnits = UNIT / uCellDevice;
    float fine = (fbm4(px / 6.0 + vec2(uTime * 1.1, -uTime * 0.8)) - 0.5) * 0.12 + (noise(px / 2.6 - uTime * 1.6) - 0.5) * 0.04 * smoothstep(2.0, 0.6, pxUnits);
    float wd = w0 + fine * smoothstep(3.0, 1.0, pxUnits);
    // Pedras: a água sobe numa cúpula por cima de cada uma (até 2,2 vezes o raio; o desenho da pedra cobre o meio).
    // A altura entra na inclinação da superfície; o lado virado para a luz clareia e o outro escurece pela inclinação
    // da própria cúpula (a ondulação em volta é forte demais para ela aparecer só pelas ondas); a água rasa clareia.
    float dome = 0.0;
    float domeLight = 0.0;
    for (int k = 0; k < ${MAX_ROCKS} + uNoUnroll; k++) {
      if (k >= uRockCount) break;
      float reach = uRocks[k].z * UNIT * 2.2;
      vec2 fromCenter = px - uRocks[k].xy * UNIT;
      float t = length(fromCenter) / max(reach, 1e-3);
      if (t >= 1.0) continue;
      float bump = 1.0 - t * t;
      if (bump * bump > dome) {
        dome = bump * bump;
        // inclinação de (1 − t²)², no máximo ~1,54 em t ≈ 0,58; positiva onde a encosta olha para a luz
        domeLight = dot(fromCenter / max(length(fromCenter), 1e-3), normalize(LIGHT.xy)) * 4.0 * t * bump / 1.54;
      }
    }
    wd += dome * 0.45;
    // Inclinação da superfície pelas derivadas da tela (uma conta só por pixel).
    vec2 stepX = dFdx(px), stepY = dFdy(px);
    float slopeX = dFdx(wd) / max(length(stepX), 1e-3);
    float slopeY = dFdy(wd) / max(length(stepY), 1e-3);
    vec3 wn = normalize(vec3(-slopeX * 12.0, -slopeY * 12.0, 1.0));
    // Fundo visto pela água (o terreno assado, torto pela ondulação): escurece e esverdeia com a profundidade.
    vec2 refr = wn.xy * 6.0 * smoothstep(0.0, 6.0, depth);
    vec3 bottom = texture(uBakedTerrain, screenUv + vec2(refr.x, -refr.y) / UNIT * uCellDevice / uCanvas).rgb;
    vec3 absorb = exp(-depth * vec3(0.13, 0.04, 0.035));
    vec3 col = bottom * absorb + vec3(0.04, 0.3, 0.36) * (1.0 - absorb);
    // Base nunca negativa (potência de número negativo dá conta inválida: manchas pretas).
    float caustic = pow(max(0.0, 1.0 - abs(fbm4(px / 14.0 + uTime * 0.25) - fbm4(px / 19.0 - uTime * 0.2)) * 2.0), 10.0);
    col += caustic * exp(-depth / 8.0) * 0.26;
    float fres = 0.08 + 0.25 * (1.0 - wn.z) * 8.0;
    col = mix(col, vec3(0.5, 0.85, 0.86), clamp(fres, 0.0, 0.35) * smoothstep(0.0, 5.0, depth));
    col *= 0.92 + (w0 - 0.5) * 0.3;
    col = mix(col, vec3(0.5, 0.82, 0.8), dome * 0.3);
    col *= 1.0 + 0.28 * domeLight;
    float spec = dot(wn, normalize(LIGHT + vec3(0, 0, 1)));
    col += smoothstep(0.975, 0.995, spec) * 0.3;
    // Brilhos miúdos do sol nas cristas das ondinhas.
    col += smoothstep(0.996, 0.9995, spec) * 0.45 * smoothstep(0.0, 4.0, depth);
    col *= mix(0.55, 1.0, sh);

    // Espuma do rio: riscos que correm com a água, mais perto das margens.
    vec2 q = vec2(riv.x - uTime * mix(26.0, 64.0, profile) * strong, riv.y);
    float streak = strength > 0.001 ? fbm4(vec2(q.x / 46.0, q.y / 9.0) + 11.0) * 0.75 + fbm4(vec2(q.x / 12.0, q.y / 4.0)) * 0.25 : 0.0;
    float foam = strength * smoothstep(0.64, 0.74, streak) * (1.0 - smoothstep(0.0, 18.0, w)) * 0.85;
    // Pedras: anel de espuma em volta e esteira rio abaixo (direção = onde "ao longo" cresce).
    vec2 along = vec2(dFdx(riv.x), dFdy(riv.x));
    vec2 downstream = length(along) > 1e-4 ? normalize(vec2(along.x / max(length(stepX), 1e-3), along.y / max(length(stepY), 1e-3))) : vec2(0.0);
    // Ruído da espuma das pedras: o mesmo para todas, calculado uma vez (e só se há pedra).
    float rockFoam = uRockCount > 0 ? smoothstep(0.4, 0.6, fbm4(px / 5.0 + uTime * 0.8)) : 0.0;
    float wakeFoam = uRockCount > 0 ? smoothstep(0.45, 0.7, fbm4(vec2(q.x / 10.0, q.y / 3.0) + 5.0)) : 0.0;
    for (int k = 0; k < ${MAX_ROCKS} + uNoUnroll; k++) {
      if (k >= uRockCount) break;
      vec2 center = uRocks[k].xy * UNIT;
      float radius = uRocks[k].z * UNIT;
      vec2 offset = px - center;
      float d = length(offset);
      if (d > radius + 80.0) continue;
      float ring = (1.0 - smoothstep(radius, radius + 8.0, d)) * smoothstep(radius * 0.7, radius, d);
      foam = max(foam, ring * rockFoam * 0.85);
      float behind = dot(offset, downstream);
      float side = abs(dot(offset, vec2(-downstream.y, downstream.x)));
      float wake = step(0.0, behind) * (1.0 - smoothstep(radius * 0.6, radius * 1.1, side)) * (1.0 - smoothstep(0.0, 70.0, behind));
      foam = max(foam, strength * wake * wakeFoam);
    }
    // Lago: de vez em quando uma ondinha nasce na margem e entra.
    float gate = smoothstep(0.55, 0.75, fbm4(px / 160.0 + vec2(uTime * 0.05, uTime * 0.03)));
    float ripple = sin(w / 11.0 - uTime * 1.6);
    foam = max(foam, (1.0 - strength) * gate * smoothstep(0.9, 1.0, ripple) * smoothstep(2.0, 8.0, w) * (1.0 - smoothstep(10.0, 55.0, w)) * 0.5);
    // Beira: espuma fina onde a água encosta.
    foam = max(foam, (1.0 - smoothstep(0.0, 3.5, w)) * smoothstep(0.45, 0.62, fbm4(px / 7.0 + uTime * 0.2)) * 0.6);
    // A espuma vira bolhas (células claras com borda) em vez de mancha lisa.
    vec4 bubble = voronoi(px / 1.6 + vec2(uTime * 0.4, 0.0));
    float bubbles = 0.55 + 0.6 * smoothstep(0.02, 0.14, bubble.w);
    vec3 foamColor = vec3(0.88, 0.95, 0.93) * (0.9 + 0.15 * smoothstep(0.25, 0.0, bubble.z));
    col = mix(col, foamColor, clamp(foam * bubbles, 0.0, 1.0) * 0.8);
    // Linha fina e clara onde a água encosta na terra.
    col += (1.0 - smoothstep(0.0, max(pxUnits * 1.5, 0.6), abs(w))) * 0.12;
    color = mix(baked.rgb, col, smoothstep(-1.0, 2.5, w));
  }
  color = pow(color, vec3(0.95));
  outColor = vec4(color * baked.a, baked.a);
}`;
