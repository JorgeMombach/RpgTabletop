// Monstros do System Reference Document 5.1 (Wizards of the Coast LLC), sob CC BY 4.0
// (https://creativecommons.org/licenses/by/4.0/). Crédito na tela Sobre.
// Fase A do Passo 12: poucos monstros, para a estrutura do catálogo. O lote inteiro vem na fase B.
import type { CatalogCollection } from "@rpg/shared";

const t = (pt: string, en: string, es: string) => ({ "pt-BR": pt, en, es });

export const SRD51: CatalogCollection = {
  id: "srd51",
  name: "SRD 5.1",
  entries: [
    {
      id: "srd:goblin",
      name: t("Goblin", "Goblin", "Goblin"),
      type: "humanoid",
      size: "small",
      cr: "1/4",
      hpMax: 7,
      ac: 15,
      abilities: { str: 8, dex: 14, con: 10, int: 10, wis: 8, cha: 8 },
      attacks: [
        { name: t("Cimitarra", "Scimitar", "Cimitarra"), bonus: 4, damage: "1d6+2" },
        { name: t("Arco curto", "Shortbow", "Arco corto"), bonus: 4, damage: "1d6+2" },
      ],
    },
    {
      id: "srd:skeleton",
      name: t("Esqueleto", "Skeleton", "Esqueleto"),
      type: "undead",
      size: "medium",
      cr: "1/4",
      hpMax: 13,
      ac: 13,
      abilities: { str: 10, dex: 14, con: 15, int: 6, wis: 8, cha: 5 },
      attacks: [
        { name: t("Espada curta", "Shortsword", "Espada corta"), bonus: 4, damage: "1d6+2" },
        { name: t("Arco curto", "Shortbow", "Arco corto"), bonus: 4, damage: "1d6+2" },
      ],
    },
    {
      id: "srd:wolf",
      name: t("Lobo", "Wolf", "Lobo"),
      type: "beast",
      size: "medium",
      cr: "1/4",
      hpMax: 11,
      ac: 13,
      abilities: { str: 12, dex: 15, con: 12, int: 3, wis: 12, cha: 6 },
      attacks: [{ name: t("Mordida", "Bite", "Mordisco"), bonus: 4, damage: "2d4+2" }],
    },
    {
      id: "srd:ogre",
      name: t("Ogro", "Ogre", "Ogro"),
      type: "giant",
      size: "large",
      cr: "2",
      hpMax: 59,
      ac: 11,
      abilities: { str: 19, dex: 8, con: 16, int: 5, wis: 7, cha: 7 },
      attacks: [
        { name: t("Clava grande", "Greatclub", "Gran clava"), bonus: 6, damage: "2d8+4" },
        { name: t("Azagaia", "Javelin", "Jabalina"), bonus: 6, damage: "2d6+4" },
      ],
    },
    {
      id: "srd:young-red-dragon",
      name: t("Dragão Vermelho Jovem", "Young Red Dragon", "Dragón Rojo Joven"),
      type: "dragon",
      size: "large",
      cr: "10",
      hpMax: 178,
      ac: 18,
      abilities: { str: 23, dex: 10, con: 21, int: 14, wis: 11, cha: 19 },
      attacks: [
        { name: t("Mordida", "Bite", "Mordisco"), bonus: 10, damage: "2d10+1d6+6" },
        { name: t("Garra", "Claw", "Garra"), bonus: 10, damage: "2d6+6" },
      ],
    },
  ],
};

/** Todas as coleções embutidas (o SRD 5.2 entra depois como outra). */
export const CATALOG = [SRD51];

export const catalogEntry = (id: string) => CATALOG.flatMap((c) => c.entries).find((e) => e.id === id);
