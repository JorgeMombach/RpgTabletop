import { create } from "zustand";

/**
 * Saídas do renderizador do chão que aparecem em outras camadas do mapa (docs/design/luz.md): o mapa de luz (a camada
 * que multiplica, entre as copas e a interface) e as chamas com o brilho (no lugar do brilho das tochas, abaixo da
 * névoa). O chão publica as imagens aqui e avisa a cada desenho; as camadas só redesenham quando avisadas.
 */
export const useGroundOutputs = create<{ light: HTMLCanvasElement | null; flame: HTMLCanvasElement | null }>(() => ({ light: null, flame: null }));

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
