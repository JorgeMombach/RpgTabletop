import { randomInt } from "node:crypto";
import { LIMITS, type RollMode, type RollResult, type RollTerm } from "@rpg/shared";
import { fail } from "./validate";

/** Devolve um inteiro em [1, faces]. Injetável para testes. */
export type Rng = (faces: number) => number;

export const cryptoRng: Rng = (faces) => randomInt(1, faces + 1);

type ParsedTerm =
  | { kind: "dice"; sign: 1 | -1; count: number; faces: number }
  | { kind: "const"; sign: 1 | -1; value: number };

const DICE_TERM = /^([+-]?)(\d*)d(\d+|%)$/;
const CONST_TERM = /^([+-]?)(\d+)$/;

/** Interpreta expressões como `1d20+5`, `2d6+1d4-1`, `d%`. */
export function parseExpression(raw: string): ParsedTerm[] {
  const { exprLength, terms: maxTerms, count: maxCount, faces, constant } = LIMITS.dice;
  if (typeof raw !== "string") fail("Expressão inválida.");
  const expr = raw.toLowerCase().replace(/\s+/g, "");
  if (!expr) fail("Digite uma rolagem, ex.: 1d20+5.");
  if (expr.length > exprLength) fail("Expressão longa demais.");

  const tokens = expr.match(/[+-]?[^+-]+/g) ?? [];
  if (tokens.join("") !== expr) fail(`Não entendi "${raw}". Use algo como 2d6+1d4+3.`);
  if (tokens.length > maxTerms) fail("Termos demais na rolagem.");

  let totalDice = 0;
  const terms = tokens.map((tok): ParsedTerm => {
    const dice = DICE_TERM.exec(tok);
    if (dice) {
      const count = dice[2] ? Number(dice[2]) : 1;
      const f = dice[3] === "%" ? 100 : Number(dice[3]);
      if (count < 1) fail("Quantidade de dados precisa ser pelo menos 1.");
      if (f < faces.min || f > faces.max) fail(`Dado d${f} não existe aqui (use d${faces.min} a d${faces.max}).`);
      totalDice += count;
      return { kind: "dice", sign: dice[1] === "-" ? -1 : 1, count, faces: f };
    }
    const c = CONST_TERM.exec(tok);
    if (c) {
      const value = Number(c[2]);
      if (value > constant) fail("Modificador grande demais.");
      return { kind: "const", sign: c[1] === "-" ? -1 : 1, value };
    }
    return fail(`Não entendi "${tok.replace(/^[+-]/, "")}". Use algo como 2d6+1d4+3.`);
  });

  if (!terms.some((t) => t.kind === "dice")) fail("A rolagem precisa de pelo menos um dado.");
  if (totalDice > maxCount) fail(`Dados demais (máximo ${maxCount}).`);
  return terms;
}

function formatTerm(t: ParsedTerm, first: boolean): string {
  const sign = t.sign < 0 ? "-" : first ? "" : "+";
  return sign + (t.kind === "dice" ? `${t.count}d${t.faces}` : String(t.value));
}

/** Rola a expressão. Vantagem/desvantagem vale para o primeiro 1d20 da expressão. */
export function roll(raw: string, mode: RollMode = "normal", rng: Rng = cryptoRng): RollResult {
  const parsed = parseExpression(raw);
  const advIndex = mode === "normal" ? -1 : parsed.findIndex((t) => t.kind === "dice" && t.count === 1 && t.faces === 20);
  if (mode !== "normal" && advIndex < 0) fail("Vantagem/desvantagem precisa de um 1d20 na rolagem.");

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
    const rolls = Array.from({ length: t.count }, () => rng(t.faces));
    total += t.sign * rolls.reduce((a, b) => a + b, 0);
    return { ...t, rolls };
  });

  return { expr: parsed.map((t, i) => formatTerm(t, i === 0)).join(""), mode, terms, total };
}
