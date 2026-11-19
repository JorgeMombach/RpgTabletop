import {
  decodeLayer,
  FLOOR_MATERIALS,
  floorCarpetBoxes,
  TERRAIN_CHUNK_SIDE,
  type FloorChunks,
  type FloorMaterial,
} from "@rpg/shared";
import {
  bindTextures,
  createTexture,
  ProgramCache,
  uniformOf,
  useVertices,
  vertexBuffer,
  type GroundView,
} from "./glKit";
import { floorFragment, MAX_CARPETS } from "./floorShader";
import { faceLight, type SceneLight } from "./sceneLight";
import { FULLSCREEN_VERTEX } from "./terrainShader";

/**
 * Passo dos pisos do renderizador do chão (docs/design/pisos.md): sobe os bytes dos pedaços com piso numa textura de
 * inteiros (com uma borda vazia, como os pesos do terreno) e desenha uma camada por material presente, em ordem, no
 * alvo ligado. Os programas compilam em paralelo; enquanto um compila, `pending` pede mais quadros.
 */
/** Pesos da água do terreno (para o píer): segunda textura (canal a), terceira (canal r), origem e tamanho. */
export interface PierWater {
  second: WebGLTexture;
  third: WebGLTexture;
  origin: [number, number];
  size: [number, number];
}

export class FloorPass {
  private readonly triangle: WebGLBuffer;
  private readonly programs: ProgramCache<FloorMaterial>;
  private uploaded: {
    texture: WebGLTexture;
    origin: [number, number];
    size: [number, number];
  } | null = null;
  private present = new Set<FloorMaterial>();
  private carpets = new Float32Array(MAX_CARPETS * 4);
  private carpetCount = 0;

  constructor(private readonly gl: WebGL2RenderingContext) {
    this.triangle = vertexBuffer(gl, [-1, -1, 3, -1, -1, 3]);
    this.programs = new ProgramCache(gl, FULLSCREEN_VERTEX);
  }

  get empty(): boolean {
    return this.uploaded === null;
  }

  /** Algum programa em uso ainda compilando. */
  get pending(): boolean {
    return !this.empty && this.programs.pending;
  }

  private release() {
    if (this.uploaded) this.gl.deleteTexture(this.uploaded.texture);
    this.uploaded = null;
  }

  /** Piso novo da cena: sobe a área inteira com piso (só os pedaços pintados ocupam; o resto da caixa fica 0). */
  setChunks(chunks: FloorChunks) {
    const { gl } = this;
    this.release();
    this.present = new Set();
    const keys = Object.keys(chunks);
    if (keys.length === 0) return;
    const coords = keys.map((key) => key.split(",").map(Number));
    const cx = Math.min(...coords.map(([x]) => x));
    const cy = Math.min(...coords.map(([, y]) => y));
    const cols = Math.max(...coords.map(([x]) => x)) - cx + 1;
    const rows = Math.max(...coords.map(([, y]) => y)) - cy + 1;
    const width = cols * TERRAIN_CHUNK_SIDE + 2;
    const height = rows * TERRAIN_CHUNK_SIDE + 2;
    const limit = Number(gl.getParameter(gl.MAX_TEXTURE_SIZE));
    if (width > limit || height > limit) return;
    const data = new Uint8Array(width * height);
    for (const key of keys) {
      const bytes = decodeLayer(chunks[key]);
      if (!bytes) continue;
      const [x, y] = key.split(",").map(Number);
      for (let j = 0; j < TERRAIN_CHUNK_SIDE; j++) {
        for (let i = 0; i < TERRAIN_CHUNK_SIDE; i++) {
          const value = bytes[j * TERRAIN_CHUNK_SIDE + i];
          if (value === 0) continue;
          data[
            ((y - cy) * TERRAIN_CHUNK_SIDE + j + 1) * width +
              (x - cx) * TERRAIN_CHUNK_SIDE +
              i +
              1
          ] = value;
          const material = FLOOR_MATERIALS[(value & 15) - 1];
          if (material) this.present.add(material);
        }
      }
    }
    const texture = createTexture(
      gl,
      () => {
        gl.pixelStorei(gl.UNPACK_ALIGNMENT, 1);
        gl.texImage2D(
          gl.TEXTURE_2D,
          0,
          gl.R8UI,
          width,
          height,
          0,
          gl.RED_INTEGER,
          gl.UNSIGNED_BYTE,
          data,
        );
      },
      gl.NEAREST,
      gl.CLAMP_TO_EDGE,
    );
    this.uploaded = {
      texture,
      origin: [cx * TERRAIN_CHUNK_SIDE - 1, cy * TERRAIN_CHUNK_SIDE - 1],
      size: [width, height],
    };
    const boxes = floorCarpetBoxes(chunks).slice(0, MAX_CARPETS);
    this.carpets = new Float32Array(MAX_CARPETS * 4);
    boxes.forEach((box, index) =>
      this.carpets.set([box.x0, box.y0, box.x1, box.y1], index * 4),
    );
    this.carpetCount = boxes.length;
  }

  /** Começa a compilar o material escolhido na ferramenta, antes da primeira passada. */
  warm(material: FloorMaterial) {
    this.programs.warm(material, () => floorFragment(material));
  }

  /** Desenha os pisos no alvo ligado (já limpo), na tela inteira; cor pré-multiplicada. */
  draw(
    view: GroundView,
    width: number,
    height: number,
    scene: SceneLight,
    stone: WebGLTexture,
    water: PierWater | null,
    /** Textura vazia para os samplers da água quando não há terreno (cada sampler na sua unidade). */
    blank: WebGLTexture,
  ) {
    const { gl } = this;
    this.programs.beginDraw();
    const uploaded = this.uploaded;
    if (!uploaded) return;
    const light = faceLight(scene);
    gl.enable(gl.BLEND);
    gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
    for (const material of FLOOR_MATERIALS) {
      if (!this.present.has(material)) continue;
      const program = this.programs.get(material, () =>
        floorFragment(material),
      );
      if (!program) continue;
      gl.useProgram(program.program);
      useVertices(gl, this.triangle);
      bindTextures(gl, program, [
        ["uFloor", uploaded.texture],
        ["uStone", stone],
        ["uWaterA", water ? water.second : blank],
        ["uWaterB", water ? water.third : blank],
      ]);
      // píer: a água embaixo e para onde cai a sombra
      gl.uniform1f(uniformOf(gl, program, "uHasWater"), water ? 1 : 0);
      if (water) {
        gl.uniform2f(uniformOf(gl, program, "uWeightsOrigin"), ...water.origin);
        gl.uniform2f(uniformOf(gl, program, "uWeightsSize"), ...water.size);
      }
      const shift = scene.shadowCells > 0.01 ? scene.shadowCells * 1.6 : 0;
      gl.uniform2f(uniformOf(gl, program, "uSunShift"), scene.sunDirection[0] * shift, scene.sunDirection[1] * shift);
      gl.uniform2f(uniformOf(gl, program, "uFloorOrigin"), ...uploaded.origin);
      gl.uniform2f(uniformOf(gl, program, "uFloorSize"), ...uploaded.size);
      gl.uniform4fv(uniformOf(gl, program, "uCarpets[0]"), this.carpets);
      gl.uniform1i(uniformOf(gl, program, "uCarpetCount"), this.carpetCount);
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
      gl.uniform3f(uniformOf(gl, program, "uLightDir"), ...light.direction);
      gl.uniform1f(uniformOf(gl, program, "uLightAmount"), light.amount);
      gl.uniform1f(uniformOf(gl, program, "uAmbientLum"), light.ambientLum);
      gl.uniform1f(uniformOf(gl, program, "uSunLum"), light.sunLum);
      gl.drawArrays(gl.TRIANGLES, 0, 3);
    }
    gl.disable(gl.BLEND);
  }

  dispose() {
    this.release();
    this.programs.dispose();
    this.gl.deleteBuffer(this.triangle);
  }
}
