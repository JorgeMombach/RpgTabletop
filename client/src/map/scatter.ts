import type { MapProp, PropKind } from "@rpg/shared";

/**
 * Pincel de espalhar (cenário, passo 3): distribui objetos nas casas pintadas, sem encavalar. Cada conjunto diz o
 * que entra e com que peso; cada objeto sai com tamanho, giro e variação sorteados.
 */
export const SCATTER_SETS = ["forest", "grove", "rocks", "rubble"] as const;
export type ScatterSet = (typeof SCATTER_SETS)[number];

interface SetEntry {
  kind: PropKind;
  weight: number;
  size: [number, number];
}

const SETS: Record<ScatterSet, SetEntry[]> = {
  // Floresta: árvores fechadas, arbustos entre elas, um toco ou tronco aqui e ali.
  forest: [
    { kind: "tree", weight: 6, size: [0.85, 1.3] },
    { kind: "bush", weight: 3, size: [0.8, 1.3] },
    { kind: "stump", weight: 0.5, size: [0.8, 1.2] },
    { kind: "log", weight: 0.5, size: [0.8, 1.1] },
  ],
  // Bosque ralo: poucas árvores, mais arbustos, tocos e pedras.
  grove: [
    { kind: "tree", weight: 2, size: [0.8, 1.15] },
    { kind: "bush", weight: 4, size: [0.7, 1.2] },
    { kind: "stump", weight: 1.5, size: [0.8, 1.2] },
    { kind: "stones", weight: 1.5, size: [0.8, 1.2] },
  ],
  // Pedregal: pedregulhos e pedras soltas.
  rocks: [
    { kind: "boulder", weight: 5, size: [0.6, 1.5] },
    { kind: "stones", weight: 2.5, size: [0.8, 1.3] },
  ],
  // Entulho: ruína desabada.
  rubble: [
    { kind: "rubble", weight: 5, size: [0.8, 1.4] },
    { kind: "stones", weight: 2, size: [0.8, 1.2] },
    { kind: "planks", weight: 1.2, size: [0.7, 1] },
    { kind: "boulder", weight: 0.8, size: [0.5, 0.9] },
  ],
};

/** Quanto cada objeto ocupa (raio em casas, no tamanho 1): é o que não deixa encavalar. */
const ROOM: Record<PropKind, number> = {
  tree: 0.95,
  bush: 0.42,
  boulder: 0.55,
  stones: 0.38,
  log: 0.75,
  stump: 0.3,
  rubble: 0.45,
  barrel: 0.3,
  crate: 0.38,
  crates: 0.6,
  planks: 0.55,
  table: 0.6,
  pillar: 0.45,
};

/** Aleatório com semente (a mesma pincelada sai igual no protótipo). */
export function seeded(seed: number) {
  let s = seed >>> 0 || 1;
  return () => {
    s ^= s << 13;
    s ^= s >>> 17;
    s ^= s << 5;
    return ((s >>> 0) % 100000) / 100000;
  };
}

export type ScatterProp = Omit<MapProp, "id" | "above" | "blocks">;

/**
 * Espalha objetos do conjunto nas casas (`cells` = "col,row"), evitando os que já estão no mapa (`taken`).
 * `density` vai de 0,2 (ralo) a 1 (fechado). Devolve no máximo `max` objetos.
 */
export function scatter(set: ScatterSet, cells: Set<string>, density: number, taken: Pick<MapProp, "kind" | "col" | "row" | "size">[], random: () => number, max = 300): ScatterProp[] {
  const picks = SETS[set];
  const total = picks.reduce((s, p) => s + p.weight, 0);
  const list = [...cells].map((k) => k.split(",").map(Number) as [number, number]);
  if (list.length === 0) return [];
  // Vizinhos já postos (os do mapa e os desta pincelada), para não encavalar.
  const placed = taken.map((p) => ({ col: p.col, row: p.row, r: ROOM[p.kind] * p.size }));
  const out: ScatterProp[] = [];
  // Tentativas proporcionais à área: mais densidade, mais tentativas (e o espaçamento aperta um pouco).
  const tries = Math.round(list.length * (0.6 + density * 2.4));
  const squeeze = 1.15 - density * 0.35;
  // Do maior para o menor: as árvores ocupam o espaço, os arbustos enchem os vãos, as peças pequenas vêm por
  // último. Cada tipo tenta na proporção do peso dele (assim toco não sobra numa floresta rala).
  const order = [...picks].sort((a, b) => ROOM[b.kind] * (b.size[0] + b.size[1]) - ROOM[a.kind] * (a.size[0] + a.size[1]));
  for (const pick of order) {
    const mine = Math.round((tries * pick.weight) / total);
    for (let t = 0; t < mine && out.length < max; t++) {
      const [c, r] = list[Math.floor(random() * list.length)];
      const col = c + random();
      const row = r + random();
      const size = Math.round((pick.size[0] + random() * (pick.size[1] - pick.size[0])) * 100) / 100;
      const room = ROOM[pick.kind] * size;
      if (placed.some((p) => Math.hypot(p.col - col, p.row - row) < (p.r + room) * squeeze)) continue;
      placed.push({ col, row, r: room });
      out.push({ kind: pick.kind, col: Math.round(col * 100) / 100, row: Math.round(row * 100) / 100, size, rotation: Math.floor(random() * 360), seed: Math.floor(random() * 2 ** 16) });
    }
  }
  return out;
}
