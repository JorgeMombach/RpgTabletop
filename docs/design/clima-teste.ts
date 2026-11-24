// Página de teste do clima vivendo no mapa (etapa 4, parte 2). Tudo na placa: a cobertura do chão (molhado e poças,
// neve, areia, folhas pousadas) cresce com o tempo desde o início do clima; as partículas (gotas, flocos, folhas,
// areia, brasas) são calculadas no shader pela posição no mapa e pelo tempo; dentro do cômodo fechado (o telhado),
// nada cai nem cobre. O vento é um só. A tempestade clareia o mapa de luz pelos relâmpagos de hoje (`LightningClock`).
// "Hoje": o clima atual (`WeatherPainter`), na tela.
import { fogNoiseData } from "C:/Users/jorge/Projetos/RpgTabletop/client/src/map/ground/fogGeometry";
import { LightningClock, WeatherPainter } from "C:/Users/jorge/Projetos/RpgTabletop/client/src/map/weatherFx";

const COLS = 32;
const ROWS = 20;
const BASE_CELL = 30;
/** Segundos até a cobertura chegar ao máximo. */
const ACCUMULATE_SECONDS = 120;

type Kind = "rain" | "storm" | "snow" | "fog" | "leaves" | "sand" | "embers";
const KIND_INDEX: Record<Kind, number> = { rain: 0, storm: 1, snow: 2, fog: 3, leaves: 4, sand: 5, embers: 6 };

const settings = { kind: "rain" as Kind, look: "new" as "new" | "today", light: "day" as "day" | "night", wind: 20, speed: 1, intensity: 0.8 };
/** Relógio do clima (segundos desde o início), com o acelerador. */
let clock = 0;
let lastNow = 0;

// --- cena: casa fechada (cômodo com telhado) e uma aberta (só três paredes), caminho de terra
const WALLS: [number, number, number, number][] = [
  [4, 4, 14, 4],
  [14, 4, 14, 12],
  [14, 12, 4, 12],
  [4, 12, 4, 4],
  [19, 5, 27, 5],
  [27, 5, 27, 11],
  [19, 5, 19, 11],
];
/** Cômodo fechado (casas), como os cômodos que `wallRooms` acha. */
const ROOM: [number, number][] = [
  [4, 4],
  [14, 4],
  [14, 12],
  [4, 12],
];
const TOKENS: [number, number, string, string][] = [
  [8, 8, "#3f7fd0", "AR"],
  [22, 14, "#4aa36a", "LY"],
];

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

const FULL_VS = `#version 300 es
in vec2 aPos;
out vec2 vUv;
void main() { vUv = aPos * 0.5 + 0.5; gl_Position = vec4(aPos, 0.0, 1.0); }`;

const ROOF_VS = `#version 300 es
in vec2 aPos;
uniform vec2 uGrid;
void main() { gl_Position = vec4(aPos / uGrid * 2.0 - 1.0, 0.0, 1.0); }`;
const ONE_FS = `#version 300 es
precision highp float;
out vec4 outColor;
void main() { outColor = vec4(1.0); }`;

const COMMON = `
uniform sampler2D uNoise, uRoof;
uniform vec2 uSize, uOrigin, uGrid;
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
/** O telhado (cômodo fechado), macio na borda. */
float roofAt(vec2 cell) { return smoothstep(0.2, 0.8, textureLod(uRoof, cell / uGrid, 2.0).r); }
vec2 cellOf(vec2 uv) { return (vec2(uv.x, 1.0 - uv.y) * uSize + uOrigin) / uCellPx; }
`;

/** A cobertura do chão (cor pré-multiplicada), crescendo com \`uAcc\`. */
const COVER_FS = `#version 300 es
precision highp float;
in vec2 vUv;
out vec4 outColor;
${COMMON}
void main() {
  vec2 c = cellOf(vUv);
  float open = 1.0 - roofAt(c);
  float acc = uAcc * uIntensity;
  vec4 col = vec4(0.0);
  if (uKind == 0 || uKind == 1) {
    // molhado: o chão escurece; poças nas partes baixas, com anéis dos pingos
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
    vec3 water = vec3(0.32, 0.4, 0.48) + vec3(0.5, 0.55, 0.6) * ring * 0.5;
    float wetAlpha = acc * 0.32;
    float puddleAlpha = puddle * 0.75 * smoothstep(0.0, 0.3, acc);
    float alpha = max(wetAlpha, puddleAlpha);
    vec3 premul = mix(vec3(0.03, 0.05, 0.08) * wetAlpha, water * puddleAlpha, puddleAlpha / max(alpha, 0.001));
    col = vec4(premul, alpha);
  } else if (uKind == 2) {
    // neve: manchas brancas que se juntam até cobrir; sombrinha azul nas dobras
    float drift = cloud(c, 6.0) * 0.75 + cloud(c, 2.1) * 0.25;
    float cover = smoothstep(1.0 - acc * 1.1, 1.05 - acc * 1.1, drift + 0.1);
    vec3 snow = mix(vec3(0.78, 0.84, 0.94), vec3(0.97, 0.98, 1.0), smoothstep(0.3, 0.8, drift));
    col = vec4(snow * cover * 0.95, cover * 0.95);
  } else if (uKind == 4) {
    // folhas pousadas: aparecem uma a uma até um tapete ralo
    vec2 g = c / 0.45; vec2 id = floor(g);
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
    vec3 color = mix(vec3(0.75, 0.38, 0.1), vec3(0.85, 0.65, 0.15), tone);
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

/** O que cai ou anda no ar (cor pré-multiplicada); \`uGlow\` 1 desenha só o que brilha sozinho (brasas). */
const AIR_FS = `#version 300 es
precision highp float;
in vec2 vUv;
out vec4 outColor;
uniform int uGlow;
${COMMON}
/** Uma camada de riscos caindo na direção \`fall\`, \`per\` por casa, velocidade \`speed\` casas/s. */
float streaks(vec2 c, vec2 fall, float per, float speed, float len, float width, float seed) {
  vec2 dir = normalize(fall);
  vec2 q = vec2(dot(c, vec2(dir.y, -dir.x)), dot(c, dir)) * per;
  q.y -= uTime * speed * per;
  vec2 id = floor(q); vec2 f = fract(q) - 0.5;
  float h = hash(id + seed);
  if (h > uIntensity * 0.8 + 0.1) return 0.0;
  float x0 = (hash(id + seed + 5.0) - 0.5) * 0.7;
  return smoothstep(width, 0.0, abs(f.x - x0)) * smoothstep(len, 0.0, abs(f.y));
}
/** Pontinhos andando (flocos, brasas), \`per\` por casa, com balanço. */
float dots(vec2 c, vec2 drift, float per, float size, float sway, float seed) {
  vec2 q = c * per - drift * uTime * per;
  vec2 id = floor(q);
  float sum = 0.0;
  for (int y = -1; y <= 1; y++) for (int x = -1; x <= 1; x++) {
    vec2 cid = id + vec2(x, y);
    float h = hash(cid + seed);
    if (h > uIntensity * 0.85 + 0.1) continue;
    vec2 p = cid + 0.5 + (hash2(cid + seed) - 0.5) * 0.8 + vec2(sin(uTime * 1.3 + h * 20.0), cos(uTime * 0.9 + h * 11.0)) * sway;
    sum += smoothstep(size, size * 0.3, length(q - p));
  }
  return sum;
}
void main() {
  vec2 c = cellOf(vUv);
  float open = 1.0 - roofAt(c);
  vec4 col = vec4(0.0);
  vec2 fall = vec2(uWind.x, 1.0);
  if (uGlow == 1) {
    if (uKind == 6) {
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
  if (uKind == 0 || uKind == 1) {
    // chuva: três camadas de riscos (perto, médio, longe) e respingos no chão
    float strong = uKind == 1 ? 1.4 : 1.0;
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
    col = vec4(vec3(0.78, 0.84, 0.92) * a, a);
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
  } else if (uKind == 4) {
    // folhas: voando no sentido do vento, girando
    vec2 drift = vec2(uWind.x * 2.0 + 1.2, 0.5);
    vec2 q = c * 0.9 - drift * uTime * 0.9;
    vec2 id = floor(q);
    float leaf = 0.0; float tone = 0.0;
    for (int y = -1; y <= 1; y++) for (int x = -1; x <= 1; x++) {
      vec2 cid = id + vec2(x, y);
      float h = hash(cid);
      if (h > uIntensity * 0.5 + 0.05) continue;
      vec2 p = cid + 0.5 + (hash2(cid) - 0.5) * 0.7 + vec2(sin(uTime * 2.0 + h * 9.0), cos(uTime * 1.7 + h * 5.0)) * 0.2;
      float a = uTime * (2.0 + h * 3.0) + h * 6.28;
      vec2 r = mat2(cos(a), -sin(a), sin(a), cos(a)) * (q - p);
      float shape = smoothstep(1.0, 0.75, length(r / vec2(0.2, 0.09)));
      if (shape > leaf) { leaf = shape; tone = hash(cid + 7.0); }
    }
    vec3 color = mix(vec3(0.7, 0.32, 0.08), vec3(0.88, 0.62, 0.12), tone);
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

const COMPOSE_FS = `#version 300 es
precision highp float;
in vec2 vUv;
out vec4 outColor;
uniform sampler2D uScene;
uniform vec3 uLight;
uniform float uFlash;
void main() {
  vec3 scene = texture(uScene, vUv).rgb;
  outColor = vec4(scene * (uLight + vec3(0.75, 0.8, 1.0) * uFlash * 1.6), 1.0);
}`;
const BLIT_FS = `#version 300 es
precision highp float;
in vec2 vUv;
out vec4 outColor;
uniform sampler2D uImage;
void main() { outColor = texture(uImage, vec2(vUv.x, 1.0 - vUv.y)); }`;

const roofProgram = compile(ROOF_VS, ONE_FS);
const coverProgram = compile(FULL_VS, COVER_FS);
const airProgram = compile(FULL_VS, AIR_FS);
const composeProgram = compile(FULL_VS, COMPOSE_FS);
const blitProgram = compile(FULL_VS, BLIT_FS);
const quad = gl.createBuffer()!;
gl.bindBuffer(gl.ARRAY_BUFFER, quad);
gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, -1, 1, 1, -1, 1, 1]), gl.STATIC_DRAW);
const framebuffer = gl.createFramebuffer()!;

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

// telhado: o cômodo fechado numa textura de 8 px por casa, com níveis menores
const roof = texture(gl.LINEAR_MIPMAP_LINEAR, gl.CLAMP_TO_EDGE);
{
  gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA8, COLS * 8, ROWS * 8, 0, gl.RGBA, gl.UNSIGNED_BYTE, null);
  gl.bindFramebuffer(gl.FRAMEBUFFER, framebuffer);
  gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, roof, 0);
  gl.viewport(0, 0, COLS * 8, ROWS * 8);
  gl.clearColor(0, 0, 0, 0);
  gl.clear(gl.COLOR_BUFFER_BIT);
  gl.useProgram(roofProgram);
  gl.uniform2f(gl.getUniformLocation(roofProgram, "uGrid"), COLS, ROWS);
  const [a, b, c, d] = ROOM;
  const shape = gl.createBuffer()!;
  gl.bindBuffer(gl.ARRAY_BUFFER, shape);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([...a, ...b, ...c, ...a, ...c, ...d]), gl.STATIC_DRAW);
  gl.enableVertexAttribArray(0);
  gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);
  gl.drawArrays(gl.TRIANGLES, 0, 6);
  gl.bindFramebuffer(gl.FRAMEBUFFER, null);
  gl.bindTexture(gl.TEXTURE_2D, roof);
  gl.generateMipmap(gl.TEXTURE_2D);
}

const images: Record<string, HTMLImageElement> = {};
function loadImage(name: string): Promise<void> {
  return new Promise((done) => {
    const image = new Image();
    image.onload = () => done();
    image.src = name;
    images[name] = image;
  });
}
/** Chão, piso da casa e caminho (canvas 2D) e, à parte, os tokens (vão por cima da cobertura). */
function drawGround(width: number, height: number, ratio: number): { ground: HTMLCanvasElement; tokens: HTMLCanvasElement } {
  const s = BASE_CELL;
  const make = () => {
    const canvas = document.createElement("canvas");
    canvas.width = width * ratio;
    canvas.height = height * ratio;
    const ctx = canvas.getContext("2d")!;
    ctx.scale(ratio, ratio);
    return { canvas, ctx };
  };
  const { canvas: ground, ctx } = make();
  const fill = (name: string, x: number, y: number, w: number, h: number) => {
    const pattern = ctx.createPattern(images[name], "repeat")!;
    pattern.setTransform(new DOMMatrix().scale((s * 4) / 512));
    ctx.fillStyle = pattern;
    ctx.fillRect(x, y, w, h);
  };
  fill("grass_01.webp", 0, 0, COLS * s, ROWS * s);
  fill("dirt_01.webp", 0, 14 * s, COLS * s, 3 * s);
  fill("stone_01.webp", 4 * s, 4 * s, 10 * s, 8 * s);
  fill("stone_01.webp", 19 * s, 5 * s, 8 * s, 6 * s);
  ctx.strokeStyle = "rgba(0,0,0,0.1)";
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
  const { canvas: tokens, ctx: tctx } = make();
  // paredes por cima da cobertura (no app, elas são uma camada própria acima do chão)
  tctx.strokeStyle = "#3b3128";
  tctx.lineWidth = s * 0.26;
  tctx.lineCap = "round";
  for (const [x1, y1, x2, y2] of WALLS) {
    tctx.beginPath();
    tctx.moveTo(x1 * s, y1 * s);
    tctx.lineTo(x2 * s, y2 * s);
    tctx.stroke();
  }
  for (const [col, row, color, name] of TOKENS) {
    const [x, y] = [(col + 0.5) * s, (row + 0.5) * s];
    tctx.fillStyle = "rgba(0,0,0,0.45)";
    tctx.beginPath();
    tctx.arc(x + 2, y + 3, s * 0.42, 0, Math.PI * 2);
    tctx.fill();
    tctx.fillStyle = color;
    tctx.strokeStyle = "#d8b878";
    tctx.lineWidth = s * 0.07;
    tctx.beginPath();
    tctx.arc(x, y, s * 0.4, 0, Math.PI * 2);
    tctx.fill();
    tctx.stroke();
    tctx.fillStyle = "#fff";
    tctx.font = `bold ${Math.round(s * 0.32)}px Segoe UI`;
    tctx.textAlign = "center";
    tctx.textBaseline = "middle";
    tctx.fillText(name, x, y + 1);
  }
  return { ground, tokens };
}

const sceneTex = texture(gl.LINEAR, gl.CLAMP_TO_EDGE);
const groundTex = texture(gl.LINEAR, gl.CLAMP_TO_EDGE);
const tokenTex = texture(gl.LINEAR, gl.CLAMP_TO_EDGE);
let ready = { width: 0, height: 0 };

function bind(program: WebGLProgram, name: string, unit: number, tex: WebGLTexture) {
  gl.activeTexture(gl.TEXTURE0 + unit);
  gl.bindTexture(gl.TEXTURE_2D, tex);
  gl.uniform1i(gl.getUniformLocation(program, name), unit);
}
function fullscreen() {
  gl.bindBuffer(gl.ARRAY_BUFFER, quad);
  gl.enableVertexAttribArray(0);
  gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);
  gl.drawArrays(gl.TRIANGLES, 0, 6);
}
function common(program: WebGLProgram, width: number, height: number) {
  gl.uniform2f(gl.getUniformLocation(program, "uSize"), width, height);
  gl.uniform2f(gl.getUniformLocation(program, "uOrigin"), 0, 0);
  gl.uniform2f(gl.getUniformLocation(program, "uGrid"), COLS, ROWS);
  gl.uniform1f(gl.getUniformLocation(program, "uCellPx"), BASE_CELL);
  gl.uniform1f(gl.getUniformLocation(program, "uTime"), clock);
  gl.uniform1f(gl.getUniformLocation(program, "uAcc"), Math.min(1, clock / ACCUMULATE_SECONDS));
  gl.uniform1f(gl.getUniformLocation(program, "uIntensity"), settings.intensity);
  gl.uniform2f(gl.getUniformLocation(program, "uWind"), Math.tan((settings.wind * Math.PI) / 180), Math.abs(settings.wind) / 45);
  gl.uniform1i(gl.getUniformLocation(program, "uKind"), KIND_INDEX[settings.kind]);
  bind(program, "uNoise", 0, noise);
  bind(program, "uRoof", 1, roof);
}

/** Clarão do relâmpago (como o de hoje). */
function flash(dt: number): number {
  if (dt < 0 || dt > 0.9) return 0;
  if (dt < 0.08) return 0.45;
  if (dt < 0.16) return 0.1;
  if (dt < 0.26) return 0.32;
  return 0.32 * (1 - (dt - 0.26) / 0.64);
}
let lightning = new LightningClock(7, settings.intensity);
let painter: WeatherPainter | null = null;

const frames: number[] = [];
const spent: number[] = [];
function frame(now: number) {
  const started = performance.now();
  const dt = lastNow ? (now - lastNow) / 1000 : 0;
  lastNow = now;
  clock += dt * settings.speed;
  const ratio = Math.min(2, window.devicePixelRatio || 1);
  const width = COLS * BASE_CELL;
  const height = ROWS * BASE_CELL;
  for (const canvas of [view, overlay]) {
    canvas.style.width = `${width}px`;
    canvas.style.height = `${height}px`;
    if (canvas.width !== width * ratio) canvas.width = width * ratio;
    if (canvas.height !== height * ratio) canvas.height = height * ratio;
  }
  const [pw, ph] = [view.width, view.height];
  if (ready.width !== pw || ready.height !== ph) {
    const { ground, tokens } = drawGround(width, height, ratio);
    gl.bindTexture(gl.TEXTURE_2D, groundTex);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA8, gl.RGBA, gl.UNSIGNED_BYTE, ground);
    gl.bindTexture(gl.TEXTURE_2D, tokenTex);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA8, gl.RGBA, gl.UNSIGNED_BYTE, tokens);
    gl.bindTexture(gl.TEXTURE_2D, sceneTex);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA8, pw, ph, 0, gl.RGBA, gl.UNSIGNED_BYTE, null);
    ready = { width: pw, height: ph };
  }
  const isNew = settings.look === "new";
  // 1. cena: chão, cobertura, tokens, o que cai
  gl.bindFramebuffer(gl.FRAMEBUFFER, framebuffer);
  gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, sceneTex, 0);
  gl.viewport(0, 0, pw, ph);
  gl.disable(gl.BLEND);
  gl.useProgram(blitProgram);
  bind(blitProgram, "uImage", 0, groundTex);
  fullscreen();
  gl.enable(gl.BLEND);
  gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
  if (isNew) {
    gl.useProgram(coverProgram);
    common(coverProgram, width, height);
    fullscreen();
  }
  gl.useProgram(blitProgram);
  bind(blitProgram, "uImage", 0, tokenTex);
  fullscreen();
  if (isNew) {
    gl.useProgram(airProgram);
    common(airProgram, width, height);
    gl.uniform1i(gl.getUniformLocation(airProgram, "uGlow"), 0);
    fullscreen();
  }
  // 2. tela: cena × luz (com o relâmpago); por cima, o que brilha sozinho
  gl.bindFramebuffer(gl.FRAMEBUFFER, null);
  gl.viewport(0, 0, pw, ph);
  gl.disable(gl.BLEND);
  gl.useProgram(composeProgram);
  bind(composeProgram, "uScene", 0, sceneTex);
  const night = settings.light === "night";
  const base = night ? [0.16, 0.18, 0.3] : settings.kind === "storm" ? [0.62, 0.64, 0.72] : [1, 1, 1];
  gl.uniform3f(gl.getUniformLocation(composeProgram, "uLight"), base[0], base[1], base[2]);
  const strike = settings.kind === "storm" ? lightning.last(clock) : null;
  gl.uniform1f(gl.getUniformLocation(composeProgram, "uFlash"), strike === null || !isNew ? 0 : flash(clock - strike));
  fullscreen();
  if (isNew) {
    gl.enable(gl.BLEND);
    gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
    gl.useProgram(airProgram);
    common(airProgram, width, height);
    gl.uniform1i(gl.getUniformLocation(airProgram, "uGlow"), 1);
    fullscreen();
    gl.disable(gl.BLEND);
  }
  const ctx = overlay.getContext("2d")!;
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.clearRect(0, 0, overlay.width, overlay.height);
  if (!isNew) {
    painter ??= new WeatherPainter({ kind: settings.kind, intensity: settings.intensity, wind: settings.wind, reduce: false });
    painter.setScene({ kind: settings.kind, intensity: settings.intensity, wind: settings.wind, reduce: false });
    const strikeToday = settings.kind === "storm" ? lightning.last(clock) : null;
    painter.frame(ctx, overlay.width, overlay.height, clock, dt, strikeToday);
  }
  gl.finish();
  spent.push(performance.now() - started);
  if (spent.length > 60) spent.shift();
  frames.push(now);
  while (frames.length > 0 && now - frames[0] > 1000) frames.shift();
  const average = spent.reduce((sum, value) => sum + value, 0) / spent.length;
  const info = document.getElementById("fps");
  if (info) info.textContent = `${frames.length} quadros/s · ${average.toFixed(1)} ms por quadro · cobertura ${Math.round(Math.min(1, clock / ACCUMULATE_SECONDS) * 100)}%`;
  requestAnimationFrame(frame);
}

function wire(id: string, apply: (value: string) => void) {
  const group = document.getElementById(id)!;
  group.addEventListener("click", (event) => {
    const button = (event.target as HTMLElement).closest("button");
    if (!button) return;
    if (id !== "restart") for (const other of group.querySelectorAll("button")) other.classList.toggle("on", other === button);
    apply(button.dataset.v ?? "");
  });
}
wire("kind", (value) => {
  settings.kind = value as Kind;
  clock = 0;
  lightning = new LightningClock(7, settings.intensity);
});
wire("look", (value) => (settings.look = value === "today" ? "today" : "new"));
wire("light", (value) => (settings.light = value === "night" ? "night" : "day"));
wire("wind", (value) => (settings.wind = Number(value)));
wire("speed", (value) => (settings.speed = Number(value)));
wire("restart", () => (clock = 0));

void Promise.all(["grass_01.webp", "dirt_01.webp", "stone_01.webp"].map(loadImage)).then(() => requestAnimationFrame(frame));
