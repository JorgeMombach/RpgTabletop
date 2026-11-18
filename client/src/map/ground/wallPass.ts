import {
  packPieces,
  pieceMargin,
  wallCellIndex,
  WALL_STYLES,
  type WallPiece,
  type WallStyle,
} from "@rpg/shared";
import {
  bindTextures,
  createTexture,
  finishProgram,
  startProgram,
  uniformOf,
  useVertices,
  vertexBuffer,
  type GroundView,
  type PendingProgram,
  type Program,
} from "./glKit";
import type { SceneLight } from "./sceneLight";
import { FULLSCREEN_VERTEX } from "./terrainShader";
import {
  OPENING_FRAGMENT,
  WALL_TEXTURE_WIDTH,
  wallStyleFragment,
} from "./wallShader";

/**
 * Passo das paredes do renderizador do chão (docs/design/relevo.md, etapa 2): sobe as peças e o índice por casa como
 * texturas e desenha a camada das paredes, portas e janelas. Um programa por desenho, montado só quando o desenho
 * aparece e compilado em paralelo (cada um leva cerca de 1 s: compilar esperando travaria a tela); enquanto compila,
 * o desenho não aparece e `pending` pede mais quadros. Cada programa corta a tela na caixa das suas peças. Portas e
 * janelas: uma passada por peça, cortada na caixa dela.
 */

/** Sombra do sol: um nível tem 1,4 casa e sobe 1/(sombra × 1,6) por casa, como o relevo. */
const LEVEL_SHADOW = 1.6;
const LEVEL_HEIGHT = 1.4;

interface Box {
  x0: number;
  y0: number;
  x1: number;
  y1: number;
}

interface Uploaded {
  pieces: WebGLTexture;
  cells: WebGLTexture;
  list: WebGLTexture;
  box: [number, number, number, number];
}

export class WallPass {
  private readonly triangle: WebGLBuffer;
  /** Programas por desenho e o das aberturas (`"opening"`): prontos ou ainda compilando. */
  private readonly programs = new Map<
    WallStyle | "opening",
    { ready: Program } | { pending: PendingProgram }
  >();
  private readonly parallel: KHR_parallel_shader_compile | null;
  /** Algum programa em uso ainda compilando no último desenho. */
  private compiling = false;
  private uploaded: Uploaded | null = null;
  /** Caixa (casas) das paredes de cada desenho. */
  private styleBoxes = new Map<WallStyle, Box>();
  /** Portas e janelas: índice na textura e caixa (casas). */
  private openings: { index: number; box: Box }[] = [];

  constructor(private readonly gl: WebGL2RenderingContext) {
    this.triangle = vertexBuffer(gl, [-1, -1, 3, -1, -1, 3]);
    this.parallel = gl.getExtension("KHR_parallel_shader_compile");
  }

  /** Há desenho esperando programa compilar: precisa de mais quadros. */
  get pending(): boolean {
    return this.compiling;
  }

  get empty(): boolean {
    return this.uploaded === null;
  }

  private release() {
    if (!this.uploaded) return;
    const { gl } = this;
    gl.deleteTexture(this.uploaded.pieces);
    gl.deleteTexture(this.uploaded.cells);
    gl.deleteTexture(this.uploaded.list);
    this.uploaded = null;
  }

  /** Peças novas: sobem as peças, o índice e a lista; guarda as caixas para cortar a tela. */
  setPieces(pieces: WallPiece[]) {
    const { gl } = this;
    this.release();
    this.styleBoxes = new Map();
    this.openings = [];
    const index = wallCellIndex(pieces);
    if (!index) return;
    const width = WALL_TEXTURE_WIDTH;
    const packed = packPieces(pieces);
    const pieceRows = Math.max(1, Math.ceil(packed.length / 4 / width));
    const pieceData = new Float32Array(width * pieceRows * 4);
    pieceData.set(packed);
    const cellData = new Uint32Array(index.cols * index.rows * 2);
    for (let at = 0; at < index.start.length; at++) {
      cellData[at * 2] = index.start[at];
      cellData[at * 2 + 1] = index.count[at];
    }
    const listRows = Math.max(1, Math.ceil(index.list.length / width));
    const listData = new Uint32Array(width * listRows);
    listData.set(index.list);
    gl.pixelStorei(gl.UNPACK_ALIGNMENT, 4);
    this.uploaded = {
      pieces: createTexture(
        gl,
        () =>
          gl.texImage2D(
            gl.TEXTURE_2D,
            0,
            gl.RGBA32F,
            width,
            pieceRows,
            0,
            gl.RGBA,
            gl.FLOAT,
            pieceData,
          ),
        gl.NEAREST,
        gl.CLAMP_TO_EDGE,
      ),
      cells: createTexture(
        gl,
        () =>
          gl.texImage2D(
            gl.TEXTURE_2D,
            0,
            gl.RG32UI,
            index.cols,
            index.rows,
            0,
            gl.RG_INTEGER,
            gl.UNSIGNED_INT,
            cellData,
          ),
        gl.NEAREST,
        gl.CLAMP_TO_EDGE,
      ),
      list: createTexture(
        gl,
        () =>
          gl.texImage2D(
            gl.TEXTURE_2D,
            0,
            gl.R32UI,
            width,
            listRows,
            0,
            gl.RED_INTEGER,
            gl.UNSIGNED_INT,
            listData,
          ),
        gl.NEAREST,
        gl.CLAMP_TO_EDGE,
      ),
      box: [index.col, index.row, index.cols, index.rows],
    };
    pieces.forEach((piece, pieceIndex) => {
      const reach =
        pieceMargin(piece) + Math.max(piece.reach[0], piece.reach[1]);
      const box = {
        x0: Math.min(piece.a.x, piece.b.x) - reach,
        y0: Math.min(piece.a.y, piece.b.y) - reach,
        x1: Math.max(piece.a.x, piece.b.x) + reach,
        y1: Math.max(piece.a.y, piece.b.y) + reach,
      };
      if (piece.kind !== "wall") {
        this.openings.push({ index: pieceIndex, box });
        return;
      }
      const known = this.styleBoxes.get(piece.style);
      this.styleBoxes.set(
        piece.style,
        known
          ? {
              x0: Math.min(known.x0, box.x0),
              y0: Math.min(known.y0, box.y0),
              x1: Math.max(known.x1, box.x1),
              y1: Math.max(known.y1, box.y1),
            }
          : box,
      );
    });
  }

  /** O programa pronto, ou `null` enquanto compila (começa a compilar na primeira vez). */
  private programFor(key: WallStyle | "opening"): Program | null {
    const known = this.programs.get(key);
    if (known && "ready" in known) return known.ready;
    const pending =
      known?.pending ??
      startProgram(
        this.gl,
        FULLSCREEN_VERTEX,
        key === "opening" ? OPENING_FRAGMENT : wallStyleFragment(key),
        "aPos",
      );
    const ready = finishProgram(this.gl, pending, this.parallel);
    this.programs.set(key, ready ? { ready } : { pending });
    if (!ready) this.compiling = true;
    return ready;
  }

  /** Caixa no mapa (casas) em pixels do canvas, já virada para o `scissor` (origem embaixo); `null` fora da tela. */
  private scissorOf(
    box: Box,
    view: GroundView,
    width: number,
    height: number,
  ): [number, number, number, number] | null {
    const kx = width / view.width;
    const ky = height / view.height;
    const toScreenX = (x: number) =>
      (view.stageX + (view.offsetX + x * view.cellPx) * view.scale) * kx;
    const toScreenY = (y: number) =>
      (view.stageY + (view.offsetY + y * view.cellPx) * view.scale) * ky;
    const left = Math.max(0, Math.floor(toScreenX(box.x0)));
    const right = Math.min(width, Math.ceil(toScreenX(box.x1)));
    const top = Math.max(0, Math.floor(toScreenY(box.y0)));
    const bottom = Math.min(height, Math.ceil(toScreenY(box.y1)));
    if (right <= left || bottom <= top) return null;
    return [left, height - bottom, right - left, bottom - top];
  }

  private bindCommon(
    program: Program,
    view: GroundView,
    width: number,
    height: number,
    scene: SceneLight,
    stone: WebGLTexture,
    stoneLight: WebGLTexture,
  ) {
    const { gl } = this;
    const uploaded = this.uploaded;
    if (!uploaded) return;
    gl.useProgram(program.program);
    useVertices(gl, this.triangle);
    bindTextures(gl, program, [
      ["uPieces", uploaded.pieces],
      ["uCells", uploaded.cells],
      ["uList", uploaded.list],
      ["uStone", stone],
      ["uStone2", stoneLight],
    ]);
    gl.uniform4i(uniformOf(gl, program, "uIndexBox"), ...uploaded.box);
    gl.uniform4f(
      uniformOf(gl, program, "uMapGrid"),
      view.offsetX,
      view.offsetY,
      view.cellPx,
      0,
    );
    gl.uniform3f(
      uniformOf(gl, program, "uStage"),
      view.stageX,
      view.stageY,
      view.scale,
    );
    gl.uniform2f(uniformOf(gl, program, "uScreen"), view.width, view.height);
    gl.uniform2f(uniformOf(gl, program, "uCanvas"), width, height);
    // A mesma luz da face do relevo (sem sol: uma luz fraca de mentira, só para o volume se ler).
    const sunny = scene.shadowCells > 0.01;
    const [dx, dy] = sunny ? scene.sunDirection : [0.6, 0.8];
    const lift = sunny
      ? (1 / (scene.shadowCells * LEVEL_SHADOW)) * LEVEL_HEIGHT
      : 1;
    const length = Math.hypot(dx, dy, lift) || 1;
    gl.uniform3f(
      uniformOf(gl, program, "uLightDir"),
      -dx / length,
      -dy / length,
      lift / length,
    );
    gl.uniform1f(uniformOf(gl, program, "uLightAmount"), sunny ? 1 : 0.4);
    const luminance = (rgb: [number, number, number]) =>
      rgb[0] * 0.3 + rgb[1] * 0.59 + rgb[2] * 0.11;
    gl.uniform1f(
      uniformOf(gl, program, "uAmbientLum"),
      luminance(scene.ambient),
    );
    gl.uniform1f(
      uniformOf(gl, program, "uSunLum"),
      sunny ? luminance(scene.sun) : luminance(scene.ambient) * 0.5,
    );
  }

  /** Desenha a camada no framebuffer ligado (já limpo), na tela inteira; cor pré-multiplicada. */
  draw(
    view: GroundView,
    width: number,
    height: number,
    scene: SceneLight,
    stone: WebGLTexture,
    stoneLight: WebGLTexture,
  ) {
    const { gl } = this;
    this.compiling = false;
    if (!this.uploaded) return;
    gl.enable(gl.BLEND);
    gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
    gl.enable(gl.SCISSOR_TEST);
    for (const style of WALL_STYLES) {
      const box = this.styleBoxes.get(style);
      const scissor = box && this.scissorOf(box, view, width, height);
      if (!scissor) continue;
      const program = this.programFor(style);
      if (!program) continue;
      this.bindCommon(program, view, width, height, scene, stone, stoneLight);
      gl.scissor(...scissor);
      gl.drawArrays(gl.TRIANGLES, 0, 3);
    }
    if (this.openings.length > 0) {
      const program = this.programFor("opening");
      if (program)
        this.bindCommon(program, view, width, height, scene, stone, stoneLight);
      for (const opening of this.openings) {
        const scissor = this.scissorOf(opening.box, view, width, height);
        if (!scissor || !program) continue;
        gl.uniform1i(uniformOf(gl, program, "uPiece"), opening.index);
        gl.scissor(...scissor);
        gl.drawArrays(gl.TRIANGLES, 0, 3);
      }
    }
    gl.disable(gl.SCISSOR_TEST);
    gl.disable(gl.BLEND);
  }

  dispose() {
    const { gl } = this;
    this.release();
    for (const entry of this.programs.values())
      gl.deleteProgram(
        "ready" in entry ? entry.ready.program : entry.pending.program,
      );
    gl.deleteBuffer(this.triangle);
  }
}
