export function fmtMod(n: number): string {
  return n >= 0 ? `+${n}` : `${n}`;
}

export function hpRatio(hp: number, hpMax: number): number {
  return hpMax > 0 ? Math.max(0, Math.min(1, hp / hpMax)) : 0;
}

/** Faixa de cor da barra de vida. */
export function hpLevel(hp: number, hpMax: number): "full" | "mid" | "low" | "zero" {
  if (hp <= 0) return "zero";
  const r = hpRatio(hp, hpMax);
  return r > 0.5 ? "full" : r > 0.25 ? "mid" : "low";
}
