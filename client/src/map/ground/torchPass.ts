import type { MapTorchStyle } from "@rpg/shared";
import { cellRectOnScreen, ProgramCache, uniformOf, useVertices, type GroundView } from "./glKit";
import { GEOMETRY_VERTEX } from "./lightShader";
import { torchFragment } from "./torchShader";

/** Uma fonte de luz fixa para desenhar (docs/design/luzes.md): base já com o arrasto, em casas. */
export interface TorchDraw {
  style: MapTorchStyle;
  /** Índice da cor (`MAP_TORCH_COLORS`). */
  color: number;
  x: number;
  y: number;
  /** Tamanho do desenho, em casas. */
  cells: number;
  /** Direção da arandela, em radianos. */
  facing: number;
  seed: number;
}

/** Folga do quadrado em volta da fonte (no tamanho do desenho): cobre as chamas mais altas e o halo. */
const BOX = 1.4;

/**
 * Passo das fontes de luz fixas: um quadrado por fonte na tela, com o programa do modelo dela. O corpo sai com mistura
 * normal; o brilho, na saída das chamas (somado).
 */
export class TorchPass {
  private readonly programs: ProgramCache<MapTorchStyle>;
  private readonly boxes: WebGLBuffer;
  /** Os quadrados já enviados (o mesmo quadro desenha o brilho e o corpo com eles). */
  private sent = "";

  constructor(private readonly gl: WebGL2RenderingContext) {
    this.programs = new ProgramCache(gl, GEOMETRY_VERTEX, "aCell");
    const buffer = gl.createBuffer();
    if (!buffer) throw new Error("buffer");
    this.boxes = buffer;
  }

  /** Começa a compilar os programas dos modelos na cena (para não travar no primeiro desenho). */
  warm(styles: Iterable<MapTorchStyle>) {
    for (const style of styles) this.programs.get(style, () => torchFragment(style));
  }

  /**
   * Desenha as fontes na tela (no framebuffer já ligado). `glow` = a passada do brilho. Devolve se algum programa ainda
   * compilava (precisa de outro quadro).
   */
  render(view: GroundView, time: number, glow: boolean, night: number, lightFrom: [number, number], torches: TorchDraw[]): boolean {
    const { gl } = this;
    this.programs.beginDraw();
    const shown = torches.filter((torch) => cellRectOnScreen(view, torch.x - torch.cells * BOX, torch.y - torch.cells * BOX, torch.cells * BOX * 2, torch.cells * BOX * 2));
    if (shown.length === 0) return false;
    const corners: number[] = [];
    for (const torch of shown) {
      const reach = torch.cells * BOX;
      const [left, top, right, bottom] = [torch.x - reach, torch.y - reach, torch.x + reach, torch.y + reach];
      corners.push(left, top, right, top, left, bottom, left, bottom, right, top, right, bottom);
    }
    const key = corners.join(",");
    if (key !== this.sent) {
      gl.bindBuffer(gl.ARRAY_BUFFER, this.boxes);
      gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(corners), gl.DYNAMIC_DRAW);
      this.sent = key;
    }
    useVertices(gl, this.boxes);
    gl.enable(gl.BLEND);
    gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
    let pending = false;
    shown.forEach((torch, index) => {
      const program = this.programs.get(torch.style, () => torchFragment(torch.style));
      if (!program) {
        pending = true;
        return;
      }
      gl.useProgram(program.program);
      gl.uniform4f(uniformOf(gl, program, "uMapGrid"), view.offsetX, view.offsetY, view.cellPx, 0);
      gl.uniform3f(uniformOf(gl, program, "uStage"), view.stageX, view.stageY, view.scale);
      gl.uniform2f(uniformOf(gl, program, "uScreen"), view.width, view.height);
      gl.uniform4f(uniformOf(gl, program, "uTorch"), torch.x, torch.y, torch.cells, torch.facing);
      gl.uniform1i(uniformOf(gl, program, "uColor"), torch.color);
      gl.uniform1f(uniformOf(gl, program, "uSeed"), torch.seed);
      gl.uniform1f(uniformOf(gl, program, "uTime"), time);
      gl.uniform1f(uniformOf(gl, program, "uGlow"), glow ? 1 : 0);
      gl.uniform1f(uniformOf(gl, program, "uDevicePerCell"), view.cellPx * view.scale * view.pixelRatio);
      gl.uniform1f(uniformOf(gl, program, "uDpr"), view.pixelRatio);
      gl.uniform1f(uniformOf(gl, program, "uNight"), night);
      gl.uniform2f(uniformOf(gl, program, "uLightFrom"), lightFrom[0], lightFrom[1]);
      gl.uniform1f(uniformOf(gl, program, "uBodyLift"), 1);
      gl.drawArrays(gl.TRIANGLES, index * 6, 6);
    });
    gl.disable(gl.BLEND);
    return pending;
  }

  dispose() {
    this.programs.dispose();
    this.gl.deleteBuffer(this.boxes);
  }
}
