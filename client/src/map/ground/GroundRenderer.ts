import { terrainBounds, terrainWeights, TERRAINS, type ChunkRect, type TerrainChunks } from "@rpg/shared";
import type { DetailKind } from "../terrain/terrainArt";
import { bindTextures, createTexture, imageTexture, linkProgram, uniformOf, useVertices, vertexBuffer, type GroundView, type Program } from "./glKit";
import { BLIT_FRAGMENT, DETAIL_KINDS, FULLSCREEN_VERTEX, TERRAIN_FRAGMENT } from "./terrainShader";
import { LightPass, type LightingInput } from "./lightPass";
import { WaterPass } from "./waterPass";
import type { WaterGpuField } from "./waterTypes";

/**
 * Renderizador do chão (docs/design/renderizador-chao.md): um contexto WebGL 2 que desenha o terreno pintado e a água
 * animada, num canvas do tamanho da tela. Não conhece Konva nem React; é a semente do motor novo do mapa.
 *
 * O terreno é desenhado numa textura do tamanho da tela só quando a visão, o terreno ou a passada do pincel mudam; a
 * cada quadro, essa imagem pronta vai para a tela e a água por cima.
 */

/** Densidade máxima da tela para o chão (acima disso o ganho não paga o peso). */
const MAX_PIXEL_RATIO = 1.5;
/** Pontos finos por pedaço (lado). */
const CHUNK_SIDE = 32;

/** O terreno pintado não cabe nas texturas deste aparelho: quem usa o chão volta ao desenho de antes. */
export class TerrainTooLarge extends Error {}

export class GroundRenderer {
  private readonly gl: WebGL2RenderingContext;
  private readonly terrain: Program;
  private readonly blit: Program;
  private readonly triangle: WebGLBuffer;
  private readonly water: WaterPass;
  private readonly light: LightPass;
  /**
   * As três saídas, copiadas do canvas WebGL em sequência a cada desenho (docs/design/luz.md): o chão (terreno e água),
   * o mapa de luz (a camada que multiplica) e as chamas com o brilho (a camada que soma).
   */
  readonly groundImage = document.createElement("canvas");
  readonly lightImage = document.createElement("canvas");
  readonly flameImage = document.createElement("canvas");
  private readonly terrainFramebuffer: WebGLFramebuffer | null;
  private terrainImage: WebGLTexture | null = null;
  private weights: { bounds: ChunkRect; first: WebGLTexture; second: WebGLTexture } | null = null;
  private watercolors: WebGLTexture[] = [];
  private details: WebGLTexture[] = [];
  /** O que estava valendo no último desenho do terreno (redesenha só se mudar). */
  private drawn = "";
  private terrainDirty = true;

  /** O navegador desenha WebGL 2 (sem isso, o chão fica o desenho de antes). */
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
    this.terrain = linkProgram(gl, FULLSCREEN_VERTEX, TERRAIN_FRAGMENT, "aPos");
    this.blit = linkProgram(gl, FULLSCREEN_VERTEX, BLIT_FRAGMENT, "aPos");
    this.triangle = vertexBuffer(gl, [-1, -1, 3, -1, -1, 3]);
    this.terrainFramebuffer = gl.createFramebuffer();
    this.water = new WaterPass(gl);
    this.light = new LightPass(gl);
  }

  /** Aquarelas (na ordem de `TERRAINS`, já com o ajuste de cor), ladrilhos de detalhe e a terra do barranco da água. */
  setArt(watercolors: TexImageSource[], details: Record<DetailKind, TexImageSource>, dirt: TexImageSource) {
    const { gl } = this;
    if (gl.isContextLost()) return;
    for (const texture of [...this.watercolors, ...this.details]) gl.deleteTexture(texture);
    this.watercolors = watercolors.map((image) => imageTexture(gl, image));
    this.details = DETAIL_KINDS.map((kind) => imageTexture(gl, details[kind]));
    this.water.setDirt(dirt);
    this.terrainDirty = true;
  }

  private weightTexture(width: number, height: number): WebGLTexture {
    const { gl } = this;
    return createTexture(gl, () => gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA8, width, height, 0, gl.RGBA, gl.UNSIGNED_BYTE, null), gl.LINEAR, gl.CLAMP_TO_EDGE);
  }

  private releaseWeights() {
    if (!this.weights) return;
    this.gl.deleteTexture(this.weights.first);
    this.gl.deleteTexture(this.weights.second);
    this.weights = null;
  }

  /**
   * Terreno pintado: `changed` = pedaços que mudaram (só eles sobem), ou "all". As texturas de pesos cobrem a área
   * pintada com um texel vazio de borda (fora dela, nada); se a área muda, são refeitas inteiras.
   */
  setTerrain(chunks: TerrainChunks, changed: string[] | "all") {
    const { gl } = this;
    // Contexto perdido: nada a fazer até o navegador devolver (aí o motor é refeito e tudo sobe de novo).
    if (gl.isContextLost()) return;
    this.terrainDirty = true;
    const bounds = terrainBounds(chunks);
    if (!bounds) return this.releaseWeights();
    const width = bounds.cols * CHUNK_SIDE + 2;
    const height = bounds.rows * CHUNK_SIDE + 2;
    const limit = Number(gl.getParameter(gl.MAX_TEXTURE_SIZE));
    if (width > limit || height > limit) throw new TerrainTooLarge(`terreno de ${width} × ${height} pontos`);
    const current = this.weights?.bounds;
    const sameArea = current && current.cx === bounds.cx && current.cy === bounds.cy && current.cols === bounds.cols && current.rows === bounds.rows;
    gl.pixelStorei(gl.UNPACK_ALIGNMENT, 1);
    if (!sameArea || changed === "all" || !this.weights) {
      this.releaseWeights();
      const all = terrainWeights(chunks, bounds);
      const first = this.weightTexture(width, height);
      gl.texSubImage2D(gl.TEXTURE_2D, 0, 1, 1, all.width, all.height, gl.RGBA, gl.UNSIGNED_BYTE, all.first);
      const second = this.weightTexture(width, height);
      gl.texSubImage2D(gl.TEXTURE_2D, 0, 1, 1, all.width, all.height, gl.RGBA, gl.UNSIGNED_BYTE, all.second);
      this.weights = { bounds, first, second };
      return;
    }
    if (changed.length === 0) return;
    const blocks = terrainWeights(chunks, bounds, changed);
    const blockBytes = CHUNK_SIDE * CHUNK_SIDE * 4;
    changed.forEach((key, index) => {
      const [cx, cy] = key.split(",").map(Number);
      const x = 1 + (cx - bounds.cx) * CHUNK_SIDE;
      const y = 1 + (cy - bounds.cy) * CHUNK_SIDE;
      for (const [texture, data] of [
        [this.weights?.first, blocks.first],
        [this.weights?.second, blocks.second],
      ] as const) {
        if (!texture) continue;
        gl.bindTexture(gl.TEXTURE_2D, texture);
        gl.texSubImage2D(gl.TEXTURE_2D, 0, x, y, CHUNK_SIDE, CHUNK_SIDE, gl.RGBA, gl.UNSIGNED_BYTE, data.subarray(index * blockBytes, (index + 1) * blockBytes));
      }
    });
  }

  /** Grupos de água (o que o Worker calculou). */
  setWaterFields(fields: WaterGpuField[]) {
    if (this.gl.isContextLost()) return;
    this.water.setFields(fields);
  }

  /** Alguma água aparece na tela agora (para não animar à toa). */
  visibleWater(view: GroundView): boolean {
    return this.water.visible(view);
  }

  /** Tem algo para desenhar (terreno ou água). */
  get empty(): boolean {
    return !this.weights && this.water.empty;
  }

  render(view: GroundView, time: number, options: { waterDraft: boolean }) {
    const { gl, canvas } = this;
    // Contexto perdido: criar textura pode falhar (devolve nada); não desenha até o navegador devolver.
    if (gl.isContextLost()) return;
    const ratio = Math.min(view.pixelRatio, MAX_PIXEL_RATIO);
    const width = Math.max(1, Math.round(view.width * ratio));
    const height = Math.max(1, Math.round(view.height * ratio));
    if (canvas.width !== width || canvas.height !== height || !this.terrainImage) {
      canvas.width = width;
      canvas.height = height;
      if (this.terrainImage) gl.deleteTexture(this.terrainImage);
      this.terrainImage = createTexture(gl, () => gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA8, width, height, 0, gl.RGBA, gl.UNSIGNED_BYTE, null), gl.NEAREST, gl.CLAMP_TO_EDGE);
      this.terrainDirty = true;
    }
    const state = [view.offsetX, view.offsetY, view.cellPx, view.stageX, view.stageY, view.scale, view.width, view.height, options.waterDraft].join("|");
    if (state !== this.drawn) this.terrainDirty = true;
    gl.disable(gl.BLEND);
    if (this.terrainDirty) {
      this.drawTerrain(view, width, height, options.waterDraft);
      this.drawn = state;
      this.terrainDirty = false;
    }
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    gl.viewport(0, 0, width, height);
    gl.clearColor(0, 0, 0, 0);
    gl.clear(gl.COLOR_BUFFER_BIT);
    if (this.weights && this.terrainImage) {
      gl.useProgram(this.blit.program);
      useVertices(gl, this.triangle);
      gl.uniform2f(uniformOf(gl, this.blit, "uCanvas"), width, height);
      bindTextures(gl, this.blit, [["uImage", this.terrainImage]]);
      gl.drawArrays(gl.TRIANGLES, 0, 3);
    }
    // Água por cima do terreno (cor pré-multiplicada).
    gl.enable(gl.BLEND);
    gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
    this.water.render(view, time);
    gl.disable(gl.BLEND);
    this.copyTo(this.groundImage);
    if (!this.light.active) return;
    // Mapa de luz e, depois, chamas e brilho: o mesmo canvas, cada um copiado para a sua imagem.
    this.light.renderLight(view, time, width, height);
    this.copyTo(this.lightImage);
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    gl.viewport(0, 0, width, height);
    gl.clearColor(0, 0, 0, 0);
    gl.clear(gl.COLOR_BUFFER_BIT);
    this.light.renderFlames(view, time);
    this.copyTo(this.flameImage);
  }

  /** Copia o que está no canvas WebGL agora para uma das saídas (do mesmo tamanho). */
  private copyTo(target: HTMLCanvasElement) {
    if (target.width !== this.canvas.width || target.height !== this.canvas.height) {
      target.width = this.canvas.width;
      target.height = this.canvas.height;
    }
    const ctx = target.getContext("2d");
    if (!ctx) return;
    ctx.clearRect(0, 0, target.width, target.height);
    ctx.drawImage(this.canvas, 0, 0);
  }

  /** Paredes, luzes e luz da cena (docs/design/luz.md): a geometria só é refeita quando algo muda. */
  setLighting(input: LightingInput) {
    if (this.gl.isContextLost()) return;
    this.light.setLighting(input);
  }

  /** Há luz de cena (dia, noite…) a aplicar: as imagens de luz e chamas valem. */
  get lighting(): boolean {
    return this.light.active;
  }

  /** Alguma tocha na cena, ou a luz da cena ainda trocando: precisa animar mesmo sem água na tela. */
  get flickering(): boolean {
    return this.light.hasTorches || this.light.settling;
  }

  private drawTerrain(view: GroundView, width: number, height: number, waterDraft: boolean) {
    const { gl } = this;
    if (!this.terrainImage || !this.terrainFramebuffer) return;
    gl.bindFramebuffer(gl.FRAMEBUFFER, this.terrainFramebuffer);
    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, this.terrainImage, 0);
    gl.viewport(0, 0, width, height);
    gl.clearColor(0, 0, 0, 0);
    gl.clear(gl.COLOR_BUFFER_BIT);
    const weights = this.weights;
    if (!weights || this.watercolors.length !== TERRAINS.length || this.details.length !== DETAIL_KINDS.length) return;
    const program = this.terrain;
    gl.useProgram(program.program);
    useVertices(gl, this.triangle);
    bindTextures(gl, program, [
      ["uWeightsA", weights.first],
      ["uWeightsB", weights.second],
      ...this.watercolors.map((texture, index): [string, WebGLTexture] => [`uWatercolor${index}`, texture]),
      ...this.details.map((texture, index): [string, WebGLTexture] => [`uDetail${index}`, texture]),
    ]);
    gl.uniform2f(uniformOf(gl, program, "uWeightsOrigin"), weights.bounds.cx * CHUNK_SIDE - 1, weights.bounds.cy * CHUNK_SIDE - 1);
    gl.uniform2f(uniformOf(gl, program, "uWeightsSize"), weights.bounds.cols * CHUNK_SIDE + 2, weights.bounds.rows * CHUNK_SIDE + 2);
    gl.uniform4f(uniformOf(gl, program, "uMapGrid"), view.offsetX, view.offsetY, view.cellPx, 0);
    gl.uniform3f(uniformOf(gl, program, "uStage"), view.stageX, view.stageY, view.scale);
    gl.uniform2f(uniformOf(gl, program, "uScreen"), view.width, view.height);
    gl.uniform2f(uniformOf(gl, program, "uCanvas"), width, height);
    gl.uniform1f(uniformOf(gl, program, "uWaterDraft"), waterDraft ? 1 : 0);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
  }

  dispose() {
    const { gl } = this;
    this.water.dispose();
    this.light.dispose();
    this.releaseWeights();
    for (const texture of [...this.watercolors, ...this.details]) gl.deleteTexture(texture);
    if (this.terrainImage) gl.deleteTexture(this.terrainImage);
    gl.getExtension("WEBGL_lose_context")?.loseContext();
  }
}
