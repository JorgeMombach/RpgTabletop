import { reliefSampler, type MapProp, type PropKind, type ReliefChunks } from "@rpg/shared";
import { bindTextures, ProgramCache, uniformOf, useVertices, vertexBuffer, type GroundView, type Program } from "../ground/glKit";
import { faceLight, type SceneLight } from "../ground/sceneLight";
import { FULLSCREEN_VERTEX } from "../ground/terrainShader";
import { PROP_TIERS, PropAtlas, propBounds, propRow, PROP_ROW_FLOATS, slotClassOf, type PropDrag, type PropSlot } from "./propLayout";
import { PROP_DRAW_FRAGMENT, PROP_DRAW_VERTEX, PROP_EXTENTS, propBakeFragment, SHAPED_KINDS } from "./propShader";

/** Tipos que já saem da placa de vídeo (os outros continuam no desenho do Konva até a Tarefa 6). */
export const GPU_PROP_KINDS: ReadonlySet<PropKind> = SHAPED_KINDS;

/** Lado do atlas e camadas: 1 de lugares pequenos e 2 de grandes (2 × 4 bytes por ponto ≈ 96 MB na placa). */
const ATLAS = 2048;
const ATLAS_LAYERS = { small: 1, large: 2 };
/** Formas assadas por quadro: uma floresta inteira aparece em poucos quadros, sem travar. */
const BAKE_PER_FRAME = 6;
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
  private frame = 0;
  /** Ficou forma da tela sem assar (precisa de mais quadros). */
  private waiting = false;
  /** Sobe a cada mudança que muda o desenho (objetos, arrasto, transparência, forma assada). */
  version = 0;

  constructor(private readonly gl: WebGL2RenderingContext) {
    this.bakes = new ProgramCache(gl, FULLSCREEN_VERTEX);
    this.draws = new ProgramCache(gl, PROP_DRAW_VERTEX, "aCorner");
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
    return !this.empty && (this.bakes.pending || this.draws.pending || this.waiting);
  }

  /** Começa a compilar o desenho e as formas dos tipos da placa (ferramenta Objetos aberta, cena com objetos). */
  warm() {
    this.draws.warm("draw", () => PROP_DRAW_FRAGMENT);
    for (const kind of GPU_PROP_KINDS) this.bakes.warm(kind, () => propBakeFragment(kind));
  }

  /** Objetos da cena (só os tipos da placa) e o relevo (a base de cada um). */
  setProps(props: MapProp[], relief: ReliefChunks) {
    if (this.ground?.relief !== relief) this.ground = { relief, groundAt: reliefSampler(relief) };
    const { groundAt } = this.ground;
    this.placed = props
      .filter((prop) => GPU_PROP_KINDS.has(prop.kind))
      .map((prop) => {
        const level = groundAt(prop.col, prop.row);
        return { prop, base: Number.isFinite(level) ? level * LEVEL_HEIGHT : 0 };
      });
    this.version++;
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
    return this.wind !== null && this.wind.strength > 0 && this.placed.some(({ prop }) => prop.kind === "tree" || prop.kind === "pine" || prop.kind === "bush");
  }

  private onScreen(view: GroundView): Placed[] {
    const left = (-view.stageX / view.scale - view.offsetX) / view.cellPx;
    const top = (-view.stageY / view.scale - view.offsetY) / view.cellPx;
    const right = left + view.width / view.scale / view.cellPx;
    const bottom = top + view.height / view.scale / view.cellPx;
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
    for (const { prop } of visible) {
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
        this.waiting = true;
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
    const { gl } = this;
    this.draws.beginDraw();
    const tier = this.atlas.currentTier;
    const rows: Float32Array[] = [];
    for (const { prop, base } of this.onScreen(view)) {
      if (prop.above !== (layer === "above")) continue;
      const found = this.atlas.slotFor(`${prop.kind}|${prop.seed}|${tier}`, slotClassOf(prop.kind), this.frame);
      if (!found) continue;
      if (found.fresh) {
        // ainda não assada: devolve o lugar e espera o próximo quadro
        this.atlas.forget(`${prop.kind}|${prop.seed}|${tier}`);
        this.waiting = true;
        continue;
      }
      const drag = this.drag?.id === prop.id ? this.drag.drag : null;
      rows.push(propRow({ prop, base, faded: this.faded.has(prop.id), drag }, found.slot));
    }
    if (rows.length === 0) return;
    const program = this.draws.get("draw", () => PROP_DRAW_FRAGMENT);
    if (!program) return;
    const data = new Float32Array(rows.length * PROP_ROW_FLOATS);
    rows.forEach((row, index) => data.set(row, index * PROP_ROW_FLOATS));
    gl.bindBuffer(gl.ARRAY_BUFFER, this.instances);
    gl.bufferData(gl.ARRAY_BUFFER, data, gl.STREAM_DRAW);
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
    gl.drawArraysInstanced(gl.TRIANGLES, 0, 6, rows.length);
    gl.bindVertexArray(null);
    gl.disable(gl.BLEND);
  }

  dispose() {
    const { gl } = this;
    this.bakes.dispose();
    this.draws.dispose();
    gl.deleteTexture(this.shapeTexture);
    gl.deleteTexture(this.slopeTexture);
    gl.deleteFramebuffer(this.framebuffer);
    gl.deleteBuffer(this.corners);
    gl.deleteBuffer(this.instances);
    gl.deleteBuffer(this.triangle);
    gl.deleteVertexArray(this.vertexArray);
  }
}
