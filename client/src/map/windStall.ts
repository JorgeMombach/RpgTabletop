import { FrameWatch } from "@rpg/shared";
import { useEffect, useState } from "react";
import { useApp } from "../store";

/**
 * Vigia de aparelho lento (docs/design/desempenho.md), um só para os laços de animação (água e vento): quadros lentos
 * demais param a animação por um tempo e ela tenta de novo sozinha. O zoom e o arrasto marcam o mapa como ocupado
 * (`markMapBusy`): o engasgo de trabalho pontual não conta como aparelho lento.
 */

/** Depois de um passo de zoom ou de arrasto, por quanto tempo os quadros não contam. */
const MAP_BUSY_MS = 300;
/** Dois laços no mesmo quadro: só o primeiro conta (os relógios deles diferem por poucos ms). */
const SAME_FRAME_MS = 4;

const watch = new FrameWatch();
let busyUntil = 0;
let lastFrame = 0;

/** Zoom ou arrasto agora: os próximos quadros lentos não contam. */
export function markMapBusy() {
  busyUntil = performance.now() + MAP_BUSY_MS;
}

/**
 * Chamado a cada quadro pelos laços de animação; `false` = parar por enquanto (o estado guarda até quando, e a
 * animação volta sozinha). `busy`: o laço sabe de trabalho dele (relevo calculando, água chegando).
 */
export function watchFrame(busy: boolean): boolean {
  const now = performance.now();
  if (now < watch.resumeAt) return false;
  if (now - lastFrame < SAME_FRAME_MS) return true;
  const frameMs = lastFrame > 0 ? now - lastFrame : 0;
  lastFrame = now;
  // Só conta quadros com a página à vista e em foco: janela de trás ou minimizada fica lenta sem o aparelho estar.
  if (document.visibilityState !== "visible" || !document.hasFocus()) return true;
  if (watch.tick(frameMs, now, busy || now < busyUntil)) return true;
  useApp.setState({ windStalledUntil: watch.resumeAt });
  return false;
}

/** A animação está parada pelo vigia agora; volta sozinha na hora de tentar de novo. */
export function useWindStalled(): boolean {
  const until = useApp((state) => state.windStalledUntil);
  const [, wake] = useState(0);
  const stalled = until > performance.now();
  useEffect(() => {
    if (!stalled) return;
    const timer = window.setTimeout(() => wake((value) => value + 1), until - performance.now() + 10);
    return () => window.clearTimeout(timer);
  }, [stalled, until]);
  return stalled;
}
