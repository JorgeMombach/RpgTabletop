import { create } from "zustand";

/**
 * Token sendo arrastado e quanto já andou (pixels do mapa): o que segue o token (efeito fixo, aura) anda
 * junto durante o arraste, não só quando ele é solto. Store à parte para só quem segue redesenhar.
 */
export const useTokenDrag = create<{ id: string | null; dx: number; dy: number }>(() => ({ id: null, dx: 0, dy: 0 }));

/** Deslocamento do arraste para quem segue `id` (zero se não for ele). */
export function useDragOffset(id: string | undefined): { dx: number; dy: number } {
  const dx = useTokenDrag((s) => (id && s.id === id ? s.dx : 0));
  const dy = useTokenDrag((s) => (id && s.id === id ? s.dy : 0));
  return { dx, dy };
}

export function endTokenDrag(id: string) {
  if (useTokenDrag.getState().id === id) useTokenDrag.setState({ id: null, dx: 0, dy: 0 });
}
