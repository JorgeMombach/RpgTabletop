// Diferenças entre a ficha da mesa e a do arquivo (janela de importar, Fase 4): só o que mudou, em texto.
import { ABILITIES, COINS, SPELL_LEVELS, type CharacterSheet, type MobTemplate } from "@rpg/shared";
import { t, type MessageKey } from "./i18n";

export type DiffRow = { label: string; table: string; file: string } | { label: string; added: string[]; removed: string[] };

type Sheet = Partial<CharacterSheet & MobTemplate>;

const dash = "—";
const signed = (n: number) => (n >= 0 ? `+${n}` : String(n));
const yesNo = (v: unknown) => t(v ? "sheetFile.yes" : "sheetFile.no");
const short = (s: string | undefined) => (!s ? dash : s.length > 80 ? `${s.slice(0, 78)}…` : s);

function slots(s: Sheet): string {
  const parts = SPELL_LEVELS.filter((l) => (s.spellSlots?.[l]?.max ?? 0) > 0).map((l) => `${l}º: ${s.spellSlots![l].max}`);
  return parts.join(" · ") || dash;
}

function coins(s: Sheet): string {
  const parts = COINS.filter((k) => (s.coins?.[k] ?? 0) > 0).map((k) => `${s.coins![k]} ${t(`coin.${k}` as MessageKey).toLowerCase()}`);
  return parts.join(" · ") || dash;
}

/** Como cada item de lista aparece ("Poção de cura ×2", "Machado +5 (1d8+3)"): o que muda no texto conta como trocado. */
function attackLabel(a: { name: string; bonus?: number; damage?: string }): string {
  return [a.name, a.bonus !== undefined ? signed(a.bonus) : "", a.damage ? `(${a.damage})` : ""].filter(Boolean).join(" ");
}

function listDiff(label: string, table: string[] = [], file: string[] = []): DiffRow | null {
  const removed = table.filter((x) => !file.includes(x));
  const added = file.filter((x) => !table.includes(x));
  return removed.length || added.length ? { label, added, removed } : null;
}

/** Linhas da tabela de diferenças, na ordem da ficha. Só a ficha entra (o estado de batalha nem vem no arquivo). */
export function sheetDiff(a: Sheet, b: Sheet): DiffRow[] {
  const rows: (DiffRow | null)[] = [];
  const value = (label: string, x: string, y: string) => rows.push(x === y ? null : { label, table: x, file: y });

  value(t("form.name"), a.name ?? dash, b.name ?? dash);
  value(t("form.hpMax"), String(a.hpMax ?? dash), String(b.hpMax ?? dash));
  value(t("form.ac"), a.ac !== undefined ? String(a.ac) : dash, b.ac !== undefined ? String(b.ac) : dash);
  value(t("form.init"), signed(a.dexMod ?? 0), signed(b.dexMod ?? 0));
  for (const k of ABILITIES) {
    const x = a.abilities?.[k];
    const y = b.abilities?.[k];
    value(t(`ability.${k}` as MessageKey), x !== undefined ? String(x) : dash, y !== undefined ? String(y) : dash);
  }
  value(t("form.size"), t(`size.${a.size ?? "medium"}` as MessageKey), t(`size.${b.size ?? "medium"}` as MessageKey));
  value(t("form.color"), a.color ?? dash, b.color ?? dash);
  if (a.avatar !== b.avatar) rows.push({ label: t("sheetFile.avatar"), table: t(a.avatar ? "sheetFile.hasImage" : "sheetFile.noImage"), file: t(b.avatar ? (a.avatar ? "sheetFile.otherImage" : "sheetFile.hasImage") : "sheetFile.noImage") });
  value(t("aura.label"), a.aura ? `${a.aura} ft` : dash, b.aura ? `${b.aura} ft` : dash);
  value(t("sheetFile.auraColor"), a.auraColor ?? dash, b.auraColor ?? dash);
  value(t("form.animal"), yesNo(a.animal), yesNo(b.animal));
  value(t("form.darkvision"), yesNo(a.darkvision), yesNo(b.darkvision));
  value(t("form.boss"), yesNo(a.boss), yesNo(b.boss));
  value(t("phases.title"), String(a.phases?.length ?? 0), String(b.phases?.length ?? 0));
  value(t("form.description"), short(a.description), short(b.description));
  value(t("form.notes"), short(a.gmNotes ?? a.notes), short(b.gmNotes ?? b.notes));
  value(t("sheetFile.slots"), slots(a), slots(b));
  rows.push(listDiff(t("sheetFile.spells"), a.spells?.map((s) => (s.level ? `${s.name} (${s.level}º)` : s.name)), b.spells?.map((s) => (s.level ? `${s.name} (${s.level}º)` : s.name))));
  rows.push(listDiff(t("sheetFile.attacks"), a.attacks?.map(attackLabel), b.attacks?.map(attackLabel)));
  rows.push(listDiff(t("sheetFile.resources"), a.resources?.map((r) => `${r.name} ×${r.max}`), b.resources?.map((r) => `${r.name} ×${r.max}`)));
  const item = (i: { name: string; qty: number; bonus?: number; damage?: string }) => `${attackLabel(i)}${i.qty !== 1 ? ` ×${i.qty}` : ""}`;
  rows.push(listDiff(t("sheetFile.inventory"), a.inventory?.map(item), b.inventory?.map(item)));
  value(t("sheetFile.coins"), coins(a), coins(b));
  rows.push(listDiff(t("sheet.rolls.title"), a.rolls?.map((r) => `${r.name} (${r.expr})`), b.rolls?.map((r) => `${r.name} (${r.expr})`)));
  const out = rows.filter((r): r is DiffRow => r !== null);
  // Diferença que nenhuma linha mostra (nota de uma magia, recarga de um recurso…): uma linha genérica, para não abrir a janela vazia.
  return out.length ? out : [{ label: t("sheetFile.details"), table: t("sheetFile.detailsTable"), file: t("sheetFile.detailsFile") }];
}

/** Resumo de uma linha para a lista de vários ("Vida máx. 59 → 68 · CA 11 → 12 · +1 ataques"). */
export function diffSummary(rows: DiffRow[]): string {
  return rows
    .slice(0, 3)
    .map((r) => ("added" in r ? `${r.label}: ${[r.added.length ? `+${r.added.length}` : "", r.removed.length ? `−${r.removed.length}` : ""].filter(Boolean).join(" ")}` : `${r.label} ${r.table} → ${r.file}`))
    .concat(rows.length > 3 ? [t("sheetFile.more", { n: rows.length - 3 })] : [])
    .join(" · ");
}
