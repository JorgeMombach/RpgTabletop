import { useViewportSize } from "@mantine/hooks";
import { useCallback, useRef, useState, type KeyboardEvent, type PointerEvent } from "react";

export const COLUMN_LIMITS = { min: 220, max: 520 } as const;

/**
 * Tamanho mínimo da tela do app. O navegador não deixa travar o tamanho da janela, então abaixo
 * disto a tela para de encolher e aparece rolagem, em vez de o layout quebrar.
 */
export const LAYOUT = {
  appMinWidth: 1024,
  appMinHeight: 640,
  /** O mapa nunca fica mais estreito que isto: as colunas é que cedem. */
  mapMinWidth: 480,
  /** Duas alças de 6 px. */
  resizers: 12,
} as const;
const DEFAULTS = { left: 280, right: 300 } as const;
const STORAGE_KEY = "rpg.columnWidths";

type Side = keyof typeof DEFAULTS;

function clamp(n: number) {
  return Math.round(Math.max(COLUMN_LIMITS.min, Math.min(COLUMN_LIMITS.max, n)));
}

function read(): Record<Side, number> {
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "{}");
    return { left: clamp(saved.left ?? DEFAULTS.left), right: clamp(saved.right ?? DEFAULTS.right) };
  } catch {
    return { ...DEFAULTS };
  }
}

/**
 * Espaço que sobra para as duas colunas sem apertar o mapa abaixo do mínimo.
 * Se as larguras salvas não cabem (janela menor que da última vez), encolhe as duas na proporção.
 */
function fit(saved: Record<Side, number>, viewportWidth: number) {
  const appWidth = Math.max(viewportWidth, LAYOUT.appMinWidth);
  const room = appWidth - LAYOUT.mapMinWidth - LAYOUT.resizers;
  const total = saved.left + saved.right;
  let { left, right } = saved;
  if (total > room) {
    const excess = total - room;
    left = Math.max(COLUMN_LIMITS.min, Math.round(left - (excess * left) / total));
    right = Math.max(COLUMN_LIMITS.min, Math.round(right - (excess * right) / total));
  }
  const max = {
    left: Math.max(COLUMN_LIMITS.min, Math.min(COLUMN_LIMITS.max, room - right)),
    right: Math.max(COLUMN_LIMITS.min, Math.min(COLUMN_LIMITS.max, room - left)),
  };
  return { widths: { left, right }, max };
}

/** Larguras das colunas laterais, lembradas por navegador e ajustadas ao tamanho da janela. */
export function useColumnWidths() {
  const { width: viewport } = useViewportSize();
  const [saved, setSaved] = useState(read);
  // No primeiro render o hook ainda não mediu a janela.
  const { widths, max } = fit(saved, viewport || window.innerWidth);

  const set = useCallback((side: Side, value: number) => {
    setSaved((w) => {
      // Parte das larguras que estão na tela (não das salvas, que podem não caber nesta janela).
      const { widths: current, max } = fit(w, window.innerWidth);
      const next = { ...current, [side]: clamp(Math.min(value, max[side])) };
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
      } catch {
        // ignora
      }
      return next;
    });
  }, []);
  const reset = useCallback((side: Side) => set(side, DEFAULTS[side]), [set]);
  return { widths, max, set, reset };
}

interface Props {
  side: Side;
  width: number;
  /** Máximo agora (depende da janela e da outra coluna). */
  max: number;
  onResize: (width: number) => void;
  onReset: () => void;
}

/** Alça vertical entre uma coluna lateral e o mapa: arrastar, setas do teclado ou duplo clique (padrão). */
export function ColumnResizer({ side, width, max, onResize, onReset }: Props) {
  const start = useRef<{ x: number; width: number } | null>(null);

  function onPointerDown(e: PointerEvent<HTMLDivElement>) {
    e.currentTarget.setPointerCapture(e.pointerId);
    start.current = { x: e.clientX, width };
  }

  function onPointerMove(e: PointerEvent<HTMLDivElement>) {
    if (!start.current) return;
    const dx = e.clientX - start.current.x;
    // Coluna da esquerda cresce arrastando para a direita; a da direita, para a esquerda.
    onResize(start.current.width + (side === "left" ? dx : -dx));
  }

  function onKeyDown(e: KeyboardEvent<HTMLDivElement>) {
    const step = e.shiftKey ? 48 : 16;
    const grow = side === "left" ? "ArrowRight" : "ArrowLeft";
    const shrink = side === "left" ? "ArrowLeft" : "ArrowRight";
    if (e.key === grow) onResize(width + step);
    else if (e.key === shrink) onResize(width - step);
    else return;
    e.preventDefault();
  }

  return (
    <div
      className={`col-resizer ${side}`}
      role="separator"
      aria-orientation="vertical"
      aria-label={side === "left" ? "Largura da coluna esquerda" : "Largura da coluna direita"}
      aria-valuemin={COLUMN_LIMITS.min}
      aria-valuemax={max}
      aria-valuenow={width}
      tabIndex={0}
      title="Arraste para ajustar a largura (duplo clique: padrão)"
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={() => (start.current = null)}
      onPointerCancel={() => (start.current = null)}
      onDoubleClick={onReset}
      onKeyDown={onKeyDown}
    />
  );
}
