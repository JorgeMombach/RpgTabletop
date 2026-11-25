// Página de teste da névoa (etapa 3): a visão vem do código do app (as casas de `sightCells`, como o servidor manda, e o
// recorte de `lightPolygon`, como a luz das tochas), e a névoa é desenhada na placa de vídeo. "Hoje" desenha a névoa
// atual do app (`fogTexture` e `buildMask`) para comparar.
import { lightBlockers, lightPolygon, sightCells, type Viewer, type Wall } from "C:/Users/jorge/Projetos/RpgTabletop/shared/src/index";
import { buildMask, fbm, FOG_TILE, fogTexture, type MaskArea } from "C:/Users/jorge/Projetos/RpgTabletop/client/src/map/fogRender";

const COLS = 32;
const ROWS = 20;
const BASE_CELL = 28;
const FEET_PER_CELL = 5;
const VISION_FEET = 60;

type Vision = "cell" | "both" | "line";
type Who = "player" | "gm";

const settings = { vision: "both" as Vision, fog: "new" as "new" | "today", who: "player" as Who, door: false, walk: true, zoom: 1 };

// --- cena: casa de dois cômodos à esquerda, campo com pilares à direita
const walls: Wall[] = [];
let wallCount = 0;
function wall(c1: number, r1: number, c2: number, r2: number, door = false) {
  walls.push({ id: `w${wallCount++}`, from: { col: c1, row: r1 }, to: { col: c2, row: r2 }, ...(door && { door: { open: false } }) });
}
// paredes de fora (com a porta de baixo)
wall(2, 2, 15, 2);
wall(15, 2, 15, 9);
wall(15, 11, 15, 14);
wall(15, 9, 15, 11, true);
wall(2, 2, 2, 14);
wall(2, 14, 6, 14);
wall(7, 14, 15, 14);
wall(6, 14, 7, 14, true);
// parede do meio, com passagem aberta
wall(9, 2, 9, 6);
wall(9, 8, 9, 14);
// pilares no campo
for (const [col, row] of [
  [20, 5],
  [25, 9],
  [21, 13],
  [27, 15],
]) {
  wall(col, row, col + 2, row);
  wall(col + 2, row, col + 2, row + 2);
  wall(col + 2, row + 2, col, row + 2);
  wall(col, row + 2, col, row);
}
const doors = walls.filter((w) => w.door);

/** Área revelada pelo mestre (casas): o canto de cima à direita. */
const REVEALED = { col: 26, row: 1, w: 5, h: 4 };

// --- aliados andando de casa em casa
interface Ally {
  name: string;
  color: string;
  path: [number, number][];
}
const allies: Ally[] = [
  {
    name: "AR",
    color: "#3f7fd0",
    path: [
      [4, 4], [7, 4], [7, 7], [10, 7], [13, 7], [13, 10], [14, 10], [17, 10], [18, 13], [14, 10], [10, 11], [6, 11], [6, 13], [6, 16], [8, 17], [6, 13], [4, 11],
    ],
  },
  {
    name: "LY",
    color: "#4aa36a",
    path: [
      [18, 3], [23, 3], [29, 7], [29, 12], [24, 17], [19, 17], [18, 10],
    ],
  },
];
/** Casas do caminho, uma a uma (o token anda de casa em casa, como no app). */
function steps(path: [number, number][]): [number, number][] {
  const out: [number, number][] = [];
  for (let index = 0; index < path.length; index++) {
    const [c1, r1] = path[index];
    const [c2, r2] = path[(index + 1) % path.length];
    const count = Math.max(Math.abs(c2 - c1), Math.abs(r2 - r1));
    for (let step = 0; step < count; step++) out.push([Math.round(c1 + ((c2 - c1) * step) / count), Math.round(r1 + ((r2 - r1) * step) / count)]);
  }
  return out;
}
const allySteps = allies.map((ally) => steps(ally.path));
let tick = 0;
function allyCells(): [number, number][] {
  return allySteps.map((list, index) => list[(tick + index * 7) % list.length]);
}

// --- visão (como o servidor) e explorado
const explored = new Set<string>();
function visibleCells(): Set<string> {
  const viewers: Viewer[] = allyCells().map(([col, row]) => ({ pos: { col, row }, span: 1, feet: VISION_FEET }));
  const seen = new Set<string>();
  for (const cell of sightCells(viewers, walls, FEET_PER_CELL)) seen.add(`${cell.col},${cell.row}`);
  return seen;
}

// --- chão e paredes (canvas 2D, uma vez por mudança)
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
  // de perto: a porta da casa e o começo do campo no meio
  const originX = settings.zoom === 1 ? 0 : 15 * cellPx - width / 2;
  const originY = settings.zoom === 1 ? 0 : 10 * cellPx - height / 2;
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
  const fill = (name: string, x: number, y: number, w: number, h: number, scale: number) => {
    const pattern = ctx.createPattern(images[name], "repeat")!;
    pattern.setTransform(new DOMMatrix().scale(scale));
    ctx.fillStyle = pattern;
    ctx.fillRect(x, y, w, h);
  };
  fill("grass_01.webp", 0, 0, COLS * s, ROWS * s, (s * 4) / 512);
  fill("dirt_01.webp", 15 * s, 8 * s, 6 * s, 4 * s, (s * 4) / 512);
  fill("stone_01.webp", 2 * s, 2 * s, 13 * s, 12 * s, (s * 3) / 512);
  ctx.strokeStyle = "rgba(0,0,0,0.12)";
  ctx.lineWidth = 1;
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
  ctx.lineCap = "round";
  for (const w of walls) {
    const open = w.door?.open;
    ctx.strokeStyle = w.door ? "#8a5a2b" : "#3b3128";
    ctx.lineWidth = s * (w.door ? 0.18 : 0.26);
    ctx.beginPath();
    if (open) {
      // porta aberta: a folha girada para dentro
      ctx.moveTo(w.from.col * s, w.from.row * s);
      const vertical = w.from.col === w.to.col;
      ctx.lineTo(w.from.col * s + (vertical ? -1 : 0) * s, w.from.row * s + (vertical ? 0 : -1) * s);
    } else {
      ctx.moveTo(w.from.col * s, w.from.row * s);
      ctx.lineTo(w.to.col * s, w.to.row * s);
    }
    ctx.stroke();
  }
  return canvas;
}

// --- placa de vídeo
const view = document.getElementById("view") as HTMLCanvasElement;
const overlay = document.getElementById("overlay") as HTMLCanvasElement;
const gl = view.getContext("webgl2", { premultipliedAlpha: false, preserveDrawingBuffer: true })!;

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

/** Recorte da linha de visão: o leque de cada aliado, em casas, no alvo da metade da tela. */
const SIGHT_VS = `#version 300 es
in vec2 aPos;
uniform vec2 uOrigin;
uniform float uCellPx;
uniform vec2 uSize;
void main() {
  vec2 px = aPos * uCellPx - uOrigin;
  gl_Position = vec4(px.x / uSize.x * 2.0 - 1.0, 1.0 - px.y / uSize.y * 2.0, 0.0, 1.0);
}`;
const SIGHT_FS = `#version 300 es
precision highp float;
out vec4 outColor;
void main() { outColor = vec4(1.0); }`;

const FULL_VS = `#version 300 es
in vec2 aPos;
out vec2 vUv;
void main() {
  vUv = aPos * 0.5 + 0.5;
  gl_Position = vec4(aPos, 0.0, 1.0);
}`;

/**
 * A névoa: o que se vê agora (as casas do servidor e/ou o recorte da linha de visão), o revelado pelo mestre e o
 * explorado (casas, com borda arredondada), uma borda que se desfaz em fiapos, e a fumaça em duas camadas torcidas.
 */
const FOG_FS = `#version 300 es
precision highp float;
in vec2 vUv;
out vec4 outColor;
uniform sampler2D uBase, uCells, uSight, uNoise;
uniform vec2 uSize;          // px CSS da tela
uniform vec2 uOrigin;        // px CSS do canto (no mapa)
uniform float uCellPx;
uniform vec2 uGrid;          // casas do mapa
uniform float uTime;
uniform float uSightLod;     // nível da textura da visão com ~0,1 casa de borda
uniform int uVision;         // 0 casa, 1 linha + casa, 2 linha
uniform int uGm, uFog;       // mestre; 0 = sem névoa (só o chão)

/** Ruído pronto (ladrilho de 8 casas que emenda): R e G são duas nuvens diferentes. */
float cloudA(vec2 p) { return texture(uNoise, p).r; }
float cloudB(vec2 p) { return texture(uNoise, p).g; }
/** As casas com a borda redonda: entre os centros, liso (meia casa para cada lado). */
float cellsAt(vec2 cell, int channel) {
  vec4 texel = texture(uCells, cell / uGrid);
  float v = channel == 0 ? texel.r : channel == 1 ? texel.g : texel.b;
  return smoothstep(0.1, 0.9, v);
}
/**
 * A linha de visão (x) e o círculo do alcance sem paredes (y), com a borda macia de \`lod\` (níveis menores da
 * textura) e 8 leituras em volta.
 */
vec2 sightAt(vec2 uv, float lod) {
  vec2 step = exp2(lod) / vec2(textureSize(uSight, 0));
  vec2 sum = textureLod(uSight, uv, lod).rg * 2.0;
  for (int i = 0; i < 8; i++) {
    float a = float(i) * 0.785398;
    sum += textureLod(uSight, uv + vec2(cos(a), sin(a)) * step, lod).rg;
  }
  return sum / 10.0;
}
/**
 * O que se vê agora, pela borda escolhida. Com a linha, as casas só cortam o que ela deixaria (vão até a beira da
 * casa): rente à parede quem manda é a linha, e a fumaça não vaza parede adentro.
 */
float nowAt(vec2 cell, vec2 uv, float lod) {
  if (uVision == 0) return cellsAt(cell, 0);
  float sight = sightAt(uv, lod).x;
  if (uVision == 2) return sight;
  return min(sight, smoothstep(0.2, 0.55, texture(uCells, cell / uGrid).r));
}
void main() {
  vec2 uv = vec2(vUv.x, 1.0 - vUv.y);
  vec2 cell = (uv * uSize + uOrigin) / uCellPx;
  vec3 base = texture(uBase, uv).rgb;
  if (uFog == 0) { outColor = vec4(base, 1.0); return; }
  float t = uTime;
  // a fumaça corre devagar e se torce (1 ladrilho = 8 casas)
  vec2 p = cell / 11.0;
  vec2 flow = vec2(cloudA(p * 0.5 + vec2(t * 0.005, 0.0)), cloudB(p * 0.5 - vec2(0.0, t * 0.004))) - 0.5;
  vec2 q = p + flow * 0.4;
  float big = cloudA(q + vec2(t * 0.007, t * 0.002));
  float mid = cloudB(q * 2.1 - vec2(t * 0.012, -t * 0.005));
  float fine = cloudA(q * 3.1 + vec2(-t * 0.021, t * 0.014));
  float body = big * 0.6 + mid * 0.3 + fine * 0.1;
  // relevo da fumaça: a mesma nuvem um tico deslocada (a luz vem de cima, à esquerda)
  float lit = clamp((big - cloudA(q + vec2(t * 0.007, t * 0.002) + vec2(0.02, 0.03))) * 4.0 + 0.5, 0.0, 1.0);

  // o que se vê: firme (rente à parede) e largo (para saber onde é a borda); o explorado e o revelado pelas casas
  vec2 drift = flow * 1.4;
  float firm = max(nowAt(cell, vUv, uSightLod), cellsAt(cell + drift * 0.5, 2));
  float wide = max(nowAt(cell + drift, vUv, uSightLod + 3.0), cellsAt(cell + drift, 2));
  // explorado: vai até a beira da casa e só se espalha (com o balanço) para o lado do nunca visto; a fumaça
  // escura não vaza para cima do explorado (nem para fora de um pilar fechado)
  float remembered = max(smoothstep(0.2, 0.55, texture(uCells, cell / uGrid).g), cellsAt(cell + drift, 1));
  // perto da borda (até ~1,5 casa), a fumaça avança e recua em fiapos; longe dela, nada muda. Dentro do alcance, a
  // borda é de parede: firme, sem fiapo atravessando (só um respiro)
  float inRange = uVision == 0 ? 0.0 : smoothstep(0.6, 0.95, sightAt(vUv, uSightLod + 3.0).y);
  float loose = mix(1.0, 0.12, inRange);
  float band = 1.0 - abs(wide * 2.0 - 1.0);
  float wisp = (mid * 0.6 + fine * 0.4 - 0.5) * 1.5;
  float clear = clamp(mix(firm, wide, 0.45 * loose) + wisp * band * 0.95 * loose, 0.0, 1.0);
  float fog = smoothstep(0.2, 0.95, 1.0 - clear);                       // qualquer névoa (explorado incluído)
  float unseen = smoothstep(0.2, 0.95, 1.0 - max(clear, remembered));

  vec3 color = base;
  float gray = dot(base, vec3(0.3, 0.55, 0.15));
  if (uGm == 0) {
    // jogador: tinta escura com reflexo violeta; dobras claras, vãos escuros
    vec3 hollow = vec3(4.0, 3.0, 8.0) / 255.0;
    vec3 shade = vec3(30.0, 24.0, 42.0) / 255.0;
    vec3 shine = vec3(96.0, 80.0, 128.0) / 255.0;
    vec3 smoke = mix(hollow, shade, smoothstep(0.2, 0.8, body));
    smoke = mix(smoke, shine, smoothstep(0.5, 0.9, body) * (0.2 + 0.35 * lit));
    // explorado: o mapa lembrado, escuro e sem cor, com um véu da fumaça
    vec3 dim = mix(vec3(gray), base, 0.45) * 0.6;
    vec3 memory = mix(dim, smoke, 0.15 + 0.25 * smoothstep(0.45, 0.8, body));
    color = mix(color, memory, fog);
    color = mix(color, smoke, unseen);
    // a beira da fumaça pega um pouco de luz
    float rim = fog * (1.0 - fog) * 4.0;
    color += shine * rim * 0.18 * smoothstep(0.4, 0.75, body);
  } else {
    // mestre: bruma cinza translúcida
    vec3 mist = mix(vec3(92.0, 88.0, 110.0), vec3(160.0, 156.0, 176.0), smoothstep(0.3, 0.75, body)) / 255.0;
    mist = mix(mist, vec3(232.0, 230.0, 240.0) / 255.0, smoothstep(0.6, 0.9, body) * (0.2 + 0.4 * lit));
    color = mix(color, mix(base, mist, 0.3), fog);
    color = mix(color, mix(base, mist, 0.62), unseen);
  }
  outColor = vec4(color, 1.0);
}`;

const sightProgram = compile(SIGHT_VS, SIGHT_FS);
const fogProgram = compile(FULL_VS, FOG_FS);
const quad = gl.createBuffer()!;
gl.bindBuffer(gl.ARRAY_BUFFER, quad);
gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, -1, 1, 1, -1, 1, 1]), gl.STATIC_DRAW);
const fan = gl.createBuffer()!;

function texture(filter: number): WebGLTexture {
  const tex = gl.createTexture()!;
  gl.bindTexture(gl.TEXTURE_2D, tex);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, filter);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, filter);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
  return tex;
}
const baseTexture = texture(gl.LINEAR);
const cellTexture = texture(gl.LINEAR);
const sightTexture = texture(gl.LINEAR);
gl.bindTexture(gl.TEXTURE_2D, sightTexture);
gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_LINEAR);

/** Ruído pronto, uma vez: duas nuvens (R e G) num ladrilho que emenda, com contraste puxado. */
const NOISE_SIDE = 256;
const noiseTexture = texture(gl.LINEAR);
{
  const data = new Uint8Array(NOISE_SIDE * NOISE_SIDE * 4);
  const period = 8;
  for (let y = 0; y < NOISE_SIDE; y++) {
    for (let x = 0; x < NOISE_SIDE; x++) {
      const at = (y * NOISE_SIDE + x) * 4;
      const u = (x / NOISE_SIDE) * period;
      const v = (y / NOISE_SIDE) * period;
      const stretch = (value: number) => Math.round(Math.min(1, Math.max(0, (value - 0.5) * 1.45 + 0.5)) * 255);
      data[at] = stretch(fbm(u, v, 31, 5, period));
      data[at + 1] = stretch(fbm(u, v, 97, 5, period));
      data[at + 3] = 255;
    }
  }
  gl.bindTexture(gl.TEXTURE_2D, noiseTexture);
  gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA8, NOISE_SIDE, NOISE_SIDE, 0, gl.RGBA, gl.UNSIGNED_BYTE, data);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.REPEAT);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.REPEAT);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_LINEAR);
  gl.generateMipmap(gl.TEXTURE_2D);
}
const sightBuffer = gl.createFramebuffer()!;
let sightSize = { width: 0, height: 0 };

let ground: HTMLCanvasElement | null = null;
let groundKey = "";
let seen = new Set<string>();

function uploadCells() {
  const data = new Uint8Array(COLS * ROWS * 4);
  for (let row = 0; row < ROWS; row++) {
    for (let col = 0; col < COLS; col++) {
      const at = (row * COLS + col) * 4;
      const key = `${col},${row}`;
      data[at] = seen.has(key) ? 255 : 0;
      data[at + 1] = explored.has(key) ? 255 : 0;
      const revealed = col >= REVEALED.col && col < REVEALED.col + REVEALED.w && row >= REVEALED.row && row < REVEALED.row + REVEALED.h;
      data[at + 2] = revealed ? 255 : 0;
      data[at + 3] = 255;
    }
  }
  gl.bindTexture(gl.TEXTURE_2D, cellTexture);
  gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA8, COLS, ROWS, 0, gl.RGBA, gl.UNSIGNED_BYTE, data);
}

function drawSight(box: ViewBox) {
  // metade da resolução da tela, como a luz
  const width = Math.ceil((box.width * box.ratio) / 2);
  const height = Math.ceil((box.height * box.ratio) / 2);
  if (sightSize.width !== width || sightSize.height !== height) {
    gl.bindTexture(gl.TEXTURE_2D, sightTexture);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA8, width, height, 0, gl.RGBA, gl.UNSIGNED_BYTE, null);
    sightSize = { width, height };
  }
  gl.bindFramebuffer(gl.FRAMEBUFFER, sightBuffer);
  gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, sightTexture, 0);
  gl.viewport(0, 0, width, height);
  gl.clearColor(0, 0, 0, 1);
  gl.clear(gl.COLOR_BUFFER_BIT);
  gl.useProgram(sightProgram);
  gl.uniform2f(gl.getUniformLocation(sightProgram, "uOrigin"), box.originX, box.originY);
  gl.uniform1f(gl.getUniformLocation(sightProgram, "uCellPx"), box.cellPx);
  gl.uniform2f(gl.getUniformLocation(sightProgram, "uSize"), box.width, box.height);
  const blockers = lightBlockers(walls);
  // com as casas, o círculo encolhe meia diagonal: tudo dentro dele está numa casa que o servidor manda (borda redonda)
  const reach = VISION_FEET / FEET_PER_CELL + 0.5 - (settings.vision === "both" ? 0.71 : 0);
  gl.bindBuffer(gl.ARRAY_BUFFER, fan);
  gl.enableVertexAttribArray(0);
  gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);
  // R: até onde a linha de visão vai (paredes param); G: o círculo do alcance sem paredes (a borda que não é parede)
  for (const [channel, walled] of [
    [0, true],
    [1, false],
  ] as const) {
    gl.colorMask(channel === 0, channel === 1, false, false);
    for (const [col, row] of allyCells()) {
      const origin = { x: col + 0.5013, y: row + 0.5071 };
      const polygon = lightPolygon(origin, reach, walled ? blockers : []);
      const points = [origin.x, origin.y, ...polygon, polygon[0], polygon[1]];
      gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(points), gl.DYNAMIC_DRAW);
      gl.drawArrays(gl.TRIANGLE_FAN, 0, points.length / 2);
    }
  }
  gl.colorMask(true, true, true, true);
  gl.bindFramebuffer(gl.FRAMEBUFFER, null);
  // níveis menores para a borda macia
  gl.bindTexture(gl.TEXTURE_2D, sightTexture);
  gl.generateMipmap(gl.TEXTURE_2D);
}

let todayMask: ReturnType<typeof buildMask> = null;
function drawToday(box: ViewBox) {
  const ctx = overlay.getContext("2d")!;
  const s = box.cellPx;
  const areas: MaskArea[] = [];
  for (const key of explored) {
    const [col, row] = key.split(",").map(Number);
    areas.push({ rect: { col, row, w: 1, h: 1 }, amount: 0.4 });
  }
  areas.push({ rect: REVEALED, amount: 1 });
  for (const key of seen) {
    const [col, row] = key.split(",").map(Number);
    areas.push({ rect: { col, row, w: 1, h: 1 }, amount: 1 });
  }
  todayMask ??= buildMask(areas, []);
  const mask = todayMask;
  const time = performance.now() / 1000;
  // como o Konva: fumaça num canvas à parte, a máscara fura, e o resultado por cima do chão
  const layer = document.createElement("canvas");
  layer.width = overlay.width;
  layer.height = overlay.height;
  const lctx = layer.getContext("2d")!;
  lctx.scale(box.ratio, box.ratio);
  lctx.translate(-box.originX, -box.originY);
  const tile = (3 * s) / FOG_TILE;
  const look = settings.who === "gm" ? "mist" : "dark";
  const drifts: [number, number][] = [
    [time * 0.06 * s, time * 0.025 * s],
    [-time * 0.11 * s, time * 0.05 * s],
  ];
  ([0, 1] as const).forEach((index) => {
    const pattern = lctx.createPattern(fogTexture(look, index), "repeat")!;
    pattern.setTransform(new DOMMatrix().translate(drifts[index][0], drifts[index][1]).scale(index ? tile * 1.7 : tile));
    lctx.fillStyle = pattern;
    lctx.fillRect(-s * 4, -s * 4, (COLS + 8) * s, (ROWS + 8) * s);
  });
  if (mask) {
    lctx.globalCompositeOperation = "destination-out";
    lctx.imageSmoothingQuality = "high";
    lctx.drawImage(mask.canvas, mask.col * s, mask.row * s, (mask.canvas.width / mask.ppc) * s, (mask.canvas.height / mask.ppc) * s);
  }
  ctx.globalAlpha = settings.who === "gm" ? 0.62 : 1;
  ctx.drawImage(layer, 0, 0);
  ctx.globalAlpha = 1;
}

function drawTokens(box: ViewBox) {
  const ctx = overlay.getContext("2d")!;
  ctx.save();
  ctx.scale(box.ratio, box.ratio);
  ctx.translate(-box.originX, -box.originY);
  const s = box.cellPx;
  allyCells().forEach(([col, row], index) => {
    const x = (col + 0.5) * s;
    const y = (row + 0.5) * s;
    ctx.fillStyle = "rgba(0,0,0,0.45)";
    ctx.beginPath();
    ctx.arc(x + s * 0.04, y + s * 0.06, s * 0.42, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = allies[index].color;
    ctx.strokeStyle = "#d8b878";
    ctx.lineWidth = s * 0.07;
    ctx.beginPath();
    ctx.arc(x, y, s * 0.4, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = "#fff";
    ctx.font = `bold ${Math.round(s * 0.32)}px Segoe UI`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(allies[index].name, x, y + 1);
  });
  ctx.restore();
}

let lastStep = 0;
let lastSight = "";
const frames: number[] = [];
function frame(now: number) {
  const box = viewBox();
  for (const canvas of [view, overlay]) {
    canvas.style.width = `${box.width}px`;
    canvas.style.height = `${box.height}px`;
    if (canvas.width !== box.width * box.ratio) canvas.width = box.width * box.ratio;
    if (canvas.height !== box.height * box.ratio) canvas.height = box.height * box.ratio;
  }
  const key = `${settings.zoom}|${settings.door}|${box.ratio}`;
  if (key !== groundKey) {
    ground = drawGround(box);
    gl.bindTexture(gl.TEXTURE_2D, baseTexture);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA8, gl.RGBA, gl.UNSIGNED_BYTE, ground);
    groundKey = key;
  }
  if (settings.walk && now - lastStep > 650) {
    tick++;
    lastStep = now;
  }
  // a visão só muda quando alguém anda (ou a porta, ou o zoom), como no app
  const sightKey = `${tick}|${key}|${settings.vision}`;
  if (sightKey !== lastSight) {
    seen = visibleCells();
    for (const cell of seen) explored.add(cell);
    uploadCells();
    drawSight(box);
    todayMask = null;
    lastSight = sightKey;
  }
  gl.viewport(0, 0, view.width, view.height);
  gl.useProgram(fogProgram);
  gl.bindBuffer(gl.ARRAY_BUFFER, quad);
  gl.enableVertexAttribArray(0);
  gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);
  const bind = (name: string, unit: number, tex: WebGLTexture) => {
    gl.activeTexture(gl.TEXTURE0 + unit);
    gl.bindTexture(gl.TEXTURE_2D, tex);
    gl.uniform1i(gl.getUniformLocation(fogProgram, name), unit);
  };
  bind("uBase", 0, baseTexture);
  bind("uCells", 1, cellTexture);
  bind("uSight", 2, sightTexture);
  bind("uNoise", 3, noiseTexture);
  // ~0,1 casa de borda na textura da visão (metade da tela)
  gl.uniform1f(gl.getUniformLocation(fogProgram, "uSightLod"), Math.max(0, Math.log2((0.1 * box.cellPx * box.ratio) / 2)));
  gl.uniform2f(gl.getUniformLocation(fogProgram, "uSize"), box.width, box.height);
  gl.uniform2f(gl.getUniformLocation(fogProgram, "uOrigin"), box.originX, box.originY);
  gl.uniform1f(gl.getUniformLocation(fogProgram, "uCellPx"), box.cellPx);
  gl.uniform2f(gl.getUniformLocation(fogProgram, "uGrid"), COLS, ROWS);
  gl.uniform1f(gl.getUniformLocation(fogProgram, "uTime"), now / 1000);
  gl.uniform1i(gl.getUniformLocation(fogProgram, "uVision"), settings.vision === "cell" ? 0 : settings.vision === "both" ? 1 : 2);
  gl.uniform1i(gl.getUniformLocation(fogProgram, "uGm"), settings.who === "gm" ? 1 : 0);
  gl.uniform1i(gl.getUniformLocation(fogProgram, "uFog"), settings.fog === "new" ? 1 : 0);
  gl.drawArrays(gl.TRIANGLES, 0, 6);
  gl.activeTexture(gl.TEXTURE0);
  const ctx = overlay.getContext("2d")!;
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.clearRect(0, 0, overlay.width, overlay.height);
  if (settings.fog === "today") drawToday(box);
  drawTokens(box);
  frames.push(now);
  while (frames.length > 0 && now - frames[0] > 1000) frames.shift();
  const fps = document.getElementById("ms");
  if (fps) fps.textContent = `${frames.length} quadros/s`;
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
wire("vision", (value) => (settings.vision = value as Vision));
wire("fog", (value) => (settings.fog = value as "new" | "today"));
wire("who", (value) => (settings.who = value as Who));
wire("door", (value) => {
  settings.door = value === "1";
  for (const door of doors) door.door = { open: settings.door };
});
wire("walk", (value) => (settings.walk = value === "1"));
wire("zoom", (value) => (settings.zoom = Number(value)));
wire("reset", () => {
  explored.clear();
  lastSight = "";
});

void Promise.all(["grass_01.webp", "dirt_01.webp", "stone_01.webp"].map(loadImage)).then(() => requestAnimationFrame(frame));
