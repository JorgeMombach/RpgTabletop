import type { WeatherId } from "@rpg/shared";
import { createTexture, linkProgram, uniformOf, useVertices, vertexBuffer, type GroundView, type Program } from "../ground/glKit";
import { fogNoiseData } from "../ground/fogGeometry";
import { FULLSCREEN_VERTEX } from "../ground/terrainShader";
import { flash, LightningClock } from "../weatherFx";
import { ROOF_PER_CELL, roofArea, roofTriangles, weatherClock, WEATHER_GLOWS, windCells } from "./weatherLayout";
import { ROOF_FRAGMENT, ROOF_VERTEX, WEATHER_AIR_FRAGMENT, WEATHER_COVER_FRAGMENT, WEATHER_FLASH_FRAGMENT, WEATHER_SHADER_INDEX } from "./weatherShader";

/**
 * Clima vivendo no mapa (docs/design/clima.md). Três desenhos de tela cheia: a cobertura do chão (cresce com o tempo
 * desde o início do clima), o que anda no ar e o que brilha sozinho. Dentro dos cômodos fechados (o telhado, numa
 * textura refeita só quando os cômodos mudam) nada cai nem cobre. As partículas saem do shader, sem nada no
 * processador por quadro.
 */

/** O clima da cena e os cômodos fechados que este cliente conhece. */
export interface WeatherInput {
  kind: WeatherId;
  intensity: number;
  /** Vento em graus (0 = cai reto). */
  wind: number;
  /** Hora do servidor em que o clima começou: o acúmulo e os relâmpagos. */
  startedAt: number;
  /** Reduzir efeitos: metade das partículas e sem o clarão. */
  reduce: boolean;
  rooms: number[][];
}

/** Lado máximo da textura do telhado (px). */
const ROOF_MAX_SIDE = 2048;

export class WeatherPass {
  private input: WeatherInput | null = null;
  private cover: Program | null = null;
  private air: Program | null = null;
  private roofProgram: Program | null = null;
  private flashProgram: Program | null = null;
  private readonly triangle: WebGLBuffer;
  private readonly framebuffer: WebGLFramebuffer | null;
  private noise: WebGLTexture | null = null;
  private roof: WebGLTexture | null = null;
  private readonly blank: WebGLTexture;
  private roofArea: { x: number; y: number; cols: number; rows: number } | null = null;
  private roofKey = "";
  private lightning: LightningClock | null = null;

  constructor(private readonly gl: WebGL2RenderingContext) {
    this.triangle = vertexBuffer(gl, [-1, -1, 3, -1, -1, 3]);
    this.framebuffer = gl.createFramebuffer();
    this.blank = createTexture(gl, () => gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA8, 1, 1, 0, gl.RGBA, gl.UNSIGNED_BYTE, new Uint8Array(4)), gl.NEAREST, gl.CLAMP_TO_EDGE);
  }

  /** Há clima na cena. */
  get active(): boolean {
    return this.input !== null;
  }

  /** O clima brilha sozinho (por cima da luz). */
  get glowing(): boolean {
    return this.input !== null && WEATHER_GLOWS.has(this.input.kind);
  }

  /** O clima da cena (`null`: sem clima). O telhado só é refeito quando os cômodos mudam. */
  set(input: WeatherInput | null) {
    const previous = this.input;
    this.input = input;
    if (!input) return;
    if (!previous || previous.kind !== input.kind || previous.startedAt !== input.startedAt || previous.intensity !== input.intensity) {
      this.lightning = input.kind === "storm" ? new LightningClock(input.startedAt, input.intensity) : null;
    }
    const key = JSON.stringify(input.rooms);
    if (key !== this.roofKey) {
      this.roofKey = key;
      this.buildRoof(input.rooms);
    }
  }

  /** O clarão do relâmpago agora (0 sem tempestade ou com Reduzir efeitos), com a curva de hoje. */
  flash(now: number): number {
    const input = this.input;
    if (!input || input.reduce || !this.lightning) return 0;
    const { time } = weatherClock(input.startedAt, now, input.intensity);
    const last = this.lightning.last(time);
    return last === null ? 0 : flash(time - last);
  }

  /** A cobertura do chão no alvo ligado (cor pré-multiplicada). */
  drawCover(view: GroundView, width: number, height: number, now: number) {
    const program = (this.cover ??= linkProgram(this.gl, FULLSCREEN_VERTEX, WEATHER_COVER_FRAGMENT, "aPos"));
    this.drawWith(program, view, width, height, now, null);
  }

  /** O que anda no ar (sem o que brilha). */
  drawAir(view: GroundView, width: number, height: number, now: number) {
    const program = (this.air ??= linkProgram(this.gl, FULLSCREEN_VERTEX, WEATHER_AIR_FRAGMENT, "aPos"));
    this.drawWith(program, view, width, height, now, 0);
  }

  /**
   * Só o que brilha sozinho (brasas, vagalumes, luzes mágicas, esporos) e o clarão do relâmpago: por cima da luz (o
   * mapa de luz é cortado em 1, então de dia o clarão somado nele não apareceria).
   */
  drawGlow(view: GroundView, width: number, height: number, now: number) {
    const { gl } = this;
    if (this.glowing) {
      const program = (this.air ??= linkProgram(gl, FULLSCREEN_VERTEX, WEATHER_AIR_FRAGMENT, "aPos"));
      this.drawWith(program, view, width, height, now, 1);
    }
    const strike = this.flash(now);
    if (strike <= 0) return;
    const program = (this.flashProgram ??= linkProgram(gl, FULLSCREEN_VERTEX, WEATHER_FLASH_FRAGMENT, "aPos"));
    gl.viewport(0, 0, width, height);
    gl.enable(gl.BLEND);
    gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
    gl.useProgram(program.program);
    useVertices(gl, this.triangle);
    gl.uniform1f(uniformOf(gl, program, "uFlash"), strike);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
    gl.disable(gl.BLEND);
  }

  /** Há o que desenhar na camada de brilho agora (o que brilha sozinho ou um clarão no ar). */
  glowsAt(now: number): boolean {
    return this.glowing || this.flash(now) > 0;
  }

  private drawWith(program: Program, view: GroundView, width: number, height: number, now: number, glow: number | null) {
    const { gl } = this;
    const input = this.input;
    if (!input) return;
    const { time, accumulation } = weatherClock(input.startedAt, now, input.intensity);
    const noise = (this.noise ??= this.noiseTexture());
    gl.viewport(0, 0, width, height);
    gl.enable(gl.BLEND);
    gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
    gl.useProgram(program.program);
    useVertices(gl, this.triangle);
    gl.uniform4f(uniformOf(gl, program, "uMapGrid"), view.offsetX, view.offsetY, view.cellPx, 0);
    gl.uniform3f(uniformOf(gl, program, "uStage"), view.stageX, view.stageY, view.scale);
    gl.uniform2f(uniformOf(gl, program, "uScreen"), view.width, view.height);
    gl.uniform2f(uniformOf(gl, program, "uCanvas"), width, height);
    // o acúmulo já vem vezes a intensidade; o shader multiplica de novo, então vai sem ela
    gl.uniform1f(uniformOf(gl, program, "uTime"), time);
    gl.uniform1f(uniformOf(gl, program, "uAcc"), input.intensity > 0 ? accumulation / input.intensity : 0);
    gl.uniform1f(uniformOf(gl, program, "uIntensity"), input.intensity);
    gl.uniform1f(uniformOf(gl, program, "uDensity"), input.intensity * (input.reduce ? 0.5 : 1));
    gl.uniform2f(uniformOf(gl, program, "uWind"), windCells(input.wind), Math.abs(input.wind) / 45);
    gl.uniform1i(uniformOf(gl, program, "uKind"), WEATHER_SHADER_INDEX[input.kind]);
    const area = this.roofArea;
    gl.uniform4f(uniformOf(gl, program, "uRoofArea"), area?.x ?? 0, area?.y ?? 0, area?.cols ?? 0, area?.rows ?? 0);
    if (glow !== null) gl.uniform1i(uniformOf(gl, program, "uGlow"), glow);
    for (const [name, texture, unit] of [
      ["uNoise", noise, 0],
      ["uRoof", this.roof ?? this.blank, 1],
    ] as const) {
      gl.activeTexture(gl.TEXTURE0 + unit);
      gl.bindTexture(gl.TEXTURE_2D, texture);
      gl.uniform1i(uniformOf(gl, program, name), unit);
    }
    gl.drawArrays(gl.TRIANGLES, 0, 3);
    gl.activeTexture(gl.TEXTURE0);
    gl.disable(gl.BLEND);
  }

  /** Os cômodos fechados na textura do telhado (8 px por casa, com níveis menores). */
  private buildRoof(rooms: number[][]) {
    const { gl } = this;
    if (this.roof) gl.deleteTexture(this.roof);
    this.roof = null;
    const points = roofTriangles(rooms);
    const area = roofArea(points, ROOF_MAX_SIDE);
    this.roofArea = area;
    if (!area) return;
    const width = area.cols * ROOF_PER_CELL;
    const height = area.rows * ROOF_PER_CELL;
    const roof = createTexture(gl, () => gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA8, width, height, 0, gl.RGBA, gl.UNSIGNED_BYTE, null), gl.LINEAR_MIPMAP_LINEAR, gl.CLAMP_TO_EDGE);
    const program = (this.roofProgram ??= linkProgram(gl, ROOF_VERTEX, ROOF_FRAGMENT, "aCell"));
    gl.bindFramebuffer(gl.FRAMEBUFFER, this.framebuffer);
    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, roof, 0);
    gl.viewport(0, 0, width, height);
    gl.disable(gl.BLEND);
    gl.clearColor(0, 0, 0, 0);
    gl.clear(gl.COLOR_BUFFER_BIT);
    gl.useProgram(program.program);
    gl.uniform4f(uniformOf(gl, program, "uArea"), area.x, area.y, area.cols, area.rows);
    const buffer = vertexBuffer(gl, [...points]);
    useVertices(gl, buffer);
    gl.drawArrays(gl.TRIANGLES, 0, points.length / 2);
    gl.deleteBuffer(buffer);
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    gl.bindTexture(gl.TEXTURE_2D, roof);
    gl.generateMipmap(gl.TEXTURE_2D);
    this.roof = roof;
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
    for (const program of [this.cover, this.air, this.roofProgram, this.flashProgram]) if (program) gl.deleteProgram(program.program);
    gl.deleteBuffer(this.triangle);
    gl.deleteFramebuffer(this.framebuffer);
    for (const texture of [this.noise, this.roof, this.blank]) if (texture) gl.deleteTexture(texture);
  }
}
