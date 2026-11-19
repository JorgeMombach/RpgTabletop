import { terrainBounds, terrainWeights, TERRAINS, type ChunkRect, type TerrainChunks, type DuneMask, type Bridge, type BridgeKind, type FloorChunks, type FloorMaterial, type ReliefChunks, type TerrainId, type WallPiece, type WallStyle } from "@rpg/shared";
import { bindTextures, createTexture, imageTexture, linkProgram, ProgramCache, uniformOf, useVertices, vertexBuffer, type GroundView, type Program } from "./glKit";
import { BLIT_FRAGMENT, FULLSCREEN_VERTEX, terrainLayerFragment } from "./terrainShader";
import { LightPass, type LightingInput } from "./lightPass";
import { ReliefPass } from "./reliefPass";
import type { ReliefWindow } from "./reliefTypes";
import { faceLight, SCENE_LIGHT, type SceneLight } from "./sceneLight";
import { DustPass } from "./dustPass";
import { FloorPass } from "./floorPass";
import { BridgePass } from "./bridgePass";
import { WallPass } from "./wallPass";
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
const MAX_PIXEL_RATIO = 2;
/** Pontos finos por pedaço (lado). */
const CHUNK_SIDE = 32;

/** O terreno pintado não cabe nas texturas deste aparelho: quem usa o chão volta ao desenho de antes. */
export class TerrainTooLarge extends Error {}

export class GroundRenderer {
  private readonly gl: WebGL2RenderingContext;
  /** Um programa por terreno (docs/design/relevo.md, etapa 3), compilados em paralelo. */
  private readonly terrain: ProgramCache<TerrainId>;
  private readonly blit: Program;
  private readonly triangle: WebGLBuffer;
  private readonly water: WaterPass;
  private readonly light: LightPass;
  /** Paredes, portas e janelas (docs/design/relevo.md, etapa 2). */
  private readonly walls: WallPass;
  /** Poeira das dunas com vento (etapa 3). */
  private readonly dust: DustPass;
  /** Pisos (docs/design/pisos.md): por cima do terreno e da água, por baixo da camada do relevo. */
  private readonly floor: FloorPass;
  /**
   * Textura vazia (1 × 1) para os samplers que o programa declara mas que não têm o que ler (sem terreno, sem
   * relevo): no WebGL 2, sampler sem textura fica na unidade 0, junto de outro de tipo diferente ou da imagem que está
   * sendo desenhada, e o desenho é recusado.
   */
  private readonly blank: WebGLTexture;
  /** Camada dos pisos, guardada como o terreno (refeita com ele). */
  private floorImage: WebGLTexture | null = null;
  /** Pontes (docs/design/pontes.md): por cima da camada do relevo (passam sobre o penhasco), por baixo das paredes. */
  private readonly bridges: BridgePass;
  /** Camada das pontes, guardada como a do piso (refeita com o terreno). */
  private bridgeImage: WebGLTexture | null = null;
  /** Relevo (docs/design/relevo.md): campos e sombra guardados por pedaço; o desenho lê (Tarefa 6). */
  readonly relief: ReliefPass;
  /**
   * As três saídas, copiadas do canvas WebGL em sequência a cada desenho (docs/design/luz.md): o chão (terreno e água),
   * o mapa de luz (a camada que multiplica) e as chamas com o brilho (a camada que soma).
   */
  readonly groundImage = document.createElement("canvas");
  readonly lightImage = document.createElement("canvas");
  readonly flameImage = document.createElement("canvas");
  /** As paredes, portas e janelas: copiadas só quando a camada muda (visão, paredes, luz da cena). */
  readonly wallImage = document.createElement("canvas");
  /** A imagem das paredes mudou no último desenho (a camada das paredes precisa redesenhar). */
  wallsFresh = false;
  /** Sobe a cada `setWalls`; com a visão e a luz, decide se a camada é refeita. */
  private wallsVersion = 0;
  private wallsDrawn = "";
  private readonly terrainFramebuffer: WebGLFramebuffer | null;
  private terrainImage: WebGLTexture | null = null;
  /** Camada do relevo (rocha e luz das encostas), guardada como o terreno e posta por cima da água. */
  private reliefImage: WebGLTexture | null = null;
  private weights: { bounds: ChunkRect; first: WebGLTexture; second: WebGLTexture; third: WebGLTexture } | null = null;
  private watercolors: WebGLTexture[] = [];
  /** Terrenos que aparecem em algum pedaço pintado. */
  private present = new Set<TerrainId>();
  /** Luz da cena do último desenho do relevo (a face muda com ela). */
  private reliefLightKey = "";
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

  constructor(
    readonly canvas: HTMLCanvasElement,
    /** Tela pequena (celular, tablet): o relevo guardado começa com menos detalhe. */
    smallScreen = false,
  ) {
    const gl = canvas.getContext("webgl2", { premultipliedAlpha: true, preserveDrawingBuffer: true, antialias: false, alpha: true });
    if (!gl) throw new Error("WebGL 2 indisponível");
    this.gl = gl;
    this.terrain = new ProgramCache(gl, FULLSCREEN_VERTEX);
    this.blit = linkProgram(gl, FULLSCREEN_VERTEX, BLIT_FRAGMENT, "aPos");
    this.triangle = vertexBuffer(gl, [-1, -1, 3, -1, -1, 3]);
    this.terrainFramebuffer = gl.createFramebuffer();
    this.water = new WaterPass(gl);
    this.light = new LightPass(gl);
    this.relief = new ReliefPass(gl, smallScreen);
    this.walls = new WallPass(gl);
    this.dust = new DustPass(gl);
    this.floor = new FloorPass(gl);
    this.blank = createTexture(gl, () => gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA8, 1, 1, 0, gl.RGBA, gl.UNSIGNED_BYTE, new Uint8Array(4)), gl.NEAREST, gl.CLAMP_TO_EDGE);
    this.bridges = new BridgePass(gl);
  }

  /**
   * Começa a compilar o que a ferramenta escolhida vai desenhar: o desenho de parede (ou a porta/janela), o material
   * de piso ou o terreno do pincel (água: também a água animada). Compilar trava a placa um instante na primeira vez
   * (Direct3D); assim isso acontece ao escolher, não no meio do traço.
   */
  warm(choice: { wall?: WallStyle | "opening"; floor?: FloorMaterial; terrain?: TerrainId; bridge?: BridgeKind }) {
    if (this.gl.isContextLost()) return;
    if (choice.wall) this.walls.warm(choice.wall);
    if (choice.floor) this.floor.warm(choice.floor);
    if (choice.bridge) this.bridges.warm(choice.bridge);
    const terrain = choice.terrain;
    if (terrain) {
      this.terrain.warm(terrain, () => terrainLayerFragment(terrain));
      if (terrain === "water" || terrain === "waterDark") this.water.warm();
    }
  }

  /** Piso da cena (`FloorChunks`): a camada é refeita no próximo desenho. */
  /** Pontes da cena (e o relevo, para o nível das pontas): a camada é refeita no próximo desenho. */
  setBridges(bridges: Bridge[], relief: ReliefChunks) {
    if (this.gl.isContextLost()) return;
    this.bridges.setBridges(bridges, relief);
    this.terrainDirty = true;
  }

  setFloors(chunks: FloorChunks) {
    if (this.gl.isContextLost()) return;
    this.floor.setChunks(chunks);
    this.terrainDirty = true;
  }

  /** Onde há dunas (do relevo) e o vento do clima, para a poeira. */
  setDust(mask: DuneMask | null, level: 0 | 1 | 2, direction: 1 | -1) {
    if (this.gl.isContextLost()) return;
    this.dust.setMask(mask);
    this.dust.setWind(level, direction);
  }

  /** Há poeira das dunas animando: precisa de quadros. */
  get dusting(): boolean {
    return this.dust.active;
  }

  /** Peças das paredes, portas e janelas (`wallPieces`): a camada é refeita no próximo desenho. */
  setWalls(pieces: WallPiece[]) {
    if (this.gl.isContextLost()) return;
    this.walls.setPieces(pieces);
    this.wallsVersion++;
  }

  /** Alturas novas do relevo (do Worker). */
  setReliefWindows(windows: ReliefWindow[]) {
    if (this.gl.isContextLost()) return;
    this.relief.setWindows(windows);
    this.terrainDirty = true;
  }

  /** Esquece pedaços do relevo (`"all"`: troca de cena, relevo apagado). */
  forgetRelief(keys: string[] | "all") {
    if (this.gl.isContextLost()) return;
    this.relief.forget(keys);
    this.terrainDirty = true;
  }

  /** Luz da cena para a sombra do relevo. */
  setReliefSun(scene: SceneLight) {
    if (this.gl.isContextLost()) return;
    this.relief.setSun(scene);
  }

  /** Ainda há relevo a calcular ou programa das paredes compilando (precisa de mais quadros). */
  get busy(): boolean {
    return this.relief.pending || this.walls.pending || this.terrain.pending || this.dust.pending || this.floor.pending || this.water.pending || this.bridges.pending;
  }

  /** Aquarelas (na ordem de `TERRAINS`, já com o ajuste de cor) e a terra do barranco da água. */
  setArt(watercolors: TexImageSource[], dirt: TexImageSource) {
    const { gl } = this;
    if (gl.isContextLost()) return;
    for (const texture of this.watercolors) gl.deleteTexture(texture);
    this.watercolors = watercolors.map((image) => imageTexture(gl, image));
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
    this.gl.deleteTexture(this.weights.third);
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
    // Terrenos que aparecem em algum pedaço: só eles ganham passada (e programa).
    this.present = new Set(Object.values(chunks).flatMap((chunk) => TERRAINS.filter((terrain) => chunk[terrain] !== undefined)));
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
      const third = this.weightTexture(width, height);
      gl.texSubImage2D(gl.TEXTURE_2D, 0, 1, 1, all.width, all.height, gl.RGBA, gl.UNSIGNED_BYTE, all.third);
      this.weights = { bounds, first, second, third };
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
        [this.weights?.third, blocks.third],
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
    return !this.weights && this.water.empty && !this.relief.drawable && this.walls.empty && this.floor.empty && this.bridges.empty;
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
      if (this.reliefImage) gl.deleteTexture(this.reliefImage);
      if (this.floorImage) gl.deleteTexture(this.floorImage);
      if (this.bridgeImage) gl.deleteTexture(this.bridgeImage);
      this.bridgeImage = createTexture(gl, () => gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA8, width, height, 0, gl.RGBA, gl.UNSIGNED_BYTE, null), gl.NEAREST, gl.CLAMP_TO_EDGE);
      this.floorImage = createTexture(gl, () => gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA8, width, height, 0, gl.RGBA, gl.UNSIGNED_BYTE, null), gl.NEAREST, gl.CLAMP_TO_EDGE);
      this.terrainImage = createTexture(gl, () => gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA8, width, height, 0, gl.RGBA, gl.UNSIGNED_BYTE, null), gl.NEAREST, gl.CLAMP_TO_EDGE);
      this.reliefImage = createTexture(gl, () => gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA8, width, height, 0, gl.RGBA, gl.UNSIGNED_BYTE, null), gl.NEAREST, gl.CLAMP_TO_EDGE);
      this.terrainDirty = true;
    }
    // Água animada ainda compilando (primeira vez na cena): o terreno mostra a água em aquarela até ficar pronta.
    const waterDraft = options.waterDraft || !this.water.prepare();
    // O tamanho em pixels do aparelho entra na chave: mudando a densidade, o terreno e as paredes são refeitos.
    const state = [view.offsetX, view.offsetY, view.cellPx, view.stageX, view.stageY, view.scale, view.width, view.height, width, height, waterDraft].join("|");
    if (state !== this.drawn) this.terrainDirty = true;
    gl.disable(gl.BLEND);
    // Relevo: alguns pedaços por quadro; o que mudou faz o terreno redesenhar.
    if (this.relief.bake()) this.terrainDirty = true;
    // A luz da face do relevo segue a luz da cena: mudando, a camada do relevo é refeita.
    const reliefLight = this.light.active ? this.light.scene : SCENE_LIGHT.day;
    const lightKey = [reliefLight.sunDirection.join(), reliefLight.shadowCells.toFixed(3), this.relief.shadowMix.toFixed(2)].join("|");
    if (lightKey !== this.reliefLightKey) {
      this.reliefLightKey = lightKey;
      this.terrainDirty = true;
    }
    if (this.terrainDirty) {
      this.drawTerrain(view, width, height, waterDraft, reliefLight);
      this.drawFloors(view, width, height, reliefLight);
      this.drawRelief(view, width, height, reliefLight);
      this.drawn = state;
      // Programa de terreno ou de piso ainda compilando: o terreno é refeito no próximo quadro.
      this.drawBridges(view, width, height, reliefLight);
      this.terrainDirty = this.terrain.pending || this.floor.pending || this.bridges.pending;
    }
    // Barranco e fundo da água na resolução da tela (só refaz quando a visão ou a água mudam).
    this.water.bakeView(view, width, height);
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
    this.water.render(view, time, width, height);
    // Pisos por cima da água e por baixo do relevo (a luz da encosta pega o piso; a face do penhasco o cobre).
    if (!this.floor.empty && this.floorImage) {
      gl.useProgram(this.blit.program);
      useVertices(gl, this.triangle);
      gl.uniform2f(uniformOf(gl, this.blit, "uCanvas"), width, height);
      bindTextures(gl, this.blit, [["uImage", this.floorImage]]);
      gl.drawArrays(gl.TRIANGLES, 0, 3);
    }
    // Relevo por cima da água: a face do penhasco cobre a água (docs/design/relevo.md).
    if (this.relief.drawable && this.reliefImage) {
      gl.useProgram(this.blit.program);
      useVertices(gl, this.triangle);
      gl.uniform2f(uniformOf(gl, this.blit, "uCanvas"), width, height);
      bindTextures(gl, this.blit, [["uImage", this.reliefImage]]);
      gl.drawArrays(gl.TRIANGLES, 0, 3);
    }
    // Pontes por cima do relevo (passam sobre o penhasco), por baixo das paredes.
    if (!this.bridges.empty && this.bridgeImage) {
      gl.useProgram(this.blit.program);
      useVertices(gl, this.triangle);
      gl.uniform2f(uniformOf(gl, this.blit, "uCanvas"), width, height);
      bindTextures(gl, this.blit, [["uImage", this.bridgeImage]]);
      gl.drawArrays(gl.TRIANGLES, 0, 3);
    }
    // Poeira das dunas por cima de tudo do chão (só com dunas pintadas e vento).
    if (this.dust.active) this.dust.draw(view, width, height, time);
    gl.disable(gl.BLEND);
    this.copyTo(this.groundImage);
    this.drawWalls(view, width, height, state, lightKey, reliefLight);
    if (!this.light.active) return;
    // Mapa de luz e, depois, chamas e brilho: o mesmo canvas, cada um copiado para a sua imagem.
    this.light.renderLight(view, time, width, height, (lightWidth, lightHeight) => this.relief.drawShadowMask(view, lightWidth, lightHeight));
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

  /**
   * Paredes, luzes e luz da cena (docs/design/luz.md): a geometria só é refeita quando algo muda. Devolve se algo mudou
   * (precisa redesenhar).
   */
  setLighting(input: LightingInput, animate: boolean): boolean {
    if (this.gl.isContextLost()) return false;
    return this.light.setLighting(input, animate);
  }

  /** Há luz de cena (dia, noite…) a aplicar: as imagens de luz e chamas valem. */
  get lighting(): boolean {
    return this.light.active;
  }

  /** Alguma tocha na cena, ou a luz da cena ainda trocando: precisa animar mesmo sem água na tela. */
  get flickering(): boolean {
    return this.light.hasTorches || this.light.settling;
  }

  /**
   * A camada das paredes, no próprio canvas e copiada para `wallImage`, só quando algo mudou (ou um programa ainda
   * compilava). A luz é relativa, como a do relevo: a cena vem do mapa de luz por cima.
   */
  private drawWalls(view: GroundView, width: number, height: number, state: string, lightKey: string, scene: SceneLight) {
    const { gl } = this;
    const stone = this.watercolors[TERRAINS.indexOf("stone")];
    const stoneLight = this.watercolors[TERRAINS.indexOf("stoneLight")];
    const key = [state, lightKey, this.wallsVersion, stone ? 1 : 0].join("|");
    this.wallsFresh = false;
    if (key === this.wallsDrawn && !this.walls.pending) return;
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    gl.viewport(0, 0, width, height);
    gl.clearColor(0, 0, 0, 0);
    gl.clear(gl.COLOR_BUFFER_BIT);
    if (stone && stoneLight) this.walls.draw(view, width, height, scene, stone, stoneLight);
    this.copyTo(this.wallImage);
    this.wallsDrawn = key;
    this.wallsFresh = true;
  }

  /** Pesos da água do terreno para quem lê o que está embaixo (pontes e píer); sem terreno, nada. */
  private waterWeights() {
    const weights = this.weights;
    if (!weights) return null;
    return {
      second: weights.second,
      third: weights.third,
      origin: [weights.bounds.cx * CHUNK_SIDE - 1, weights.bounds.cy * CHUNK_SIDE - 1] satisfies [number, number],
      size: [weights.bounds.cols * CHUNK_SIDE + 2, weights.bounds.rows * CHUNK_SIDE + 2] satisfies [number, number],
    };
  }

  private drawBridges(view: GroundView, width: number, height: number, scene: SceneLight) {
    const { gl } = this;
    if (!this.bridgeImage || !this.terrainFramebuffer) return;
    gl.bindFramebuffer(gl.FRAMEBUFFER, this.terrainFramebuffer);
    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, this.bridgeImage, 0);
    gl.viewport(0, 0, width, height);
    gl.clearColor(0, 0, 0, 0);
    gl.clear(gl.COLOR_BUFFER_BIT);
    const water = this.waterWeights();
    this.bridges.draw(view, width, height, scene, { blank: this.blank, water, bindRelief: (program, extra) => this.relief.bindSample(program, view, width, height, extra) });
  }

  private drawFloors(view: GroundView, width: number, height: number, scene: SceneLight) {
    const { gl } = this;
    if (!this.floorImage || !this.terrainFramebuffer) return;
    gl.bindFramebuffer(gl.FRAMEBUFFER, this.terrainFramebuffer);
    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, this.floorImage, 0);
    gl.viewport(0, 0, width, height);
    gl.clearColor(0, 0, 0, 0);
    gl.clear(gl.COLOR_BUFFER_BIT);
    const stone = this.watercolors[TERRAINS.indexOf("stoneLight")];
    if (stone) this.floor.draw(view, width, height, scene, stone, this.waterWeights(), this.blank);
  }

  private drawRelief(view: GroundView, width: number, height: number, scene: SceneLight) {
    const { gl } = this;
    if (!this.reliefImage || !this.terrainFramebuffer) return;
    gl.bindFramebuffer(gl.FRAMEBUFFER, this.terrainFramebuffer);
    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, this.reliefImage, 0);
    gl.viewport(0, 0, width, height);
    gl.clearColor(0, 0, 0, 0);
    gl.clear(gl.COLOR_BUFFER_BIT);
    const stone = this.watercolors[TERRAINS.indexOf("stone")];
    const stoneLight = this.watercolors[TERRAINS.indexOf("stoneLight")];
    if (!stone || !stoneLight) return;
    this.relief.drawLayer(view, width, height, scene, stone, stoneLight);
  }

  /** O terreno: uma passada por terreno presente, na ordem de `TERRAINS`, misturadas por cima (cor pré-multiplicada). */
  private drawTerrain(view: GroundView, width: number, height: number, waterDraft: boolean, scene: SceneLight) {
    const { gl } = this;
    if (!this.terrainImage || !this.terrainFramebuffer) return;
    gl.bindFramebuffer(gl.FRAMEBUFFER, this.terrainFramebuffer);
    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, this.terrainImage, 0);
    gl.viewport(0, 0, width, height);
    gl.clearColor(0, 0, 0, 0);
    gl.clear(gl.COLOR_BUFFER_BIT);
    this.terrain.beginDraw();
    const weights = this.weights;
    if (!weights || this.watercolors.length !== TERRAINS.length) return;
    const light = faceLight(scene);
    gl.enable(gl.BLEND);
    gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
    TERRAINS.forEach((terrain, index) => {
      if (!this.present.has(terrain)) return;
      if ((terrain === "water" || terrain === "waterDark") && !waterDraft) return;
      const program = this.terrain.get(terrain, () => terrainLayerFragment(terrain));
      if (!program) return;
      gl.useProgram(program.program);
      useVertices(gl, this.triangle);
      bindTextures(gl, program, [
        ["uWeights", [weights.first, weights.second, weights.third][index >> 2]],
        ["uWatercolor", this.watercolors[index]],
      ]);
      gl.uniform2f(uniformOf(gl, program, "uWeightsOrigin"), weights.bounds.cx * CHUNK_SIDE - 1, weights.bounds.cy * CHUNK_SIDE - 1);
      gl.uniform2f(uniformOf(gl, program, "uWeightsSize"), weights.bounds.cols * CHUNK_SIDE + 2, weights.bounds.rows * CHUNK_SIDE + 2);
      gl.uniform4f(uniformOf(gl, program, "uMapGrid"), view.offsetX, view.offsetY, view.cellPx, 0);
      gl.uniform3f(uniformOf(gl, program, "uStage"), view.stageX, view.stageY, view.scale);
      gl.uniform2f(uniformOf(gl, program, "uScreen"), view.width, view.height);
      gl.uniform2f(uniformOf(gl, program, "uCanvas"), width, height);
      gl.uniform1f(uniformOf(gl, program, "uWaterDraft"), waterDraft ? 1 : 0);
      gl.uniform3f(uniformOf(gl, program, "uLightDir"), ...light.direction);
      gl.uniform1f(uniformOf(gl, program, "uLightAmount"), light.amount);
      gl.uniform1f(uniformOf(gl, program, "uAmbientLum"), light.ambientLum);
      gl.uniform1f(uniformOf(gl, program, "uSunLum"), light.sunLum);
      gl.drawArrays(gl.TRIANGLES, 0, 3);
    });
    gl.disable(gl.BLEND);
  }


  dispose() {
    const { gl } = this;
    this.water.dispose();
    this.light.dispose();
    this.relief.dispose();
    this.walls.dispose();
    this.dust.dispose();
    this.floor.dispose();
    gl.deleteTexture(this.blank);
    this.bridges.dispose();
    this.releaseWeights();
    for (const texture of this.watercolors) gl.deleteTexture(texture);
    this.terrain.dispose();
    if (this.terrainImage) gl.deleteTexture(this.terrainImage);
    if (this.reliefImage) gl.deleteTexture(this.reliefImage);
    if (this.floorImage) gl.deleteTexture(this.floorImage);
    if (this.bridgeImage) gl.deleteTexture(this.bridgeImage);
    gl.getExtension("WEBGL_lose_context")?.loseContext();
  }
}
