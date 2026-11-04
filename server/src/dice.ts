import { randomInt } from "node:crypto";
import { LIMITS, type RollMode, type RollResult, type RollTerm } from "@rpg/shared";
import { fail } from "./validate";

/** Devolve um inteiro em [1, faces]. Injetável para testes. */
export type Rng = (faces: number) => number;

export const cryptoRng: Rng = (faces) => randomInt(1, faces + 1);

type DiceTerm = {
  kind: "dice";
  sign: 1 | -1;
  count: number;
  faces: number;
  keep?: { high: boolean; n: number };
  explode?: true;
  fate?: true;
};
type ParsedTerm = DiceTerm | { kind: "const"; sign: 1 | -1; value: number };

// Dado com os modificadores de outros sistemas (Passo 5): `4d6kh3`, `2d20kl1`, `3d6!`, `5d6!kh3`, `4dF`.
const DICE_TERM = /^([+-]?)(\d*)d(\d+|%|f)(!?)(?:(kh|kl)(\d*))?$/;
const CONST_TERM = /^([+-]?)(\d+)$/;

/** Interpreta expressões como `1d20+5`, `2d6+1d4-1`, `d%`, `4d6kh3`, `2d20kl1`, `3d6!`, `4dF`. */
export function parseExpression(raw: string): ParsedTerm[] {
  const { exprLength, terms: maxTerms, count: maxCount, faces, constant } = LIMITS.dice;
  if (typeof raw !== "string") fail("Expressão inválida.");
  const expr = raw.toLowerCase().replace(/\s+/g, "");
  if (!expr) fail("Digite uma rolagem, ex.: 1d20+5.");
  if (expr.length > exprLength) fail("Expressão longa demais.");

  const tokens = expr.match(/[+-]?[^+-]+/g) ?? [];
  if (tokens.join("") !== expr) fail("Não entendi \"{expr}\". Use algo como 2d6+1d4+3.", { expr: raw });
  if (tokens.length > maxTerms) fail("Termos demais na rolagem.");

  let totalDice = 0;
  const terms = tokens.map((tok): ParsedTerm => {
    const dice = DICE_TERM.exec(tok);
    if (dice) {
      const count = dice[2] ? Number(dice[2]) : 1;
      const fate = dice[3] === "f";
      const f = fate ? 3 : dice[3] === "%" ? 100 : Number(dice[3]);
      if (count < 1) fail("Quantidade de dados precisa ser pelo menos 1.");
      if (!fate && (f < faces.min || f > faces.max)) fail("Dado d{f} não existe aqui (use d{min} a d{max}).", { f, min: faces.min, max: faces.max });
      if (fate && dice[4]) fail("Dado Fate não explode.");
      totalDice += count;
      const term: DiceTerm = { kind: "dice", sign: dice[1] === "-" ? -1 : 1, count, faces: f };
      if (fate) term.fate = true;
      if (dice[4]) term.explode = true;
      if (dice[5]) {
        const n = dice[6] ? Number(dice[6]) : 1;
        if (n < 1 || n > count) fail("Não dá para ficar com {n} de {count} dados.", { n, count });
        term.keep = { high: dice[5] === "kh", n };
      }
      return term;
    }
    const c = CONST_TERM.exec(tok);
    if (c) {
      const value = Number(c[2]);
      if (value > constant) fail("Modificador grande demais.");
      return { kind: "const", sign: c[1] === "-" ? -1 : 1, value };
    }
    return fail("Não entendi \"{expr}\". Use algo como 2d6+1d4+3.", { expr: tok.replace(/^[+-]/, "") });
  });

  if (!terms.some((t) => t.kind === "dice")) fail("A rolagem precisa de pelo menos um dado.");
  if (totalDice > maxCount) fail("Dados demais (máximo {n}).", { n: maxCount });
  return terms;
}

function formatTerm(t: ParsedTerm, first: boolean): string {
  const sign = t.sign < 0 ? "-" : first ? "" : "+";
  if (t.kind === "const") return sign + String(t.value);
  const keep = t.keep ? `${t.keep.high ? "kh" : "kl"}${t.keep.n}` : "";
  return `${sign}${t.count}d${t.fate ? "F" : t.faces}${t.explode ? "!" : ""}${keep}`;
}

/** Índices dos dados que o `keep` descarta (empate: fica o que veio primeiro). */
function droppedBy(rolls: number[], keep: { high: boolean; n: number }): number[] {
  const order = rolls.map((v, i) => ({ v, i })).sort((a, b) => (keep.high ? b.v - a.v : a.v - b.v) || a.i - b.i);
  return order
    .slice(keep.n)
    .map((x) => x.i)
    .sort((a, b) => a - b);
}

/** Rola a expressão. Vantagem/desvantagem vale para o primeiro 1d20 simples (sem modificadores) da expressão. */
export function roll(raw: string, mode: RollMode = "normal", rng: Rng = cryptoRng): RollResult {
  const parsed = parseExpression(raw);
  const advIndex = mode === "normal" ? -1 : parsed.findIndex((t) => t.kind === "dice" && t.count === 1 && t.faces === 20 && !t.keep && !t.explode && !t.fate);
  if (mode !== "normal" && advIndex < 0) fail("Vantagem/desvantagem precisa de um 1d20 na rolagem.");

  // Explosões contam no limite de dados da rolagem inteira (um d2! que sempre tira 2 para aí).
  let budget = LIMITS.dice.count - parsed.reduce((n, t) => n + (t.kind === "dice" ? t.count : 0), 0);
  let total = 0;
  const terms = parsed.map((t, i): RollTerm => {
    if (t.kind === "const") {
      total += t.sign * t.value;
      return t;
    }
    if (i === advIndex) {
      const rolls = [rng(20), rng(20)];
      const keptIndex = (mode === "adv" ? rolls[0] >= rolls[1] : rolls[0] <= rolls[1]) ? 0 : 1;
      total += t.sign * rolls[keptIndex];
      return { ...t, rolls, keptIndex };
    }
    const one = () => (t.fate ? rng(3) - 2 : rng(t.faces));
    const rolls: number[] = [];
    for (let k = 0; k < t.count; k++) {
      let v = one();
      rolls.push(v);
      while (t.explode && v === t.faces && budget > 0) {
        budget--;
        v = one();
        rolls.push(v);
      }
    }
    const dropped = t.keep ? droppedBy(rolls, t.keep) : [];
    total += t.sign * rolls.reduce((a, v, j) => (dropped.includes(j) ? a : a + v), 0);
    return { ...t, rolls, ...(t.keep && { dropped }) };
  });

  return { expr: parsed.map((t, i) => formatTerm(t, i === 0)).join(""), mode, terms, total };
}
