import { COINS, type Coins, type LootEntry } from "@rpg/shared";

export interface LootShare {
  id: string;
  /** Unidades do item ou arma (0 nas moedas). */
  qty: number;
  coins?: Coins;
}

export interface LootResolution {
  /** O d20 que decidiu a posição de cada um, do maior para o menor (vazio sem disputa). */
  rolls: { id: string; d20: number }[];
  /** Quem leva o quê, na ordem do d20 (só quem leva alguma coisa). */
  shares: LootShare[];
}

/**
 * Ordem da disputa: cada um rola um d20 e o maior vem primeiro; empate rola de novo só entre os empatados.
 * Devolve a ordem e o último d20 de cada um (o que decidiu).
 */
function rank(ids: string[], d20: () => number, last: Map<string, number>): string[] {
  const rolled = ids.map((id) => ({ id, v: d20() }));
  for (const r of rolled) last.set(r.id, r.v);
  const values = [...new Set(rolled.map((r) => r.v))].sort((a, b) => b - a);
  return values.flatMap((v) => {
    const tied = rolled.filter((r) => r.v === v).map((r) => r.id);
    return tied.length > 1 ? rank(tied, d20, last) : tied;
  });
}

/**
 * Divisão de uma entrada do baú entre quem quis (docs/design/baus.md, seção 3).
 * Um só: leva tudo, sem rolar. Vários: d20; pilha em rodízio pela ordem; moedas divididas igual, a sobra para o maior.
 */
export function resolveLoot(entry: LootEntry, wanters: string[], d20: () => number): LootResolution {
  if (wanters.length === 0) return { rolls: [], shares: [] };
  const last = new Map<string, number>();
  const order = wanters.length === 1 ? wanters : rank(wanters, d20, last);
  const rolls = wanters.length === 1 ? [] : order.map((id) => ({ id, d20: last.get(id)! }));

  if (entry.kind === "coins") {
    const n = order.length;
    const shares = order.map((id, i): LootShare => {
      const coins: Coins = {};
      for (const k of COINS) {
        const total = entry.coins[k] ?? 0;
        const each = Math.floor(total / n) + (i === 0 ? total % n : 0);
        if (each > 0) coins[k] = each;
      }
      return { id, qty: 0, coins };
    });
    return { rolls, shares: shares.filter((s) => Object.keys(s.coins!).length > 0) };
  }

  const qty = new Map<string, number>();
  for (let u = 0; u < entry.qty; u++) {
    const id = order[u % order.length];
    qty.set(id, (qty.get(id) ?? 0) + 1);
  }
  return { rolls, shares: order.filter((id) => qty.has(id)).map((id) => ({ id, qty: qty.get(id)! })) };
}
