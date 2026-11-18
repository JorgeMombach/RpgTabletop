import { bindTextures, createTexture, imageTexture, linkProgram, uniformOf, useVertices, vertexBuffer, type GroundView, type Program } from "./glKit";
import { BAKE_FRAGMENT, MAX_ROCKS, WATER_FRAGMENT, WATER_VERTEX } from "./waterShader";
import type { WaterGpuField } from "./waterTypes";

/**
 * Passo da água animada (docs/design/agua.md) no renderizador do chão: usa o contexto WebGL 2 dele. Recebe os grupos
 * de água (texturas do Worker), a visão e o tempo, e desenha por cima do terreno (cor pré-multiplicada).
 *
 * Dois passos: quando a visão ou a água mudam, o barranco, o fundo, a luz, a sombra e a profundidade dos grupos na tela
 * são "assados" em texturas do tamanho da tela (`bakeView`, nítido em qualquer zoom); a cada quadro só a superfície da
 * água é calculada, por cima do assado.
 */

interface GpuGroup {
  field: WaterGpuField;
  sdfDeep: WebGLTexture;
  river: WebGLTexture;
}

export class WaterPass {
  private readonly bake: Program;
  private readonly water: Program;
  private readonly framebuffer: WebGLFramebuffer | null;
  private readonly quad: WebGLBuffer;
  private groups: GpuGroup[] = [];
  private dirt: WebGLTexture | null = null;
  /** Assado do tamanho da tela: terreno (cor iluminada + borda) e dados (profundidade, sombra, distância da água). */
  private baked: { terrain: WebGLTexture; data: WebGLTexture; width: number; height: number } | null = null;
  /** O que valia no último assado (visão, tamanho, grupos, terra): refaz só se mudar. */
  private bakedFor = "";
  /** Sobe a cada troca de grupos ou da terra. */
  private version = 0;

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
    this.version++;
  }

  /** Troca os grupos de água (o que o Worker calculou) e assa o terreno de cada um. */
  setFields(fields: WaterGpuField[]) {
    this.release();
    this.groups = fields.map((field) => ({
      field,
      sdfDeep: this.halfTexture(field.sdfDeep, field.width, field.height),
      river: this.floatTexture(field.river, field.width, field.height),
    }));
    this.version++;
  }

  private release() {
    const { gl } = this;
    for (const group of this.groups) {
      for (const texture of [group.sdfDeep, group.river]) gl.deleteTexture(texture);
    }
    this.groups = [];
  }

  private releaseBaked() {
    if (!this.baked) return;
    this.gl.deleteTexture(this.baked.terrain);
    this.gl.deleteTexture(this.baked.data);
    this.baked = null;
  }

  /**
   * Assa o barranco, o fundo, a luz, a sombra e a profundidade dos grupos na tela, na resolução da tela (precisa da
   * aquarela de terra). Só refaz quando a visão, o tamanho, os grupos ou a terra mudam.
   */
  bakeView(view: GroundView, width: number, height: number) {
    const { gl } = this;
    if (!this.dirt || !this.framebuffer) return;
    const key = [view.offsetX, view.offsetY, view.cellPx, view.stageX, view.stageY, view.scale, view.width, view.height, width, height, this.version].join("|");
    if (key === this.bakedFor && this.baked) return;
    this.bakedFor = key;
    if (!this.baked || this.baked.width !== width || this.baked.height !== height) {
      this.releaseBaked();
      const target = () => createTexture(gl, () => gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA8, width, height, 0, gl.RGBA, gl.UNSIGNED_BYTE, null), gl.LINEAR, gl.CLAMP_TO_EDGE);
      this.baked = { terrain: target(), data: target(), width, height };
    }
    gl.bindFramebuffer(gl.FRAMEBUFFER, this.framebuffer);
    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, this.baked.terrain, 0);
    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT1, gl.TEXTURE_2D, this.baked.data, 0);
    gl.drawBuffers([gl.COLOR_ATTACHMENT0, gl.COLOR_ATTACHMENT1]);
    gl.viewport(0, 0, width, height);
    gl.disable(gl.BLEND);
    gl.clearColor(0, 0, 0, 0);
    gl.clear(gl.COLOR_BUFFER_BIT);
    gl.useProgram(this.bake.program);
    useVertices(gl, this.quad);
    // O retângulo de cada grupo vai para o lugar dele na tela (o mesmo da superfície).
    gl.uniform1f(uniformOf(gl, this.bake, "uBake"), 0);
    gl.uniform4f(uniformOf(gl, this.bake, "uMapGrid"), view.offsetX, view.offsetY, view.cellPx, 0);
    gl.uniform3f(uniformOf(gl, this.bake, "uStage"), view.stageX, view.stageY, view.scale);
    gl.uniform2f(uniformOf(gl, this.bake, "uScreen"), view.width, view.height);
    gl.uniform1f(uniformOf(gl, this.bake, "uPxUnits"), 48 / Math.max(1e-6, view.cellPx * view.scale * (width / view.width)));
    for (const group of this.groups) {
      if (!this.onScreen(group.field, view)) continue;
      const { rect } = group.field;
      gl.uniform4f(uniformOf(gl, this.bake, "uRectCells"), rect.col, rect.row, rect.cols, rect.rows);
      gl.uniform1f(uniformOf(gl, this.bake, "uPerCell"), group.field.perCell);
      bindTextures(gl, this.bake, [
        ["uSdfDeep", group.sdfDeep],
        ["uRiver", group.river],
        ["uDirt", this.dirt],
      ]);
      gl.drawArrays(gl.TRIANGLES, 0, 6);
    }
    gl.drawBuffers([gl.COLOR_ATTACHMENT0]);
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
  }

  /** O retângulo do grupo aparece na tela. */
  private onScreen(field: WaterGpuField, view: GroundView): boolean {
    const left = (view.offsetX + field.rect.col * view.cellPx) * view.scale + view.stageX;
    const top = (view.offsetY + field.rect.row * view.cellPx) * view.scale + view.stageY;
    const right = left + field.rect.cols * view.cellPx * view.scale;
    const bottom = top + field.rect.rows * view.cellPx * view.scale;
    return right > 0 && bottom > 0 && left < view.width && top < view.height;
  }

  get empty(): boolean {
    return this.groups.length === 0;
  }

  /** Algum grupo de água aparece na tela agora (para não animar à toa). */
  visible(view: GroundView): boolean {
    return this.groups.some(({ field }) => this.onScreen(field, view));
  }

  /** Desenha a água no alvo ligado (viewport e mistura já postos pelo chão). */
  render(view: GroundView, time: number, width: number, height: number) {
    const { gl } = this;
    const baked = this.baked;
    if (!baked) return;
    const program = this.water;
    gl.useProgram(program.program);
    useVertices(gl, this.quad);
    gl.uniform1f(uniformOf(gl, program, "uBake"), 0);
    gl.uniform4f(uniformOf(gl, program, "uMapGrid"), view.offsetX, view.offsetY, view.cellPx, 0);
    gl.uniform3f(uniformOf(gl, program, "uStage"), view.stageX, view.stageY, view.scale);
    gl.uniform2f(uniformOf(gl, program, "uScreen"), view.width, view.height);
    gl.uniform1f(uniformOf(gl, program, "uTime"), time);
    gl.uniform2f(uniformOf(gl, program, "uCanvas"), width, height);
    gl.uniform1f(uniformOf(gl, program, "uCellDevice"), view.cellPx * view.scale * (width / view.width));
    for (const group of this.groups) {
      const { field } = group;
      if (!this.onScreen(field, view)) continue;
      bindTextures(gl, program, [
        ["uSdfDeep", group.sdfDeep],
        ["uRiver", group.river],
        ["uBakedTerrain", baked.terrain],
        ["uBakedData", baked.data],
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
    this.releaseBaked();
    if (this.dirt) this.gl.deleteTexture(this.dirt);
  }
}
