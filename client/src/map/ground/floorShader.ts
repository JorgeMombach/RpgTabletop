import { FLOOR_MATERIALS, type FloorMaterial } from "@rpg/shared";
import { SCREEN } from "./reliefShader";
import { NO_UNROLL } from "./glKit";

/**
 * Pisos na placa de vídeo (docs/design/pisos.md; visual aprovado em docs/design/pisos-teste.html). Um programa por
 * material, desenhados em ordem (cor pré-multiplicada). Cada pixel lê os bytes dos 4 pontos finos em volta:
 * - a cobertura de "tem piso" interpolada e cortada em 1/2 dá a borda reta e lisa (também na diagonal);
 * - a parte de cada material vem da mesma interpolação por material; cada camada cobre a sua parte e a dos materiais
 *   que vêm depois (que pintam por cima), então entre dois materiais não fica fresta;
 * - a distância até a borda (marchando em 8 direções) dá a sujeira nos cantos, o desgaste no meio e a barra do tapete.
 * O padrão segue a malha quadrada do mapa; a luz é relativa (a cena vem do mapa de luz por cima).
 */

/** Tapetes (caixas em casas) que o shader conhece para o medalhão; os demais ficam sem medalhão. */
export const MAX_CARPETS = 32;

const COMMON = `#version 300 es
precision highp float;
${NO_UNROLL}
precision highp int;
precision highp usampler2D;
out vec4 outColor;
uniform usampler2D uFloor;    // byte por ponto fino (material e sentido), com uma borda vazia
uniform vec2 uFloorOrigin;    // ponto fino do primeiro texel
uniform vec2 uFloorSize;      // tamanho da textura (texels)
uniform sampler2D uStone;     // aquarela da pedra (laje)
uniform vec4 uCarpets[${MAX_CARPETS}]; // caixas dos tapetes (x0, y0, x1, y1 em casas)
uniform int uCarpetCount;
uniform vec3 uLightDir;
uniform float uLightAmount, uAmbientLum, uSunLum;
// Píer (docs/design/pontes.md): a água do terreno embaixo (pesos da água, canal a; da água funda, canal r) e o sol.
uniform sampler2D uWaterA, uWaterB;
uniform vec2 uWeightsOrigin, uWeightsSize;
uniform float uHasWater;
uniform vec2 uSunShift;   // para onde cai a sombra de um nível de altura (casas); 0 sem sol
${SCREEN}
// Sorteio pelos bits do número: igual perto e longe da origem do mapa.
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
float px() { return (uScreen.x / uCanvas.x) / (uStage.z * uMapGrid.z); }
/** Quanto de um detalhe com perCell repetições por casa ainda aparece: some (vira a média) abaixo de ~2 pixels. */
float detail(float perCell) { return 1.0 - smoothstep(0.35, 0.8, px() * perCell); }
/** Luz da face relativa ao chão plano: 1 no plano. */
float relativeShade(vec3 n) {
  float flatLit = max(uLightDir.z, 0.35);
  float flatLight = uAmbientLum + uSunLum * 0.8;
  float shade = (uAmbientLum + uSunLum * 0.8 * max(dot(n, uLightDir), 0.0) / flatLit) / max(flatLight, 0.001);
  return clamp(mix(1.0, shade, uLightAmount), 0.5, 1.5);
}
/** Byte no ponto fino (coordenadas inteiras); fora da textura, sem piso. */
uint byteAt(vec2 fine) {
  ivec2 t = ivec2(fine - uFloorOrigin);
  if (t.x < 0 || t.y < 0 || t.x >= int(uFloorSize.x) || t.y >= int(uFloorSize.y)) return 0u;
  return texelFetch(uFloor, t, 0).r;
}
/** Cobertura "tem piso" interpolada entre os 4 pontos finos em volta (f em pontos finos). */
float coverAt(vec2 f) {
  vec2 i0 = floor(f);
  vec2 fr = f - i0;
  float c00 = float((byteAt(i0) & 15u) != 0u), c10 = float((byteAt(i0 + vec2(1.0, 0.0)) & 15u) != 0u);
  float c01 = float((byteAt(i0 + vec2(0.0, 1.0)) & 15u) != 0u), c11 = float((byteAt(i0 + vec2(1.0, 1.0)) & 15u) != 0u);
  return mix(mix(c00, c10, fr.x), mix(c01, c11, fr.x), fr.y);
}
/** Material (0 = sem piso) do ponto fino mais perto de c (casas). */
int materialNear(vec2 c) { return int(byteAt(floor(c * 4.0 + 0.5)) & 15u); }
/** Dentro do piso (material < 0: qualquer piso, pela cobertura lisa; senão, o material do ponto mais perto). */
bool insideFloor(vec2 c, int material) {
  return material < 0 ? coverAt(c * 4.0) >= 0.5 : materialNear(c) == material;
}
/**
 * Distância (casas) até onde o piso acaba (material < 0: qualquer piso), marchando em 8 direções e refinando o passo
 * que saiu (sem o refino, a distância anda em degraus e a sujeira faz escada na parede diagonal).
 */
float edgeDistance(vec2 c, int material, float stepCells, int steps) {
  float best = stepCells * float(steps + 1);
  for (int d = 0; d < 8 + uNoUnroll; d++) {
    float angle = float(d) * 0.7854;
    vec2 dir = vec2(cos(angle), sin(angle));
    for (int k = 1; k <= 16 + uNoUnroll; k++) {
      if (k > steps) break;
      float r = stepCells * float(k);
      if (r >= best) break;
      if (!insideFloor(c + dir * r, material)) {
        float lo = r - stepCells;
        float hi = r;
        for (int s = 0; s < 4 + uNoUnroll; s++) {
          float mid = (lo + hi) * 0.5;
          if (insideFloor(c + dir * mid, material)) lo = mid; else hi = mid;
        }
        best = (lo + hi) * 0.5;
        break;
      }
    }
  }
  return best;
}
float DIR; // 1 = tábuas na vertical (do ponto mais perto)
`;

/** Altura fina e cor de cada material (da página aprovada). q = ponto no mapa (casas); edge = distância até a borda do piso. */
const MATERIAL_ART: Record<FloorMaterial, string> = {
  plank: `
vec4 plank(vec2 q, float width, float minLen, float maxLen) {
  vec2 r = DIR > 0.5 ? q.yx : q;
  float row = floor(r.y / width);
  float offset = hash(vec2(row, 3.0)) * 4.0;
  float len = minLen + (maxLen - minLen) * hash(vec2(row, 7.0));
  float along = r.x + offset;
  float id = floor(along / len);
  return vec4(fract(along / len) * len, fract(r.y / width) * width, id + row * 131.0, len);
}
float heightAt(vec2 q) {
  vec4 k = plank(q, 0.2, 1.4, 2.6);
  float across = k.y / 0.2;
  float seam = min(across, 1.0 - across) * 0.2;
  float endSeam = min(k.x, k.w - k.x);
  float groove = smoothstep(0.0, 0.012, min(seam, endSeam));
  return groove * (0.012 - pow(abs(across - 0.5) * 2.0, 4.0) * 0.004);
}
vec3 colorAt(vec2 q, float edge) {
  vec4 k = plank(q, 0.2, 1.4, 2.6);
  float tone = hash(vec2(k.z, 1.0));
  vec3 wood = mix(vec3(0.62, 0.42, 0.22), vec3(0.48, 0.3, 0.16), tone);
  wood = mix(wood, vec3(0.7, 0.52, 0.3), step(0.85, hash(vec2(k.z, 9.0))) * 0.5);
  wood *= 0.84 + 0.22 * fbm(vec2(k.x * 3.0, k.y * 60.0 + k.z * 7.0));
  wood *= 0.93 + 0.1 * sin(k.y * 180.0 + fbm(vec2(k.x * 2.0, k.z)) * 9.0) * detail(30.0);
  float across = k.y / 0.2;
  float seam = min(across, 1.0 - across) * 0.2;
  float endSeam = min(k.x, k.w - k.x);
  wood = mix(wood * 0.35, wood, smoothstep(0.0, max(px() * 1.2, 0.006), min(seam, endSeam)));
  float nail = 1.0 - smoothstep(0.012, 0.018, length(vec2(min(k.x, k.w - k.x) - 0.07, (across - 0.5) * 0.2)));
  return mix(wood, vec3(0.18, 0.17, 0.17), nail * detail(40.0));
}`,
  plankWide: `
vec4 plank(vec2 q, float width, float minLen, float maxLen) {
  vec2 r = DIR > 0.5 ? q.yx : q;
  float row = floor(r.y / width);
  float offset = hash(vec2(row, 3.0)) * 4.0;
  float len = minLen + (maxLen - minLen) * hash(vec2(row, 7.0));
  float along = r.x + offset;
  float id = floor(along / len);
  return vec4(fract(along / len) * len, fract(r.y / width) * width, id + row * 131.0, len);
}
float heightAt(vec2 q) {
  vec4 k = plank(q, 0.34, 2.0, 3.6);
  float across = k.y / 0.34;
  float seam = min(min(across, 1.0 - across) * 0.34, min(k.x, k.w - k.x));
  float warp = (fbm(vec2(k.x * 0.8, k.z)) - 0.5) * 0.01;
  float crack = 1.0 - smoothstep(0.0, 0.006, abs(fbm(vec2(k.x * 1.5, k.y * 30.0 + k.z)) - 0.5) * 0.05);
  return smoothstep(0.0, 0.016, seam) * (0.012 + warp) - crack * 0.004 * detail(40.0);
}
vec3 colorAt(vec2 q, float edge) {
  vec4 k = plank(q, 0.34, 2.0, 3.6);
  float tone = hash(vec2(k.z, 1.0));
  vec3 wood = mix(vec3(0.5, 0.39, 0.27), vec3(0.38, 0.28, 0.19), tone);
  wood *= 0.82 + 0.25 * fbm(vec2(k.x * 2.5, k.y * 40.0 + k.z * 5.0));
  wood *= 0.92 + 0.1 * sin(k.y * 120.0 + fbm(vec2(k.x * 1.5, k.z)) * 10.0) * detail(25.0);
  vec2 knotAt = vec2(hash(vec2(k.z, 4.0)) * k.w, 0.17);
  float knot = 1.0 - smoothstep(0.02, 0.05, length((k.xy - knotAt) * vec2(0.6, 1.0)));
  wood = mix(wood, wood * 0.45, knot * step(0.6, hash(vec2(k.z, 5.0))));
  float worn = smoothstep(0.8, 2.6, edge);
  wood = mix(wood, wood * vec3(1.22, 1.18, 1.1) + 0.03, worn * 0.45 * smoothstep(0.3, 0.7, fbm(q * 0.6)));
  float across = k.y / 0.34;
  float seam = min(min(across, 1.0 - across) * 0.34, min(k.x, k.w - k.x));
  return mix(wood * 0.3, wood, smoothstep(0.0, max(px() * 1.4, 0.008), seam));
}`,
  flagstone: `
vec4 slab(vec2 q) {
  vec2 cell = floor(q);
  float split = hash(cell + 2.0);
  vec2 local = fract(q);
  vec2 id = cell; vec2 size = vec2(1.0);
  if (split > 0.55) { bool vertical = hash(cell + 5.0) > 0.5; float half_ = vertical ? step(0.5, local.x) : step(0.5, local.y); id = cell + vec2(half_ * 0.5, half_ * 0.37); if (vertical) { local.x = fract(local.x * 2.0); size.x = 0.5; } else { local.y = fract(local.y * 2.0); size.y = 0.5; } }
  vec2 edgeDist = min(local, 1.0 - local) * size;
  return vec4(id, min(edgeDist.x, edgeDist.y), 0.0);
}
float heightAt(vec2 q) {
  vec4 s = slab(q);
  vec2 tilt = (hash2(s.xy) - 0.5) * 0.03;
  float joint = smoothstep(0.02, 0.05, s.z);
  return joint * (0.03 + dot(fract(q) - 0.5, tilt)) + (fbm(q * 9.0) - 0.5) * 0.006 * joint;
}
vec3 colorAt(vec2 q, float edge) {
  vec4 s = slab(q);
  vec2 uv = q * 0.3 + s.xy * 0.37;
  vec3 col = textureLod(uStone, uv, max(0.0, log2(max(float(textureSize(uStone, 0).x) * 0.3 * px(), 1e-6)))).rgb * vec3(1.05, 1.02, 0.96);
  col *= 0.8 + 0.3 * hash(s.xy);
  col *= 0.86 + 0.28 * fbm(q * 11.0);
  col = mix(col, col * 1.2, (1.0 - smoothstep(0.03, 0.09, s.z)) * 0.5);
  col = mix(col, col * 1.3, step(0.965, hash(floor(q * 40.0))) * 0.5 * detail(40.0));
  vec3 mortar = vec3(0.3, 0.28, 0.24) * (0.8 + 0.3 * mix(0.5, noise(q * 40.0), detail(40.0)));
  return mix(mortar, col, smoothstep(0.012, max(0.03, px() * 1.5), s.z));
}`,
  tile: `
float heightAt(vec2 q) {
  vec2 t = fract(q * 2.0);
  float grout = min(min(t.x, 1.0 - t.x), min(t.y, 1.0 - t.y)) * 0.5;
  return smoothstep(0.008, 0.022, grout) * 0.012 + (noise(q * 20.0) - 0.5) * 0.002;
}
vec3 colorAt(vec2 q, float edge) {
  vec2 id = floor(q * 2.0);
  vec2 t = fract(q * 2.0);
  float grout = min(min(t.x, 1.0 - t.x), min(t.y, 1.0 - t.y)) * 0.5;
  vec3 tile = mix(vec3(0.66, 0.34, 0.2), vec3(0.56, 0.27, 0.16), hash(id));
  if (mod(id.x + id.y, 2.0) > 0.5) tile *= 0.9;
  tile *= 0.88 + 0.22 * fbm(q * 7.0 + id);
  tile += (1.0 - smoothstep(0.1, 0.45, length(t - 0.5))) * 0.05;
  tile = mix(tile, tile * vec3(0.92, 0.88, 0.85), (1.0 - smoothstep(0.0, 0.08, grout)) * 0.5);
  float chip = step(0.93, hash(id + 9.0)) * (1.0 - smoothstep(0.03, 0.06, length(t - vec2(0.9, 0.12))));
  tile = mix(tile, vec3(0.52, 0.4, 0.3), chip * detail(20.0));
  vec3 groutCol = vec3(0.72, 0.68, 0.6) * (0.85 + 0.2 * mix(0.5, noise(q * 50.0), detail(50.0)));
  return mix(groutCol, tile, smoothstep(0.006, max(0.014, px() * 1.2), grout));
}`,
  mosaic: `
float heightAt(vec2 q) {
  vec2 t = fract(q * 8.0);
  float gap = min(min(t.x, 1.0 - t.x), min(t.y, 1.0 - t.y)) / 8.0;
  return smoothstep(0.002, 0.008, gap) * 0.006 * detail(16.0);
}
vec3 colorAt(vec2 q, float edge) {
  vec2 id = floor(q * 8.0) / 8.0 + 0.0625;
  vec2 m = abs(fract(id / 2.0) - 0.5) * 2.0;
  float diamond = m.x + m.y;
  vec3 col = vec3(0.86, 0.82, 0.72);
  if (diamond < 0.55) col = vec3(0.24, 0.36, 0.42);
  if (diamond < 0.3) col = vec3(0.72, 0.52, 0.22);
  if (abs(diamond - 0.8) < 0.08) col = vec3(0.5, 0.2, 0.16);
  col *= 0.86 + 0.24 * hash(floor(q * 8.0));
  vec2 t = fract(q * 8.0);
  float gap = min(min(t.x, 1.0 - t.x), min(t.y, 1.0 - t.y)) / 8.0;
  return mix(vec3(0.62, 0.58, 0.5), col, mix(0.85, smoothstep(0.0015, max(0.004, px()), gap), detail(16.0)));
}`,
  carpet: `
float heightAt(vec2 q) { return 0.02 + (noise(q * 60.0) - 0.5) * 0.002 * detail(60.0); }
vec3 colorAt(vec2 q, float edge) {
  // a barra segue a borda do próprio tapete
  float band = edgeDistance(q, 6, 0.04, 12); // alcance 0,52: passa do fim da barra (0,44), senão o miolo nunca aparece
  float weave = (sin(q.x * 220.0) * sin(q.y * 220.0)) * 0.5 + 0.5;
  vec3 col = vec3(0.5, 0.12, 0.12);
  if (band < 0.12) col = vec3(0.68, 0.5, 0.2);
  else if (band < 0.36) { vec2 r = abs(fract(vec2(q.x + q.y, q.x - q.y) * 2.5) - 0.5); col = (r.x + r.y) < 0.35 ? vec3(0.72, 0.56, 0.25) : vec3(0.22, 0.12, 0.14); }
  else if (band < 0.44) col = vec3(0.68, 0.5, 0.2);
  else {
    // medalhão no meio do tapete (a caixa do tapete que contém o ponto)
    for (int k = 0; k < ${MAX_CARPETS} + uNoUnroll; k++) {
      if (k >= uCarpetCount) break;
      vec4 box = uCarpets[k];
      if (q.x < box.x || q.y < box.y || q.x > box.z || q.y > box.w) continue;
      vec2 center = (box.xy + box.zw) * 0.5;
      vec2 halfSize = (box.zw - box.xy) * 0.5;
      float scale = clamp(min(halfSize.x, halfSize.y) - 0.6, 0.0, 1.2);
      vec2 cc = (q - center) / max(scale, 1e-3);
      float r = length(cc * vec2(1.0, 1.35));
      if (scale > 0.2 && r < 0.9) col = mix(vec3(0.2, 0.22, 0.38), vec3(0.72, 0.56, 0.25), step(0.6, r));
      break;
    }
  }
  col *= 0.88 + 0.16 * mix(0.5, weave, detail(110.0));
  col *= 0.9 + 0.15 * fbm(q * 5.0);
  return col;
}`,
};

/** Programa da camada de um material. */
export function floorFragment(material: FloorMaterial): string {
  const index = FLOOR_MATERIALS.indexOf(material) + 1;
  return `${COMMON}${MATERIAL_ART[material]}
const int MATERIAL = ${index};
// ---------- píer e cais (piso sobre a água) ----------
/** 1 sobre a água pintada (pelo menos metade), 0 em terra. textureLod: sem derivada da tela (lida em laço). */
float waterAt(vec2 c) {
  if (uHasWater < 0.5) return 0.0;
  vec2 uv = (c * 4.0 - uWeightsOrigin + 0.5) / uWeightsSize;
  return smoothstep(0.35, 0.65, textureLod(uWaterA, uv, 0.0).a + textureLod(uWaterB, uv, 0.0).r + textureLod(uWaterB, uv, 0.0).a);
}
bool mineAt(vec2 fine) { return int(byteAt(fine) & 15u) == MATERIAL; }
bool emptyAt(vec2 fine) { return (byteAt(fine) & 15u) == 0u; }
/** Cobertura deste material só (interpolada entre os 4 pontos em volta): o cais e a água escura são de cada piso. */
float mineCover(vec2 f) {
  vec2 i0 = floor(f), fr = f - i0;
  float c00 = float(mineAt(i0)), c10 = float(mineAt(i0 + vec2(1.0, 0.0))), c01 = float(mineAt(i0 + vec2(0.0, 1.0))), c11 = float(mineAt(i0 + vec2(1.0, 1.0)));
  return mix(mix(c00, c10, fr.x), mix(c01, c11, fr.x), fr.y);
}
/**
 * A estaca mais perto (deck de tábuas sobre a água): nos pontos da borda do piso, uma por casa ao longo de cada lado,
 * um fio para fora. Devolve a distância (casas) até o centro dela (9 se não há).
 */
float postDistance(vec2 c) {
  // Estaca só existe sobre a água: sem água a ~1/3 de casa (9 leituras a 0,2 casa; o filtro alcança mais 1/4), sai
  // antes das 16 leituras do piso (a maior parte do piso, longe da água, para aqui).
  float wet = 0.0;
  for (int k = 0; k < 9 + uNoUnroll; k++) {
    vec2 uv = ((c + vec2(float(k % 3) - 1.0, float(k / 3) - 1.0) * 0.2) * 4.0 - uWeightsOrigin + 0.5) / uWeightsSize;
    wet = max(wet, textureLod(uWaterA, uv, 0.0).a + textureLod(uWaterB, uv, 0.0).r + textureLod(uWaterB, uv, 0.0).a);
  }
  if (wet <= 0.0) return 9.0;
  vec2 base = floor(c * 4.0);
  float best = 9.0;
  for (int k = 0; k < 16 + uNoUnroll; k++) {
    vec2 p = base + vec2(float(k % 4) - 1.0, float(k / 4) - 1.0);
    if (!mineAt(p) || waterAt(p / 4.0) < 0.5) continue;
    for (int d = 0; d < 4 + uNoUnroll; d++) {
      vec2 dir = d == 0 ? vec2(1.0, 0.0) : d == 1 ? vec2(-1.0, 0.0) : d == 2 ? vec2(0.0, 1.0) : vec2(0.0, -1.0);
      if (!emptyAt(p + dir)) continue;
      // lado vertical (vizinho dos lados vazio): estaca a cada casa em y; lado horizontal: a cada casa em x
      float along = dir.x != 0.0 ? p.y : p.x;
      if (mod(along, 4.0) > 0.5) continue;
      best = min(best, length(c - (p / 4.0 + dir * 0.03)));
    }
  }
  return best;
}
/** Topo da estaca (madeira com anéis), por cima do que houver. */
vec4 postTop(vec2 c, float d) {
  if (d >= 0.13) return vec4(0.0);
  vec3 top = mix(vec3(0.45, 0.32, 0.2), vec3(0.6, 0.45, 0.3), fract(d * 40.0)) * (0.85 + 0.2 * noise(c * 30.0));
  float a = 1.0 - smoothstep(0.11, 0.13, d);
  return vec4(top * a, a);
}
/** Fora do deck, sobre a água: estacas, espuma, água escura rente e a sombra curta; no cais, a face de pedra. */
vec4 aroundDeck(vec2 c, vec2 f) {
  if (uHasWater < 0.5 || waterAt(c) < 0.3) return vec4(0.0);
  float near = mineCover(f); // > 0 até ~1/4 de casa do último ponto pintado deste material
  bool plank = MATERIAL <= 2;
  vec3 color = vec3(0.0);
  float alpha = 0.0;
  if (plank) {
    float d = postDistance(c);
    // água escura rente ao deck e sombra curta (o deck fica ~0,2 nível acima da água)
    vec2 back = (c - uSunShift * 0.2) * 4.0;
    bool shadow = dot(uSunShift, uSunShift) > 0.0 && mineAt(floor(back + 0.5));
    float dark = max(near > 0.0 ? 0.3 * near * 2.0 : 0.0, shadow ? 0.38 : 0.0);
    alpha = clamp(dark, 0.0, 0.6);
    // espuma em volta da estaca
    float foam = smoothstep(0.24, 0.17, d) * smoothstep(0.1, 0.16, d) * (0.5 + 0.5 * noise(c * 12.0)) * 0.7;
    color = color * (1.0 - foam) + vec3(0.85, 0.92, 0.9) * foam;
    alpha = alpha + foam * (1.0 - alpha);
    vec4 top = postTop(c, d);
    color = color * (1.0 - top.a) + top.rgb;
    alpha = alpha + top.a * (1.0 - alpha);
    return vec4(color, alpha);
  }
  if (MATERIAL >= 3 && MATERIAL <= 5 && near > 0.0) {
    // cais: face de pedra descendo até a água, com juntas; o lado do sol mais claro
    vec2 grad = vec2(mineCover(f + vec2(0.5, 0.0)) - mineCover(f - vec2(0.5, 0.0)), mineCover(f + vec2(0.0, 0.5)) - mineCover(f - vec2(0.0, 0.5)));
    vec2 out2 = length(grad) > 0.0 ? -normalize(grad) : vec2(0.0, 1.0);
    vec2 block = vec2(dot(c, vec2(-out2.y, out2.x)) / 0.35, 0.0);
    float joint = min(fract(block.x), 1.0 - fract(block.x));
    vec3 stone = mix(vec3(0.42, 0.4, 0.37), vec3(0.52, 0.5, 0.46), hash(floor(block))) * mix(0.65, 1.0, smoothstep(0.0, 0.06, joint));
    float a = smoothstep(0.0, 0.35, near);
    return vec4(stone * relativeShade(vec3(out2 * 1.4, 0.6)) * 0.8 * a, a);
  }
  return vec4(0.0);
}
void main() {
  vec2 c = screenCell();
  vec2 f = c * 4.0;
  vec2 i0 = floor(f);
  vec2 fr = f - i0;
  // peso de cada material (0 = sem piso) pela interpolação dos 4 pontos em volta
  float w[7];
  for (int k = 0; k < 7; k++) w[k] = 0.0;
  uint b00 = byteAt(i0), b10 = byteAt(i0 + vec2(1.0, 0.0)), b01 = byteAt(i0 + vec2(0.0, 1.0)), b11 = byteAt(i0 + vec2(1.0, 1.0));
  w[min(int(b00 & 15u), 6)] += (1.0 - fr.x) * (1.0 - fr.y);
  w[min(int(b10 & 15u), 6)] += fr.x * (1.0 - fr.y);
  w[min(int(b01 & 15u), 6)] += (1.0 - fr.x) * fr.y;
  w[min(int(b11 & 15u), 6)] += fr.x * fr.y;
  // borda do piso: o corte em 0,5 da cobertura fica meio ponto (1/8 de casa) além do último ponto pintado; encolher
  // meio ponto (o menor valor nos 4 lados) põe a borda reta em cima da linha (embaixo da parede) e mantém a diagonal
  // reta (um corte mais alto faria degraus nela)
  float cover = min(min(coverAt(f + vec2(0.5, 0.0)), coverAt(f - vec2(0.5, 0.0))), min(coverAt(f + vec2(0.0, 0.5)), coverAt(f - vec2(0.0, 0.5))));
  // (anti-serrilhada pelo tamanho do pixel; derivada antes de descartar)
  float alpha = clamp((cover - 0.5) / max(fwidth(cover), 1e-4) + 0.5, 0.0, 1.0);
  if (alpha <= 0.0) {
    // fora do piso: o que o píer ou o cais deixam na água em volta
    vec4 around = aroundDeck(c, f);
    if (around.a <= 0.001) discard;
    outColor = around;
    return;
  }
  // parte de cada material: quem tem mais peso fica com o pixel; a troca é uma linha lisa de ~1 pixel
  float tw = 4.0 * px();
  float parts[7];
  float total = 0.0;
  for (int k = 1; k < 7; k++) {
    float other = 0.0;
    for (int j = 1; j < 7; j++) if (j != k) other = max(other, w[j]);
    parts[k] = w[k] > 0.0 ? smoothstep(-tw, tw, w[k] - other) : 0.0;
    total += parts[k];
  }
  // esta camada cobre a sua parte e a dos materiais que vêm depois (que pintam por cima), só onde ela aparece
  // (senão a cor dela vazaria na borda de outro material)
  float mine = 0.0;
  if (parts[MATERIAL] > 0.0) for (int k = 1; k < 7; k++) if (k >= MATERIAL) mine += parts[k];
  mine = total > 0.0 ? mine / total : 0.0;
  float coverage = alpha * mine;
  if (coverage <= 0.001) discard;
  DIR = float((byteAt(floor(f + 0.5)) & 16u) != 0u);
  // (a borda desenhada fica meio ponto para dentro do corte da cobertura)
  float edge = max(edgeDistance(c, -1, 0.3, 7) - 0.125, 0.0);
  float e = 0.5 * px();
  // as três alturas num laço: uma cópia só do desenho no programa compilado (compila bem mais rápido no Direct3D)
  float h = 0.0, hx = 0.0, hy = 0.0;
  for (int i = 0; i < 3 + uNoUnroll; i++) {
    float height = heightAt(c + (i == 1 ? vec2(e, 0.0) : i == 2 ? vec2(0.0, e) : vec2(0.0)));
    if (i == 0) h = height; else if (i == 1) hx = height; else hy = height;
  }
  vec3 n = normalize(vec3(-(hx - h) / e, -(hy - h) / e, 1.0));
  vec3 col = colorAt(c, edge) * relativeShade(n);
  // sujeira nos cantos (perto da borda do piso inteiro)
  float dirt = (1.0 - smoothstep(0.0, 0.6, edge)) * (0.5 + 0.5 * fbm(c * 3.0));
  col = mix(col, col * vec3(0.55, 0.5, 0.45), dirt * 0.6);
  // estacas do píer aparecem um pouco por cima da beirada do deck
  if (MATERIAL <= 2 && uHasWater > 0.5) {
    vec4 top = postTop(c, postDistance(c));
    col = col * (1.0 - top.a) + top.rgb;
  }
  outColor = vec4(col * coverage, coverage);
}`;
}
