// Catálogo de monstros (Passo 12, docs/design/catalogo-srd.md): coleções embutidas no app (a primeira é o SRD 5.1).
// O mestre copia um monstro para o bestiário dele; o catálogo nunca muda.
import type { Abilities, MobTemplate, Size } from "./types";

export type CatalogLang = "pt-BR" | "en" | "es";
/** Texto nas três línguas do app. */
export type Tr = Record<CatalogLang, string>;

export const CREATURE_TYPES = ["aberration", "beast", "celestial", "construct", "dragon", "elemental", "fey", "fiend", "giant", "humanoid", "monstrosity", "ooze", "plant", "undead"] as const;
export type CreatureType = (typeof CREATURE_TYPES)[number];

/** Cor do token pelo tipo de criatura (o SRD não tem imagens), nos tons do guia visual. */
export const CREATURE_COLOR: Record<CreatureType, string> = {
  aberration: "#6e4a8a",
  beast: "#8a6a3b",
  celestial: "#d8b47a",
  construct: "#7a7468",
  dragon: "#a8323a",
  elemental: "#3b7a8a",
  fey: "#5a8a4a",
  fiend: "#8a2e4a",
  giant: "#5a6e8a",
  humanoid: "#a07850",
  monstrosity: "#7a5a2e",
  ooze: "#6a8a3b",
  plant: "#3b6e3b",
  undead: "#7d8590",
};

export interface CatalogEntry {
  /** Origem estável ("srd:goblin"): vira o id do primeiro modelo copiado e a \`source\` de todos. */
  id: string;
  name: Tr;
  type: CreatureType;
  size: Size;
  /** Nível de desafio como no livro ("1/4", "2", "10"). */
  cr: string;
  hpMax: number;
  ac: number;
  abilities: Required<Abilities>;
  attacks: { name: Tr; bonus?: number; damage?: string }[];
}

export interface CatalogCollection {
  id: string;
  /** Nome curto ("SRD 5.1"). */
  name: string;
  entries: CatalogEntry[];
}

/** ND em número, para ordenar e filtrar ("1/4" → 0,25). */
export function crValue(cr: string): number {
  const [a, b] = cr.split("/").map(Number);
  return b ? a / b : a;
}

/** Os números do monstro como modelo do bestiário (sem id, nome nem cor: quem cria decide). */
export function catalogStats(e: CatalogEntry, lang: CatalogLang): Pick<MobTemplate, "hpMax" | "dexMod" | "ac" | "abilities" | "size" | "attacks" | "notes"> {
  return {
    hpMax: e.hpMax,
    dexMod: Math.floor((e.abilities.dex - 10) / 2),
    ac: e.ac,
    abilities: { ...e.abilities },
    ...(e.size !== "medium" && { size: e.size }),
    ...(e.attacks.length > 0 && {
      attacks: e.attacks.map((a, i) => ({ id: `${e.id}:${i}`, name: a.name[lang], ...(a.bonus !== undefined && { bonus: a.bonus }), ...(a.damage && { damage: a.damage }) })),
    }),
    notes: `ND ${e.cr} · SRD 5.1`,
  };
}
