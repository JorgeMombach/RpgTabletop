import type { WeatherId } from "@rpg/shared";

/**
 * Shaders do clima vivendo no mapa (docs/design/clima.md), gerados dos aprovados na página (docs/design/clima-teste.ts):
 * a cobertura do chão (`WEATHER_COVER_FRAGMENT`) e o que anda no ar (`WEATHER_AIR_FRAGMENT`, com `uGlow` 1 só o que
 * brilha sozinho). A casa de cada pixel vem da tela (como a névoa); o telhado, da textura dos cômodos.
 */

/** O número de cada clima nos corpos dos shaders (a ordem da página aprovada). */
export const WEATHER_SHADER_INDEX: Record<WeatherId, number> = {
  rain: 0,
  storm: 1,
  snow: 2,
  fog: 3,
  leaves: 4,
  sand: 5,
  embers: 6,
  heavyRain: 7,
  hail: 8,
  blizzard: 9,
  bloodRain: 10,
  ash: 11,
  heat: 12,
  fireflies: 13,
  magic: 14,
  spores: 15,
  petals: 16,
};

/** Os cômodos (em casas) na textura do telhado (`uArea`: canto e tamanho em casas). */
export const ROOF_VERTEX = `#version 300 es
in vec2 aCell;
uniform vec4 uArea;
void main() { gl_Position = vec4((aCell - uArea.xy) / uArea.zw * 2.0 - 1.0, 0.0, 1.0); }`;

export const ROOF_FRAGMENT = `#version 300 es
precision highp float;
out vec4 outColor;
void main() { outColor = vec4(1.0); }`;

const WEATHER_COMMON = `
uniform sampler2D uNoise, uRoof;
uniform vec4 uMapGrid;
uniform vec3 uStage;
uniform vec2 uScreen, uCanvas;
uniform vec4 uRoofArea;   // canto e tamanho da textura do telhado (casas); tamanho 0 = sem telhado
uniform float uDensity;    // quantas partículas (Reduzir efeitos: metade)
uniform float uCellPx, uTime, uAcc, uIntensity;
uniform vec2 uWind;        // para onde o vento empurra (casas por casa de queda) e a força (0..1)
uniform int uKind;
float cloudA(vec2 p) { return texture(uNoise, p).r; }
float cloudB(vec2 p) { return texture(uNoise, p).g; }
float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
vec2 hash2(vec2 p) { return vec2(hash(p), hash(p + 19.19)); }
/** Nuvem grande sem o ladrilho aparecendo (três leituras giradas, em escalas que não batem). */
float cloud(vec2 c, float scale) {
  vec2 p = c / scale;
  return cloudA(p) * 0.5 + cloudB(mat2(0.8, -0.6, 0.6, 0.8) * p * 0.71 + 3.1) * 0.3 + cloudA(mat2(0.6, 0.8, -0.8, 0.6) * p * 1.93 + 7.7) * 0.2;
}
/** O telhado (cômodo fechado), macio na borda; fora da área da textura, sem telhado. */
float roofAt(vec2 cell) {
  if (uRoofArea.z <= 0.0) return 0.0;
  vec2 uv = (cell - uRoofArea.xy) / uRoofArea.zw;
  if (uv.x < 0.0 || uv.y < 0.0 || uv.x > 1.0 || uv.y > 1.0) return 0.0;
  return smoothstep(0.2, 0.8, textureLod(uRoof, uv, 2.0).r);
}
/** A casa do pixel (o alto da tela em cima, como a névoa). */
vec2 cellNow() {
  vec2 screen = vec2(gl_FragCoord.x, uCanvas.y - gl_FragCoord.y) * (uScreen / uCanvas);
  return ((screen - uStage.xy) / uStage.z - uMapGrid.xy) / uMapGrid.z;
}
`;

export const WEATHER_COVER_FRAGMENT = `#version 300 es
precision highp float;
out vec4 outColor;
${WEATHER_COMMON}
void main() {
  vec2 c = cellNow();
  float open = 1.0 - roofAt(c);
  float acc = uAcc * uIntensity;
  vec4 col = vec4(0.0);
  if (uKind == 0 || uKind == 1 || uKind == 7 || uKind == 10) {
    // molhado: o chão escurece (na chuva de sangue, vermelho); poças nas partes baixas, com anéis dos pingos
    float low = cloud(c, 9.0) * 0.8 + cloud(c, 2.7) * 0.2;
    float puddle = smoothstep(0.36 - acc * 0.12, 0.33 - acc * 0.12, low);
    vec2 g = c / 0.7; vec2 id = floor(g);
    float ring = 0.0;
    for (int y = -1; y <= 1; y++) for (int x = -1; x <= 1; x++) {
      vec2 cid = id + vec2(x, y);
      float h = hash(cid);
      float phase = fract(uTime * 1.3 + h * 7.0);
      vec2 p = cid + 0.5 + (hash2(cid) - 0.5) * 0.7;
      ring = max(ring, smoothstep(0.05, 0.0, abs(length(g - p) - phase * 0.45)) * (1.0 - phase) * step(1.0 - uIntensity * 0.6, h));
    }
    bool blood = uKind == 10;
    vec3 water = (blood ? vec3(0.36, 0.04, 0.04) : vec3(0.32, 0.4, 0.48)) + (blood ? vec3(0.5, 0.15, 0.15) : vec3(0.5, 0.55, 0.6)) * ring * 0.5;
    float wetAlpha = acc * 0.32;
    float puddleAlpha = puddle * 0.75 * smoothstep(0.0, 0.3, acc);
    float alpha = max(wetAlpha, puddleAlpha);
    vec3 premul = mix((blood ? vec3(0.1, 0.01, 0.01) : vec3(0.03, 0.05, 0.08)) * wetAlpha, water * puddleAlpha, puddleAlpha / max(alpha, 0.001));
    col = vec4(premul, alpha);
  } else if (uKind == 2 || uKind == 9) {
    // neve: manchas brancas que se juntam até cobrir; sombrinha azul nas dobras
    float drift = cloud(c, 6.0) * 0.75 + cloud(c, 2.1) * 0.25;
    float cover = smoothstep(1.0 - acc * 1.1, 1.05 - acc * 1.1, drift + 0.1);
    vec3 snow = mix(vec3(0.78, 0.84, 0.94), vec3(0.97, 0.98, 1.0), smoothstep(0.3, 0.8, drift));
    col = vec4(snow * cover * 0.95, cover * 0.95);
  } else if (uKind == 8) {
    // granizo: pedrinhas brancas pousadas, cada vez mais
    vec2 g = c / 0.3; vec2 id = floor(g);
    float stone = 0.0;
    for (int y = -1; y <= 1; y++) for (int x = -1; x <= 1; x++) {
      vec2 cid = id + vec2(x, y);
      float h = hash(cid);
      if (h > acc * 0.5) continue;
      vec2 p = cid + 0.5 + (hash2(cid) - 0.5) * 0.7;
      stone = max(stone, smoothstep(0.22, 0.12, length(g - p)));
    }
    col = vec4(vec3(0.92, 0.95, 1.0) * stone * 0.9, stone * 0.9);
  } else if (uKind == 4 || uKind == 11 || uKind == 16) {
    // folhas pousadas (cinzas: flocos cinza pequenos; pétalas: cor-de-rosa)
    float leafScale = uKind == 11 ? 0.3 : 0.45;
    vec2 g = c / leafScale; vec2 id = floor(g);
    float leaf = 0.0; float tone = 0.0;
    for (int y = -1; y <= 1; y++) for (int x = -1; x <= 1; x++) {
      vec2 cid = id + vec2(x, y);
      float h = hash(cid);
      if (h > acc * 0.6) continue;
      vec2 p = cid + 0.5 + (hash2(cid) - 0.5) * 0.8;
      float a = hash(cid + 3.0) * 6.28;
      vec2 r = mat2(cos(a), -sin(a), sin(a), cos(a)) * (g - p);
      float shape = smoothstep(1.0, 0.8, length(r / vec2(0.32, 0.16)));
      if (shape > leaf) { leaf = shape; tone = hash(cid + 7.0); }
    }
    vec3 color = uKind == 11 ? mix(vec3(0.35), vec3(0.6), tone) : uKind == 16 ? mix(vec3(0.95, 0.6, 0.72), vec3(1.0, 0.82, 0.88), tone) : mix(vec3(0.75, 0.38, 0.1), vec3(0.85, 0.65, 0.15), tone);
    col = vec4(color * leaf * 0.95, leaf * 0.95);
  } else if (uKind == 5) {
    // areia: véu claro em faixas no sentido do vento
    vec2 dir = normalize(vec2(1.0, uWind.x * 0.3 + 0.0001));
    vec2 q = vec2(dot(c, dir) / 4.0, dot(c, vec2(-dir.y, dir.x)) / 0.9);
    float dune = cloud(q, 2.0) * 0.6 + cloud(q, 0.9) * 0.4;
    float alpha = acc * smoothstep(0.45, 0.8, dune) * 0.35;
    col = vec4(vec3(0.82, 0.7, 0.48) * alpha, alpha);
  }
  outColor = col * open;
}`;

export const WEATHER_AIR_FRAGMENT = `#version 300 es
precision highp float;
out vec4 outColor;
uniform int uGlow;
${WEATHER_COMMON}
/** Uma camada de riscos caindo na direção fall, per por casa, velocidade speed casas/s. */
float streaks(vec2 c, vec2 fall, float per, float speed, float len, float width, float seed) {
  vec2 dir = normalize(fall);
  vec2 q = vec2(dot(c, vec2(dir.y, -dir.x)), dot(c, dir)) * per;
  q.y -= uTime * speed * per;
  vec2 id = floor(q); vec2 f = fract(q) - 0.5;
  float h = hash(id + seed);
  if (h > uDensity * 0.8 + 0.1) return 0.0;
  float x0 = (hash(id + seed + 5.0) - 0.5) * 0.7;
  return smoothstep(width, 0.0, abs(f.x - x0)) * smoothstep(len, 0.0, abs(f.y));
}
/** Pontinhos andando (flocos, brasas), per por casa, com balanço. */
float dots(vec2 c, vec2 drift, float per, float size, float sway, float seed) {
  vec2 q = c * per - drift * uTime * per;
  vec2 id = floor(q);
  float sum = 0.0;
  for (int y = -1; y <= 1; y++) for (int x = -1; x <= 1; x++) {
    vec2 cid = id + vec2(x, y);
    float h = hash(cid + seed);
    if (h > uDensity * 0.85 + 0.1) continue;
    vec2 p = cid + 0.5 + (hash2(cid + seed) - 0.5) * 0.8 + vec2(sin(uTime * 1.3 + h * 20.0), cos(uTime * 0.9 + h * 11.0)) * sway;
    sum += smoothstep(size, size * 0.3, length(q - p));
  }
  return sum;
}
void main() {
  vec2 c = cellNow();
  float open = 1.0 - roofAt(c);
  vec4 col = vec4(0.0);
  vec2 fall = vec2(uWind.x, 1.0);
  if (uGlow == 1) {
    if (uKind == 13 || uKind == 14 || uKind == 15) {
      // vagalumes (amarelo-esverdeado, piscando devagar), luzes mágicas (cores girando) e esporos (verde fraco, subindo)
      vec2 drift = uKind == 15 ? vec2(uWind.x * 0.2, -0.15) : vec2(uWind.x * 0.1, 0.0);
      vec2 q = c * 0.8 - drift * uTime * 0.8;
      vec2 id = floor(q);
      vec3 glow = vec3(0.0);
      for (int y = -1; y <= 1; y++) for (int x = -1; x <= 1; x++) {
        vec2 cid = id + vec2(x, y);
        float h = hash(cid + 5.0);
        if (h > uDensity * 0.55 + 0.05) continue;
        vec2 p = cid + 0.5 + (hash2(cid + 5.0) - 0.5) * 0.8 + vec2(sin(uTime * 0.7 + h * 20.0), cos(uTime * 0.5 + h * 13.0)) * 0.35;
        float d = length(q - p);
        float pulse = uKind == 13 ? pow(max(0.0, sin(uTime * 1.4 + h * 30.0)), 4.0) : uKind == 14 ? 0.7 + 0.3 * sin(uTime * 2.0 + h * 9.0) : 0.5;
        vec3 tint = uKind == 13 ? vec3(0.8, 1.0, 0.35) : uKind == 14 ? 0.5 + 0.5 * cos(6.28 * (h + uTime * 0.1 + vec3(0.0, 0.33, 0.67))) : vec3(0.55, 0.85, 0.45);
        glow += tint * (smoothstep(0.08, 0.02, d) + smoothstep(0.35, 0.0, d) * 0.25) * pulse;
      }
      float a = clamp(max(max(glow.r, glow.g), glow.b), 0.0, 1.0);
      col = vec4(glow, a);
    } else if (uKind == 6) {
      // brasas: sobem e derivam com o vento, piscando
      vec2 drift = vec2(uWind.x * 0.6 + 0.2, -0.5);
      float core = dots(c, drift, 1.1, 0.07, 0.25, 3.0);
      float halo = dots(c, drift, 1.1, 0.3, 0.25, 3.0) * 0.25;
      float flick = 0.55 + 0.45 * sin(uTime * 9.0 + c.x * 3.0 + c.y * 2.0);
      vec3 glow = vec3(1.0, 0.78, 0.4) * core + vec3(1.0, 0.45, 0.1) * halo;
      col = vec4(glow * flick, clamp((core + halo) * flick, 0.0, 1.0));
    }
    outColor = col * open;
    return;
  }
  if (uKind == 0 || uKind == 1 || uKind == 7 || uKind == 10) {
    // chuva: três camadas de riscos (perto, médio, longe) e respingos no chão
    float strong = uKind == 1 ? 1.4 : uKind == 7 ? 1.7 : 1.0;
    float r = streaks(c, fall, 2.2, 14.0 * strong, 0.32, 0.03, 1.0) + streaks(c, fall, 3.4, 11.0 * strong, 0.25, 0.04, 2.0) * 0.7 + streaks(c, fall, 5.0, 9.0 * strong, 0.2, 0.05, 3.0) * 0.45;
    vec2 g = c / 0.5; vec2 id = floor(g);
    float splash = 0.0;
    for (int y = -1; y <= 1; y++) for (int x = -1; x <= 1; x++) {
      vec2 cid = id + vec2(x, y);
      float h = hash(cid + 9.0);
      float phase = fract(uTime * 2.5 + h * 11.0);
      vec2 p = cid + 0.5 + (hash2(cid + 9.0) - 0.5) * 0.8;
      splash = max(splash, smoothstep(0.06, 0.0, abs(length(g - p) - phase * 0.3)) * (1.0 - phase) * step(1.0 - uIntensity * 0.5, h));
    }
    float a = clamp(r * 0.55 + splash * 0.5, 0.0, 1.0);
    if (uKind == 7) a = clamp(a * 1.5, 0.0, 1.0);
    col = vec4((uKind == 10 ? vec3(0.65, 0.08, 0.08) : vec3(0.78, 0.84, 0.92)) * a, a);
  } else if (uKind == 8) {
    // granizo: pedrinhas caindo rápido e quicando
    float s = dots(c, vec2(uWind.x * 1.5, 3.2), 1.5, 0.06, 0.05, 6.0) + dots(c, vec2(uWind.x * 1.2, 2.6), 2.4, 0.05, 0.05, 7.0) * 0.7;
    float a = clamp(s, 0.0, 1.0) * 0.95;
    col = vec4(vec3(0.93, 0.96, 1.0) * a, a);
  } else if (uKind == 9) {
    // nevasca: neve de lado, densa, com rajadas de véu branco
    float s = dots(c, vec2(uWind.x * 2.5 + 1.6, 0.9), 1.6, 0.07, 0.15, 1.0) + dots(c, vec2(uWind.x * 2.2 + 1.3, 0.7), 2.6, 0.08, 0.12, 2.0) * 0.8 + dots(c, vec2(uWind.x * 2.0 + 1.1, 0.6), 3.8, 0.09, 0.1, 3.0) * 0.6;
    float veil = smoothstep(0.4, 0.85, cloud(c - vec2(uTime * 3.0, uTime * 0.5), 9.0)) * 0.35;
    float a = clamp(s * 0.9 + veil, 0.0, 1.0) * uIntensity;
    col = vec4(vec3(1.0) * a, a);
  } else if (uKind == 11) {
    // cinzas: flocos cinza caindo devagar, com balanço
    float s = dots(c, vec2(uWind.x * 0.6, 0.35), 1.4, 0.06, 0.35, 8.0) + dots(c, vec2(uWind.x * 0.5, 0.28), 2.3, 0.06, 0.3, 9.0) * 0.6;
    float a = clamp(s, 0.0, 1.0) * 0.8;
    col = vec4(vec3(0.45) * a, a);
  } else if (uKind == 12) {
    // calor: a miragem tremendo (faixas ondulando de leve)
    float wave = sin(c.y * 5.0 + uTime * 3.0 + cloud(c - vec2(0.0, uTime * 0.5), 4.0) * 8.0);
    float a = smoothstep(0.6, 1.0, wave) * 0.07 * uIntensity;
    col = vec4(vec3(1.0, 0.95, 0.85) * a, a);
  } else if (uKind == 2) {
    // neve: flocos em três tamanhos, caindo devagar com balanço
    float s = dots(c, vec2(uWind.x * 0.8, 0.6), 1.3, 0.07, 0.3, 1.0) + dots(c, vec2(uWind.x * 0.6, 0.45), 2.2, 0.08, 0.25, 2.0) * 0.7 + dots(c, vec2(uWind.x * 0.5, 0.35), 3.4, 0.09, 0.2, 3.0) * 0.5;
    float a = clamp(s, 0.0, 1.0) * 0.9;
    col = vec4(vec3(1.0) * a, a);
  } else if (uKind == 3) {
    // névoa: rente ao chão, andando com o vento; rala dentro do cômodo
    vec2 flow = vec2(uWind.x * 0.4 + 0.15, 0.05) * uTime;
    float mist = cloud(c - flow * 0.5, 11.0) * 0.65 + cloud(c - flow * 0.9 + 9.0, 4.5) * 0.35;
    float a = smoothstep(0.25, 0.9, mist) * uIntensity * 0.6;
    col = vec4(vec3(0.84, 0.86, 0.89) * a, a);
    outColor = col * mix(1.0, 0.35, roofAt(c));
    return;
  } else if (uKind == 4 || uKind == 16) {
    // folhas (pétalas: cor-de-rosa e menores): voando no sentido do vento, girando
    vec2 drift = vec2(uWind.x * 2.0 + 1.2, 0.5);
    vec2 q = c * 0.9 - drift * uTime * 0.9;
    vec2 id = floor(q);
    float leaf = 0.0; float tone = 0.0;
    for (int y = -1; y <= 1; y++) for (int x = -1; x <= 1; x++) {
      vec2 cid = id + vec2(x, y);
      float h = hash(cid);
      if (h > uDensity * 0.5 + 0.05) continue;
      vec2 p = cid + 0.5 + (hash2(cid) - 0.5) * 0.7 + vec2(sin(uTime * 2.0 + h * 9.0), cos(uTime * 1.7 + h * 5.0)) * 0.2;
      float a = uTime * (2.0 + h * 3.0) + h * 6.28;
      vec2 r = mat2(cos(a), -sin(a), sin(a), cos(a)) * (q - p);
      float shape = smoothstep(1.0, 0.75, length(r / (uKind == 16 ? vec2(0.14, 0.08) : vec2(0.2, 0.09))));
      if (shape > leaf) { leaf = shape; tone = hash(cid + 7.0); }
    }
    vec3 color = uKind == 16 ? mix(vec3(0.95, 0.55, 0.68), vec3(1.0, 0.8, 0.86), tone) : mix(vec3(0.7, 0.32, 0.08), vec3(0.88, 0.62, 0.12), tone);
    col = vec4(color * leaf, leaf);
  } else if (uKind == 5) {
    // areia: riscos rápidos de lado e um véu que passa em rajadas
    vec2 side = vec2(1.0, uWind.x * 0.3);
    float s = streaks(c, side, 3.0, 22.0, 0.4, 0.025, 4.0) + streaks(c, side, 5.0, 17.0, 0.3, 0.03, 5.0) * 0.6;
    float gust = smoothstep(0.45, 0.85, cloud(c - vec2(uTime * 2.5, 0.0), 10.0));
    float a = clamp(s * 0.35 + gust * 0.18, 0.0, 1.0) * uIntensity;
    col = vec4(vec3(0.85, 0.72, 0.5) * a, a);
  }
  outColor = col * open;
}`;

/** O clarão do relâmpago por cima de tudo (`uFlash`: o clarão agora, pela curva de hoje). */
export const WEATHER_FLASH_FRAGMENT = `#version 300 es
precision highp float;
out vec4 outColor;
uniform float uFlash;
void main() {
  float a = clamp(uFlash * 0.75, 0.0, 1.0);
  outColor = vec4(vec3(0.85, 0.9, 1.0) * a, a);
}`;
