import { LIMITS, NAME_MAX_LENGTH, type Area, type AreaKind } from "@rpg/shared";

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

const AREA_KINDS: AreaKind[] = ["cone", "sphere", "cylinder", "line", "cube"];

/** Área de magia vinda do cliente: só repassa se cada campo for válido (E17). */
export function validArea(raw: unknown): Area | null {
  const a = raw as Area | null;
  if (!a || typeof a !== "object" || !AREA_KINDS.includes(a.kind)) return null;
  const half = (n: unknown) => typeof n === "number" && Number.isInteger(n * 2) && Math.abs(n) <= LIMITS.gridCoord;
  if (!a.origin || !half(a.origin.col) || !half(a.origin.row)) return null;
  if (typeof a.angle !== "number" || !Number.isFinite(a.angle)) return null;
  const { min, max } = LIMITS.areaFeet;
  if (!Number.isInteger(a.feet) || a.feet < min || a.feet > max) return null;
  return { kind: a.kind, origin: { col: a.origin.col, row: a.origin.row }, angle: a.angle % (Math.PI * 2), feet: a.feet };
}
