import { reliefSampler, STAIR_LOOSE_BELOW, STAIR_SHAPES, stairLoose, stairPath, stairProfile, type ReliefChunks, type Stair, type StairShape } from "@rpg/shared";
import { bindTextures, createTexture, ProgramCache, uniformOf, useVertices, vertexBuffer, type GroundView, type Program } from "./glKit";
import { faceLight, type SceneLight } from "./sceneLight";
import { MAX_STAIR_PRIMS, MAX_STAIR_SEGMENTS, MAX_STAIRS, STAIR_PRIMS_AT, STAIR_ROW, STAIR_SEGMENTS_AT, stairFragment } from "./stairShader";
import { FULLSCREEN_VERTEX } from "./terrainShader";

/** Sombra de um nível de relevo, em casas, por casa de sombra da cena (a mesma conta do relevo e das pontes). */
const LEVEL_SHADOW = 1.6;
/** O que está embaixo das escadas, vindo do resto do renderizador. */
export interface StairGround {
  /** Textura vazia para os samplers sem o que ler (sem relevo): cada sampler na sua unidade. */
  blank: WebGLTexture;
  /** Liga o atlas de altura do relevo ao programa (devolve se há relevo); sem relevo, o chão é o nível 0. */
  bindRelief: (program: Program, extra: [string, WebGLTexture][]) => boolean;
}

/**
 * Uma linha da textura de dados (docs no stairShader.ts): o caminho e o perfil vêm prontos do processador, com a
 * altura do relevo ao longo da linha; a placa só lê. Escada solta (o chão quase não varia): modo 1 subindo, 2 descendo.
 * Caracol: sempre solto (o sentido escolhido). Escada de mão: no relevo (pé e topo em alturas diferentes) os pontos vão
 * da ponta baixa para a alta, encostada na face; solta, do pé para o topo.
 */
function stairRow(stair: Stair, groundAt: (x: number, y: number) => number): Float32Array {
  const row = new Float32Array(STAIR_ROW * 4);
  const shape = STAIR_SHAPES.indexOf(stair.shape);
  const xs = stair.points.map((point) => point.x);
  const ys = stair.points.map((point) => point.y);
  const half = stair.width / 2;
  row.set([Math.min(...xs) - half, Math.min(...ys) - half, Math.max(...xs) + half, Math.max(...ys) + half], 2 * 4);
  const material = stair.material === "wood" ? 1 : 0;
  if (stair.shape !== "path") {
    const [first, second] = stair.points;
    const span = Math.hypot(second.x - first.x, second.y - first.y);
    const level = (x: number, y: number) => {
      const value = groundAt(x, y);
      return Number.isFinite(value) ? value : 0;
    };
    const foot = level(first.x, first.y);
    const top = level(second.x, second.y);
    const onRelief = stair.shape === "ladder" && Math.abs(top - foot) >= STAIR_LOOSE_BELOW;
    const [low, high] = onRelief && top < foot ? [second, first] : [first, second];
    row.set([stair.width, material, onRelief ? 0 : stair.exit === "up" ? 1 : 2, span], 0);
    row.set([shape, 0, 0, Math.min(foot, top)], 4);
    row.set([low.x, low.y, high.x, high.y], STAIR_PRIMS_AT * 4);
    return row;
  }
  const path = stairPath(stair.points);
  const prims = path.prims.slice(0, MAX_STAIR_PRIMS);
  const segments = stairProfile(path, groundAt, stair.exit).slice(0, MAX_STAIR_SEGMENTS);
  // perfil cortado (raro: chão muito ondulado): o último trecho vai até o fim do caminho
  const last = segments[segments.length - 1];
  if (last) last.to = path.length;
  const loose = stairLoose(path, groundAt);
  const mode = loose ? (stair.exit === "up" ? 1 : 2) : 0;
  row.set([stair.width, material, mode, path.length], 0);
  row.set([shape, prims.length, segments.length, segments[0]?.fromLevel ?? 0], 4);
  prims.forEach((prim, index) => {
    const at = (STAIR_PRIMS_AT + index * 2) * 4;
    if (prim.kind === "line") row.set([prim.from.x, prim.from.y, prim.to.x, prim.to.y, prim.start, 0, 0, 0], at);
    else row.set([prim.center.x, prim.center.y, prim.radius, prim.angle, prim.start, 1, 0, prim.sweep], at);
  });
  segments.forEach((segment, index) => {
    row.set([segment.from, segment.to, segment.fromLevel, segment.toLevel, segment.steps, 0, 0, 0], (STAIR_SEGMENTS_AT + index * 2) * 4);
  });
  return row;
}

/**
 * Passo das escadas do renderizador do chão (docs/design/escadas.md): a lista vai numa textura de dados (até
 * `MAX_STAIRS` linhas), um programa por formato presente, desenhados em ordem no alvo ligado (cor pré-multiplicada),
 * por cima das pontes. Os programas compilam em paralelo; enquanto um compila, `pending` pede mais quadros.
 */
export class StairPass {
  private readonly triangle: WebGLBuffer;
  private readonly programs: ProgramCache<StairShape>;
  private readonly dataTexture: WebGLTexture;
  private count = 0;
  private present = new Set<StairShape>();

  constructor(private readonly gl: WebGL2RenderingContext) {
    this.triangle = vertexBuffer(gl, [-1, -1, 3, -1, -1, 3]);
    this.programs = new ProgramCache(gl, FULLSCREEN_VERTEX);
    this.dataTexture = createTexture(gl, () => gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA32F, STAIR_ROW, 1, 0, gl.RGBA, gl.FLOAT, new Float32Array(STAIR_ROW * 4)), gl.NEAREST, gl.CLAMP_TO_EDGE);
  }

  get empty(): boolean {
    return this.count === 0;
  }

  /** Algum programa em uso ainda compilando. */
  get pending(): boolean {
    return !this.empty && this.programs.pending;
  }

  /** Começa a compilar o formato escolhido na ferramenta, antes da primeira escada dele. */
  warm(shape: StairShape) {
    this.programs.warm(shape, () => stairFragment(shape));
  }

  /** Escadas da cena e o relevo (o perfil segue a altura do chão ao longo da linha). */
  setStairs(stairs: Stair[], relief: ReliefChunks) {
    const { gl } = this;
    const list = stairs.slice(0, MAX_STAIRS);
    const groundAt = reliefSampler(relief);
    const rows = Math.max(1, list.length);
    const pixels = new Float32Array(STAIR_ROW * 4 * rows);
    this.present = new Set();
    list.forEach((stair, index) => {
      pixels.set(stairRow(stair, groundAt), index * STAIR_ROW * 4);
      this.present.add(stair.shape);
    });
    gl.bindTexture(gl.TEXTURE_2D, this.dataTexture);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA32F, STAIR_ROW, rows, 0, gl.RGBA, gl.FLOAT, pixels);
    this.count = list.length;
  }

  /** Desenha as escadas no alvo ligado (com as pontes já desenhadas), na tela inteira; cor pré-multiplicada. */
  draw(view: GroundView, width: number, height: number, scene: SceneLight, ground: StairGround) {
    const { gl } = this;
    this.programs.beginDraw();
    if (this.empty) return;
    const light = faceLight(scene);
    const shift = scene.shadowCells > 0.01 ? scene.shadowCells * LEVEL_SHADOW : 0;
    gl.enable(gl.BLEND);
    gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
    for (const shape of STAIR_SHAPES) {
      if (!this.present.has(shape)) continue;
      const program = this.programs.get(shape, () => stairFragment(shape));
      if (!program) continue;
      const extra: [string, WebGLTexture][] = [["uStairData", this.dataTexture]];
      const relief = ground.bindRelief(program, extra);
      if (!relief) {
        gl.useProgram(program.program);
        useVertices(gl, this.triangle);
        // sem relevo: os samplers dele também na textura vazia (senão caem na unidade 0, com outra textura)
        bindTextures(gl, program, [...extra, ["uReliefIndex", ground.blank], ["uReliefA", ground.blank], ["uReliefB", ground.blank], ["uReliefShadow", ground.blank], ["uReliefShadowPrevious", ground.blank]]);
        gl.uniform4f(uniformOf(gl, program, "uMapGrid"), view.offsetX, view.offsetY, view.cellPx, 0);
        gl.uniform3f(uniformOf(gl, program, "uStage"), view.stageX, view.stageY, view.scale);
        gl.uniform2f(uniformOf(gl, program, "uScreen"), view.width, view.height);
        gl.uniform2f(uniformOf(gl, program, "uCanvas"), width, height);
      }
      gl.uniform1f(uniformOf(gl, program, "uHasRelief"), relief ? 1 : 0);
      gl.uniform1i(uniformOf(gl, program, "uStairCount"), this.count);
      gl.uniform2f(uniformOf(gl, program, "uSunShift"), scene.sunDirection[0] * shift, scene.sunDirection[1] * shift);
      gl.uniform3f(uniformOf(gl, program, "uLightDir"), ...light.direction);
      gl.uniform1f(uniformOf(gl, program, "uLightAmount"), light.amount);
      gl.uniform1f(uniformOf(gl, program, "uAmbientLum"), light.ambientLum);
      gl.uniform1f(uniformOf(gl, program, "uSunLum"), light.sunLum);
      gl.drawArrays(gl.TRIANGLES, 0, 3);
    }
    gl.disable(gl.BLEND);
  }

  dispose() {
    this.programs.dispose();
    this.gl.deleteBuffer(this.triangle);
    this.gl.deleteTexture(this.dataTexture);
  }
}
