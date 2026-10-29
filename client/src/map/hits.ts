import type { HpHit } from "@rpg/shared";
import { create } from "zustand";

/**
 * Golpes e curas que chegam do servidor (L6), à espera de virar número subindo do token. Cada um tem uma
 * chave própria: dois golpes seguidos no mesmo token sobem os dois. O token tira o seu quando a animação acaba.
 */
export interface FloatHit {
  key: number;
  delta: number;
}

let nextKey = 1;

export const useHits = create<{ byId: Record<string, FloatHit[]> }>(() => ({ byId: {} }));

export function pushHits(hits: HpHit[]) {
  useHits.setState((s) => {
    const byId = { ...s.byId };
    for (const h of hits) byId[h.id] = [...(byId[h.id] ?? []).slice(-2), { key: nextKey++, delta: h.delta }];
    return { byId };
  });
}

export function dropHit(id: string, key: number) {
  useHits.setState((s) => {
    const left = (s.byId[id] ?? []).filter((h) => h.key !== key);
    const byId = { ...s.byId };
    if (left.length) byId[id] = left;
    else delete byId[id];
    return { byId };
  });
}
