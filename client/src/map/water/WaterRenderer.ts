import { BAKE_FRAGMENT, MAX_ROCKS, WATER_FRAGMENT, WATER_VERTEX } from "./waterShader";
import type { WaterGpuField } from "./waterTypes";

/**
 * Renderizador da água animada (docs/design/agua.md), em WebGL 2. Não conhece Konva nem React: recebe os grupos de
 * água (texturas do Worker), a visão (pan e zoom) e o tempo, e desenha num canvas do tamanho da tela. Quando o mapa
 * trocar de motor, vai junto.
 *
 * Dois passos: quando a água muda, o barranco, o fundo, a luz, a sombra e a profundidade de cada grupo são "assados"
 * numa textura (`bake`); a cada quadro só a superfície da água é calculada, por cima do assado.
 */

/** Como o mapa está na tela: o grid (casa em px do mapa) e o palco (mapa -> tela), mais o tamanho e a densidade. */
export interface WaterView {
  offsetX: number;
  offsetY: number;
  cellPx: number;
  stageX: number;
  stageY: number;
  scale: number;
  width: number;
  height: number;
  pixelRatio: number;
}

interface GpuGroup {
  field: WaterGpuField;
  sdfDeep: WebGLTexture;
  river: WebGLTexture;
  /** Terreno assado (cor iluminada + borda) e dados (profundidade, sombra, distância da água). */
  bakedTerrain: WebGLTexture | null;
  bakedData: WebGLTexture | null;
}

/** Densidade máxima da tela para a água (acima disso o ganho não paga o peso). */
const MAX_PIXEL_RATIO = 1.5;
/** Resolução do assado (px por casa) e o lado máximo dele (tempo de desenho e memória limitados). */
const BAKE_PER_CELL = 40;
const MAX_BAKE_SIDE = 2048;

type Program = { program: WebGLProgram; uniforms: Map<string, WebGLUniformLocation | null> };

export class WaterRenderer {
  private readonly gl: WebGL2RenderingContext;
  private readonly bake: Program;
  private readonly water: Program;
  private readonly framebuffer: WebGLFramebuffer | null;
  private groups: GpuGroup[] = [];
  private dirt: WebGLTexture | null = null;

  /** O navegador desenha WebGL 2 (sem isso, a água fica a aquarela do terreno de hoje). */
  static supported(): boolean {
    try {
      const probe = document.createElement("canvas").getContext("webgl2");
      // Só para saber: o contexto de teste é liberado na hora (o navegador limita quantos ficam abertos).
      probe?.getExtension("WEBGL_lose_context")?.loseContext();
      return probe !== null;
    } catch {
      return false;
    }
  }

  constructor(readonly canvas: HTMLCanvasElement) {
    const gl = canvas.getContext("webgl2", { premultipliedAlpha: true, preserveDrawingBuffer: true, antialias: false, alpha: true });
    if (!gl) throw new Error("WebGL 2 indisponível");
    this.gl = gl;
    this.bake = this.link(WATER_VERTEX, BAKE_FRAGMENT);
    this.water = this.link(WATER_VERTEX, WATER_FRAGMENT);
    this.framebuffer = gl.createFramebuffer();
    const buffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([0, 0, 1, 0, 0, 1, 0, 1, 1, 0, 1, 1]), gl.STATIC_DRAW);
    // Os dois programas usam o mesmo vértice: o atributo fica no mesmo lugar.
    for (const { program } of [this.bake, this.water]) gl.bindAttribLocation(program, 0, "aCorner");
    gl.enableVertexAttribArray(0);
    gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);
  }

  private link(vertexSource: string, fragmentSource: string): Program {
    const { gl } = this;
    const compile = (type: number, source: string) => {
      const shader = gl.createShader(type);
      if (!shader) throw new Error("shader");
      gl.shaderSource(shader, source);
      gl.compileShader(shader);
      if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(shader) ?? "shader");
      return shader;
    };
    const program = gl.createProgram();
    if (!program) throw new Error("programa");
    gl.attachShader(program, compile(gl.VERTEX_SHADER, vertexSource));
    gl.attachShader(program, compile(gl.FRAGMENT_SHADER, fragmentSource));
    gl.bindAttribLocation(program, 0, "aCorner");
    gl.linkProgram(program);
    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(program) ?? "programa");
    return { program, uniforms: new Map() };
  }

  private uniform(target: Program, name: string): WebGLUniformLocation | null {
    if (!target.uniforms.has(name)) target.uniforms.set(name, this.gl.getUniformLocation(target.program, name));
    return target.uniforms.get(name) ?? null;
  }

  private texture(setup: () => void, filter: number, wrap: number): WebGLTexture {
    const { gl } = this;
    const texture = gl.createTexture();
    if (!texture) throw new Error("textura");
    gl.bindTexture(gl.TEXTURE_2D, texture);
    setup();
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, filter);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, wrap);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, wrap);
    return texture;
  }

  private halfTexture(data: Uint16Array, width: number, height: number): WebGLTexture {
    const { gl } = this;
    return this.texture(
      () => {
        gl.pixelStorei(gl.UNPACK_ALIGNMENT, 1);
        gl.texImage2D(gl.TEXTURE_2D, 0, gl.RG16F, width, height, 0, gl.RG, gl.HALF_FLOAT, data);
      },
      gl.LINEAR,
      gl.CLAMP_TO_EDGE,
    );
  }

  /** Coordenadas do rio em precisão cheia (sem filtro: o shader interpola). */
  private floatTexture(data: Float32Array, width: number, height: number): WebGLTexture {
    const { gl } = this;
    return this.texture(
      () => {
        gl.pixelStorei(gl.UNPACK_ALIGNMENT, 1);
        gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA32F, width, height, 0, gl.RGBA, gl.FLOAT, data);
      },
      gl.NEAREST,
      gl.CLAMP_TO_EDGE,
    );
  }

  /** Aquarela de terra que vira o barranco e o fundo. */
  setDirt(image: HTMLImageElement) {
    const { gl } = this;
    if (this.dirt) gl.deleteTexture(this.dirt);
    this.dirt = this.texture(
      () => {
        gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, image);
        gl.generateMipmap(gl.TEXTURE_2D);
      },
      gl.LINEAR_MIPMAP_LINEAR,
      gl.REPEAT,
    );
    for (const group of this.groups) this.bakeGroup(group);
  }

  /** Troca os grupos de água (o que o Worker calculou) e assa o terreno de cada um. */
  setFields(fields: WaterGpuField[]) {
    this.release();
    this.groups = fields.map((field) => ({
      field,
      sdfDeep: this.halfTexture(field.sdfDeep, field.width, field.height),
      river: this.floatTexture(field.river, field.width, field.height),
      bakedTerrain: null,
      bakedData: null,
    }));
    for (const group of this.groups) this.bakeGroup(group);
  }

  private release() {
    const { gl } = this;
    for (const group of this.groups) {
      for (const texture of [group.sdfDeep, group.river, group.bakedTerrain, group.bakedData]) if (texture) gl.deleteTexture(texture);
    }
    this.groups = [];
  }

  /** Assa o barranco, o fundo, a luz, a sombra e a profundidade do grupo (precisa da aquarela de terra). */
  private bakeGroup(group: GpuGroup) {
    const { gl } = this;
    if (!this.dirt || !this.framebuffer) return;
    const { rect } = group.field;
    const maxSide = Math.min(MAX_BAKE_SIDE, Number(gl.getParameter(gl.MAX_TEXTURE_SIZE)));
    const perCell = Math.min(BAKE_PER_CELL, maxSide / rect.cols, maxSide / rect.rows);
    const width = Math.max(1, Math.round(rect.cols * perCell));
    const height = Math.max(1, Math.round(rect.rows * perCell));
    const target = () =>
      this.texture(
        () => gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA8, width, height, 0, gl.RGBA, gl.UNSIGNED_BYTE, null),
        gl.LINEAR,
        gl.CLAMP_TO_EDGE,
      );
    for (const texture of [group.bakedTerrain, group.bakedData]) if (texture) gl.deleteTexture(texture);
    group.bakedTerrain = target();
    group.bakedData = target();
    gl.bindFramebuffer(gl.FRAMEBUFFER, this.framebuffer);
    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, group.bakedTerrain, 0);
    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT1, gl.TEXTURE_2D, group.bakedData, 0);
    gl.drawBuffers([gl.COLOR_ATTACHMENT0, gl.COLOR_ATTACHMENT1]);
    gl.viewport(0, 0, width, height);
    gl.clearColor(0, 0, 0, 0);
    gl.clear(gl.COLOR_BUFFER_BIT);
    gl.useProgram(this.bake.program);
    gl.uniform1f(this.uniform(this.bake, "uBake"), 1);
    gl.uniform4f(this.uniform(this.bake, "uRectCells"), rect.col, rect.row, rect.cols, rect.rows);
    gl.uniform1f(this.uniform(this.bake, "uPerCell"), group.field.perCell);
    this.bindTextures(this.bake, [
      ["uSdfDeep", group.sdfDeep],
      ["uRiver", group.river],
      ["uDirt", this.dirt],
    ]);
    gl.drawArrays(gl.TRIANGLES, 0, 6);
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
  }

  private bindTextures(target: Program, textures: [string, WebGLTexture][]) {
    const { gl } = this;
    textures.forEach(([name, texture], unit) => {
      gl.activeTexture(gl.TEXTURE0 + unit);
      gl.bindTexture(gl.TEXTURE_2D, texture);
      gl.uniform1i(this.uniform(target, name), unit);
    });
  }

  get empty(): boolean {
    return this.groups.length === 0;
  }

  /** Algum grupo de água aparece na tela agora (para não animar à toa). */
  visible(view: WaterView): boolean {
    return this.groups.some(({ field }) => {
      const left = (view.offsetX + field.rect.col * view.cellPx) * view.scale + view.stageX;
      const top = (view.offsetY + field.rect.row * view.cellPx) * view.scale + view.stageY;
      const right = left + field.rect.cols * view.cellPx * view.scale;
      const bottom = top + field.rect.rows * view.cellPx * view.scale;
      return right > 0 && bottom > 0 && left < view.width && top < view.height;
    });
  }

  render(view: WaterView, time: number) {
    const { gl, canvas } = this;
    const ratio = Math.min(view.pixelRatio, MAX_PIXEL_RATIO);
    const width = Math.max(1, Math.round(view.width * ratio));
    const height = Math.max(1, Math.round(view.height * ratio));
    if (canvas.width !== width || canvas.height !== height) {
      canvas.width = width;
      canvas.height = height;
    }
    gl.viewport(0, 0, width, height);
    gl.clearColor(0, 0, 0, 0);
    gl.clear(gl.COLOR_BUFFER_BIT);
    const program = this.water;
    gl.useProgram(program.program);
    gl.uniform1f(this.uniform(program, "uBake"), 0);
    gl.uniform4f(this.uniform(program, "uMapGrid"), view.offsetX, view.offsetY, view.cellPx, 0);
    gl.uniform3f(this.uniform(program, "uStage"), view.stageX, view.stageY, view.scale);
    gl.uniform2f(this.uniform(program, "uScreen"), view.width, view.height);
    gl.uniform1f(this.uniform(program, "uTime"), time);
    for (const group of this.groups) {
      if (!group.bakedTerrain || !group.bakedData) continue;
      const { field } = group;
      this.bindTextures(program, [
        ["uSdfDeep", group.sdfDeep],
        ["uRiver", group.river],
        ["uBakedTerrain", group.bakedTerrain],
        ["uBakedData", group.bakedData],
      ]);
      gl.uniform4f(this.uniform(program, "uRectCells"), field.rect.col, field.rect.row, field.rect.cols, field.rect.rows);
      gl.uniform1f(this.uniform(program, "uPerCell"), field.perCell);
      const rocks = new Float32Array(MAX_ROCKS * 3);
      field.rocks.slice(0, MAX_ROCKS).forEach((rock, index) => rocks.set([rock.col, rock.row, rock.radius], index * 3));
      gl.uniform3fv(this.uniform(program, "uRocks[0]"), rocks);
      gl.uniform1i(this.uniform(program, "uRockCount"), Math.min(field.rocks.length, MAX_ROCKS));
      gl.drawArrays(gl.TRIANGLES, 0, 6);
    }
  }

  dispose() {
    this.release();
    if (this.dirt) this.gl.deleteTexture(this.dirt);
    this.gl.getExtension("WEBGL_lose_context")?.loseContext();
  }
}
