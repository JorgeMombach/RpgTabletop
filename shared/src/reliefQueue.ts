/**
 * Fila dos pedidos de altura do relevo ao Worker (docs/design/relevo.md). Pintar gera um pedaço mudado a cada
 * movimento do mouse, e cada pedido leva de dezenas a centenas de ms: um pedido por vez, e o que muda enquanto ele
 * roda se junta para o próximo (nada se perde nem se acumula). `reset` (relevo inteiro novo: outra cena, aplainar
 * tudo) faz a resposta que ainda estiver em andamento não valer mais.
 */
export class ReliefQueue {
  private generation = 0;
  private nextId = 0;
  private inFlight: { id: number; generation: number } | null = null;
  private readonly dirty = new Set<string>();

  /** Pedaços que precisam de altura nova. */
  mark(keys: Iterable<string>) {
    for (const key of keys) this.dirty.add(key);
  }

  /** Recomeça do zero: o que está marcado sai e a resposta em andamento não vale mais. */
  reset() {
    this.generation++;
    this.dirty.clear();
  }

  /** O próximo pedido, se nenhum está em andamento e há algo marcado. */
  take(): { id: number; keys: string[] } | null {
    if (this.inFlight || this.dirty.size === 0) return null;
    const id = ++this.nextId;
    const keys = [...this.dirty];
    this.dirty.clear();
    this.inFlight = { id, generation: this.generation };
    return { id, keys };
  }

  /** Chegou a resposta `id`: destrava o próximo pedido. Devolve se ela ainda vale (mesma geração). */
  accept(id: number): boolean {
    if (!this.inFlight || this.inFlight.id !== id) return false;
    const valid = this.inFlight.generation === this.generation;
    this.inFlight = null;
    return valid;
  }
}
