import type { ClientState } from "./types";

/**
 * Devolve `next` reaproveitando os pedaços de `prev` que não mudaram: o que é igual continua sendo o mesmo
 * objeto. O estado chega inteiro e novo a cada envio do servidor; assim dá para saber o que mudou de verdade
 * comparando só a referência. Se nada mudou, volta o próprio `prev`.
 */
export function shareEqual<T>(prev: T, next: T): T {
  if (Object.is(prev, next)) return prev;
  if (typeof prev !== "object" || typeof next !== "object" || prev === null || next === null) return next;
  if (Array.isArray(prev) !== Array.isArray(next)) return next;
  const a = prev as Record<string, unknown>;
  const b = next as Record<string, unknown>;
  const keys = Object.keys(b);
  let same = keys.length === Object.keys(a).length;
  const out: Record<string, unknown> | unknown[] = Array.isArray(next) ? [] : {};
  for (const k of keys) {
    const v = k in a ? shareEqual(a[k], b[k]) : b[k];
    (out as Record<string, unknown>)[k] = v;
    if (!(k in a) || v !== a[k]) same = false;
  }
  return same ? prev : (out as T);
}

/** Só o mapa desenha estes: mudar uma porta ou a névoa não precisa redesenhar os painéis. */
const MAP_ONLY = new Set<string>(["walls", "torches", "drawings", "fog", "sight"] satisfies (keyof ClientState["battle"])[]);

/**
 * Comparação de `React.memo` para os painéis laterais, depois de `shareEqual`: a interface só redesenha se
 * mudou um prop ou algo do estado além do que é só do mapa. Painel novo que ler `walls`, `torches`, `drawings`, `fog`
 * ou `sight` não pode usar esta comparação.
 */
export function samePanelProps<P extends { state: ClientState }>(a: Readonly<P>, b: Readonly<P>): boolean {
  const keys = Object.keys(b) as (keyof P)[];
  if (keys.length !== Object.keys(a).length) return false;
  if (keys.some((k) => k !== "state" && a[k] !== b[k])) return false;
  const s = a.state;
  const n = b.state;
  if (s === n) return true;
  const top = Object.keys(n) as (keyof ClientState)[];
  if (top.length !== Object.keys(s).length || top.some((k) => k !== "battle" && s[k] !== n[k])) return false;
  const battle = Object.keys(n.battle) as (keyof ClientState["battle"])[];
  return battle.length === Object.keys(s.battle).length && battle.every((k) => MAP_ONLY.has(k) || s.battle[k] === n.battle[k]);
}
