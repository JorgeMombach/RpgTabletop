import type { EffectPreset, MapConfig, MapEffect } from "@rpg/shared";
import { cellRectOnScreen, createTexture, linkProgram, ProgramCache, uniformOf, useVertices, type GroundView, type Program } from "../ground/glKit";
import { fogNoiseData } from "../ground/fogGeometry";
import { effectBounds, effectLook, effectTint, effectTriangles, type EffectLook } from "./effectLayout";
import { EFFECT_BOX_VERTEX, EFFECT_MASK_FRAGMENT, EFFECT_MASK_VERTEX, effectFragment } from "./effectShader";

/**
 * Efeitos de área na placa de vídeo (docs/design/efeitos.md). Cada efeito tem uma máscara própria (8 px por casa, com
 * 6 casas de folga para a luz e níveis menores para a borda macia), feita uma vez quando a forma muda. O desenho de
 * cada tipo vai numa caixa justa (a forma mais 1,5 casa); as partículas saem do shader, sem nada no processador por
 * quadro. Os que iluminam e a escuridão vão para o passo da luz (`lights`, `darkness`).
 */

/** Pixels da máscara por casa e folga em volta da forma (casas). */
const MASK_PER_CELL = 8;
const MASK_MARGIN = 6;
/** Folga do desenho em volta da forma (casas): a borda irregular e o que transborda. */
const DRAW_PAD = 1.5;
/** Apagado do efeito desligado (só o mestre vê). */
const INACTIVE_DIM = 0.3;
/** Lado máximo da máscara (px): área enorme baixa a densidade em vez de pesar. */
const MAX_MASK_SIDE = 2048;

/** Uma área que acende ou apaga a luz, para o passo da luz. */
export interface AreaLight {
  mask: WebGLTexture;
  /** Caixa da máscara: canto e tamanho, em casas. */
  box: [number, number, number, number];
  center: { x: number; y: number };
  /** Raio aproximado da área (casas). */
  radius: number;
  look: EffectLook;
  seed: number;
  /** Arrasto do token que o efeito acompanha (casas). */
  offset: { x: number; y: number };
}

interface Entry {
  key: string;
  effect: MapEffect;
  mask: WebGLTexture;
  box: [number, number, number, number];
  bounds: [number, number, number, number];
  seed: number;
}

/** Semente fixa por id (o mesmo efeito desenha igual em todos os navegadores). */
function seedOf(id: string): number {
  let hash = 0;
  for (let index = 0; index < id.length; index++) hash = (Math.imul(hash, 31) + id.charCodeAt(index)) | 0;
  return ((hash >>> 0) % 1000) / 10;
}

export class EffectPass {
  private readonly programs: ProgramCache<EffectPreset>;
  private readonly mask: Program;
  private readonly framebuffer: WebGLFramebuffer | null;
  private readonly shapeBuffer: WebGLBuffer;
  private readonly boxBuffer: WebGLBuffer;
  private noise: WebGLTexture | null = null;
  private entries = new Map<string, Entry>();
  private follow: { id: string | null; x: number; y: number } = { id: null, x: 0, y: 0 };
  private changes = 0;

  constructor(private readonly gl: WebGL2RenderingContext) {
    this.programs = new ProgramCache(gl, EFFECT_BOX_VERTEX, "aCell");
    this.mask = linkProgram(gl, EFFECT_MASK_VERTEX, EFFECT_MASK_FRAGMENT, "aCell");
    this.framebuffer = gl.createFramebuffer();
    const shape = gl.createBuffer();
    const box = gl.createBuffer();
    if (!shape || !box) throw new Error("buffer");
    this.shapeBuffer = shape;
    this.boxBuffer = box;
  }

  /** Há efeitos na cena. */
  get active(): boolean {
    return this.entries.size > 0;
  }

  /** Algum efeito ligado (anima: precisa de quadros). */
  get animating(): boolean {
    for (const entry of this.entries.values()) if (entry.effect.active) return true;
    return false;
  }

  /** Algum programa ainda compilando (o próximo quadro desenha de novo). */
  get pending(): boolean {
    return this.programs.pending;
  }

  /** Sobe quando os efeitos ou o arrasto mudam (a luz e a imagem são refeitas). */
  get version(): number {
    return this.changes;
  }

  /** Os efeitos da cena: refaz só a máscara de quem mudou de forma; solta a de quem saiu. */
  set(effects: MapEffect[], map: Pick<MapConfig, "feetPerCell" | "grid">) {
    const { gl } = this;
    const seen = new Set<string>();
    for (const effect of effects) {
      seen.add(effect.id);
      const key = JSON.stringify([effect.area, effect.cells ?? null, map.grid ?? "square", map.feetPerCell]);
      const known = this.entries.get(effect.id);
      if (known && known.key === key) {
        known.effect = effect;
        continue;
      }
      if (known) gl.deleteTexture(known.mask);
      const built = this.buildMask(effect, map);
      if (built) this.entries.set(effect.id, { key, effect, seed: seedOf(effect.id), ...built });
    }
    for (const [id, entry] of this.entries) {
      if (seen.has(id)) continue;
      gl.deleteTexture(entry.mask);
      this.entries.delete(id);
    }
    this.changes++;
  }

  /** Arrasto do token `id` (casas): os efeitos que o acompanham andam junto, sem refazer a máscara. */
  setFollow(id: string | null, dx: number, dy: number) {
    this.follow = { id, x: dx, y: dy };
    this.changes++;
  }

  /** Começa a compilar o programa de cada tipo na cena (a ferramenta ou a cena com efeitos). */
  warm() {
    for (const entry of this.entries.values()) this.programs.warm(entry.effect.preset, () => effectFragment(entry.effect.preset));
  }

  /** Os efeitos no alvo ligado (cor pré-multiplicada), do tamanho `width` × `height`. */
  draw(view: GroundView, width: number, height: number, time: number) {
    const { gl } = this;
    this.programs.beginDraw();
    if (this.entries.size === 0) return;
    const noise = (this.noise ??= this.noiseTexture());
    gl.viewport(0, 0, width, height);
    gl.enable(gl.BLEND);
    gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
    for (const entry of this.entries.values()) {
      const offset = this.offsetOf(entry);
      const [x0, y0, x1, y1] = entry.bounds;
      const [x, y, w, h] = [x0 - DRAW_PAD + offset.x, y0 - DRAW_PAD + offset.y, x1 - x0 + DRAW_PAD * 2, y1 - y0 + DRAW_PAD * 2];
      if (!cellRectOnScreen(view, x, y, w, h)) continue;
      const { preset } = entry.effect;
      const program = this.programs.get(preset, () => effectFragment(preset));
      if (!program) continue;
      gl.useProgram(program.program);
      gl.uniform4f(uniformOf(gl, program, "uMapGrid"), view.offsetX, view.offsetY, view.cellPx, 0);
      gl.uniform3f(uniformOf(gl, program, "uStage"), view.stageX, view.stageY, view.scale);
      gl.uniform2f(uniformOf(gl, program, "uScreen"), view.width, view.height);
      gl.uniform2f(uniformOf(gl, program, "uOffset"), offset.x, offset.y);
      gl.uniform4f(uniformOf(gl, program, "uBox"), ...entry.box);
      // desligado (só o mestre vê): parado e apagado
      gl.uniform1f(uniformOf(gl, program, "uTime"), entry.effect.active ? time : 0);
      gl.uniform1f(uniformOf(gl, program, "uDim"), entry.effect.active ? 1 : INACTIVE_DIM);
      gl.uniform1f(uniformOf(gl, program, "uSeed"), entry.seed);
      gl.uniform2f(uniformOf(gl, program, "uCenter"), (x0 + x1) / 2, (y0 + y1) / 2);
      gl.uniform2f(uniformOf(gl, program, "uRadii"), ((x1 - x0) / 2) * 0.85, ((y1 - y0) / 2) * 0.85);
      gl.uniform4f(uniformOf(gl, program, "uTint"), ...effectTint(entry.effect));
      for (const [name, texture, unit] of [
        ["uNoise", noise, 0],
        ["uMask", entry.mask, 1],
      ] as const) {
        gl.activeTexture(gl.TEXTURE0 + unit);
        gl.bindTexture(gl.TEXTURE_2D, texture);
        gl.uniform1i(uniformOf(gl, program, name), unit);
      }
      // a caixa em casas sem o arrasto (o vértice desloca): `vCell` lê a máscara onde ela está
      const [bx, by] = [x - offset.x, y - offset.y];
      gl.bindBuffer(gl.ARRAY_BUFFER, this.boxBuffer);
      gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([bx, by, bx + w, by, bx, by + h, bx, by + h, bx + w, by, bx + w, by + h]), gl.DYNAMIC_DRAW);
      useVertices(gl, this.boxBuffer);
      gl.drawArrays(gl.TRIANGLES, 0, 6);
    }
    gl.activeTexture(gl.TEXTURE0);
    gl.disable(gl.BLEND);
  }

  /** As áreas que acendem luz (para o passo da luz). */
  lights(): AreaLight[] {
    return this.areas((look) => look.emit !== null);
  }

  /** As áreas de escuridão (apagam a luz). */
  darkness(): AreaLight[] {
    return this.areas((look) => look.darkens);
  }

  private areas(keep: (look: EffectLook) => boolean): AreaLight[] {
    const list: AreaLight[] = [];
    for (const entry of this.entries.values()) {
      const look = effectLook(entry.effect);
      if (!keep(look)) continue;
      const [x0, y0, x1, y1] = entry.bounds;
      list.push({ mask: entry.mask, box: entry.box, center: { x: (x0 + x1) / 2, y: (y0 + y1) / 2 }, radius: Math.max(x1 - x0, y1 - y0) / 2, look, seed: entry.seed, offset: this.offsetOf(entry) });
    }
    return list;
  }

  private offsetOf(entry: Entry): { x: number; y: number } {
    return entry.effect.followId && entry.effect.followId === this.follow.id ? { x: this.follow.x, y: this.follow.y } : { x: 0, y: 0 };
  }

  /** A máscara da forma: os triângulos numa textura da caixa com folga, com níveis menores. */
  private buildMask(effect: MapEffect, map: Pick<MapConfig, "feetPerCell" | "grid">): Omit<Entry, "key" | "effect" | "seed"> | null {
    const { gl } = this;
    const points = effectTriangles(effect, map);
    if (points.length === 0) return null;
    const bounds = effectBounds(points);
    const box: [number, number, number, number] = [bounds[0] - MASK_MARGIN, bounds[1] - MASK_MARGIN, bounds[2] - bounds[0] + MASK_MARGIN * 2, bounds[3] - bounds[1] + MASK_MARGIN * 2];
    const density = Math.min(MASK_PER_CELL, MAX_MASK_SIDE / box[2], MAX_MASK_SIDE / box[3]);
    const width = Math.max(1, Math.ceil(box[2] * density));
    const height = Math.max(1, Math.ceil(box[3] * density));
    const mask = createTexture(gl, () => gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA8, width, height, 0, gl.RGBA, gl.UNSIGNED_BYTE, null), gl.LINEAR_MIPMAP_LINEAR, gl.CLAMP_TO_EDGE);
    gl.bindFramebuffer(gl.FRAMEBUFFER, this.framebuffer);
    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, mask, 0);
    gl.viewport(0, 0, width, height);
    gl.disable(gl.BLEND);
    gl.clearColor(0, 0, 0, 0);
    gl.clear(gl.COLOR_BUFFER_BIT);
    gl.useProgram(this.mask.program);
    gl.uniform4f(uniformOf(gl, this.mask, "uBox"), ...box);
    gl.bindBuffer(gl.ARRAY_BUFFER, this.shapeBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, points, gl.DYNAMIC_DRAW);
    useVertices(gl, this.shapeBuffer);
    gl.drawArrays(gl.TRIANGLES, 0, points.length / 2);
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    gl.bindTexture(gl.TEXTURE_2D, mask);
    gl.generateMipmap(gl.TEXTURE_2D);
    return { mask, box, bounds };
  }

  private noiseTexture(): WebGLTexture {
    const { gl } = this;
    const data = fogNoiseData(256, 8);
    const texture = createTexture(gl, () => gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA8, 256, 256, 0, gl.RGBA, gl.UNSIGNED_BYTE, data), gl.LINEAR_MIPMAP_LINEAR, gl.REPEAT);
    gl.generateMipmap(gl.TEXTURE_2D);
    return texture;
  }

  dispose() {
    const { gl } = this;
    this.programs.dispose();
    gl.deleteProgram(this.mask.program);
    gl.deleteFramebuffer(this.framebuffer);
    gl.deleteBuffer(this.shapeBuffer);
    gl.deleteBuffer(this.boxBuffer);
    for (const entry of this.entries.values()) gl.deleteTexture(entry.mask);
    if (this.noise) gl.deleteTexture(this.noise);
    this.entries.clear();
  }
}
