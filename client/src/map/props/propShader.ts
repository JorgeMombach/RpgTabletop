import { PROP_KINDS, type PropKind } from "@rpg/shared";
import { NO_UNROLL } from "../ground/glKit";
import { PROP_EXTENT } from "./propLayout";

/**
 * Objetos na placa de vídeo (docs/design/objetos.md), portados da página aprovada (`docs/design/objetos-teste.html`).
 *
 * - **Assar** (`propBakeFragment`): a forma de um tipo com uma semente, uma vez, num lugar do atlas. Duas saídas:
 *   forma (R = distância até a borda de fora, G = altura, B = distância até a borda da parte de cima, A = material e
 *   tom) e inclinação (RG = normal xy).
 * - **Desenhar** (`PROP_DRAW_VERTEX` / `PROP_DRAW_FRAGMENT`): um retângulo por objeto lê o atlas, aplica o vento,
 *   calcula o detalhe fino na hora (folhinhas, veio, agulhas, trama) e a luz relativa ao chão plano (a luz da cena,
 *   a sombra e as tochas vêm do mapa de luz por cima). Cor pré-multiplicada.
 */

/** Materiais (o número vai no canal A, × 32). */
export const PROP_MATERIALS = { leaves: 0, needles: 1, stone: 3, wood: 4, darkWood: 5, iron: 6, cloth: 7 } as const;

const NOISE = `
const float TAU = 6.2831853;
float hash12(vec2 p) { vec3 p3 = fract(vec3(p.xyx) * 0.1031); p3 += dot(p3, p3.yzx + 33.33); return fract((p3.x + p3.y) * p3.z); }
vec2 hash22(vec2 p) { vec3 p3 = fract(vec3(p.xyx) * vec3(0.1031, 0.1030, 0.0973)); p3 += dot(p3, p3.yzx + 33.33); return fract((p3.xx + p3.yz) * p3.zy); }
float vnoise(vec2 p) {
  vec2 i = floor(p), f = fract(p), u = f * f * (3.0 - 2.0 * f);
  float a = hash12(i), b = hash12(i + vec2(1.0, 0.0)), c = hash12(i + vec2(0.0, 1.0)), d = hash12(i + vec2(1.0, 1.0));
  return mix(mix(a, b, u.x), mix(c, d, u.x), u.y);
}
float fbm(vec2 p) { float s = 0.0, a = 0.5; for (int i = 0; i < 4 + uNoUnroll; i++) { s += a * vnoise(p); p = p * 2.03 + 17.1; a *= 0.5; } return s / 0.9375; }
// x = distância ao centro mais perto, y = distância até a borda (aprox.), z = sorteio da célula; toCenter = vetor até o centro
vec3 voronoi(vec2 p, out vec2 toCenter) {
  vec2 n = floor(p), f = fract(p);
  float d1 = 8.0, d2 = 8.0; vec2 best = vec2(0.0), cell = vec2(0.0);
  for (int j = -1; j <= 1 + uNoUnroll; j++) for (int i = -1; i <= 1 + uNoUnroll; i++) {
    vec2 g = vec2(float(i), float(j)), r = g + hash22(n + g) - f;
    float d = dot(r, r);
    if (d < d1) { d2 = d1; d1 = d; best = r; cell = n + g; } else if (d < d2) d2 = d;
  }
  toCenter = best;
  return vec3(sqrt(d1), sqrt(d2) - sqrt(d1), hash12(cell));
}
`;

/** As formas (coordenadas do objeto, tamanho 1, sem vento). `edge` = distância até a borda da parte de cima (1 = longe). */
const SHAPES = `
struct Hit { float sd; float h; int mat; float tone; float edge; };
float sdBox(vec2 p, vec2 b) { vec2 d = abs(p) - b; return -(length(max(d, 0.0)) + min(max(d.x, d.y), 0.0)); }
float sdSegment(vec2 p, vec2 a, vec2 b, float w) { vec2 pa = p - a, ba = b - a; float t = clamp(dot(pa, ba) / dot(ba, ba), 0.0, 1.0); return w - length(pa - ba * t); }
// Junta uma peça: o contorno é a união; a superfície (e a borda de dentro) é a da peça mais alta.
void take(inout Hit o, float sd, float h, int mat, float tone) {
  bool inside = sd > 0.0, was = o.sd > 0.0;
  if ((inside && (!was || h > o.h)) || (!inside && !was && sd > o.sd)) { o.h = h; o.mat = mat; o.tone = tone; o.edge = sd; }
  o.sd = max(o.sd, sd);
}

// Copa (árvore e arbusto): lobos em volta do miolo e bolas de folha redondas sobrepostas, borda recortada em folhas.
Hit canopy(vec2 q, float seed, float scale, float top) {
  vec2 qs = q / scale;
  float sd = -1e3, h = 0.0, tone = 0.0;
  for (int i = 0; i < 8 + uNoUnroll; i++) {
    float fi = float(i);
    vec2 r2 = hash22(vec2(seed * 13.1, fi * 7.31));
    float ang = fi * TAU / 7.0 + r2.x * 0.7 + seed;
    vec2 c = i == 0 ? (r2 - 0.5) * 0.12 : vec2(cos(ang), sin(ang)) * (0.47 + 0.16 * r2.y);
    float rad = i == 0 ? 0.6 : 0.36 + 0.14 * r2.y;
    float d = length(qs - c);
    float t = clamp(d / rad, 0.0, 1.0);
    float hi = top * ((i == 0 ? 0.86 : 0.74 + 0.08 * r2.x) + 0.2 * (1.0 - t * t));
    sd = max(sd, rad - d);
    if (rad - d > -0.06 && hi > h) { h = hi; tone = r2.x; }
  }
  float best = -1e3, ballEdge = 1.0, ballTone = 0.0, ballSd = -1e3;
  for (int i = 0; i < 30 + uNoUnroll; i++) {
    float fi = float(i);
    vec2 r3 = hash22(vec2(seed * 5.7 + fi, fi * 3.3 + 1.0));
    float ang = r3.x * TAU, ring = sqrt(r3.y) * 0.8;
    vec2 c = vec2(cos(ang), sin(ang)) * ring;
    float rad = 0.16 + 0.09 * hash12(vec2(fi, seed));
    vec2 rel = qs - c;
    float d = length(rel);
    vec2 dir = rel / max(d, 1e-4);
    float leafy = (vnoise(dir * 5.0 + fi * 7.1) - 0.5) * 0.22 + (vnoise(dir * 16.0 + fi * 3.3) - 0.5) * 0.12;
    float s = rad * (1.0 + leafy) - d;
    ballSd = max(ballSd, s);
    float t = clamp(d / (rad * 1.08), 0.0, 1.0);
    float hb = 0.9 - ring * 0.25 + 0.12 * sqrt(1.0 - t * t) + 0.04 * hash12(vec2(seed, fi * 1.7));
    if (s > 0.0 && hb > best) { best = hb; ballEdge = s; ballTone = hash12(vec2(fi, seed * 3.0)); }
  }
  sd = max(sd - 0.12, ballSd) + (vnoise(qs * 26.0 + seed) - 0.5) * 0.025;
  if (best > 0.0) h = top * best;
  return Hit(sd * scale, h, ${PROP_MATERIALS.leaves}, tone * 0.3 + ballTone * 0.7, best > 0.0 ? ballEdge * scale : 1.0);
}

// Pinheiro de cima: andares de galhos em estrela, o de cima menor e mais alto.
Hit pine(vec2 q, float seed) {
  float r = length(q);
  vec2 dir = r > 0.0 ? q / r : vec2(1.0, 0.0);
  float a = atan(q.y, q.x);
  float sd = -1e3, h = 0.0, tier = 0.0, tierEdge = 1.0;
  for (int k = 0; k < 5 + uNoUnroll; k++) {
    float fk = float(k);
    float R = 1.1 * (1.0 - fk * 0.19);
    float n = 19.0 - fk * 3.0;
    float twist = hash12(vec2(seed, fk)) * TAU;
    float s = pow(abs(cos((a + twist) * n * 0.5)), 1.4);
    float jag = vnoise(dir * (7.0 + fk * 2.0) + vec2(fk * 3.7, seed));
    float fringe = vnoise(dir * 70.0 + vec2(fk * 11.0, seed));
    float edge = R * (0.78 + 0.22 * s) * (0.9 + 0.18 * jag) * (0.96 + 0.06 * fringe);
    float sdk = edge - r;
    float hk = 0.5 + fk * 0.42 + 0.34 * (1.0 - r / edge);
    sd = max(sd, sdk);
    if (sdk > -0.02 && hk > h) { h = hk; tier = fk; tierEdge = sdk; }
  }
  float needles = vnoise(dir * 40.0 + vec2(r * 3.0, seed));
  float fine = vnoise(dir * 110.0 + vec2(r * 10.0, seed * 2.0));
  h += (needles - 0.5) * 0.03;
  sd += (fine - 0.5) * 0.025;
  return Hit(sd, h, ${PROP_MATERIALS.needles}, tier / 5.0, tierEdge);
}

// Pedregulho: contorno irregular, facetas planas (luz por faceta) e algumas rachaduras.
Hit boulder(vec2 q, float seed) {
  float r = length(q);
  vec2 dir = r > 0.0 ? q / r : vec2(1.0, 0.0);
  float edge = 0.62 * (1.0 + 0.5 * (fbm(dir * 1.3 + seed * 5.0) - 0.5));
  float t = clamp(r / edge, 0.0, 1.0);
  vec2 tc; vec3 v = voronoi(q * 4.2 + seed * 7.0, tc);
  vec2 g = (hash22(vec2(v.z * 91.0, seed)) - 0.5) * 0.9;
  float facet = dot(-tc, g) * 0.03;
  float crack = step(0.72, fract(v.z * 7.0)) > 0.5 ? v.y / 4.2 : 1.0;
  return Hit(edge - r + (vnoise(q * 20.0 + seed) - 0.5) * 0.015, 0.04 + 0.7 * (1.0 - t * t) + facet * (0.4 + 0.6 * t), ${PROP_MATERIALS.stone}, v.z, crack);
}

// Barril de cima: tampa de tábuas, borda das aduelas, aro de ferro, aduelas abaulando para fora.
Hit barrel(vec2 q, float seed) {
  float r = length(q), R = 0.36;
  float a = atan(q.y, q.x);
  float tone = hash12(vec2(seed, 3.0));
  float sd = R - r + (vnoise(vec2(a * 3.0, seed)) - 0.5) * 0.008;
  if (r < 0.285) {
    float pw = 0.143, x = q.x + 0.29, k = floor(x / pw), fx = fract(x / pw);
    float edge = min(min(fx, 1.0 - fx) * pw, 0.285 - r);
    float bung = length(q - vec2(0.1, 0.05)) - 0.03;
    if (bung < 0.0) return Hit(sd, 0.94, ${PROP_MATERIALS.iron}, tone, -bung);
    return Hit(sd, 0.96, ${PROP_MATERIALS.wood}, hash12(vec2(seed, k)), min(edge, bung));
  }
  if (r < 0.31) return Hit(sd, 0.99, ${PROP_MATERIALS.darkWood}, tone, min(r - 0.285, 0.31 - r));
  if (r < 0.33) return Hit(sd, 0.975 - (r - 0.31) * 0.6, ${PROP_MATERIALS.iron}, tone, min(r - 0.31, 0.33 - r));
  float st = a / TAU * 18.0 + tone * 3.0, sf = fract(st);
  return Hit(sd, 0.96 - (r - 0.33) / (R - 0.33) * 0.4, ${PROP_MATERIALS.wood}, hash12(vec2(seed, floor(st))), min(min(sf, 1.0 - sf) * r * TAU / 18.0, r - 0.33));
}

// Carroça de cima: caixa de tábuas com guarda, rodas aparecendo dos lados, varais na frente e sacos de carga.
Hit cart(vec2 q, float seed) {
  Hit o = Hit(-1e3, 0.0, 0, 0.0, 1.0);
  for (int i = 0; i < 2 + uNoUnroll; i++) {
    float s = i == 0 ? -1.0 : 1.0;
    vec2 w = q - vec2(-0.05, s * 0.5);
    float t = clamp(w.x / 0.34, -1.0, 1.0);
    take(o, sdBox(w, vec2(0.34, 0.055)), 0.22 + 0.42 * sqrt(1.0 - t * t), abs(w.y) < 0.022 ? ${PROP_MATERIALS.iron} : ${PROP_MATERIALS.darkWood}, 0.3);
    take(o, sdSegment(q, vec2(0.72, s * 0.3), vec2(1.5, s * 0.2), 0.035), 0.42, ${PROP_MATERIALS.wood}, 0.6);
  }
  take(o, sdSegment(q, vec2(1.36, -0.22), vec2(1.36, 0.22), 0.03), 0.44, ${PROP_MATERIALS.wood}, 0.5);
  float sb = sdBox(q, vec2(0.75, 0.42));
  float k = floor((q.y + 0.42) / 0.12), fy = fract((q.y + 0.42) / 0.12);
  if (sb < 0.06) take(o, sb, 0.7, ${PROP_MATERIALS.darkWood}, 0.2);
  else {
    take(o, sb, 0.52, ${PROP_MATERIALS.wood}, hash12(vec2(seed, k)));
    // frestas entre as tábuas do fundo (só onde a caixa é a peça de cima)
    if (o.mat == ${PROP_MATERIALS.wood} && o.h == 0.52) o.edge = min(sb - 0.06, min(fy, 1.0 - fy) * 0.12);
  }
  for (int i = 0; i < 3 + uNoUnroll; i++) {
    float fi = float(i);
    vec2 c = vec2(-0.42 + fi * 0.3, (hash12(vec2(seed, fi)) - 0.5) * 0.36);
    float rad = 0.19 - fi * 0.015;
    vec2 d = q - c;
    float ang = atan(d.y, d.x);
    float dd = length(d) * (1.0 + 0.07 * sin(ang * 3.0 + fi));
    float t = clamp(dd / rad, 0.0, 1.0);
    take(o, rad - dd, 0.58 + 0.3 * (1.0 - t * t), ${PROP_MATERIALS.cloth}, hash12(vec2(seed, fi + 9.0)));
  }
  return o;
}
`;

/** A chamada da forma de cada tipo já desenhado na placa (os outros tipos chegam na Tarefa 6). */
const SHAPE_CALL: Partial<Record<PropKind, string>> = {
  tree: "canopy(q, seed, 1.0, 2.1)",
  bush: "canopy(q, seed, 0.52, 0.75)",
  pine: "pine(q, seed)",
  boulder: "boulder(q, seed)",
  barrel: "barrel(q, seed)",
  cart: "cart(q, seed)",
};

/** Tipos que a placa já sabe desenhar. */
export const SHAPED_KINDS: ReadonlySet<PropKind> = new Set(PROP_KINDS.filter((kind) => SHAPE_CALL[kind] !== undefined));

/** Programa que assa a forma de um tipo num lugar do atlas (triângulo da tela inteira, com o viewport no lugar). */
export function propBakeFragment(kind: PropKind): string {
  const call = SHAPE_CALL[kind] ?? "Hit(-1.0, 0.0, 0, 0.0, 1.0)";
  return `#version 300 es
precision highp float;
${NO_UNROLL}
layout(location = 0) out vec4 outShape;
layout(location = 1) out vec4 outSlope;
uniform vec3 uSlot;      // canto (px do atlas) e lado do lugar
uniform float uReach;    // meia largura do lugar, em casas do objeto
uniform float uSeed;
${NOISE}
${SHAPES}
Hit shapeAt(vec2 q) { float seed = uSeed; return ${call}; }
void main() {
  vec2 q = ((gl_FragCoord.xy - uSlot.xy) / uSlot.z * 2.0 - 1.0) * uReach;
  Hit o = shapeAt(q);
  float step = uReach * 2.0 / uSlot.z;
  float hx = shapeAt(q + vec2(step, 0.0)).h;
  float hy = shapeAt(q + vec2(0.0, step)).h;
  // degrau entre partes não vira parede (o contorno de dentro marca): a inclinação é limitada
  vec2 grad = vec2(hx - o.h, hy - o.h) / step;
  grad *= min(1.0, 2.5 / max(length(grad), 1e-4));
  vec3 n = normalize(vec3(-grad, 1.0));
  outShape = vec4(clamp(0.5 + o.sd * 2.0, 0.0, 1.0), clamp(o.h / 4.0, 0.0, 1.0), clamp(o.edge * 4.0, 0.0, 1.0), (float(o.mat) * 32.0 + floor(clamp(o.tone, 0.0, 1.0) * 31.0 + 0.5)) / 255.0);
  outSlope = vec4(n.xy * 0.5 + 0.5, 0.0, 1.0);
}
`;
}

/** Retângulo por objeto, instanciado: canto (atributo 0) e as 3 vec4 da `propRow` (atributos 1 a 3). */
export const PROP_DRAW_VERTEX = `#version 300 es
precision highp float;
layout(location = 0) in vec2 aCorner;
layout(location = 1) in vec4 aPlace;   // col, row, tamanho, giro (rad)
layout(location = 2) in vec4 aKind;    // tipo, semente, base, transparente
layout(location = 3) in vec4 aSlot;    // camada, x, y, lado
uniform vec4 uMapGrid;
uniform vec3 uStage;
uniform vec2 uScreen;
uniform float uExtents[${PROP_KINDS.length}];
out vec2 vLocal;
out vec2 vWorld;
flat out vec4 vPlace;
flat out vec4 vKind;
flat out vec4 vSlot;
void main() {
  float reach = uExtents[int(aKind.x + 0.5)];
  vec2 local = aCorner * reach;
  float c = cos(aPlace.w), s = sin(aPlace.w);
  vec2 world = aPlace.xy + mat2(c, s, -s, c) * local * aPlace.z;
  vec2 screen = (world * uMapGrid.z + uMapGrid.xy) * uStage.z + uStage.xy;
  gl_Position = vec4(screen.x / uScreen.x * 2.0 - 1.0, 1.0 - screen.y / uScreen.y * 2.0, 0.0, 1.0);
  vLocal = local;
  vWorld = world;
  vPlace = aPlace;
  vKind = aKind;
  vSlot = aSlot;
}
`;

/** Lista dos alcances por tipo (na ordem de `PROP_KINDS`), para o uniform `uExtents`. */
export const PROP_EXTENTS = new Float32Array(PROP_KINDS.map((kind) => PROP_EXTENT[kind]));

const KIND_INDEX = (kind: PropKind) => PROP_KINDS.indexOf(kind);

export const PROP_DRAW_FRAGMENT = `#version 300 es
precision highp float;
precision highp sampler2DArray;
${NO_UNROLL}
in vec2 vLocal;
in vec2 vWorld;
flat in vec4 vPlace;
flat in vec4 vKind;
flat in vec4 vSlot;
out vec4 outColor;
uniform vec4 uMapGrid;
uniform vec3 uStage;
uniform vec2 uScreen;
uniform vec2 uCanvas;
uniform sampler2DArray uShape, uSlope;
uniform float uAtlas;      // lado do atlas (px)
uniform float uPoints;     // pontos por casa da resolução atual
uniform sampler2D uLeaves, uStone, uDirt;
uniform vec3 uLightDir;
uniform float uLightAmount, uAmbientLum, uSunLum;
uniform float uTime, uWind;
uniform vec2 uWindDir;
${NOISE}
const vec3 INK = vec3(0.03, 0.025, 0.02);

/** Pixels do aparelho por casa do mapa. */
float devicePerCell() { return uMapGrid.z * uStage.z * (uCanvas.x / uScreen.x); }
/** Aquarela com o nível de detalhe pelo tamanho do pixel (leitura sem derivada: dentro de condicional não pode). */
vec3 art(sampler2D image, vec2 uv, float uvPerCell) {
  float texels = float(textureSize(image, 0).x) * uvPerCell / devicePerCell();
  return textureLod(image, uv, max(0.0, log2(max(texels, 1e-6)))).rgb;
}
/** Luz da face relativa ao chão plano (1 no plano), a mesma das paredes. */
float relativeShade(vec3 n) {
  float flatLit = max(uLightDir.z, 0.35);
  float flatLight = uAmbientLum + uSunLum * 0.8;
  float shade = (uAmbientLum + uSunLum * 0.8 * max(dot(n, uLightDir), 0.0) / flatLit) / max(flatLight, 0.001);
  return clamp(mix(1.0, shade, max(uLightAmount, 0.5)), 0.3, 1.6);
}
/** Ponto do atlas para a coordenada do objeto (dentro do lugar, com meio ponto de folga). */
vec3 atlasAt(vec2 q) {
  float reach = vSlot.w / (2.0 * uPoints);
  vec2 inside = clamp((q / reach * 0.5 + 0.5) * vSlot.w, vec2(0.5), vec2(vSlot.w - 0.5));
  return vec3((vSlot.yz + inside) / uAtlas, vSlot.x);
}
/** Vento: inclina para o lado do vento e oscila; a rajada atravessa o mapa (a conta do teste). */
vec2 swayAt(vec2 pos, float seed) {
  float ph = seed * 0.37 - dot(pos, uWindDir) * 0.35;
  float g = sin(uTime * 1.1 + ph) * 0.6 + sin(uTime * 2.3 + ph * 1.7) * 0.3 + sin(uTime * 4.1 + ph * 2.9) * 0.1;
  return uWindDir * uWind * (0.45 + 0.55 * g);
}

vec3 albedo(int mat, int kind, float tone, vec2 q, vec2 world, float seed, vec3 n, float edge) {
  if (mat == ${PROP_MATERIALS.leaves}) {
    vec3 w = art(uLeaves, world * 0.22, 0.22);
    vec3 tint = mix(vec3(0.72, 0.92, 0.58), vec3(1.05, 1.0, 0.66), hash12(vec2(seed, 1.0)));
    float leaves = vnoise(q * 46.0 + seed) * 0.6 + vnoise(q * 95.0 - seed) * 0.4;
    vec3 c = w * tint * (0.78 + 0.36 * tone) * (0.8 + 0.4 * leaves);
    // a beira de cada bola escurece; a bola inteira clareia de leve quando o vento vira a folha
    c *= mix(0.55, 1.0, smoothstep(0.0, 0.07, edge));
    float flick = hash12(vec2(tone * 97.0 + seed, floor(uTime * 2.0 + tone * 31.0)));
    return c * (1.0 + (uWind > 0.0 && flick > 0.93 ? 0.16 : 0.0));
  }
  if (mat == ${PROP_MATERIALS.needles}) {
    float r = length(q);
    vec2 dir = r > 0.0 ? q / r : vec2(1.0, 0.0);
    float needles = vnoise(dir * 40.0 + vec2(r * 3.0, seed));
    float fine = vnoise(dir * 110.0 + vec2(r * 10.0, seed * 2.0));
    vec3 w = art(uLeaves, world * 0.3, 0.3);
    vec3 c = w * vec3(0.46, 0.7, 0.62) * (0.7 + 0.45 * (needles * 0.6 + fine * 0.4)) * (0.82 + 0.3 * tone);
    // pontas dos galhos mais claras, o fundo de cada andar mais escuro
    return c * mix(0.62, 1.18, clamp(1.0 - edge / 0.22, 0.0, 1.0));
  }
  if (mat == ${PROP_MATERIALS.stone}) {
    vec3 w = art(uStone, world * 0.35, 0.35);
    vec3 c = w * vec3(0.8, 0.77, 0.72) * (0.84 + 0.24 * tone) * (0.85 + 0.3 * fbm(q * 9.0 + seed));
    float moss = smoothstep(0.55, 0.7, fbm(q * 4.0 + seed)) * smoothstep(0.75, 0.95, n.z);
    return mix(c, art(uLeaves, world * 0.5, 0.5) * vec3(0.75, 0.9, 0.55), moss * 0.85);
  }
  if (mat == ${PROP_MATERIALS.wood} || mat == ${PROP_MATERIALS.darkWood}) {
    // o veio corre ao longo da tábua: barril (tampa em y, aduelas para fora) e carroça (em x)
    float r = length(q);
    vec2 grainUv = kind == ${KIND_INDEX("barrel")} ? (r < 0.285 ? vec2(q.y, q.x) : vec2(r * 3.0, atan(q.y, q.x) * 2.0)) : vec2(q.y, q.x);
    float grain = vnoise(vec2(grainUv.x * 3.0, grainUv.y * 70.0)) * 0.6 + vnoise(vec2(grainUv.x * 9.0, grainUv.y * 180.0)) * 0.4;
    vec3 base = mat == ${PROP_MATERIALS.wood} ? vec3(0.52, 0.36, 0.21) : vec3(0.36, 0.25, 0.15);
    vec3 w = art(uDirt, world * 0.6, 0.6);
    return base * (0.75 + 0.35 * tone) * (0.78 + 0.32 * grain) * (0.7 + 0.5 * w);
  }
  if (mat == ${PROP_MATERIALS.iron}) return vec3(0.24, 0.24, 0.26) * (0.85 + 0.3 * vnoise(q * 40.0));
  float weave = abs(sin(q.x * 240.0)) * 0.5 + abs(sin(q.y * 240.0)) * 0.5;
  return vec3(0.66, 0.55, 0.38) * (0.82 + 0.18 * weave) * (0.88 + 0.2 * tone);
}

void main() {
  int kind = int(vKind.x + 0.5);
  float seed = mod(vKind.y, 997.0) + 0.5;
  vec2 q = vLocal;
  // vento só nas plantas: a copa inclina inteira; no pinheiro, o meio (a ponta) anda mais que as pontas dos galhos
  float c = cos(vPlace.w), s = sin(vPlace.w);
  vec2 sway = vKind.w > 0.5 ? vec2(0.0) : mat2(c, -s, s, c) * swayAt(vPlace.xy, seed) / vPlace.z;
  if (kind == ${KIND_INDEX("tree")}) q -= sway * 0.07;
  else if (kind == ${KIND_INDEX("bush")}) q -= sway * 0.04;
  else if (kind == ${KIND_INDEX("pine")}) q -= sway * 0.1 * clamp(1.0 - length(q) / 1.2, 0.0, 1.0);
  vec3 at = atlasAt(q);
  vec4 shape = textureLod(uShape, at, 0.0);
  float perLocal = devicePerCell() * vPlace.z;
  float sd = (shape.r - 0.5) / 2.0;
  float px = sd * perLocal;
  if (px < -1.0) discard;
  float edge = shape.b / 4.0;
  float packed = floor(shape.a * 255.0 + 0.5);
  int mat = int(floor(packed / 32.0));
  float tone = mod(packed, 32.0) / 31.0;
  vec2 slope = textureLod(uSlope, at, 0.0).rg * 2.0 - 1.0;
  vec3 n = vec3(mat2(c, s, -s, c) * slope, sqrt(max(0.0, 1.0 - dot(slope, slope))));
  vec3 color = albedo(mat, kind, tone, q, vWorld, seed, n, edge);
  // contorno: borda de fora e a da parte de cima, com largura fixa em pixels do aparelho
  float inkWidth = 1.15 * (uCanvas.x / uScreen.x);
  float outer = 1.0 - smoothstep(inkWidth * 0.55, inkWidth * 1.25, px);
  float inner = shape.b < 0.999 ? (1.0 - smoothstep(inkWidth * 0.4, inkWidth * 1.1, edge * perLocal)) * 0.55 : 0.0;
  color = mix(color, color * 0.18 + INK, max(outer, inner));
  color *= relativeShade(n);
  float alpha = clamp(px + 0.5, 0.0, 1.0) * (vKind.w > 0.5 ? 0.45 : 1.0);
  outColor = vec4(color * alpha, alpha);
}
`;
