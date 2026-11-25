// Página de teste das sombras (etapa 2): objetos com o desenho do app (as formas e as cores vêm do código do app) e
// sombras por um mapa de alturas: sol, lua e tochas andando até a luz e vendo se algo mais alto está no caminho.
import { PROP_DEFAULTS, PROP_KINDS, type PropKind } from "C:/Users/jorge/Projetos/RpgTabletop/shared/src/index";
import { PROP_DRAW_FRAGMENT, propBakeFragment } from "C:/Users/jorge/Projetos/RpgTabletop/client/src/map/props/propShader";
import { PROP_EXTENT } from "C:/Users/jorge/Projetos/RpgTabletop/client/src/map/props/propLayout";
import { faceLight, SCENE_LIGHT, type SceneLight } from "C:/Users/jorge/Projetos/RpgTabletop/client/src/map/ground/sceneLight";

type LightName = "day" | "dusk" | "moon" | "night";

const QUAD_VS = `#version 300 es
in vec2 aPos;
uniform vec4 uBox;
uniform vec2 uOrigin;
uniform float uPx;
uniform vec2 uCanvas;
out vec2 vWorld;
void main() {
  vec2 world = mix(uBox.xy, uBox.zw, aPos * 0.5 + 0.5);
  vWorld = world;
  vec2 px = (world - uOrigin) * uPx;
  gl_Position = vec4(px.x / uCanvas.x * 2.0 - 1.0, 1.0 - px.y / uCanvas.y * 2.0, 0.0, 1.0);
}`;

/** A forma do tipo (o programa de assar do app, sem o main) e as cores do desenho do app. */
function objectFragment(kind: PropKind): string {
  const bake = propBakeFragment(kind);
  const head = bake
    .slice(0, bake.indexOf("void main()"))
    .split("\n")
    .filter((line) => !line.startsWith("layout(location") && !line.startsWith("uniform vec3 uSlot") && !line.startsWith("uniform float uReach"))
    .join("\n");
  const draw = PROP_DRAW_FRAGMENT;
  const helpers = draw.slice(draw.indexOf("const vec3 INK"), draw.indexOf("void main()"));
  return `${head}
out vec4 outColor;
in vec2 vWorld;
uniform vec4 uMapGrid;
uniform vec3 uStage;
uniform vec2 uScreen, uCanvas;
uniform sampler2D uLeaves, uStone, uDirt;
uniform vec3 uLightDir;
uniform float uLightAmount, uAmbientLum, uSunLum;
uniform float uTime, uWind;
uniform vec2 uWindDir;
uniform float uAtlas, uPoints;
const vec4 vSlot = vec4(0.0);
${helpers}
uniform vec4 uPlace;
uniform int uMode;   // 0 = cor, 1 = altura
void main() {
  float c = cos(uPlace.w), s = sin(uPlace.w);
  vec2 q = mat2(c, -s, s, c) * (vWorld - uPlace.xy) / uPlace.z;
  Hit o = shapeAt(q);
  float perLocal = devicePerCell() * uPlace.z;
  float px = o.sd * perLocal;
  if (px < -1.0) discard;
  if (uMode == 1) {
    if (o.sd < 0.0) discard;
    outColor = vec4(o.h * uPlace.z / 4.0, 0.0, 0.0, 1.0);
    return;
  }
  float e = 1.0 / perLocal;
  vec2 grad = vec2(shapeAt(q + vec2(e, 0.0)).h - o.h, shapeAt(q + vec2(0.0, e)).h - o.h) / e;
  grad *= min(1.0, 2.5 / max(length(grad), 1e-4));
  vec2 slope = normalize(vec3(-grad, 1.0)).xy;
  vec3 n = vec3(mat2(c, s, -s, c) * slope, sqrt(max(0.0, 1.0 - dot(slope, slope))));
  vec3 color = albedo(o.mat, ${PROP_KINDS.indexOf(kind)}, o.tone, q, vWorld, mod(uSeed, 997.0) + 0.5, n, o.edge);
  float inkWidth = 1.15 * (uCanvas.x / uScreen.x);
  float outer = 1.0 - smoothstep(inkWidth * 0.55, inkWidth * 1.25, px);
  float inner = o.edge < 0.249 ? (1.0 - smoothstep(inkWidth * 0.4, inkWidth * 1.1, o.edge * perLocal)) * 0.55 : 0.0;
  color = mix(color, color * 0.18 + INK, max(outer, inner));
  color *= relativeShade(n);
  float alpha = clamp(px + 0.5, 0.0, 1.0);
  outColor = vec4(color * alpha, alpha);
}`;
}

const GROUND_FS = `#version 300 es
precision highp float;
in vec2 vWorld;
out vec4 outColor;
uniform sampler2D uGrass, uDirt;
uniform float uPx, uDpr;
float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
float noise(vec2 p) { vec2 i = floor(p), f = fract(p); vec2 u = f * f * (3.0 - 2.0 * f); return mix(mix(hash(i), hash(i + vec2(1, 0)), u.x), mix(hash(i + vec2(0, 1)), hash(i + vec2(1, 1)), u.x), u.y); }
void main() {
  vec2 p = vWorld;
  vec3 g = texture(uGrass, p / 8.0).rgb;
  vec3 d = texture(uDirt, p / 8.0).rgb;
  float clearing = smoothstep(4.0, 2.5, length(p - vec2(13.0, 8.0)) + (noise(p * 0.8) - 0.5) * 1.5);
  float yard = smoothstep(0.3, -0.3, max(abs(p.x - 22.5) - 4.0, abs(p.y - 8.0) - 4.5) + (noise(p * 1.1) - 0.5) * 0.8);
  vec3 c = mix(g, d, max(clearing * 0.85, yard));
  vec2 f = min(fract(p), 1.0 - fract(p)) * uPx;
  c = mix(c, c * 0.6, (1.0 - smoothstep(0.4 * uDpr, 1.1 * uDpr, min(f.x, f.y))) * 0.25);
  outColor = vec4(c, 1.0);
}`;

/** Token: anel colorido em volta de um retrato escuro (o de verdade é do Konva); altura = a de uma pessoa. */
const TOKEN_FS = `#version 300 es
precision highp float;
in vec2 vWorld;
out vec4 outColor;
uniform vec3 uToken;   // col, row, raio
uniform vec3 uRing;
uniform int uMode;
uniform float uHeight, uPx;
void main() {
  float d = length(vWorld - uToken.xy);
  float sd = (uToken.z - d) * uPx;
  if (sd < -1.0) discard;
  if (uMode == 1) { if (sd < 0.0) discard; outColor = vec4(uHeight / 4.0, 0.0, 0.0, 1.0); return; }
  float t = d / uToken.z;
  vec3 face = mix(vec3(0.75, 0.62, 0.5), vec3(0.35, 0.28, 0.22), smoothstep(0.0, 0.8, t)) * (1.0 - 0.25 * (vWorld.x - uToken.x + vWorld.y - uToken.y) / uToken.z);
  vec3 color = t > 0.8 ? uRing * (1.1 - 0.4 * (t - 0.8) / 0.2) : face;
  color = mix(color, vec3(0.05), 1.0 - smoothstep(0.6, 1.6, sd));
  float alpha = clamp(sd + 0.5, 0.0, 1.0);
  outColor = vec4(color * alpha, alpha);
}`;

const FULL_VS = `#version 300 es
in vec2 aPos;
out vec2 vUv;
void main() { vUv = aPos * 0.5 + 0.5; gl_Position = vec4(aPos, 0.0, 1.0); }`;

const MAX_TORCHES = 8;

/** Luz: ambiente + sol (ou lua) fora da sombra + tochas fora da sombra, pelo mapa de alturas. */
const LIGHT_FS = `#version 300 es
precision highp float;
in vec2 vUv;
out vec4 outColor;
uniform sampler2D uHeights;
uniform vec2 uOrigin, uView;      // canto (casas) e tamanho da tela em casas
uniform vec3 uAmbient, uSun;
uniform vec2 uSunDir;             // para onde a sombra cai
uniform float uShadowCells;       // comprimento da sombra por casa de altura
uniform int uTorchCount;
uniform vec4 uTorches[${MAX_TORCHES}];   // col, row, altura, alcance
uniform float uTorchSkip[${MAX_TORCHES}];  // raio do portador (tocha do token): ele não faz sombra da própria tocha
uniform float uTime;
uniform float uTorchPower;   // força das tochas pela luz da cena (fraca de dia, cheia à noite)
uniform int uNew;
float heightAt(vec2 world) {
  vec2 uv = (world - uOrigin) / uView;
  if (uv.x < 0.0 || uv.y < 0.0 || uv.x > 1.0 || uv.y > 1.0) return 0.0;
  return texture(uHeights, vec2(uv.x, 1.0 - uv.y)).r * 4.0;
}
void main() {
  vec2 p = uOrigin + vec2(vUv.x, 1.0 - vUv.y) * uView;
  float h0 = heightAt(p);
  // começo dos passos um pouco diferente em cada ponto: a borda da sombra sai macia, sem degraus
  float jitter = fract(52.9829189 * fract(dot(gl_FragCoord.xy, vec2(0.06711056, 0.00583715))));
  vec3 light = uAmbient;
  // sol ou lua: anda até a luz; quem estiver acima do raio faz sombra
  if (uShadowCells > 0.01) {
    float shade = 0.0;
    float reach = 2.6 * uShadowCells;
    for (int i = 0; i < 32; i++) {
      float d = (float(i) + jitter) / 32.0 * reach;
      float ray = h0 + d / uShadowCells;
      float above = heightAt(p - uSunDir * d) - ray;
      shade = max(shade, smoothstep(0.02, 0.02 + 0.04 + d * 0.05, above));
    }
    light += uSun * (1.0 - shade * 0.85);
  }
  for (int t = 0; t < ${MAX_TORCHES}; t++) {
    if (t >= uTorchCount) break;
    vec4 torch = uTorches[t];
    vec2 to = torch.xy - p;
    float dist = length(to);
    if (dist > torch.w) continue;
    float flick = 0.9 + 0.1 * sin(uTime * 13.0 + float(t) * 3.1) * sin(uTime * 7.3 + float(t));
    float fall = pow(1.0 - dist / torch.w, 1.7) * flick;
    float shade = 0.0;
    if (uNew == 1) for (int i = 0; i < 32; i++) {
      float k = (float(i) + jitter) / 33.0;
      float ray = mix(h0, torch.z, k);
      vec2 at = p + to * k;
      float above = length(at - torch.xy) < uTorchSkip[t] ? -1.0 : heightAt(at) - ray;
      // perto da tocha, a sombra é mais nítida; longe, mais macia
      shade = max(shade, smoothstep(0.02, 0.06 + dist * (1.0 - k) * 0.04, above));
    }
    light += vec3(1.0, 0.62, 0.3) * 1.6 * uTorchPower * fall * (1.0 - shade);
  }
  outColor = vec4(light * 0.5, 1.0);
}`;

const FINAL_FS = `#version 300 es
precision highp float;
in vec2 vUv;
out vec4 outColor;
uniform sampler2D uScene, uLight;
uniform vec2 uOrigin, uView;
uniform int uTorchCount;
uniform vec4 uTorches[${MAX_TORCHES}];
uniform float uTime;
void main() {
  vec3 scene = texture(uScene, vUv).rgb;
  vec3 light = texture(uLight, vUv).rgb * 2.0;
  vec3 color = scene * light;
  vec2 p = uOrigin + vec2(vUv.x, 1.0 - vUv.y) * uView;
  for (int t = 0; t < ${MAX_TORCHES}; t++) {
    if (t >= uTorchCount) break;
    float d = length(p - uTorches[t].xy);
    float flick = 0.85 + 0.15 * sin(uTime * 17.0 + float(t));
    color += vec3(1.0, 0.65, 0.25) * exp(-d * d / 0.02) * 1.2 * flick;
    color += vec3(1.0, 0.5, 0.2) * exp(-d * d / 0.4) * 0.12 * flick;
  }
  outColor = vec4(color / (1.0 + 0.1 * color), 1.0);
}`;

interface Item { kind: PropKind; col: number; row: number; size: number; rot: number; seed: number }
interface Walker { ring: [number, number, number]; path: (t: number) => [number, number]; torch: boolean }

const canvas = document.getElementById("view") as HTMLCanvasElement;
const gl = canvas.getContext("webgl2", { antialias: false, premultipliedAlpha: true });
if (!gl) throw new Error("sem WebGL 2");

function compile(type: number, source: string) {
  const shader = gl!.createShader(type)!;
  gl!.shaderSource(shader, source);
  gl!.compileShader(shader);
  if (!gl!.getShaderParameter(shader, gl!.COMPILE_STATUS)) throw new Error(gl!.getShaderInfoLog(shader) ?? "shader");
  return shader;
}
function link(vs: string, fs: string) {
  const program = gl!.createProgram()!;
  gl!.attachShader(program, compile(gl!.VERTEX_SHADER, vs));
  gl!.attachShader(program, compile(gl!.FRAGMENT_SHADER, fs));
  gl!.bindAttribLocation(program, 0, "aPos");
  gl!.linkProgram(program);
  if (!gl!.getProgramParameter(program, gl!.LINK_STATUS)) throw new Error(gl!.getProgramInfoLog(program) ?? "link");
  return program;
}

const quad = gl.createBuffer();
gl.bindBuffer(gl.ARRAY_BUFFER, quad);
gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, -1, 1, 1, -1, 1, 1]), gl.STATIC_DRAW);
gl.enableVertexAttribArray(0);
gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);

// Cena: floresta à esquerda, clareira com fogueira, depósito à direita.
const items: Item[] = [];
let seed = 3;
const add = (kind: PropKind, col: number, row: number, size = 1, rot = 0) => items.push({ kind, col, row, size, rot, seed: (seed += 37) });
const forest: [PropKind, number, number, number][] = [
  ["tree", 2.5, 3, 1.1], ["pine", 5.5, 2.2, 1], ["tree", 3.2, 7, 1], ["bush", 6.5, 5.2, 1], ["pine", 1.8, 10.5, 1.1], ["tree", 6.2, 9.4, 1.2],
  ["bush", 8.4, 3.2, 0.9], ["tree", 9.2, 12.5, 1], ["pine", 4.4, 13, 0.9], ["bush", 7.6, 14.2, 1], ["boulder", 9.6, 5.8, 1], ["stump", 8.6, 10.6, 1],
  ["log", 11.5, 3.6, 1], ["flowers", 10.5, 8.8, 1], ["tallGrass", 15.2, 12.2, 1],
];
for (const [kind, col, row, size] of forest) add(kind, col, row, size, (col * 7) % 6);
const yard: [PropKind, number, number, number, number][] = [
  ["crates", 20, 5, 1, 0.2], ["barrel", 22.2, 4.6, 1, 0], ["barrel", 22.9, 5.4, 1, 1], ["crate", 24.5, 4.8, 1, 0.3], ["table", 22.5, 9, 1, 0],
  ["shelf", 25.6, 7.4, 1, 1.5708], ["sacks", 19.6, 9.6, 1, 0], ["pillar", 20.2, 12.2, 1, 0], ["statue", 25, 11.6, 1, 0], ["cart", 17.2, 5.6, 1, -0.5],
];
for (const [kind, col, row, size, rot] of yard) add(kind, col, row, size, rot);
const below = items.filter((item) => !PROP_DEFAULTS[item.kind].above);
const above = items.filter((item) => PROP_DEFAULTS[item.kind].above);

const walkers: Walker[] = [
  { ring: [0.85, 0.65, 0.3], torch: true, path: (t) => [7 + 3.2 * Math.cos(t * 0.35), 8 + 3.6 * Math.sin(t * 0.35)] },
  { ring: [0.35, 0.55, 0.85], torch: false, path: (t) => [13 + 2.2 * Math.cos(-t * 0.5 + 1), 8 + 2.2 * Math.sin(-t * 0.5 + 1)] },
  { ring: [0.8, 0.3, 0.3], torch: false, path: (t) => [21.5 + 2.6 * Math.sin(t * 0.4), 7 + 1.2 * Math.cos(t * 0.8)] },
];
const FIXED_TORCHES: [number, number, number, number][] = [
  [13, 8, 0.6, 8],      // fogueira (baixa)
  [23.4, 6.6, 1.6, 8],  // tocha na parede do depósito (alta)
];

const kindsUsed = [...new Set(items.map((item) => item.kind))];
const objectPrograms = new Map<PropKind, WebGLProgram>();
const started = performance.now();
for (const kind of kindsUsed) objectPrograms.set(kind, link(QUAD_VS, objectFragment(kind)));
const groundProgram = link(QUAD_VS, GROUND_FS);
const tokenProgram = link(QUAD_VS, TOKEN_FS);
const lightProgram = link(FULL_VS, LIGHT_FS);
const finalProgram = link(FULL_VS, FINAL_FS);
console.log("compilado em", Math.round(performance.now() - started), "ms");

function target(width: number, height: number) {
  const texture = gl!.createTexture()!;
  // numa unidade só dela: as aquarelas ficam nas unidades 0 a 2
  gl!.activeTexture(gl!.TEXTURE7);
  gl!.bindTexture(gl!.TEXTURE_2D, texture);
  gl!.texStorage2D(gl!.TEXTURE_2D, 1, gl!.RGBA8, width, height);
  gl!.texParameteri(gl!.TEXTURE_2D, gl!.TEXTURE_MIN_FILTER, gl!.LINEAR);
  gl!.texParameteri(gl!.TEXTURE_2D, gl!.TEXTURE_MAG_FILTER, gl!.LINEAR);
  gl!.texParameteri(gl!.TEXTURE_2D, gl!.TEXTURE_WRAP_S, gl!.CLAMP_TO_EDGE);
  gl!.texParameteri(gl!.TEXTURE_2D, gl!.TEXTURE_WRAP_T, gl!.CLAMP_TO_EDGE);
  const framebuffer = gl!.createFramebuffer()!;
  gl!.bindFramebuffer(gl!.FRAMEBUFFER, framebuffer);
  gl!.framebufferTexture2D(gl!.FRAMEBUFFER, gl!.COLOR_ATTACHMENT0, gl!.TEXTURE_2D, texture, 0);
  return { texture, framebuffer, width, height };
}

const art: WebGLTexture[] = [];
function loadImage(src: string, unit: number) {
  return new Promise<void>((resolve) => {
    const img = new Image();
    img.onload = () => {
      const texture = gl!.createTexture()!;
      gl!.activeTexture(gl!.TEXTURE0 + unit);
      gl!.bindTexture(gl!.TEXTURE_2D, texture);
      gl!.texImage2D(gl!.TEXTURE_2D, 0, gl!.RGBA, gl!.RGBA, gl!.UNSIGNED_BYTE, img);
      gl!.generateMipmap(gl!.TEXTURE_2D);
      gl!.texParameteri(gl!.TEXTURE_2D, gl!.TEXTURE_MIN_FILTER, gl!.LINEAR_MIPMAP_LINEAR);
      gl!.texParameteri(gl!.TEXTURE_2D, gl!.TEXTURE_WRAP_S, gl!.REPEAT);
      gl!.texParameteri(gl!.TEXTURE_2D, gl!.TEXTURE_WRAP_T, gl!.REPEAT);
      art[unit] = texture;
      resolve();
    };
    img.src = src;
  });
}

const state = { light: "night" as LightName, walking: true, fresh: true, zoom: 1, focus: [14, 8] as [number, number] };
let scene: ReturnType<typeof target> | null = null;
let heights: ReturnType<typeof target> | null = null;
let lightMap: ReturnType<typeof target> | null = null;
let dpr = 1;
const WORLD_COLS = 28;

function resize() {
  dpr = window.devicePixelRatio || 1;
  const width = Math.max(320, window.innerWidth - 34);
  const height = Math.min(720, Math.max(360, window.innerHeight - 150));
  canvas.width = Math.round(width * dpr);
  canvas.height = Math.round(height * dpr);
  canvas.style.width = width + "px";
  canvas.style.height = height + "px";
  scene = target(canvas.width, canvas.height);
  heights = target(Math.ceil(canvas.width / 2), Math.ceil(canvas.height / 2));
  lightMap = target(Math.ceil(canvas.width / 2), Math.ceil(canvas.height / 2));
}

const sceneLight = (name: LightName): SceneLight => (name === "night" ? SCENE_LIGHT.night : SCENE_LIGHT[name]);

function draw(now: number) {
  if (!scene || !heights || !lightMap) return;
  const g = gl!;
  const time = (now - started) / 1000;
  const walkTime = state.walking ? time : 0;
  const px = (canvas.width / WORLD_COLS) * state.zoom;
  const view: [number, number] = [canvas.width / px, canvas.height / px];
  const origin: [number, number] = [state.focus[0] - view[0] / 2, state.focus[1] - view[1] / 2];
  const light = sceneLight(state.light);
  const face = faceLight(light);
  const tokens = walkers.map((walker) => ({ ...walker, at: walker.path(walkTime) }));
  const torches: [number, number, number, number][] = [...FIXED_TORCHES];
  // tocha do token: no centro, acima da cabeça (o token não faz sombra da própria tocha)
  for (const token of tokens) if (token.torch) torches.push([token.at[0], token.at[1], 1.5, 8]);
  const torchSkip = new Float32Array(MAX_TORCHES);
  torches.forEach((_, index) => (torchSkip[index] = index >= FIXED_TORCHES.length ? 0.5 : 0));
  const torchData = new Float32Array(MAX_TORCHES * 4);
  torches.forEach((torch, index) => torchData.set(torch, index * 4));

  const common = (program: WebGLProgram, width: number, height: number, pxPerCell: number) => {
    const u = (name: string) => g.getUniformLocation(program, name);
    g.uniform2f(u("uOrigin"), origin[0], origin[1]);
    g.uniform1f(u("uPx"), pxPerCell);
    g.uniform2f(u("uCanvas"), width, height);
    return u;
  };
  const box = (u: (name: string) => WebGLUniformLocation | null, low: [number, number], high: [number, number]) => g.uniform4f(u("uBox"), low[0], low[1], high[0], high[1]);

  const drawObjects = (list: Item[], mode: number, width: number, height: number, pxPerCell: number) => {
    for (const item of list) {
      const program = objectPrograms.get(item.kind);
      if (!program) continue;
      g.useProgram(program);
      const u = common(program, width, height, pxPerCell);
      const reach = PROP_EXTENT[item.kind] * item.size * 1.42;
      box(u, [item.col - reach, item.row - reach], [item.col + reach, item.row + reach]);
      g.uniform4f(u("uMapGrid"), 0, 0, pxPerCell, 0);
      g.uniform3f(u("uStage"), 0, 0, 1);
      g.uniform2f(u("uScreen"), width, height);
      g.uniform4f(u("uPlace"), item.col, item.row, item.size, item.rot);
      g.uniform1f(u("uSeed"), (item.seed % 997) + 0.5);
      g.uniform1i(u("uMode"), mode);
      g.uniform3f(u("uLightDir"), ...face.direction);
      g.uniform1f(u("uLightAmount"), face.amount);
      g.uniform1f(u("uAmbientLum"), face.ambientLum);
      g.uniform1f(u("uSunLum"), face.sunLum);
      g.uniform1i(u("uLeaves"), 0);
      g.uniform1i(u("uStone"), 1);
      g.uniform1i(u("uDirt"), 2);
      g.drawArrays(g.TRIANGLES, 0, 6);
    }
  };
  const drawTokens = (mode: number, width: number, height: number, pxPerCell: number) => {
    g.useProgram(tokenProgram);
    const u = common(tokenProgram, width, height, pxPerCell);
    for (const token of tokens) {
      box(u, [token.at[0] - 0.5, token.at[1] - 0.5], [token.at[0] + 0.5, token.at[1] + 0.5]);
      g.uniform3f(u("uToken"), token.at[0], token.at[1], 0.42);
      g.uniform3f(u("uRing"), ...token.ring);
      g.uniform1i(u("uMode"), mode);
      g.uniform1f(u("uHeight"), 1.2);
      g.drawArrays(g.TRIANGLES, 0, 6);
    }
  };

  // 1. Cena (cor): chão, objetos de baixo, tokens, copas.
  g.bindFramebuffer(g.FRAMEBUFFER, scene.framebuffer);
  g.viewport(0, 0, scene.width, scene.height);
  g.disable(g.BLEND);
  g.useProgram(groundProgram);
  let u = common(groundProgram, scene.width, scene.height, px);
  box(u, origin, [origin[0] + view[0], origin[1] + view[1]]);
  g.uniform1i(u("uGrass"), 0);
  g.uniform1i(u("uDirt"), 2);
  g.uniform1f(u("uDpr"), dpr);
  g.drawArrays(g.TRIANGLES, 0, 6);
  g.enable(g.BLEND);
  g.blendFunc(g.ONE, g.ONE_MINUS_SRC_ALPHA);
  drawObjects(below, 0, scene.width, scene.height, px);
  drawTokens(0, scene.width, scene.height, px);
  drawObjects(above, 0, scene.width, scene.height, px);

  // 2. Mapa de alturas (meia resolução): a maior altura de cada ponto. "Hoje": sem tokens.
  g.bindFramebuffer(g.FRAMEBUFFER, heights.framebuffer);
  g.viewport(0, 0, heights.width, heights.height);
  g.clearColor(0, 0, 0, 1);
  g.clear(g.COLOR_BUFFER_BIT);
  g.blendEquation(g.MAX);
  drawObjects(items, 1, heights.width, heights.height, px / 2);
  if (state.fresh) drawTokens(1, heights.width, heights.height, px / 2);
  g.blendEquation(g.FUNC_ADD);
  g.disable(g.BLEND);

  // 3. Mapa de luz.
  g.bindFramebuffer(g.FRAMEBUFFER, lightMap.framebuffer);
  g.viewport(0, 0, lightMap.width, lightMap.height);
  g.useProgram(lightProgram);
  u = (name: string) => g.getUniformLocation(lightProgram, name);
  g.activeTexture(g.TEXTURE3);
  g.bindTexture(g.TEXTURE_2D, heights.texture);
  g.uniform1i(u("uHeights"), 3);
  g.uniform2f(u("uOrigin"), origin[0], origin[1]);
  g.uniform2f(u("uView"), view[0], view[1]);
  g.uniform3fv(u("uAmbient"), light.ambient);
  g.uniform3fv(u("uSun"), light.sun);
  g.uniform2f(u("uSunDir"), light.sunDirection[0], light.sunDirection[1]);
  g.uniform1f(u("uShadowCells"), light.shadowCells);
  g.uniform1i(u("uTorchCount"), torches.length);
  g.uniform4fv(u("uTorches"), torchData);
  g.uniform1fv(u("uTorchSkip"), torchSkip);
  g.uniform1f(u("uTorchPower"), light.torch);
  g.uniform1f(u("uTime"), time);
  g.uniform1i(u("uNew"), state.fresh ? 1 : 0);
  g.drawArrays(g.TRIANGLES, 0, 6);

  // 4. Final: cena × luz + chamas.
  g.bindFramebuffer(g.FRAMEBUFFER, null);
  g.viewport(0, 0, canvas.width, canvas.height);
  g.useProgram(finalProgram);
  u = (name: string) => g.getUniformLocation(finalProgram, name);
  g.activeTexture(g.TEXTURE4);
  g.bindTexture(g.TEXTURE_2D, scene.texture);
  g.uniform1i(u("uScene"), 4);
  g.activeTexture(g.TEXTURE5);
  g.bindTexture(g.TEXTURE_2D, lightMap.texture);
  g.uniform1i(u("uLight"), 5);
  g.uniform2f(u("uOrigin"), origin[0], origin[1]);
  g.uniform2f(u("uView"), view[0], view[1]);
  g.uniform1i(u("uTorchCount"), torches.length);
  g.uniform4fv(u("uTorches"), torchData);
  g.uniform1f(u("uTime"), time);
  g.drawArrays(g.TRIANGLES, 0, 6);
}

let last = 0;
let average = 0;
function loop(now: number) {
  draw(now);
  if (last) {
    average = average * 0.92 + (now - last) * 0.08;
    const label = document.getElementById("ms");
    if (label) label.textContent = `${average.toFixed(1)} ms por quadro`;
  }
  last = now;
  requestAnimationFrame(loop);
}

function wire(id: string, apply: (value: string) => void) {
  document.querySelectorAll<HTMLButtonElement>(`#${id} button`).forEach((button) => {
    button.onclick = () => {
      apply(button.dataset.v ?? "");
      document.querySelectorAll<HTMLButtonElement>(`#${id} button`).forEach((other) => other.classList.toggle("on", other === button));
    };
  });
}
wire("light", (value) => (state.light = value as LightName));
wire("walk", (value) => (state.walking = value === "1"));
wire("mode", (value) => (state.fresh = value === "new"));
wire("zoom", (value) => {
  state.zoom = Number(value);
  state.focus = state.zoom > 1 ? [9, 8] : [14, 8];
});

Promise.all([loadImage("grass_01.webp", 0), loadImage("stone_01.webp", 1), loadImage("dirt_01.webp", 2)]).then(() => {
  resize();
  requestAnimationFrame(loop);
});
window.addEventListener("resize", resize);
(window as unknown as { __draw: (now: number) => void; __state: typeof state }).__draw = draw;
(window as unknown as { __state: typeof state }).__state = state;
