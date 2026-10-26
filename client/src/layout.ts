import { useEffect, useState } from "react";
import { create } from "zustand";

/**
 * Layout de celular e tablet (E23), só para jogadores. "auto" escolhe pelo tamanho da tela;
 * a pessoa pode forçar um dos dois (fica guardado neste navegador). O mestre usa sempre o do computador.
 */
export type LayoutChoice = "auto" | "mobile" | "desktop";

const KEY = "rpg.layout";
/** Abaixo disso não cabe a tela de computador (1024 × 640, LAYOUT em ColumnResizer.tsx). */
const QUERY = "(max-width: 1023px), (max-height: 559px)";

function readChoice(): LayoutChoice {
  try {
    const v = localStorage.getItem(KEY);
    return v === "mobile" || v === "desktop" ? v : "auto";
  } catch {
    return "auto";
  }
}

export const useLayoutChoice = create<{ choice: LayoutChoice }>(() => ({ choice: readChoice() }));

export function setLayoutChoice(choice: LayoutChoice) {
  useLayoutChoice.setState({ choice });
  try {
    localStorage.setItem(KEY, choice);
  } catch {
    // sem armazenamento: vale só nesta aba
  }
}

/** A tela é pequena demais para o layout de computador. */
export function useSmallScreen(): boolean {
  const [small, setSmall] = useState(() => window.matchMedia(QUERY).matches);
  useEffect(() => {
    const mq = window.matchMedia(QUERY);
    const on = () => setSmall(mq.matches);
    mq.addEventListener("change", on);
    return () => mq.removeEventListener("change", on);
  }, []);
  return small;
}

/** true = layout de celular (abas). */
export function useMobileLayout(gm: boolean): boolean {
  const choice = useLayoutChoice((s) => s.choice);
  const small = useSmallScreen();
  if (gm) return false;
  return choice === "mobile" || (choice === "auto" && small);
}
