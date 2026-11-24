import type { GridKind, Segment } from "@rpg/shared";
import { createTexture, linkProgram, uniformOf, useVertices, vertexBuffer, type GroundView, type Program } from "./glKit";
import { fogCellTriangles, fogNoiseData, fogSightTriangles, type FogRows, type FogViewer } from "./fogGeometry";
import { FOG_FRAGMENT, FOG_MASK_FRAGMENT, FOG_MASK_VERTEX, FOG_MODE } from "./fogShader";
import { FULLSCREEN_VERTEX } from "./terrainShader";

/**
 * Névoa na placa de vídeo (docs/design/nevoa.md). Duas máscaras na metade da tela, refeitas só quando a visão ou a
 * tela mudam: as casas (R agora, G explorado, B revelado, com a pincelada "cobrir" apagada) e a linha de visão (R o
 * leque parado nas paredes, G o círculo sem paredes). A cada quadro, a fumaça, o véu cinza do explorado e as copas.
 */

/** O que a névoa desenha: as casas que chegaram do servidor, quem vê e o que para a visão. */
export interface FogInput {
  now: FogRows;
  explored: FogRows;
  revealed: FogRows;
  /** A pincelada "cobrir" em andamento (tira do agora e do revelado na hora). */
  cover: FogRows;
  viewers: FogViewer[];
  blockers: Segment[];
  kind: GridKind | undefined;
  vision: boolean;
  look: "dark" | "mist";
}

/** Lado do ruído pronto e quantas células dele emendam. */
const NOISE_SIDE = 256;
const NOISE_PERIOD = 8;

/** Triângulos prontos na placa (pares x, y em casas). */
interface Triangles {
  buffer: WebGLBuffer;
  count: number;
}

export class FogPass {
  private input: FogInput | null = null;
  private readonly mask: Program;
  private fog: Program | null = null;
  private readonly triangle: WebGLBuffer;
  private readonly framebuffer: WebGLFramebuffer | null;
  private noise: WebGLTexture | null = null;
  private cellMask: WebGLTexture | null = null;
  private sightMask: WebGLTexture | null = null;
  private maskSize = { width: 0, height: 0 };
  /** Casas (agora, explorado, revelado, coberto) e leques (com e sem paredes). */
  private shapes: { now: Triangles; explored: Triangles; revealed: Triangles; cover: Triangles; walled: Triangles; open: Triangles } | null = null;
  /** Tela e entrada das máscaras desenhadas (vazio: refazer). */
  private maskKey = "";
  private inputVersion = 0;

  constructor(private readonly gl: WebGL2RenderingContext) {
    this.mask = linkProgram(gl, FOG_MASK_VERTEX, FOG_MASK_FRAGMENT, "aCell");
    this.triangle = vertexBuffer(gl, [-1, -1, 3, -1, -1, 3]);
    this.framebuffer = gl.createFramebuffer();
  }

  /** Névoa ligada (há o que desenhar). */
  get active(): boolean {
    return this.input !== null;
  }

  /** Sobe quando as máscaras mudam: as copas são refeitas com a névoa nova. */
  get version(): number {
    return this.inputVersion;
  }

  /** A névoa da cena (ou `null`: desligada). Os triângulos são refeitos aqui, uma vez por mudança. */
  set(input: FogInput | null) {
    this.input = input;
    this.inputVersion++;
    this.maskKey = "";
    this.releaseShapes();
    if (!input) return;
    const viewers = input.vision ? input.viewers : [];
    this.shapes = {
      now: this.upload(fogCellTriangles(input.now, input.kind)),
      explored: this.upload(fogCellTriangles(input.explored, input.kind)),
      revealed: this.upload(fogCellTriangles(input.revealed, input.kind)),
      cover: this.upload(fogCellTriangles(input.cover, input.kind)),
      walled: this.upload(fogSightTriangles(viewers, input.blockers)),
      open: this.upload(fogSightTriangles(viewers, [])),
    };
  }

  /** A fumaça no alvo ligado (cor pré-multiplicada), do tamanho `width` × `height`. */
  render(view: GroundView, width: number, height: number, time: number) {
    this.drawFog(view, width, height, time, FOG_MODE.smoke);
  }

  /** O véu cinza que tira a cor do explorado (a camada dele mistura por saturação). */
  renderTint(view: GroundView, width: number, height: number, time: number) {
    this.drawFog(view, width, height, time, FOG_MODE.tint);
  }

  /**
   * As copas no alvo ligado (já desenhadas): somem no nunca visto e escurecem no explorado. Multiplica o que está lá
   * (cor e alfa), sem desenhar por cima.
   */
  shadeCanopies(view: GroundView, width: number, height: number, time: number) {
    const { gl } = this;
    gl.enable(gl.BLEND);
    gl.blendFuncSeparate(gl.ZERO, gl.SRC_COLOR, gl.ZERO, gl.SRC_ALPHA);
    this.drawFog(view, width, height, time, FOG_MODE.canopy);
    gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
    gl.disable(gl.BLEND);
  }

  private drawFog(view: GroundView, width: number, height: number, time: number, mode: number) {
    const { gl } = this;
    const input = this.input;
    if (!input) return;
    this.drawMasks(view, width, height);
    const program = (this.fog ??= linkProgram(gl, FULLSCREEN_VERTEX, FOG_FRAGMENT, "aPos"));
    const noise = (this.noise ??= this.noiseTexture());
    if (!this.cellMask || !this.sightMask) return;
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    gl.viewport(0, 0, width, height);
    gl.useProgram(program.program);
    useVertices(gl, this.triangle);
    gl.uniform4f(uniformOf(gl, program, "uMapGrid"), view.offsetX, view.offsetY, view.cellPx, 0);
    gl.uniform3f(uniformOf(gl, program, "uStage"), view.stageX, view.stageY, view.scale);
    gl.uniform2f(uniformOf(gl, program, "uScreen"), view.width, view.height);
    gl.uniform2f(uniformOf(gl, program, "uCanvas"), width, height);
    gl.uniform1f(uniformOf(gl, program, "uTime"), time);
    gl.uniform1i(uniformOf(gl, program, "uUseSight"), input.vision && input.viewers.length > 0 ? 1 : 0);
    gl.uniform1i(uniformOf(gl, program, "uGm"), input.look === "mist" ? 1 : 0);
    gl.uniform1i(uniformOf(gl, program, "uMode"), mode);
    const textures: [string, WebGLTexture][] = [
      ["uCells", this.cellMask],
      ["uSight", this.sightMask],
      ["uNoise", noise],
    ];
    textures.forEach(([name, texture], unit) => {
      gl.activeTexture(gl.TEXTURE0 + unit);
      gl.bindTexture(gl.TEXTURE_2D, texture);
      gl.uniform1i(uniformOf(gl, program, name), unit);
    });
    gl.drawArrays(gl.TRIANGLES, 0, 3);
  }

  /** As duas máscaras na metade do canvas, só quando a tela ou a entrada mudaram. */
  private drawMasks(view: GroundView, width: number, height: number) {
    const { gl } = this;
    const shapes = this.shapes;
    if (!shapes) return;
    const maskWidth = Math.max(1, Math.ceil(width / 2));
    const maskHeight = Math.max(1, Math.ceil(height / 2));
    const key = [view.offsetX, view.offsetY, view.cellPx, view.stageX, view.stageY, view.scale, view.width, view.height, maskWidth, maskHeight, this.inputVersion].join("|");
    if (key === this.maskKey) return;
    if (this.maskSize.width !== maskWidth || this.maskSize.height !== maskHeight || !this.cellMask || !this.sightMask) {
      for (const texture of [this.cellMask, this.sightMask]) if (texture) gl.deleteTexture(texture);
      const allocate = () => gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA8, maskWidth, maskHeight, 0, gl.RGBA, gl.UNSIGNED_BYTE, null);
      this.cellMask = createTexture(gl, allocate, gl.LINEAR_MIPMAP_LINEAR, gl.CLAMP_TO_EDGE);
      this.sightMask = createTexture(gl, allocate, gl.LINEAR_MIPMAP_LINEAR, gl.CLAMP_TO_EDGE);
      this.maskSize = { width: maskWidth, height: maskHeight };
    }
    gl.useProgram(this.mask.program);
    gl.uniform4f(uniformOf(gl, this.mask, "uMapGrid"), view.offsetX, view.offsetY, view.cellPx, 0);
    gl.uniform3f(uniformOf(gl, this.mask, "uStage"), view.stageX, view.stageY, view.scale);
    gl.uniform2f(uniformOf(gl, this.mask, "uScreen"), view.width, view.height);
    gl.disable(gl.BLEND);
    // casas: um canal por vez; a pincelada "cobrir" apaga os três por cima
    this.drawInto(this.cellMask, maskWidth, maskHeight, [
      [shapes.now, [true, false, false], 1],
      [shapes.explored, [false, true, false], 1],
      [shapes.revealed, [false, false, true], 1],
      [shapes.cover, [true, false, true], 0],
    ]);
    // linha de visão: o leque parado nas paredes (R) e o círculo sem paredes (G)
    this.drawInto(this.sightMask, maskWidth, maskHeight, [
      [shapes.walled, [true, false, false], 1],
      [shapes.open, [false, true, false], 1],
    ]);
    gl.colorMask(true, true, true, true);
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    this.maskKey = key;
  }

  /** Limpa a máscara e desenha cada grupo de triângulos nos canais dele, com o valor dado; depois, os níveis menores. */
  private drawInto(target: WebGLTexture, width: number, height: number, groups: [Triangles, [boolean, boolean, boolean], number][]) {
    const { gl } = this;
    gl.bindFramebuffer(gl.FRAMEBUFFER, this.framebuffer);
    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, target, 0);
    gl.viewport(0, 0, width, height);
    gl.colorMask(true, true, true, true);
    gl.clearColor(0, 0, 0, 1);
    gl.clear(gl.COLOR_BUFFER_BIT);
    for (const [shape, [red, green, blue], value] of groups) {
      if (shape.count === 0) continue;
      gl.colorMask(red, green, blue, false);
      gl.uniform4f(uniformOf(gl, this.mask, "uColor"), value, value, value, 1);
      useVertices(gl, shape.buffer);
      gl.drawArrays(gl.TRIANGLES, 0, shape.count);
    }
    gl.colorMask(true, true, true, true);
    gl.bindTexture(gl.TEXTURE_2D, target);
    gl.generateMipmap(gl.TEXTURE_2D);
  }

  private upload(points: Float32Array): Triangles {
    const { gl } = this;
    const buffer = gl.createBuffer();
    if (!buffer) throw new Error("buffer");
    gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
    gl.bufferData(gl.ARRAY_BUFFER, points, gl.STATIC_DRAW);
    return { buffer, count: points.length / 2 };
  }

  private noiseTexture(): WebGLTexture {
    const { gl } = this;
    const data = fogNoiseData(NOISE_SIDE, NOISE_PERIOD);
    const texture = createTexture(gl, () => gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA8, NOISE_SIDE, NOISE_SIDE, 0, gl.RGBA, gl.UNSIGNED_BYTE, data), gl.LINEAR_MIPMAP_LINEAR, gl.REPEAT);
    gl.generateMipmap(gl.TEXTURE_2D);
    return texture;
  }

  private releaseShapes() {
    if (!this.shapes) return;
    for (const shape of Object.values(this.shapes)) this.gl.deleteBuffer(shape.buffer);
    this.shapes = null;
  }

  dispose() {
    const { gl } = this;
    this.releaseShapes();
    gl.deleteProgram(this.mask.program);
    if (this.fog) gl.deleteProgram(this.fog.program);
    gl.deleteBuffer(this.triangle);
    gl.deleteFramebuffer(this.framebuffer);
    for (const texture of [this.noise, this.cellMask, this.sightMask]) if (texture) gl.deleteTexture(texture);
  }
}
