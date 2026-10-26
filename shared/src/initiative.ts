import type { Combatant } from "./types";

type Groupable = Pick<Combatant, "type" | "templateId" | "initiative" | "initRoll">;

/**
 * Mobs iguais que agem juntos: mesmo template, mesma iniciativa e mesmo d20 (a "rolagem por template"
 * dá isso a todos). Lado a lado na ordem, viram uma linha só e uma vez só ("Goblin 1–6").
 */
export function sameGroup(a: Groupable, b: Groupable): boolean {
  return (
    a.type === "mob" &&
    b.type === "mob" &&
    !!a.templateId &&
    a.templateId === b.templateId &&
    a.initiative !== null &&
    a.initiative === b.initiative &&
    a.initRoll === b.initRoll
  );
}

/** Faixa `[início, fim)` da ordem com o grupo de quem está em `index` (só ele, se não tiver grupo). */
export function groupRange<T extends Groupable>(order: string[], index: number, get: (id: string) => T | undefined): [number, number] {
  const at = get(order[index]);
  if (!at) return [index, index + 1];
  const same = (i: number) => {
    const o = get(order[i]);
    return !!o && sameGroup(at, o);
  };
  let start = index;
  let end = index + 1;
  while (start > 0 && same(start - 1)) start--;
  while (end < order.length && same(end)) end++;
  return [start, end];
}

/**
 * Nome curto do grupo: "Goblin 1–6" quando os nomes são "Goblin 1"…"Goblin 6" seguidos;
 * "Goblin ×3" quando os números pulam; senão o primeiro nome "+N".
 */
export function groupName(names: string[]): string {
  if (names.length < 2) return names[0] ?? "";
  const parts = names.map((n) => /^(.*\S)\s+(\d+)$/.exec(n));
  const prefix = parts[0]?.[1];
  if (prefix && parts.every((p) => p?.[1] === prefix)) {
    const nums = parts.map((p) => Number(p![2])).sort((a, b) => a - b);
    const contiguous = nums.every((n, i) => i === 0 || n === nums[i - 1] + 1);
    return contiguous ? `${prefix} ${nums[0]}–${nums[nums.length - 1]}` : `${prefix} ×${names.length}`;
  }
  return `${names[0]} +${names.length - 1}`;
}
