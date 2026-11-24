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
  /** Névoa de guerra (docs/design/nevoa.md): a fumaça e o véu cinza que tira a cor do explorado. */
  fog: HTMLCanvasElement | null;
  fogTint: HTMLCanvasElement | null;
  /** Efeitos de área (docs/design/efeitos.md), cor pré-multiplicada. */
  effects: HTMLCanvasElement | null;
  /** Clima vivendo no mapa (docs/design/clima.md): a cobertura do chão, o que anda no ar e o que brilha sozinho. */
  weatherGround: HTMLCanvasElement | null;
  weatherAir: HTMLCanvasElement | null;
  weatherGlow: HTMLCanvasElement | null;
  /** Ícone de um tipo de objeto feito pela placa de vídeo (`null` = ainda não dá; sem motor, a função é `null`). */
  propIcon: ((kind: PropKind, side: number) => HTMLCanvasElement | null) | null;
}>(() => ({ light: null, flame: null, walls: null, propsBelow: null, propsAbove: null, fog: null, fogTint: null, effects: null, weatherGround: null, weatherAir: null, weatherGlow: null, propIcon: null }));

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

const fogListeners = new Set<() => void>();

/** Chamado a cada desenho da névoa (a fumaça anda até sem o chão redesenhar). Devolve como parar de ouvir. */
export function onFogDrawn(listener: () => void): () => void {
  fogListeners.add(listener);
  return () => {
    fogListeners.delete(listener);
  };
}

export function notifyFogDrawn() {
  for (const listener of fogListeners) listener();
}

const effectListeners = new Set<() => void>();

/** Chamado a cada desenho dos efeitos (eles animam até sem o chão redesenhar). Devolve como parar de ouvir. */
export function onEffectsDrawn(listener: () => void): () => void {
  effectListeners.add(listener);
  return () => {
    effectListeners.delete(listener);
  };
}

export function notifyEffectsDrawn() {
  for (const listener of effectListeners) listener();
}

const weatherListeners = new Set<() => void>();

/** Chamado a cada desenho do clima. Devolve como parar de ouvir. */
export function onWeatherDrawn(listener: () => void): () => void {
  weatherListeners.add(listener);
  return () => {
    weatherListeners.delete(listener);
  };
}

export function notifyWeatherDrawn() {
  for (const listener of weatherListeners) listener();
}
