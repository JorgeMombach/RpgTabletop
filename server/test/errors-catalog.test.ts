import assert from "node:assert/strict";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, it } from "node:test";

/*
 * Toda recusa do servidor tem tradução no catálogo do cliente (client/src/i18n/errors.ts). Recusa nova
 * sem tradução apareceria em português para quem joga em inglês ou espanhol: este teste avisa.
 * Varre o código atrás das frases (fail("…"), { ok: false, error: "…" }, mensagens das travas de vez e
 * de campos vazios) e dos rótulos que entram como parâmetro (require*(x, "Vida"), "Arquivo inválido: mapa").
 */
const HERE = dirname(fileURLToPath(import.meta.url));
const SRC = join(HERE, "../src");
const CATALOG = join(HERE, "../../client/src/i18n/errors.ts");

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

describe("catálogo de erros", () => {
  it("toda recusa do servidor tem tradução", () => {
    const keys = catalogKeys();
    const missing = [...serverMessages()].filter((m) => !keys.has(m)).sort();
    assert.deepEqual(missing, [], `Sem tradução em client/src/i18n/errors.ts:\n${missing.join("\n")}`);
  });
});
