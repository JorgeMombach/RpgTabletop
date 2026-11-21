import { BRIDGE_KINDS, reliefAt, TERRAIN_FINE, type Bridge, type BridgeKind, type ReliefChunks } from "@rpg/shared";
import { bindTextures, ProgramCache, uniformOf, useVertices, vertexBuffer, type GroundView, type Program } from "./glKit";
import { bridgeFragment, MAX_BRIDGES } from "./bridgeShader";
import { faceLight, type SceneLight } from "./sceneLight";
import { FULLSCREEN_VERTEX } from "./terrainShader";

/** Sombra de um nível de relevo, em casas, por casa de sombra da cena (a mesma conta do relevo). */
const LEVEL_SHADOW = 1.6;

/** O que está embaixo das pontes, vindo do resto do renderizador. */
export interface BridgeGround {
  /** Textura vazia para os samplers sem o que ler (sem terreno, sem relevo): cada sampler na sua unidade. */
  blank: WebGLTexture;
  /** Pesos da água (segunda textura, canal a) e da água funda (terceira, canal r), com a origem e o tamanho. */
  water: { second: WebGLTexture; third: WebGLTexture; origin: [number, number]; size: [number, number] } | null;
  /** Liga o atlas de altura do relevo ao programa (devolve se há relevo); sem relevo, o chão é o nível 0. */
  bindRelief: (program: Program, extra: [string, WebGLTexture][]) => boolean;
}

/**
 * Passo das pontes do renderizador do chão (docs/design/pontes.md): a lista vai em uniforms (até `MAX_BRIDGES`), com o
 * nível do relevo em cada ponta (lido aqui, no processador); um programa por tipo presente, desenhados em ordem no alvo
 * ligado (cor pré-multiplicada). Os programas compilam em paralelo; enquanto um compila, `pending` pede mais quadros.
 */
export class BridgePass {
  private readonly triangle: WebGLBuffer;
  private readonly programs: ProgramCache<BridgeKind>;
  private ends = new Float32Array(MAX_BRIDGES * 4);
  private info = new Float32Array(MAX_BRIDGES * 4);
  private count = 0;
  private present = new Set<BridgeKind>();

  constructor(private readonly gl: WebGL2RenderingContext) {
    this.triangle = vertexBuffer(gl, [-1, -1, 3, -1, -1, 3]);
    this.programs = new ProgramCache(gl, FULLSCREEN_VERTEX);
  }

  get empty(): boolean {
    return this.count === 0;
  }

  /** Algum programa em uso ainda compilando. */
  get pending(): boolean {
    return !this.empty && this.programs.pending;
  }

  /** Começa a compilar o tipo escolhido na ferramenta, antes da primeira ponte dele. */
  warm(kind: BridgeKind) {
    this.programs.warm(kind, () => bridgeFragment(kind));
  }

  /** Pontes da cena e o relevo (o nível de cada ponta sai do ponto fino mais perto). */
  setBridges(bridges: Bridge[], relief: ReliefChunks) {
    const levelAt = (x: number, y: number) => reliefAt(relief, Math.round(x * TERRAIN_FINE), Math.round(y * TERRAIN_FINE)).level;
    const list = bridges.slice(0, MAX_BRIDGES);
    this.ends = new Float32Array(MAX_BRIDGES * 4);
    this.info = new Float32Array(MAX_BRIDGES * 4);
    this.present = new Set();
    list.forEach((bridge, index) => {
      this.ends.set([bridge.from.x, bridge.from.y, bridge.to.x, bridge.to.y], index * 4);
      this.info.set([bridge.width, levelAt(bridge.from.x, bridge.from.y), levelAt(bridge.to.x, bridge.to.y), BRIDGE_KINDS.indexOf(bridge.kind)], index * 4);
      this.present.add(bridge.kind);
    });
    this.count = list.length;
  }

  /** Desenha as pontes no alvo ligado (já limpo), na tela inteira; cor pré-multiplicada. */
  draw(view: GroundView, width: number, height: number, scene: SceneLight, ground: BridgeGround) {
    const { gl } = this;
    this.programs.beginDraw();
    if (this.empty) return;
    const light = faceLight(scene);
    const sunny = scene.shadowCells > 0.01;
    const shift = sunny ? scene.shadowCells * LEVEL_SHADOW : 0;
    gl.enable(gl.BLEND);
    gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
    for (const kind of BRIDGE_KINDS) {
      if (!this.present.has(kind)) continue;
      const program = this.programs.get(kind, () => bridgeFragment(kind));
      if (!program) continue;
      const water = ground.water;
      const extra: [string, WebGLTexture][] = [
        ["uWaterA", water ? water.second : ground.blank],
        ["uWaterB", water ? water.third : ground.blank],
      ];
      const relief = ground.bindRelief(program, extra);
      if (!relief) {
        gl.useProgram(program.program);
        useVertices(gl, this.triangle);
        // sem relevo: os samplers dele também na textura vazia (senão caem na unidade 0, com a imagem desenhada)
        bindTextures(gl, program, [...extra, ["uReliefIndex", ground.blank], ["uReliefA", ground.blank], ["uReliefB", ground.blank], ["uReliefShadow", ground.blank], ["uReliefShadowPrevious", ground.blank]]);
        gl.uniform4f(uniformOf(gl, program, "uMapGrid"), view.offsetX, view.offsetY, view.cellPx, 0);
        gl.uniform3f(uniformOf(gl, program, "uStage"), view.stageX, view.stageY, view.scale);
        gl.uniform2f(uniformOf(gl, program, "uScreen"), view.width, view.height);
        gl.uniform2f(uniformOf(gl, program, "uCanvas"), width, height);
      }
      gl.uniform1f(uniformOf(gl, program, "uHasRelief"), relief ? 1 : 0);
      gl.uniform1f(uniformOf(gl, program, "uHasWater"), water ? 1 : 0);
      if (water) {
        gl.uniform2f(uniformOf(gl, program, "uWeightsOrigin"), ...water.origin);
        gl.uniform2f(uniformOf(gl, program, "uWeightsSize"), ...water.size);
      }
      gl.uniform4fv(uniformOf(gl, program, "uBridgeEnds[0]"), this.ends);
      gl.uniform4fv(uniformOf(gl, program, "uBridgeInfo[0]"), this.info);
      gl.uniform1i(uniformOf(gl, program, "uBridgeCount"), this.count);
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
  }
}
