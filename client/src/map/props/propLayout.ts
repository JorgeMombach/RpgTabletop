import { PROP_KINDS, type MapProp, type PropKind } from "@rpg/shared";

/**
 * Objetos na placa de vídeo (docs/design/objetos.md): a conta pura, sem DOM nem WebGL (testada no servidor). A forma
 * de cada objeto é assada uma vez por tipo, semente e resolução num atlas (`PropAtlas`); cada objeto na tela vira uma
 * linha de dados (`propRow`) que o desenho lê.
 */

/** Até onde o desenho vai a partir do centro, em casas (no tamanho 1), com a sombra: o tamanho da imagem guardada. */
export const PROP_EXTENT: Record<PropKind, number> = {
  tree: 1.65,
  bush: 0.75,
  boulder: 0.95,
  stones: 0.75,
  log: 1.45,
  stump: 0.85,
  rubble: 0.8,
  barrel: 0.6,
  crate: 0.75,
  crates: 1.1,
  planks: 1.0,
  table: 1.05,
  pillar: 0.85,
  statue: 1.55,
  bones: 0.75,
  altar: 1.0,
  tent: 1.45,
  cart: 1.4,
  well: 0.85,
  shelf: 1.0,
  bed: 1.05,
  sacks: 0.75,
  mushrooms: 0.55,
  flowers: 0.55,
  bridge: 1.7,
  pine: 1.5,
  palm: 1.4,
  tallGrass: 0.8,
};

/**
 * Altura da sombra de cada tipo, em casas (no tamanho 1): a silhueta vai para longe do sol por essa altura (a mesma
 * conta da sombra das paredes). Os seis do teste aprovado; os outros, da página de catálogo (por ora, sem sombra).
 */
export const PROP_CAST: Record<PropKind, number> = {
  tree: 1.25,
  pine: 1.2,
  bush: 0.5,
  boulder: 0.45,
  barrel: 0.8,
  cart: 0.55,
  stones: 0,
  log: 0,
  stump: 0,
  rubble: 0,
  crate: 0,
  crates: 0,
  planks: 0,
  table: 0,
  pillar: 0,
  statue: 0,
  bones: 0,
  altar: 0,
  tent: 0,
  well: 0,
  shelf: 0,
  bed: 0,
  sacks: 0,
  mushrooms: 0,
  flowers: 0,
  bridge: 0,
  palm: 0,
  tallGrass: 0,
};

/** Pontos por casa da forma guardada, da melhor resolução à menor (o detalhe fino é calculado na hora). */
export const PROP_TIERS: readonly number[] = [48, 24];

/** Lugares do atlas por tamanho: pequeno para desenhos até 1 casa do centro, grande para o resto (até 1,7). */
export type PropSlotClass = "small" | "large";
const CLASS_EXTENT: Record<PropSlotClass, number> = { small: 1.0, large: 1.7 };

export const slotClassOf = (kind: PropKind): PropSlotClass => (PROP_EXTENT[kind] <= CLASS_EXTENT.small ? "small" : "large");

/** Folga para voltar à resolução melhor: só volta quando cabe com 1/4 sobrando (não fica trocando para lá e para cá). */
const TIER_UP_ROOM = 0.75;

export interface PropSlot {
  /** Camada do atlas (`TEXTURE_2D_ARRAY`). */
  layer: number;
  /** Canto do lugar, em px. */
  x: number;
  y: number;
  side: number;
}

interface SlotEntry {
  slot: PropSlot;
  slotClass: PropSlotClass;
  usedAt: number;
}

/**
 * Atlas das formas: camadas de lugares pequenos e camadas de lugares grandes, do tamanho da resolução atual. A forma
 * de um objeto fica no lugar dela enquanto é usada; com o atlas cheio, sai a usada há mais quadros (nunca uma deste
 * quadro). Muitos objetos na tela: a resolução cai (e tudo é assado de novo); poucos, volta.
 */
export class PropAtlas {
  private tier = 0;
  private readonly entries = new Map<string, SlotEntry>();
  private free: Record<PropSlotClass, PropSlot[]> = { small: [], large: [] };

  constructor(
    private readonly size: number,
    private readonly layers: { small: number; large: number },
  ) {
    this.reset();
  }

  /** Resolução atual (índice em `PROP_TIERS`). */
  get currentTier(): number {
    return this.tier;
  }

  /** Lado de um lugar, em px. */
  sideOf(slotClass: PropSlotClass, tier = this.tier): number {
    return Math.ceil(CLASS_EXTENT[slotClass] * 2 * PROP_TIERS[tier]);
  }

  private capacity(slotClass: PropSlotClass, tier: number): number {
    const perSide = Math.floor(this.size / this.sideOf(slotClass, tier));
    return this.layers[slotClass] * perSide * perSide;
  }

  private fits(onScreen: { small: number; large: number }, tier: number, room: number): boolean {
    return onScreen.small <= this.capacity("small", tier) * room && onScreen.large <= this.capacity("large", tier) * room;
  }

  /** Resolução para `onScreen` objetos de cada tamanho; mudando, o atlas esvazia (tudo é assado de novo). */
  tierFor(onScreen: { small: number; large: number }): number {
    let tier = this.tier;
    while (tier < PROP_TIERS.length - 1 && !this.fits(onScreen, tier, 1)) tier++;
    while (tier > 0 && this.fits(onScreen, tier - 1, TIER_UP_ROOM)) tier--;
    if (tier !== this.tier) {
      this.tier = tier;
      this.reset();
    }
    return tier;
  }

  /** Lugar da forma (chave = tipo|semente|resolução); `fresh` = precisa assar. Sem lugar: null. */
  slotFor(key: string, slotClass: PropSlotClass, frame: number): { slot: PropSlot; fresh: boolean } | null {
    const known = this.entries.get(key);
    if (known) {
      known.usedAt = frame;
      return { slot: known.slot, fresh: false };
    }
    let slot = this.free[slotClass].shift();
    if (!slot) {
      let oldestKey: string | null = null;
      let oldestAt = frame;
      for (const [entryKey, entry] of this.entries) {
        if (entry.slotClass === slotClass && entry.usedAt < oldestAt) {
          oldestKey = entryKey;
          oldestAt = entry.usedAt;
        }
      }
      const oldest = oldestKey === null ? undefined : this.entries.get(oldestKey);
      if (oldestKey === null || !oldest) return null;
      this.entries.delete(oldestKey);
      slot = oldest.slot;
    }
    this.entries.set(key, { slot, slotClass, usedAt: frame });
    return { slot, fresh: true };
  }

  /** Esquece tudo (troca de resolução, contexto perdido). */
  reset(): void {
    this.entries.clear();
    let layer = 0;
    for (const slotClass of ["small", "large"] as const) {
      const side = this.sideOf(slotClass);
      const perSide = Math.floor(this.size / side);
      const list: PropSlot[] = [];
      for (let index = 0; index < this.layers[slotClass]; index++, layer++) {
        for (let row = 0; row < perSide; row++) for (let col = 0; col < perSide; col++) list.push({ layer, x: col * side, y: row * side, side });
      }
      this.free[slotClass] = list;
    }
  }
}

/** Objeto sendo arrastado ou mexido pelas alças: o desenho acompanha antes de ir ao servidor. */
export interface PropDrag {
  col: number;
  row: number;
  size: number;
  /** Graus, como `MapProp.rotation`. */
  rotation: number;
}

export interface PropRowInput {
  prop: MapProp;
  /** Altura do chão no centro (casas), pelo relevo. */
  base: number;
  /** Copa com token embaixo: meio transparente e parada. */
  faded: boolean;
  drag: PropDrag | null;
}

/** Floats por objeto na linha de dados (3 vec4). */
export const PROP_ROW_FLOATS = 12;

/** 3 vec4 por objeto: [col, row, tamanho, giro em rad], [tipo, semente, base, transparente], [camada, x, y, lado]. */
export function propRow(input: PropRowInput, slot: PropSlot): Float32Array {
  const { prop, drag } = input;
  const place = drag ?? prop;
  const row = new Float32Array(PROP_ROW_FLOATS);
  row.set([place.col, place.row, place.size, (place.rotation * Math.PI) / 180], 0);
  row.set([PROP_KINDS.indexOf(prop.kind), prop.seed, input.base, input.faded ? 1 : 0], 4);
  row.set([slot.layer, slot.x, slot.y, slot.side], 8);
  return row;
}

/** Caixa do objeto no mapa, em casas: o desenho inteiro em qualquer giro (para descartar os de fora da tela). */
export function propBounds(prop: MapProp, drag: PropDrag | null): { left: number; top: number; right: number; bottom: number } {
  const place = drag ?? prop;
  const half = PROP_EXTENT[prop.kind] * place.size * Math.SQRT2;
  return { left: place.col - half, top: place.row - half, right: place.col + half, bottom: place.row + half };
}
