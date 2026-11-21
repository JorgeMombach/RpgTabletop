import { TERRAINS, type TerrainId } from "@rpg/shared";
import { SCREEN } from "./reliefShader";
import { NO_UNROLL } from "./glKit";

/**
 * Shaders do terreno pintado na placa de vídeo (docs/design/renderizador-chao.md; detalhe por pixel da etapa 3 do
 * relevo, teste aprovado em `docs/design/chao-hd-teste.html`). Um programa por terreno: cada um desenha a sua camada,
 * na ordem de `TERRAINS`, com a mesma mistura de `renderChunk.ts` (borda irregular por ruído, borda um pouco
 * escurecida). Por cima da aquarela (repete a cada 8 casas), o detalhe é calculado por pixel (folhas, grão, pedrinhas,
 * lajes, ondinhas da areia) e o relevo fino pega a luz da cena, relativa ao chão plano. A água pintada só entra
 * durante a passada do pincel (`uWaterDraft`): fora dela, quem desenha a água é o passo da água.
 */

/** Um triângulo que cobre a tela inteira. */
export const FULLSCREEN_VERTEX = `#version 300 es
in vec2 aPos;
void main() { gl_Position = vec4(aPos, 0.0, 1.0); }`;

const COMMON = `#version 300 es
precision highp float;
${NO_UNROLL}
precision highp int;
out vec4 outColor;
uniform sampler2D uWeights;   // a textura de pesos com a camada deste terreno
uniform sampler2D uWatercolor;
uniform vec2 uWeightsOrigin;  // ponto fino do primeiro texel (com a borda de um texel vazio)
uniform vec2 uWeightsSize;    // tamanho das texturas de pesos (texels)
uniform float uWaterDraft;    // 1 = passada do pincel: a aquarela da água aparece
uniform vec3 uLightDir;       // de onde vem a luz (unitário; z = altura)
uniform float uLightAmount, uAmbientLum, uSunLum;
${SCREEN}

// O mesmo sorteio de renderChunk.ts (contas de inteiros de 32 bits): a borda irregular sai igual.
// Os bits de um inteiro como uint (complemento de dois, como o Math.imul): uint() de negativo a GLSL ES não garante;
// ~(−(v + 1)) dá os mesmos bits sem converter negativo.
uint intBits(int v) { return v >= 0 ? uint(v) : ~uint(-(v + 1)); }
float cornerHash(int x, int y) {
  uint h = intBits(x) * 374761393u + intBits(y) * 668265263u;
  h = (h ^ (h >> 13u)) * 1274126177u;
  return float(h ^ (h >> 16u)) / 4294967296.0;
}
float cornerNoise(vec2 p) {
  vec2 cellStart = floor(p);
  vec2 f = p - cellStart;
  vec2 u = f * f * (3.0 - 2.0 * f);
  int xi = int(cellStart.x), yi = int(cellStart.y);
  float a = cornerHash(xi, yi), b = cornerHash(xi + 1, yi), c = cornerHash(xi, yi + 1), d = cornerHash(xi + 1, yi + 1);
  return a + (b - a) * u.x + (c - a) * u.y + (a - b - c + d) * u.x * u.y;
}
// Ruído da borda (renderChunk.ts: edgeNoise), pela posição no mapa em casas.
float edgeNoise(vec2 p) {
  float sum = 0.0, amplitude = 0.5, frequency = 1.82;
  for (int octave = 0; octave < 4 + uNoUnroll; octave++) {
    sum += amplitude * cornerNoise(p * frequency);
    frequency *= 2.03;
    amplitude *= 0.5;
  }
  return sum - 0.5;
}
// Cobertura da camada: EDGE_LOW 0,32 a EDGE_HIGH 0,6, suavizada.
float edgeSmooth(float value) {
  float t = clamp((value - 0.32) / (0.6 - 0.32), 0.0, 1.0);
  return t * t * (3.0 - 2.0 * t);
}

// Detalhe (do teste aprovado).
// Sorteio pelos bits do número (inteiros de 32 bits): igual perto e longe da origem do mapa.
float hash(vec2 p) {
  highp uvec2 q = floatBitsToUint(p);
  highp uint h = (q.x * 1597334677u) ^ (q.y * 3812015801u);
  h ^= h >> 16u; h *= 2246822519u; h ^= h >> 13u; h *= 3266489917u; h ^= h >> 16u;
  return float(h) * (1.0 / 4294967296.0);
}
vec2 hash2(vec2 p) { return vec2(hash(p), hash(p + vec2(31.7, 17.3))); }
float noise(vec2 p) { vec2 i = floor(p), f = fract(p); vec2 u = f * f * (3.0 - 2.0 * f); return mix(mix(hash(i), hash(i + vec2(1, 0)), u.x), mix(hash(i + vec2(0, 1)), hash(i + vec2(1, 1)), u.x), u.y); }
float fbm(vec2 p) { float s = 0.0, a = 0.5; for (int i = 0; i < 4 + uNoUnroll; i++) { s += a * noise(p); p *= 2.03; a *= 0.5; } return s; }
/** Casas por pixel do aparelho. */
float pixelCells() { return (uScreen.x / uCanvas.x) / (uStage.z * uMapGrid.z); }
/** Quanto de um detalhe com perCell repetições por casa ainda aparece: some (vira a média) abaixo de ~2 pixels. */
float detail(float perCell) { return 1.0 - smoothstep(0.35, 0.8, pixelCells() * perCell); }
/** Ruído fino que vai para a média de longe. */
float fineNoise(vec2 c, float perCell) { return mix(0.5, noise(c * perCell), detail(perCell)); }
// Grão solto: ponto sorteado dentro de cada célula (não fica em fileira); some de longe.
float speck(vec2 c, float scale, float chance, float seed) { vec2 g = c * scale + seed; vec2 id = floor(g); vec2 at = 0.5 + (hash2(id) - 0.5) * 0.6; return (hash(id + seed) > chance ? 1.0 - smoothstep(0.18, 0.32, length(fract(g) - at)) : 0.0) * detail(scale); }
// Voronoi: id, distância ao ponto mais perto e folga até a borda.
vec4 voronoi(vec2 p) {
  vec2 i = floor(p), f = fract(p); float d1 = 9.0, d2 = 9.0; vec2 id = vec2(0);
  for (int y = -1; y <= 1 + uNoUnroll; y++) for (int x = -1; x <= 1 + uNoUnroll; x++) { vec2 o = vec2(x, y), r = o + hash2(i + o) - f; float d = dot(r, r); if (d < d1) { d2 = d1; d1 = d; id = i + o; } else if (d < d2) d2 = d; }
  return vec4(id, sqrt(d1), sqrt(d2) - sqrt(d1));
}
/** Luz da face relativa ao chão plano (a do relevo): 1 no plano. */
float relativeShade(vec3 n) {
  float flatLit = max(uLightDir.z, 0.35);
  float flatLight = uAmbientLum + uSunLum * 0.8;
  float shade = (uAmbientLum + uSunLum * 0.8 * max(dot(n, uLightDir), 0.0) / flatLit) / max(flatLight, 0.001);
  return clamp(mix(1.0, shade, uLightAmount), 0.5, 1.5);
}
`;

/** Folhas de grama (grama e grama seca). */
const GRASS = `
// Folhas de grama: tufos (8 por casa de lado) com folhas finas saindo do meio, cada uma um risco que afina na ponta.
// x = cobertura (anti-serrilhado pelo tamanho do pixel), y = onde na folha (0 base, 1 ponta), z = sorteio da folha.
vec3 grassBlades(vec2 c, float density, int count) {
  float px = pixelCells();
  vec2 i = floor(c * 8.0);
  vec3 best = vec3(0.0);
  for (int y = -1; y <= 1 + uNoUnroll; y++) for (int x = -1; x <= 1 + uNoUnroll; x++) {
    vec2 cell = i + vec2(x, y);
    if (hash(cell + 11.0) > density) continue;
    vec2 base = (cell + hash2(cell)) / 8.0;
    // folhas deitadas mais ou menos para o mesmo lado, que muda devagar pelo campo
    float a0 = noise(base * 0.6) * 6.283;
    for (int k = 0; k < 5 + uNoUnroll; k++) {
      if (k >= count) break;
      float fk = float(k);
      float a = a0 + (hash(cell + fk * 7.0) - 0.5) * 1.6;
      float len = 0.06 + 0.08 * hash(cell + fk + 5.0);
      vec2 d = vec2(cos(a), sin(a));
      vec2 rel = c - base;
      float along = clamp(dot(rel, d) / len, 0.0, 1.0);
      float dist = length(rel - d * along * len);
      float width = 0.011 * (1.0 - along * 0.9);
      float cover = 1.0 - smoothstep(width - px * 0.5, width + px * 0.5, dist);
      // a de cima ganha (sorteio por folha)
      float order = hash(cell + fk * 13.0);
      if (cover > 0.02 && (best.x < 0.02 || order > best.z)) best = vec3(max(cover, best.x), along, order);
    }
  }
  return best;
}
vec3 grassColor(vec2 c, vec3 w, float density, int count) {
  vec3 blade = grassBlades(c, density, count);
  vec3 mat = w * (0.74 + 0.14 * noise(c * 20.0)) * (0.92 + 0.12 * fineNoise(c, 90.0));   // fundo entre as folhas
  vec3 leaf = w * (0.88 + 0.28 * blade.y) * (0.88 + 0.26 * blade.z);                 // ponta mais clara
  leaf = mix(leaf, w * vec3(1.3, 1.32, 0.8), smoothstep(0.7, 1.0, blade.y) * 0.25 * step(0.5, blade.z));
  // De longe, as folhas viram a média (cerca de metade coberta), sem sortear folha por pixel.
  vec3 col = mix(mix(mat, w * 1.02, 0.45), mix(mat, leaf, blade.x), detail(45.0));
  return col * (0.9 + 0.2 * fbm(c * 0.7));                                            // tufos mais claros/escuros
}
`;

/** Altura fina (casas) e cor de cada terreno; `w` = aquarela (já com o ajuste de cor do app). */
interface LayerArt {
  height: string;
  color: string;
  grass?: boolean;
}

const SAND_COLOR =
  "vec3(0.86, 0.74, 0.52) * (0.92 + 0.1 * (dot(w, vec3(0.333)) - 0.5))";

const LAYER_ART: Record<TerrainId, LayerArt> = {
  grass: {
    grass: true,
    height: `return fbm(c * 3.0) * 0.025;`,
    color: `
    vec3 col = grassColor(c, w, 0.95, 5);
    // flores miúdas, raras
    vec2 f = fract(c * 6.0) - 0.5; float pick = hash(floor(c * 6.0));
    if (pick > 0.985 && length(f) < 0.1 && detail(30.0) > 0.5) col = mix(col, pick > 0.993 ? vec3(0.95, 0.9, 0.6) : vec3(0.92, 0.92, 0.95), 0.8);
    return col;`,
  },
  grassDry: {
    grass: true,
    height: `
    float bare = smoothstep(0.42, 0.3, fbm(c * 1.6 + 4.0));
    return mix(fbm(c * 3.0) * 0.02, (fbm(c * 12.0) - 0.5) * 0.01, bare);`,
    color: `
    float bare = smoothstep(0.42, 0.3, fbm(c * 1.6 + 4.0));
    vec3 col = grassColor(c, w, 0.75 - bare * 0.6, 4);
    vec3 soil = vec3(0.55, 0.43, 0.3) * (0.85 + 0.25 * fbm(c * 14.0)) * (0.94 + 0.12 * fineNoise(c, 55.0));
    return mix(col, soil, bare * 0.75);`,
  },
  dirt: {
    height: `
    vec4 v = voronoi(c * 7.0); float r = 0.2 + 0.15 * hash(v.xy + 1.0);
    float pebble = hash(v.xy) > 0.86 ? sqrt(max(0.0, 1.0 - pow(v.z / r, 2.0))) : 0.0; pebble *= detail(30.0);
    float crack = (1.0 - smoothstep(0.0, 0.04, voronoi(c * 1.4 + 9.0).w)) * detail(25.0);
    return pebble * 0.035 + (fbm(c * 10.0) - 0.5) * 0.016 - crack * 0.012 * smoothstep(0.5, 0.7, fbm(c * 0.9));`,
    color: `
    vec4 v = voronoi(c * 7.0); float r = 0.2 + 0.15 * hash(v.xy + 1.0);
    float pebble = hash(v.xy) > 0.86 ? smoothstep(r, r * 0.8, v.z) * 0.8 : 0.0; pebble *= detail(30.0);
    vec3 col = w * (0.84 + 0.3 * fbm(c * 9.0));
    col *= 0.94 + 0.12 * fineNoise(c, 55.0);
    vec3 stone = mix(w * 1.2, vec3(0.5, 0.45, 0.4), 0.3 + 0.25 * hash(v.xy + 7.0)) * (0.9 + 0.2 * fineNoise(c, 60.0));
    col = mix(col, stone, pebble);
    float crack = (1.0 - smoothstep(0.0, 0.04, voronoi(c * 1.4 + 9.0).w)) * detail(25.0);
    col *= 1.0 - crack * 0.35 * smoothstep(0.5, 0.7, fbm(c * 0.9));
    return col;`,
  },
  dirtDark: {
    height: `
    float clod = fbm(c * 6.0);
    vec4 v = voronoi(c * 5.0); float r = 0.16 + 0.1 * hash(v.xy + 1.0);
    float pebble = hash(v.xy) > 0.86 ? sqrt(max(0.0, 1.0 - pow(v.z / r, 2.0))) : 0.0; pebble *= detail(30.0);
    return clod * 0.03 + pebble * 0.03 + (fineNoise(c, 30.0) - 0.5) * 0.006;`,
    color: `
    float clod = fbm(c * 6.0);
    vec4 v = voronoi(c * 5.0); float r = 0.16 + 0.1 * hash(v.xy + 1.0);
    float pebble = hash(v.xy) > 0.86 ? smoothstep(r, r * 0.8, v.z) : 0.0; pebble *= detail(30.0);
    vec3 col = w * (0.78 + 0.4 * clod);
    col *= 0.93 + 0.14 * fineNoise(c, 50.0);
    col = mix(col, vec3(0.3, 0.38, 0.2), smoothstep(0.62, 0.75, fbm(c * 1.2 + 2.0)) * 0.35);  // musgo úmido
    col = mix(col, vec3(0.42, 0.38, 0.33) * (0.9 + 0.2 * fineNoise(c, 60.0)), pebble);
    return col;`,
  },
  stone: {
    height: `
    vec4 v = voronoi(c * 1.1);
    float slab = smoothstep(0.02, 0.07, v.w);
    vec2 tilt = (hash2(v.xy) - 0.5) * 0.04;
    vec2 inSlab = c * 1.1 - (v.xy + hash2(v.xy));
    return slab * (0.05 + dot(inSlab, tilt)) + (fbm(c * 8.0) - 0.5) * 0.01 * slab;`,
    color: `
    vec4 v = voronoi(c * 1.1);
    float slab = smoothstep(0.02, 0.07, v.w);
    vec3 col = w * (0.82 + 0.3 * hash(v.xy));
    col *= 0.86 + 0.28 * fbm(c * 12.0);
    col = mix(col, col * 1.18, (1.0 - smoothstep(0.07, 0.16, v.w)) * slab * 0.6);   // aresta gasta clara
    col = mix(col, col * 1.35, step(0.96, hash(floor(c * 48.0))) * 0.6 * detail(48.0));             // mica
    vec3 gap = vec3(0.3, 0.27, 0.22) * (0.8 + 0.3 * fineNoise(c, 40.0));
    gap = mix(gap, vec3(0.28, 0.36, 0.18), smoothstep(0.55, 0.7, fbm(c * 3.0)) * 0.6);  // musgo nas juntas
    return mix(gap, col, slab);`,
  },
  stoneLight: {
    height: `
    vec4 v = voronoi(c * 2.6);
    float dome = smoothstep(0.0, 0.28, v.w);
    return 0.045 * sqrt(dome) + (fbm(c * 14.0) - 0.5) * 0.006 * dome;`,
    color: `
    vec4 v = voronoi(c * 2.6);
    float dome = smoothstep(0.0, 0.28, v.w);
    vec3 col = w * (0.78 + 0.38 * hash(v.xy)) * mix(vec3(1.0), vec3(1.05, 1.0, 0.92), hash(v.xy + 3.0));
    col *= 0.88 + 0.24 * fbm(c * 16.0);
    vec3 gap = vec3(0.42, 0.37, 0.29) * (0.8 + 0.3 * fineNoise(c, 50.0));
    return mix(gap, col, smoothstep(0.0, 0.08, v.w));`,
  },
  sand: {
    height: `
    vec2 dir = normalize(vec2(1.0, 0.35 + (noise(c * 0.12) - 0.5) * 0.5));
    float phase = dot(c, dir) * 12.0 + noise(c * 0.5) * 2.0;
    return pow(0.5 + 0.5 * sin(phase), 2.2) * 0.012 + (fineNoise(c, 70.0) - 0.5) * 0.002;`,
    color: `
    vec3 col = ${SAND_COLOR} * (0.93 + 0.1 * fbm(c * 2.0));
    col *= 0.96 + 0.06 * fineNoise(c, 80.0);
    col = mix(col, col * 0.62, speck(c, 90.0, 0.97, 0.0));   // grãos escuros
    col = mix(col, col * 1.18, speck(c, 90.0, 0.98, 5.0));   // grãos claros
    return col;`,
  },
  // Água pintada: só a aquarela, e só durante a passada do pincel (depois quem desenha é o passo da água).
  water: { height: `return 0.0;`, color: `return w;` },
  waterDark: { height: `return 0.0;`, color: `return w;` },
};

/** Programa da camada de um terreno: cobertura pela borda irregular e cor com o detalhe e a luz (pré-multiplicada). */
export function terrainLayerFragment(terrain: TerrainId): string {
  const index = TERRAINS.indexOf(terrain);
  const art = LAYER_ART[terrain];
  const water = terrain === "water" || terrain === "waterDark";
  return `${COMMON}${art.grass ? GRASS : ""}
float layerHeight(vec2 c) { ${art.height} }
vec3 layerColor(vec2 c, vec3 w) { ${art.color} }
void main() {
  vec2 c = screenCell();
  vec2 uv = (c * 4.0 - uWeightsOrigin + 0.5) / uWeightsSize;
  float value = texture(uWeights, uv).${"rgba"[index % 4]}${water ? " * uWaterDraft" : ""};
  // Longe da borda pintada: nada (aparece o que está embaixo).
  if (value <= 0.32 - 0.15) discard;
  // Borda irregular, mas fina: ruído de 0,3 (o mesmo do desenho sem WebGL, renderChunk.ts).
  float alpha = edgeSmooth(value + edgeNoise(c) * 0.3);
  if (alpha <= 0.0) discard;
  float px = pixelCells();
  // Aquarela com o nível de detalhe pelo tamanho do pixel (leitura dentro de condicional: sem derivada automática).
  vec3 w = textureLod(uWatercolor, c / 8.0, max(0.0, log2(max(float(textureSize(uWatercolor, 0).x) / 8.0 * px, 1e-6)))).rgb;
  // Relevo fino pela luz (meio pixel para cada lado).
  float e = 0.5 * px;
  // as três alturas num laço: uma cópia só do desenho no programa compilado (compila bem mais rápido no Direct3D)
  float h = 0.0, hx = 0.0, hy = 0.0;
  for (int i = 0; i < 3 + uNoUnroll; i++) {
    float height = layerHeight(c + (i == 1 ? vec2(e, 0.0) : i == 2 ? vec2(0.0, e) : vec2(0.0)));
    if (i == 0) h = height; else if (i == 1) hx = height; else hy = height;
  }
  vec3 n = normalize(vec3(-(hx - h) / e, -(hy - h) / e, 1.0));
  vec3 texel = layerColor(c, w) * relativeShade(n);
  // Borda entre terrenos um pouco escurecida, como no desenho no processador.
  float shade = 1.0 - 0.32 * min(1.0, alpha * (1.0 - alpha) * 4.0);
  outColor = vec4(texel * shade * alpha, alpha);
}`;
}

/** Copia uma textura do tamanho da tela para a tela. */
export const BLIT_FRAGMENT = `#version 300 es
precision highp float;
${NO_UNROLL}
out vec4 outColor;
uniform sampler2D uImage;
uniform vec2 uCanvas;
void main() { outColor = texture(uImage, gl_FragCoord.xy / uCanvas); }`;
