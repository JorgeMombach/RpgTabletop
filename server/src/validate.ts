import { NAME_MAX_LENGTH } from "@rpg/shared";

/** Erro de ação: a mensagem vai direto para o usuário. */
export class ActionError extends Error {}

export function fail(message: string): never {
  throw new ActionError(message);
}

export function cleanName(raw: unknown): string | null {
  if (typeof raw !== "string") return null;
  const name = raw.replace(/\s+/g, " ").trim().slice(0, NAME_MAX_LENGTH);
  return name || null;
}

export function requireName(raw: unknown): string {
  return cleanName(raw) ?? fail("Informe um nome.");
}

export function requireInt(raw: unknown, label: string, min: number, max: number): number {
  const n = typeof raw === "string" && raw.trim() !== "" ? Number(raw) : raw;
  if (typeof n !== "number" || !Number.isFinite(n)) fail(`${label}: informe um número.`);
  const int = Math.trunc(n);
  if (int < min || int > max) fail(`${label}: use um valor entre ${min} e ${max}.`);
  return int;
}

const IMAGE_DATA_URL = /^data:image\/(png|jpeg|webp|gif);base64,[A-Za-z0-9+/]+=*$/;

/** Aceita só imagens embutidas (dataURL base64) até `maxChars` caracteres. */
export function requireImage(raw: unknown, label: string, maxChars: number): string {
  if (typeof raw !== "string" || !IMAGE_DATA_URL.test(raw.slice(0, 64) + raw.slice(-8))) {
    fail(`${label}: use uma imagem PNG, JPG ou WebP.`);
  }
  if (raw.length > maxChars) fail(`${label}: imagem grande demais.`);
  return raw;
}

export function requireNumber(raw: unknown, label: string, min: number, max: number): number {
  if (typeof raw !== "number" || !Number.isFinite(raw)) fail(`${label}: informe um número.`);
  if (raw < min || raw > max) fail(`${label}: use um valor entre ${min} e ${max}.`);
  return raw;
}

export function requireString(raw: unknown, label: string): string {
  if (typeof raw !== "string" || !raw) fail(`${label} inválido.`);
  return raw;
}
