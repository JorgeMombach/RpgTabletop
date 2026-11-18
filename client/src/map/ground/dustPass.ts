import type { DuneMask } from "@rpg/shared";
import { bindTextures, createTexture, ProgramCache, uniformOf, useVertices, vertexBuffer, type GroundView } from "./glKit";
import { SCREEN } from "./reliefShader";
import { FULLSCREEN_VERTEX } from "./terrainShader";

/**
 * Poeira das dunas com vento (docs/design/relevo.md, etapa 3; teste aprovado em `docs/design/dunas-poeira-teste.html`):
 * fiapos de areia correndo por todo o campo de dunas no sentido do vento, com rajadas que atravessam o mapa e um pouco
 * mais de areia nas cristas; de perto, grãos voando. Só onde há duna pintada no Relevo e com clima de vento. Cor
 * pré-multiplicada, por cima do chão (a luz da cena vem do mapa de luz, por cima).
 */

const DUST_FRAGMENT = `#version 300 es
precision highp float;
precision highp int;
out vec4 outColor;
uniform sampler2D uMask;     // onde há duna (grade fina, 4 por casa)
uniform vec2 uMaskOrigin;    // ponto fino do primeiro texel
uniform vec2 uMaskSize;      // tamanho da máscara (texels)
uniform float uTime, uLevel, uDirection;
${SCREEN}
// Sorteio pelos bits do número (inteiros de 32 bits): igual perto e longe da origem do mapa.
float hash(vec2 p) {
  highp uvec2 q = floatBitsToUint(p);
  highp uint h = (q.x * 1597334677u) ^ (q.y * 3812015801u);
  h ^= h >> 16u; h *= 2246822519u; h ^= h >> 13u; h *= 3266489917u; h ^= h >> 16u;
  return float(h) * (1.0 / 4294967296.0);
}
vec2 hash2(vec2 p) { return vec2(hash(p), hash(p + vec2(31.7, 17.3))); }
float noise(vec2 p) { vec2 i = floor(p), f = fract(p); vec2 u = f * f * (3.0 - 2.0 * f); return mix(mix(hash(i), hash(i + vec2(1, 0)), u.x), mix(hash(i + vec2(0, 1)), hash(i + vec2(1, 1)), u.x), u.y); }
float fbm(vec2 p) { float s = 0.0, a = 0.5; for (int i = 0; i < 4; i++) { s += a * noise(p); p *= 2.03; a *= 0.5; } return s; }
float speck(vec2 c, float scale, float chance, float seed) { vec2 g = c * scale + seed; vec2 id = floor(g); vec2 at = 0.5 + (hash2(id) - 0.5) * 0.6; return hash(id + seed) > chance ? 1.0 - smoothstep(0.18, 0.32, length(fract(g) - at)) : 0.0; }
// A mesma onda das dunas da altura do relevo (duneWave em relief.ts, com o mesmo sorteio de inteiros).
float latticeHash(int x, int y) {
  uint h = uint(x) * 374761393u + uint(y) * 668265263u;
  h = (h ^ (h >> 13u)) * 1274126177u;
  return float(h ^ (h >> 16u)) / 4294967296.0;
}
float latticeNoise(vec2 p) {
  vec2 start = floor(p); vec2 f = p - start; vec2 u = f * f * (3.0 - 2.0 * f);
  int x = int(start.x), y = int(start.y);
  float a = latticeHash(x, y), b = latticeHash(x + 1, y), c = latticeHash(x, y + 1), d = latticeHash(x + 1, y + 1);
  return a + (b - a) * u.x + (c - a) * u.y + (a - b - c + d) * u.x * u.y;
}
float duneWave(vec2 c) { return pow(0.5 + 0.5 * sin((c.x * 0.79 + c.y * 0.33) * 0.55 + latticeNoise(c * 0.15) * 5.0), 1.6); }

void main() {
  vec2 c = screenCell();
  float area = smoothstep(0.08, 0.5, texture(uMask, (c * 4.0 - uMaskOrigin + 0.5) / uMaskSize).r);
  if (area <= 0.0) discard;
  bool storm = uLevel > 1.5;
  vec2 w = vec2(uDirection, 0.12 * uDirection);
  vec2 n = vec2(-w.y, w.x);
  float along = dot(c, w) - uTime * (storm ? 3.5 : 1.8);
  float across = dot(c, n);
  // cristas: um pouco mais de areia nelas e logo atrás (olhando contra o vento)
  float crest = 0.0;
  for (int k = 0; k < 6; k++) {
    float d = float(k) / 5.0 * 1.5;
    crest = max(crest, smoothstep(0.86, 0.99, duneWave(c - w * d)) * (1.0 - d / 1.5));
  }
  float gust = smoothstep(0.3, 0.8, noise(vec2(along * 0.18, across * 0.35)));
  float wisp = fbm(vec2(along * 0.45, across * 3.0)) * 0.7 + fbm(vec2(along * 1.2, across * 8.0) + 7.0) * 0.3;
  float streaks = smoothstep(0.45, 0.7, wisp);
  float field = streaks * mix(0.25, 1.0, gust) * (storm ? 0.75 : 0.28);
  float fromCrest = crest * (0.3 + 0.7 * streaks) * (storm ? 0.45 : 0.18);
  float veil = clamp(field + fromCrest, 0.0, 1.0) * area;
  // de perto, grãos voando rápido com o vento (somem quando a casa fica pequena na tela)
  float cellPx = uStage.z * uMapGrid.z * (uCanvas.x / uScreen.x);
  vec2 moving = c - w * uTime * (storm ? 6.0 : 3.5);
  float grain = speck(moving, 26.0, 0.93, 3.0) * smoothstep(0.05, 0.3, veil + 0.1 * area) * smoothstep(40.0, 90.0, cellPx);
  vec3 dust = vec3(1.0, 0.95, 0.84) * 1.15;
  float alpha = max(veil, grain * 0.8);
  outColor = vec4(dust * alpha, alpha);
}`;

/** Período do relógio da poeira (segundos). */
const DUST_CLOCK = 1800;

export class DustPass {
  private readonly triangle: WebGLBuffer;
  private readonly programs: ProgramCache<"dust">;
  private mask: { texture: WebGLTexture; origin: [number, number]; size: [number, number] } | null = null;
  private level: 0 | 1 | 2 = 0;
  private direction: 1 | -1 = 1;

  constructor(private readonly gl: WebGL2RenderingContext) {
    this.triangle = vertexBuffer(gl, [-1, -1, 3, -1, -1, 3]);
    this.programs = new ProgramCache(gl, FULLSCREEN_VERTEX);
  }

  /** Onde há dunas (do relevo); `null` tira. */
  setMask(mask: DuneMask | null) {
    const { gl } = this;
    if (this.mask) gl.deleteTexture(this.mask.texture);
    this.mask = null;
    if (!mask) return;
    const width = mask.cols * 32 + 2;
    const height = mask.rows * 32 + 2;
    const texture = createTexture(
      gl,
      () => {
        gl.pixelStorei(gl.UNPACK_ALIGNMENT, 1);
        gl.texImage2D(gl.TEXTURE_2D, 0, gl.R8, width, height, 0, gl.RED, gl.UNSIGNED_BYTE, mask.data);
      },
      gl.LINEAR,
      gl.CLAMP_TO_EDGE,
    );
    this.mask = { texture, origin: [mask.cx * 32 - 1, mask.cy * 32 - 1], size: [width, height] };
  }

  /** Vento do clima: 0 = sem poeira, 1 = vento, 2 = tempestade de areia; direção 1 = direita. */
  setWind(level: 0 | 1 | 2, direction: 1 | -1) {
    this.level = level;
    this.direction = direction;
  }

  /** Há poeira para animar (dunas pintadas e vento). */
  get active(): boolean {
    return this.mask !== null && this.level > 0;
  }

  /** Programa ainda compilando. */
  get pending(): boolean {
    return this.active && this.programs.pending;
  }

  /** Desenha a poeira no alvo ligado (viewport e mistura pré-multiplicada já postos pelo chão). */
  draw(view: GroundView, width: number, height: number, time: number) {
    const { gl } = this;
    this.programs.beginDraw();
    const mask = this.mask;
    if (!mask || this.level === 0) return;
    const program = this.programs.get("dust", () => DUST_FRAGMENT);
    if (!program) return;
    gl.useProgram(program.program);
    useVertices(gl, this.triangle);
    bindTextures(gl, program, [["uMask", mask.texture]]);
    gl.uniform2f(uniformOf(gl, program, "uMaskOrigin"), ...mask.origin);
    gl.uniform2f(uniformOf(gl, program, "uMaskSize"), ...mask.size);
    gl.uniform4f(uniformOf(gl, program, "uMapGrid"), view.offsetX, view.offsetY, view.cellPx, 0);
    gl.uniform3f(uniformOf(gl, program, "uStage"), view.stageX, view.stageY, view.scale);
    gl.uniform2f(uniformOf(gl, program, "uScreen"), view.width, view.height);
    gl.uniform2f(uniformOf(gl, program, "uCanvas"), width, height);
    // O relógio volta a zero a cada meia hora: as contas do vento ficam pequenas (precisão boa a sessão inteira).
    gl.uniform1f(uniformOf(gl, program, "uTime"), time % DUST_CLOCK);
    gl.uniform1f(uniformOf(gl, program, "uLevel"), this.level);
    gl.uniform1f(uniformOf(gl, program, "uDirection"), this.direction);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
  }

  dispose() {
    if (this.mask) this.gl.deleteTexture(this.mask.texture);
    this.programs.dispose();
    this.gl.deleteBuffer(this.triangle);
  }
}
