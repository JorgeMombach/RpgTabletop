import type { MapTorchStyle, Size } from "@rpg/shared";

/**
 * Sombra por objeto (docs/design/sombras.md): a altura do que entra no mapa de alturas, em casas. Sem DOM (testado no
 * servidor). Os objetos têm a altura da forma guardada no atlas; aqui ficam os tokens e as tochas.
 */

/** Altura do token pelo tamanho (o topo da cabeça, para a sombra). */
export const TOKEN_HEIGHT: Record<Size, number> = { tiny: 0.5, small: 0.9, medium: 1.2, large: 2, huge: 3, gargantuan: 4 };

/** Altura da chama de cada desenho de tocha fixa: fincada, de ferro (na parede) e braseiro (baixo). */
export const TORCH_HEIGHT: Record<MapTorchStyle, number> = { stick: 1.2, iron: 1.6, brazier: 0.6 };

/** A tocha do token fica acima da cabeça dele (no centro). */
export const HELD_TORCH_ABOVE = 0.3;

/**
 * Onde a copa começa (casas, no tamanho 1; maior junto com a árvore, nunca menor): as copas (`above`) ficam acima da
 * tocha de um token médio e das fixas, e a luz passa por baixo delas. Só o tronco vai até o chão. A sombra do sol e da
 * lua continua pelo topo.
 */
export const CANOPY_BOTTOM = 1.7;

/** Um token no mapa de alturas: um disco no centro dele, em casas. */
export interface TokenCaster {
  id: string;
  x: number;
  y: number;
  radius: number;
  height: number;
}

/** Disco do token em casas (o centro e o `span` vêm de `tokenCenter`, já em casas). */
export function tokenCaster(id: string, center: { x: number; y: number }, span: number, size: Size): TokenCaster {
  return { id, x: center.x, y: center.y, radius: span / 2, height: TOKEN_HEIGHT[size] };
}

/** O token mostra a sombrinha fixa da arte enquanto a sombra nova não vale (sem o chão na placa ou sem luz de cena). */
export function tokenGroundShadow(groundLit: boolean, lighting: boolean): boolean {
  return !(groundLit && lighting);
}
