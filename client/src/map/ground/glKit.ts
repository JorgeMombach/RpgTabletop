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

export interface Program {
  program: WebGLProgram;
  uniforms: Map<string, WebGLUniformLocation | null>;
}

/** Atributo de vértice de todos os programas do chão (fica sempre no lugar 0). */
export const VERTEX_ATTRIBUTE = 0;

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
  gl.attachShader(program, compile(gl.VERTEX_SHADER, vertexSource));
  gl.attachShader(program, compile(gl.FRAGMENT_SHADER, fragmentSource));
  gl.bindAttribLocation(program, VERTEX_ATTRIBUTE, attribute);
  gl.linkProgram(program);
  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(program) ?? "programa");
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
