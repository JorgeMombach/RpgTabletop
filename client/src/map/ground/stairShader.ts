import { STAIR_SHAPES, type StairShape } from "@rpg/shared";
import { NO_UNROLL } from "./glKit";
import { RELIEF_SAMPLE, SCREEN } from "./reliefShader";

/**
 * Escadas na placa de vídeo (docs/design/escadas.md; visual aprovado em docs/design/escadas-teste.html). Um programa
 * por formato; cada um desenha, das escadas do seu formato (o resto da linha da textura de dados é ignorado):
 * - no chão em volta: a sombra das partes acima do chão (o sol desloca na medida da altura, como a das pontes) e o
 *   contato rente a onde a escada pousa;
 * - a lateral construída (onde a rampa fica acima do chão) e a moldura do alçapão (solta descendo);
 * - a escada: parede cavada (onde o chão do lado é mais alto que a rampa), mureta ou corrimão, patamar e degraus.
 * Cor pré-multiplicada; a luz absoluta e a sombra do relevo vêm do mapa de luz por cima.
 *
 * Textura de dados (RGBA32F, uma linha por escada, na ordem da cena), lida com texelFetch:
 * - texel 0: largura, material (0 pedra, 1 madeira), modo (0 relevo, 1 solta subindo, 2 solta descendo), comprimento;
 * - texel 1: formato (índice de STAIR_SHAPES), nº de trechos, nº de lances, nível do chão no pé;
 * - texel 2: caixa (x e y mínimos e máximos, com a largura) em casas;
 * - caminho: os trechos a partir do texel 3 (2 texels cada) e os lances a partir de `STAIR_SEGMENTS_AT` (2 cada):
 *   reto (a.xy, b.xy | u inicial, 0); arco (centro.xy, raio, ângulo inicial | u inicial, 1, -, giro);
 *   lance (u0, u1, nível no começo, nível no fim | degraus, 0 = patamar);
 * - caracol e de mão: texel 3 com os dois pontos (xy e zw).
 */

/** Escadas que o shader conhece (o limite da cena). */
export const MAX_STAIRS = 64;
/** Trechos de um caminho (16 pontos: 15 retas e 14 arcos) e lances do perfil. */
export const MAX_STAIR_PRIMS = 29;
export const MAX_STAIR_SEGMENTS = 64;
export const STAIR_PRIMS_AT = 3;
export const STAIR_SEGMENTS_AT = STAIR_PRIMS_AT + MAX_STAIR_PRIMS * 2;
/** Texels por linha da textura de dados. */
export const STAIR_ROW = STAIR_SEGMENTS_AT + MAX_STAIR_SEGMENTS * 2;

const COMMON = `#version 300 es
precision highp float;
${NO_UNROLL}
out vec4 outColor;
const int SHAPE = SHAPE_INDEX;   // o formato deste programa
const int MAXP = ${MAX_STAIR_PRIMS};
const int MAXG = ${MAX_STAIR_SEGMENTS};
const int PRIMS_AT = ${STAIR_PRIMS_AT};
const int SEGS_AT = ${STAIR_SEGMENTS_AT};
const float PI2 = 6.2831853;
const float STAIR_WALL = 0.6;    // casas de face por nível (lateral construída e parede cavada)
uniform highp sampler2D uStairData;
uniform int uStairCount;
uniform float uHasRelief;
uniform vec2 uSunShift;          // para onde cai a sombra de um nível de altura (casas); 0 sem sol
uniform vec3 uLightDir;
uniform float uLightAmount, uAmbientLum, uSunLum;
${SCREEN}
${RELIEF_SAMPLE}
float hash(vec2 p) {
  highp uvec2 q = floatBitsToUint(p);
  highp uint h = (q.x * 1597334677u) ^ (q.y * 3812015801u);
  h ^= h >> 16u; h *= 2246822519u; h ^= h >> 13u; h *= 3266489917u; h ^= h >> 16u;
  return float(h) * (1.0 / 4294967296.0);
}
float noise(vec2 p) { vec2 i = floor(p), f = fract(p); vec2 u = f * f * (3.0 - 2.0 * f); return mix(mix(hash(i), hash(i + vec2(1, 0)), u.x), mix(hash(i + vec2(0, 1)), hash(i + vec2(1, 1)), u.x), u.y); }
float fbm(vec2 p) { float s = 0.0, a = 0.5; for (int i = 0; i < 4 + uNoUnroll; i++) { s += a * noise(p); p *= 2.03; a *= 0.5; } return s; }
/** Casas por pixel do aparelho. */
float px() { return (uScreen.x / uCanvas.x) / (uStage.z * uMapGrid.z); }
/** Quanto de um detalhe com perCell repetições por casa ainda aparece: some (vira a média) abaixo de ~2 pixels. */
float detail(float perCell) { return 1.0 - smoothstep(0.35, 0.8, px() * perCell); }
/** Luz da face relativa ao chão plano: 1 no plano. */
float relativeShade(vec3 n) {
  float flatLit = max(uLightDir.z, 0.35);
  float flatLight = uAmbientLum + uSunLum * 0.8;
  float shade = (uAmbientLum + uSunLum * 0.8 * max(dot(normalize(n), uLightDir), 0.0) / flatLit) / max(flatLight, 0.001);
  return clamp(mix(1.0, shade, uLightAmount), 0.5, 1.5);
}

// ---------- o chão (atlas do relevo) ----------
float groundLevel(vec2 c) {
  if (uHasRelief < 0.5) return 0.0;
  vec2 texel;
  return reliefTexel(c, texel) ? reliefHeight(texel) : 0.0;
}
/** Quanto a encosta é suave ali (0 = escarpa: rocha; 1 = morro: barranco de terra). */
float groundSoft(vec2 c) {
  if (uHasRelief < 0.5) return 0.0;
  vec2 texel;
  if (!reliefTexel(c, texel)) return 0.0;
  return textureLod(uReliefA, texel / uReliefAtlas, 0.0).a;
}

// ---------- materiais ----------
vec4 data(int s, int i) { return texelFetch(uStairData, ivec2(i, s), 0); }
vec3 stoneCol(vec2 id) { return mix(vec3(0.55, 0.52, 0.47), vec3(0.66, 0.63, 0.57), hash(id)); }
vec3 wood(vec2 q, float plankId, float base) {
  vec3 w = mix(vec3(0.42, 0.28, 0.16), vec3(0.55, 0.38, 0.22), hash(vec2(plankId, base)));
  w *= 0.85 + 0.25 * mix(0.5, fbm(vec2(q.x * 1.5 + plankId, q.y * 14.0)), detail(14.0));
  w *= 0.92 + 0.12 * sin(q.y * 70.0 + fbm(q * 2.0 + plankId) * 8.0) * detail(12.0);
  return w;
}
vec3 rockAt(vec2 c, float h) {
  float strata = fract(h * 4.0 + (fbm(c * 1.5) - 0.5) * 0.3);
  vec3 r = mix(vec3(0.46, 0.43, 0.39), vec3(0.6, 0.57, 0.51), fbm(vec2(c.x * 1.5 + c.y * 0.5, h * 12.0)));
  r *= mix(0.82, 1.08, smoothstep(0.0, 0.15, strata)) * mix(1.0, 0.86, smoothstep(0.8, 1.0, strata));
  float crack = 1.0 - smoothstep(0.0, 0.025, abs(fbm(c * 1.3 + 7.0) - 0.5)) * step(0.5, noise(c * 0.8 + 2.0));
  return r * mix(1.0, 0.75, (1.0 - crack) * detail(4.0)) * (0.92 + 0.12 * noise(c * 14.0) * detail(14.0));
}
/** Hachura do corte (o andar de cima é outra cena). */
vec3 hatch(vec2 c) { float stripe = smoothstep(0.3, 0.42, abs(fract((c.x + c.y) * 6.0) - 0.5)); return mix(vec3(0.42, 0.38, 0.32), vec3(0.17, 0.15, 0.13), mix(0.5, stripe, detail(6.0))); }
/** Junta escura entre blocos, que some de longe. */
float joint(float d, float width) { return mix(0.62, 1.0, mix(1.0, smoothstep(0.0, width, d), detail(4.0))); }
`;

const PATH = `
// ---------- escada com caminho ----------
struct Local { float u; float v; float dist; vec2 side; };
/** u ao longo (casas desde o pé), v através (com sinal), a distância e o lado, pelo trecho mais perto. */
Local stairLocal(int s, vec2 c) {
  Local best = Local(0.0, 0.0, 1e9, vec2(0.0, 1.0));
  int pc = int(data(s, 1).y);
  for (int i = 0; i < MAXP + uNoUnroll; i++) {
    if (i >= pc) break;
    vec4 A = data(s, PRIMS_AT + i * 2), B = data(s, PRIMS_AT + i * 2 + 1);
    if (B.y < 0.5) {
      vec2 a = A.xy, ab = A.zw - A.xy; float len = max(length(ab), 1e-5); vec2 dir = ab / len;
      float t = dot(c - a, dir);
      float d = length(c - (a + dir * clamp(t, 0.0, len)));
      if (d < best.dist) {
        float tu = t; if (i > 0) tu = max(tu, 0.0); if (i < pc - 1) tu = min(tu, len);
        vec2 side = vec2(-dir.y, dir.x);
        best = Local(B.x + tu, dot(c - a, side), d, side);
      }
    } else {
      vec2 rel = c - A.xy; float sg = sign(B.w), sweep = abs(B.w);
      float turned = mod((atan(rel.y, rel.x) - A.w) * sg, PI2);
      if (turned <= sweep) {
        float ang = A.w + sg * turned;
        vec2 onArc = A.xy + A.z * vec2(cos(ang), sin(ang));
        vec2 tg = sg * vec2(-sin(ang), cos(ang)); vec2 side = vec2(-tg.y, tg.x);
        float v = dot(c - onArc, side);
        if (abs(v) < best.dist) best = Local(B.x + A.z * turned, v, abs(v), side);
      }
    }
  }
  return best;
}
bool onStair(int s, Local L) { vec4 A = data(s, 0); return abs(L.v) < A.x * 0.5 && L.u >= 0.0 && L.u <= A.w; }
/** O lance (ou patamar) que contém u: u0, u1, nível no começo e no fim; degraus em n. */
vec4 segmentAt(int s, float u, out float n) {
  int gc = int(data(s, 1).z);
  vec4 seg = data(s, SEGS_AT); n = data(s, SEGS_AT + 1).x;
  for (int i = 0; i < MAXG + uNoUnroll; i++) {
    if (i >= gc) break;
    seg = data(s, SEGS_AT + i * 2); n = data(s, SEGS_AT + i * 2 + 1).x;
    if (u <= seg.y) break;
  }
  return seg;
}
// Altura (níveis) do degrau em u; f = posição dentro do degrau (0..1), tl = comprimento do degrau (0 = patamar),
// dh = quanto o lance sobe (negativo desce), k = índice do degrau.
float stairHeight(int s, float u, out float f, out float tl, out float dh, out float k) {
  float n;
  vec4 seg = segmentAt(s, u, n);
  float uc = clamp(u, seg.x, seg.y);
  f = 0.0; tl = 0.0; dh = 0.0; k = 0.0;
  if (n < 0.5) return seg.z;
  tl = (seg.y - seg.x) / n; dh = seg.w - seg.z;
  k = clamp(floor((uc - seg.x) / tl), 0.0, n - 1.0);
  f = (uc - seg.x) / tl - k;
  return dh > 0.0 ? seg.z + dh * k / n : seg.z + dh * (k + 1.0) / n;
}
/** Altura sem os degraus (a rampa do lance): para as paredes cavadas, a lateral e a sombra ficarem lisas. */
float rampAt(int s, float u) {
  float n;
  vec4 seg = segmentAt(s, u, n);
  return mix(seg.z, seg.w, clamp((u - seg.x) / max(seg.y - seg.x, 1e-4), 0.0, 1.0));
}

/** A escada no ponto (opaca). */
vec3 drawPathStair(int s, Local L, vec2 c) {
  vec4 A = data(s, 0); float w = A.x; bool isWood = A.y > 0.5; int mode = int(A.z + 0.5); float len = A.w;
  float base = data(s, 1).w;
  float f, tl, dh, k;
  float hs = stairHeight(s, L.u, f, tl, dh, k);
  float rel = hs - base;   // altura desde o pé (a escada solta clareia subindo e escurece descendo)
  float halfW = w * 0.5, edge = halfW - abs(L.v);
  vec2 sideOut = L.side * sign(L.v);
  vec2 along = vec2(L.side.y, -L.side.x);
  vec3 col; vec3 n = vec3(0, 0, 1);
  float dark = mode == 2 ? exp(-1.6 * max(-rel, 0.0)) : 1.0;
  // o chão logo fora da borda mais alto que a rampa: parede cavada dentro da borda (rocha, barranco ou alvenaria)
  vec2 outside = c + sideOut * (edge + 0.08);
  float cut = groundLevel(outside) - rampAt(s, L.u);
  float wallW = mode == 2 ? min(cut * STAIR_WALL, 0.1) : cut * STAIR_WALL;
  if (cut > 0.04 && edge < wallW) {
    float t = edge / wallW;
    if (mode == 0 && groundSoft(outside) < 0.5) col = rockAt(c, hs + t);
    else if (mode == 0) col = mix(vec3(0.33, 0.42, 0.19), vec3(0.42, 0.32, 0.21) * (0.85 + 0.25 * fbm(c * 6.0)), smoothstep(0.0, 0.25, t));
    else {
      vec2 b = vec2(L.u / 0.4 + floor(t * cut * 7.0) * 0.5, t * cut * 7.0);
      col = stoneCol(floor(b) + 11.0) * joint(min(min(fract(b.x), 1.0 - fract(b.x)) * 0.4, min(fract(b.y), 1.0 - fract(b.y)) * 0.14), 0.05);
    }
    col *= mix(1.0, 0.72, t);
    return col * relativeShade(vec3(-sideOut * 1.3, 0.6)) * dark;
  }
  // mureta (pedra) ou corrimão com postes (madeira) nas bordas
  float railW = isWood ? 0.09 : 0.13;
  if (edge < railW) {
    if (isWood) {
      bool post = fract((L.u + 0.2) / 0.9) < 0.12;
      col = wood(vec2(L.u, L.v * 3.0), 99.0, 3.0) * (post ? 1.05 : 0.85);
      n = vec3(sideOut * (edge < railW * 0.5 ? 0.7 : -0.4), 1.0);
    } else {
      float bx = L.u / 0.42;
      col = stoneCol(vec2(floor(bx), 5.0 + float(s))) * (0.92 + 0.14 * fbm(c * 8.0)) * 1.06;
      col *= joint(min(fract(bx), 1.0 - fract(bx)) * 0.42, 0.025);
      n = vec3(sideOut * (edge < railW * 0.5 ? 0.8 : -0.4), 1.0);
    }
    return col * relativeShade(n) * (1.0 + 0.1 * rel * (mode == 1 ? 1.0 : 0.0)) * dark;
  }
  if (tl <= 0.0) {
    // patamar: lajes (pedra) ou tábuas atravessadas (madeira)
    if (isWood) {
      float id = floor(L.u / 0.22);
      float t = fract(L.u / 0.22);
      col = wood(vec2(L.v, L.u), id + float(s) * 7.0, 4.0) * mix(0.7, 1.0, mix(1.0, smoothstep(0.0, 0.08, min(t, 1.0 - t)), detail(5.0)));
    } else {
      float row = floor(L.u / 0.5);
      vec2 b = vec2((L.v + hash(vec2(row, 4.0)) * 0.5) / 0.55, L.u / 0.5);
      col = stoneCol(floor(b) + float(s) * 3.0) * (0.92 + 0.12 * fbm(c * 9.0));
      col *= joint(min(min(fract(b.x), 1.0 - fract(b.x)) * 0.55, min(fract(b.y), 1.0 - fract(b.y)) * 0.5), 0.03);
    }
    n = vec3((noise(c * 9.0) - 0.5) * 0.25, (noise(c * 9.0 + 4.0) - 0.5) * 0.25, 1.0);
    return col * relativeShade(n) * dark;
  }
  // degrau: piso, espelho do lado de baixo (largura de face), nariz claro e sombra na base do espelho
  bool rising = dh > 0.0;
  float rw = min(0.4, 0.08 / tl);
  float riser = rising ? smoothstep(1.0 - rw - 0.03, 1.0 - rw, f) : 1.0 - smoothstep(rw, rw + 0.03, f);
  vec3 tread;
  if (isWood) {
    float boards = max(1.0, floor(tl / 0.24));
    float b = floor(f * boards), t = fract(f * boards);
    tread = wood(vec2(L.v, L.u), k * 3.0 + b + float(s) * 17.0, 5.0);
    tread *= mix(0.75, 1.0, mix(1.0, smoothstep(0.0, 0.02, min(t, 1.0 - t) * tl / boards), detail(8.0)));
  } else {
    float split = (hash(vec2(k, 3.0 + float(s))) - 0.5) * 0.6 * halfW;
    tread = stoneCol(vec2(k + float(s) * 31.0, L.v > split ? 1.0 : 0.0)) * (0.9 + 0.14 * fbm(c * 9.0));
    tread *= joint(abs(L.v - split), 0.03);
    tread *= 1.0 + 0.06 * (1.0 - smoothstep(0.0, halfW, abs(L.v)));   // gasto no meio
  }
  vec3 lowDir = vec3(rising ? -along : along, 0.0);
  vec3 treadLit = tread * relativeShade(vec3((noise(c * 9.0) - 0.5) * 0.2, (noise(c * 9.0 + 4.0) - 0.5) * 0.2, 1.0));
  vec3 riserLit = mix(tread * 0.9 * relativeShade(lowDir * 1.3 + vec3(0, 0, 0.6)), treadLit * 0.7, 0.35);
  col = mix(treadLit, riserLit, riser);
  float nw = min(0.25, 0.025 / tl);
  float nose = rising ? 1.0 - smoothstep(0.0, nw, f) : smoothstep(1.0 - nw, 1.0, f);
  float baseShade = rising ? smoothstep(1.0 - rw - 0.03 / tl, 1.0 - rw, f) * (1.0 - riser) : (1.0 - smoothstep(rw, rw + 0.03 / tl, f)) * (1.0 - riser);
  col *= (1.0 + 0.16 * nose) * (1.0 - 0.18 * baseShade);
  if (mode == 1) col *= 1.0 + 0.18 * rel;
  if (mode == 2) col *= dark;
  if (mode == 1 && L.u > len - 0.4) {
    // borda cortada: o andar de cima é outra cena
    float cutLine = 1.0 - smoothstep(0.02, 0.04, abs(L.u - (len - 0.4)));
    return mix(hatch(c), vec3(0.08), cutLine);
  }
  if (mode == 2 && L.u > len - 0.3) return mix(col, vec3(0.02), smoothstep(len - 0.3, len - 0.05, L.u));
  return col;
}

void main() {
  vec2 c = screenCell();
  float hg = groundLevel(c);
  float reach = 1.0 + 5.0 * length(uSunShift);
  float shade = 0.0, contact = 0.0;
  // sombra das partes acima do chão (procura o ponto que tapa o sol: três voltas) e contato rente
  for (int s = 0; s < ${MAX_STAIRS} + uNoUnroll; s++) {
    if (s >= uStairCount) break;
    if (int(data(s, 1).x) != SHAPE) continue;
    vec4 box = data(s, 2);
    if (c.x < box.x - reach || c.y < box.y - reach || c.x > box.z + reach || c.y > box.w + reach) continue;
    vec4 A = data(s, 0);
    int mode = int(A.z + 0.5);
    if (mode != 2 && dot(uSunShift, uSunShift) > 0.0) {
      float h = 0.5; bool hit = false;
      for (int it = 0; it < 3 + uNoUnroll; it++) {
        Local q = stairLocal(s, c - uSunShift * h);
        if (onStair(s, q)) { h = max(rampAt(s, q.u) - hg, 0.0); hit = true; } else { hit = false; h *= 0.5; }
      }
      if (hit && h > 0.05) shade = max(shade, 0.8);
    }
    Local L = stairLocal(s, c);
    float out_ = abs(L.v) - A.x * 0.5;
    if (out_ > 0.0 && out_ < 0.25 && L.u >= 0.0 && L.u <= A.w && abs(rampAt(s, L.u) - hg) < 0.12) contact = max(contact, pow(1.0 - out_ / 0.25, 2.0));
  }
  float dark = clamp(0.45 * shade + 0.3 * contact * (1.0 - shade), 0.0, 0.8);
  vec3 color = vec3(0.0);
  float alpha = dark;
  // lateral construída, moldura do alçapão e a escada (a de cima na lista por cima)
  for (int s = 0; s < ${MAX_STAIRS} + uNoUnroll; s++) {
    if (s >= uStairCount) break;
    if (int(data(s, 1).x) != SHAPE) continue;
    vec4 box = data(s, 2);
    if (c.x < box.x - 1.2 || c.y < box.y - 1.2 || c.x > box.z + 1.2 || c.y > box.w + 1.2) continue;
    vec4 A = data(s, 0);
    int mode = int(A.z + 0.5);
    Local L = stairLocal(s, c);
    if (onStair(s, L)) {
      color = drawPathStair(s, L, c);
      alpha = 1.0;
      continue;
    }
    float halfW = A.x * 0.5, out_ = abs(L.v) - halfW;
    if (mode == 2 && L.u > A.w && L.u < A.w + 0.12 && abs(L.v) < halfW + 0.12) {
      // moldura do fim da escada descendo (a boca do alçapão)
      color = stoneCol(vec2(floor(L.v / 0.35), 91.0)) * 0.85;
      alpha = 1.0;
      continue;
    }
    if (out_ <= 0.0 || L.u < 0.0 || L.u > A.w || out_ > 1.0) continue;
    vec2 sideOut = L.side * sign(L.v);
    if (mode == 2) {
      // alvenaria fina em volta do poço
      if (out_ < 0.12) {
        color = stoneCol(vec2(floor(L.u / 0.35), 90.0)) * 0.85 * relativeShade(vec3(sideOut * (out_ < 0.06 ? -0.4 : 0.4), 1.0));
        alpha = 1.0;
      }
      continue;
    }
    float hs = rampAt(s, L.u);
    float faceW = (hs - hg) * STAIR_WALL;
    if (faceW > 0.02 && out_ < faceW && !(mode == 1 && L.u > A.w - 0.4)) {
      float t = out_ / faceW;
      vec3 face;
      if (A.y > 0.5) {
        float b = fract(L.u / 0.18);
        face = wood(vec2(t, L.u), floor(L.u / 0.18), 6.0) * mix(0.6, 1.0, mix(1.0, smoothstep(0.0, 0.1, min(b, 1.0 - b)), detail(6.0))) * (t < 0.12 ? 0.75 : 1.0);
      } else {
        vec2 b = vec2(L.u / 0.38 + floor(t * (hs - hg) * 7.0) * 0.5, t * (hs - hg) * 7.0);
        face = stoneCol(floor(b) + 61.0) * 0.92 * joint(min(min(fract(b.x), 1.0 - fract(b.x)) * 0.38, min(fract(b.y), 1.0 - fract(b.y)) * 0.14), 0.05);
      }
      color = face * mix(1.0, 0.72, t) * relativeShade(vec3(sideOut * 1.4, 0.5)) * (1.0 - dark);
      alpha = 1.0;
    }
  }
  if (alpha <= 0.001) discard;
  outColor = vec4(color, alpha);
}`;

/** Programa das escadas de um formato (por enquanto, a escada com caminho). */
export function stairFragment(shape: StairShape): string {
  return `${COMMON.replace("SHAPE_INDEX", String(STAIR_SHAPES.indexOf(shape)))}${PATH}`;
}
