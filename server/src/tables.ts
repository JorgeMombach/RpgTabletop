// Tabelas aleatórias (Passo 13, docs/design/tabelas.md): validação e sorteio. Puro: o `rng` vem de fora (testes).
import { COINS, LIMITS, type Coin, type Coins, type LootInput, type RollTable, type TableLoot, type TableRow } from "@rpg/shared";
import { cryptoRng, roll, type Rng } from "./dice";
import { fail, requireInt } from "./validate";

/** Dados comuns: com a soma dos pesos igual a um deles, a tela mostra o dado ("d8"); senão, o intervalo ("1–7"). */
const DICE = [1, 2, 3, 4, 6, 8, 10, 12, 20, 100];
export const dieLabel = (total: number) => (DICE.includes(total) ? `d${total}` : `1–${total}`);

/** Dado dentro do texto: "2d4", "1d6+1", "3d6kh2", "1d10-2" (palavra inteira, sem espaços). */
const INLINE_DICE = /(?<![\w])(\d+d(?:\d+|%)(?:kh\d*|kl\d*|!)?(?:[+-]\d+)*)(?![\w])/gi;
/** Outra tabela dentro do texto: "[Nomes de goblin]". */
const TABLE_REF = /\[([^\]\n]{1,60})\]/g;

const clean = (raw: unknown, max: number) => (typeof raw === "string" ? raw.replace(/\s+/g, " ").trim().slice(0, max + 1) : "");

/** Quantidade de loot: número inteiro ("2") ou dado ("1d4", "3d6+2"), conferido agora para não falhar na hora de rolar. */
function amountOf(raw: unknown, label: string): string {
  const s = typeof raw === "number" ? String(raw) : clean(raw, LIMITS.dice.exprLength);
  if (/^\d+$/.test(s)) {
    requireInt(s, label, 1, LIMITS.itemQty);
    return s;
  }
  try {
    roll(s, "normal", () => 1);
  } catch {
    fail("{label}: use um número ou um dado (1d4, 3d6).", { label });
  }
  return s.toLowerCase().replace(/\s+/g, "");
}

function tableLoot(raw: unknown): TableLoot {
  const e = (raw ?? {}) as Record<string, unknown>;
  if (e.kind === "coins") {
    if (!(COINS as readonly string[]).includes(e.coin as string)) fail("Moeda desconhecida.");
    return { kind: "coins", coin: e.coin as Coin, amount: amountOf(e.amount, "Moedas") };
  }
  if (e.kind !== "item" && e.kind !== "weapon") fail("Tipo de loot inválido.");
  const name = clean(e.name, LIMITS.spellName);
  if (!name) fail("Informe o nome do item.");
  if (name.length > LIMITS.spellName) fail("Nome do item: até {n} letras.", { n: LIMITS.spellName });
  const qty = amountOf(e.qty, "Quantidade");
  const note = clean(e.note, LIMITS.spellNote).slice(0, LIMITS.spellNote);
  if (e.kind === "item") return { kind: "item", name, qty, ...(note && { note }) };
  const bonus = e.bonus === undefined || e.bonus === null || e.bonus === "" ? undefined : requireInt(e.bonus, "Bônus de ataque", -20, 40);
  const damage = clean(e.damage, LIMITS.dice.exprLength);
  if (damage) {
    try {
      roll(damage, "normal", () => 1);
    } catch {
      fail("Dano inválido: use algo como 1d8+3.");
    }
  }
  if (bonus === undefined && !damage) fail("Informe o bônus de ataque, o dano ou os dois.");
  return { kind: "weapon", name, qty, ...(bonus !== undefined && { bonus }), ...(damage && { damage }), ...(note && { note }) };
}

/** Tabela vinda do mestre ou do arquivo de sessão, conferida por inteiro (sem o id). */
export function parseTable(raw: unknown): Omit<RollTable, "id" | "public"> {
  const t = (raw ?? {}) as Record<string, unknown>;
  const name = clean(t.name, LIMITS.tableName);
  if (!name) fail("Dê um nome à tabela.");
  if (name.length > LIMITS.tableName) fail("Nome da tabela: até {n} letras.", { n: LIMITS.tableName });
  const kind = t.kind === "text" || t.kind === "loot" ? t.kind : fail("Tipo de tabela inválido.");
  if (!Array.isArray(t.rows) || t.rows.length === 0) fail("A tabela precisa de pelo menos uma linha.");
  if (t.rows.length > LIMITS.tableRows) fail("Limite de {n} linhas numa tabela.", { n: LIMITS.tableRows });
  const rows = t.rows.map((raw): TableRow => {
    const r = (raw ?? {}) as Record<string, unknown>;
    const weight = requireInt(r.weight, "Peso", 1, LIMITS.tableWeight);
    if (kind === "loot") {
      if (r.loot === undefined) fail("Cada linha de uma tabela de loot é moedas, item ou arma.");
      return { weight, loot: tableLoot(r.loot) };
    }
    const text = clean(r.text, LIMITS.tableText);
    if (!text) fail("Escreva o resultado de cada linha.");
    if (text.length > LIMITS.tableText) fail("Cada linha: até {n} letras.", { n: LIMITS.tableText });
    return { weight, text };
  });
  return { name, kind, rows };
}

/** Sorteia uma linha pelo peso; devolve a linha, o valor e o total (o "dado"). */
function pick(table: RollTable, rng: Rng): { row: TableRow; value: number; total: number } {
  const total = table.rows.reduce((n, r) => n + r.weight, 0);
  const value = rng(total);
  let at = 0;
  for (const row of table.rows) {
    at += row.weight;
    if (value <= at) return { row, value, total };
  }
  return { row: table.rows[table.rows.length - 1], value, total };
}

/** Rola os dados do texto ("5 (2d4)") e sorteia nas tabelas citadas ("[Nomes]"), até a profundidade máxima. */
function resolveText(text: string, tables: RollTable[], rng: Rng, depth: number): string {
  // Tabelas primeiro: o texto que vem delas é resolvido na chamada de dentro (com os dados dela).
  const parts = text.split(TABLE_REF);
  return parts
    .map((part, i) => {
      if (i % 2 === 0) return part.replace(INLINE_DICE, (expr) => `${roll(expr, "normal", rng).total} (${expr})`);
      const ref = tables.find((t) => t.kind === "text" && t.name.toLowerCase() === part.trim().toLowerCase());
      if (!ref || depth >= LIMITS.tableDepth) return `[${part}?]`;
      const { row } = pick(ref, rng);
      return resolveText("text" in row ? row.text : "", tables, rng, depth + 1);
    })
    .join("");
}

/** Rola uma tabela de texto: o dado, o valor sorteado e o texto da linha já resolvido. */
export function rollTable(table: RollTable, tables: RollTable[], rng: Rng = cryptoRng): { die: string; value: number; text: string } {
  const { row, value, total } = pick(table, rng);
  const text = "text" in row ? resolveText(row.text, tables, rng, 1) : lootText(lootOf(row.loot, rng));
  return { die: dieLabel(total), value, text: text.slice(0, 500) };
}

const amount = (expr: string, rng: Rng) => (/^\d+$/.test(expr) ? Number(expr) : Math.max(0, roll(expr, "normal", rng).total));

function lootOf(l: TableLoot, rng: Rng): LootInput | null {
  if (l.kind === "coins") {
    const n = Math.min(amount(l.amount, rng), LIMITS.coins);
    return n > 0 ? { kind: "coins", coins: { [l.coin]: n } } : null;
  }
  const qty = Math.min(amount(l.qty, rng), LIMITS.itemQty);
  if (qty < 1) return null;
  const { kind: _kind, qty: _qty, ...rest } = l;
  return { ...rest, kind: l.kind, qty } as LootInput;
}

/** Texto do loot para o log ("14 po; 2 × Poção de cura"). Os nomes são do mestre; as moedas vão na sigla em português. */
const COIN_ABBR: Record<Coin, string> = { pp: "pl", gp: "po", ep: "pe", sp: "pp", cp: "pc" };
export function lootText(loot: LootInput | (LootInput | null)[] | null): string {
  const list = (Array.isArray(loot) ? loot : [loot]).filter((x): x is LootInput => !!x);
  if (list.length === 0) return "—";
  return list
    .map((e) =>
      e.kind === "coins"
        ? (Object.entries(e.coins) as [Coin, number][]).map(([c, n]) => `${n} ${COIN_ABBR[c]}`).join(", ")
        : `${e.qty > 1 ? `${e.qty} × ` : ""}${e.name}`,
    )
    .join("; ");
}

const sameItem = (a: LootInput, b: LootInput) =>
  a.kind !== "coins" && b.kind === a.kind && b.name === a.name && b.note === a.note && (a.kind !== "weapon" || (b.kind === "weapon" && b.bonus === a.bonus && b.damage === a.damage));

/** Rola uma tabela de loot `times` vezes: moedas numa linha só (somadas) e item igual somando a quantidade. */
export function rollLootTable(table: RollTable, times: number, rng: Rng = cryptoRng): LootInput[] {
  const out: LootInput[] = [];
  const coins: Coins = {};
  for (let i = 0; i < times; i++) {
    const { row } = pick(table, rng);
    if (!("loot" in row)) continue;
    const got = lootOf(row.loot, rng);
    if (!got) continue;
    if (got.kind === "coins") {
      for (const [c, n] of Object.entries(got.coins) as [Coin, number][]) coins[c] = Math.min((coins[c] ?? 0) + n, LIMITS.coins);
      continue;
    }
    const same = out.find((e) => sameItem(e, got));
    if (same && same.kind !== "coins") same.qty = Math.min(same.qty + (got as { qty: number }).qty, LIMITS.itemQty);
    else out.push(got);
  }
  return Object.keys(coins).length ? [{ kind: "coins", coins }, ...out] : out;
}
