import { useEffect, useState } from "react";
import { loadImage } from "../images";

/** Tentativas de abrir a imagem: o tablet às vezes recusa uma imagem grande logo depois de trocar de cena. */
const TRIES = 3;

/** Carrega um dataURL num HTMLImageElement para o Konva desenhar. */
export function useImage(src: string | null | undefined): HTMLImageElement | null {
  const [img, setImg] = useState<HTMLImageElement | null>(null);

  useEffect(() => {
    if (!src) {
      setImg(null);
      return;
    }
    let alive = true;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const attempt = (n: number) => {
      loadImage(src)
        .then((el) => alive && setImg(el))
        .catch(() => {
          if (!alive) return;
          // Falhou: tenta de novo com folga (memória liberada); na última, fica sem imagem.
          if (n + 1 < TRIES) timer = setTimeout(() => attempt(n + 1), 800 * (n + 1));
          else setImg(null);
        });
    };
    attempt(0);
    return () => {
      alive = false;
      clearTimeout(timer);
    };
  }, [src]);

  return img;
}
