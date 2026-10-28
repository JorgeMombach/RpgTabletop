import { t } from "./i18n";
import { LIMITS } from "@rpg/shared";

const ACCEPTED = ["image/png", "image/jpeg", "image/webp"];

function readAsDataUrl(file: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(r.result as string);
    r.onerror = () => reject(r.error);
    r.readAsDataURL(file);
  });
}

export function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error(t("image.openFailed")));
    img.src = src;
  });
}

function canvasToDataUrl(canvas: HTMLCanvasElement, quality: number) {
  // WebP é bem menor; navegadores sem suporte caem para PNG, então usamos JPEG como reserva.
  const webp = canvas.toDataURL("image/webp", quality);
  return webp.startsWith("data:image/webp") ? webp : canvas.toDataURL("image/jpeg", quality);
}

function assertImage(file: File) {
  if (!ACCEPTED.includes(file.type)) throw new Error(t("image.badType"));
}

/**
 * Prepara a imagem do mapa: mantém o arquivo original se já for leve;
 * senão reduz para no máximo 4096 px e recomprime.
 */
export async function mapImageFromFile(file: File): Promise<string> {
  assertImage(file);
  const original = await readAsDataUrl(file);
  const img = await loadImage(original);
  const side = LIMITS.mapImageSide;
  const fits = img.width <= side && img.height <= side;
  if (fits && original.length <= LIMITS.mapImageChars * 0.6) return original;

  const scale = Math.min(1, side / Math.max(img.width, img.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(img.width * scale);
  canvas.height = Math.round(img.height * scale);
  canvas.getContext("2d")!.drawImage(img, 0, 0, canvas.width, canvas.height);

  for (const quality of [0.85, 0.7, 0.55]) {
    const out = canvasToDataUrl(canvas, quality);
    if (out.length <= LIMITS.mapImageChars) return out;
  }
  throw new Error(t("image.tooBig"));
}

/** Avatar: recorte quadrado central, reduzido para 128 px. */
export async function avatarFromFile(file: File): Promise<string> {
  assertImage(file);
  const img = await loadImage(await readAsDataUrl(file));
  const size = LIMITS.avatarSide;
  const crop = Math.min(img.width, img.height);
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = size;
  canvas
    .getContext("2d")!
    .drawImage(img, (img.width - crop) / 2, (img.height - crop) / 2, crop, crop, 0, 0, size, size);
  return canvasToDataUrl(canvas, 0.85);
}
