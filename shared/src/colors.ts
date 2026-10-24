/** Cores sugeridas para tokens. Aliados em tons frios, mobs em tons quentes, NPCs neutros. */
export const ALLY_COLORS = ["#5ba3e6", "#4cc38a", "#a78bfa", "#2dd4bf", "#60a5fa", "#f472b6"];
export const MOB_COLORS = ["#e5534b", "#e0823d", "#d4a24c", "#b45309", "#be123c", "#9f1239"];
export const NPC_COLORS = ["#94a3b8", "#a3a380", "#8b9a6b", "#b08968", "#7d8597", "#c2b280"];

const HEX = /^#[0-9a-f]{6}$/i;

export function isColor(value: unknown): value is string {
  return typeof value === "string" && HEX.test(value);
}
