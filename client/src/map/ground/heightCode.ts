/**
 * Formato do mapa de alturas (docs/design/sombras.md): alturas absolutas em casas, já com o chão do relevo, de -3 a 9
 * (o fundo de um vale de nível -2 é -2,8; o topo de uma árvore grande num patamar de nível 3 passa de 6). Guardadas de 0 a
 * 1 em cada canal: R = topo (pela maior), G = onde começa a copa (pela maior; sem copa, o fundo), B = o chão do relevo,
 * A = onde começa o que bloqueia (pela menor; sem nada, o teto).
 */
export const HEIGHT_FLOOR = -3;
export const HEIGHT_SPAN = 12;

/** Codifica e decodifica uma altura (GLSL). */
export const HEIGHT_CODE = `
const float HEIGHT_FLOOR = ${HEIGHT_FLOOR}.0;
const float HEIGHT_SPAN = ${HEIGHT_SPAN}.0;
float encodeHeight(float h) { return clamp((h - HEIGHT_FLOOR) / HEIGHT_SPAN, 0.0, 1.0); }
float decodeHeight(float v) { return v * HEIGHT_SPAN + HEIGHT_FLOOR; }
`;

/** Uma altura codificada (o fundo de limpar o mapa: chão na altura 0, sem nada bloqueando). */
export function encodeHeight(height: number): number {
  return Math.min(1, Math.max(0, (height - HEIGHT_FLOOR) / HEIGHT_SPAN));
}
