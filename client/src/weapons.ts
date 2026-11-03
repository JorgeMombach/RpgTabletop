import type { Combatant, SavedAttack } from "@rpg/shared";

/** Ataque na ficha: os salvos e as armas empunhadas do inventário (estas se tiram pelo item, não pelos ataques). */
export type SheetAttack = SavedAttack & { fromItem?: true };

/** Ataques de um combatente: os salvos à mão (e os do template) e, depois, as armas empunhadas. */
export function attacksOf(c: Pick<Combatant, "attacks" | "inventory">): SheetAttack[] {
  const wielded = (c.inventory ?? [])
    .filter((i) => i.wielded && (i.bonus !== undefined || i.damage))
    .map((i): SheetAttack => ({ id: i.id, name: i.name, bonus: i.bonus, damage: i.damage, fromItem: true }));
  return [...(c.attacks ?? []), ...wielded];
}
