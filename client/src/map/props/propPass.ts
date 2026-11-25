import { ReliefHeights, type MapProp, type PropKind, type ReliefChunks } from "@rpg/shared";
import { bindTextures, ProgramCache, uniformOf, useVertices, vertexBuffer, type GroundView, type Program } from "../ground/glKit";
import { faceLight, SCENE_LIGHT, type SceneLight } from "../ground/sceneLight";
import { FULLSCREEN_VERTEX } from "../ground/terrainShader";
import type { ReliefWindow } from "../ground/reliefTypes";
import { CANOPY_BOTTOM } from "../ground/shadowCasters";
import { PROP_EXTENT, PROP_TIERS, PropAtlas, propBounds, propRow, PROP_ROW_FLOATS, slotClassOf, type PropDrag, type PropSlot } from "./propLayout";
import { PROP_DRAW_FRAGMENT, PROP_DRAW_VERTEX, PROP_EXTENTS, PROP_HEIGHT_FRAGMENT, propBakeFragment, SHAPED_KINDS } from "./propShader";

/** Tipos que saem da placa de vídeo (todos; o desenho do Konva fica só sem WebGL 2). */
export const GPU_PROP_KINDS: ReadonlySet<PropKind> = SHAPED_KINDS;

/** Plantas que balançam com o vento (o chão pede quadros com elas na cena). */
const SWAYING_KINDS: ReadonlySet<PropKind> = new Set<PropKind>(["tree", "pine", "bush", "palm", "tallGrass", "flowers"]);

/** Lado do atlas e camadas: 1 de lugares pequenos e 2 de grandes (2 × 4 bytes por ponto ≈ 96 MB na placa). */
const ATLAS = 2048;
const ATLAS_LAYERS = { small: 1, large: 2 };
/** Formas assadas por quadro: uma floresta inteira aparece em poucos quadros, sem travar. */
const BAKE_PER_FRAME = 6;
/** Semente dos ícones do painel (a mesma de sempre: o ícone não muda). */
const ICON_SEED = 17;
/** Um nível do relevo tem 1,4 casa de altura (a mesma conta do relevo). */
const LEVEL_HEIGHT = 1.4;

/** Aquarelas que o desenho lê (do renderizador do chão). */
export interface PropArt {
  leaves: WebGLTexture;
  stone: WebGLTexture;
  dirt: WebGLTexture;
}

interface Placed {
  prop: MapProp;
  base: number;
}

/**
 * Passo dos objetos do renderizador do chão (docs/design/objetos.md): a forma de cada tipo e semente é assada uma vez
 * num atlas (`TEXTURE_2D_ARRAY`, forma e inclinação), algumas por quadro, as da tela primeiro. A cada desenho, um
 * retângulo por objeto na tela lê o atlas e pinta, na ordem da lista, os de baixo ou os de cima dos tokens.
 */
export class PropPass {
  private readonly bakes: ProgramCache<PropKind>;
  private readonly draws: ProgramCache<"draw">;
  private readonly heights: ProgramCache<"height">;
  private readonly shapeTexture: WebGLTexture;
  private readonly slopeTexture: WebGLTexture;
  private readonly framebuffer: WebGLFramebuffer | null;
  private readonly atlas = new PropAtlas(ATLAS, ATLAS_LAYERS);
  private readonly corners: WebGLBuffer;
  private readonly instances: WebGLBuffer;
  /** Triângulo da tela inteira, para assar (com o viewport no lugar). */
  private readonly triangle: WebGLBuffer;
  private readonly vertexArray: WebGLVertexArrayObject | null;
  private placed: Placed[] = [];
  private faded: ReadonlySet<string> = new Set();
  private drag: { id: string; drag: PropDrag } | null = null;
  private wind: { strength: number; direction: [number, number] } | null = null;
  /** Relevo já amostrado: mudar só os objetos não refaz a conta do relevo. */
  private ground: { relief: ReliefChunks; groundAt: (x: number, y: number) => number } | null = null;
  /** Alturas do relevo guardadas entre traços: só os pedaços perto do que mudou são refeitos (docs/design/desempenho.md). */
  private readonly reliefHeights = new ReliefHeights();
  /** Os últimos objetos e relevo recebidos (para reassentar quando as alturas do Worker chegam). */
  private lastSet: { props: MapProp[]; relief: ReliefChunks } | null = null;
  private frame = 0;
  /** Ícones do painel já desenhados (tipo|lado). */
  private readonly icons = new Map<string, HTMLCanvasElement>();
  /** Ficou forma da tela sem assar (precisa de mais quadros). */
  private waiting = false;
  /** Faixa em volta da tela (casas) de onde a sombra pode cair dentro: a última pedida pelo mapa de alturas. */
  private shadowMargin = 0;
  /** Sobe a cada mudança que muda o desenho (objetos, arrasto, transparência, forma assada). */
  version = 0;

  constructor(private readonly gl: WebGL2RenderingContext) {
    this.bakes = new ProgramCache(gl, FULLSCREEN_VERTEX);
    this.draws = new ProgramCache(gl, PROP_DRAW_VERTEX, "aCorner");
    this.heights = new ProgramCache(gl, PROP_DRAW_VERTEX, "aCorner");
    const layers = ATLAS_LAYERS.small + ATLAS_LAYERS.large;
    const arrayTexture = () => {
      const texture = gl.createTexture();
      if (!texture) throw new Error("textura");
      gl.bindTexture(gl.TEXTURE_2D_ARRAY, texture);
      gl.texStorage3D(gl.TEXTURE_2D_ARRAY, 1, gl.RGBA8, ATLAS, ATLAS, layers);
      gl.texParameteri(gl.TEXTURE_2D_ARRAY, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D_ARRAY, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D_ARRAY, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D_ARRAY, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
      return texture;
    };
    this.shapeTexture = arrayTexture();
    this.slopeTexture = arrayTexture();
    this.framebuffer = gl.createFramebuffer();
    this.triangle = vertexBuffer(gl, [-1, -1, 3, -1, -1, 3]);
    const corners = gl.createBuffer();
    const instances = gl.createBuffer();
    if (!corners || !instances) throw new Error("buffer");
    this.corners = corners;
    this.instances = instances;
    // Estado dos atributos num objeto próprio: os outros passos usam o padrão (só o atributo 0, sem instâncias).
    this.vertexArray = gl.createVertexArray();
    gl.bindVertexArray(this.vertexArray);
    gl.bindBuffer(gl.ARRAY_BUFFER, corners);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, -1, 1, 1, -1, 1, 1]), gl.STATIC_DRAW);
    gl.enableVertexAttribArray(0);
    gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);
    gl.bindBuffer(gl.ARRAY_BUFFER, instances);
    for (let attribute = 1; attribute <= 3; attribute++) {
      gl.enableVertexAttribArray(attribute);
      gl.vertexAttribPointer(attribute, 4, gl.FLOAT, false, PROP_ROW_FLOATS * 4, (attribute - 1) * 16);
      gl.vertexAttribDivisor(attribute, 1);
    }
    gl.bindVertexArray(null);
  }

  get empty(): boolean {
    return this.placed.length === 0;
  }

  /** Programa compilando ou forma da tela ainda por assar. */
  get pending(): boolean {
    return !this.empty && (this.bakes.pending || this.draws.pending || this.heights.pending || this.waiting);
  }

  /** Começa a compilar o desenho e as formas dos tipos da placa (ferramenta Objetos aberta, cena com objetos). */
  warm() {
    this.draws.warm("draw", () => PROP_DRAW_FRAGMENT);
    this.heights.warm("height", () => PROP_HEIGHT_FRAGMENT);
    for (const kind of GPU_PROP_KINDS) this.bakes.warm(kind, () => propBakeFragment(kind));
  }

  /** Objetos da cena (só os tipos da placa) e o relevo (a base de cada um). */
  setProps(props: MapProp[], relief: ReliefChunks) {
    this.lastSet = { props, relief };
    if (this.ground?.relief !== relief) this.ground = { relief, groundAt: this.reliefHeights.sampler(relief) };
    const { groundAt } = this.ground;
    this.placed = props
      .filter((prop) => GPU_PROP_KINDS.has(prop.kind))
      .map((prop) => {
        const level = groundAt(prop.col, prop.row);
        return { prop, base: Number.isFinite(level) ? level * LEVEL_HEIGHT : 0 };
      });
    this.version++;
  }

  /** Altura do chão do relevo (casas) no ponto: a base de tokens, tochas e efeitos no mapa de alturas. */
  groundHeight(x: number, y: number): number {
    const relief = this.lastSet?.relief;
    if (!relief) return 0;
    if (this.ground?.relief !== relief) this.ground = { relief, groundAt: this.reliefHeights.sampler(relief) };
    const level = this.ground.groundAt(x, y);
    return Number.isFinite(level) ? level * LEVEL_HEIGHT : 0;
  }

  /** Alturas do relevo que o Worker entregou: os objetos assentam na altura nova (docs/design/desempenho.md). */
  acceptReliefHeights(windows: ReliefWindow[]) {
    for (const window of windows) this.reliefHeights.accept(window.key, window.heights);
    this.ground = null;
    if (this.lastSet) this.setProps(this.lastSet.props, this.lastSet.relief);
  }

  /** Relevo inteiro novo (troca de cena, relevo apagado): as alturas guardadas não valem mais. */
  forgetReliefHeights() {
    this.reliefHeights.clear();
    this.ground = null;
  }

  /** Copas com token embaixo: meio transparentes e paradas. */
  setFaded(ids: ReadonlySet<string>) {
    this.faded = ids;
    this.version++;
  }

  /** Objeto sendo arrastado ou mexido pelas alças (o desenho acompanha). */
  setDrag(id: string | null, drag: PropDrag | null) {
    this.drag = id && drag ? { id, drag } : null;
    this.version++;
  }

  /** Vento do clima (`null` = parado). */
  setWind(wind: { strength: number; direction: [number, number] } | null) {
    this.wind = wind;
    this.version++;
  }

  /** Há planta balançando (o chão precisa de quadros). */
  get swaying(): boolean {
    return this.wind !== null && this.wind.strength > 0 && this.placed.some(({ prop }) => SWAYING_KINDS.has(prop.kind));
  }

  private onScreen(view: GroundView, margin = 0): Placed[] {
    const left = (-view.stageX / view.scale - view.offsetX) / view.cellPx - margin;
    const top = (-view.stageY / view.scale - view.offsetY) / view.cellPx - margin;
    const right = left + view.width / view.scale / view.cellPx + margin * 2;
    const bottom = top + view.height / view.scale / view.cellPx + margin * 2;
    return this.placed.filter(({ prop }) => {
      const box = propBounds(prop, this.drag?.id === prop.id ? this.drag.drag : null);
      return box.right >= left && box.left <= right && box.bottom >= top && box.top <= bottom;
    });
  }

  /** Assa até `BAKE_PER_FRAME` formas da tela; devolve se assou alguma (o desenho precisa ser refeito). */
  bake(view: GroundView): boolean {
    const { gl } = this;
    this.frame++;
    this.bakes.beginDraw();
    const visible = this.onScreen(view);
    const tier = this.atlas.tierFor({
      small: visible.filter(({ prop }) => slotClassOf(prop.kind) === "small").length,
      large: visible.filter(({ prop }) => slotClassOf(prop.kind) === "large").length,
    });
    let baked = 0;
    this.waiting = false;
    // Os da tela primeiro; depois os de fora cuja sombra cai na tela (só esses não deixam o passo "esperando").
    const shown = new Set(visible);
    const nearby = this.onScreen(view, this.shadowMargin).filter((placed) => !shown.has(placed));
    for (const placed of [...visible, ...nearby]) {
      const { prop } = placed;
      const found = this.atlas.slotFor(`${prop.kind}|${prop.seed}|${tier}`, slotClassOf(prop.kind), this.frame);
      if (!found || !found.fresh) continue;
      if (baked >= BAKE_PER_FRAME) {
        // sem vez neste quadro: devolve o lugar (vai ser pedido de novo, ainda fresco)
        this.atlas.forget(`${prop.kind}|${prop.seed}|${tier}`);
        this.waiting = true;
        continue;
      }
      const program = this.bakes.get(prop.kind, () => propBakeFragment(prop.kind));
      if (!program) {
        this.atlas.forget(`${prop.kind}|${prop.seed}|${tier}`);
        // programa compilando: `pending` já pede quadros pelo cache de programas
        continue;
      }
      this.bakeOne(program, found.slot, prop.seed);
      baked++;
    }
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    if (baked > 0) this.version++;
    return baked > 0;
  }

  private bakeOne(program: Program, slot: PropSlot, seed: number) {
    const { gl } = this;
    gl.bindFramebuffer(gl.FRAMEBUFFER, this.framebuffer);
    gl.framebufferTextureLayer(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, this.shapeTexture, 0, slot.layer);
    gl.framebufferTextureLayer(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT1, this.slopeTexture, 0, slot.layer);
    gl.drawBuffers([gl.COLOR_ATTACHMENT0, gl.COLOR_ATTACHMENT1]);
    gl.viewport(slot.x, slot.y, slot.side, slot.side);
    gl.disable(gl.BLEND);
    gl.useProgram(program.program);
    const reach = slot.side / (2 * PROP_TIERS[this.atlas.currentTier]);
    gl.uniform3f(uniformOf(gl, program, "uSlot"), slot.x, slot.y, slot.side);
    gl.uniform1f(uniformOf(gl, program, "uReach"), reach);
    gl.uniform1f(uniformOf(gl, program, "uSeed"), (seed % 997) + 0.5);
    // o triângulo da tela inteira, no lugar (o vertex padrão lê o atributo 0)
    gl.bindVertexArray(null);
    useVertices(gl, this.triangle);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
    gl.drawBuffers([gl.COLOR_ATTACHMENT0]);
    gl.framebufferTextureLayer(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT1, null, 0, 0);
  }

  /**
   * Desenha os objetos de uma camada no alvo ligado (tela inteira, cor pré-multiplicada), na ordem da lista. Só os
   * que já têm forma no atlas; os outros aparecem nos próximos quadros.
   */
  draw(layer: "below" | "above", view: GroundView, width: number, height: number, scene: SceneLight, time: number, art: PropArt) {
    this.draws.beginDraw();
    const rows = this.readyRows(this.onScreen(view).filter(({ prop }) => prop.above === (layer === "above")));
    if (rows.length === 0) return;
    const program = this.draws.get("draw", () => PROP_DRAW_FRAGMENT);
    if (!program) return;
    this.upload(rows);
    this.drawRows(program, rows.length, view, width, height, scene, time, art);
  }

  /** Desenha as linhas já enviadas no alvo ligado (tela inteira ou o ícone). */
  private drawRows(program: Program, count: number, view: GroundView, width: number, height: number, scene: SceneLight, time: number, art: PropArt) {
    const { gl } = this;
    const tier = this.atlas.currentTier;
    gl.useProgram(program.program);
    gl.viewport(0, 0, width, height);
    gl.uniform4f(uniformOf(gl, program, "uMapGrid"), view.offsetX, view.offsetY, view.cellPx, 0);
    gl.uniform3f(uniformOf(gl, program, "uStage"), view.stageX, view.stageY, view.scale);
    gl.uniform2f(uniformOf(gl, program, "uScreen"), view.width, view.height);
    gl.uniform2f(uniformOf(gl, program, "uCanvas"), width, height);
    gl.uniform1fv(uniformOf(gl, program, "uExtents"), PROP_EXTENTS);
    gl.uniform1f(uniformOf(gl, program, "uAtlas"), ATLAS);
    gl.uniform1f(uniformOf(gl, program, "uPoints"), PROP_TIERS[tier]);
    const light = faceLight(scene);
    gl.uniform3f(uniformOf(gl, program, "uLightDir"), ...light.direction);
    gl.uniform1f(uniformOf(gl, program, "uLightAmount"), light.amount);
    gl.uniform1f(uniformOf(gl, program, "uAmbientLum"), light.ambientLum);
    gl.uniform1f(uniformOf(gl, program, "uSunLum"), light.sunLum);
    gl.uniform1f(uniformOf(gl, program, "uTime"), time);
    gl.uniform1f(uniformOf(gl, program, "uWind"), this.wind?.strength ?? 0);
    gl.uniform2f(uniformOf(gl, program, "uWindDir"), ...(this.wind?.direction ?? [1, 0]));
    // aquarelas nas unidades 0 a 2; o atlas (de outro tipo) nas 3 e 4
    bindTextures(gl, program, [["uLeaves", art.leaves], ["uStone", art.stone], ["uDirt", art.dirt]]);
    gl.activeTexture(gl.TEXTURE3);
    gl.bindTexture(gl.TEXTURE_2D_ARRAY, this.shapeTexture);
    gl.uniform1i(uniformOf(gl, program, "uShape"), 3);
    gl.activeTexture(gl.TEXTURE4);
    gl.bindTexture(gl.TEXTURE_2D_ARRAY, this.slopeTexture);
    gl.uniform1i(uniformOf(gl, program, "uSlope"), 4);
    gl.enable(gl.BLEND);
    gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
    gl.bindVertexArray(this.vertexArray);
    gl.drawArraysInstanced(gl.TRIANGLES, 0, 6, count);
    gl.bindVertexArray(null);
    gl.disable(gl.BLEND);
  }

  /**
   * Ícone do tipo para o painel Objetos (docs/design/objetos.md): a forma de uma semente fixa, desenhada de dia num
   * alvo pequeno e copiada para uma imagem guardada. `null` enquanto um programa compila (quem pede tenta de novo).
   */
  iconOf(kind: PropKind, side: number, art: PropArt): HTMLCanvasElement | null {
    const { gl } = this;
    const cached = this.icons.get(`${kind}|${side}`);
    if (cached) return cached;
    const draw = this.draws.get("draw", () => PROP_DRAW_FRAGMENT);
    const bake = this.bakes.get(kind, () => propBakeFragment(kind));
    if (!draw || !bake) return null;
    const key = `${kind}|${ICON_SEED}|${this.atlas.currentTier}`;
    const found = this.atlas.slotFor(key, slotClassOf(kind), this.frame);
    if (!found) return null;
    if (found.fresh) this.bakeOne(bake, found.slot, ICON_SEED);
    const target = gl.createTexture();
    const framebuffer = gl.createFramebuffer();
    if (!target || !framebuffer) return null;
    gl.bindTexture(gl.TEXTURE_2D, target);
    gl.texStorage2D(gl.TEXTURE_2D, 1, gl.RGBA8, side, side);
    gl.bindFramebuffer(gl.FRAMEBUFFER, framebuffer);
    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, target, 0);
    gl.clearColor(0, 0, 0, 0);
    gl.clear(gl.COLOR_BUFFER_BIT);
    const prop: MapProp = { id: "icon", kind, col: 0, row: 0, size: 1, rotation: 0, seed: ICON_SEED, above: false, blocks: false };
    this.upload([propRow({ prop, base: 0, faded: false, drag: null }, found.slot)]);
    // o objeto inteiro no quadrado: o alcance do tipo vai de uma borda à outra
    const view: GroundView = { offsetX: 0, offsetY: 0, cellPx: side / (2 * PROP_EXTENT[kind]), stageX: side / 2, stageY: side / 2, scale: 1, width: side, height: side, pixelRatio: 1 };
    const wind = this.wind;
    this.wind = null;
    this.drawRows(draw, 1, view, side, side, SCENE_LIGHT.day, 0, art);
    this.wind = wind;
    const pixels = new Uint8Array(side * side * 4);
    gl.readPixels(0, 0, side, side, gl.RGBA, gl.UNSIGNED_BYTE, pixels);
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    gl.deleteFramebuffer(framebuffer);
    gl.deleteTexture(target);
    const canvas = document.createElement("canvas");
    canvas.width = canvas.height = side;
    const context = canvas.getContext("2d");
    if (!context) return null;
    const image = context.createImageData(side, side);
    // de baixo para cima (WebGL) para de cima para baixo, e a cor sai da pré-multiplicação
    for (let row = 0; row < side; row++) {
      for (let col = 0; col < side; col++) {
        const from = ((side - 1 - row) * side + col) * 4;
        const to = (row * side + col) * 4;
        const alpha = pixels[from + 3];
        const scale = alpha > 0 ? 255 / alpha : 0;
        image.data[to] = Math.min(255, pixels[from] * scale);
        image.data[to + 1] = Math.min(255, pixels[from + 1] * scale);
        image.data[to + 2] = Math.min(255, pixels[from + 2] * scale);
        image.data[to + 3] = alpha;
      }
    }
    context.putImageData(image, 0, 0);
    this.icons.set(`${kind}|${side}`, canvas);
    return canvas;
  }

  /**
   * Linhas dos objetos que já têm forma no atlas; os que ainda não têm esperam o próximo quadro. `wait` = ficar sem
   * forma pede mais quadros (os da tela); a sombra de quem está fora não pede (a forma vem no `bake` seguinte).
   */
  private readyRows(list: Placed[], wait = true): Float32Array[] {
    const tier = this.atlas.currentTier;
    const rows: Float32Array[] = [];
    for (const { prop, base } of list) {
      const key = `${prop.kind}|${prop.seed}|${tier}`;
      const found = this.atlas.slotFor(key, slotClassOf(prop.kind), this.frame);
      if (!found) continue;
      if (found.fresh) {
        // ainda não assada: devolve o lugar e espera o próximo quadro
        this.atlas.forget(key);
        if (wait) this.waiting = true;
        continue;
      }
      const drag = this.drag?.id === prop.id ? this.drag.drag : null;
      rows.push(propRow({ prop, base, faded: this.faded.has(prop.id), drag }, found.slot));
    }
    return rows;
  }

  private upload(rows: Float32Array[]) {
    const { gl } = this;
    const data = new Float32Array(rows.length * PROP_ROW_FLOATS);
    rows.forEach((row, index) => data.set(row, index * PROP_ROW_FLOATS));
    gl.bindBuffer(gl.ARRAY_BUFFER, this.instances);
    gl.bufferData(gl.ARRAY_BUFFER, data, gl.STREAM_DRAW);
  }

  /**
   * Os objetos no mapa de alturas (docs/design/sombras.md), no alvo já ligado: topo pela maior, começo pela menor. `view` já é a
   * tela com a faixa em volta; `margin` (casas) fica para o próximo `bake` assar as formas dessa faixa.
   */
  drawHeights(view: GroundView, width: number, height: number, time: number, margin: number) {
    const { gl } = this;
    this.heights.beginDraw();
    this.shadowMargin = margin;
    if (this.empty) return;
    const placed = this.onScreen(view);
    if (placed.length === 0) return;
    const program = this.heights.get("height", () => PROP_HEIGHT_FRAGMENT);
    if (!program) return;
    gl.useProgram(program.program);
    gl.viewport(0, 0, width, height);
    gl.uniform4f(uniformOf(gl, program, "uMapGrid"), view.offsetX, view.offsetY, view.cellPx, 0);
    gl.uniform3f(uniformOf(gl, program, "uStage"), view.stageX, view.stageY, view.scale);
    gl.uniform2f(uniformOf(gl, program, "uScreen"), view.width, view.height);
    gl.uniform1fv(uniformOf(gl, program, "uExtents"), PROP_EXTENTS);
    gl.uniform1f(uniformOf(gl, program, "uAtlas"), ATLAS);
    gl.uniform1f(uniformOf(gl, program, "uPoints"), PROP_TIERS[this.atlas.currentTier]);
    gl.uniform1f(uniformOf(gl, program, "uTime"), time);
    gl.uniform1f(uniformOf(gl, program, "uWind"), this.wind?.strength ?? 0);
    gl.uniform2f(uniformOf(gl, program, "uWindDir"), ...(this.wind?.direction ?? [1, 0]));
    gl.activeTexture(gl.TEXTURE3);
    gl.bindTexture(gl.TEXTURE_2D_ARRAY, this.shapeTexture);
    gl.uniform1i(uniformOf(gl, program, "uShape"), 3);
    // topo pela maior (R) e começo pela menor (A): as copas num desenho à parte, com o começo acima das tochas baixas
    gl.enable(gl.BLEND);
    gl.blendEquationSeparate(gl.MAX, gl.MIN);
    for (const canopy of [false, true]) {
      const rows = this.readyRows(placed.filter(({ prop }) => prop.above === canopy), false);
      if (rows.length === 0) continue;
      this.upload(rows);
      gl.uniform1f(uniformOf(gl, program, "uCanopyBottom"), canopy ? CANOPY_BOTTOM : 0);
      gl.bindVertexArray(this.vertexArray);
      gl.drawArraysInstanced(gl.TRIANGLES, 0, 6, rows.length);
      gl.bindVertexArray(null);
    }
    gl.blendEquation(gl.FUNC_ADD);
    gl.disable(gl.BLEND);
  }

  dispose() {
    const { gl } = this;
    this.bakes.dispose();
    this.draws.dispose();
    this.heights.dispose();
    gl.deleteTexture(this.shapeTexture);
    gl.deleteTexture(this.slopeTexture);
    gl.deleteFramebuffer(this.framebuffer);
    gl.deleteBuffer(this.corners);
    gl.deleteBuffer(this.instances);
    gl.deleteBuffer(this.triangle);
    gl.deleteVertexArray(this.vertexArray);
  }
}
