// Página de teste dos efeitos de área na placa de vídeo (etapa 4, parte 1). Cada área tem uma máscara própria (feita
// uma vez, com níveis menores para a borda macia) e um desenho por tipo, com as partículas calculadas no shader a
// partir do tempo (nada no processador por quadro). Fogo, luz sagrada e eletricidade iluminam o entorno pela luz das
// tochas do app (`lightPolygon`, parado nas paredes); a escuridão apaga a luz. "Hoje": o desenho atual (`drawFx`).
import { lightPolygon, type Segment } from "C:/Users/jorge/Projetos/RpgTabletop/shared/src/index";
import { fogNoiseData } from "C:/Users/jorge/Projetos/RpgTabletop/client/src/map/ground/fogGeometry";
import { drawFx, newFxState, type FxState } from "C:/Users/jorge/Projetos/RpgTabletop/client/src/map/effectFx";
import type { EffectPreset } from "C:/Users/jorge/Projetos/RpgTabletop/shared/src/index";

const COLS = 32;
const ROWS = 20;
const BASE_CELL = 30;

type Kind = "fire" | "water" | "ice" | "toxic" | "darkness" | "web" | "holy" | "electric" | "acid" | "wet" | "steam" | "mud" | "burnt" | "grease" | "plants" | "roots" | "fog" | "custom";
const KIND_INDEX: Record<Kind, number> = { fire: 0, water: 1, ice: 2, toxic: 3, darkness: 4, web: 5, holy: 6, electric: 7, acid: 8, wet: 9, steam: 10, mud: 11, burnt: 12, grease: 13, plants: 14, roots: 15, fog: 16, custom: 17 };
/** Quem acende (cor e força da luz) e quem desenha por cima da luz (brilha sozinho). */
const EMIT: Partial<Record<Kind, { color: [number, number, number]; strength: number; reach: number }>> = {
  fire: { color: [1.0, 0.55, 0.22], strength: 1.5, reach: 5 },
  holy: { color: [1.0, 0.86, 0.55], strength: 1.2, reach: 5 },
  electric: { color: [0.55, 0.8, 1.0], strength: 1.0, reach: 4 },
  toxic: { color: [0.55, 0.9, 0.3], strength: 0.25, reach: 2 },
  acid: { color: [0.7, 0.9, 0.25], strength: 0.25, reach: 2 },
};
const SELF_LIT: Kind[] = ["fire", "holy", "electric"];

type Shape =
  | { kind: "circle"; x: number; y: number; r: number }
  | { kind: "polygon"; points: number[] }
  | { kind: "cells"; cells: [number, number][] };

interface Effect {
  kind: Kind;
  shape: Shape;
  seed: number;
}

/** Cone do 5e (largura = distância), linha de 5 ft, cubo e círculo, em casas. */
function cone(x: number, y: number, angle: number, length: number): Shape {
  const d = [Math.cos(angle), Math.sin(angle)];
  const n = [-d[1], d[0]];
  return { kind: "polygon", points: [x, y, x + d[0] * length + n[0] * length / 2, y + d[1] * length + n[1] * length / 2, x + d[0] * length - n[0] * length / 2, y + d[1] * length - n[1] * length / 2] };
}
function line(x: number, y: number, angle: number, length: number): Shape {
  const d = [Math.cos(angle), Math.sin(angle)];
  const n = [-d[1] * 0.5, d[0] * 0.5];
  return { kind: "polygon", points: [x + n[0], y + n[1], x + d[0] * length + n[0], y + d[1] * length + n[1], x + d[0] * length - n[0], y + d[1] * length - n[1], x - n[0], y - n[1]] };
}

const FEW: Effect[] = [
  { kind: "fire", shape: { kind: "circle", x: 6, y: 6, r: 3 }, seed: 1 },
  { kind: "water", shape: { kind: "cells", cells: [[12, 3], [13, 3], [14, 3], [12, 4], [13, 4], [14, 4], [15, 4], [13, 5], [14, 5], [15, 5], [16, 5], [14, 6], [15, 6]] }, seed: 2 },
  { kind: "ice", shape: { kind: "polygon", points: [20, 3, 26, 3, 26, 8, 20, 8] }, seed: 3 },
  { kind: "toxic", shape: cone(3, 14, -0.3, 7), seed: 4 },
  { kind: "darkness", shape: { kind: "circle", x: 14, y: 14, r: 3 }, seed: 5 },
  { kind: "web", shape: { kind: "polygon", points: [19, 11, 24, 11, 24, 16, 19, 16] }, seed: 6 },
  { kind: "holy", shape: { kind: "circle", x: 28.5, y: 15, r: 2.5 }, seed: 7 },
  { kind: "electric", shape: line(9, 18.5, 0, 9), seed: 8 },
];
/** Os outros 10 tipos, numa grade (5 × 2). */
const OTHERS: Effect[] = (["acid", "wet", "steam", "mud", "burnt", "grease", "plants", "roots", "fog", "custom"] as Kind[]).map((kind, index) => {
  const col = index % 5;
  const row = Math.floor(index / 5);
  const x = 3.5 + col * 6.2;
  const y = 5 + row * 9;
  const shape: Shape = index % 3 === 0 ? { kind: "circle", x, y, r: 2.6 } : index % 3 === 1 ? { kind: "polygon", points: [x - 2.4, y - 2.4, x + 2.4, y - 2.4, x + 2.4, y + 2.4, x - 2.4, y + 2.4] } : cone(x - 2.6, y, 0, 5.2);
  return { kind, shape, seed: index + 30 };
});
/** Pior caso: 40 áreas espalhadas, de todos os tipos. */
const MANY: Effect[] = Array.from({ length: 40 }, (_, index) => {
  const kinds = Object.keys(KIND_INDEX) as Kind[];
  const x = 2 + ((index * 7.3) % 28);
  const y = 2 + ((index * 4.7) % 16);
  return { kind: kinds[index % kinds.length], shape: { kind: "circle", x, y, r: 1.2 + (index % 3) * 0.6 }, seed: index + 10 };
});

/** Uma parede que barra a luz do fogo (em casas) e um caixote, para ver o recorte. */
const WALLS: Segment[] = [
  { x1: 10, y1: 1, x2: 10, y2: 9, seeThrough: false },
  { x1: 2, y1: 10, x2: 9, y2: 10, seeThrough: false },
];

const settings = { look: "new" as "new" | "today", light: "night" as "day" | "night", count: "few" as "few" | "others" | "many", zoom: 1 };

// --- placa de vídeo
const view = document.getElementById("view") as HTMLCanvasElement;
const overlay = document.getElementById("overlay") as HTMLCanvasElement;
const gl = view.getContext("webgl2", { premultipliedAlpha: true, preserveDrawingBuffer: true })!;

function compile(vertex: string, fragment: string): WebGLProgram {
  const program = gl.createProgram()!;
  for (const [type, source] of [
    [gl.VERTEX_SHADER, vertex],
    [gl.FRAGMENT_SHADER, fragment],
  ] as const) {
    const shader = gl.createShader(type)!;
    gl.shaderSource(shader, source);
    gl.compileShader(shader);
    if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(shader) ?? "shader");
    gl.attachShader(program, shader);
  }
  gl.bindAttribLocation(program, 0, "aPos");
  gl.linkProgram(program);
  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(program) ?? "link");
  return program;
}

/** Triângulos em casas para um retângulo do mapa (`uBox`: canto e tamanho, em casas) → alvo. */
const BOX_VS = `#version 300 es
in vec2 aPos;
uniform vec4 uBox;
out vec2 vCell;
void main() {
  vCell = aPos;
  vec2 uv = (aPos - uBox.xy) / uBox.zw;
  gl_Position = vec4(uv * 2.0 - 1.0, 0.0, 1.0);
}`;
const ONE_FS = `#version 300 es
precision highp float;
out vec4 outColor;
uniform vec4 uColor;
void main() { outColor = uColor; }`;

/** Um retângulo do mapa (em casas) na tela. */
const SCREEN_VS = `#version 300 es
in vec2 aPos;
uniform vec2 uOrigin;   // px CSS do canto da tela, no mapa
uniform float uCellPx;
uniform vec2 uSize;     // px CSS da tela
out vec2 vCell;
void main() {
  vCell = aPos;
  vec2 px = aPos * uCellPx - uOrigin;
  gl_Position = vec4(px.x / uSize.x * 2.0 - 1.0, 1.0 - px.y / uSize.y * 2.0, 0.0, 1.0);
}`;

const COMMON = `
uniform sampler2D uNoise, uMask;
uniform vec4 uBox;       // caixa da máscara (casas)
uniform float uTime, uSeed, uCellPx;
float cloudA(vec2 p) { return texture(uNoise, p).r; }
float cloudB(vec2 p) { return texture(uNoise, p).g; }
float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7)) + uSeed * 17.0) * 43758.5453); }
vec2 hash2(vec2 p) { return vec2(hash(p), hash(p + 19.19)); }
/** A área desfocada por ~\`cells\` casas (a máscara tem 8 px por casa). */
float maskAt(vec2 cell, float cells) {
  // um nível menor e 4 leituras em volta (sem os blocos do nível menor numa máscara pequena)
  vec2 uv = (cell - uBox.xy) / uBox.zw;
  float lod = max(0.0, log2(max(1.0, cells * 8.0)) - 1.0);
  vec2 step = vec2(cells * 0.35) / uBox.zw;
  float sum = textureLod(uMask, uv, lod).r * 2.0;
  sum += textureLod(uMask, uv + vec2(step.x, step.y), lod).r + textureLod(uMask, uv + vec2(-step.x, step.y), lod).r;
  sum += textureLod(uMask, uv + vec2(step.x, -step.y), lod).r + textureLod(uMask, uv - step, lod).r;
  return sum / 6.0;
}
`;

/** Os efeitos, um tipo por \`uKind\` (no app, um programa por tipo). Cor pré-multiplicada. */
const EFFECT_FS = `#version 300 es
precision highp float;
in vec2 vCell;
out vec4 outColor;
uniform int uKind;
uniform vec2 uCenter, uRadii;
uniform vec3 uColor;           // cor do efeito (personalizado)   // meio e meia caixa da forma (casas): a ronda da luz sagrada
${COMMON}
/** Borda irregular: a área macia com o limiar mexido pelo ruído (\`rough\` casas). */
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
/** Fagulhas: uma por célula de \`size\` casas, subindo e apagando; brilho em volta do ponto. */
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
}

void main() {
  vec2 c = vCell;
  float t = uTime;
  vec4 col = vec4(0.0);
  if (uKind == 0) {
    // fogo (a base do primeiro, sem cara de lava): labaredas altas e finas que sobem rápido e tremem, com buracos
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
    col = vec4(premul + vec3(1.0, 0.7, 0.3) * spark, max(alpha, spark));
  } else if (uKind == 1) {
    // água: funda no meio, ondulação andando, cáusticas finas e espuma na beira
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
    col = vec4(water * alpha, alpha);
  } else if (uKind == 2) {
    // gelo: superfície lisa e translúcida, reflexo atravessando, rachaduras longas, geada na borda e brilhos
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
    col = vec4(ice * alpha, alpha);
  } else if (uKind == 3) {
    // gás tóxico: nuvem verde que se arrasta e se enrola, transbordando a borda
    vec2 q = c / 8.0;
    vec2 warp = vec2(cloudA(q * 0.5 + vec2(t * 0.015, 0.0)), cloudB(q * 0.5 + vec2(0.0, t * 0.02))) - 0.5;
    float gas = cloudA(q + warp * 1.4 + vec2(t * 0.02, t * 0.008)) * 0.75 + cloudB(q * 1.8 - warp + t * 0.03) * 0.25;
    float area = maskAt(c + warp * 1.6, 1.5);
    float density = smoothstep(0.1, 0.85, area * (0.45 + gas * 0.8));
    vec3 green = mix(vec3(0.32, 0.46, 0.16), vec3(0.6, 0.8, 0.32), smoothstep(0.35, 0.8, gas));
    float alpha = density * 0.62;
    col = vec4(green * alpha, alpha);
  } else if (uKind == 4) {
    // escuridão: breu com fiapos roxos que se mexem e transbordam um pouco
    vec2 q = c / 4.0;
    float smoke = cloudA(q + vec2(t * 0.02, -t * 0.015)) * 0.6 + cloudB(q * 2.0 + vec2(-t * 0.03, t * 0.02)) * 0.4;
    float area = maskAt(c + (vec2(cloudA(q * 0.5 + t * 0.01), cloudB(q * 0.5 - t * 0.01)) - 0.5) * 1.4, 1.0);
    float dark = smoothstep(0.2, 0.7, area * (0.6 + smoke * 0.7));
    vec3 tint = vec3(0.06, 0.03, 0.1) + vec3(0.12, 0.05, 0.2) * smoothstep(0.6, 0.9, smoke) * (1.0 - area);
    float alpha = dark * 0.94;
    col = vec4(tint * alpha, alpha);
  } else if (uKind == 5) {
    // teia: teias de desenho espalhadas (uma a cada ~2,4 casas, de tamanhos e giros diferentes), fios compridos
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
    col = vec4(premul, alpha);
  } else if (uKind == 6) {
    // luz sagrada (como a de hoje): brilho que respira no meio, riscos de luz girando no chão e seis luzinhas
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
    col = vec4(light, alpha);
  } else if (uKind == 7) {
    // eletricidade: arcos que pulam e piscam, com um halo azul
    float area = maskAt(c, 0.6);
    float beat = floor(t * 9.0);
    vec2 q = c / 2.5 + vec2(beat * 0.37, beat * 0.11);
    float arc = smoothstep(0.035, 0.0, abs(cloudA(q) - 0.5)) + smoothstep(0.03, 0.0, abs(cloudB(q * 1.7 + 3.0) - 0.5)) * 0.7;
    float flicker = 0.45 + 0.55 * step(0.3, fract(sin(beat * 12.9898) * 43758.5453));
    float halo = smoothstep(0.1, 0.9, area) * 0.25;
    vec3 blue = vec3(0.6, 0.85, 1.0) * (arc * flicker * area) + vec3(0.3, 0.55, 1.0) * halo;
    col = vec4(blue, clamp(arc * flicker * area + halo, 0.0, 1.0));
  } else if (uKind == 8) {
    // ácido: poça verde-amarela que ferve; bolhas que crescem e estouram; vapor fraco por cima
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
    col = vec4(acid * alpha, alpha);
  } else if (uKind == 9) {
    // solo molhado: o chão escurecido, um reflexo leve andando e ondinhas raras (pingos)
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
    col = vec4(wet * alpha, alpha);
  } else if (uKind == 10) {
    // vapor: nuvem branca que sobe e se desfaz, transbordando a borda
    vec2 q = c / 6.0;
    vec2 warp = vec2(cloudA(q * 0.6 + vec2(0.0, t * 0.05)), cloudB(q * 0.6 - vec2(t * 0.03, 0.0))) - 0.5;
    float puff = cloudA(q + warp * 1.3 + vec2(t * 0.01, t * 0.09)) * 0.7 + cloudB(q * 2.2 + warp + vec2(0.0, t * 0.15)) * 0.3;
    float area = maskAt(c + warp * 1.5, 1.4);
    float density = smoothstep(0.12, 0.8, area * (0.45 + puff * 0.8));
    vec3 white = mix(vec3(0.78, 0.82, 0.86), vec3(0.97), smoothstep(0.4, 0.8, puff));
    float alpha = density * 0.62;
    col = vec4(white * alpha, alpha);
  } else if (uKind == 11) {
    // lama: marrom grosso e úmido, brilho onde a superfície sobe, bolhas lentas e grandes
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
    col = vec4(mud * alpha, alpha);
  } else if (uKind == 12) {
    // chão chamuscado: preto queimado com manchas de cinza e brasas que acendem e apagam devagar
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
    col = vec4(burnt * alpha, max(alpha, ember * area));
  } else if (uKind == 13) {
    // graxa: mancha escura, lisa e brilhante; um arco-íris fraco só em fios finos de óleo, escorrendo devagar
    float area = edgeOf(c, 0.35, 0.35, 0.0);
    vec2 q = c / 5.0;
    float flow = cloudA(q + vec2(t * 0.012, t * 0.008)) * 0.75 + cloudB(q * 1.8 - t * 0.008) * 0.25;
    float band = smoothstep(0.02, 0.0, abs(fract(flow * 3.0) - 0.5) - 0.2);
    vec3 rainbow = 0.5 + 0.5 * cos(6.28 * (flow * 1.5 + t * 0.015 + vec3(0.0, 0.33, 0.67)));
    float shine = smoothstep(0.7, 0.9, cloudB(q * 0.7 + vec2(0.3, 0.1)));
    vec3 grease = vec3(0.07, 0.06, 0.045) + rainbow * band * 0.08 + vec3(0.35, 0.33, 0.3) * shine * 0.25;
    float alpha = area * 0.8;
    col = vec4(grease * alpha, alpha);
  } else if (uKind == 14) {
    // plantas: mato cerrado, folhas em tufos que balançam com o vento
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
    col = vec4(premul, alpha);
  } else if (uKind == 15) {
    // raízes: poucas e grossas, compridas, serpenteando devagar, com contorno escuro e um ramo fino
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
    col = vec4(premul, alpha);
  } else if (uKind == 16) {
    // névoa: cinza rente ao chão, grossa, arrastando de lado
    vec2 q = c / 7.0;
    vec2 warp = vec2(cloudA(q * 0.5 + vec2(t * 0.02, 0.0)), cloudB(q * 0.5 + vec2(0.0, t * 0.01))) - 0.5;
    float mist = cloudA(q + warp * 1.2 + vec2(t * 0.04, 0.0)) * 0.7 + cloudB(q * 2.0 + warp + vec2(t * 0.06, 0.0)) * 0.3;
    float area = maskAt(c + warp * 1.4, 1.6);
    float density = smoothstep(0.08, 0.8, area * (0.55 + mist * 0.7));
    vec3 grey = mix(vec3(0.5, 0.54, 0.58), vec3(0.72, 0.75, 0.78), smoothstep(0.4, 0.8, mist));
    float alpha = density * 0.6;
    col = vec4(grey * alpha, alpha);
  } else if (uKind == 17) {
    // personalizado: brilho na cor escolhida, girando devagar, com pontinhos
    float area = maskAt(c, 1.0);
    vec2 q = c / 4.0;
    float swirl = cloudA(q + vec2(t * 0.03, -t * 0.02)) * 0.6 + cloudB(q * 2.0 + t * 0.04) * 0.4;
    float glow = smoothstep(0.05, 0.9, area) * (0.45 + 0.55 * swirl);
    float mote = sparks(c, 0.6, 0.3, t) * smoothstep(0.1, 0.5, area);
    vec3 color = uColor * glow * 0.8 + mix(uColor, vec3(1.0), 0.6) * mote;
    col = vec4(color, clamp(glow * 0.6 + mote, 0.0, 1.0));
  }
  outColor = col;
}`;

/** A luz que o efeito acende (pela área desfocada e, fora dela, caindo com a distância), recortada pelas paredes. */
const EMIT_FS = `#version 300 es
precision highp float;
in vec2 vCell;
out vec4 outColor;
uniform vec3 uLightColor;
uniform float uStrength, uReach;
uniform vec2 uCenter;   // meio da área (casas)
uniform float uRadius;  // raio aproximado da área (casas)
uniform int uFlicker;    // 0 calmo, 1 fogo, 2 eletricidade
${COMMON}
void main() {
  // dentro e perto da área, pela área desfocada; mais longe, caindo com a distância ao meio (sem blocos)
  float near = maskAt(vCell, 1.0);
  float dist = max(0.0, distance(vCell, uCenter) - uRadius);
  float far = pow(clamp(1.0 - dist / uReach, 0.0, 1.0), 2.0);
  float glow = clamp(near * 0.6 + far * 0.9, 0.0, 1.0);
  float flicker = uFlicker == 1 ? 0.85 + 0.15 * cloudA(vec2(uTime * 0.7, uSeed)) : uFlicker == 2 ? 0.6 + 0.4 * step(0.3, fract(sin(floor(uTime * 9.0) * 12.98) * 437.5)) : 1.0;
  outColor = vec4(uLightColor * glow * uStrength * flicker, 1.0);
}`;

/** A escuridão apaga a luz: multiplica o mapa de luz. */
const DARK_FS = `#version 300 es
precision highp float;
in vec2 vCell;
out vec4 outColor;
${COMMON}
void main() {
  float area = smoothstep(0.15, 0.6, maskAt(vCell, 0.8));
  outColor = vec4(vec3(1.0 - 0.93 * area), 1.0);
}`;

/** Chão (canvas) × luz; por cima, o que brilha sozinho. */
const FULL_VS = `#version 300 es
in vec2 aPos;
out vec2 vUv;
void main() { vUv = aPos * 0.5 + 0.5; gl_Position = vec4(aPos, 0.0, 1.0); }`;
const COMPOSE_FS = `#version 300 es
precision highp float;
in vec2 vUv;
out vec4 outColor;
uniform sampler2D uScene, uLight;
void main() {
  vec3 scene = texture(uScene, vUv).rgb;
  vec3 light = texture(uLight, vUv).rgb;
  outColor = vec4(scene * light, 1.0);
}`;
const BLIT_FS = `#version 300 es
precision highp float;
in vec2 vUv;
out vec4 outColor;
uniform sampler2D uImage;
void main() { outColor = texture(uImage, vec2(vUv.x, 1.0 - vUv.y)); }`;

const maskProgram = compile(BOX_VS, ONE_FS);
const effectProgram = compile(SCREEN_VS, EFFECT_FS);
const emitProgram = compile(SCREEN_VS, EMIT_FS);
const darkProgram = compile(SCREEN_VS, DARK_FS);
const composeProgram = compile(FULL_VS, COMPOSE_FS);
const blitProgram = compile(FULL_VS, BLIT_FS);
const quad = gl.createBuffer()!;
gl.bindBuffer(gl.ARRAY_BUFFER, quad);
gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, -1, 1, 1, -1, 1, 1]), gl.STATIC_DRAW);
const shapeBuffer = gl.createBuffer()!;

function texture(filter: number, wrap: number): WebGLTexture {
  const tex = gl.createTexture()!;
  gl.bindTexture(gl.TEXTURE_2D, tex);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, filter);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, wrap);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, wrap);
  return tex;
}
const noise = texture(gl.LINEAR_MIPMAP_LINEAR, gl.REPEAT);
gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA8, 256, 256, 0, gl.RGBA, gl.UNSIGNED_BYTE, fogNoiseData(256, 8));
gl.generateMipmap(gl.TEXTURE_2D);
const framebuffer = gl.createFramebuffer()!;

/** Triângulos da forma, em casas. */
function triangles(shape: Shape): number[] {
  if (shape.kind === "circle") {
    const points: number[] = [];
    for (let index = 0; index < 48; index++) {
      const a = (index / 48) * Math.PI * 2;
      const b = ((index + 1) / 48) * Math.PI * 2;
      points.push(shape.x, shape.y, shape.x + Math.cos(a) * shape.r, shape.y + Math.sin(a) * shape.r, shape.x + Math.cos(b) * shape.r, shape.y + Math.sin(b) * shape.r);
    }
    return points;
  }
  if (shape.kind === "polygon") {
    const p = shape.points;
    const points: number[] = [];
    for (let index = 2; index + 3 < p.length; index += 2) points.push(p[0], p[1], p[index], p[index + 1], p[index + 2], p[index + 3]);
    return points;
  }
  return shape.cells.flatMap(([col, row]) => [col, row, col + 1, row, col, row + 1, col, row + 1, col + 1, row, col + 1, row + 1]);
}
function bounds(shape: Shape): [number, number, number, number] {
  const points = triangles(shape);
  let [x0, y0, x1, y1] = [Infinity, Infinity, -Infinity, -Infinity];
  for (let index = 0; index < points.length; index += 2) {
    x0 = Math.min(x0, points[index]);
    y0 = Math.min(y0, points[index + 1]);
    x1 = Math.max(x1, points[index]);
    y1 = Math.max(y1, points[index + 1]);
  }
  return [x0, y0, x1, y1];
}

/** Máscara de cada área, feita uma vez: 8 px por casa, com folga para a luz, e níveis menores. */
interface Ready {
  effect: Effect;
  mask: WebGLTexture;
  box: [number, number, number, number];
  center: { x: number; y: number };
  fx: FxState;
}
const MARGIN = 6;
function prepare(effect: Effect): Ready {
  const [x0, y0, x1, y1] = bounds(effect.shape);
  const box: [number, number, number, number] = [x0 - MARGIN, y0 - MARGIN, x1 - x0 + MARGIN * 2, y1 - y0 + MARGIN * 2];
  const width = Math.ceil(box[2] * 8);
  const height = Math.ceil(box[3] * 8);
  const mask = texture(gl.LINEAR_MIPMAP_LINEAR, gl.CLAMP_TO_EDGE);
  gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA8, width, height, 0, gl.RGBA, gl.UNSIGNED_BYTE, null);
  gl.bindFramebuffer(gl.FRAMEBUFFER, framebuffer);
  gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, mask, 0);
  gl.viewport(0, 0, width, height);
  gl.clearColor(0, 0, 0, 0);
  gl.clear(gl.COLOR_BUFFER_BIT);
  gl.useProgram(maskProgram);
  gl.uniform4f(gl.getUniformLocation(maskProgram, "uBox"), ...box);
  gl.uniform4f(gl.getUniformLocation(maskProgram, "uColor"), 1, 1, 1, 1);
  const points = triangles(effect.shape);
  gl.bindBuffer(gl.ARRAY_BUFFER, shapeBuffer);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(points), gl.STATIC_DRAW);
  gl.enableVertexAttribArray(0);
  gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);
  gl.drawArrays(gl.TRIANGLES, 0, points.length / 2);
  gl.bindFramebuffer(gl.FRAMEBUFFER, null);
  gl.bindTexture(gl.TEXTURE_2D, mask);
  gl.generateMipmap(gl.TEXTURE_2D);
  const center = effect.shape.kind === "circle" ? { x: effect.shape.x, y: effect.shape.y } : { x: (x0 + x1) / 2, y: (y0 + y1) / 2 };
  return { effect, mask, box, center, fx: newFxState() };
}
const readyFew = FEW.map(prepare);
const readyMany = MANY.map(prepare);
const readyOthers = OTHERS.map(prepare);

// --- chão (canvas 2D), alvos e desenho
const images: Record<string, HTMLImageElement> = {};
function loadImage(name: string): Promise<void> {
  return new Promise((done) => {
    const image = new Image();
    image.onload = () => done();
    image.src = name;
    images[name] = image;
  });
}
interface ViewBox {
  cellPx: number;
  originX: number;
  originY: number;
  width: number;
  height: number;
  ratio: number;
}
function viewBox(): ViewBox {
  const ratio = Math.min(2, window.devicePixelRatio || 1);
  const cellPx = BASE_CELL * settings.zoom;
  const width = COLS * BASE_CELL;
  const height = ROWS * BASE_CELL;
  const originX = settings.zoom === 1 ? 0 : 6 * cellPx - width / 2;
  const originY = settings.zoom === 1 ? 0 : 6 * cellPx - height / 2;
  return { cellPx, originX, originY, width, height, ratio };
}
function drawGround(box: ViewBox): HTMLCanvasElement {
  const canvas = document.createElement("canvas");
  canvas.width = box.width * box.ratio;
  canvas.height = box.height * box.ratio;
  const ctx = canvas.getContext("2d")!;
  ctx.scale(box.ratio, box.ratio);
  ctx.translate(-box.originX, -box.originY);
  const s = box.cellPx;
  const pattern = ctx.createPattern(images["grass_01.webp"], "repeat")!;
  pattern.setTransform(new DOMMatrix().scale((s * 4) / 512));
  ctx.fillStyle = pattern;
  ctx.fillRect(0, 0, COLS * s, ROWS * s);
  const dirt = ctx.createPattern(images["dirt_01.webp"], "repeat")!;
  dirt.setTransform(new DOMMatrix().scale((s * 4) / 512));
  ctx.fillStyle = dirt;
  ctx.fillRect(18 * s, 10 * s, 8 * s, 7 * s);
  ctx.strokeStyle = "rgba(0,0,0,0.12)";
  for (let col = 0; col <= COLS; col++) {
    ctx.beginPath();
    ctx.moveTo(col * s, 0);
    ctx.lineTo(col * s, ROWS * s);
    ctx.stroke();
  }
  for (let row = 0; row <= ROWS; row++) {
    ctx.beginPath();
    ctx.moveTo(0, row * s);
    ctx.lineTo(COLS * s, row * s);
    ctx.stroke();
  }
  return canvas;
}

const sceneTex = texture(gl.LINEAR, gl.CLAMP_TO_EDGE);
const lightTex = texture(gl.LINEAR, gl.CLAMP_TO_EDGE);
const groundTex = texture(gl.LINEAR, gl.CLAMP_TO_EDGE);
let targetSize = { width: 0, height: 0 };
let groundKey = "";

function target(tex: WebGLTexture, width: number, height: number) {
  gl.bindFramebuffer(gl.FRAMEBUFFER, framebuffer);
  gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, tex, 0);
  gl.viewport(0, 0, width, height);
}
function bindTexture(program: WebGLProgram, name: string, unit: number, tex: WebGLTexture) {
  gl.activeTexture(gl.TEXTURE0 + unit);
  gl.bindTexture(gl.TEXTURE_2D, tex);
  gl.uniform1i(gl.getUniformLocation(program, name), unit);
}
/** Um retângulo do mapa (em casas) com o programa ligado. */
function drawBox(program: WebGLProgram, box: ViewBox, ready: Ready, time: number) {
  const [sx0, sy0, sx1, sy1] = bounds(ready.effect.shape);
  const pad = 1.5;
  gl.uniform2f(gl.getUniformLocation(program, "uOrigin"), box.originX, box.originY);
  gl.uniform1f(gl.getUniformLocation(program, "uCellPx"), box.cellPx);
  gl.uniform2f(gl.getUniformLocation(program, "uSize"), box.width, box.height);
  gl.uniform4f(gl.getUniformLocation(program, "uBox"), ...ready.box);
  gl.uniform1f(gl.getUniformLocation(program, "uTime"), time);
  gl.uniform1f(gl.getUniformLocation(program, "uSeed"), ready.effect.seed);
  gl.uniform3f(gl.getUniformLocation(program, "uColor"), 0.72, 0.45, 1.0);
  bindTexture(program, "uNoise", 0, noise);
  bindTexture(program, "uMask", 1, ready.mask);
  const [x, y, w, h] = [sx0 - pad, sy0 - pad, sx1 - sx0 + pad * 2, sy1 - sy0 + pad * 2];
  gl.uniform2f(gl.getUniformLocation(program, "uCenter"), (sx0 + sx1) / 2, (sy0 + sy1) / 2);
  gl.uniform2f(gl.getUniformLocation(program, "uRadii"), ((sx1 - sx0) / 2) * 0.85, ((sy1 - sy0) / 2) * 0.85);
  gl.bindBuffer(gl.ARRAY_BUFFER, shapeBuffer);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([x, y, x + w, y, x, y + h, x, y + h, x + w, y, x + w, y + h]), gl.DYNAMIC_DRAW);
  gl.enableVertexAttribArray(0);
  gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);
  gl.drawArrays(gl.TRIANGLES, 0, 6);
}
/** O leque da luz (paredes param), em casas, com o programa da luz ligado. */
function drawEmitter(box: ViewBox, ready: Ready, time: number) {
  const emit = EMIT[ready.effect.kind];
  if (!emit) return;
  const [sx0, sy0, sx1, sy1] = bounds(ready.effect.shape);
  const radius = Math.max(sx1 - sx0, sy1 - sy0) / 2;
  const reach = radius + emit.reach;
  const polygon = lightPolygon(ready.center, reach, WALLS);
  const points: number[] = [];
  for (let index = 0; index < polygon.length; index += 2) {
    const next = (index + 2) % polygon.length;
    points.push(ready.center.x, ready.center.y, polygon[index], polygon[index + 1], polygon[next], polygon[next + 1]);
  }
  gl.uniform2f(gl.getUniformLocation(emitProgram, "uOrigin"), box.originX, box.originY);
  gl.uniform1f(gl.getUniformLocation(emitProgram, "uCellPx"), box.cellPx);
  gl.uniform2f(gl.getUniformLocation(emitProgram, "uSize"), box.width, box.height);
  gl.uniform4f(gl.getUniformLocation(emitProgram, "uBox"), ...ready.box);
  gl.uniform1f(gl.getUniformLocation(emitProgram, "uTime"), time);
  gl.uniform1f(gl.getUniformLocation(emitProgram, "uSeed"), ready.effect.seed);
  gl.uniform3f(gl.getUniformLocation(emitProgram, "uLightColor"), ...emit.color);
  gl.uniform1f(gl.getUniformLocation(emitProgram, "uStrength"), emit.strength);
  gl.uniform1f(gl.getUniformLocation(emitProgram, "uReach"), emit.reach);
  gl.uniform2f(gl.getUniformLocation(emitProgram, "uCenter"), ready.center.x, ready.center.y);
  gl.uniform1f(gl.getUniformLocation(emitProgram, "uRadius"), radius * 0.8);
  gl.uniform1i(gl.getUniformLocation(emitProgram, "uFlicker"), ready.effect.kind === "fire" ? 1 : ready.effect.kind === "electric" ? 2 : 0);
  bindTexture(emitProgram, "uNoise", 0, noise);
  bindTexture(emitProgram, "uMask", 1, ready.mask);
  gl.bindBuffer(gl.ARRAY_BUFFER, shapeBuffer);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(points), gl.DYNAMIC_DRAW);
  gl.enableVertexAttribArray(0);
  gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);
  gl.drawArrays(gl.TRIANGLES, 0, points.length / 2);
}

function drawToday(box: ViewBox, list: Ready[], now: number) {
  const ctx = overlay.getContext("2d")!;
  ctx.save();
  ctx.scale(box.ratio, box.ratio);
  ctx.translate(-box.originX, -box.originY);
  const s = box.cellPx;
  for (const ready of list) {
    const { shape } = ready.effect;
    const path = new Path2D();
    const points = triangles(shape);
    for (let index = 0; index < points.length; index += 6) {
      path.moveTo(points[index] * s, points[index + 1] * s);
      path.lineTo(points[index + 2] * s, points[index + 3] * s);
      path.lineTo(points[index + 4] * s, points[index + 5] * s);
      path.closePath();
    }
    const [x0, y0, x1, y1] = bounds(shape);
    ctx.save();
    ctx.clip(path);
    drawFx(ctx, ready.effect.kind as EffectPreset, "#ffffff", ready.fx, { box: { x: x0 * s, y: y0 * s, w: (x1 - x0) * s, h: (y1 - y0) * s }, inside: (x, y) => ctx.isPointInPath(path, x * box.ratio, y * box.ratio) }, s, now);
    ctx.restore();
  }
  ctx.restore();
}

function drawWalls(box: ViewBox) {
  const ctx = overlay.getContext("2d")!;
  ctx.save();
  ctx.scale(box.ratio, box.ratio);
  ctx.translate(-box.originX, -box.originY);
  ctx.strokeStyle = "#3b3128";
  ctx.lineWidth = box.cellPx * 0.25;
  ctx.lineCap = "round";
  for (const wall of WALLS) {
    ctx.beginPath();
    ctx.moveTo(wall.x1 * box.cellPx, wall.y1 * box.cellPx);
    ctx.lineTo(wall.x2 * box.cellPx, wall.y2 * box.cellPx);
    ctx.stroke();
  }
  ctx.restore();
}

const frames: number[] = [];
const gpuTimes: number[] = [];
function frame(now: number) {
  const started = performance.now();
  const box = viewBox();
  for (const canvas of [view, overlay]) {
    canvas.style.width = `${box.width}px`;
    canvas.style.height = `${box.height}px`;
    if (canvas.width !== box.width * box.ratio) canvas.width = box.width * box.ratio;
    if (canvas.height !== box.height * box.ratio) canvas.height = box.height * box.ratio;
  }
  const width = view.width;
  const height = view.height;
  const key = `${settings.zoom}|${box.ratio}`;
  if (key !== groundKey) {
    gl.bindTexture(gl.TEXTURE_2D, groundTex);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA8, gl.RGBA, gl.UNSIGNED_BYTE, drawGround(box));
    groundKey = key;
  }
  if (targetSize.width !== width || targetSize.height !== height) {
    for (const tex of [sceneTex, lightTex]) {
      gl.bindTexture(gl.TEXTURE_2D, tex);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA8, width, height, 0, gl.RGBA, gl.UNSIGNED_BYTE, null);
    }
    targetSize = { width, height };
  }
  const time = now / 1000;
  const list = settings.count === "many" ? readyMany : settings.count === "others" ? readyOthers : readyFew;
  const night = settings.light === "night";
  // 1. cena: chão e efeitos que não brilham sozinhos
  target(sceneTex, width, height);
  gl.disable(gl.BLEND);
  gl.useProgram(blitProgram);
  bindTexture(blitProgram, "uImage", 0, groundTex);
  gl.bindBuffer(gl.ARRAY_BUFFER, quad);
  gl.enableVertexAttribArray(0);
  gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);
  gl.drawArrays(gl.TRIANGLES, 0, 6);
  const isNew = settings.look === "new";
  gl.enable(gl.BLEND);
  gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
  if (isNew) {
    gl.useProgram(effectProgram);
    for (const ready of list) {
      if (SELF_LIT.includes(ready.effect.kind)) continue;
      gl.uniform1i(gl.getUniformLocation(effectProgram, "uKind"), KIND_INDEX[ready.effect.kind]);
      drawBox(effectProgram, box, ready, time);
    }
  }
  // 2. luz: a da cena, mais o que os efeitos acendem; a escuridão apaga
  target(lightTex, width, height);
  const ambient = night ? [0.12, 0.14, 0.24] : [1, 1, 1];
  gl.clearColor(ambient[0], ambient[1], ambient[2], 1);
  gl.clear(gl.COLOR_BUFFER_BIT);
  if (isNew) {
    gl.blendFunc(gl.ONE, gl.ONE);
    gl.useProgram(emitProgram);
    if (night) for (const ready of list) drawEmitter(box, ready, time);
    gl.blendFunc(gl.DST_COLOR, gl.ZERO);
    gl.useProgram(darkProgram);
    for (const ready of list) if (ready.effect.kind === "darkness") drawBox(darkProgram, box, ready, time);
  }
  // 3. tela: cena × luz; por cima, o que brilha sozinho
  gl.bindFramebuffer(gl.FRAMEBUFFER, null);
  gl.viewport(0, 0, width, height);
  gl.disable(gl.BLEND);
  gl.useProgram(composeProgram);
  bindTexture(composeProgram, "uScene", 0, sceneTex);
  bindTexture(composeProgram, "uLight", 1, lightTex);
  gl.bindBuffer(gl.ARRAY_BUFFER, quad);
  gl.enableVertexAttribArray(0);
  gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);
  gl.drawArrays(gl.TRIANGLES, 0, 6);
  if (isNew) {
    gl.enable(gl.BLEND);
    gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
    gl.useProgram(effectProgram);
    for (const ready of list) {
      if (!SELF_LIT.includes(ready.effect.kind)) continue;
      gl.uniform1i(gl.getUniformLocation(effectProgram, "uKind"), KIND_INDEX[ready.effect.kind]);
      drawBox(effectProgram, box, ready, time);
    }
    gl.disable(gl.BLEND);
  }
  const ctx = overlay.getContext("2d")!;
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.clearRect(0, 0, overlay.width, overlay.height);
  if (!isNew) drawToday(box, list, now);
  drawWalls(box);
  frames.push(now);
  while (frames.length > 0 && now - frames[0] > 1000) frames.shift();
  const fps = document.getElementById("fps");
  // tempo da placa no quadro (espera ela terminar): o número que importa com o painel fora de foco
  gl.finish();
  const spent = performance.now() - started;
  gpuTimes.push(spent);
  if (gpuTimes.length > 60) gpuTimes.shift();
  const average = gpuTimes.reduce((sum, value) => sum + value, 0) / gpuTimes.length;
  if (fps) fps.textContent = `${frames.length} quadros/s · ${average.toFixed(1)} ms por quadro · ${list.length} áreas`;
  requestAnimationFrame(frame);
}

function wire(id: string, apply: (value: string) => void) {
  const group = document.getElementById(id)!;
  group.addEventListener("click", (event) => {
    const button = (event.target as HTMLElement).closest("button");
    if (!button) return;
    for (const other of group.querySelectorAll("button")) other.classList.toggle("on", other === button);
    apply(button.dataset.v ?? "");
  });
}
wire("look", (value) => (settings.look = value === "today" ? "today" : "new"));
wire("light", (value) => (settings.light = value === "day" ? "day" : "night"));
wire("count", (value) => (settings.count = value === "many" ? "many" : value === "others" ? "others" : "few"));
wire("zoom", (value) => (settings.zoom = Number(value)));

void Promise.all(["grass_01.webp", "dirt_01.webp"].map(loadImage)).then(() => requestAnimationFrame(frame));
