/**
 * Ajudantes do renderizador do chão (docs/design/renderizador-chao.md): programas, uniformes e texturas WebGL 2,
 * compartilhados pelos passos (terreno e água). Sem Konva nem React.
 */

/** Como o mapa está na tela: o grid (casa em px do mapa) e o palco (mapa -> tela), mais o tamanho e a densidade. */
export interface GroundView {
  offsetX: number;
  offsetY: number;
  cellPx: number;
  stageX: number;
  stageY: number;
  scale: number;
  width: number;
  height: number;
  pixelRatio: number;
}

/** Um retângulo do mapa (em casas) aparece na tela. */
export function cellRectOnScreen(view: GroundView, col: number, row: number, cols: number, rows: number): boolean {
  const left = (view.offsetX + col * view.cellPx) * view.scale + view.stageX;
  const top = (view.offsetY + row * view.cellPx) * view.scale + view.stageY;
  const right = left + cols * view.cellPx * view.scale;
  const bottom = top + rows * view.cellPx * view.scale;
  return right > 0 && bottom > 0 && left < view.width && top < view.height;
}

export interface Program {
  program: WebGLProgram;
  uniforms: Map<string, WebGLUniformLocation | null>;
}

/** Atributo de vértice de todos os programas do chão (fica sempre no lugar 0). */
export const VERTEX_ATTRIBUTE = 0;

/**
 * Uniform que nunca é preenchido (vale 0) para somar ao limite dos laços dos shaders: `k < 4 + uNoUnroll` dá as
 * mesmas voltas, mas o compilador não sabe o limite e não desenrola o laço. No Direct3D (Windows, pelo ANGLE) o
 * laço desenrolado copia o corpo a cada volta, e compilar a água levava ~13 s na placa integrada (medido em
 * 2026-11-19: água 13,6 s → 1,1 s; paredes ~1,2 → ~0,35 s; pisos ~2 → ~1,1 s), com a placa parada no meio.
 * Vai logo depois do `precision` de cada shader de fragmento.
 */
export const NO_UNROLL = "uniform int uNoUnroll;";

export function linkProgram(gl: WebGL2RenderingContext, vertexSource: string, fragmentSource: string, attribute: string): Program {
  const compile = (type: number, source: string) => {
    const shader = gl.createShader(type);
    if (!shader) throw new Error("shader");
    gl.shaderSource(shader, source);
    gl.compileShader(shader);
    if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(shader) ?? "shader");
    return shader;
  };
  const program = gl.createProgram();
  if (!program) throw new Error("programa");
  const vertex = compile(gl.VERTEX_SHADER, vertexSource);
  const fragment = compile(gl.FRAGMENT_SHADER, fragmentSource);
  gl.attachShader(program, vertex);
  gl.attachShader(program, fragment);
  gl.bindAttribLocation(program, VERTEX_ATTRIBUTE, attribute);
  gl.linkProgram(program);
  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(program) ?? "programa");
  releaseShaders(gl, program, vertex, fragment);
  return { program, uniforms: new Map() };
}

export function uniformOf(gl: WebGL2RenderingContext, target: Program, name: string): WebGLUniformLocation | null {
  if (!target.uniforms.has(name)) target.uniforms.set(name, gl.getUniformLocation(target.program, name));
  return target.uniforms.get(name) ?? null;
}

/** Textura nova, ligada, com o filtro e a repetição dados; `setup` envia os dados. */
export function createTexture(gl: WebGL2RenderingContext, setup: () => void, filter: number, wrap: number): WebGLTexture {
  const texture = gl.createTexture();
  if (!texture) throw new Error("textura");
  gl.bindTexture(gl.TEXTURE_2D, texture);
  setup();
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, filter);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, filter === gl.NEAREST ? gl.NEAREST : gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, wrap);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, wrap);
  return texture;
}

/** Imagem (aquarela, detalhe) como textura que repete, com mipmap. */
export function imageTexture(gl: WebGL2RenderingContext, image: TexImageSource): WebGLTexture {
  return createTexture(
    gl,
    () => {
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, image);
      gl.generateMipmap(gl.TEXTURE_2D);
    },
    gl.LINEAR_MIPMAP_LINEAR,
    gl.REPEAT,
  );
}

/** Liga as texturas aos uniformes, uma unidade para cada, na ordem. */
export function bindTextures(gl: WebGL2RenderingContext, target: Program, textures: [string, WebGLTexture][]) {
  textures.forEach(([name, texture], unit) => {
    gl.activeTexture(gl.TEXTURE0 + unit);
    gl.bindTexture(gl.TEXTURE_2D, texture);
    gl.uniform1i(uniformOf(gl, target, name), unit);
  });
}

/** Um buffer de vértices (pares x, y) no atributo do chão. */
export function useVertices(gl: WebGL2RenderingContext, buffer: WebGLBuffer) {
  gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
  gl.enableVertexAttribArray(VERTEX_ATTRIBUTE);
  gl.vertexAttribPointer(VERTEX_ATTRIBUTE, 2, gl.FLOAT, false, 0, 0);
}

export function vertexBuffer(gl: WebGL2RenderingContext, points: number[]): WebGLBuffer {
  const buffer = gl.createBuffer();
  if (!buffer) throw new Error("buffer");
  gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(points), gl.STATIC_DRAW);
  return buffer;
}

/** Programa ligado: os shaders já não servem para nada (o programa guarda o resultado) e saem da memória da placa. */
function releaseShaders(gl: WebGL2RenderingContext, program: WebGLProgram, vertex: WebGLShader, fragment: WebGLShader) {
  gl.detachShader(program, vertex);
  gl.detachShader(program, fragment);
  gl.deleteShader(vertex);
  gl.deleteShader(fragment);
}

/** Programa ainda compilando em paralelo (`KHR_parallel_shader_compile`): a página não trava esperando. */
export interface PendingProgram {
  program: WebGLProgram;
  vertex: WebGLShader;
  fragment: WebGLShader;
}

/** Começa a compilar e ligar um programa, sem perguntar o resultado (perguntar antes da hora trava a página). */
export function startProgram(gl: WebGL2RenderingContext, vertexSource: string, fragmentSource: string, attribute: string): PendingProgram {
  const compile = (type: number, source: string) => {
    const shader = gl.createShader(type);
    if (!shader) throw new Error("shader");
    gl.shaderSource(shader, source);
    gl.compileShader(shader);
    return shader;
  };
  const program = gl.createProgram();
  if (!program) throw new Error("programa");
  const vertex = compile(gl.VERTEX_SHADER, vertexSource);
  const fragment = compile(gl.FRAGMENT_SHADER, fragmentSource);
  gl.attachShader(program, vertex);
  gl.attachShader(program, fragment);
  gl.bindAttribLocation(program, VERTEX_ATTRIBUTE, attribute);
  gl.linkProgram(program);
  return { program, vertex, fragment };
}

/**
 * O programa pronto, ou `null` enquanto compila (com a extensão de compilação em paralelo; sem ela, espera aqui). Erro
 * de compilação vira exceção, como em `linkProgram`.
 */
export function finishProgram(gl: WebGL2RenderingContext, pending: PendingProgram, parallel: KHR_parallel_shader_compile | null): Program | null {
  if (parallel && !gl.getProgramParameter(pending.program, parallel.COMPLETION_STATUS_KHR)) return null;
  if (!gl.getProgramParameter(pending.program, gl.LINK_STATUS)) {
    const log = gl.getShaderInfoLog(pending.fragment) || gl.getShaderInfoLog(pending.vertex) || gl.getProgramInfoLog(pending.program);
    throw new Error(log ?? "programa");
  }
  releaseShaders(gl, pending.program, pending.vertex, pending.fragment);
  return { program: pending.program, uniforms: new Map() };
}

/**
 * Programas por chave, compilados em paralelo (docs/design/relevo.md): `get` devolve o pronto ou `null` enquanto
 * compila (começa na primeira vez). Sem a extensão, compila esperando, mas no máximo um programa por desenho
 * (`beginDraw` a cada desenho); `pending` diz que algum programa pedido ainda não ficou pronto (precisa de mais quadros).
 */
export class ProgramCache<Key> {
  private readonly entries = new Map<Key, { ready: Program } | { pending: PendingProgram }>();
  private readonly parallel: KHR_parallel_shader_compile | null;
  private compiledThisDraw = false;
  /** Algum programa pedido neste desenho ainda compilando. */
  pending = false;

  constructor(
    private readonly gl: WebGL2RenderingContext,
    private readonly vertexSource: string,
    /** Atributo dos vértices (o do triângulo da tela inteira, por padrão). */
    private readonly attribute = "aPos",
  ) {
    this.parallel = gl.getExtension("KHR_parallel_shader_compile");
  }

  beginDraw() {
    this.pending = false;
    this.compiledThisDraw = false;
  }

  get(key: Key, fragmentSource: () => string): Program | null {
    const known = this.entries.get(key);
    if (known && "ready" in known) return known.ready;
    if (!known && !this.parallel && this.compiledThisDraw) {
      this.pending = true;
      return null;
    }
    const pending = known?.pending ?? startProgram(this.gl, this.vertexSource, fragmentSource(), this.attribute);
    if (!this.parallel) this.compiledThisDraw = true;
    const ready = finishProgram(this.gl, pending, this.parallel);
    this.entries.set(key, ready ? { ready } : { pending });
    if (!ready) this.pending = true;
    return ready;
  }

  /**
   * Começa a compilar um programa que vai ser usado logo (escolheu um desenho na ferramenta): quando ele for
   * desenhado, já está pronto ou quase. Só com a compilação em paralelo; sem ela, compilar aqui travaria a página.
   */
  warm(key: Key, fragmentSource: () => string) {
    if (!this.parallel || this.entries.has(key)) return;
    this.entries.set(key, { pending: startProgram(this.gl, this.vertexSource, fragmentSource(), this.attribute) });
  }

  dispose() {
    for (const entry of this.entries.values()) this.gl.deleteProgram("ready" in entry ? entry.ready.program : entry.pending.program);
    this.entries.clear();
  }
}
