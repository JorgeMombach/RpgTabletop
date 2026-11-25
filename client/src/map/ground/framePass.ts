import type { SceneFrame, TableStyle } from "@rpg/shared";
import { TILE_CELLS, tableTile } from "../tableArt";
import { createTexture, linkProgram, uniformOf, useVertices, vertexBuffer, type GroundView, type Program } from "./glKit";
import { FRAME_FRAGMENT } from "./frameShader";
import { FULLSCREEN_VERTEX } from "./terrainShader";

/**
 * Moldura da cena (docs/design/moldura.md): numa imagem só, a mesa fora da cena, a moldura (por pixel) e a sombra
 * dela sobre a cena. Desenhada a cada desenho completo do chão (muda com a visão); parada, não pesa nada.
 */

/** A moldura da cena e a mesa em volta. */
export interface FrameInput {
  frame: SceneFrame;
  tableStyle: TableStyle;
}

/** Espessura da moldura, em casas. */
const FRAME_CELLS = 0.75;

const STYLE_INDEX: Record<SceneFrame["style"], number> = { wood: 0, iron: 1, stone: 2, bronze: 3 };

export class FramePass {
  private input: FrameInput | null = null;
  private program: Program | null = null;
  private table: { style: TableStyle; texture: WebGLTexture } | null = null;
  private readonly triangle: WebGLBuffer;

  constructor(private readonly gl: WebGL2RenderingContext) {
    this.triangle = vertexBuffer(gl, [-1, -1, 3, -1, -1, 3]);
  }

  /** Há moldura na cena. */
  get active(): boolean {
    return this.input !== null;
  }

  set(input: FrameInput | null) {
    this.input = input;
  }

  /** A mesa, a moldura e a sombra no alvo ligado (tela inteira, cor pré-multiplicada). */
  draw(view: GroundView, width: number, height: number) {
    const { gl } = this;
    const input = this.input;
    if (!input) return;
    const program = (this.program ??= linkProgram(gl, FULLSCREEN_VERTEX, FRAME_FRAGMENT, "aPos"));
    const texture = this.tableTexture(input.tableStyle);
    // a cena (da casa 0, 0 até cols × rows) em px do canvas, com o y para baixo
    const ratio = width / view.width;
    const toCanvas = (mapPx: number, stage: number) => (stage + mapPx * view.scale) * ratio;
    const x = toCanvas(view.offsetX, view.stageX);
    const y = toCanvas(view.offsetY, view.stageY);
    const side = view.cellPx * view.scale * ratio;
    gl.viewport(0, 0, width, height);
    gl.disable(gl.BLEND);
    gl.useProgram(program.program);
    useVertices(gl, this.triangle);
    gl.uniform2f(uniformOf(gl, program, "uSize"), width, height);
    gl.uniform4f(uniformOf(gl, program, "uRect"), x, y, input.frame.cols * side, input.frame.rows * side);
    gl.uniform1f(uniformOf(gl, program, "uT"), FRAME_CELLS * side);
    gl.uniform1i(uniformOf(gl, program, "uStyle"), STYLE_INDEX[input.frame.style]);
    gl.uniform3f(uniformOf(gl, program, "uTableMap"), view.offsetX, view.offsetY, TILE_CELLS[input.tableStyle] * view.cellPx);
    gl.uniform3f(uniformOf(gl, program, "uStage"), view.stageX, view.stageY, view.scale);
    gl.uniform2f(uniformOf(gl, program, "uScreen"), view.width, view.height);
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, texture);
    gl.uniform1i(uniformOf(gl, program, "uTable"), 0);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
  }

  /** O ladrilho da mesa (o mesmo do Konva), enviado uma vez por estilo; repete em volta. */
  private tableTexture(style: TableStyle): WebGLTexture {
    const { gl } = this;
    if (this.table?.style === style) return this.table.texture;
    if (this.table) gl.deleteTexture(this.table.texture);
    const tile = tableTile(style);
    const texture = createTexture(gl, () => gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, tile), gl.LINEAR_MIPMAP_LINEAR, gl.REPEAT);
    gl.generateMipmap(gl.TEXTURE_2D);
    this.table = { style, texture };
    return texture;
  }

  dispose() {
    const { gl } = this;
    if (this.program) gl.deleteProgram(this.program.program);
    if (this.table) gl.deleteTexture(this.table.texture);
    gl.deleteBuffer(this.triangle);
  }
}
