import { useEffect, useState } from "react";
import { loadImage } from "../images";

/** Carrega um dataURL num HTMLImageElement para o Konva desenhar. */
export function useImage(src: string | null | undefined): HTMLImageElement | null {
  const [img, setImg] = useState<HTMLImageElement | null>(null);

  useEffect(() => {
    if (!src) {
      setImg(null);
      return;
    }
    let alive = true;
    loadImage(src)
      .then((el) => alive && setImg(el))
      .catch(() => alive && setImg(null));
    return () => {
      alive = false;
    };
  }, [src]);

  return img;
}
