import { lightPolygon, sunShadows, type LightId, type Segment } from "@rpg/shared";
import { bindTextures, createTexture, linkProgram, uniformOf, useVertices, vertexBuffer, type GroundView, type Program } from "./glKit";
import { AMBIENT_FRAGMENT, FLAME_FRAGMENT, GEOMETRY_VERTEX, LIGHT_OUT_FRAGMENT, SHADOW_FRAGMENT, TORCH_FRAGMENT } from "./lightShader";
import { blendSceneLight, SCENE_LIGHT, type SceneLight } from "./sceneLight";
import { FULLSCREEN_VERTEX } from "./terrainShader";

/**
 * Passo da luz no renderizador do chão (docs/design/luz.md). A geometria (recorte de cada tocha pelas paredes, sombra
 * de cada parede) é feita só quando paredes, tochas ou a luz da cena mudam; a cada quadro, os triângulos guardados são
 * desenhados de novo com a tremulação e a chama do instante.
 */

/** De onde sai luz, em casas: tocha fixa (`fixed`, com a base da chama) ou tocha de token (`held`, alcance da borda). */
export interface LightSource {
  id: string;
  x: number;
  y: number;
  reach: number;
  kind: "fixed" | "held";
  /** Tocha fixa: onde fica a base da chama (o corpo é desenhado no Konva). */
  flame?: { x: number; y: number };
}

export interface LightingInput {
  blockers: Segment[];
  sources: LightSource[];
  scene: LightId;
  /** Brilho mínimo (mestre); `null` = escuridão de verdade. */
  floor: [number, number, number] | null;
}

/** Origens deslocadas de cada tocha (a chama tem tamanho: a sombra sai macia). */
const SOFT_ORIGINS: [number, number][] = [
  [0.15, 0],
  [-0.15, 0],
  [0, 0.15],
  [0, -0.15],
];
/** Sombras do sol um pouco diferentes (borda macia), como no teste: ângulo e comprimento. */
const SUN_SAMPLES = 5;
/** Troca de luz da cena: meio segundo. */
const SCENE_BLEND_SECONDS = 0.5;
/** Raio do quadrado em volta da chama (casas): chama, brilho e faíscas cabem. */
const FLAME_BOX = 1.1;

interface TorchMesh {
  source: LightSource;
  seed: number;
  buffer: WebGLBuffer;
  /** Vértices de cada leque (um por origem), em sequência no buffer. */
  fans: { first: number; count: number }[];
  flameBox: WebGLBuffer;
}

/** Semente estável pela identidade da luz (cada tocha tremula do seu jeito). */
function seedOf(id: string): number {
  let hash = 0;
  for (let index = 0; index < id.length; index++) hash = (hash * 31 + id.charCodeAt(index)) | 0;
  return (Math.abs(hash) % 1000) / 37;
}

/** Leque de triângulos (centro + borda do polígono), em pares x, y. */
function fan(center: [number, number], polygon: number[]): number[] {
  const out: number[] = [];
  const count = polygon.length / 2;
  for (let index = 0; index < count; index++) {
    const next = (index + 1) % count;
    out.push(center[0], center[1], polygon[index * 2], polygon[index * 2 + 1], polygon[next * 2], polygon[next * 2 + 1]);
  }
  return out;
}

export class LightPass {
  private readonly ambient: Program;
  private readonly shadow: Program;
  private readonly torch: Program;
  private readonly lightOut: Program;
  private readonly flame: Program;
  private readonly triangle: WebGLBuffer;
  private readonly framebuffer: WebGLFramebuffer | null;
  private lightTexture: WebGLTexture | null = null;
  private shadowTexture: WebGLTexture | null = null;
  private size = { width: 0, height: 0 };
  private input: LightingInput | null = null;
  private key = "";
  private torches: TorchMesh[] = [];
  /** Recortes já feitos, pela tocha (posição, alcance) e pelas paredes: só o que mudou é refeito. */
  private meshes = new Map<string, { key: string; mesh: TorchMesh }>();
  private blockersKey = "";
  /** Sombras do sol: um buffer com as 5 versões (cada uma, um bloco de triângulos). */
  private shadows: { buffer: WebGLBuffer; count: number } | null = null;
  private shadowsFor = "";
  private current: SceneLight = SCENE_LIGHT.day;
  private lastBlend = performance.now();

  constructor(private readonly gl: WebGL2RenderingContext) {
    this.ambient = linkProgram(gl, FULLSCREEN_VERTEX, AMBIENT_FRAGMENT, "aPos");
    this.lightOut = linkProgram(gl, FULLSCREEN_VERTEX, LIGHT_OUT_FRAGMENT, "aPos");
    this.shadow = linkProgram(gl, GEOMETRY_VERTEX, SHADOW_FRAGMENT, "aCell");
    this.torch = linkProgram(gl, GEOMETRY_VERTEX, TORCH_FRAGMENT, "aCell");
    this.flame = linkProgram(gl, GEOMETRY_VERTEX, FLAME_FRAGMENT, "aCell");
    this.triangle = vertexBuffer(gl, [-1, -1, 3, -1, -1, 3]);
    this.framebuffer = gl.createFramebuffer();
  }

  /** Paredes, luzes e luz da cena: a geometria só é refeita se algo mudou de fato. */
  setLighting(input: LightingInput) {
    const firstTime = this.input === null;
    this.input = input;
    if (firstTime) this.current = SCENE_LIGHT[input.scene];
    const blockersKey = JSON.stringify(input.blockers);
    const key = blockersKey + JSON.stringify(input.sources);
    if (key === this.key) return;
    this.key = key;
    this.blockersKey = blockersKey;
    this.rebuildTorches(input);
  }

  private releaseMesh(mesh: TorchMesh) {
    this.gl.deleteBuffer(mesh.buffer);
    this.gl.deleteBuffer(mesh.flameBox);
  }

  private releaseTorches() {
    for (const { mesh } of this.meshes.values()) this.releaseMesh(mesh);
    this.meshes.clear();
    this.torches = [];
  }

  /** Refaz só os recortes das tochas que mudaram (ou todos, se as paredes mudaram); os outros ficam. */
  private rebuildTorches(input: LightingInput) {
    const next = new Map<string, { key: string; mesh: TorchMesh }>();
    for (const source of input.sources) {
      const key = `${this.blockersKey}|${JSON.stringify(source)}`;
      const old = this.meshes.get(source.id);
      if (old && old.key === key) {
        next.set(source.id, old);
        this.meshes.delete(source.id);
        continue;
      }
      next.set(source.id, { key, mesh: this.buildMesh(source, input.blockers) });
    }
    for (const { mesh } of this.meshes.values()) this.releaseMesh(mesh);
    this.meshes = next;
    this.torches = [...next.values()].map((entry) => entry.mesh);
  }

  private buildMesh(source: LightSource, blockers: Segment[]): TorchMesh {
    // Só as paredes ao alcance desta tocha entram na conta (as outras não mudam o recorte).
    const near = blockers.filter((segment) => {
      const length = Math.hypot(segment.x2 - segment.x1, segment.y2 - segment.y1);
      const midX = (segment.x1 + segment.x2) / 2;
      const midY = (segment.y1 + segment.y2) / 2;
      return Math.hypot(midX - source.x, midY - source.y) <= source.reach + length / 2 + 0.5;
    });
    const vertices: number[] = [];
    const fans: { first: number; count: number }[] = [];
    for (const [dx, dy] of SOFT_ORIGINS) {
      const origin: [number, number] = [source.x + dx, source.y + dy];
      const triangles = fan(origin, lightPolygon({ x: origin[0], y: origin[1] }, source.reach, near));
      fans.push({ first: vertices.length / 2, count: triangles.length / 2 });
      vertices.push(...triangles);
    }
    const base = source.flame ?? { x: source.x, y: source.y };
    const box = [base.x - FLAME_BOX, base.y - FLAME_BOX, base.x + FLAME_BOX, base.y - FLAME_BOX, base.x - FLAME_BOX, base.y + FLAME_BOX];
    const boxRest = [base.x - FLAME_BOX, base.y + FLAME_BOX, base.x + FLAME_BOX, base.y - FLAME_BOX, base.x + FLAME_BOX, base.y + FLAME_BOX];
    return { source, seed: seedOf(source.id), buffer: vertexBuffer(this.gl, vertices), fans, flameBox: vertexBuffer(this.gl, [...box, ...boxRest]) };
  }

  /** Sombras do sol (5 versões um pouco diferentes), refeitas quando as paredes ou a direção/comprimento mudam. */
  private ensureShadows(scene: SceneLight) {
    const input = this.input;
    if (!input) return;
    const key = `${this.blockersKey}|${scene.sunDirection.map((value) => value.toFixed(3)).join(",")}|${scene.shadowCells.toFixed(3)}`;
    if (key === this.shadowsFor) return;
    this.shadowsFor = key;
    if (this.shadows) this.gl.deleteBuffer(this.shadows.buffer);
    this.shadows = null;
    if (scene.shadowCells <= 0.01) return;
    const vertices: number[] = [];
    for (let sample = 0; sample < SUN_SAMPLES; sample++) {
      const spread = (sample - (SUN_SAMPLES - 1) / 2) * 0.06;
      const [x, y] = scene.sunDirection;
      const direction = { x: x - y * spread, y: y + x * spread };
      const length = Math.hypot(direction.x, direction.y) || 1;
      for (const quad of sunShadows(input.blockers, { x: direction.x / length, y: direction.y / length }, scene.shadowCells * (0.85 + 0.075 * sample))) {
        vertices.push(quad[0], quad[1], quad[2], quad[3], quad[4], quad[5], quad[0], quad[1], quad[4], quad[5], quad[6], quad[7]);
      }
    }
    this.shadows = { buffer: vertexBuffer(this.gl, vertices), count: vertices.length / 2 };
  }

  private target(width: number, height: number) {
    const { gl } = this;
    if (this.size.width === width && this.size.height === height && this.lightTexture && this.shadowTexture) return;
    for (const texture of [this.lightTexture, this.shadowTexture]) if (texture) gl.deleteTexture(texture);
    const make = () => createTexture(gl, () => gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA8, width, height, 0, gl.RGBA, gl.UNSIGNED_BYTE, null), gl.NEAREST, gl.CLAMP_TO_EDGE);
    // Mapa de luz em meia precisão quando o aparelho deixa desenhar nela (sem anéis na queda da luz); senão, 8 bits.
    const precise = gl.getExtension("EXT_color_buffer_float") !== null;
    this.lightTexture = precise
      ? createTexture(gl, () => gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA16F, width, height, 0, gl.RGBA, gl.HALF_FLOAT, null), gl.LINEAR, gl.CLAMP_TO_EDGE)
      : createTexture(gl, () => gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA8, width, height, 0, gl.RGBA, gl.UNSIGNED_BYTE, null), gl.LINEAR, gl.CLAMP_TO_EDGE);
    this.shadowTexture = make();
    this.size = { width, height };
  }

  private setView(program: Program, view: GroundView) {
    const { gl } = this;
    gl.uniform4f(uniformOf(gl, program, "uMapGrid"), view.offsetX, view.offsetY, view.cellPx, 0);
    gl.uniform3f(uniformOf(gl, program, "uStage"), view.stageX, view.stageY, view.scale);
    gl.uniform2f(uniformOf(gl, program, "uScreen"), view.width, view.height);
  }

  private drawInto(texture: WebGLTexture | null, width: number, height: number) {
    const { gl } = this;
    gl.bindFramebuffer(gl.FRAMEBUFFER, this.framebuffer);
    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, texture, 0);
    gl.viewport(0, 0, width, height);
  }

  /** Mapa de luz no canvas (já ligado e do tamanho certo). `time` em segundos. */
  renderLight(view: GroundView, time: number, width: number, height: number) {
    const { gl } = this;
    const input = this.input;
    if (!input) return;
    // Troca suave da luz da cena (pelo relógio real: com a luz parada, ainda assim chega ao destino).
    const now = performance.now();
    const k = Math.min(1, (now - this.lastBlend) / 1000 / SCENE_BLEND_SECONDS);
    this.lastBlend = now;
    this.current = blendSceneLight(this.current, SCENE_LIGHT[input.scene], k);
    const scene = this.current;
    // A luz é suave: calculada em meia resolução e esticada com filtro na saída.
    const lightWidth = Math.max(1, Math.ceil(width / 2));
    const lightHeight = Math.max(1, Math.ceil(height / 2));
    this.target(lightWidth, lightHeight);
    this.ensureShadows(scene);
    // 1. Máscara das sombras do sol.
    this.drawInto(this.shadowTexture, lightWidth, lightHeight);
    gl.clearColor(0, 0, 0, 1);
    gl.clear(gl.COLOR_BUFFER_BIT);
    if (this.shadows) {
      gl.enable(gl.BLEND);
      gl.blendFunc(gl.ONE, gl.ONE);
      gl.useProgram(this.shadow.program);
      this.setView(this.shadow, view);
      gl.uniform1f(uniformOf(gl, this.shadow, "uWeight"), 1 / SUN_SAMPLES);
      useVertices(gl, this.shadows.buffer);
      gl.drawArrays(gl.TRIANGLES, 0, this.shadows.count);
      gl.disable(gl.BLEND);
    }
    // 2. Ambiente + sol fora da sombra.
    this.drawInto(this.lightTexture, lightWidth, lightHeight);
    gl.useProgram(this.ambient.program);
    useVertices(gl, this.triangle);
    gl.uniform2f(uniformOf(gl, this.ambient, "uCanvas"), lightWidth, lightHeight);
    gl.uniform3f(uniformOf(gl, this.ambient, "uAmbient"), ...scene.ambient);
    gl.uniform3f(uniformOf(gl, this.ambient, "uSun"), ...scene.sun);
    if (this.shadowTexture) bindTextures(gl, this.ambient, [["uShadow", this.shadowTexture]]);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
    // 3. Tochas: cada recorte, somado.
    gl.enable(gl.BLEND);
    gl.blendFunc(gl.ONE, gl.ONE);
    gl.useProgram(this.torch.program);
    this.setView(this.torch, view);
    gl.uniform1f(uniformOf(gl, this.torch, "uTime"), time);
    gl.uniform1f(uniformOf(gl, this.torch, "uWeight"), 1 / SOFT_ORIGINS.length);
    for (const mesh of this.torches) {
      gl.uniform2f(uniformOf(gl, this.torch, "uCenter"), mesh.source.x, mesh.source.y);
      gl.uniform1f(uniformOf(gl, this.torch, "uReach"), mesh.source.reach);
      gl.uniform1f(uniformOf(gl, this.torch, "uSeed"), mesh.seed);
      gl.uniform1f(uniformOf(gl, this.torch, "uStrength"), scene.torch);
      useVertices(gl, mesh.buffer);
      for (const part of mesh.fans) gl.drawArrays(gl.TRIANGLES, part.first, part.count);
    }
    gl.disable(gl.BLEND);
    // 4. Para o canvas, com o brilho mínimo.
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    gl.viewport(0, 0, width, height);
    gl.useProgram(this.lightOut.program);
    useVertices(gl, this.triangle);
    gl.uniform2f(uniformOf(gl, this.lightOut, "uCanvas"), width, height);
    const floor = input.floor ?? [0, 0, 0];
    gl.uniform3f(uniformOf(gl, this.lightOut, "uFloor"), floor[0], floor[1], floor[2]);
    if (this.lightTexture) bindTextures(gl, this.lightOut, [["uLight", this.lightTexture]]);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
  }

  /** Chamas, faíscas e brilho no canvas (já ligado, limpo e do tamanho certo). */
  renderFlames(view: GroundView, time: number) {
    const { gl } = this;
    if (!this.input || this.torches.length === 0) return;
    gl.enable(gl.BLEND);
    gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
    gl.useProgram(this.flame.program);
    this.setView(this.flame, view);
    gl.uniform1f(uniformOf(gl, this.flame, "uTime"), time);
    gl.uniform1f(uniformOf(gl, this.flame, "uTorch"), this.current.torch);
    for (const mesh of this.torches) {
      const base = mesh.source.flame ?? { x: mesh.source.x, y: mesh.source.y };
      gl.uniform2f(uniformOf(gl, this.flame, "uFlame"), base.x, base.y);
      gl.uniform1f(uniformOf(gl, this.flame, "uSeed"), mesh.seed);
      gl.uniform1f(uniformOf(gl, this.flame, "uFixed"), mesh.source.kind === "fixed" ? 1 : 0);
      useVertices(gl, mesh.flameBox);
      gl.drawArrays(gl.TRIANGLES, 0, 6);
    }
    gl.disable(gl.BLEND);
  }

  get active(): boolean {
    return this.input !== null;
  }

  get hasTorches(): boolean {
    return this.torches.length > 0;
  }

  /** A troca de luz da cena ainda está no meio (precisa de mais quadros para chegar). */
  get settling(): boolean {
    if (!this.input) return false;
    const target = SCENE_LIGHT[this.input.scene];
    return this.current.ambient.some((value, index) => Math.abs(value - target.ambient[index]) > 0.002) || Math.abs(this.current.shadowCells - target.shadowCells) > 0.01;
  }

  dispose() {
    this.releaseTorches();
    if (this.shadows) this.gl.deleteBuffer(this.shadows.buffer);
    for (const texture of [this.lightTexture, this.shadowTexture]) if (texture) this.gl.deleteTexture(texture);
  }
}
