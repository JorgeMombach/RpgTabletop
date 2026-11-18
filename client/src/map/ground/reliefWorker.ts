import { reliefFields } from "@rpg/shared";
import type { ReliefJob, ReliefResult, ReliefWindow } from "./reliefTypes";

/**
 * Worker do relevo (docs/design/relevo.md): a altura de cada pedaço (distâncias exatas, rampas, suavização) leva de
 * 7 a ~35 ms; aqui ela não segura a tela enquanto o mestre pinta.
 */
self.onmessage = (event: MessageEvent<ReliefJob>) => {
  const { id, chunks, keys } = event.data;
  const windows: ReliefWindow[] = [];
  const buffers: ArrayBuffer[] = [];
  for (const key of keys) {
    const { heights, soft } = reliefFields(chunks, key);
    windows.push({ key, side: Math.round(Math.sqrt(heights.length)), heights, soft });
    // Passa a memória ao invés de copiar (só buffers comuns podem ir assim).
    for (const buffer of [heights.buffer, soft.buffer]) if (buffer instanceof ArrayBuffer) buffers.push(buffer);
  }
  const result: ReliefResult = { id, windows };
  self.postMessage(result, { transfer: buffers });
};
