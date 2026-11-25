/**
 * As formas dos objetos (docs/design/objetos.md), copiadas da página de catálogo aprovada
 * (`docs/design/objetos-catalogo-teste.html`): cada tipo devolve distância até a borda, altura, material, tom e a
 * distância até a borda da parte de cima, nas coordenadas do objeto (tamanho 1). Os laços têm o `uNoUnroll` (o
 * compilador do Direct3D desenrolava tudo e levava segundos).
 */

/** Materiais (os 4 bits de cima do canal A) e a cor da tinta pelo tom (de 0 a 7). */
export const PROP_MATERIAL_GLSL = `
const int M_LEAF = 0, M_NEEDLE = 1, M_GRASS = 2, M_STONE = 3, M_WOOD = 4, M_DARK = 5, M_IRON = 6, M_CLOTH = 7;
const int M_CUT = 8, M_BONE = 9, M_BRICK = 10, M_WATER = 11, M_PAINT = 12, M_BARK = 13, M_RINGS = 14, M_FLAME = 15;
// tinta (M_PAINT): o tom escolhe a cor, de 0 a 7: branco, vermelho, amarelo, roxo, azul, verde, sangue, pardo
vec3 paintColor(float tone) {
  int i = int(floor(tone * 7.0 + 0.5));
  if (i == 0) return vec3(0.9, 0.87, 0.8);
  if (i == 1) return vec3(0.68, 0.15, 0.12);
  if (i == 2) return vec3(0.92, 0.76, 0.25);
  if (i == 3) return vec3(0.5, 0.3, 0.6);
  if (i == 4) return vec3(0.25, 0.38, 0.62);
  if (i == 5) return vec3(0.3, 0.5, 0.25);
  if (i == 6) return vec3(0.36, 0.05, 0.04);
  return vec3(0.55, 0.38, 0.22);
}
`;

/** Formas dos 22 tipos do catálogo e as peças comuns (Hit, take, rockAt…). Precisa de NOISE e PROP_MATERIAL_GLSL antes. */
export const PROP_SHAPE_LIBRARY = `
struct Hit { float sd; float h; int mat; float tone; float edge; };
Hit none() { return Hit(-1e3, 0.0, 0, 0.0, 1.0); }
float sdBox(vec2 p, vec2 b) { vec2 d = abs(p) - b; return -(length(max(d, 0.0)) + min(max(d.x, d.y), 0.0)); }
float sdRound(vec2 p, vec2 b, float r) { return sdBox(p, b - r) + r; }
float sdSegment(vec2 p, vec2 a, vec2 b, float w) { vec2 pa = p - a, ba = b - a; float t = clamp(dot(pa, ba) / max(dot(ba, ba), 1e-6), 0.0, 1.0); return w - length(pa - ba * t); }
float sdEllipse(vec2 p, vec2 ab) { return (1.0 - length(p / ab)) * min(ab.x, ab.y); }
vec2 rotv(vec2 v, float a) { float c = cos(a), s = sin(a); return vec2(c * v.x + s * v.y, -s * v.x + c * v.y); }
void take(inout Hit o, float sd, float h, int mat, float tone) {
  bool inside = sd > 0.0, was = o.sd > 0.0;
  if ((inside && (!was || h > o.h)) || (!inside && !was && sd > o.sd)) { o.h = h; o.mat = mat; o.tone = tone; o.edge = sd; }
  o.sd = max(o.sd, sd);
}
void takeHit(inout Hit o, Hit part) {
  bool inside = part.sd > 0.0, was = o.sd > 0.0;
  if ((inside && (!was || part.h > o.h)) || (!inside && !was && part.sd > o.sd)) { o.h = part.h; o.mat = part.mat; o.tone = part.tone; o.edge = part.edge; }
  o.sd = max(o.sd, part.sd);
}

// Pedra solta (a receita do pedregulho, no raio pedido).
Hit rockAt(vec2 q, float rad, float seed) {
  float k = rad / 0.62;
  vec2 p = q / k;
  float r = length(p);
  vec2 dir = r > 0.0 ? p / r : vec2(1.0, 0.0);
  float edge = 0.62 * (1.0 + 0.5 * (fbm(dir * 1.3 + seed * 5.0) - 0.5));
  float t = clamp(r / edge, 0.0, 1.0);
  vec2 tc; vec3 v = voronoi(p * 4.2 + seed * 7.0, tc);
  vec2 g = (hash22(vec2(v.z * 91.0, seed)) - 0.5) * 0.9;
  float crack = fract(v.z * 7.0) > 0.72 ? v.y / 4.2 : 1.0;
  return Hit((edge - r + (vnoise(p * 20.0 + seed) - 0.5) * 0.015) * k, (0.04 + 0.7 * (1.0 - t * t) + dot(-tc, g) * 0.03 * (0.4 + 0.6 * t)) * k, M_STONE, v.z, crack * k);
}

Hit flowers(vec2 q, float seed) {
  Hit o = none();
  float r = length(q);
  vec2 dir = r > 0.0 ? q / r : vec2(1.0, 0.0);
  float edge = 0.42 * (1.0 + 0.3 * (vnoise(dir * 4.0 + seed) - 0.5));
  float fringe = vnoise(dir * 34.0 + seed * 3.0);
  take(o, edge - r + (fringe - 0.5) * 0.09, 0.1 + 0.06 * vnoise(q * 18.0 + seed), M_GRASS, 0.35 + 0.3 * vnoise(q * 9.0));
  float c1 = (1.0 + floor(hash12(vec2(seed, 1.0)) * 5.0)) / 7.0;
  float c2 = hash12(vec2(seed, 2.0)) < 0.5 ? c1 : 0.0;
  for (int i = 0; i < 12 + uNoUnroll; i++) {
    float fi = float(i);
    vec2 c = (hash22(vec2(seed, fi + 3.0)) - 0.5) * 0.62;
    if (length(c) > 0.36) continue;
    float rad = 0.045 + 0.02 * hash12(vec2(fi, seed));
    vec2 p = q - c;
    float petal = rad * (0.7 + 0.3 * cos(5.0 * atan(p.y, p.x) + fi)) - length(p);
    take(o, petal, 0.18, M_PAINT, hash12(vec2(fi, seed * 1.3)) < 0.5 ? c1 : c2);
    float middle = rad * 0.3 - length(p);
    if (middle > 0.0 && o.mat == M_PAINT) { o.tone = 1.0; o.edge = middle; o.h = 0.19; }
  }
  return o;
}

Hit palm(vec2 q, float seed) {
  Hit o = none();
  for (int k = 0; k < 2 + uNoUnroll; k++) {
    float fk = float(k);
    int n = k == 0 ? 9 : 7;
    float L = k == 0 ? 1.25 : 0.95;
    float twist = hash12(vec2(seed, fk)) * TAU;
    for (int i = 0; i < 9 + uNoUnroll; i++) {
      if (i >= n) break;
      float fi = float(i);
      float ang = twist + fi * TAU / float(n) + (hash12(vec2(fi, seed + fk)) - 0.5) * 0.3;
      vec2 dir = vec2(cos(ang), sin(ang)), side = vec2(-dir.y, dir.x);
      float u = dot(q, dir), t = u / L;
      if (t < 0.02 || t > 1.0) continue;
      float bend = 0.08 * t * t * (hash12(vec2(fi, seed * 2.0)) < 0.5 ? -1.0 : 1.0);
      float w = 0.17 * sin(3.14159 * min(t * 1.25, 1.0)) * (1.0 - 0.3 * t);
      float saw = 0.72 + 0.28 * abs(fract(t * L * 15.0) * 2.0 - 1.0);
      float across = dot(q, side) - bend;
      float s = w * saw - abs(across);
      float h = 1.5 + 0.25 * fk - 0.7 * t * t;
      if (s > 0.0 && (o.sd <= 0.0 || h > o.h)) { o.h = h; o.mat = M_GRASS; o.tone = 0.55 + 0.25 * fk + 0.2 * hash12(vec2(fi, fk)); o.edge = min(s, abs(across) + 0.004); }
      o.sd = max(o.sd, s);
    }
  }
  take(o, 0.1 - length(q), 1.9, M_BARK, 0.5);
  return o;
}

Hit tallGrass(vec2 q, float seed) {
  Hit o = none();
  take(o, 0.1 - length(q) + (vnoise(q * 40.0 + seed) - 0.5) * 0.04, 0.3, M_GRASS, 0.3);
  for (int i = 0; i < 20 + uNoUnroll; i++) {
    float fi = float(i);
    float ang = fi / 20.0 * TAU + (hash12(vec2(fi, seed)) - 0.5) * 0.5;
    float L = 0.45 + hash12(vec2(seed, fi)) * 0.3;
    float bend = (hash12(vec2(fi * 2.0, seed)) - 0.5) * 0.5;
    vec2 dir = vec2(cos(ang), sin(ang)), side = vec2(-dir.y, dir.x);
    float t = dot(q, dir) / L;
    if (t < 0.0 || t > 1.0) continue;
    float across = dot(q, side) - bend * t * t * L;
    float s = 0.065 * (1.0 - t) + 0.006 - abs(across);
    float h = 0.5 * sin(3.14159 * (0.3 + 0.7 * t)) + 0.15 + fi * 0.002;
    if (s > 0.0 && (o.sd <= 0.0 || h > o.h)) { o.h = h; o.mat = M_GRASS; o.tone = 0.5 + 0.5 * t; o.edge = s; }
    o.sd = max(o.sd, s);
  }
  return o;
}

Hit stones(vec2 q, float seed) {
  Hit o = none();
  int n = 3 + int(hash12(vec2(seed, 1.0)) * 4.0);
  for (int i = 0; i < 6 + uNoUnroll; i++) {
    if (i >= n) break;
    float fi = float(i);
    vec2 c = (hash22(vec2(seed, fi * 3.1)) - 0.5) * 0.62;
    takeHit(o, rockAt(q - c, 0.08 + hash12(vec2(fi, seed * 1.3)) * 0.1, seed + fi * 7.7));
  }
  return o;
}

Hit rubble(vec2 q, float seed) {
  Hit o = none();
  int n = 11 + int(hash12(vec2(seed, 2.0)) * 6.0);
  for (int i = 0; i < 16 + uNoUnroll; i++) {
    if (i >= n) break;
    float fi = float(i);
    vec2 c = (hash22(vec2(seed * 1.7, fi)) - 0.5) * 0.72;
    if (hash12(vec2(fi, seed * 2.1)) < 0.4) {
      float w = 0.14 + hash12(vec2(fi, seed)) * 0.1;
      vec2 p = rotv(q - c, hash12(vec2(seed, fi * 5.0)) * 3.14);
      take(o, sdBox(p, vec2(w * 0.5, w * 0.25)), 0.07 + 0.02 * hash12(vec2(fi, 1.0)), M_BRICK, hash12(vec2(fi, seed)));
    } else takeHit(o, rockAt(q - c, 0.06 + hash12(vec2(fi * 1.9, seed)) * 0.08, seed + fi * 3.3));
  }
  return o;
}

Hit logShape(vec2 q, float seed) {
  Hit o = none();
  float len = 1.6 + hash12(vec2(seed, 1.0)) * 0.5, rad = 0.2 + hash12(vec2(seed, 2.0)) * 0.06;
  if (hash12(vec2(seed, 3.0)) < 0.6) {
    float x = (hash12(vec2(seed, 4.0)) - 0.3) * len * 0.5;
    float side = hash12(vec2(seed, 5.0)) < 0.5 ? -1.0 : 1.0;
    take(o, sdSegment(q, vec2(x, side * rad * 0.6), vec2(x + rad * 0.6, side * rad * 1.7), rad * 0.17), 0.25, M_BARK, 0.3);
  }
  float body = min(rad - abs(q.y), len * 0.5 - abs(q.x));
  if (q.x < -len * 0.5 + rad) body = rad - length(q - vec2(-len * 0.5 + rad, 0.0));
  float bulge = sqrt(max(rad * rad - q.y * q.y, 0.0));
  float cutAt = len * 0.5 - rad * 0.35;
  if (q.x > cutAt) { take(o, body, bulge * 0.96 + 0.02, M_RINGS, 0.5); if (o.mat == M_RINGS) o.edge = min(o.edge, q.x - cutAt); }
  else take(o, body, bulge + 0.02, M_BARK, hash12(vec2(seed, 6.0)));
  return o;
}

Hit stump(vec2 q, float seed) {
  Hit o = none();
  float rad = 0.24 + hash12(vec2(seed, 1.0)) * 0.06;
  int roots = 3 + int(hash12(vec2(seed, 2.0)) * 3.0);
  for (int i = 0; i < 5 + uNoUnroll; i++) {
    if (i >= roots) break;
    float fi = float(i);
    float a = fi / float(roots) * TAU + hash12(vec2(seed, fi)) * 0.6;
    float L = rad * (1.3 + hash12(vec2(fi, seed)) * 0.35);
    vec2 a0 = vec2(cos(a), sin(a)) * rad * 0.7, a1 = vec2(cos(a + 0.35), sin(a + 0.35)) * L;
    float t = clamp(dot(q - a0, a1 - a0) / dot(a1 - a0, a1 - a0), 0.0, 1.0);
    take(o, rad * (0.34 - 0.24 * t) - length(q - a0 - (a1 - a0) * t), 0.14 * (1.0 - t) + 0.02, M_BARK, 0.4);
  }
  float r = length(q);
  take(o, rad - r, 0.34, r > rad - 0.035 ? M_BARK : M_RINGS, 0.5);
  if (o.mat == M_RINGS) o.edge = rad - 0.035 - r;
  return o;
}

Hit mushrooms(vec2 q, float seed) {
  Hit o = none();
  int n = 3 + int(hash12(vec2(seed, 1.0)) * 5.0);
  bool red = hash12(vec2(seed, 2.0)) < 0.5;
  for (int i = 0; i < 7 + uNoUnroll; i++) {
    if (i >= n) break;
    float fi = float(i);
    vec2 c = (hash22(vec2(seed, fi)) - 0.5) * 0.55;
    float rad = 0.06 + hash12(vec2(fi, seed)) * 0.12;
    float d = length(q - c), t = clamp(d / rad, 0.0, 1.0);
    take(o, rad - d, 0.1 + rad * 0.55 * (1.0 - t * t) + fi * 0.001, M_PAINT, red ? 1.0 / 7.0 : 1.0);
    if (red && d < rad) for (int j = 0; j < 4 + uNoUnroll; j++) {
      vec2 spot = c + (hash22(vec2(fi + float(j) * 13.0, seed)) - 0.5) * rad * 1.2;
      float s = rad * 0.18 - length(q - spot);
      if (s > 0.0 && o.mat == M_PAINT && o.tone > 0.1) { o.tone = 0.0; o.edge = s; }
    }
  }
  return o;
}

Hit crateBox(vec2 q, float s, float seed, float lift) {
  Hit o = none();
  float half_ = s * 0.5;
  float box = sdBox(q, vec2(half_));
  o.sd = box;
  if (box <= 0.0) return o;
  float frame = 0.1 * s;
  float h = s + lift;
  if (box < frame) { take(o, box, h + 0.01, M_DARK, hash12(vec2(seed, 1.0))); return o; }
  float row = floor((q.y + half_) / (s / 3.0)), fy = fract((q.y + half_) / (s / 3.0));
  take(o, box, h, M_WOOD, hash12(vec2(seed, row + 2.0)));
  o.edge = min(box - frame, min(fy, 1.0 - fy) * s / 3.0);
  float brace = sdSegment(q, vec2(-half_ + frame), vec2(half_ - frame), frame * 0.45);
  if (brace > 0.0) { o.h = h + 0.015; o.mat = M_DARK; o.tone = hash12(vec2(seed, 9.0)); o.edge = brace; }
  for (int i = 0; i < 4 + uNoUnroll; i++) {
    vec2 corner = vec2(i % 2 == 0 ? -1.0 : 1.0, i < 2 ? -1.0 : 1.0) * (half_ - frame * 0.5);
    float nail = frame * 0.22 - length(q - corner);
    if (nail > 0.0) { o.h = h + 0.02; o.mat = M_IRON; o.tone = 0.5; o.edge = nail; }
  }
  return o;
}
Hit crate(vec2 q, float seed) { return crateBox(rotv(q, (hash12(vec2(seed, 4.0)) - 0.5) * 0.25), 0.68 + hash12(vec2(seed, 5.0)) * 0.08, seed, 0.0); }
Hit crates(vec2 q, float seed) {
  Hit o = none();
  float s = 0.62;
  int base = 2 + int(hash12(vec2(seed, 1.0)) * 2.0);
  vec2 spots[3] = vec2[3](vec2(-s * 0.52, s * 0.3), vec2(s * 0.52, s * 0.3), vec2(0.0, -s * 0.55));
  for (int i = 0; i < 3 + uNoUnroll; i++) {
    if (i >= base) break;
    float fi = float(i);
    vec2 c = spots[i] + (hash22(vec2(seed, fi)) - 0.5) * s * 0.1;
    takeHit(o, crateBox(rotv(q - c, (hash12(vec2(fi, seed)) - 0.5) * 0.3), s, seed + fi, 0.0));
  }
  vec2 c = (hash22(vec2(seed, 7.0)) - 0.5) * vec2(0.3, 0.2) * s;
  takeHit(o, crateBox(rotv(q - c, (hash12(vec2(seed, 8.0)) - 0.5) * 0.5), s * 0.92, seed + 5.0, 0.62));
  return o;
}

Hit planks(vec2 q, float seed) {
  Hit o = none();
  int n = 3 + int(hash12(vec2(seed, 1.0)) * 3.0);
  float w = 1.15 + hash12(vec2(seed, 2.0)) * 0.3, th = 0.15;
  for (int i = 0; i < 5 + uNoUnroll; i++) {
    if (i >= n) break;
    float fi = float(i);
    vec2 c = vec2((hash12(vec2(seed, fi)) - 0.5) * 0.15, (fi - float(n) * 0.5 + 0.5) * th * 0.85 + (hash12(vec2(fi, seed)) - 0.5) * th * 0.4);
    vec2 p = rotv(q - c, (hash12(vec2(seed * 1.3, fi)) - 0.5) * 0.25);
    float L = w * (0.85 + hash12(vec2(fi, seed * 2.0)) * 0.2);
    take(o, sdRound(p, vec2(L * 0.5, th * 0.5), 0.01), 0.05 + fi * 0.045, M_WOOD, hash12(vec2(fi * 3.0, seed)));
  }
  return o;
}

Hit tableShape(vec2 q, float seed) {
  Hit o = none();
  float w = 1.2 + hash12(vec2(seed, 1.0)) * 0.3, d = 0.72 + hash12(vec2(seed, 2.0)) * 0.12;
  float top = sdRound(q, vec2(w, d) * 0.5, 0.05);
  float row = floor((q.y + d * 0.5) / (d / 4.0)), fy = fract((q.y + d * 0.5) / (d / 4.0));
  take(o, top, 0.75, M_WOOD, hash12(vec2(seed, row + 3.0)));
  if (top > 0.0) o.edge = min(top, min(fy, 1.0 - fy) * d / 4.0);
  int items = int(hash12(vec2(seed, 4.0)) * 3.0);
  for (int i = 0; i < 2 + uNoUnroll; i++) {
    if (i >= items) break;
    float fi = float(i);
    vec2 c = vec2((hash12(vec2(seed, fi + 5.0)) - 0.5) * w * 0.6, (hash12(vec2(fi, seed + 5.0)) - 0.5) * d * 0.5);
    float pick = hash12(vec2(seed, fi + 9.0)), dist = length(q - c);
    if (pick < 0.4) { take(o, 0.14 - dist, 0.77, M_PAINT, 0.0); if (dist < 0.095 && o.h == 0.77) o.edge = min(o.edge, 0.095 - dist); }
    else if (pick < 0.75) { take(o, 0.08 - dist, 0.85, M_DARK, 0.6); if (dist < 0.055 && o.h == 0.85) { o.h = 0.8; o.tone = 0.0; o.edge = 0.055 - dist; } }
    else { take(o, 0.045 - dist, 0.88, M_PAINT, 0.0); take(o, 0.018 - dist, 0.9, M_FLAME, 0.5); }
  }
  return o;
}

Hit shelf(vec2 q, float seed) {
  Hit o = none();
  float L = 0.85, W = 0.22;
  float frame = sdBox(q, vec2(L, W));
  take(o, frame, 1.6, M_DARK, 0.4);
  if (frame > 0.04) {
    float cells = 4.0, u = (q.x + L) / (2.0 * L) * cells, fu = fract(u);
    float divider = min(fu, 1.0 - fu) * 2.0 * L / cells;
    if (divider < 0.02) o.edge = min(o.edge, divider);
    else {
      float bw = 0.055 + 0.03 * hash12(vec2(floor(u), seed));
      float bu = (q.x + L) / bw, bk = floor(bu), bf = fract(bu);
      if (hash12(vec2(bk, seed * 1.7)) > 0.15) { o.mat = M_PAINT; o.tone = floor(hash12(vec2(bk, seed)) * 6.0) / 7.0; o.h = 1.55; o.edge = min(min(bf, 1.0 - bf) * bw, min(frame - 0.04, divider - 0.02)); }
      else { o.h = 1.4; o.mat = M_DARK; o.tone = 0.0; o.edge = min(frame - 0.04, divider - 0.02); }
    }
  }
  return o;
}

Hit bed(vec2 q, float seed) {
  Hit o = none();
  float L = 0.95, W = 0.55;
  take(o, sdBox(q, vec2(L, W)), 0.4, M_DARK, 0.5);
  take(o, sdRound(q, vec2(L - 0.06, W - 0.06), 0.04), 0.55, M_PAINT, 0.0);
  take(o, sdRound(q - vec2(-L + 0.24, 0.0), vec2(0.14, W - 0.14), 0.07), 0.64, M_PAINT, 0.0);
  float folds = 0.02 * sin(q.y * 18.0 + hash12(vec2(seed, 1.0)) * 6.0) * smoothstep(-0.3, 0.6, q.x);
  take(o, sdRound(q - vec2(0.2, 0.0), vec2(L - 0.24, W - 0.03), 0.03), 0.6 + folds, M_PAINT, (1.0 + floor(hash12(vec2(seed, 2.0)) * 5.0)) / 7.0);
  return o;
}

Hit bridgeShape(vec2 q, float seed) {
  Hit o = none();
  float L = 1.6, W = 0.48;
  for (int i = 0; i < 2 + uNoUnroll; i++) {
    float side = i == 0 ? -1.0 : 1.0;
    take(o, sdBox(q - vec2(0.0, side * W * 0.9), vec2(L, 0.05)), 0.22, M_DARK, 0.4);
    take(o, sdSegment(q, vec2(-L + 0.08, side * (W + 0.06)), vec2(L - 0.08, side * (W + 0.06)), 0.015), 0.62, M_CLOTH, 0.2);
  }
  float pw = 0.14, k = floor((q.x + L) / pw), f = fract((q.x + L) / pw);
  float plank = sdBox(q - vec2(0.0, (hash12(vec2(k, seed)) - 0.5) * 0.06), vec2(L, W));
  take(o, plank, 0.3, M_WOOD, hash12(vec2(k, seed * 1.3)));
  if (o.mat == M_WOOD && plank > 0.0) o.edge = min(plank, min(f, 1.0 - f) * pw);
  for (int i = 0; i < 4 + uNoUnroll; i++) {
    vec2 c = vec2(i % 2 == 0 ? -L + 0.08 : L - 0.08, i < 2 ? -W - 0.06 : W + 0.06);
    take(o, sdBox(q - c, vec2(0.055)), 0.7, M_DARK, 0.6);
  }
  return o;
}

Hit well(vec2 q, float seed) {
  Hit o = none();
  float r = length(q), a = atan(q.y, q.x);
  float spin = hash12(vec2(seed, 1.0));
  float u = a / TAU * 11.0 + spin, k = floor(u), f = fract(u);
  take(o, min(r - 0.4, 0.62 - r), 0.42 + 0.04 * hash12(vec2(k, seed)), M_STONE, hash12(vec2(seed, k)));
  if (o.mat == M_STONE) o.edge = min(o.edge, min(f, 1.0 - f) * r * TAU / 11.0);
  take(o, 0.405 - r, 0.08, M_WATER, 0.5);
  take(o, sdBox(q, vec2(0.75, 0.045)), 0.95, M_DARK, 0.4);
  for (int i = 0; i < 2 + uNoUnroll; i++) take(o, sdBox(q - vec2(i == 0 ? -0.68 : 0.68, 0.0), vec2(0.07)), 1.0, M_DARK, 0.6);
  if (hash12(vec2(seed, 2.0)) < 0.6) {
    vec2 c = vec2(0.17, -0.2);
    take(o, 0.1 - length(q - c), 0.3, M_WOOD, 0.5);
    if (length(q - c) < 0.075 && o.h == 0.3) { o.mat = M_WATER; o.edge = 0.075 - length(q - c); }
  }
  return o;
}

Hit pillar(vec2 q, float seed) {
  Hit o = none();
  float rad = 0.36 + hash12(vec2(seed, 1.0)) * 0.05;
  take(o, sdRound(q, vec2(rad * 1.15), 0.03), 0.3, M_CUT, 0.3);
  float r = length(q), t = clamp(r / rad, 0.0, 1.0);
  take(o, rad - r, 1.6 + 0.05 * (1.0 - t * t), M_CUT, 0.7);
  if (r < rad) {
    o.edge = min(rad - r, min(abs(r - rad * 0.78), abs(r - rad * 0.55)));
    if (hash12(vec2(seed, 2.0)) < 0.35) {
      float a = hash12(vec2(seed, 3.0)) * TAU;
      o.edge = min(o.edge, -sdSegment(q, vec2(cos(a), sin(a)) * rad, vec2(cos(a + 0.4), sin(a + 0.4)) * rad * 0.35, 0.0));
    }
  }
  return o;
}

/** Altura de um domo dentro de uma peça: 0 na borda, 1 no meio (raio r). */
float dome(float sd, float r) { return sqrt(clamp(sd / r, 0.0, 1.0)); }
Hit statue(vec2 q, float seed) {
  Hit o = none();
  float pedestal = sdRound(q, vec2(0.4), 0.08);
  take(o, pedestal, 0.5, M_CUT, 0.1);
  if (pedestal > 0.0) o.edge = min(pedestal, abs(sdRound(q, vec2(0.31), 0.05)));
  float type = floor(hash12(vec2(seed, 1.0)) * 3.0);
  if (type < 0.5) {
    float shoulders = sdEllipse(q, vec2(0.33, 0.17));
    take(o, shoulders, 1.5 + 0.12 * dome(shoulders, 0.17), M_CUT, 0.9);
    for (int i = 0; i < 2 + uNoUnroll; i++) { float arm = sdSegment(q, vec2(i == 0 ? -0.26 : 0.26, 0.0), vec2(i == 0 ? -0.08 : 0.08, 0.16), 0.06); take(o, arm, 1.55 + 0.08 * dome(arm, 0.06), M_CUT, 0.85); }
    float helm = 0.12 - length(q - vec2(0.0, -0.02));
    take(o, helm, 1.75 + 0.15 * dome(helm, 0.12), M_CUT, 1.0);
    take(o, sdSegment(q, vec2(0.0, 0.16), vec2(0.0, 0.42), 0.035), 1.62, M_CUT, 0.7);
    take(o, sdSegment(q, vec2(-0.1, 0.17), vec2(0.1, 0.17), 0.025), 1.64, M_CUT, 0.7);
  } else if (type < 1.5) {
    float robe = sdEllipse(q - vec2(0.0, 0.04), vec2(0.28, 0.22));
    take(o, robe, 1.45 + 0.2 * dome(robe, 0.22), M_CUT, 0.85);
    float hood = 0.13 - length(q - vec2(0.0, -0.04));
    take(o, hood, 1.7 + 0.15 * dome(hood, 0.13), M_CUT, 1.0);
    take(o, sdSegment(q, vec2(0.22, -0.3), vec2(0.26, 0.38), 0.025), 1.7, M_CUT, 0.45);
    take(o, 0.04 - length(q - vec2(0.22, -0.3)), 1.95, M_CUT, 0.85);
  } else {
    for (int i = 0; i < 2 + uNoUnroll; i++) {
      vec2 p = vec2(i == 0 ? -q.x : q.x, q.y);
      float u = p.x - 0.1, t = clamp(u / 0.6, 0.0, 1.0);
      float wing = (u > 0.0 && u < 0.6) ? 0.22 * sin(3.14159 * min(t * 1.2, 1.0)) - abs(p.y + 0.05 + 0.12 * t) - 0.03 * abs(fract(u * 14.0) * 2.0 - 1.0) : -1.0;
      take(o, wing, 1.5 - 0.3 * t + 0.08 * dome(wing, 0.08), M_CUT, 0.8 + 0.2 * t);
    }
    float body = sdEllipse(q, vec2(0.15, 0.12));
    take(o, body, 1.6 + 0.12 * dome(body, 0.12), M_CUT, 0.9);
    float head = 0.09 - length(q - vec2(0.0, -0.05));
    take(o, head, 1.8 + 0.12 * dome(head, 0.09), M_CUT, 1.0);
  }
  return o;
}

Hit altar(vec2 q, float seed) {
  Hit o = none();
  take(o, sdBox(q, vec2(0.75, 0.48)), 0.2, M_CUT, 0.25);
  take(o, sdBox(q, vec2(0.65, 0.38)), 0.55, M_CUT, 0.55);
  if (hash12(vec2(seed, 1.0)) < 0.5) take(o, sdBox(q, vec2(0.22, 0.4)), 0.57, M_PAINT, 1.0 / 7.0);
  if (hash12(vec2(seed, 2.0)) < 0.4) for (int i = 0; i < 3 + uNoUnroll; i++) {
    vec2 c = (hash22(vec2(seed, float(i) + 4.0)) - 0.5) * vec2(0.9, 0.5);
    float s = 0.06 + 0.05 * hash12(vec2(float(i), seed)) - length(q - c) + (vnoise(q * 30.0) - 0.5) * 0.03;
    if (s > 0.0 && o.h >= 0.55) { o.mat = M_PAINT; o.tone = 6.0 / 7.0; }
  }
  int n = 2 + int(hash12(vec2(seed, 3.0)) * 3.0);
  for (int i = 0; i < 4 + uNoUnroll; i++) {
    if (i >= n) break;
    vec2 c = vec2(-0.5 + float(i / 2) * 1.0, i % 2 == 0 ? -0.27 : 0.27);
    take(o, 0.045 - length(q - c), 0.75, M_PAINT, 0.0);
    take(o, 0.018 - length(q - c), 0.8, M_FLAME, 0.5);
  }
  return o;
}

Hit tent(vec2 q, float seed) {
  Hit o = none();
  float L = 0.85, W = 0.6;
  for (int i = 0; i < 4 + uNoUnroll; i++) {
    vec2 corner = vec2(i % 2 == 0 ? -L : L, i < 2 ? -W : W), stake = corner * 1.3;
    take(o, sdSegment(q, corner, stake, 0.008), 0.05, M_CLOTH, 0.1);
    take(o, 0.03 - length(q - stake), 0.08, M_WOOD, 0.5);
  }
  float body = sdBox(q, vec2(L, W));
  take(o, body, 0.95 - abs(q.y) / W * 0.75, M_CLOTH, 0.85 + 0.1 * hash12(vec2(seed, 1.0)));
  if (o.mat == M_CLOTH && body > 0.0) {
    o.edge = min(body, abs(q.y));
    float into = q.x - (L - 0.3);
    if (into > 0.0 && abs(q.y) < 0.24 * into / 0.3) { o.mat = M_DARK; o.tone = 0.0; o.h = 0.4; o.edge = min(body, 0.24 * into / 0.3 - abs(q.y)); }
  }
  return o;
}

Hit sackAt(vec2 q, vec2 c, float s, float ang, float tone) {
  vec2 p = rotv(q - c, ang);
  float body = s * (1.0 + 0.07 * sin(atan(p.y, p.x) * 3.0 + tone * 9.0)) - length(p * vec2(1.0, 1.12));
  float t = clamp(length(p) / s, 0.0, 1.0);
  Hit o = Hit(body, 0.15 + 0.25 * (1.0 - t * t), M_CLOTH, tone, body);
  vec2 m = p - vec2(s * 0.9, 0.0);
  float neck = s * 0.26 - length(m * vec2(1.0, 1.4));
  if (neck > 0.0) { o.h = 0.42; o.edge = neck; o.tone = tone * 0.8; }
  o.sd = max(o.sd, neck);
  float cord = abs(length(p - vec2(s * 0.7, 0.0)) - s * 0.17);
  if (body > 0.0 && cord < s * 0.05) { o.tone = 0.0; o.edge = min(o.edge, cord); }
  return o;
}
Hit sacks(vec2 q, float seed) {
  Hit o = none();
  int n = 2 + int(hash12(vec2(seed, 1.0)) * 3.0);
  for (int i = 0; i < 4 + uNoUnroll; i++) {
    if (i >= n) break;
    float fi = float(i);
    vec2 c = (hash22(vec2(seed, fi)) - 0.5) * 0.45;
    takeHit(o, sackAt(q, c, 0.18 + hash12(vec2(fi, seed)) * 0.07, hash12(vec2(seed, fi + 7.0)) * TAU, 0.4 + 0.5 * hash12(vec2(fi, seed * 2.0))));
  }
  return o;
}

float boneSd(vec2 q, vec2 a, vec2 b, float w) {
  vec2 d = normalize(b - a), n = vec2(-d.y, d.x);
  float s = sdSegment(q, a, b, w * 0.55);
  s = max(s, w * 0.62 - length(q - a - n * w * 0.45));
  s = max(s, w * 0.62 - length(q - a + n * w * 0.45));
  s = max(s, w * 0.62 - length(q - b - n * w * 0.45));
  return max(s, w * 0.62 - length(q - b + n * w * 0.45));
}
Hit bones(vec2 q, float seed) {
  Hit o = none();
  vec2 p = rotv(q - (hash22(vec2(seed, 1.0)) - 0.5) * 0.2, hash12(vec2(seed, 2.0)) * TAU);
  take(o, max(sdEllipse(p, vec2(0.11, 0.13)), sdEllipse(p - vec2(0.0, 0.1), vec2(0.07, 0.05))), 0.12, M_BONE, 0.6);
  for (int i = 0; i < 2 + uNoUnroll; i++) {
    float socket = 0.03 - length(p - vec2(i == 0 ? -0.045 : 0.045, 0.02));
    if (socket > 0.0 && o.mat == M_BONE) { o.mat = M_DARK; o.tone = 0.0; o.h = 0.1; o.edge = socket; }
  }
  int n = 2 + int(hash12(vec2(seed, 3.0)) * 3.0);
  for (int i = 0; i < 4 + uNoUnroll; i++) {
    if (i >= n) break;
    float fi = float(i);
    vec2 a = (hash22(vec2(seed, fi + 5.0)) - 0.5) * 0.55;
    float ang = hash12(vec2(fi, seed * 1.9)) * TAU, len = 0.3 + hash12(vec2(seed, fi * 2.0)) * 0.2;
    vec2 b = a + vec2(cos(ang), sin(ang)) * len;
    take(o, boneSd(q, a, b, 0.06), 0.05 + fi * 0.01, M_BONE, 0.4 + 0.15 * fi);
  }
  return o;
}
`;
