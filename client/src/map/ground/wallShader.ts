import { WALL_STYLES, type WallStyle } from "@rpg/shared";
import { SCREEN } from "./reliefShader";
import { NO_UNROLL } from "./glKit";

/**
 * Paredes, portas e janela na placa de vídeo (docs/design/relevo.md, etapa 2), portadas das páginas aprovadas
 * (`docs/design/paredes-gpu-a.html`, `-b.html`, `-c.html`). Cada pixel acha a peça vencedora entre as candidatas da
 * casa (`wallCellIndex`) e calcula, exato, a posição ao longo e através, a altura do perfil, a normal e a cor: nítido
 * em qualquer zoom. Um programa pequeno por desenho e um para as aberturas (um shader gigante travou o WebGL).
 *
 * A luz é relativa ao chão plano (1 no plano): a luz da cena, a sombra e as tochas vêm do mapa de luz por cima.
 */

/** Largura (em texels) das texturas das peças e da lista. */
export const WALL_TEXTURE_WIDTH = 1024;

const COMMON = `#version 300 es
precision highp float;
${NO_UNROLL}
precision highp int;
precision highp usampler2D;
// Peças em precisão cheia: o padrão do sampler no fragmento é baixo (no celular, viraria meia precisão).
precision highp sampler2D;
out vec4 outColor;
uniform sampler2D uPieces;   // RGBA32F, quatro texels por peça (packPieces)
uniform usampler2D uCells;   // RG32UI: início e quantidade na lista, por casa
uniform usampler2D uList;    // R32UI: índices das peças
uniform ivec4 uIndexBox;     // casa do canto, colunas e linhas do índice
uniform sampler2D uStone, uStone2;
uniform vec3 uLightDir;      // de onde vem a luz (unitário; z = altura)
uniform float uLightAmount, uAmbientLum, uSunLum;
${SCREEN}
const int TEX_W = ${WALL_TEXTURE_WIDTH};
const int CANDIDATES = 8;
const vec3 INK = vec3(0.1, 0.075, 0.06);
float hash(vec2 p) { p = fract(p * vec2(123.34, 456.21)); p += dot(p, p + 45.32); return fract(p.x * p.y); }
float noise(vec2 p) { vec2 i = floor(p), f = fract(p); vec2 u = f * f * (3.0 - 2.0 * f); return mix(mix(hash(i), hash(i + vec2(1, 0)), u.x), mix(hash(i + vec2(0, 1)), hash(i + vec2(1, 1)), u.x), u.y); }
float fbm(vec2 p) { float s = 0.0, a = 0.5; for (int i = 0; i < 4 + uNoUnroll; i++) { s += a * noise(p); p *= 2.03; a *= 0.5; } return s; }
vec2 hash2(vec2 p) { return fract(sin(vec2(dot(p, vec2(127.1, 311.7)), dot(p, vec2(269.5, 183.3)))) * 43758.5453); }
vec3 voronoi(vec2 p) {
  vec2 i = floor(p), f = fract(p);
  float d1 = 9.0, d2 = 9.0;
  vec2 id = vec2(0);
  for (int y = -1; y <= 1 + uNoUnroll; y++) for (int x = -1; x <= 1 + uNoUnroll; x++) {
    vec2 o = vec2(x, y), r = o + hash2(i + o) - f;
    float d = dot(r, r);
    if (d < d1) { d2 = d1; d1 = d; id = i + o; } else if (d < d2) d2 = d;
  }
  return vec3(id, sqrt(d2) - sqrt(d1));
}

struct Piece { vec2 a; vec2 b; float thick; float along; float seed; int style; vec2 reach; int kind; int flags; float swing; };
Piece pieceOf(int index) {
  int first = index * 4;
  vec4 v0 = texelFetch(uPieces, ivec2(first % TEX_W, first / TEX_W), 0);
  vec4 v1 = texelFetch(uPieces, ivec2((first + 1) % TEX_W, (first + 1) / TEX_W), 0);
  vec4 v2 = texelFetch(uPieces, ivec2((first + 2) % TEX_W, (first + 2) / TEX_W), 0);
  vec4 v3 = texelFetch(uPieces, ivec2((first + 3) % TEX_W, (first + 3) / TEX_W), 0);
  return Piece(v0.xy, v0.zw, v1.x, v1.y, v1.z, int(v1.w + 0.5), v2.xy, int(v2.z + 0.5), int(v2.w + 0.5), v3.x);
}
/** Candidatas da casa de p: quantas, e onde começam na lista. */
int candidates(vec2 p, out int start) {
  ivec2 cell = ivec2(floor(p)) - uIndexBox.xy;
  start = 0;
  if (cell.x < 0 || cell.y < 0 || cell.x >= uIndexBox.z || cell.y >= uIndexBox.w) return 0;
  uvec2 entry = texelFetch(uCells, cell, 0).rg;
  start = int(entry.x);
  return int(entry.y);
}
int listAt(int at) { return int(texelFetch(uList, ivec2(at % TEX_W, at / TEX_W), 0).r); }
/** Casas por pixel do aparelho (para o contorno de tinta e a normal com largura em pixels). */
float pixelCells() { return (uScreen.x / uCanvas.x) / (uStage.z * uMapGrid.z); }
/**
 * Aquarela de pedra com o nível de detalhe pelo tamanho do pixel (uvPerCell = quanto a coordenada anda por casa).
 * Leitura com derivada automática dentro de condicional fazia o compilador desenrolar tudo (24 s a rocha).
 */
vec3 sampleStone(sampler2D image, vec2 uv, float uvPerCell) {
  float texels = float(textureSize(image, 0).x) * uvPerCell * pixelCells();
  return textureLod(image, uv, max(0.0, log2(max(texels, 1e-6)))).rgb;
}
/** Luz da face relativa ao chão plano (a do relevo): 1 no plano. */
float relativeShade(vec3 n) {
  float flatLit = max(uLightDir.z, 0.35);
  float flatLight = uAmbientLum + uSunLum * 0.8;
  float shade = (uAmbientLum + uSunLum * 0.8 * max(dot(n, uLightDir), 0.0) / flatLit) / max(flatLight, 0.001);
  return clamp(mix(1.0, shade, max(uLightAmount, 0.5)), 0.3, 1.6);
}
`;

/** Meia largura de cada desenho (em espessuras), das páginas; a rocha e a sebe ondulam. */
const HALF_WIDTH = `
float styleHalf(int style, float t, vec2 p, float along, float seed) {
  if (style == 1) return t * 0.5 * (1.0 + 0.45 + (fbm(vec2(along * 1.3, seed * 70.0)) - 0.5) * 0.9);
  if (style == 4) return t * 0.6;
  if (style == 5) return t * 1.0;
  if (style == 6) return t * 0.45;
  if (style == 7) return t * 0.35;
  if (style == 8) return t * 0.3;
  if (style == 9) return t * 1.1 * (0.8 + fbm(p * 1.3) * 0.5);
  if (style == 10) return t * 0.7;
  return t * 0.5;
}
/** A parede que vence em p (a de maior folga, como nas páginas): w = (ao longo, através, semente, folga). */
struct Hit { bool found; Piece piece; vec4 w; float hw; };
Hit wallAt(vec2 p) {
  Hit best;
  best.found = false;
  best.w = vec4(0.0, 0.0, 0.0, -9.0);
  best.hw = 0.0;
  int start;
  int count = candidates(p, start);
  for (int k = 0; k < CANDIDATES + uNoUnroll; k++) {
    if (k >= count) break;
    Piece piece = pieceOf(listAt(start + k));
    if (piece.kind != 0) continue;
    vec2 d = piece.b - piece.a;
    float len = max(length(d), 1e-6);
    vec2 u = d / len, n = vec2(-u.y, u.x);
    float along = dot(p - piece.a, u), across = dot(p - piece.a, n);
    float hw = styleHalf(piece.style, piece.thick, p, piece.along + along, piece.seed);
    float alongOut = max(-along - piece.reach.x, along - len - piece.reach.y);
    float inside = min(hw - abs(across), -alongOut);
    if (!best.found || inside > best.w.w) {
      best.found = true;
      best.piece = piece;
      best.w = vec4(piece.along + along, across, piece.seed, inside);
      best.hw = hw;
    }
  }
  return best;
}
`;

/**
 * Altura e cor de cada desenho, das páginas (lote a: pedra, rocha, madeira, tijolo; lote b: o resto). Nos trechos:
 * `p` = ponto no mapa (casas), `w` = (ao longo, através, semente, folga), `t` = espessura, `hw` = meia largura; na cor,
 * também `h` = altura. `lotA` = contorno de tinta pela folga e sombra de contato no pé (como no lote a).
 */
interface StyleArt {
  height: string;
  color: string;
  lotA: boolean;
}

const STYLE_ART: Record<WallStyle, StyleArt> = {
  stone: {
    lotA: true,
    height: `
    float row = step(0.0, w.y);
    float blockLen = t * 1.3;
    float fx = fract(w.x / blockLen + row * 0.5);
    float joint = min(min(fx, 1.0 - fx) * blockLen, abs(w.y));
    return 0.6 * (0.86 + 0.14 * smoothstep(0.0, t * 0.08, joint)) * smoothstep(0.0, 0.015, w.w);`,
    color: `
    float row = step(0.0, w.y);
    float blockLen = t * 1.3;
    float j = floor(w.x / blockLen + row * 0.5);
    vec3 col = sampleStone(uStone, p * 0.35 + vec2(j * 0.37, row), 0.35) * vec3(1.05, 1.02, 0.96);
    col *= 0.82 + 0.3 * hash(vec2(j, row + w.z * 13.0));
    col *= 0.86 + 0.28 * fbm(p * 14.0);
    if (hash(vec2(j, row + 3.0)) < 0.18) col = mix(col, vec3(0.36, 0.45, 0.24), 0.45 * smoothstep(0.45, 0.7, fbm(p * 6.0)));
    return col;`,
  },
  rock: {
    lotA: true,
    height: `
    float edge = clamp(w.w / (t * 0.5), 0.0, 1.0);
    return 0.75 * pow(edge, 0.5) * (0.8 + fbm(p * 2.5) * 0.4) + (fbm(p * 9.0) - 0.5) * 0.05 * edge;`,
    color: `
    vec3 cell = voronoi(p * 3.0 + vec2(0.0, h * 2.0));
    vec3 col = mix(sampleStone(uStone, p * 0.3 + vec2(0.0, h * 0.35), 0.3), sampleStone(uStone2, p * 0.45, 0.45), 0.35) * vec3(1.1, 1.03, 0.94);
    float layer = fract(h * 5.0 + fbm(p * 0.8) * 0.35);
    col *= 0.9 + 0.3 * hash(cell.xy);
    col += (1.0 - smoothstep(0.0, 0.12, layer)) * 0.12;
    col *= 1.0 - smoothstep(0.75, 1.0, layer) * 0.18;
    col *= 0.84 + 0.32 * fbm(p * 13.0);
    col = mix(col, col * 1.35, step(0.95, hash(floor(p * 52.0))) * 0.7);
    col *= 1.0 - (1.0 - smoothstep(0.01, 0.05, cell.z)) * 0.35;
    return col;`,
  },
  wood: {
    lotA: true,
    height: `
    float rowH = t / 3.0;
    float fy = fract((w.y + t * 0.5) / rowH);
    float r = floor((w.y + t * 0.5) / rowH);
    float plankLen = t * (3.5 + hash(vec2(floor(w.x / (t * 3.5)), r)) * 2.0);
    float fx = fract(w.x / plankLen + r * 0.37);
    float round_ = 1.0 - pow(abs(fy - 0.5) * 2.0, 3.0) * 0.25;
    float gap = smoothstep(0.0, 0.04, min(fy, 1.0 - fy)) * smoothstep(0.0, 0.02, min(fx, 1.0 - fx));
    return 0.6 * (0.85 + 0.15 * gap) * round_ * smoothstep(0.0, 0.015, w.w);`,
    color: `
    float rowH = t / 3.0;
    float r = floor((w.y + t * 0.5) / rowH);
    float plankLen = t * (3.5 + hash(vec2(floor(w.x / (t * 3.5)), r)) * 2.0);
    float id = floor(w.x / plankLen + r * 0.37);
    vec3 wood = mix(vec3(0.55, 0.36, 0.18), vec3(0.45, 0.28, 0.13), hash(vec2(id, r)));
    float grain = sin((w.x * 22.0 + fbm(vec2(w.x * 1.5, w.y * 30.0 + r)) * 6.0)) * 0.5 + 0.5;
    wood *= 0.85 + 0.2 * grain * fbm(vec2(w.x * 3.0, w.y * 40.0));
    wood *= 0.88 + 0.24 * fbm(p * 16.0);
    float fx = fract(w.x / plankLen + r * 0.37);
    float nail = 1.0 - smoothstep(0.012, 0.02, length(vec2(min(fx, 1.0 - fx) * plankLen - t * 0.12, (fract((w.y + t * 0.5) / rowH) - 0.5) * rowH)));
    return mix(wood, vec3(0.16, 0.16, 0.18), nail);`,
  },
  brick: {
    lotA: true,
    height: `
    float rowH = t / 4.0;
    float r = floor((w.y + t * 0.5) / rowH);
    float bl = t * 0.55;
    float x = w.x / bl + mod(r, 2.0) * 0.5;
    float fx = fract(x), fy = fract((w.y + t * 0.5) / rowH);
    float joint = min(min(fx, 1.0 - fx) * bl, min(fy, 1.0 - fy) * rowH);
    return 0.6 * (0.9 + 0.1 * smoothstep(0.0, t * 0.05, joint)) * smoothstep(0.0, 0.015, w.w);`,
    color: `
    float rowH = t / 4.0;
    float r = floor((w.y + t * 0.5) / rowH);
    float bl = t * 0.55;
    float x = w.x / bl + mod(r, 2.0) * 0.5;
    float fx = fract(x), fy = fract((w.y + t * 0.5) / rowH);
    float joint = min(min(fx, 1.0 - fx) * bl, min(fy, 1.0 - fy) * rowH);
    float k = hash(vec2(floor(x), r));
    vec3 brick = mix(vec3(0.62, 0.3, 0.2), vec3(0.5, 0.23, 0.16), k) * (0.86 + 0.28 * fbm(p * 18.0));
    if (k > 0.9) brick *= 0.7;
    vec3 mortar = vec3(0.78, 0.74, 0.66) * (0.9 + 0.2 * noise(p * 40.0));
    return mix(mortar, brick, smoothstep(0.004, 0.012, joint));`,
  },
  palisade: {
    lotA: false,
    height: `
    float d = 2.0 * hw; float k = floor(w.x / d); vec2 local = vec2(w.x - (k + 0.5) * d, w.y);
    float r = length(local) / hw;
    return r < 1.0 ? 0.85 - r * 0.3 - pow(r, 6.0) * 0.2 : 0.0;`,
    color: `
    float d = 2.0 * hw; float k = floor(w.x / d); vec2 local = vec2(w.x - (k + 0.5) * d, w.y);
    float r = length(local) / hw;
    vec3 wood = mix(vec3(0.6, 0.42, 0.24), vec3(0.5, 0.33, 0.18), hash(vec2(k, w.z * 31.0)));
    wood *= 0.85 + 0.15 * sin(r * 18.0 + noise(local * 30.0) * 3.0);
    wood = mix(wood, vec3(0.28, 0.18, 0.1), smoothstep(0.75, 0.95, r));
    return wood * (0.9 + 0.2 * fbm(p * 20.0));`,
  },
  rampart: {
    lotA: false,
    height: `
    float base = 0.7;
    float merlon = fract(w.x / 0.7);
    if (w.y > hw * 0.3) base = merlon < 0.5 ? 1.0 : 0.72;
    float fx = fract(w.x / 0.35);
    float joint = min(fx, 1.0 - fx) * 0.35;
    return base * (0.94 + 0.06 * smoothstep(0.0, t * 0.05, joint));`,
    color: `
    float row = floor((w.y + hw) / (hw * 0.66));
    float j = floor(w.x / (t * 0.9) + row * 0.5);
    vec3 col = sampleStone(uStone, p * 0.3 + vec2(j * 0.31, row), 0.3) * vec3(1.04, 1.0, 0.94);
    col *= 0.82 + 0.28 * hash(vec2(j, row));
    col *= 0.86 + 0.28 * fbm(p * 14.0);
    bool outer = w.y > hw * 0.3;
    if (outer && fract(w.x / 0.7) < 0.5) col *= 1.12; else col *= 0.82;
    return col;`,
  },
  fence: {
    lotA: false,
    height: `
    float postAt = abs(fract(w.x + 0.5) - 0.5);
    if (postAt < t * 0.25 && abs(w.y) < t * 0.25) return 0.5;
    if (abs(abs(w.y) - t * 0.16) < t * 0.07) return 0.38;
    return 0.0;`,
    color: `
    float postAt = abs(fract(w.x + 0.5) - 0.5);
    vec3 wood = vec3(0.55, 0.38, 0.21) * (0.85 + 0.25 * fbm(vec2(w.x * 4.0, w.y * 40.0)));
    if (postAt < t * 0.25 && abs(w.y) < t * 0.25) wood *= 0.85;
    return wood;`,
  },
  iron: {
    lotA: false,
    height: `
    float postAt = abs(fract(w.x + 0.5) - 0.5);
    if (postAt < t * 0.18 && abs(w.y) < t * 0.18) return 0.75;
    float barAt = abs(fract(w.x / (t * 0.45) + 0.5) - 0.5) * t * 0.45;
    if (length(vec2(barAt, w.y)) < t * 0.06) return 0.62;
    if (abs(w.y) < t * 0.03) return 0.55;
    return 0.0;`,
    color: `
    return vec3(0.2, 0.2, 0.22) * (0.9 + 0.3 * fbm(p * 30.0));`,
  },
  barbed: {
    lotA: false,
    height: `
    float postAt = abs(fract(w.x / 1.5 + 0.5) - 0.5) * 1.5;
    if (length(vec2(postAt, w.y)) < t * 0.18) return 0.48;
    float wire = min(abs(w.y - t * 0.12), abs(w.y + t * 0.12));
    float barb = abs(fract(w.x / 0.16 + 0.5) - 0.5) * 0.16;
    if (wire < 0.012 || (barb < 0.014 && wire < 0.035)) return 0.36;
    return 0.0;`,
    color: `
    float postAt = abs(fract(w.x / 1.5 + 0.5) - 0.5) * 1.5;
    if (length(vec2(postAt, w.y)) < t * 0.18) return vec3(0.45, 0.32, 0.2) * (0.85 + 0.25 * noise(p * 40.0));
    return vec3(0.5, 0.5, 0.52);`,
  },
  hedge: {
    lotA: false,
    height: `
    vec3 clump = voronoi(p * 4.2);
    float dome = 1.0 - smoothstep(0.0, 0.55, length(fract(p * 4.2) - 0.5 - (hash2(clump.xy) - 0.5) * 0.4));
    float edge = clamp(w.w / hw, 0.0, 1.0);
    return 0.62 * pow(edge, 0.45) * (0.85 + 0.15 * dome) + (fbm(p * 18.0) - 0.5) * 0.05;`,
    color: `
    vec3 clump = voronoi(p * 4.2);
    vec3 leaf = mix(vec3(0.2, 0.36, 0.14), vec3(0.3, 0.46, 0.18), hash(clump.xy));
    leaf *= 0.75 + 0.45 * noise(p * 46.0);
    leaf = mix(leaf, vec3(0.45, 0.58, 0.25), step(0.9, noise(p * 60.0)) * 0.6);
    return leaf;`,
  },
  lowstone: {
    lotA: false,
    height: `
    vec3 stone = voronoi(vec2(w.x, w.y * 1.6) * 3.2);
    float gap = smoothstep(0.02, 0.09, stone.z);
    return 0.3 * gap * (0.8 + 0.2 * hash(stone.xy)) * smoothstep(0.0, 0.03, w.w);`,
    color: `
    vec3 stone = voronoi(vec2(w.x, w.y * 1.6) * 3.2);
    vec3 col = sampleStone(uStone, p * 0.4 + hash(stone.xy), 0.4) * mix(vec3(1.05, 1.0, 0.92), vec3(0.85, 0.82, 0.78), hash(stone.xy + 3.0));
    col *= 0.85 + 0.3 * fbm(p * 16.0);
    col = mix(col, vec3(0.34, 0.44, 0.22), smoothstep(0.55, 0.75, fbm(p * 5.0)) * 0.45);
    return col;`,
  },
};

/** Programa de um desenho: desenha só onde a parede que vence é dele (e a tinta do chão encostado nela). */
export function wallStyleFragment(style: WallStyle): string {
  const art = STYLE_ART[style];
  return `${COMMON}${HALF_WIDTH}
const int STYLE = ${WALL_STYLES.indexOf(style)};
float styleHeight(vec2 p, vec4 w, float t, float hw) {
  if (w.w < 0.0) return 0.0;
  ${art.height}
}
vec3 styleColor(vec2 p, vec4 w, float t, float hw, float h) {
  ${art.color}
}
void main() {
  vec2 p = screenCell();
  Hit here = wallAt(p);
  bool mine = here.found && here.piece.style == STYLE;
  float t = here.found ? here.piece.thick : 0.1;
  // A altura é calculada uma vez; a normal e a tinta saem das derivadas (calcular em volta multiplicava o shader).
  // As derivadas vêm antes de descartar: o grupo de 2×2 pixels precisa estar inteiro.
  float h = mine ? max(styleHeight(p, here.w, t, here.hw), 0.0) : 0.0;
  float px = pixelCells();
  vec2 grad = vec2(dFdx(h), -dFdy(h)) / px;
  float edge = fwidth(h);
  if (!mine) discard;
  if (h <= 0.001) {
    // Chão: tinta colada na peça e, nos muros cheios, a sombra de contato no pé.
    float ink = edge > 0.001 ? 0.85 : 0.0;
    float contact = ${art.lotA ? "(1.0 - smoothstep(0.0, t * 0.35, -here.w.w)) * 0.25" : "0.0"};
    float alpha = max(ink, contact);
    if (alpha <= 0.0) discard;
    outColor = vec4(INK * ink, alpha);
    return;
  }
  vec3 n = normalize(vec3(-grad, 1.0));
  vec3 col = styleColor(p, here.w, t, here.hw, h) * relativeShade(n);
  // Contorno de tinta na borda, com largura em pixels.
  float rim = ${art.lotA ? "1.0 - smoothstep(0.0, max(px * 1.6, 0.002), here.w.w)" : "1.0 - smoothstep(0.0, max(length(grad) * px * 2.0, 0.002), h - 0.001)"};
  col = mix(col, INK, rim * 0.9);
  outColor = vec4(col, 1.0);
}`;
}

/**
 * Programa das aberturas (lote c revisado), uma peça por vez (`uPiece`): batentes, folha fina (`LEAF`) com dobradiças e
 * puxador, porta dupla, portão nos desenhos vazados, peitoril, moldura com vidraças e persiana; marcas do mestre
 * (trancada em vermelho com cadeado, secreta tracejada em violeta). Coordenadas locais: x ao longo da dobradiça (0) à
 * outra ponta (`len`), y através.
 */
export const OPENING_FRAGMENT = `${COMMON}
uniform int uPiece;
const float LEAF = 0.055;
/** Ângulo da folha aberta: 80°, como o desenho no canvas. */
const float OPEN_ANGLE = 1.396;
Piece O;
float LEN;
vec2 U, N;
vec2 best;   // x = altura, y = material: 1 pedra, 2 batente de pedra, 3 folha, 4 ferro, 5 vidro, 6 madeira, 7 cerca, 8 peitoril, 9 ferragem, 10 persiana
vec2 leafUV; // na folha que venceu: ao longo (0 a 1) e através
float mark, markKind;
void put(float inside, float h, float m) { if (inside > 0.0 && h > best.x) best = vec2(h, m); }
void putLeaf(vec3 l, float len, float h) { if (l.x > 0.0 && h > best.x) { best = vec2(h, 3.0); leafUV = vec2(l.y / len, l.z); } }
/** Caixa girada a partir da dobradiça: folga até a borda (>0 dentro) e posição (x ao longo, y através). */
vec3 leaf(vec2 q, vec2 hinge, float len, float angle, float half_) {
  vec2 u = vec2(cos(angle), sin(angle)), n = vec2(-u.y, u.x);
  float x = dot(q - hinge, u), y = dot(q - hinge, n);
  return vec3(min(min(x, len - x), half_ - abs(y)), x, y);
}
bool flag(int bit) { return (O.flags / bit) % 2 == 1; }
bool seeThroughStyle() { return O.style >= 6; }
/** Batente com o material do desenho: madeira em madeira e paliçada; pedra no resto. */
float jambMaterial() { return O.style == 2 || O.style == 4 ? 6.0 : 2.0; }
void doorLeaf(vec2 q, vec2 hinge, float len, float angle) {
  vec3 l = leaf(q, hinge, len, angle, LEAF);
  putLeaf(l, len, 0.5);
  vec2 u = vec2(cos(angle), sin(angle)), n = vec2(-u.y, u.x);
  float x = dot(q - hinge, u), y = dot(q - hinge, n);
  if (x > 0.01 && x < 0.16 && abs(y) < LEAF + 0.012) put(1.0, 0.52, 9.0);
  if (length(vec2(x - len * 0.86, abs(y) - LEAF - 0.018)) < 0.022) put(1.0, 0.47, 9.0);
}
vec2 scene(vec2 q) {
  best = vec2(0.0); mark = -1.0; markKind = 0.0;
  float t = O.thick;
  bool double_ = flag(2);
  float angle = flag(1) ? O.swing * OPEN_ANGLE : 0.0;
  if (O.kind == 1 && seeThroughStyle()) {
    // Portão: esteios nas pontas, folha de travessas e ripas.
    float postHalf = t * 0.35;
    float material = O.style == 7 ? 4.0 : 7.0;
    for (int i = 0; i < 2 + uNoUnroll; i++) {
      if (i == 1 && double_) break;
      vec2 d = abs(q - vec2(i == 0 ? 0.0 : LEN, 0.0));
      put(postHalf - max(d.x, d.y), 0.55, material);
    }
    float len = LEN - postHalf * (double_ ? 1.0 : 2.0);
    vec3 l = leaf(q, vec2(postHalf, 0.0), len, angle, t * 0.3);
    if (l.x > 0.0 && (abs(abs(l.z) - t * 0.16) < t * 0.07 || abs(fract(l.y / 0.4 + 0.5) - 0.5) * 0.4 < 0.03)) put(1.0, 0.38, material);
    // Marcas do mestre também no portão (trancado, secreto), em volta da folha.
    markKind = flag(4) ? 1.0 : flag(8) ? 2.0 : 0.0;
    mark = l.x;
    return best;
  }
  float inset = t * 0.6;
  for (int i = 0; i < 2 + uNoUnroll; i++) {
    if (i == 1 && double_) break;
    vec2 d = abs(q - vec2(i == 0 ? 0.0 : LEN, 0.0));
    put(inset - max(d.x, d.y), 0.72, jambMaterial());
  }
  if (O.kind == 1) {
    float len = LEN - inset * (double_ ? 1.0 : 2.0);
    vec3 l = leaf(q, vec2(inset, 0.0), len, angle, LEAF);
    if (flag(8)) put(l.x, 0.6, 1.0); else doorLeaf(q, vec2(inset, 0.0), len, angle);
    markKind = flag(4) ? 1.0 : flag(8) ? 2.0 : 0.0;
    mark = l.x;
    return best;
  }
  // Janela: peitoril na espessura da parede, moldura fina com vidraças e, fechada, a persiana na frente.
  vec2 d = vec2(abs(q.x - LEN * 0.5), abs(q.y));
  float inner = LEN * 0.5 - inset;
  if (d.x < inner) put(t * 0.5 - d.y, 0.34, 8.0);
  if (d.x < inner && d.y < 0.07) {
    float pane = fract((q.x - inset) / 0.16);
    bool mullion = min(pane, 1.0 - pane) * 0.16 < 0.012 || d.y > 0.05;
    put(1.0, mullion ? 0.5 : 0.46, mullion ? 6.0 : 5.0);
  }
  if (flag(16) && d.x < inner && abs(q.y - 0.1) < 0.035) put(1.0, 0.53, 10.0);
  return best;
}
vec3 colorOf(vec2 q, vec2 p, float m) {
  float t = O.thick;
  if (m < 1.5) {
    float row = step(0.0, q.y); float x = q.x / (t * 1.3) + row * 0.5; float j = floor(x);
    vec3 col = sampleStone(uStone, p * 0.35 + vec2(j * 0.37, row), 0.35) * vec3(1.05, 1.02, 0.96) * (0.82 + 0.3 * hash(vec2(j, row)));
    float joint = min(min(fract(x), 1.0 - fract(x)) * t * 1.3, abs(q.y));
    return col * (0.86 + 0.28 * fbm(p * 14.0)) * (0.75 + 0.25 * smoothstep(0.0, 0.015, joint));
  }
  if (m < 2.5) return sampleStone(uStone, p * 0.5 + 3.0, 0.5) * vec3(0.9, 0.88, 0.84) * (0.85 + 0.25 * fbm(p * 16.0));
  if (m < 3.5) {
    // Folha vista de cima: as pontas das tábuas em pé (juntas escuras), veio fino, borda gasta clara.
    float plank = leafUV.x * 6.0;
    float seam = min(fract(plank), 1.0 - fract(plank));
    float id = floor(plank);
    vec3 wood = mix(vec3(0.58, 0.39, 0.2), vec3(0.46, 0.29, 0.14), hash(vec2(id, 4.0 + O.seed * 17.0)));
    wood *= 0.86 + 0.24 * fbm(vec2(leafUV.x * 60.0 + id * 3.0, leafUV.y * 260.0));
    wood *= 0.92 + 0.12 * sin(leafUV.y * 700.0 + fbm(vec2(leafUV.x * 30.0, id)) * 5.0);
    wood = mix(wood * 0.45, wood, smoothstep(0.0, 0.06, seam));
    wood = mix(wood, wood * 1.25, smoothstep(0.7, 1.0, abs(leafUV.y) / LEAF) * 0.6);
    return wood;
  }
  if (m > 8.5 && m < 9.5) {
    vec3 iron = vec3(0.2, 0.2, 0.22) * (0.85 + 0.3 * fbm(p * 90.0));
    return iron + step(0.88, noise(p * 140.0)) * 0.18;
  }
  if (m > 7.5 && m < 8.5) return sampleStone(uStone, p * 0.6 + 7.0, 0.6) * vec3(0.95, 0.93, 0.88) * (0.82 + 0.3 * fbm(p * 22.0));
  if (m > 9.5) {
    // Persiana: tábuas finas lado a lado, veio, juntas.
    float slat = fract(q.x / 0.08);
    vec3 wood = mix(vec3(0.5, 0.33, 0.17), vec3(0.42, 0.27, 0.13), hash(vec2(floor(q.x / 0.08), 2.0)));
    wood *= 0.88 + 0.22 * fbm(vec2(q.x * 40.0, q.y * 300.0));
    return mix(wood * 0.5, wood, smoothstep(0.0, 0.08, min(slat, 1.0 - slat)));
  }
  if (m > 5.5) {
    vec3 wood = vec3(0.55, 0.36, 0.18) * (0.85 + 0.25 * fbm(vec2(q.x * 3.0, q.y * 30.0)));
    wood *= 0.9 + 0.2 * sin(p.x * 40.0 + p.y * 40.0 + fbm(p * 8.0) * 6.0) * 0.5;
    return m > 6.5 ? wood * vec3(1.0, 0.95, 0.9) : wood;
  }
  if (m < 4.5) return vec3(0.22, 0.22, 0.24) * (0.9 + 0.3 * fbm(p * 30.0));
  // Vidro: céu refletido (azul que clareia), reflexo em diagonal e um pouco de sujeira perto da moldura.
  float pane = fract((q.x - t * 0.6) / 0.16);
  vec3 glass = mix(vec3(0.3, 0.42, 0.5), vec3(0.6, 0.74, 0.82), pane);
  float glint = smoothstep(0.82, 1.0, sin((p.x - p.y) * 26.0) * 0.5 + 0.5);
  glass = mix(glass, vec3(0.92, 0.96, 1.0), glint * 0.55);
  float dirt = (1.0 - smoothstep(0.0, 0.25, min(pane, 1.0 - pane))) * fbm(p * 80.0);
  return mix(glass, vec3(0.42, 0.4, 0.34), dirt * 0.45);
}
vec2 local(vec2 p) { return vec2(dot(p - O.a, U), dot(p - O.a, N)); }
void main() {
  O = pieceOf(uPiece);
  vec2 d = O.b - O.a;
  LEN = max(length(d), 1e-6);
  U = d / LEN;
  N = vec2(-U.y, U.x);
  vec2 p = screenCell();
  vec2 q = local(p);
  float px = pixelCells();
  vec2 here = scene(q);
  float h = here.x, m = here.y;
  vec2 grad = vec2(dFdx(h), -dFdy(h)) / px;
  float edge = fwidth(h);
  bool ink = h > 0.001 ? edge > 0.08 : edge > 0.001;
  bool marked = markKind > 0.5 && mark > -0.04;
  if (h <= 0.001 && !ink && !marked) discard;
  vec3 col = vec3(0.0);
  float alpha = 1.0;
  if (h > 0.001) {
    col = colorOf(q, p, m) * relativeShade(normalize(vec3(-grad, 1.0)));
    if (ink) col = mix(col, INK, 0.85);
  } else if (ink) {
    col = INK * 0.85;
    alpha = 0.85;
  } else alpha = 0.0;
  // Marcas do mestre: trancada (contorno vermelho e cadeado), secreta (contorno violeta tracejado, folha translúcida).
  // Contorno em volta da folha fina (por fora), para a madeira continuar visível.
  if (markKind > 0.5 && mark > -0.04 && mark < 0.0) {
    vec3 tint = markKind < 1.5 ? vec3(0.79, 0.29, 0.32) : vec3(0.65, 0.56, 0.84);
    float dash = markKind < 1.5 ? 1.0 : step(0.5, fract((p.x + p.y) * 6.0));
    col = mix(col, tint * max(alpha, 0.9), 0.9 * dash);
    alpha = max(alpha, 0.9 * dash);
  }
  if (markKind > 0.5 && markKind < 1.5 && length(q - vec2(LEN * 0.5, 0.0)) < 0.06) { col = vec3(0.79, 0.29, 0.32); alpha = 1.0; }
  if (markKind > 1.5 && mark > 0.0) col = mix(col, vec3(0.65, 0.56, 0.84) * alpha, 0.25);
  if (alpha <= 0.0) discard;
  outColor = vec4(col, alpha);
}`;
