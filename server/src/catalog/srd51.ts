// Monstros do System Reference Document 5.1 (Wizards of the Coast LLC), sob CC BY 4.0
// (https://creativecommons.org/licenses/by/4.0/). Crédito na tela Sobre.
// Os dados vêm de srd51-entries.ts, gerado por scripts/srd51/build.mjs (traduções em scripts/srd51/translations.mjs).
import type { CatalogCollection } from "@rpg/shared";
import { SRD51_ENTRIES } from "./srd51-entries";

export const SRD51: CatalogCollection = { id: "srd51", name: "SRD 5.1", entries: SRD51_ENTRIES };

/** Todas as coleções embutidas (o SRD 5.2 entra depois como outra). */
export const CATALOG = [SRD51];

export const catalogEntry = (id: string) => CATALOG.flatMap((c) => c.entries).find((e) => e.id === id);
