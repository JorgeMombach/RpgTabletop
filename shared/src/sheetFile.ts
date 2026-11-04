// Arquivo de fichas (Fase 4, docs/design/salvar-importar.md): personagens e monstros em JSON, sem estado de batalha.
import type { Combatant, MobTemplate } from "./types";

/** Versão do formato do arquivo de fichas: sobe quando muda de um jeito que versões antigas não leem. */
export const SHEET_FILE_FORMAT = 1;

export type SheetKind = "characters" | "monsters";

/**
 * Ficha de personagem (aliado, invocação ou pet): o que ele é fora de combate.
 * Vida atual, posição, iniciativa, condições, tocha, gastos e o vínculo da invocação ficam de fora.
 * Espaços de magia e recursos vão com o máximo e `used: 0` (descansados).
 */
export type CharacterSheet = Pick<Combatant, "id" | "name" | "hpMax" | "dexMod" | "color"> &
  Partial<
    Pick<
      Combatant,
      | "ac"
      | "abilities"
      | "size"
      | "aura"
      | "auraColor"
      | "avatar"
      | "description"
      | "gmNotes"
      | "spellSlots"
      | "spells"
      | "resources"
      | "attacks"
      | "inventory"
      | "coins"
      | "animal"
      | "darkvision"
    >
  > & {
    /** Era uma invocação ou pet (de quem importar, fica ligada ao personagem dele). */
    summon?: true;
  };

export interface SheetFile {
  app: "jamals-tabletop";
  kind: SheetKind;
  format: number;
  appVersion: string;
  savedAt: string;
  items: CharacterSheet[] | MobTemplate[];
}

/** Copia só os campos presentes, sempre na mesma ordem (a comparação é pelo JSON). */
function pick<T extends object>(src: T, keys: readonly (keyof T)[]): Partial<T> {
  const out: Partial<T> = {};
  for (const k of keys) if (src[k] !== undefined) out[k] = structuredClone(src[k]);
  return out;
}

export const CHARACTER_SHEET_KEYS = [
  "ac",
  "abilities",
  "size",
  "aura",
  "auraColor",
  "avatar",
  "description",
  "gmNotes",
  "spellSlots",
  "spells",
  "resources",
  "attacks",
  "inventory",
  "coins",
  "animal",
  "darkvision",
] as const satisfies readonly (keyof Combatant)[];

/** A ficha de um combatente (aliado). `notes: false` tira as notas do mestre (arquivo do jogador). */
export function characterSheet(c: Combatant | CharacterSheet, notes = true): CharacterSheet {
  const s: CharacterSheet = { id: c.id, name: c.name, hpMax: c.hpMax, dexMod: c.dexMod, color: c.color, ...pick(c as Combatant, CHARACTER_SHEET_KEYS) };
  if (!notes) delete s.gmNotes;
  if (s.spellSlots) for (const slot of Object.values(s.spellSlots)) slot.used = 0;
  if (s.resources) for (const r of s.resources) r.used = 0;
  if ("summonerId" in c ? !!c.summonerId : "summon" in c && c.summon) s.summon = true;
  return s;
}

const TEMPLATE_KEYS = ["ac", "abilities", "size", "avatar", "description", "notes", "animal", "boss", "phases", "attacks"] as const satisfies readonly (keyof MobTemplate)[];

/** Modelo do bestiário com os campos em ordem fixa (para comparar). */
export function templateSheet(t: MobTemplate): MobTemplate {
  return { id: t.id, name: t.name, hpMax: t.hpMax, dexMod: t.dexMod, color: t.color, ...pick(t, TEMPLATE_KEYS) };
}

/** Mob ou NPC do mapa como modelo do bestiário: com o id do modelo de origem, quando tem (bate com o bestiário de quem importar). */
export function templateFromCombatant(c: Combatant): MobTemplate {
  const t: MobTemplate = { id: c.templateId ?? c.id, name: c.name, hpMax: c.hpMax, dexMod: c.dexMod, color: c.color };
  const extra = pick(c, ["ac", "abilities", "size", "avatar", "description", "animal", "boss", "phases", "attacks"] as const);
  return templateSheet({ ...t, ...extra, ...(c.gmNotes && { notes: c.gmNotes }) } as MobTemplate);
}

/** Mesma ficha (ignorando o id). */
export function sameSheet(a: CharacterSheet | MobTemplate, b: CharacterSheet | MobTemplate): boolean {
  return JSON.stringify({ ...a, id: "" }) === JSON.stringify({ ...b, id: "" });
}

/** "jamals-tabletop-thorin.json" (nome do arquivo sem acento nem espaço). */
export function sheetFileName(label: string): string {
  const slug = label
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40);
  return `jamals-tabletop-${slug || "fichas"}.json`;
}

/** Resultado da conferência de um item do arquivo antes de importar. */
export type SheetCheckStatus = "new" | "same" | "differs";

export interface SheetCheckItem {
  /** A ficha do arquivo, já validada e limpa. */
  sheet: CharacterSheet | MobTemplate;
  status: SheetCheckStatus;
  /** A ficha que está na mesa (só quando `same` ou `differs`). */
  table?: CharacterSheet | MobTemplate;
  /** Importar como cópia é permitido (jogador não fica com dois personagens). */
  canCopy: boolean;
}

export type SheetImportChoice = "replace" | "copy" | "skip";
