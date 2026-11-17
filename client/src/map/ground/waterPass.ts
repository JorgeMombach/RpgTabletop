import { bindTextures, createTexture, imageTexture, linkProgram, uniformOf, useVertices, vertexBuffer, type GroundView, type Program } from "./glKit";
import { BAKE_FRAGMENT, MAX_ROCKS, WATER_FRAGMENT, WATER_VERTEX } from "./waterShader";
import type { WaterGpuField } from "./waterTypes";

/**
 * Passo da água animada (docs/design/agua.md) no renderizador do chão: usa o contexto WebGL 2 dele. Recebe os grupos
 * de água (texturas do Worker), a visão e o tempo, e desenha por cima do terreno (cor pré-multiplicada).
 *
 * Dois passos: quando a água muda, o barranco, o fundo, a luz, a sombra e a profundidade de cada grupo são "assados"
 * numa textura (`bake`); a cada quadro só a superfície da água é calculada, por cima do assado.
 */

interface GpuGroup {
  field: WaterGpuField;
  sdfDeep: WebGLTexture;
  river: WebGLTexture;
  /** Terreno assado (cor iluminada + borda) e dados (profundidade, sombra, distância da água). */
  bakedTerrain: WebGLTexture | null;
  bakedData: WebGLTexture | null;
}

/** Resolução do assado (px por casa) e o lado máximo dele (tempo de desenho e memória limitados). */
const BAKE_PER_CELL = 40;
const MAX_BAKE_SIDE = 2048;

export class WaterPass {
  private readonly bake: Program;
  private readonly water: Program;
  private readonly framebuffer: WebGLFramebuffer | null;
  private readonly quad: WebGLBuffer;
  private groups: GpuGroup[] = [];
  private dirt: WebGLTexture | null = null;

  constructor(private readonly gl: WebGL2RenderingContext) {
    this.bake = linkProgram(gl, WATER_VERTEX, BAKE_FRAGMENT, "aCorner");
    this.water = linkProgram(gl, WATER_VERTEX, WATER_FRAGMENT, "aCorner");
    this.framebuffer = gl.createFramebuffer();
    this.quad = vertexBuffer(gl, [0, 0, 1, 0, 0, 1, 0, 1, 1, 0, 1, 1]);
  }

  private halfTexture(data: Uint16Array, width: number, height: number): WebGLTexture {
    const { gl } = this;
    return createTexture(
      gl,
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
    return createTexture(
      gl,
      () => {
        gl.pixelStorei(gl.UNPACK_ALIGNMENT, 1);
        gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA32F, width, height, 0, gl.RGBA, gl.FLOAT, data);
      },
      gl.NEAREST,
      gl.CLAMP_TO_EDGE,
    );
  }

  /** Aquarela de terra que vira o barranco e o fundo. */
  setDirt(image: TexImageSource) {
    if (this.dirt) this.gl.deleteTexture(this.dirt);
    this.dirt = imageTexture(this.gl, image);
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
      createTexture(gl, () => gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA8, width, height, 0, gl.RGBA, gl.UNSIGNED_BYTE, null), gl.LINEAR, gl.CLAMP_TO_EDGE);
    for (const texture of [group.bakedTerrain, group.bakedData]) if (texture) gl.deleteTexture(texture);
    group.bakedTerrain = target();
    group.bakedData = target();
    gl.bindFramebuffer(gl.FRAMEBUFFER, this.framebuffer);
    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, group.bakedTerrain, 0);
    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT1, gl.TEXTURE_2D, group.bakedData, 0);
    gl.drawBuffers([gl.COLOR_ATTACHMENT0, gl.COLOR_ATTACHMENT1]);
    gl.viewport(0, 0, width, height);
    gl.disable(gl.BLEND);
    gl.clearColor(0, 0, 0, 0);
    gl.clear(gl.COLOR_BUFFER_BIT);
    gl.useProgram(this.bake.program);
    useVertices(gl, this.quad);
    gl.uniform1f(uniformOf(gl, this.bake, "uBake"), 1);
    gl.uniform4f(uniformOf(gl, this.bake, "uRectCells"), rect.col, rect.row, rect.cols, rect.rows);
    gl.uniform1f(uniformOf(gl, this.bake, "uPerCell"), group.field.perCell);
    bindTextures(gl, this.bake, [
      ["uSdfDeep", group.sdfDeep],
      ["uRiver", group.river],
      ["uDirt", this.dirt],
    ]);
    gl.drawArrays(gl.TRIANGLES, 0, 6);
    gl.drawBuffers([gl.COLOR_ATTACHMENT0]);
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
  }

  get empty(): boolean {
    return this.groups.length === 0;
  }

  /** Algum grupo de água aparece na tela agora (para não animar à toa). */
  visible(view: GroundView): boolean {
    return this.groups.some(({ field }) => {
      const left = (view.offsetX + field.rect.col * view.cellPx) * view.scale + view.stageX;
      const top = (view.offsetY + field.rect.row * view.cellPx) * view.scale + view.stageY;
      const right = left + field.rect.cols * view.cellPx * view.scale;
      const bottom = top + field.rect.rows * view.cellPx * view.scale;
      return right > 0 && bottom > 0 && left < view.width && top < view.height;
    });
  }

  /** Desenha a água no alvo ligado (viewport e mistura já postos pelo chão). */
  render(view: GroundView, time: number) {
    const { gl } = this;
    const program = this.water;
    gl.useProgram(program.program);
    useVertices(gl, this.quad);
    gl.uniform1f(uniformOf(gl, program, "uBake"), 0);
    gl.uniform4f(uniformOf(gl, program, "uMapGrid"), view.offsetX, view.offsetY, view.cellPx, 0);
    gl.uniform3f(uniformOf(gl, program, "uStage"), view.stageX, view.stageY, view.scale);
    gl.uniform2f(uniformOf(gl, program, "uScreen"), view.width, view.height);
    gl.uniform1f(uniformOf(gl, program, "uTime"), time);
    for (const group of this.groups) {
      if (!group.bakedTerrain || !group.bakedData) continue;
      const { field } = group;
      bindTextures(gl, program, [
        ["uSdfDeep", group.sdfDeep],
        ["uRiver", group.river],
        ["uBakedTerrain", group.bakedTerrain],
        ["uBakedData", group.bakedData],
      ]);
      gl.uniform4f(uniformOf(gl, program, "uRectCells"), field.rect.col, field.rect.row, field.rect.cols, field.rect.rows);
      gl.uniform1f(uniformOf(gl, program, "uPerCell"), field.perCell);
      const rocks = new Float32Array(MAX_ROCKS * 3);
      field.rocks.slice(0, MAX_ROCKS).forEach((rock, index) => rocks.set([rock.col, rock.row, rock.radius], index * 3));
      gl.uniform3fv(uniformOf(gl, program, "uRocks[0]"), rocks);
      gl.uniform1i(uniformOf(gl, program, "uRockCount"), Math.min(field.rocks.length, MAX_ROCKS));
      gl.drawArrays(gl.TRIANGLES, 0, 6);
    }
  }

  dispose() {
    this.release();
    if (this.dirt) this.gl.deleteTexture(this.dirt);
  }
}
