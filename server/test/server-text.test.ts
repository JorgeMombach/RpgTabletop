import assert from "node:assert/strict";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, it } from "node:test";

/*
 * Todo texto do servidor tem tradução no catálogo do cliente (client/src/i18n/serverText.ts). Texto novo
 * sem tradução apareceria em português para quem joga em inglês ou espanhol: este teste avisa.
 * Varre o código atrás das recusas (fail("…"), { ok: false, error: "…" }, travas de vez, campos vazios),
 * dos avisos do log (logSystem(store, "…") e pedaços { key: "…" } do rótulo das rolagens) e dos rótulos
 * que entram como parâmetro (require*(x, "Vida"), "Arquivo inválido: mapa").
 */
const HERE = dirname(fileURLToPath(import.meta.url));
const SRC = join(HERE, "../src");
const CATALOG = join(HERE, "../../client/src/i18n/serverText.ts");

function files(dir: string): string[] {
  return readdirSync(dir).flatMap((f) => {
    const p = join(dir, f);
    return statSync(p).isDirectory() ? files(p) : p.endsWith(".ts") ? [p] : [];
  });
}

const STR = `"((?:[^"\\\\]|\\\\.)*)"`;
const unquote = (s: string) => JSON.parse(`"${s}"`) as string;

function serverMessages(): Set<string> {
  const out = new Set<string>();
  for (const f of files(SRC)) {
    const s = readFileSync(f, "utf8");
    const add = (re: RegExp) => {
      for (const m of s.matchAll(re)) out.add(unquote(m[1]));
    };
    add(new RegExp(`fail\\(\\s*${STR}`, "g"));
    add(new RegExp(`fail\\([^"\\n]*\\? ${STR} : `, "g"));
    add(new RegExp(`ok: false, error: ${STR}`, "g"));
    // requireTurnFor(store, player, "moveOnTurn", "mensagem"): a mensagem é o segundo texto.
    add(new RegExp(`requireTurnFor\\([^"\\n]*"[A-Za-z]+", ${STR}`, "g"));
    add(new RegExp(`\\bline\\([^"\\n]*${STR}`, "g"));
    add(new RegExp(`require(?:Int|Number|String|Image)\\([^,()\\n]*(?:\\([^)]*\\))?[^,()\\n]*, ${STR}`, "g"));
    add(new RegExp(`findIn\\([^"\\n]*${STR}`, "g"));
    if (f.endsWith("session-file.ts")) add(new RegExp(`\\b(?:obj|list|int|bool|text|optText|nullableInt|offsetOf)\\([^,()\\n]*(?:\\([^)]*\\))?[^,()\\n]*, ${STR}`, "g"));
    // Avisos do log e pedaços do rótulo: todo texto entre `logSystem(store,` e os valores ({ … }),
    // e depois de `key:` (inclusive os dois lados de um "? :").
    // (o trecho pula strings inteiras: os modelos têm `{` dentro).
    const upTo = (stop: string) => `((?:"(?:[^"\\\\]|\\\\.)*"|[^"${stop}])*)`;
    // Só textos de verdade (com maiúscula, espaço ou `{`): `kind === "short"` e `key: "attacks"` são código.
    for (const seg of s.matchAll(new RegExp(`logSystem\\(\\s*store,${upTo("{;")}`, "g"))) {
      for (const m of seg[1].matchAll(new RegExp(STR, "g"))) if (/[A-ZÀ-Ú {]/.test(m[1])) out.add(unquote(m[1]));
    }
    for (const seg of s.matchAll(new RegExp(`\\bkey: ${upTo(",}\\n")}`, "g"))) {
      for (const m of seg[1].matchAll(new RegExp(STR, "g"))) if (/[A-ZÀ-Ú ]/.test(m[1])) out.add(unquote(m[1]));
    }
  }
  // Fim de efeitos e invocados (effects.ts): a frase é montada por partes, então a lista vai aqui.
  for (const caster of ["", " de {caster}"]) {
    for (const why of ["", " (concentração perdida)"]) {
      out.add(`{effect}${caster} acabou${why}.`);
      out.add(`{effect}${caster} acabou${why}; voltou a ser {before}.`);
    }
    for (const why of ["(concentração perdida)", "(duração acabou)"]) out.add(`{name}${caster} sumiu ${why}.`);
  }
  // Códigos de entrada (o cliente traduz pelo código) e o valor usado só para comparar.
  for (const code of ["invalid_name", "room_full"]) out.delete(code);
  return out;
}

function catalogKeys(): Set<string> {
  const s = readFileSync(CATALOG, "utf8");
  const keys = new Set<string>();
  for (const m of s.matchAll(new RegExp(`^\\s+(?:${STR}|([A-Za-zÀ-ú.]+)):\\s*\\[`, "gm"))) keys.add(m[1] !== undefined ? unquote(m[1]) : m[2]);
  return keys;
}

describe("textos do servidor", () => {
  it("toda recusa e todo aviso do log têm tradução", () => {
    const keys = catalogKeys();
    const missing = [...serverMessages()].filter((m) => !keys.has(m)).sort();
    assert.deepEqual(missing, [], `Sem tradução em client/src/i18n/serverText.ts:\n${missing.join("\n")}`);
  });
});
