import { MAP_TORCH_STYLES, type MapTorchStyle } from "@rpg/shared";
import { NO_UNROLL } from "./glKit";

/**
 * Desenho das fontes de luz fixas (docs/design/luzes.md), gerado da página aprovada (`docs/design/luzes-teste.html`):
 * as funções de forma, chama e material são as da página, copiadas sem mudar. Um programa por modelo (`MODEL`
 * constante: o compilador fica só com o desenho dele). Duas passadas no mesmo quadrado em volta da fonte:
 * - corpo (`uGlow` 0): cor pré-multiplicada com mistura normal, luz relativa (a da cena vem do mapa de luz por cima);
 * - brilho (`uGlow` 1): chama, brasa, vidro, cristal e o halo, somados na saída das chamas.
 */

/** O que fica fora da página (o que é do app): onde está a fonte, o lado claro, a escala da tela. */
const HEADER = `#version 300 es
precision highp float;
${NO_UNROLL}
in vec2 vCell;
out vec4 outColor;
uniform vec4 uTorch;          // base (casas), tamanho do desenho (casas), direção da arandela (radianos)
uniform int uColor;           // cor da luz (MAP_TORCH_COLORS)
uniform float uSeed, uTime;
uniform float uGlow;          // 0 = corpo, 1 = brilho
uniform float uDevicePerCell; // pixels do aparelho por casa (contorno fino)
uniform float uNight;         // quanto a luz das fontes pesa (de dia pouco)
uniform vec2 uLightFrom;      // de que lado vem a luz da cena, no plano do mapa
uniform float uDpr;           // pixels do aparelho por pixel CSS (largura do contorno)
`;

const SHAPES = `const float TAU = 6.2831853;
float hash12(vec2 p) { vec3 p3 = fract(vec3(p.xyx) * 0.1031); p3 += dot(p3, p3.yzx + 33.33); return fract((p3.x + p3.y) * p3.z); }
vec2 hash22(vec2 p) { vec3 p3 = fract(vec3(p.xyx) * vec3(0.1031, 0.1030, 0.0973)); p3 += dot(p3, p3.yzx + 33.33); return fract((p3.xx + p3.yz) * p3.zy); }
float vnoise(vec2 p) {
  vec2 i = floor(p), f = fract(p), u = f * f * (3.0 - 2.0 * f);
  return mix(mix(hash12(i), hash12(i + vec2(1, 0)), u.x), mix(hash12(i + vec2(0, 1)), hash12(i + vec2(1, 1)), u.x), u.y);
}
float fbm(vec2 p) { float s = 0.0, a = 0.5; for (int i = 0; i < 4; i++) { s += a * vnoise(p); p = p * 2.03 + 17.1; a *= 0.5; } return s / 0.9375; }
float sdBox(vec2 p, vec2 b) { vec2 d = abs(p) - b; return -(length(max(d, 0.0)) + min(max(d.x, d.y), 0.0)); }
float sdSegment(vec2 p, vec2 a, vec2 b, float w) { vec2 pa = p - a, ba = b - a; float t = clamp(dot(pa, ba) / dot(ba, ba), 0.0, 1.0); return w - length(pa - ba * t); }
float sdEllipse(vec2 p, vec2 r) { return (1.0 - length(p / r)) * min(r.x, r.y); }
float roundness(float sd, float r) { return sqrt(clamp(sd / r, 0.0, 1.0)); }
float clock() { return uTime; }

// ---------- cores da luz (chama, azul, verde, roxo, branco): borda, meio e miolo da chama ----------
vec3 flameTint(int c, float t) {
  vec3 edge, mid, core;
  if (c == 0) { edge = vec3(0.86, 0.24, 0.04); mid = vec3(1.0, 0.6, 0.17); core = vec3(1.0, 0.95, 0.78); }
  else if (c == 1) { edge = vec3(0.07, 0.22, 0.9); mid = vec3(0.3, 0.64, 1.0); core = vec3(0.88, 0.97, 1.0); }
  else if (c == 2) { edge = vec3(0.04, 0.55, 0.16); mid = vec3(0.36, 1.0, 0.46); core = vec3(0.88, 1.0, 0.86); }
  else if (c == 3) { edge = vec3(0.38, 0.07, 0.76); mid = vec3(0.74, 0.4, 1.0); core = vec3(0.97, 0.89, 1.0); }
  else { edge = vec3(0.5, 0.62, 0.88); mid = vec3(0.84, 0.91, 1.0); core = vec3(1.0); }
  return t < 0.5 ? mix(edge, mid, t * 2.0) : mix(mid, core, (t - 0.5) * 2.0);
}
vec3 lightRgb(int c) { return flameTint(c, 0.62); }

// ---------- superfície das peças ----------
// sd > 0 = dentro (unidades do objeto); h = altura (no desenho em 3/4, mais alto = mais para cima na tela).
struct Hit { float sd; float h; int mat; vec2 uv; float tone; };
Hit none() { return Hit(-1e3, 0.0, 0, vec2(0.0), 0.0); }
void take(inout Hit o, float sd, float h, int mat, vec2 uv, float tone) {
  bool inside = sd > 0.0, was = o.sd > 0.0;
  if ((inside && (!was || h > o.h)) || (!inside && !was && sd > o.sd)) { o.h = h; o.mat = mat; o.uv = uv; o.tone = tone; }
  o.sd = max(o.sd, sd);
}
// materiais
const int WOOD = 0, IRON = 1, STONE = 2, BRASS = 3, WAX = 4, GLASS = 5, CRYSTAL = 6, EMBER = 7, CLOTH = 8, CLAY = 9;

Hit modelStick(vec2 q, float seed) {
  Hit o = none();
  take(o, sdEllipse(q - vec2(0.0, 0.4), vec2(0.11, 0.05)), 0.04, STONE, q * 9.0, 0.25);
  float shaft = sdSegment(q, vec2(0.0, 0.4), vec2(0.0, -0.15), 0.036 + 0.005 * sin(q.y * 37.0 + seed));
  take(o, shaft, 0.25 + (0.4 - q.y) * 1.25 + 0.08 * roundness(shaft, 0.04), WOOD, vec2(q.x * 26.0, q.y * 2.5 + seed), 0.5);
  vec2 w = q - vec2(0.0, -0.19);
  float wrap = sdEllipse(w, vec2(0.072, 0.085));
  take(o, wrap, 1.05 + 0.12 * roundness(wrap, 0.07), CLOTH, w * 15.0, fract(seed * 0.37));
  return o;
}
Hit modelIron(vec2 q, float seed) {
  Hit o = none();
  for (int i = 0; i < 3; i++) {
    float a = float(i) * 2.094 + 0.6;
    vec2 foot = vec2(0.0, 0.4) + vec2(cos(a) * 0.17, sin(a) * 0.06);
    float leg = sdSegment(q, vec2(0.0, 0.33), foot, 0.017);
    take(o, leg, 0.1 + 0.05 * roundness(leg, 0.017), IRON, q * 12.0, 0.35);
  }
  float rod = sdSegment(q, vec2(0.0, 0.35), vec2(0.0, -0.12), 0.024);
  take(o, rod, 0.2 + (0.35 - q.y) * 1.6 + 0.06 * roundness(rod, 0.024), IRON, vec2(q.x * 30.0, q.y * 4.0), 0.45);
  vec2 b = q - vec2(0.0, -0.17);
  float bowl = sdEllipse(b, vec2(0.12, 0.07));
  float bars = smoothstep(0.55, 0.9, abs(sin(atan(b.y, b.x * 1.7) * 5.0)));
  take(o, bowl, 1.0 + 0.1 * roundness(bowl, 0.06), IRON, b * 10.0, 0.4 + 0.4 * bars);
  take(o, sdEllipse(b + vec2(0.0, 0.01), vec2(0.085, 0.04)), 1.14, EMBER, b * 34.0 + seed, 0.0);
  return o;
}
Hit modelBrazier(vec2 q, float seed) {
  Hit o = none();
  for (int i = 0; i < 3; i++) {
    float x = float(i - 1) * 0.27;
    float leg = sdSegment(q, vec2(x * 0.85, 0.1), vec2(x * 1.12, 0.34 - abs(x) * 0.1), 0.03);
    take(o, leg, 0.12 + 0.05 * roundness(leg, 0.03), IRON, q * 10.0, 0.35);
  }
  float bowl = sdEllipse(q, vec2(0.41, 0.26));
  take(o, bowl, 0.48 + 0.1 * roundness(bowl, 0.08), IRON, q * 7.0, 0.45 + 0.4 * (1.0 - smoothstep(0.0, 0.045, bowl)));
  take(o, sdEllipse(q + vec2(0.0, 0.015), vec2(0.33, 0.19)) + (vnoise(q * 30.0 + seed) - 0.5) * 0.02, 0.6, EMBER, q * 26.0 + seed, 0.0);
  return o;
}
// arandela: a parede fica atrás (y negativo), o braço sai para +y
Hit modelSconce(vec2 q, float seed) {
  Hit o = none();
  float plate = sdBox(q - vec2(0.0, -0.05), vec2(0.1, 0.035));
  take(o, plate, 1.45 + 0.05 * roundness(plate, 0.03), IRON, q * 14.0, 0.4 + 0.3 * step(0.03, abs(abs(q.x) - 0.06)));
  float arm = sdSegment(q, vec2(0.0, -0.03), vec2(0.0, 0.15), 0.02);
  take(o, arm, 1.5 + 0.05 * roundness(arm, 0.02), IRON, q * 20.0, 0.5);
  vec2 c = q - vec2(0.0, 0.19);
  float cup = 0.066 - length(c);
  take(o, cup, 1.6 + 0.06 * roundness(cup, 0.06), IRON, c * 18.0, 0.55);
  float wrap = 0.046 - length(c);
  take(o, wrap, 1.72 + 0.06 * roundness(wrap, 0.045), CLOTH, c * 22.0, fract(seed * 0.71));
  return o;
}
Hit modelCampfire(vec2 q, float seed) {
  Hit o = none();
  // brasa no meio, mais baixa que as toras
  take(o, (0.21 - length(q * vec2(1.0, 1.15))) + (vnoise(q * 18.0 + seed) - 0.5) * 0.03, 0.08, EMBER, q * 20.0 + seed, 0.0);
  // pedras em volta
  for (int i = 0; i < 10; i++) {
    float fi = float(i);
    vec2 r = hash22(vec2(seed, fi * 3.7));
    float a = fi * TAU / 10.0 + r.x * 0.3;
    vec2 c = vec2(cos(a), sin(a)) * vec2(0.36, 0.3);
    vec2 d = q - c;
    float rad = 0.075 + 0.03 * r.y;
    float stone = rad - length(d * vec2(1.0, 1.25)) + (vnoise(d * 30.0 + fi) - 0.5) * 0.02;
    take(o, stone, 0.12 + 0.1 * roundness(stone, rad), STONE, d * 12.0 + fi, r.y);
  }
  // toras cruzadas, chamuscadas no meio
  for (int i = 0; i < 3; i++) {
    float fi = float(i);
    float a = 0.35 + fi * 1.05 + (hash12(vec2(seed, fi)) - 0.5) * 0.3;
    vec2 dir = vec2(cos(a), sin(a) * 0.82);
    float log = sdSegment(q, -dir * 0.26, dir * 0.26, 0.048);
    float along = dot(q, dir) / 0.26;
    take(o, log, 0.18 + fi * 0.04 + 0.07 * roundness(log, 0.048), WOOD, vec2(along * 3.0 + fi, dot(q, vec2(-dir.y, dir.x)) * 40.0), 0.35 + 0.5 * smoothstep(0.15, 0.6, abs(along)));
  }
  return o;
}
Hit modelLantern(vec2 q, float seed) {
  Hit o = none();
  float base = sdBox(q - vec2(0.0, 0.16), vec2(0.115, 0.03));
  take(o, base, 0.15 + 0.04 * roundness(base, 0.03), IRON, q * 14.0, 0.4);
  float glass = sdBox(q - vec2(0.0, -0.01), vec2(0.085, 0.145));
  take(o, glass, 0.45 + 0.05 * roundness(glass, 0.06), GLASS, q, 0.0);
  for (int i = 0; i < 2; i++) {
    float x = i == 0 ? -0.088 : 0.088;
    float post = sdBox(q - vec2(x, -0.01), vec2(0.016, 0.155));
    take(o, post, 0.6 + 0.04 * roundness(post, 0.016), IRON, q * 20.0, 0.5);
  }
  float band = sdBox(q - vec2(0.0, 0.05), vec2(0.09, 0.008));
  take(o, band, 0.58, IRON, q * 20.0, 0.45);
  float cap = sdBox(q - vec2(0.0, -0.18), vec2(0.115, 0.03));
  take(o, cap, 0.85 + 0.04 * roundness(cap, 0.03), IRON, q * 14.0, 0.5);
  float roof = sdBox(q - vec2(0.0, -0.225), vec2(0.06 - (-0.205 - q.y) * 0.5, 0.025));
  take(o, roof, 0.95, IRON, q * 14.0, 0.55);
  float handle = 0.011 - abs(length((q - vec2(0.0, -0.26)) * vec2(1.0, 1.3)) - 0.055);
  take(o, q.y < -0.255 ? handle : -1.0, 1.0, IRON, q * 20.0, 0.6);
  return o;
}
Hit modelCandles(vec2 q, float seed) {
  Hit o = none();
  float dish = sdEllipse(q - vec2(0.0, 0.15), vec2(0.3, 0.12));
  take(o, dish, 0.06 + 0.06 * roundness(dish, 0.06), BRASS, q * 9.0, 0.5 + 0.4 * (1.0 - smoothstep(0.0, 0.03, dish)));
  for (int i = 0; i < 3; i++) {
    float fi = float(i);
    float x = (fi - 1.0) * 0.14 + (hash12(vec2(seed, fi)) - 0.5) * 0.03;
    float tall = 0.14 + 0.14 * hash12(vec2(fi * 2.3, seed + 1.0));
    float bottom = 0.15 - abs(fi - 1.0) * 0.02;
    vec2 c = q - vec2(x, bottom - tall * 0.5);
    float body = sdBox(c, vec2(0.04, tall * 0.5));
    take(o, body, 0.2 + (bottom - q.y) * 2.2 + 0.05 * roundness(body, 0.04), WAX, vec2(c.x * 25.0, c.y * 8.0), fi * 0.3);
    float top = sdEllipse(q - vec2(x, bottom - tall), vec2(0.04, 0.015));
    take(o, top, 0.21 + tall * 2.2 + 0.02, WAX, q * 30.0, 0.95);
  }
  return o;
}
Hit modelCandelabra(vec2 q, float seed) {
  Hit o = none();
  float base = sdEllipse(q - vec2(0.0, 0.41), vec2(0.17, 0.06));
  take(o, base, 0.08 + 0.06 * roundness(base, 0.05), BRASS, q * 9.0, 0.5);
  float stem = sdSegment(q, vec2(0.0, 0.41), vec2(0.0, -0.18), 0.022 + 0.01 * smoothstep(0.02, 0.0, abs(q.y - 0.12)));
  take(o, stem, 0.2 + (0.41 - q.y) * 2.2 + 0.05 * roundness(stem, 0.022), BRASS, vec2(q.x * 30.0, q.y * 4.0), 0.55);
  for (int i = 0; i < 2; i++) {
    float s = i == 0 ? -1.0 : 1.0;
    float arm = sdSegment(q, vec2(0.0, -0.06), vec2(s * 0.25, -0.17), 0.015);
    take(o, arm, 1.45 + 0.03 * roundness(arm, 0.015), BRASS, q * 20.0, 0.55);
    float inner = sdSegment(q, vec2(0.0, -0.1), vec2(s * 0.125, -0.18), 0.013);
    take(o, inner, 1.5 + 0.03 * roundness(inner, 0.013), BRASS, q * 20.0, 0.55);
  }
  for (int i = 0; i < 5; i++) {
    float x = (float(i) - 2.0) * 0.125;
    float y = -0.18 - (i == 2 ? 0.05 : 0.0);
    vec2 c = q - vec2(x, y);
    float cup = sdEllipse(c, vec2(0.036, 0.018));
    take(o, cup, 1.6 + 0.03 * roundness(cup, 0.015), BRASS, c * 30.0, 0.7);
    float candle = sdBox(c - vec2(0.0, -0.05), vec2(0.018, 0.045));
    take(o, candle, 1.65 + (-c.y) * 2.0 + 0.03 * roundness(candle, 0.018), WAX, vec2(c.x * 40.0, c.y * 10.0), 0.4);
  }
  return o;
}
Hit modelOilLamp(vec2 q, float seed) {
  Hit o = none();
  float handle = 0.016 - abs(length((q - vec2(-0.22, 0.02)) * vec2(1.0, 1.2)) - 0.05);
  take(o, q.x < -0.2 ? handle : -1.0, 0.25 + 0.05 * roundness(handle, 0.016), CLAY, q * 12.0, 0.4);
  float body = sdEllipse(q - vec2(-0.03, 0.02), vec2(0.19, 0.11));
  take(o, body, 0.2 + 0.18 * roundness(body, 0.1), CLAY, q * 8.0, 0.55);
  float spout = sdSegment(q, vec2(0.08, 0.01), vec2(0.23, -0.02), 0.045 - (q.x - 0.08) * 0.08);
  take(o, spout, 0.28 + 0.06 * roundness(spout, 0.04), CLAY, q * 8.0, 0.6);
  float hole = sdEllipse(q - vec2(-0.03, 0.0), vec2(0.04, 0.025));
  take(o, hole, 0.39, CLAY, q * 8.0, 0.05);
  return o;
}
Hit modelOrb(vec2 q, float seed) {
  Hit o = none();
  float base = sdBox(q - vec2(0.0, 0.33), vec2(0.14, 0.04));
  take(o, base, 0.1 + 0.05 * roundness(base, 0.04), STONE, q * 10.0, 0.45);
  float column = sdBox(q - vec2(0.0, 0.16), vec2(0.065 - (0.3 - q.y) * 0.03, 0.15));
  take(o, column, 0.3 + (0.31 - q.y) * 1.6 + 0.08 * roundness(column, 0.06), STONE, vec2(q.x * 12.0, q.y * 3.0), 0.55);
  float cradle = sdEllipse(q - vec2(0.0, 0.01), vec2(0.13, 0.045));
  take(o, cradle, 0.85 + 0.05 * roundness(cradle, 0.04), BRASS, q * 14.0, 0.6);
  float orb = 0.15 - length(q - vec2(0.0, -0.12));
  take(o, orb, 1.0 + 0.2 * roundness(orb, 0.15), CRYSTAL, q - vec2(0.0, -0.12), 0.0);
  return o;
}

Hit modelAt(int kind, vec2 q, float seed) {
  if (kind == 0) return modelStick(q, seed);
  if (kind == 1) return modelIron(q, seed);
  if (kind == 2) return modelBrazier(q, seed);
  if (kind == 3) return modelSconce(q, seed);
  if (kind == 4) return modelCampfire(q, seed);
  if (kind == 5) return modelLantern(q, seed);
  if (kind == 6) return modelCandles(q, seed);
  if (kind == 7) return modelCandelabra(q, seed);
  if (kind == 8) return modelOilLamp(q, seed);
  return modelOrb(q, seed);
}

// Chamas de cada modelo (base da chama, unidades do objeto): x, y, tamanho, tremor. Até 5.
int flameCount(int kind) { return kind == 2 ? 3 : kind == 4 ? 4 : kind == 6 ? 3 : kind == 7 ? 5 : kind == 9 ? 0 : 1; }
vec4 flameOf(int kind, int i, float seed) {
  if (kind == 0) return vec4(0.0, -0.22, 0.34, 1.0);
  if (kind == 1) return vec4(0.0, -0.2, 0.34, 1.0);
  if (kind == 2) return i == 0 ? vec4(-0.14, -0.02, 0.26, 1.0) : i == 1 ? vec4(0.12, 0.01, 0.24, 1.0) : vec4(0.0, -0.07, 0.32, 1.0);
  if (kind == 3) return vec4(0.0, 0.17, 0.32, 1.0);
  if (kind == 4) return i == 0 ? vec4(0.0, 0.02, 0.5, 1.3) : i == 1 ? vec4(-0.11, 0.06, 0.34, 1.2) : i == 2 ? vec4(0.11, 0.05, 0.36, 1.2) : vec4(0.03, -0.05, 0.3, 1.1);
  if (kind == 5) return vec4(0.0, 0.05, 0.13, 0.4);
  if (kind == 6) {
    float fi = float(i);
    float x = (fi - 1.0) * 0.14 + (hash12(vec2(seed, fi)) - 0.5) * 0.03;
    float tall = 0.14 + 0.14 * hash12(vec2(fi * 2.3, seed + 1.0));
    float bottom = 0.15 - abs(fi - 1.0) * 0.02;
    return vec4(x, bottom - tall - 0.01, 0.13, 0.6);
  }
  if (kind == 7) { float x = (float(i) - 2.0) * 0.125; return vec4(x, -0.18 - (i == 2 ? 0.05 : 0.0) - 0.095, 0.12, 0.6); }
  return vec4(0.25, -0.03, 0.28, 0.8);
}
// De onde sai a luz (unidades do objeto) e a altura dela (casas): mesma tabela do design.
vec3 lightOf(int kind) {
  if (kind == 9) return vec3(0.0, -0.12, 1.0);
  vec4 f = flameOf(kind, 0, 0.0);
  float h = kind == 0 ? 1.2 : kind == 1 ? 1.6 : kind == 2 ? 0.6 : kind == 3 ? 1.8 : kind == 4 ? 0.4 : kind == 5 ? 1.0 : kind == 6 ? 0.8 : kind == 7 ? 1.7 : 0.7;
  return vec3(f.x, kind == 6 || kind == 7 ? 0.0 : f.y, h);
}
// tremor: 0 chama, 1 pouco (lanterna, lamparina), 2 pulso (orbe)
float flickerOf(int kind, float seed) {
  float t = clock();
  if (kind == 9) return 0.82 + 0.18 * sin(t * 1.7 + seed);
  if (kind == 5 || kind == 8) return 0.95 + 0.05 * vnoise(vec2(t * 5.0, seed));
  float strong = kind == 4 ? 0.2 : kind == 6 || kind == 7 ? 0.1 : 0.15;
  return 1.0 - strong + strong * (vnoise(vec2(t * 7.0, seed)) * 0.7 + vnoise(vec2(t * 17.0, seed * 1.3)) * 0.3);
}

// Base local → mundo (a arandela gira; os outros, não).
vec2 toWorld(vec4 A, int kind, vec2 local) {
  if (kind != 3) return A.xy + local * A.z;
  vec2 out_ = vec2(cos(A.w), sin(A.w)), side = vec2(-out_.y, out_.x);
  return A.xy + (local.x * side + local.y * out_) * A.z;
}
vec2 toLocal(vec4 A, int kind, vec2 p) {
  vec2 d = (p - A.xy) / A.z;
  if (kind != 3) return d;
  vec2 out_ = vec2(cos(A.w), sin(A.w)), side = vec2(-out_.y, out_.x);
  return vec2(dot(d, side), dot(d, out_));
}

// Chama vista de cima em 3/4: gota que sobe na tela, com línguas e balanço. Devolve (corpo, miolo).
vec2 flameShape(vec2 d, float size, float seed, float wobble) {
  float t = clock();
  vec2 u = d / size;
  float y = -u.y;                       // 0 na base, 1 na ponta
  u.x -= (vnoise(vec2(seed * 3.1, t * 2.6)) - 0.5) * 0.4 * wobble * max(y, 0.0) * max(y, 0.0);
  float tip = 1.0 + 0.14 * wobble * (vnoise(vec2(t * 8.0, seed * 7.0)) - 0.5);
  float width = 0.3 * pow(clamp(1.0 - y / tip, 0.0, 1.0), 0.75) * smoothstep(-0.32, 0.12, y);
  float body = y < 0.08 ? 0.25 - length(vec2(u.x, (y - 0.08) * 1.25)) : width - abs(u.x);
  body += (vnoise(vec2(u.x * 7.0 + seed, y * 5.0 - t * 7.0)) - 0.5) * 0.1 * clamp(y, 0.0, 1.0) * wobble;
  // acima da ponta não há chama (sem isso o tremor da borda acendia pontinhos soltos numa coluna acima dela)
  body = min(body, (tip - y) * 0.6);
  float inside = smoothstep(0.0, 0.05, body);
  float core = smoothstep(0.03, 0.17, body) * (1.0 - smoothstep(0.35, 0.85, y));
  return vec2(inside, core);
}

`;

const SURFACE = `vec3 albedo(Hit o, int color, float seed) {
  if (o.mat == WOOD) {
    float grain = vnoise(vec2(o.uv.x * 0.6, o.uv.y * 14.0)) * 0.6 + vnoise(vec2(o.uv.x * 1.5, o.uv.y * 40.0)) * 0.4;
    vec3 c = vec3(0.45, 0.3, 0.17) * (0.72 + 0.4 * grain);
    return mix(c, vec3(0.08, 0.06, 0.05), smoothstep(0.55, 0.85, o.tone) * 0.85);
  }
  if (o.mat == IRON) return vec3(0.2, 0.2, 0.22) * (0.75 + 0.5 * o.tone) * (0.85 + 0.3 * vnoise(o.uv * 6.0));
  if (o.mat == STONE) return vec3(0.5, 0.48, 0.44) * (0.75 + 0.35 * o.tone) * (0.8 + 0.35 * fbm(o.uv * 0.8));
  if (o.mat == BRASS) return vec3(0.66, 0.47, 0.2) * (0.75 + 0.4 * o.tone) * (0.88 + 0.2 * vnoise(o.uv * 4.0));
  if (o.mat == WAX) return vec3(0.9, 0.84, 0.68) * (0.85 + 0.15 * o.tone) * (0.92 + 0.1 * vnoise(o.uv * 3.0));
  if (o.mat == CLOTH) {
    float bands = abs(sin(o.uv.y * 2.2 + o.uv.x * 0.8 + o.tone * 6.0));
    return mix(vec3(0.32, 0.25, 0.18), vec3(0.12, 0.09, 0.07), 0.5 + 0.4 * bands * vnoise(o.uv * 2.0));
  }
  if (o.mat == CLAY) return vec3(0.6, 0.36, 0.22) * (0.7 + 0.45 * o.tone) * (0.86 + 0.25 * fbm(o.uv * 1.5));
  return vec3(0.1, 0.08, 0.07);
}
// Brilho próprio: brasa, vidro da lanterna, cristal.
vec3 glowOf(Hit o, int color, float seed, float flick) {
  float t = clock();
  if (o.mat == EMBER) {
    float cracks = smoothstep(0.45, 0.8, vnoise(o.uv * 0.5 + t * 0.3) * 0.6 + vnoise(o.uv * 1.3 - t * 0.2) * 0.4);
    return flameTint(color, 0.2 + 0.4 * cracks) * (0.25 + 1.3 * cracks) * flick;
  }
  if (o.mat == GLASS) {
    float center = 1.0 - smoothstep(0.0, 0.16, length(o.uv - vec2(0.0, 0.03)));
    return flameTint(color, 0.35 + 0.4 * center) * (0.55 + 0.9 * center) * flick;
  }
  if (o.mat == CRYSTAL) {
    vec2 u = o.uv / 0.15;
    float swirl = vnoise(vec2(atan(u.y, u.x) * 1.5 + t * 0.6, length(u) * 3.0 - t * 0.4));
    float core = 1.0 - smoothstep(0.0, 0.9, length(u - vec2(-0.15, -0.2)));
    return flameTint(color, 0.3 + 0.5 * core + 0.2 * swirl) * (0.6 + 1.1 * core + 0.3 * swirl) * flick;
  }
  return vec3(0.0);
}

`;

/** Programa de um modelo. */
export function torchFragment(style: MapTorchStyle): string {
  const model = MAP_TORCH_STYLES.indexOf(style);
  return `${HEADER}
const int MODEL = ${model};
${SHAPES}
${SURFACE}
vec2 toLocalHere(vec2 p) { return toLocal(uTorch, MODEL, p); }
vec2 toWorldHere(vec2 local) { return toWorld(uTorch, MODEL, local); }

void main() {
  vec2 q = toLocalHere(vCell);
  float flick = flickerOf(MODEL, uSeed);
  Hit o = modelAt(MODEL, q, uSeed);
  float px = o.sd * uTorch.z * uDevicePerCell;
  float alpha = clamp(px + 0.5, 0.0, 1.0);
  bool glowing = o.mat == EMBER || o.mat == GLASS || o.mat == CRYSTAL;
  if (uGlow < 0.5) {
    if (px < -1.0) discard;
    // inclinação pela altura dos vizinhos (como os objetos)
    float e = 1.0 / (uDevicePerCell * uTorch.z);
    float hx = modelAt(MODEL, q + vec2(e, 0.0), uSeed).h;
    float hy = modelAt(MODEL, q + vec2(0.0, e), uSeed).h;
    vec2 grad = vec2(hx - o.h, hy - o.h) / e;
    float steep = length(grad);
    vec2 gw = grad;
    if (MODEL == 3) { vec2 out_ = vec2(cos(uTorch.w), sin(uTorch.w)), side = vec2(-out_.y, out_.x); gw = grad.x * side + grad.y * out_; }
    vec3 on = normalize(vec3(-gw * min(1.0, 2.2 / max(steep, 1e-4)) * 0.5, 1.0));
    vec3 alb = albedo(o, uColor, uSeed);
    vec3 toLight = normalize(vec3(uLightFrom, 0.9));
    vec3 lit = alb * (0.58 + 0.55 * max(dot(on, toLight), 0.0));
    if (o.mat == IRON || o.mat == BRASS) {
      float spec = pow(max(dot(on, normalize(toLight + vec3(0.0, 0.0, 1.0))), 0.0), 40.0);
      lit += (o.mat == BRASS ? vec3(1.0, 0.85, 0.55) : vec3(0.7)) * spec * 0.35;
    }
    // o que brilha vai pela outra passada: aqui, só o fundo escuro dele
    if (glowing) lit = alb * 0.5;
    float inkW = 1.15 * uDpr;
    float ink = max(1.0 - smoothstep(inkW * 0.55, inkW * 1.25, px), smoothstep(4.0, 9.0, steep) * 0.45);
    lit = mix(lit, lit * (glowing ? 0.55 : 0.18) + vec3(0.03, 0.025, 0.02), ink);
    outColor = vec4(lit * alpha, alpha);
    return;
  }
  vec3 glow = glowOf(o, uColor, uSeed, flick) * alpha;
  // cera translúcida: acesa por dentro perto da chama
  if (o.mat == WAX) glow += flameTint(uColor, 0.3) * 0.2 * flick * alpha;
  float cover = glowing ? alpha : 0.0;
  int count = flameCount(MODEL);
  for (int k = 0; k < 5 + uNoUnroll; k++) {
    if (k >= count) break;
    vec4 f = flameOf(MODEL, k, uSeed);
    vec2 base = toWorldHere(f.xy);
    vec2 d = vCell - base;
    float size = f.z * uTorch.z;
    vec2 shape = flameShape(d, size, uSeed + float(k) * 7.3, f.w);
    vec3 fire = flameTint(uColor, 0.25 + 0.75 * shape.y) * (1.2 + 1.4 * shape.y);
    glow = mix(glow, fire, shape.x * 0.92);
    cover = max(cover, shape.x);
    float r = length((d + vec2(0.0, size * 0.45)) / size);
    glow += flameTint(uColor, 0.35) * exp(-r * r * 0.9) * (0.12 + 0.35 * uNight) * flick * min(1.0, f.z * 3.0);
  }
  if (MODEL == 9) {
    vec2 c = toWorldHere(vec2(0.0, -0.12));
    float r = length(vCell - c) / uTorch.z;
    glow += flameTint(uColor, 0.45) * exp(-r * r * 9.0) * (0.15 + 0.45 * uNight) * flick;
  }
  // somado por cima (mistura "tela"): cor pré-multiplicada de verdade (alfa ≥ cada canal), como as chamas de sempre
  outColor = vec4(glow, clamp(max(cover, max(glow.r, max(glow.g, glow.b))), 0.0, 1.0));
}`;
}
