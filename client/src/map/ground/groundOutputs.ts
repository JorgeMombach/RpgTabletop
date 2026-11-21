import type { PropKind } from "@rpg/shared";
import { create } from "zustand";

/**
 * Saídas do renderizador do chão que aparecem em outras camadas do mapa (docs/design/luz.md): o mapa de luz (a camada
 * que multiplica, entre as copas e a interface) e as chamas com o brilho (no lugar do brilho das tochas, abaixo da
 * névoa). O chão publica as imagens aqui e avisa a cada desenho; as camadas só redesenham quando avisadas. As paredes
 * (docs/design/relevo.md, etapa 2) têm aviso próprio: só quando a imagem delas muda.
 */
export const useGroundOutputs = create<{
  light: HTMLCanvasElement | null;
  flame: HTMLCanvasElement | null;
  walls: HTMLCanvasElement | null;
  /** Objetos da placa de vídeo (docs/design/objetos.md): os de baixo e os de cima dos tokens. */
  propsBelow: HTMLCanvasElement | null;
  propsAbove: HTMLCanvasElement | null;
  /** Ícone de um tipo de objeto feito pela placa de vídeo (`null` = ainda não dá; sem motor, a função é `null`). */
  propIcon: ((kind: PropKind, side: number) => HTMLCanvasElement | null) | null;
}>(() => ({ light: null, flame: null, walls: null, propsBelow: null, propsAbove: null, propIcon: null }));

const drawnListeners = new Set<() => void>();

/** Chamado a cada desenho do chão (as imagens de luz e chamas mudaram). Devolve como parar de ouvir. */
export function onGroundDrawn(listener: () => void): () => void {
  drawnListeners.add(listener);
  return () => {
    drawnListeners.delete(listener);
  };
}

export function notifyGroundDrawn() {
  for (const listener of drawnListeners) listener();
}

const wallListeners = new Set<() => void>();

/** Chamado quando a imagem das paredes muda (não a cada quadro da água). Devolve como parar de ouvir. */
export function onWallsDrawn(listener: () => void): () => void {
  wallListeners.add(listener);
  return () => {
    wallListeners.delete(listener);
  };
}

export function notifyWallsDrawn() {
  for (const listener of wallListeners) listener();
}

const propListeners = new Set<() => void>();

/** Chamado quando as imagens dos objetos mudam. Devolve como parar de ouvir. */
export function onPropsDrawn(listener: () => void): () => void {
  propListeners.add(listener);
  return () => {
    propListeners.delete(listener);
  };
}

export function notifyPropsDrawn() {
  for (const listener of propListeners) listener();
}
