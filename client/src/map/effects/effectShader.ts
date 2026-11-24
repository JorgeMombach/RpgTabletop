import type { EffectPreset } from "@rpg/shared";
import { NO_UNROLL } from "../ground/glKit";

/**
 * Shaders dos efeitos de área (docs/design/efeitos.md). Os corpos de cada tipo são os da página aprovada
 * (docs/design/efeitos-teste.ts); aqui eles ganham a tinta da cor do efeito, o apagado do desligado e o arrasto do
 * token que o efeito acompanha. Cor pré-multiplicada.
 */

/** Triângulos em casas → a máscara do efeito (`uBox`: canto e tamanho da máscara, em casas). */
export const EFFECT_MASK_VERTEX = `#version 300 es
in vec2 aCell;
uniform vec4 uBox;
void main() {
  vec2 uv = (aCell - uBox.xy) / uBox.zw;
  gl_Position = vec4(uv * 2.0 - 1.0, 0.0, 1.0);
}`;

export const EFFECT_MASK_FRAGMENT = `#version 300 es
precision highp float;
out vec4 outColor;
void main() { outColor = vec4(1.0); }`;

/** A caixa do efeito (em casas) na tela, deslocada pelo arrasto (`uOffset`); `vCell` fica onde a máscara está. */
export const EFFECT_BOX_VERTEX = `#version 300 es
in vec2 aCell;
uniform vec4 uMapGrid;
uniform vec3 uStage;
uniform vec2 uScreen;
uniform vec2 uOffset;
out vec2 vCell;
void main() {
  vCell = aCell;
  vec2 screen = ((aCell + uOffset) * uMapGrid.z + uMapGrid.xy) * uStage.z + uStage.xy;
  gl_Position = vec4(screen.x / uScreen.x * 2.0 - 1.0, 1.0 - screen.y / uScreen.y * 2.0, 0.0, 1.0);
}`;

/** O que todos os efeitos leem: ruído, máscara, caixa, tempo, semente; a máscara desfocada. */
export const EFFECT_COMMON = `uniform sampler2D uNoise, uMask;
uniform vec4 uBox;       // caixa da máscara (casas)
uniform float uTime, uSeed, uCellPx;
float cloudA(vec2 p) { return texture(uNoise, p).r; }
float cloudB(vec2 p) { return texture(uNoise, p).g; }
float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7)) + uSeed * 17.0) * 43758.5453); }
vec2 hash2(vec2 p) { return vec2(hash(p), hash(p + 19.19)); }
/** A área desfocada por ~cells casas (a máscara tem 8 px por casa). */
float maskAt(vec2 cell, float cells) {
  // um nível menor e 4 leituras em volta (sem os blocos do nível menor numa máscara pequena)
  vec2 uv = (cell - uBox.xy) / uBox.zw;
  float lod = max(0.0, log2(max(1.0, cells * 8.0)) - 1.0);
  vec2 step = vec2(cells * 0.35) / uBox.zw;
  float sum = textureLod(uMask, uv, lod).r * 2.0;
  sum += textureLod(uMask, uv + vec2(step.x, step.y), lod).r + textureLod(uMask, uv + vec2(-step.x, step.y), lod).r;
  sum += textureLod(uMask, uv + vec2(step.x, -step.y), lod).r + textureLod(uMask, uv - step, lod).r;
  return sum / 6.0;
}`;

/** Funções dos desenhos (borda irregular, voronoi, fagulhas, teia de desenho). */
const EFFECT_HELPERS = `/** Borda irregular: a área macia com o limiar mexido pelo ruído (rough casas). */
float edgeOf(vec2 cell, float soft, float rough, float t) {
  float m = maskAt(cell, soft);
  float n = cloudA(cell / 9.0 + vec2(t * 0.01, uSeed)) - 0.5;
  return smoothstep(0.5 - 0.12, 0.5 + 0.12, m + n * rough);
}
/** Voronoi: distância ao ponto mais perto e à borda entre células (rachaduras, teia). */
vec3 voronoi(vec2 p) {
  vec2 i = floor(p), f = fract(p);
  float d1 = 9.0, d2 = 9.0; vec2 best = vec2(0.0);
  for (int y = -1; y <= 1; y++) for (int x = -1; x <= 1; x++) {
    vec2 g = vec2(x, y);
    vec2 o = hash2(i + g) * 0.8 + 0.1;
    vec2 r = g + o - f;
    float d = dot(r, r);
    if (d < d1) { d2 = d1; d1 = d; best = i + g; } else if (d < d2) d2 = d;
  }
  return vec3(sqrt(d1), sqrt(d2) - sqrt(d1), hash(best));
}
/** Fagulhas: uma por célula de size casas, subindo e apagando; brilho em volta do ponto. */
float sparks(vec2 cell, float size, float speed, float t) {
  vec2 g = floor(cell / size);
  float sum = 0.0;
  for (int y = -1; y <= 1; y++) for (int x = -1; x <= 1; x++) {
    vec2 id = g + vec2(x, y);
    float h = hash(id);
    float phase = fract(t * speed * (0.6 + h) + h * 7.0);
    vec2 p = (id + 0.5 + (hash2(id) - 0.5) * 0.8) * size + vec2(sin(t * 3.0 + h * 9.0) * 0.08, -phase * 0.9);
    float d = length(cell - p);
    sum += (1.0 - phase) * smoothstep(0.07, 0.0, d) * step(0.55, h);
  }
  return sum;
}
/** Uma teia de desenho em volta de center (raio size casas, girada turn): 8 raios e anéis retos entre eles. */
float webAt(vec2 c, vec2 center, float size, float turn) {
  vec2 r = c - center;
  float len = length(r);
  if (len > size * 1.05) return 0.0;
  float spokes = 8.0;
  float sector = 6.28318 / spokes;
  float angle = atan(r.y, r.x) - turn;
  float local = mod(angle, sector) - sector * 0.5;           // ângulo até o meio do gomo
  float toSpoke = len * sin(sector * 0.5 - abs(local));       // distância até o raio mais perto
  float spoke = smoothstep(0.035, 0.012, toSpoke);
  // anel em polígono: a distância "reta" até o meio, cedendo um pouco no meio do gomo
  float flat_ = len * cos(local) / cos(sector * 0.5);
  float sag = 0.06 * size * (1.0 - abs(local) / (sector * 0.5));
  float rings = (flat_ + sag) / size * 5.0;
  float ring = smoothstep(0.035, 0.012, abs(fract(rings) - 0.5) * size / 5.0 * 2.0 - 0.0) * step(0.6, rings) * step(rings, 5.3);
  float center_ = smoothstep(0.09, 0.05, len);
  return max(max(spoke * smoothstep(size * 1.05, size * 0.9, len), ring), center_);
}`;

/** O corpo do desenho de cada tipo (preenche `col`, cor pré-multiplicada). */
const EFFECT_BODIES: Record<EffectPreset, string> = {
  fire: `    // fogo (a base do primeiro, sem cara de lava): labaredas altas e finas que sobem rápido e tremem, com buracos
    // onde a grama aparece; amarelo só no miolo; chão chamuscado ralo, fagulhas e fumaça na beira
    vec2 q = vec2(c.x / 2.0, c.y / 3.8);
    vec2 warp = vec2(cloudA(q * 0.8 + vec2(t * 0.1, t * 0.35)), cloudB(q * 0.8 - vec2(t * 0.12, -t * 0.3))) - 0.5;
    float tongues = cloudA(q + warp * 0.8 + vec2(0.0, t * 0.55)) * 0.62 + cloudB(q * 2.1 + warp + vec2(t * 0.2, t * 0.95)) * 0.38;
    float area = edgeOf(c, 0.7, 1.2, t);
    float inner = maskAt(c, 1.2);
    float flame = area * smoothstep(0.45, 0.75, tongues + inner * 0.14);
    float hot = area * smoothstep(0.72, 1.0, tongues + inner * 0.2);
    vec3 color = mix(vec3(0.62, 0.08, 0.01), vec3(1.0, 0.4, 0.05), smoothstep(0.0, 0.7, flame));
    color = mix(color, vec3(1.0, 0.84, 0.42), hot);
    float flameAlpha = flame * 0.92;
    float scorch = area * (0.18 + 0.22 * inner) * (0.7 + 0.3 * cloudA(c / 2.5 + uSeed));
    vec3 ground = vec3(0.1, 0.06, 0.035);
    float smoke = smoothstep(0.6, 0.85, cloudB(c / 2.5 + vec2(t * 0.05, t * 0.1))) * smoothstep(0.0, 0.4, maskAt(c, 1.5)) * (1.0 - flameAlpha) * 0.3;
    vec3 premul = ground * scorch * (1.0 - flameAlpha);
    premul = premul * (1.0 - smoke) + vec3(0.07) * smoke;
    premul += color * flameAlpha;
    float alpha = clamp(scorch * (1.0 - flameAlpha) + flameAlpha + smoke, 0.0, 1.0);
    float spark = sparks(c, 0.45, 0.55, t) * smoothstep(0.05, 0.4, maskAt(c, 1.0));
    col = vec4(premul + vec3(1.0, 0.7, 0.3) * spark, max(alpha, spark));`,
  water: `    // água: funda no meio, ondulação andando, cáusticas finas e espuma na beira
    float area = edgeOf(c, 0.5, 0.35, t);
    float depth = maskAt(c, 1.5);
    vec2 q = c / 5.0;
    float wave = cloudA(q + vec2(t * 0.03, t * 0.02)) - cloudB(q * 1.7 - vec2(t * 0.025, -t * 0.03));
    float caustic = pow(1.0 - abs(cloudA(q * 2.3 + vec2(t * 0.04, 0.0)) - cloudB(q * 2.3 + vec2(0.0, t * 0.05))), 14.0);
    vec3 water = mix(vec3(0.16, 0.36, 0.52), vec3(0.05, 0.17, 0.32), smoothstep(0.4, 1.0, depth));
    water += vec3(0.25, 0.4, 0.45) * caustic * 0.5 + wave * 0.06;
    float foam = smoothstep(0.35, 0.0, abs(maskAt(c, 0.25) - 0.5)) * smoothstep(0.4, 0.7, cloudA(c / 2.0 + t * 0.03));
    water = mix(water, vec3(0.85, 0.92, 0.95), foam * 0.6);
    float alpha = area * 0.88;
    col = vec4(water * alpha, alpha);`,
  ice: `    // gelo: superfície lisa e translúcida, reflexo atravessando, rachaduras longas, geada na borda e brilhos
    float area = edgeOf(c, 0.35, 0.35, 0.0);
    float depth = maskAt(c, 1.5);
    vec3 ice = mix(vec3(0.72, 0.88, 0.95), vec3(0.45, 0.68, 0.84), smoothstep(0.3, 1.0, depth) * (0.6 + 0.4 * cloudA(c / 7.0 + uSeed)));
    // reflexo: uma faixa clara na diagonal, ondulando de leve
    float sheen = smoothstep(0.35, 0.0, abs(fract((c.x + c.y) / 9.0 + cloudB(c / 8.0) * 0.4) - 0.5) - 0.05);
    ice += vec3(0.25, 0.28, 0.3) * sheen * 0.6;
    // rachaduras: linhas finas e compridas (o meio de duas nuvens), com uma sombra azul ao lado
    float crackA = smoothstep(0.018, 0.0, abs(cloudA(c / 6.0 + uSeed * 2.0) - 0.5));
    float crackB = smoothstep(0.012, 0.0, abs(cloudB(c / 3.5 + uSeed) - 0.5)) * 0.6;
    float crack = max(crackA, crackB);
    ice = mix(ice, vec3(0.95, 0.98, 1.0), crack * 0.8);
    ice = mix(ice, vec3(0.3, 0.5, 0.68), smoothstep(0.03, 0.0, abs(cloudA(c / 6.0 + uSeed * 2.0 + 0.004) - 0.5)) * 0.25);
    // geada branca na beira e em manchas
    float frost = smoothstep(0.6, 0.1, maskAt(c, 0.5)) * area + smoothstep(0.7, 0.85, cloudB(c / 1.8)) * 0.35;
    ice = mix(ice, vec3(0.94, 0.97, 1.0), clamp(frost, 0.0, 1.0) * 0.7);
    // brilho: um ponto em cruz que acende e apaga, em poucas casinhas
    vec2 cellId = floor(c * 1.5);
    vec2 local = fract(c * 1.5) - 0.5 - (hash2(cellId) - 0.5) * 0.6;
    float star = smoothstep(0.08, 0.0, length(local)) + smoothstep(0.012, 0.0, abs(local.x)) * smoothstep(0.22, 0.0, abs(local.y)) + smoothstep(0.012, 0.0, abs(local.y)) * smoothstep(0.22, 0.0, abs(local.x));
    ice += step(0.9, hash(cellId)) * star * pow(max(0.0, sin(t * 1.3 + hash(cellId) * 40.0)), 8.0);
    float alpha = area * 0.82;
    col = vec4(ice * alpha, alpha);`,
  toxic: `    // gás tóxico: nuvem verde que se arrasta e se enrola, transbordando a borda
    vec2 q = c / 8.0;
    vec2 warp = vec2(cloudA(q * 0.5 + vec2(t * 0.015, 0.0)), cloudB(q * 0.5 + vec2(0.0, t * 0.02))) - 0.5;
    float gas = cloudA(q + warp * 1.4 + vec2(t * 0.02, t * 0.008)) * 0.75 + cloudB(q * 1.8 - warp + t * 0.03) * 0.25;
    float area = maskAt(c + warp * 1.6, 1.5);
    float density = smoothstep(0.1, 0.85, area * (0.45 + gas * 0.8));
    vec3 green = mix(vec3(0.32, 0.46, 0.16), vec3(0.6, 0.8, 0.32), smoothstep(0.35, 0.8, gas));
    float alpha = density * 0.62;
    col = vec4(green * alpha, alpha);`,
  darkness: `    // escuridão: breu com fiapos roxos que se mexem e transbordam um pouco
    vec2 q = c / 4.0;
    float smoke = cloudA(q + vec2(t * 0.02, -t * 0.015)) * 0.6 + cloudB(q * 2.0 + vec2(-t * 0.03, t * 0.02)) * 0.4;
    float area = maskAt(c + (vec2(cloudA(q * 0.5 + t * 0.01), cloudB(q * 0.5 - t * 0.01)) - 0.5) * 1.4, 1.0);
    float dark = smoothstep(0.2, 0.7, area * (0.6 + smoke * 0.7));
    vec3 tint = vec3(0.06, 0.03, 0.1) + vec3(0.12, 0.05, 0.2) * smoothstep(0.6, 0.9, smoke) * (1.0 - area);
    float alpha = dark * 0.94;
    col = vec4(tint * alpha, alpha);`,
  web: `    // teia: teias de desenho espalhadas (uma a cada ~2,4 casas, de tamanhos e giros diferentes), fios compridos
    // ligando uma à outra e uma sombrinha escura para ler sobre qualquer chão
    float area = edgeOf(c, 0.3, 0.4, 0.0);
    float strand = 0.0;
    float shadow = 0.0;
    float cellSize = 2.4;
    vec2 id = floor(c / cellSize);
    for (int y = -1; y <= 1; y++) for (int x = -1; x <= 1; x++) {
      vec2 cid = id + vec2(x, y);
      float h = hash(cid);
      vec2 center = (cid + 0.5 + (hash2(cid) - 0.5) * 0.5) * cellSize;
      float size = cellSize * (0.55 + h * 0.25);
      float turn = h * 6.28;
      strand = max(strand, webAt(c, center, size, turn));
      shadow = max(shadow, webAt(c - vec2(0.05, 0.07), center, size, turn));
    }
    // fios de ligação: as bordas entre as teias, mais finos
    vec3 v = voronoi(c / cellSize + uSeed);
    strand = max(strand, smoothstep(0.03, 0.01, v.y * cellSize) * 0.7);
    float sway = 0.85 + 0.15 * sin(t * 1.3 + c.x * 0.7 + c.y * 0.4);
    float lineAlpha = strand * sway;
    float shadowAlpha = shadow * (1.0 - lineAlpha) * 0.35;
    float veil = 0.06;
    float alpha = clamp(lineAlpha * 0.95 + shadowAlpha + veil * (1.0 - lineAlpha), 0.0, 1.0) * area;
    vec3 premul = (vec3(0.96) * lineAlpha * 0.95 + vec3(0.9) * veil * (1.0 - lineAlpha)) * area;
    col = vec4(premul, alpha);`,
  holy: `    // luz sagrada (como a de hoje): brilho que respira no meio, riscos de luz girando no chão e seis luzinhas
    // rondando a borda, com rastro; numa área que não é redonda, a ronda vira a elipse da caixa
    vec2 rel = (c - uCenter) / uRadii;
    float rho = length(rel);
    float angle = atan(rel.y, rel.x);
    float area = maskAt(c, 0.8);
    float breathe = 0.85 + 0.15 * sin(t * 1.3);
    vec3 light = vec3(1.0, 0.86, 0.55) * smoothstep(1.3, 0.0, rho) * 0.32 * breathe + vec3(1.0, 0.97, 0.88) * smoothstep(0.35, 0.0, rho) * 0.35 * breathe;
    float streaks = 0.0;
    for (int i = 0; i < 12; i++) {
      float fi = float(i);
      float radius = (0.3 + hash(vec2(fi, 1.0)) * 0.6) / 0.7 * 0.7;
      float length_ = 0.6 + hash(vec2(fi, 2.0)) * 0.9;
      float head = hash(vec2(fi, 3.0)) * 6.28 + t * (0.35 + hash(vec2(fi, 4.0)) * 0.35);
      float behind = mod(head - angle, 6.28318);
      float along = behind / length_;
      float shape = along < 1.0 ? sin(3.14159 * along) : 0.0;
      float width = 0.035 * shape + 0.004;
      streaks += shape * smoothstep(width, 0.0, abs(rho - radius * (1.0 - 0.08 * along))) * (0.12 + 0.08 * sin(t * 0.9 + fi));
    }
    light += vec3(1.0, 0.86, 0.63) * streaks * 2.2;
    for (int i = 0; i < 6; i++) {
      float head = float(i) / 6.0 * 6.28318 + t * 0.8;
      float behind = mod(head - angle, 6.28318);
      float along = behind / 1.1;
      float fade = along < 1.0 ? 1.0 - along : 0.0;
      float width = 0.02 + 0.06 * fade;
      float trail = fade * fade * smoothstep(width, 0.0, abs(rho - 0.92));
      light += vec3(1.0, 0.65 + 0.3 * fade, 0.3 + 0.45 * fade) * trail * 1.2;
    }
    float mote = sparks(c, 0.6, 0.25, t) * smoothstep(0.1, 0.5, area);
    light = light * smoothstep(0.02, 0.4, area) + vec3(1.0, 0.95, 0.75) * mote;
    float alpha = clamp(max(max(light.r, light.g), light.b) * 0.8, 0.0, 1.0);
    col = vec4(light, alpha);`,
  electric: `    // eletricidade: arcos que pulam e piscam, com um halo azul
    float area = maskAt(c, 0.6);
    float beat = floor(t * 9.0);
    vec2 q = c / 2.5 + vec2(beat * 0.37, beat * 0.11);
    float arc = smoothstep(0.035, 0.0, abs(cloudA(q) - 0.5)) + smoothstep(0.03, 0.0, abs(cloudB(q * 1.7 + 3.0) - 0.5)) * 0.7;
    float flicker = 0.45 + 0.55 * step(0.3, fract(sin(beat * 12.9898) * 43758.5453));
    float halo = smoothstep(0.1, 0.9, area) * 0.25;
    vec3 blue = vec3(0.6, 0.85, 1.0) * (arc * flicker * area) + vec3(0.3, 0.55, 1.0) * halo;
    col = vec4(blue, clamp(arc * flicker * area + halo, 0.0, 1.0));`,
  acid: `    // ácido: poça verde-amarela que ferve; bolhas que crescem e estouram; vapor fraco por cima
    float area = edgeOf(c, 0.45, 0.4, t);
    float depth = maskAt(c, 1.5);
    vec2 q = c / 4.0;
    float churn = cloudA(q + vec2(t * 0.05, -t * 0.04)) * 0.6 + cloudB(q * 2.0 - vec2(t * 0.07, t * 0.05)) * 0.4;
    vec3 acid = mix(vec3(0.62, 0.8, 0.15), vec3(0.34, 0.52, 0.05), smoothstep(0.3, 1.0, depth));
    acid += vec3(0.25, 0.3, 0.05) * smoothstep(0.6, 0.85, churn);
    vec2 g = c / 0.55; vec2 id = floor(g);
    float bubble = 0.0;
    for (int y = -1; y <= 1; y++) for (int x = -1; x <= 1; x++) {
      vec2 cid = id + vec2(x, y);
      float h = hash(cid);
      if (h < 0.5) continue;
      float phase = fract(t * (0.35 + h * 0.4) + h * 5.0);
      vec2 p = cid + 0.5 + (hash2(cid) - 0.5) * 0.6;
      float radius = 0.08 + phase * 0.3;
      float d = length(g - p);
      bubble = max(bubble, smoothstep(0.06, 0.0, abs(d - radius)) * (1.0 - phase) + smoothstep(radius, radius * 0.6, d) * 0.25 * (1.0 - phase));
    }
    acid += vec3(0.85, 0.95, 0.5) * bubble * smoothstep(0.2, 0.6, depth);
    float alpha = area * 0.86;
    col = vec4(acid * alpha, alpha);`,
  wet: `    // solo molhado: o chão escurecido, um reflexo leve andando e ondinhas raras (pingos)
    float area = edgeOf(c, 0.7, 0.8, 0.0);
    vec2 q = c / 6.0;
    float sheen = smoothstep(0.62, 0.85, cloudA(q + vec2(t * 0.01, 0.0)) * 0.6 + cloudB(q * 2.0) * 0.4);
    vec2 g = c / 1.6; vec2 id = floor(g);
    float ripple = 0.0;
    for (int y = -1; y <= 1; y++) for (int x = -1; x <= 1; x++) {
      vec2 cid = id + vec2(x, y);
      float h = hash(cid);
      float phase = fract(t * 0.3 + h * 7.0);
      vec2 p = cid + 0.5 + (hash2(cid) - 0.5) * 0.7;
      float d = length(g - p);
      ripple = max(ripple, smoothstep(0.04, 0.0, abs(d - phase * 0.45)) * (1.0 - phase) * step(0.6, h));
    }
    vec3 wet = vec3(0.08, 0.11, 0.15) + vec3(0.35, 0.42, 0.5) * sheen * 0.35 + vec3(0.6, 0.7, 0.8) * ripple * 0.5;
    float alpha = area * (0.42 + sheen * 0.1 + ripple * 0.3);
    col = vec4(wet * alpha, alpha);`,
  steam: `    // vapor: nuvem branca que sobe e se desfaz, transbordando a borda
    vec2 q = c / 6.0;
    vec2 warp = vec2(cloudA(q * 0.6 + vec2(0.0, t * 0.05)), cloudB(q * 0.6 - vec2(t * 0.03, 0.0))) - 0.5;
    float puff = cloudA(q + warp * 1.3 + vec2(t * 0.01, t * 0.09)) * 0.7 + cloudB(q * 2.2 + warp + vec2(0.0, t * 0.15)) * 0.3;
    float area = maskAt(c + warp * 1.5, 1.4);
    float density = smoothstep(0.12, 0.8, area * (0.45 + puff * 0.8));
    vec3 white = mix(vec3(0.78, 0.82, 0.86), vec3(0.97), smoothstep(0.4, 0.8, puff));
    float alpha = density * 0.62;
    col = vec4(white * alpha, alpha);`,
  mud: `    // lama: marrom grosso e úmido, brilho onde a superfície sobe, bolhas lentas e grandes
    float area = edgeOf(c, 0.5, 0.6, 0.0);
    vec2 q = c / 6.0;
    float lump = cloudA(q + vec2(t * 0.006, 0.0)) * 0.8 + cloudB(q * 2.0) * 0.2;
    float lumpNext = cloudA(q + vec2(0.015, 0.02) + vec2(t * 0.006, 0.0)) * 0.8 + cloudB((q + vec2(0.015, 0.02)) * 2.0) * 0.2;
    vec3 mud = mix(vec3(0.27, 0.18, 0.09), vec3(0.33, 0.22, 0.11), lump);
    mud += vec3(0.35, 0.3, 0.25) * smoothstep(0.015, 0.05, lump - lumpNext) * 0.22;
    vec2 g = c / 1.1; vec2 id = floor(g);
    float bubble = 0.0;
    for (int y = -1; y <= 1; y++) for (int x = -1; x <= 1; x++) {
      vec2 cid = id + vec2(x, y);
      float h = hash(cid);
      if (h < 0.6) continue;
      float phase = fract(t * 0.12 + h * 9.0);
      vec2 p = cid + 0.5 + (hash2(cid) - 0.5) * 0.5;
      float radius = 0.12 + phase * 0.22;
      float d = length(g - p);
      float dome = smoothstep(radius, radius * 0.3, d) * (1.0 - phase * phase);
      bubble = max(bubble, dome);
    }
    mud = mix(mud, vec3(0.5, 0.36, 0.2), bubble * 0.6);
    float alpha = area * 0.9;
    col = vec4(mud * alpha, alpha);`,
  burnt: `    // chão chamuscado: preto queimado com manchas de cinza e brasas que acendem e apagam devagar
    float area = edgeOf(c, 0.7, 0.55, 0.0);
    float ash = cloudA(c / 3.0 + uSeed);
    vec3 burnt = mix(vec3(0.05, 0.04, 0.035), vec3(0.28, 0.26, 0.24), smoothstep(0.6, 0.85, ash) * 0.7);
    vec2 g = c / 0.6; vec2 id = floor(g);
    float ember = 0.0;
    for (int y = -1; y <= 1; y++) for (int x = -1; x <= 1; x++) {
      vec2 cid = id + vec2(x, y);
      float h = hash(cid);
      if (h < 0.75) continue;
      vec2 p = cid + 0.5 + (hash2(cid) - 0.5) * 0.7;
      float glow = pow(max(0.0, sin(t * (0.5 + h) + h * 30.0)), 3.0);
      ember = max(ember, smoothstep(0.18, 0.0, length(g - p)) * glow);
    }
    burnt += vec3(1.0, 0.35, 0.05) * ember * smoothstep(0.2, 0.6, maskAt(c, 1.0));
    float alpha = area * (0.7 + 0.2 * (1.0 - ash));
    col = vec4(burnt * alpha, max(alpha, ember * area));`,
  grease: `    // graxa: mancha escura, lisa e brilhante; um arco-íris fraco só em fios finos de óleo, escorrendo devagar
    float area = edgeOf(c, 0.35, 0.35, 0.0);
    vec2 q = c / 5.0;
    float flow = cloudA(q + vec2(t * 0.012, t * 0.008)) * 0.75 + cloudB(q * 1.8 - t * 0.008) * 0.25;
    float band = smoothstep(0.02, 0.0, abs(fract(flow * 3.0) - 0.5) - 0.2);
    vec3 rainbow = 0.5 + 0.5 * cos(6.28 * (flow * 1.5 + t * 0.015 + vec3(0.0, 0.33, 0.67)));
    float shine = smoothstep(0.7, 0.9, cloudB(q * 0.7 + vec2(0.3, 0.1)));
    vec3 grease = vec3(0.07, 0.06, 0.045) + rainbow * band * 0.08 + vec3(0.35, 0.33, 0.3) * shine * 0.25;
    float alpha = area * 0.8;
    col = vec4(grease * alpha, alpha);`,
  plants: `    // plantas: mato cerrado, folhas em tufos que balançam com o vento
    float area = edgeOf(c, 0.4, 0.8, 0.0);
    vec2 g = c / 0.22; vec2 id = floor(g);
    float leaf = 0.0; float tone = 0.0;
    for (int y = -1; y <= 1; y++) for (int x = -1; x <= 1; x++) {
      vec2 cid = id + vec2(x, y);
      float h = hash(cid);
      vec2 base = cid + 0.5 + (hash2(cid) - 0.5) * 0.8;
      float sway = sin(t * 1.4 + base.x * 0.4 + h * 6.0) * 0.25;
      float angle = h * 6.28 + sway;
      vec2 dir = vec2(cos(angle), sin(angle));
      vec2 r = g - base;
      float along = dot(r, dir);
      float across = dot(r, vec2(-dir.y, dir.x));
      float width = 0.32 * (1.0 - clamp(along / 1.3, 0.0, 1.0));
      float blade = step(0.0, along) * step(along, 1.3) * smoothstep(width, width * 0.4, abs(across));
      if (blade > leaf) { leaf = blade; tone = h; }
    }
    vec3 green = mix(vec3(0.16, 0.36, 0.1), vec3(0.42, 0.62, 0.2), tone) * (0.8 + 0.3 * cloudA(c / 3.0));
    float under = (0.55 + 0.2 * cloudA(c / 2.0)) * area;
    float alpha = clamp(max(leaf * 0.95, under), 0.0, 1.0) * area;
    vec3 premul = mix(vec3(0.12, 0.24, 0.07) * under, green * leaf, leaf) * area;
    col = vec4(premul, alpha);`,
  roots: `    // raízes: poucas e grossas, compridas, serpenteando devagar, com contorno escuro e um ramo fino
    float area = edgeOf(c, 0.4, 0.5, 0.0);
    float root = 0.0; float edge = 0.0;
    for (int i = 0; i < 2; i++) {
      float fi = float(i);
      vec2 p = c / (6.0 - fi * 2.5) + vec2(fi * 5.1, t * 0.006 * (fi + 1.0)) + uSeed;
      float line = abs(cloudA(p) - 0.5);
      float width = i == 0 ? 0.045 : 0.03;
      root = max(root, smoothstep(width, width * 0.45, line));
      edge = max(edge, smoothstep(width * 1.5, width, line));
    }
    // o veio da madeira ao longo da raiz
    vec3 wood = mix(vec3(0.3, 0.19, 0.1), vec3(0.52, 0.35, 0.19), cloudB(c * 2.0)) * (0.85 + 0.25 * root);
    vec3 premul = mix(vec3(0.07, 0.045, 0.025) * edge, wood * root, root) * area;
    float alpha = max(root, edge * 0.85) * area;
    col = vec4(premul, alpha);`,
  fog: `    // névoa: cinza rente ao chão, grossa, arrastando de lado
    vec2 q = c / 7.0;
    vec2 warp = vec2(cloudA(q * 0.5 + vec2(t * 0.02, 0.0)), cloudB(q * 0.5 + vec2(0.0, t * 0.01))) - 0.5;
    float mist = cloudA(q + warp * 1.2 + vec2(t * 0.04, 0.0)) * 0.7 + cloudB(q * 2.0 + warp + vec2(t * 0.06, 0.0)) * 0.3;
    float area = maskAt(c + warp * 1.4, 1.6);
    float density = smoothstep(0.08, 0.8, area * (0.55 + mist * 0.7));
    vec3 grey = mix(vec3(0.5, 0.54, 0.58), vec3(0.72, 0.75, 0.78), smoothstep(0.4, 0.8, mist));
    float alpha = density * 0.6;
    col = vec4(grey * alpha, alpha);`,
  custom: `    // personalizado: brilho na cor escolhida, girando devagar, com pontinhos
    float area = maskAt(c, 1.0);
    vec2 q = c / 4.0;
    float swirl = cloudA(q + vec2(t * 0.03, -t * 0.02)) * 0.6 + cloudB(q * 2.0 + t * 0.04) * 0.4;
    float glow = smoothstep(0.05, 0.9, area) * (0.45 + 0.55 * swirl);
    float mote = sparks(c, 0.6, 0.3, t) * smoothstep(0.1, 0.5, area);
    vec3 color = uColor * glow * 0.8 + mix(uColor, vec3(1.0), 0.6) * mote;
    col = vec4(color, clamp(glow * 0.6 + mote, 0.0, 1.0));`,
};

/** O programa do tipo: o corpo dele, a tinta da cor (`uTint`, a = quanto tinge) e o apagado (`uDim`). */
export function effectFragment(preset: EffectPreset): string {
  // "personalizado" já desenha na cor dele: não tinge de novo
  const tint = preset === "custom" ? "0.0" : "uTint.a";
  return `#version 300 es
precision highp float;
${NO_UNROLL}
in vec2 vCell;
out vec4 outColor;
uniform vec2 uCenter, uRadii;   // meio e meia caixa da forma (casas): a ronda da luz sagrada
uniform vec4 uTint;             // cor do efeito e quanto ela tinge
uniform float uDim;             // 1; desligado (só o mestre vê): 0,3
${EFFECT_COMMON}
#define uColor uTint.rgb
${EFFECT_HELPERS}
void main() {
  vec2 c = vCell;
  float t = uTime;
  vec4 col = vec4(0.0);
  {
${EFFECT_BODIES[preset]}
  }
  // a cor trocada pelo mestre tinge o desenho pela luminância
  float lum = dot(col.rgb, vec3(0.3, 0.55, 0.15));
  col.rgb = mix(col.rgb, lum * uTint.rgb * 1.6, ${tint});
  outColor = col * uDim;
}`;
}
