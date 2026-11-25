/**
 * Contadores do modo de teste de desempenho (docs/design/desempenho.md): quantas texturas, buffers, programas e
 * framebuffers estão vivos na placa de vídeo. Envolve `create*`/`delete*` do WebGL2 uma vez, antes de o app criar o
 * primeiro contexto. Só com `?bench`, em desenvolvimento.
 */

export interface GlCounts {
  textures: number;
  buffers: number;
  programs: number;
  framebuffers: number;
}

const counts: GlCounts = { textures: 0, buffers: 0, programs: 0, framebuffers: 0 };
let installed = false;

/** Conta um tipo: cada objeto criado soma uma vez, cada apagado desconta uma vez (apagar de novo ou `null` não). */
function tracker(kind: keyof GlCounts) {
  const alive = new WeakSet<object>();
  return {
    created<T extends object | null>(target: T): T {
      if (target) {
        alive.add(target);
        counts[kind]++;
      }
      return target;
    },
    deleted(target: object | null) {
      if (target && alive.has(target)) {
        alive.delete(target);
        counts[kind]--;
      }
    },
  };
}

export function installGlCounters() {
  if (installed) return;
  installed = true;
  const prototype = WebGL2RenderingContext.prototype;

  const textures = tracker("textures");
  const createTexture = prototype.createTexture;
  const deleteTexture = prototype.deleteTexture;
  prototype.createTexture = function (this: WebGL2RenderingContext) {
    return textures.created(createTexture.call(this));
  };
  prototype.deleteTexture = function (this: WebGL2RenderingContext, texture: WebGLTexture | null) {
    textures.deleted(texture);
    deleteTexture.call(this, texture);
  };

  const buffers = tracker("buffers");
  const createBuffer = prototype.createBuffer;
  const deleteBuffer = prototype.deleteBuffer;
  prototype.createBuffer = function (this: WebGL2RenderingContext) {
    return buffers.created(createBuffer.call(this));
  };
  prototype.deleteBuffer = function (this: WebGL2RenderingContext, buffer: WebGLBuffer | null) {
    buffers.deleted(buffer);
    deleteBuffer.call(this, buffer);
  };

  const programs = tracker("programs");
  const createProgram = prototype.createProgram;
  const deleteProgram = prototype.deleteProgram;
  prototype.createProgram = function (this: WebGL2RenderingContext) {
    return programs.created(createProgram.call(this));
  };
  prototype.deleteProgram = function (this: WebGL2RenderingContext, program: WebGLProgram | null) {
    programs.deleted(program);
    deleteProgram.call(this, program);
  };

  const framebuffers = tracker("framebuffers");
  const createFramebuffer = prototype.createFramebuffer;
  const deleteFramebuffer = prototype.deleteFramebuffer;
  prototype.createFramebuffer = function (this: WebGL2RenderingContext) {
    return framebuffers.created(createFramebuffer.call(this));
  };
  prototype.deleteFramebuffer = function (this: WebGL2RenderingContext, framebuffer: WebGLFramebuffer | null) {
    framebuffers.deleted(framebuffer);
    deleteFramebuffer.call(this, framebuffer);
  };
}

export function glCounts(): GlCounts {
  return { ...counts };
}
