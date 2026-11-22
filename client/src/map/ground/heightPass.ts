import { createTexture, linkProgram, uniformOf, useVertices, vertexBuffer, type GroundView, type Program } from "./glKit";
import type { PropPass } from "../props/propPass";
import type { TokenCaster } from "./shadowCasters";

/**
 * Mapa de alturas (docs/design/sombras.md): a altura de tudo o que faz sombra, na meia resolução da luz, refeito a
 * cada desenho da luz (os tokens andam). Altura / 4 no canal R, pela maior. Os objetos vêm da forma guardada no atlas
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
  outColor = vec4(uHeight / 4.0, 0.0, 0.0, 1.0);
}`;

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

  /** O mapa de alturas do último desenho (`null` antes do primeiro). */
  get texture(): WebGLTexture | null {
    return this.target;
  }

  /** Tokens que fazem sombra (os que este cliente recebe, já com o arrasto). */
  setTokens(casters: TokenCaster[]) {
    this.casters = casters;
  }

  /** Desenha o mapa de alturas (`width` × `height`: a resolução da luz); `margin` = folga em casas em volta da tela. */
  draw(view: GroundView, width: number, height: number, props: PropPass, time: number, margin: number) {
    const { gl } = this;
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
    props.drawHeights(view, width, height, time, margin);
    if (this.casters.length > 0) {
      gl.useProgram(this.disc.program);
      useVertices(gl, this.square);
      gl.uniform4f(uniformOf(gl, this.disc, "uMapGrid"), view.offsetX, view.offsetY, view.cellPx, 0);
      gl.uniform3f(uniformOf(gl, this.disc, "uStage"), view.stageX, view.stageY, view.scale);
      gl.uniform2f(uniformOf(gl, this.disc, "uScreen"), view.width, view.height);
      gl.enable(gl.BLEND);
      gl.blendEquation(gl.MAX);
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
