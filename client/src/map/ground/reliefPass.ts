import { RELIEF_MARGIN, TERRAIN_CHUNK_CELLS } from "@rpg/shared";
import { bindTextures, createTexture, linkProgram, uniformOf, useVertices, vertexBuffer, type GroundView, type Program } from "./glKit";
import { BAKE_FIELDS_FRAGMENT, BAKE_SHADOW_FRAGMENT, RELIEF_DRAW_FRAGMENT, RELIEF_SHADOW_MASK_FRAGMENT } from "./reliefShader";
import type { ReliefWindow } from "./reliefTypes";
import type { SceneLight } from "./sceneLight";
import { FULLSCREEN_VERTEX } from "./terrainShader";

/**
 * Passo do relevo no renderizador do chão (docs/design/relevo.md, abordagem A). A altura de cada pedaço vem pronta do
 * Worker; aqui ela vira, na placa de vídeo, campos guardados num atlas (altura, normal, rocha, suave) e uma sombra por
 * luz da cena. O desenho de cada quadro só lê o atlas (Tarefa 6). Calcula poucos pedaços por quadro, sem travar.
 */

/** Lado do atlas (px). Memória fixa: 2048² × (4 + 4 + 1 + 1) bytes ≈ 42 MB. */
const ATLAS = 2048;
/** Resoluções (px por casa), da melhor à menor: passando da capacidade, cai para a seguinte. */
const TIERS = [32, 16, 8];
/** Pedaços calculados por quadro (campos e sombra). */
const BAKE_PER_FRAME = 4;
/** Altura de um nível na conta da sombra: um nível faz sombra de `shadowCells × LEVEL_SHADOW` casas. */
const LEVEL_SHADOW = 1.6;
/** Um nível tem 1,4 casa de altura (para a luz da face). */
const LEVEL_HEIGHT = 1.4;
/** Troca de sombra ao mudar a luz da cena (s), depois de todos os pedaços prontos. */
const SHADOW_FADE = 0.5;

/** Onde o pedaço está no atlas, em pedaços (linha e coluna). */
export interface ReliefSlotIndex {
  /** Pedaço do canto de cima à esquerda do índice. */
  cx: number;
  cy: number;
  cols: number;
  rows: number;
  texture: WebGLTexture;
}

export class ReliefPass {
  private readonly fields: Program;
  private readonly shadow: Program;
  /** Desenho de cada quadro: a camada do relevo e a sombra na máscara do passo da luz. */
  private readonly draw: Program;
  private readonly shadowMask: Program;
  private readonly triangle: WebGLBuffer;
  private readonly fieldsFramebuffer: WebGLFramebuffer | null;
  private readonly shadowFramebuffer: WebGLFramebuffer | null;
  readonly atlasA: WebGLTexture;
  readonly atlasB: WebGLTexture;
  /** Sombra da luz atual e a da anterior (para a troca suave). */
  shadowCurrent: WebGLTexture;
  shadowPrevious: WebGLTexture;
  private windowTexture: WebGLTexture | null = null;
  private windowSide = 0;
  /** Altura de cada pedaço com relevo por perto (cópia na memória: a sombra é refeita quando a luz muda). */
  private readonly windows = new Map<string, ReliefWindow>();
  private readonly slots = new Map<string, number>();
  private free: number[] = [];
  private tier = 0;
  private readonly fieldsQueue = new Set<string>();
  private readonly shadowQueue = new Set<string>();
  private sun: { dir: [number, number]; rise: number } | null = null;
  private fadeStart = -Infinity;
  private index: ReliefSlotIndex | null = null;

  constructor(
    private readonly gl: WebGL2RenderingContext,
    /** Tela pequena (celular, tablet): começa a 16 px por casa. */
    smallScreen: boolean,
  ) {
    this.fields = linkProgram(gl, FULLSCREEN_VERTEX, BAKE_FIELDS_FRAGMENT, "aPos");
    this.shadow = linkProgram(gl, FULLSCREEN_VERTEX, BAKE_SHADOW_FRAGMENT, "aPos");
    this.draw = linkProgram(gl, FULLSCREEN_VERTEX, RELIEF_DRAW_FRAGMENT, "aPos");
    this.shadowMask = linkProgram(gl, FULLSCREEN_VERTEX, RELIEF_SHADOW_MASK_FRAGMENT, "aPos");
    this.triangle = vertexBuffer(gl, [-1, -1, 3, -1, -1, 3]);
    const rgba = () => createTexture(gl, () => gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA8, ATLAS, ATLAS, 0, gl.RGBA, gl.UNSIGNED_BYTE, null), gl.LINEAR, gl.CLAMP_TO_EDGE);
    const single = () => createTexture(gl, () => gl.texImage2D(gl.TEXTURE_2D, 0, gl.R8, ATLAS, ATLAS, 0, gl.RED, gl.UNSIGNED_BYTE, null), gl.LINEAR, gl.CLAMP_TO_EDGE);
    this.atlasA = rgba();
    this.atlasB = rgba();
    this.shadowCurrent = single();
    this.shadowPrevious = single();
    this.fieldsFramebuffer = gl.createFramebuffer();
    gl.bindFramebuffer(gl.FRAMEBUFFER, this.fieldsFramebuffer);
    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, this.atlasA, 0);
    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT1, gl.TEXTURE_2D, this.atlasB, 0);
    this.shadowFramebuffer = gl.createFramebuffer();
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    this.tier = smallScreen ? 1 : 0;
    this.resetSlots();
  }

  /** px por casa no atlas agora. */
  get perCell(): number {
    return TIERS[this.tier];
  }

  /** Lado de um lugar do atlas (px). */
  get slotSize(): number {
    return TERRAIN_CHUNK_CELLS * this.perCell;
  }

  private get slotsPerRow(): number {
    return ATLAS / this.slotSize;
  }

  private resetSlots() {
    this.slots.clear();
    this.free = Array.from({ length: this.slotsPerRow * this.slotsPerRow }, (_, slot) => slot);
  }

  /**
   * Alturas novas (do Worker). Pedaço sem relevo nenhum na janela (tudo chão plano) sai do atlas. Os que ficam vão
   * para a fila de cálculo.
   */
  setWindows(windows: ReliefWindow[]) {
    for (const window of windows) {
      const flat = window.heights.every((value) => value === 0) && window.soft.every((value) => value === 0);
      if (flat) {
        this.removeKey(window.key);
        continue;
      }
      this.windows.set(window.key, window);
      this.fieldsQueue.add(window.key);
    }
    this.allocate();
  }

  /** Esquece pedaços (cena trocada, relevo apagado): `"all"` limpa tudo. */
  forget(keys: string[] | "all") {
    for (const key of keys === "all" ? [...this.windows.keys()] : keys) this.removeKey(key);
    this.rebuildIndex();
  }

  private removeKey(key: string) {
    this.windows.delete(key);
    this.fieldsQueue.delete(key);
    this.shadowQueue.delete(key);
    const slot = this.slots.get(key);
    if (slot === undefined) return;
    this.slots.delete(key);
    this.free.push(slot);
  }

  /** Dá lugar no atlas a quem não tem; sem lugar para todos, cai para a resolução seguinte e recalcula tudo. */
  private allocate(): void {
    const missing = [...this.windows.keys()].filter((key) => !this.slots.has(key));
    if (missing.length > this.free.length && this.tier < TIERS.length - 1) {
      while (this.windows.size > (ATLAS / (TERRAIN_CHUNK_CELLS * TIERS[this.tier])) ** 2 && this.tier < TIERS.length - 1) this.tier++;
      this.resetSlots();
      for (const key of this.windows.keys()) this.fieldsQueue.add(key);
      return this.allocate();
    }
    for (const key of missing) {
      const slot = this.free.pop();
      // Sem lugar nem resolução menor: o pedaço fica plano (só acontece com muito mais relevo que o limite da cena).
      if (slot === undefined) break;
      this.slots.set(key, slot);
    }
    this.rebuildIndex();
  }

  /** Índice pedaço → lugar no atlas, numa textura pequena (r, g = lugar; a = tem). */
  private rebuildIndex() {
    const { gl } = this;
    if (this.index) gl.deleteTexture(this.index.texture);
    this.index = null;
    if (this.slots.size === 0) return;
    let minX = Infinity;
    let minY = Infinity;
    let maxX = -Infinity;
    let maxY = -Infinity;
    for (const key of this.slots.keys()) {
      const [cx, cy] = key.split(",").map(Number);
      minX = Math.min(minX, cx);
      minY = Math.min(minY, cy);
      maxX = Math.max(maxX, cx);
      maxY = Math.max(maxY, cy);
    }
    const cols = maxX - minX + 1;
    const rows = maxY - minY + 1;
    const data = new Uint8Array(cols * rows * 4);
    for (const [key, slot] of this.slots) {
      const [cx, cy] = key.split(",").map(Number);
      const at = ((cy - minY) * cols + (cx - minX)) * 4;
      data[at] = slot & 255;
      data[at + 1] = slot >> 8;
      data[at + 3] = 255;
    }
    gl.pixelStorei(gl.UNPACK_ALIGNMENT, 1);
    const texture = createTexture(gl, () => gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA8, cols, rows, 0, gl.RGBA, gl.UNSIGNED_BYTE, data), gl.NEAREST, gl.CLAMP_TO_EDGE);
    this.index = { cx: minX, cy: minY, cols, rows, texture };
  }

  /**
   * Luz da cena: direção para onde a sombra cai e comprimento da sombra de uma parede (`shadowCells`). Sem sol nem
   * lua, sem sombra de relevo. Ao mudar, a sombra atual vira a anterior e todos os pedaços recalculam.
   */
  setSun(scene: SceneLight) {
    const next = scene.shadowCells > 0.01 ? { dir: scene.sunDirection, rise: 1 / (scene.shadowCells * LEVEL_SHADOW) } : null;
    const same = (this.sun === null && next === null) || (this.sun !== null && next !== null && Math.abs(this.sun.rise - next.rise) < 1e-3 && Math.abs(this.sun.dir[0] - next.dir[0]) < 1e-3 && Math.abs(this.sun.dir[1] - next.dir[1]) < 1e-3);
    if (same) return;
    this.sun = next;
    [this.shadowCurrent, this.shadowPrevious] = [this.shadowPrevious, this.shadowCurrent];
    for (const key of this.windows.keys()) this.shadowQueue.add(key);
    this.fadeStart = Infinity;
  }

  /** Há pedaços para calcular (o desenho precisa de mais quadros). */
  get pending(): boolean {
    return this.fieldsQueue.size > 0 || this.shadowQueue.size > 0 || this.shadowMix < 1;
  }

  /** Mistura da sombra nova com a anterior (0 = só a anterior); a troca começa quando todos os pedaços estão prontos. */
  get shadowMix(): number {
    if (this.fadeStart === Infinity) return 0;
    return Math.min(1, (performance.now() - this.fadeStart) / 1000 / SHADOW_FADE);
  }

  /** Sem sombra de relevo (noite). */
  get sunless(): boolean {
    return this.sun === null;
  }

  get slotIndex(): ReliefSlotIndex | null {
    return this.index;
  }

  /** Lugar `slot` no atlas: canto (px). */
  slotOrigin(slot: number): [number, number] {
    return [(slot % this.slotsPerRow) * this.slotSize, Math.floor(slot / this.slotsPerRow) * this.slotSize];
  }

  /** Calcula alguns pedaços da fila (campos e sombra). Devolve se calculou algo (precisa redesenhar). */
  bake(): boolean {
    const { gl } = this;
    let done = 0;
    for (const key of this.fieldsQueue) {
      if (done >= BAKE_PER_FRAME) break;
      this.fieldsQueue.delete(key);
      const slot = this.slots.get(key);
      const window = this.windows.get(key);
      if (slot === undefined || !window) continue;
      this.uploadWindow(window);
      this.bakeFields(key, slot);
      this.shadowQueue.add(key);
      done++;
    }
    for (const key of this.shadowQueue) {
      if (done >= BAKE_PER_FRAME * 2) break;
      if (this.fieldsQueue.has(key)) continue;
      this.shadowQueue.delete(key);
      const slot = this.slots.get(key);
      const window = this.windows.get(key);
      if (slot === undefined || !window) continue;
      this.uploadWindow(window);
      this.bakeShadow(slot);
      done++;
    }
    // Todos prontos depois de uma troca de luz: começa a mistura.
    if (this.fadeStart === Infinity && this.shadowQueue.size === 0 && this.fieldsQueue.size === 0) this.fadeStart = performance.now();
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    return done > 0;
  }

  private uploadWindow(window: ReliefWindow) {
    const { gl } = this;
    if (!this.windowTexture || this.windowSide !== window.side) {
      if (this.windowTexture) gl.deleteTexture(this.windowTexture);
      this.windowSide = window.side;
      this.windowTexture = createTexture(gl, () => gl.texImage2D(gl.TEXTURE_2D, 0, gl.RG32F, window.side, window.side, 0, gl.RG, gl.FLOAT, null), gl.NEAREST, gl.CLAMP_TO_EDGE);
    }
    const data = new Float32Array(window.side * window.side * 2);
    for (let index = 0; index < window.heights.length; index++) {
      data[index * 2] = window.heights[index];
      data[index * 2 + 1] = window.soft[index];
    }
    gl.bindTexture(gl.TEXTURE_2D, this.windowTexture);
    gl.pixelStorei(gl.UNPACK_ALIGNMENT, 4);
    gl.texSubImage2D(gl.TEXTURE_2D, 0, 0, 0, window.side, window.side, gl.RG, gl.FLOAT, data);
  }

  private windowUniforms(program: Program, slot: number) {
    const { gl } = this;
    const [x, y] = this.slotOrigin(slot);
    gl.viewport(x, y, this.slotSize, this.slotSize);
    gl.useProgram(program.program);
    useVertices(gl, this.triangle);
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, this.windowTexture);
    gl.uniform1i(uniformOf(gl, program, "uWindow"), 0);
    gl.uniform1f(uniformOf(gl, program, "uWindowSide"), this.windowSide);
    gl.uniform1f(uniformOf(gl, program, "uPerCell"), (this.windowSide - 1) / (TERRAIN_CHUNK_CELLS + 2 * this.margin));
    gl.uniform1f(uniformOf(gl, program, "uMargin"), this.margin);
    gl.uniform1f(uniformOf(gl, program, "uChunkCells"), TERRAIN_CHUNK_CELLS);
    gl.uniform2f(uniformOf(gl, program, "uSlotOrigin"), x, y);
    gl.uniform1f(uniformOf(gl, program, "uSlotSize"), this.slotSize);
  }

  /** Margem da janela (casas): a mesma do `shared`. */
  private get margin(): number {
    return RELIEF_MARGIN;
  }

  private bakeFields(key: string, slot: number) {
    const { gl } = this;
    gl.bindFramebuffer(gl.FRAMEBUFFER, this.fieldsFramebuffer);
    gl.drawBuffers([gl.COLOR_ATTACHMENT0, gl.COLOR_ATTACHMENT1]);
    gl.disable(gl.BLEND);
    this.windowUniforms(this.fields, slot);
    const [cx, cy] = key.split(",").map(Number);
    gl.uniform2f(uniformOf(gl, this.fields, "uChunkOrigin"), cx * TERRAIN_CHUNK_CELLS, cy * TERRAIN_CHUNK_CELLS);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
  }

  private bakeShadow(slot: number) {
    const { gl } = this;
    gl.bindFramebuffer(gl.FRAMEBUFFER, this.shadowFramebuffer);
    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, this.shadowCurrent, 0);
    gl.disable(gl.BLEND);
    const [x, y] = this.slotOrigin(slot);
    if (!this.sun) {
      // Sem sol: o lugar fica todo iluminado.
      gl.viewport(x, y, this.slotSize, this.slotSize);
      gl.enable(gl.SCISSOR_TEST);
      gl.scissor(x, y, this.slotSize, this.slotSize);
      gl.clearColor(1, 0, 0, 1);
      gl.clear(gl.COLOR_BUFFER_BIT);
      gl.disable(gl.SCISSOR_TEST);
      return;
    }
    this.windowUniforms(this.shadow, slot);
    gl.uniform2f(uniformOf(gl, this.shadow, "uSunDir"), this.sun.dir[0], this.sun.dir[1]);
    gl.uniform1f(uniformOf(gl, this.shadow, "uRise"), this.sun.rise);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
  }

  /** Tem relevo guardado para desenhar. */
  get drawable(): boolean {
    return this.index !== null;
  }

  /** Uniformes do atlas (`RELIEF_SAMPLE`) e da tela, com as texturas a partir de `extra` (as do programa vêm antes). */
  private bindSample(program: Program, view: GroundView, width: number, height: number, extra: [string, WebGLTexture][]) {
    const { gl } = this;
    const index = this.index;
    if (!index) return;
    gl.useProgram(program.program);
    useVertices(gl, this.triangle);
    bindTextures(gl, program, [...extra, ["uReliefIndex", index.texture], ["uReliefA", this.atlasA], ["uReliefB", this.atlasB], ["uReliefShadow", this.shadowCurrent], ["uReliefShadowPrevious", this.shadowPrevious]]);
    gl.uniform4f(uniformOf(gl, program, "uReliefRect"), index.cx, index.cy, index.cols, index.rows);
    gl.uniform1f(uniformOf(gl, program, "uReliefPerRow"), this.slotsPerRow);
    gl.uniform1f(uniformOf(gl, program, "uReliefSlot"), this.slotSize);
    gl.uniform1f(uniformOf(gl, program, "uReliefAtlas"), ATLAS);
    gl.uniform1f(uniformOf(gl, program, "uReliefShadowMix"), this.shadowMix);
    gl.uniform1f(uniformOf(gl, program, "uReliefSunless"), this.sun ? 0 : 1);
    gl.uniform4f(uniformOf(gl, program, "uMapGrid"), view.offsetX, view.offsetY, view.cellPx, 0);
    gl.uniform3f(uniformOf(gl, program, "uStage"), view.stageX, view.stageY, view.scale);
    gl.uniform2f(uniformOf(gl, program, "uScreen"), view.width, view.height);
    gl.uniform2f(uniformOf(gl, program, "uCanvas"), width, height);
  }

  /**
   * A camada do relevo (no alvo já ligado, do tamanho `width × height`): rocha e luz das encostas. A luz vem da cena:
   * `scene` dá a direção e a altura do sol (a mesma conta da sombra); sem sol, uma luz fraca de cima à esquerda.
   */
  drawLayer(view: GroundView, width: number, height: number, scene: SceneLight, stone: WebGLTexture, stoneLight: WebGLTexture) {
    const { gl } = this;
    if (!this.index) return;
    this.bindSample(this.draw, view, width, height, [
      ["uStone", stone],
      ["uStoneLight", stoneLight],
    ]);
    const sunny = scene.shadowCells > 0.01;
    const [dx, dy] = sunny ? scene.sunDirection : [0.6, 0.8];
    // Altura do sol como na sombra: sobe 1/(sombra × 1,6) níveis por casa, um nível tem 1,4 casa.
    const lift = sunny ? (1 / (scene.shadowCells * LEVEL_SHADOW)) * LEVEL_HEIGHT : 1;
    const length = Math.hypot(dx, dy, lift) || 1;
    gl.uniform3f(uniformOf(gl, this.draw, "uLightDir"), -dx / length, -dy / length, lift / length);
    gl.uniform1f(uniformOf(gl, this.draw, "uLightAmount"), sunny ? 1 : 0.4);
    const luminance = (rgb: [number, number, number]) => rgb[0] * 0.3 + rgb[1] * 0.59 + rgb[2] * 0.11;
    // Sem sol, uma luz fraca de mentira (metade do ambiente) só para a encosta se ler.
    gl.uniform1f(uniformOf(gl, this.draw, "uAmbientLum"), luminance(scene.ambient));
    gl.uniform1f(uniformOf(gl, this.draw, "uSunLum"), sunny ? luminance(scene.sun) : luminance(scene.ambient) * 0.5);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
  }

  /** A sombra do relevo na máscara de sombra do passo da luz (alvo já ligado), pela maior. */
  drawShadowMask(view: GroundView, width: number, height: number) {
    const { gl } = this;
    if (!this.index || !this.sun) return;
    this.bindSample(this.shadowMask, view, width, height, []);
    gl.enable(gl.BLEND);
    gl.blendEquation(gl.MAX);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
    gl.blendEquation(gl.FUNC_ADD);
    gl.disable(gl.BLEND);
  }

  dispose() {
    const { gl } = this;
    for (const texture of [this.atlasA, this.atlasB, this.shadowCurrent, this.shadowPrevious, this.windowTexture, this.index?.texture]) if (texture) gl.deleteTexture(texture);
  }
}
