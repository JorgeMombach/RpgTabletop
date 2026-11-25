import type { MapTorchColor, MapTorchStyle } from "@rpg/shared";
import { linkProgram, uniformOf } from "./ground/glKit";
import { GEOMETRY_VERTEX } from "./ground/lightShader";
import { torchFragment } from "./ground/torchShader";
import { TORCH_CELLS } from "./MapTorches";
import { torchColorIndex } from "./torchModels";

/** Lado do ícone, em pixels (mostrado com metade, nítido em tela de densidade 2). */
const ICON = 72;
/** Ícones já feitos (modelo|cor); `null` = sem WebGL 2 (o painel usa o desenho de antes). */
const icons = new Map<string, string | null>();

/**
 * Ícone do painel de uma fonte de luz (docs/design/luzes.md), desenhado uma vez pelo mesmo shader do mapa, de dia,
 * parado, e guardado como imagem. Sem WebGL 2, `null`.
 */
export function torchIconUrl(style: MapTorchStyle, color: MapTorchColor): string | null {
  const key = `${style}|${color}`;
  const known = icons.get(key);
  if (known !== undefined) return known;
  const canvas = document.createElement("canvas");
  canvas.width = ICON;
  canvas.height = ICON;
  const gl = canvas.getContext("webgl2", { premultipliedAlpha: true, preserveDrawingBuffer: true });
  if (!gl) {
    icons.set(key, null);
    return null;
  }
  let url: string | null = null;
  try {
    const program = linkProgram(gl, GEOMETRY_VERTEX, torchFragment(style), "aCell");
    const cells = TORCH_CELLS[style];
    // o desenho ocupa uns 80% do ícone, com a base um pouco abaixo do meio (as chamas sobem)
    const cellPx = (ICON * 0.8) / cells;
    const reach = cells * 1.4;
    const buffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-reach, -reach, reach, -reach, -reach, reach, -reach, reach, reach, -reach, reach, reach]), gl.STATIC_DRAW);
    gl.enableVertexAttribArray(0);
    gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);
    gl.viewport(0, 0, ICON, ICON);
    gl.clearColor(0, 0, 0, 0);
    gl.clear(gl.COLOR_BUFFER_BIT);
    gl.useProgram(program.program);
    gl.uniform4f(uniformOf(gl, program, "uMapGrid"), 0, 0, cellPx, 0);
    gl.uniform3f(uniformOf(gl, program, "uStage"), ICON / 2, ICON * 0.56, 1);
    gl.uniform2f(uniformOf(gl, program, "uScreen"), ICON, ICON);
    gl.uniform4f(uniformOf(gl, program, "uTorch"), 0, 0, cells, style === "sconce" ? Math.PI / 2 : 0);
    gl.uniform1i(uniformOf(gl, program, "uColor"), torchColorIndex(color));
    gl.uniform1f(uniformOf(gl, program, "uSeed"), 2.2);
    gl.uniform1f(uniformOf(gl, program, "uTime"), 0.42);
    gl.uniform1f(uniformOf(gl, program, "uDevicePerCell"), cellPx);
    gl.uniform1f(uniformOf(gl, program, "uDpr"), 1.4);
    gl.uniform1f(uniformOf(gl, program, "uNight"), 0.5);
    gl.uniform2f(uniformOf(gl, program, "uLightFrom"), -0.55, -0.83);
    gl.enable(gl.BLEND);
    // corpo por cima do vazio; brilho somado ("tela")
    gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
    gl.uniform1f(uniformOf(gl, program, "uGlow"), 0);
    gl.drawArrays(gl.TRIANGLES, 0, 6);
    gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_COLOR);
    gl.uniform1f(uniformOf(gl, program, "uGlow"), 1);
    gl.drawArrays(gl.TRIANGLES, 0, 6);
    url = canvas.toDataURL();
    gl.deleteBuffer(buffer);
    gl.deleteProgram(program.program);
  } catch {
    url = null;
  }
  gl.getExtension("WEBGL_lose_context")?.loseContext();
  icons.set(key, url);
  return url;
}
