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
  /** O que já subiu de cada pedaço (o texto, os pontos e os materiais): a prévia do pincel só manda o que mudou. */
  private chunkCache = new Map<string, { text: string; bytes: Uint8Array | null; materials: Set<FloorMaterial> }>();
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

  /**
   * Piso novo da cena (ou a prévia da passada, a cada movimento do pincel). A textura cobre a caixa dos pedaços com
   * piso (o resto fica 0). Se a caixa é a mesma, só os pedaços que mudaram sobem; as caixas dos tapetes só são
   * refeitas quando um pedaço com tapete (antes ou depois) mudou.
   */
  setChunks(chunks: FloorChunks) {
    const { gl } = this;
    const keys = Object.keys(chunks);
    if (keys.length === 0) {
      this.release();
      this.chunkCache.clear();
      this.present = new Set();
      this.carpetCount = 0;
      return;
    }
    const changed = keys.filter((key) => this.chunkCache.get(key)?.text !== chunks[key]);
    const removed = [...this.chunkCache.keys()].filter((key) => !(key in chunks));
    if (this.uploaded && changed.length === 0 && removed.length === 0) return;
    // materiais de cada pedaço (para saber o que desenhar e se algum tapete mudou)
    let carpetsChanged = false;
    for (const key of removed) {
      if (this.chunkCache.get(key)?.materials.has("carpet")) carpetsChanged = true;
      this.chunkCache.delete(key);
    }
    for (const key of changed) {
      if (this.chunkCache.get(key)?.materials.has("carpet")) carpetsChanged = true;
      const bytes = decodeLayer(chunks[key]);
      const materials = new Set<FloorMaterial>();
      if (bytes)
        for (const value of bytes) {
          const material = FLOOR_MATERIALS[(value & 15) - 1];
          if (material) materials.add(material);
        }
      if (materials.has("carpet")) carpetsChanged = true;
      this.chunkCache.set(key, { text: chunks[key], bytes, materials });
    }
    this.present = new Set([...this.chunkCache.values()].flatMap((entry) => [...entry.materials]));
    const coords = keys.map((key) => key.split(",").map(Number));
    const cx = Math.min(...coords.map(([x]) => x));
    const cy = Math.min(...coords.map(([, y]) => y));
    const cols = Math.max(...coords.map(([x]) => x)) - cx + 1;
    const rows = Math.max(...coords.map(([, y]) => y)) - cy + 1;
    const width = cols * TERRAIN_CHUNK_SIDE + 2;
    const height = rows * TERRAIN_CHUNK_SIDE + 2;
    const origin: [number, number] = [cx * TERRAIN_CHUNK_SIDE - 1, cy * TERRAIN_CHUNK_SIDE - 1];
    const uploaded = this.uploaded;
    if (uploaded && uploaded.origin[0] === origin[0] && uploaded.origin[1] === origin[1] && uploaded.size[0] === width && uploaded.size[1] === height) {
      // mesma caixa: troca só os pedaços que mudaram (o que saiu vira 0)
      gl.bindTexture(gl.TEXTURE_2D, uploaded.texture);
      gl.pixelStorei(gl.UNPACK_ALIGNMENT, 1);
      for (const key of [...changed, ...removed]) {
        const [x, y] = key.split(",").map(Number);
        const bytes = this.chunkCache.get(key)?.bytes ?? new Uint8Array(TERRAIN_CHUNK_SIDE * TERRAIN_CHUNK_SIDE);
        gl.texSubImage2D(gl.TEXTURE_2D, 0, (x - cx) * TERRAIN_CHUNK_SIDE + 1, (y - cy) * TERRAIN_CHUNK_SIDE + 1, TERRAIN_CHUNK_SIDE, TERRAIN_CHUNK_SIDE, gl.RED_INTEGER, gl.UNSIGNED_BYTE, bytes);
      }
    } else {
      this.release();
      const limit = Number(gl.getParameter(gl.MAX_TEXTURE_SIZE));
      if (width > limit || height > limit) return;
      const data = new Uint8Array(width * height);
      for (const [key, { bytes }] of this.chunkCache) {
        if (!bytes) continue;
        const [x, y] = key.split(",").map(Number);
        for (let j = 0; j < TERRAIN_CHUNK_SIDE; j++) {
          data.set(bytes.subarray(j * TERRAIN_CHUNK_SIDE, (j + 1) * TERRAIN_CHUNK_SIDE), ((y - cy) * TERRAIN_CHUNK_SIDE + j + 1) * width + (x - cx) * TERRAIN_CHUNK_SIDE + 1);
        }
      }
      const texture = createTexture(
        gl,
        () => {
          gl.pixelStorei(gl.UNPACK_ALIGNMENT, 1);
          gl.texImage2D(gl.TEXTURE_2D, 0, gl.R8UI, width, height, 0, gl.RED_INTEGER, gl.UNSIGNED_BYTE, data);
        },
        gl.NEAREST,
        gl.CLAMP_TO_EDGE,
      );
      this.uploaded = { texture, origin, size: [width, height] };
    }
    if (carpetsChanged) {
      const boxes = floorCarpetBoxes(chunks).slice(0, MAX_CARPETS);
      this.carpets = new Float32Array(MAX_CARPETS * 4);
      boxes.forEach((box, index) => this.carpets.set([box.x0, box.y0, box.x1, box.y1], index * 4));
      this.carpetCount = boxes.length;
    }
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
