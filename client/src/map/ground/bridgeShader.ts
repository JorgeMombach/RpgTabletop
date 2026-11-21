import { BRIDGE_KINDS, BRIDGE_WATER_LIFT, type BridgeKind } from "@rpg/shared";
import { NO_UNROLL } from "./glKit";
import { RELIEF_SAMPLE, SCREEN } from "./reliefShader";

/**
 * Pontes na placa de vídeo (docs/design/pontes.md; visual aprovado em docs/design/pontes-teste.html). Um programa por
 * tipo; cada um desenha, das pontes do seu tipo:
 * - no chão em volta: o caminho gasto nas pontas, o contato (escurecido rente a onde a ponte pousa) e a sombra, que
 *   o sol desloca na medida da altura do tabuleiro sobre o chão (em níveis do relevo, como a sombra do penhasco);
 * - o tabuleiro, com as cabeceiras e a beirada (face clara do lado do sol, escura do outro).
 * A altura é a da regra de bridgeDeckHeight (shared/src/bridge.ts): rampa entre os níveis das pontas menos o chão,
 * nunca negativa, mais a folga sobre a água. Cor pré-multiplicada; a luz absoluta vem do mapa de luz por cima.
 */

/** Pontes que o shader conhece (o limite da cena). */
export const MAX_BRIDGES = 64;

const lift = (kind: BridgeKind) => BRIDGE_WATER_LIFT[kind].toFixed(3);

const COMMON = `#version 300 es
precision highp float;
${NO_UNROLL}
out vec4 outColor;
const int KIND = KIND_INDEX;  // o tipo deste programa (as funções abaixo só desenham as pontes dele)
uniform vec4 uBridgeEnds[${MAX_BRIDGES}];  // ponta de saída (xy) e de chegada (zw), em casas
uniform vec4 uBridgeInfo[${MAX_BRIDGES}];  // largura, nível na saída, nível na chegada, tipo
uniform int uBridgeCount;
uniform sampler2D uWaterA, uWaterB;        // pesos da água (canal a) e da água funda (canal r)
uniform vec2 uWeightsOrigin, uWeightsSize;
uniform float uHasWater, uHasRelief;
uniform vec2 uSunShift;                    // para onde cai a sombra de um nível de altura (casas); 0 sem sol
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
vec3 voronoi(vec2 p) { vec2 i = floor(p), f = fract(p); float d1 = 9.0, d2 = 9.0; vec2 id = vec2(0);
  for (int y = -1; y <= 1 + uNoUnroll; y++) for (int x = -1; x <= 1 + uNoUnroll; x++) { vec2 o = vec2(x, y); vec2 r = o + 0.12 + 0.76 * vec2(hash(i + o), hash(i + o + 17.0)) - f; float d = dot(r, r);
    if (d < d1) { d2 = d1; d1 = d; id = i + o; } else if (d < d2) d2 = d; }
  return vec3(id.x + id.y * 57.0, sqrt(d1), sqrt(d2) - sqrt(d1)); }
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

// ---------- o que está embaixo ----------
float groundLevel(vec2 c) {
  if (uHasRelief < 0.5) return 0.0;
  vec2 texel;
  return reliefTexel(c, texel) ? reliefHeight(texel) : 0.0;
}
/** 1 sobre a água pintada, 0 em terra (a mesma metade que a água usa). */
float waterAt(vec2 c) {
  if (uHasWater < 0.5) return 0.0;
  vec2 uv = (c * 4.0 - uWeightsOrigin + 0.5) / uWeightsSize;
  // textureLod (sem derivada da tela): lida dentro do laço das pontes, "texture" faria o Direct3D desenrolá-lo inteiro
  return smoothstep(0.35, 0.65, textureLod(uWaterA, uv, 0.0).a + textureLod(uWaterB, uv, 0.0).r);
}
float waterLift(int kind) { return kind == 0 ? ${lift("plank")} : kind == 1 ? ${lift("stone")} : ${lift("rope")}; }

// ---------- a ponte k ----------
/** u ao longo (0..L), v através, L o comprimento. */
vec3 bridgeLocal(int k, vec2 c) {
  vec2 a = uBridgeEnds[k].xy, b = uBridgeEnds[k].zw;
  vec2 dir = normalize(b - a);
  return vec3(dot(c - a, dir), dot(c - a, vec2(-dir.y, dir.x)), length(b - a));
}
/** A barriga da corda: no meio do vão a ponte afina um pouco e desce. */
float sag(int kind, vec3 l) { return kind == 2 ? sin(3.14159 * clamp(l.x / max(l.z, 0.001), 0.0, 1.0)) : 0.0; }
float halfWidth(int k, vec3 l) { return uBridgeInfo[k].x * 0.5 * (1.0 - 0.12 * sag(KIND, l)); }
bool onDeck(int k, vec3 l) { return l.x > 0.0 && l.x < l.z && abs(l.y) < halfWidth(k, l); }
/** Nível da rampa entre as pontas. */
float rampLevel(int k, vec3 l) { return mix(uBridgeInfo[k].y, uBridgeInfo[k].z, clamp(l.x / max(l.z, 0.001), 0.0, 1.0)); }

// ---------- madeira e pedra ----------
vec3 wood(vec2 q, float plankId, float base) {
  vec3 w = mix(vec3(0.42, 0.28, 0.16), vec3(0.55, 0.38, 0.22), hash(vec2(plankId, base)));
  w *= 0.85 + 0.25 * mix(0.5, fbm(vec2(q.x * 1.5 + plankId, q.y * 14.0)), detail(14.0));
  w *= 0.92 + 0.12 * sin(q.y * 70.0 + fbm(q * 2.0 + plankId) * 8.0) * detail(12.0);
  return w;
}
/** Tábuas atravessadas (across) ou ao longo; gapRatio = folga entre elas; a = 0 na folga. */
vec4 planks(vec3 l, float halfW, bool across, float gapRatio, float base) {
  float coord = across ? l.x : l.y + halfW;
  float size = across ? 0.28 : 0.22;
  float id = floor(coord / size);
  float t = fract(coord / size);
  if (t > 1.0 - gapRatio) return vec4(0.0);
  float seam = min(t, 1.0 - gapRatio - t) * size;
  vec2 q = across ? vec2(l.y, l.x) : vec2(l.x, l.y);
  vec3 col = wood(q, id, base);
  float bevel = smoothstep(0.0, 0.035, seam);
  float slope = (t < 0.5 ? -1.0 : 1.0) * (1.0 - bevel) * detail(8.0);
  vec3 n = vec3(across ? 0.0 : slope, across ? slope : 0.0, 1.6);
  col *= mix(0.55, 1.0, mix(1.0, bevel, detail(8.0)));
  return vec4(col * relativeShade(n), 1.0);
}
vec3 stoneBlocks(vec2 b, vec2 c) {
  vec2 cell = fract(b);
  float joint = min(min(cell.x, 1.0 - cell.x) * 0.55, min(cell.y, 1.0 - cell.y) * 0.15);
  vec3 stone = mix(vec3(0.55, 0.52, 0.47), vec3(0.66, 0.63, 0.57), hash(floor(b) + 3.0)) * (0.9 + 0.15 * fbm(c * 8.0));
  return stone * mix(0.6, 1.0, mix(1.0, smoothstep(0.0, 0.025, joint), detail(6.0)));
}
vec3 cobbles(vec3 l, vec2 c) {
  vec3 v = voronoi(l.xy * 3.2);
  vec3 cob = mix(vec3(0.46, 0.43, 0.39), vec3(0.58, 0.55, 0.5), hash(vec2(v.x, 1.0))) * (0.9 + 0.12 * fbm(c * 10.0));
  float gap = mix(1.0, smoothstep(0.02, 0.09, v.z), detail(4.0));
  vec3 n = vec3((noise(c * 9.0) - 0.5) * 0.4, (noise(c * 9.0 + 4.0) - 0.5) * 0.4, 1.0);
  return mix(vec3(0.25, 0.23, 0.2), cob, gap) * relativeShade(n);
}

/** O tabuleiro da ponte k no ponto (a = 0: folga, vê-se o que está embaixo). */
vec4 deck(int k, vec3 l, vec2 c) {
  int kind = KIND;
  float halfW = halfWidth(k, l);
  float edge = halfW - abs(l.y);
  if (kind == 0) {
    // vigas laterais e corrimão com postes
    if (edge < 0.16) {
      bool post = fract((l.x + 0.25) / 1.25) < 0.14;
      vec3 beam = wood(vec2(l.x, l.y * 3.0), 99.0, 3.0) * 0.85 * (post ? 1.15 : 1.0);
      vec3 n = vec3(0.0, sign(l.y) * (edge < 0.08 ? 0.8 : -0.5), 1.0);
      return vec4(beam * relativeShade(n) * (post ? 1.0 : 0.62) + (post ? 0.03 : 0.0), 1.0);
    }
    return planks(l, halfW, true, 0.08, float(k));
  }
  if (kind == 1) {
    // muretas de blocos e calçamento
    if (edge < 0.3) {
      vec2 b = vec2(l.x / 0.55 + fract(floor(edge / 0.15) * 0.5), edge / 0.15);
      vec3 n = vec3(0.0, sign(l.y) * (edge < 0.15 ? 0.9 : -0.4), 1.0);
      return vec4(stoneBlocks(b, c) * relativeShade(n) * 1.08, 1.0);
    }
    return vec4(cobbles(l, c), 1.0);
  }
  // corda: duas cordas trançadas e tábuas velhas amarradas com folga
  float ropeAt = halfW - 0.06;
  if (abs(abs(l.y) - ropeAt) < 0.055) {
    float twist = 0.75 + 0.25 * sin(l.x * 40.0 + l.y * 12.0) * detail(10.0);
    float knot = smoothstep(0.08, 0.0, abs(fract(l.x / 0.3) - 0.3));
    return vec4(vec3(0.62, 0.52, 0.34) * twist * (1.0 + knot * 0.2) * relativeShade(vec3(0.0, sign(l.y) * 0.3, 1.0)), 1.0);
  }
  if (abs(l.y) > ropeAt) return vec4(0.0);
  vec4 plank = planks(l, halfW, true, 0.38, float(k));
  float ragged = (hash(vec2(floor(l.x / 0.3), 7.0)) - 0.5) * 0.12;
  if (plank.a == 0.0 || abs(l.y) > ropeAt - 0.02 + ragged) return vec4(0.0);
  return vec4(plank.rgb * 0.9, 1.0);
}

/** Cabeceiras na margem, fora das pontas (a = 0: nada; a < 1: o calçamento que some na terra). */
vec4 ends(int k, vec3 l, vec2 c) {
  int kind = KIND;
  float halfW = uBridgeInfo[k].x * 0.5;
  float endU = l.x < l.z * 0.5 ? l.x : l.z - l.x;
  bool atStart = l.x < l.z * 0.5;
  if (kind == 0) {
    // travessa grossa assentada no chão
    if (endU > -0.2 && endU < 0.1 && abs(l.y) < halfW + 0.16) {
      vec3 n = vec3(0.0, 0.0, 1.0);
      return vec4(wood(vec2(l.y * 0.7, endU * 4.0), 77.0, float(k)) * 0.8 * relativeShade(n), 1.0);
    }
  } else if (kind == 1) {
    // muretas abrindo para dentro da margem; calçamento que vira terra batida
    float out_ = -endU;
    if (out_ > -0.05 && out_ < 0.85) {
      float inner = halfW - 0.3 + max(0.0, out_) * 0.75;
      float a = abs(l.y);
      if (a > inner && a < inner + 0.3) {
        vec2 b = vec2((out_ + 1.0) / 0.42 + fract(floor((a - inner) / 0.15) * 0.5), (a - inner) / 0.15);
        return vec4(stoneBlocks(b, c) * mix(1.0, 0.82, smoothstep(0.5, 0.85, out_)) * 1.06, 1.0);
      }
      if (a <= inner && out_ > 0.0) {
        float keep = 1.0 - smoothstep(0.15, 0.85, out_ + (fbm(c * 3.0) - 0.5) * 0.5);
        if (keep > 0.02) return vec4(cobbles(l, c) * keep, keep);
      }
    }
  } else {
    // postes de amarração e a corda até o tabuleiro
    for (int s = -1; s <= 1; s += 2) {
      vec2 post = vec2(atStart ? -0.18 : l.z + 0.18, float(s) * (halfW + 0.04));
      float d = length(l.xy - post);
      if (d < 0.14) {
        vec3 top = mix(vec3(0.4, 0.28, 0.17), vec3(0.58, 0.43, 0.28), fract(d * 38.0)) * (0.85 + 0.2 * noise(c * 30.0));
        return vec4(top * relativeShade(vec3((l.xy - post) * 4.0, 1.0)), 1.0);
      }
      vec2 from = post, to = vec2(atStart ? 0.05 : l.z - 0.05, float(s) * (halfW - 0.06));
      vec2 pa = l.xy - from, ba = to - from;
      float h = clamp(dot(pa, ba) / dot(ba, ba), 0.0, 1.0);
      if (length(pa - ba * h) < 0.045) return vec4(vec3(0.62, 0.52, 0.34) * (0.8 + 0.2 * sin(h * 60.0)), 1.0);
    }
  }
  return vec4(0.0);
}
`;

/** Programa das pontes de um tipo. */
export function bridgeFragment(kind: BridgeKind): string {
  const index = BRIDGE_KINDS.indexOf(kind);
  return `${COMMON.replace("KIND_INDEX", String(index))}
void main() {
  vec2 c = screenCell();
  vec3 color = vec3(0.0);
  float alpha = 0.0;
  float shade = 0.0, contact = 0.0;
  float water = waterAt(c);
  float ground = groundLevel(c);
  for (int k = 0; k < ${MAX_BRIDGES} + uNoUnroll; k++) {
    if (k >= uBridgeCount) break;
    if (int(uBridgeInfo[k].w) != KIND) continue;
    vec3 l = bridgeLocal(k, c);
    float halfW = uBridgeInfo[k].x * 0.5;
    // caminho gasto chegando nas pontas (em terra)
    float approach = max(-l.x, l.x - l.z);
    if (approach > 0.0 && approach < 1.4 && abs(l.y) < halfW * 0.95 && water < 0.5) {
      float wear = (1.0 - smoothstep(0.2, 1.4, approach)) * smoothstep(halfW * 0.95, halfW * 0.5, abs(l.y)) * (0.6 + 0.5 * fbm(c * 4.0));
      vec3 path = KIND == 1 ? mix(vec3(0.5, 0.47, 0.42), vec3(0.42, 0.36, 0.28), smoothstep(0.1, 0.9, approach)) : vec3(0.42, 0.33, 0.22);
      float a = clamp(wear, 0.0, 0.85);
      color = color * (1.0 - a) + path * (0.9 + 0.2 * noise(c * 14.0)) * a;
      alpha = alpha + a * (1.0 - alpha);
    }
    // sombra: o ponto do tabuleiro que tapa o sol está a uma altura que depende do vão embaixo dele (duas voltas)
    if (dot(uSunShift, uSunShift) > 0.0) {
      float h = 0.0;
      for (int it = 0; it < 2 + uNoUnroll; it++) {
        vec2 q = c - uSunShift * h;
        vec3 lq = bridgeLocal(k, q);
        h = max(0.0, rampLevel(k, lq) - ground) + waterAt(q) * waterLift(KIND) + (KIND == 2 ? 0.6 * sag(KIND, lq) * step(0.3, h) : 0.0);
      }
      vec2 q = c - uSunShift * h;
      vec3 lq = bridgeLocal(k, q);
      if (h > 0.02 && onDeck(k, lq)) {
        // a corda deixa passar luz entre as tábuas
        float cover = KIND == 2 ? (fract(lq.x / 0.28) < 0.62 ? 0.85 : 0.0) : 1.0;
        shade = max(shade, cover);
      }
    }
    // contato: onde a ponte pousa (terra firme), o chão escurece rente às bordas
    float outside = max(abs(l.y) - halfW, max(-l.x, l.x - l.z));
    if (outside > 0.0 && outside < 0.28) contact = max(contact, pow(1.0 - outside / 0.28, 2.0) * mix(1.0, 0.25, water));
  }
  // escurecido (sombra e contato) por cima do que já há
  float dark = clamp(0.45 * shade + 0.38 * contact * (1.0 - shade), 0.0, 0.8);
  color *= 1.0 - dark;
  alpha = alpha + dark * (1.0 - alpha);
  // cabeceiras e tabuleiro (o de cima, o último da lista)
  for (int k = 0; k < ${MAX_BRIDGES} + uNoUnroll; k++) {
    if (k >= uBridgeCount) break;
    if (int(uBridgeInfo[k].w) != KIND) continue;
    vec3 l = bridgeLocal(k, c);
    if (onDeck(k, l)) {
      vec4 top = deck(k, l, c);
      if (top.a > 0.0) {
        // beirada: a espessura onde há vão embaixo
        vec2 dir = normalize(uBridgeEnds[k].zw - uBridgeEnds[k].xy);
        vec2 side = vec2(-dir.y, dir.x) * sign(l.y);
        float rim = 1.0 - smoothstep(0.0, 0.07, halfWidth(k, l) - abs(l.y));
        float gap = clamp(max(0.0, rampLevel(k, l) - ground) + water, 0.0, 1.0);
        float lit = relativeShade(vec3(side * 1.6, 0.6));
        color = top.rgb * mix(1.0, clamp(lit, 0.45, 1.35), rim * mix(0.35, 1.0, gap));
        alpha = 1.0;
      }
    } else {
      vec4 end = ends(k, l, c);
      if (end.a > 0.0) {
        color = color * (1.0 - end.a) + end.rgb;
        alpha = alpha + end.a * (1.0 - alpha);
      }
    }
  }
  if (alpha <= 0.001) discard;
  outColor = vec4(color, alpha);
}`;
}
