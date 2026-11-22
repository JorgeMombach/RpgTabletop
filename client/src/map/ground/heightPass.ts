import { createTexture, linkProgram, uniformOf, useVertices, vertexBuffer, type GroundView, type Program } from "./glKit";
import type { PropPass } from "../props/propPass";
import type { TokenCaster } from "./shadowCasters";

/**
 * Mapa de alturas (docs/design/sombras.md): a altura de tudo o que faz sombra, na meia resolução da luz, refeito a
 * cada desenho da luz (os tokens andam). Em casas / 4: topo no R e onde começa a copa no G, pela maior; onde começa o
 * que bloqueia no A, pela menor (a copa começa no alto e a luz baixa passa por baixo dela; o resto, no chão; sem nada, 4). Os objetos vêm da forma guardada no atlas
 * (`PropPass.drawHeights`); os tokens, um disco no centro com a altura do tamanho. A luz anda nele até o sol, a lua
 * ou a tocha e vê se algo mais alto está no caminho.
 */

const DISC_VERTEX = `#version 300 es
in vec2 aPos;
uniform vec4 uMapGrid;
uniform vec3 uStage;
uniform vec2 uScreen;
uniform vec3 uDisc;   // centro (casas) e raio
out vec2 vWorld;
void main() {
  vec2 world = uDisc.xy + aPos * (uDisc.z + 0.05);
  vWorld = world;
  vec2 screen = (world * uMapGrid.z + uMapGrid.xy) * uStage.z + uStage.xy;
  gl_Position = vec4(screen.x / uScreen.x * 2.0 - 1.0, 1.0 - screen.y / uScreen.y * 2.0, 0.0, 1.0);
}`;

const DISC_FRAGMENT = `#version 300 es
precision highp float;
in vec2 vWorld;
out vec4 outColor;
uniform vec3 uDisc;
uniform float uHeight;
void main() {
  if (distance(vWorld, uDisc.xy) > uDisc.z) discard;
  outColor = vec4(uHeight / 4.0, 0.0, 0.0, 0.0);
}`;

/** Lado máximo do mapa de alturas (px). */
const MAX_SIDE = 2048;

/** Área coberta pelo mapa de alturas, em casas. */
export interface HeightArea {
  x: number;
  y: number;
  cols: number;
  rows: number;
}

/** O mapa de alturas pronto, para quem anda nele (a luz do sol, da lua e das tochas). */
export interface HeightMap {
  texture: WebGLTexture;
  area: HeightArea;
}

export class HeightPass {
  private readonly disc: Program;
  private readonly square: WebGLBuffer;
  private readonly framebuffer: WebGLFramebuffer | null;
  private target: WebGLTexture | null = null;
  private size = { width: 0, height: 0 };
  private casters: TokenCaster[] = [];

  constructor(private readonly gl: WebGL2RenderingContext) {
    this.disc = linkProgram(gl, DISC_VERTEX, DISC_FRAGMENT, "aPos");
    this.square = vertexBuffer(gl, [-1, -1, 1, -1, -1, 1, -1, 1, 1, -1, 1, 1]);
    this.framebuffer = gl.createFramebuffer();
  }

  /** Área do mapa de alturas no último desenho, em casas: canto e tamanho (a tela mais a faixa em volta). */
  private area: HeightArea = { x: 0, y: 0, cols: 1, rows: 1 };

  /** O mapa de alturas do último desenho e a área que ele cobre (`null` antes do primeiro). */
  get output(): HeightMap | null {
    return this.target ? { texture: this.target, area: this.area } : null;
  }

  /** Tokens que fazem sombra (os que este cliente recebe, já com o arrasto). */
  setTokens(casters: TokenCaster[]) {
    this.casters = casters;
  }

  /**
   * Desenha o mapa de alturas: a tela mais `margin` casas em volta (de onde uma sombra ou a luz de uma tocha alcança a
   * tela), na densidade `ratio` (pixels do mapa por pixel CSS da tela: a da luz), com teto de tamanho.
   */
  draw(view: GroundView, ratio: number, props: PropPass, time: number, margin: number) {
    const { gl } = this;
    // folga em pixels CSS, no máximo 3/4 da tela de cada lado (bem de perto, a sombra de longe fica de fora)
    const extra = Math.min(margin * view.cellPx * view.scale, Math.max(view.width, view.height) * 0.75);
    const wide: GroundView = { ...view, stageX: view.stageX + extra, stageY: view.stageY + extra, width: view.width + extra * 2, height: view.height + extra * 2 };
    const density = Math.min(ratio, MAX_SIDE / wide.width, MAX_SIDE / wide.height);
    const width = Math.max(1, Math.ceil(wide.width * density));
    const height = Math.max(1, Math.ceil(wide.height * density));
    this.area = {
      x: (-wide.stageX / wide.scale - wide.offsetX) / wide.cellPx,
      y: (-wide.stageY / wide.scale - wide.offsetY) / wide.cellPx,
      cols: wide.width / wide.scale / wide.cellPx,
      rows: wide.height / wide.scale / wide.cellPx,
    };
    if (!this.target || this.size.width !== width || this.size.height !== height) {
      if (this.target) gl.deleteTexture(this.target);
      this.target = createTexture(gl, () => gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA8, width, height, 0, gl.RGBA, gl.UNSIGNED_BYTE, null), gl.LINEAR, gl.CLAMP_TO_EDGE);
      this.size = { width, height };
    }
    gl.bindFramebuffer(gl.FRAMEBUFFER, this.framebuffer);
    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, this.target, 0);
    gl.viewport(0, 0, width, height);
    gl.clearColor(0, 0, 0, 1);
    gl.clear(gl.COLOR_BUFFER_BIT);
    props.drawHeights(wide, width, height, time, margin);
    if (this.casters.length > 0) {
      gl.useProgram(this.disc.program);
      useVertices(gl, this.square);
      gl.uniform4f(uniformOf(gl, this.disc, "uMapGrid"), wide.offsetX, wide.offsetY, wide.cellPx, 0);
      gl.uniform3f(uniformOf(gl, this.disc, "uStage"), wide.stageX, wide.stageY, wide.scale);
      gl.uniform2f(uniformOf(gl, this.disc, "uScreen"), wide.width, wide.height);
      gl.enable(gl.BLEND);
      gl.blendEquationSeparate(gl.MAX, gl.MIN);
      for (const caster of this.casters) {
        gl.uniform3f(uniformOf(gl, this.disc, "uDisc"), caster.x, caster.y, caster.radius);
        gl.uniform1f(uniformOf(gl, this.disc, "uHeight"), caster.height);
        gl.drawArrays(gl.TRIANGLES, 0, 6);
      }
      gl.blendEquation(gl.FUNC_ADD);
      gl.disable(gl.BLEND);
    }
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
  }

  dispose() {
    const { gl } = this;
    gl.deleteProgram(this.disc.program);
    gl.deleteBuffer(this.square);
    gl.deleteFramebuffer(this.framebuffer);
    if (this.target) gl.deleteTexture(this.target);
  }
}
