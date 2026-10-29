import type { HpHit } from "@rpg/shared";
import { allCombatants } from "./combat";
import type { Store } from "./store";

/** Vida (com a temporária) e fase de cada combatente no último envio. */
export type HpMemory = Map<string, { value: number; phase: number }>;

/** Muitos de uma vez é carga de arquivo, troca de cena ou descanso geral: sem números voando. */
const MAX_HITS = 20;

/**
 * Golpes e curas desde o último envio (L6), para o número que sobe do token: compara a vida de cada
 * combatente com a do envio anterior, venha de onde vier (dano, cura, temporária, descanso). Troca de fase
 * de chefe não conta (a vida enche de novo, não é cura). Quem não estava no envio anterior também não.
 */
export function collectHits(store: Store, memory: HpMemory): HpHit[] {
  const hits: HpHit[] = [];
  const next: HpMemory = new Map();
  for (const c of allCombatants(store)) {
    const value = c.hp + (c.tempHp ?? 0);
    const phase = c.phase ?? 1;
    next.set(c.id, { value, phase });
    const before = memory.get(c.id);
    if (before && before.phase === phase && before.value !== value) hits.push({ id: c.id, delta: value - before.value });
  }
  memory.clear();
  for (const [id, v] of next) memory.set(id, v);
  return hits.length > MAX_HITS ? [] : hits;
}
