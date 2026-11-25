import { create } from "zustand";
import type { PropDrag } from "./propLayout";

/**
 * Objeto sendo arrastado ou mexido pelas alças (docs/design/objetos.md): o nó invisível do Konva conta a posição, o
 * tamanho e o giro a cada movimento, e o chão da placa de vídeo desenha o objeto ali, antes de ir ao servidor.
 */
export const usePropDrag = create<{ id: string | null; drag: PropDrag | null }>(() => ({ id: null, drag: null }));

/** Posição provisória de um objeto (`null` = acabou: vale a do servidor). */
export function movePropDraft(id: string | null, drag: PropDrag | null) {
  usePropDrag.setState({ id, drag });
}
