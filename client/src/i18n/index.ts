import type { LogEntry } from "@rpg/shared";
import { create } from "zustand";
import { en } from "./en";
import { es } from "./es";
import { SERVER_TEXT } from "./serverText";
import { ptBR, type MessageKey, type Messages } from "./pt-BR";

/**
 * Tradução da interface. O português é a fonte (pt-BR.ts); inglês e espanhol traduzem as mesmas
 * chaves e, no que faltar, aparece o português. O idioma é de cada navegador: começa no do sistema
 * e a pessoa troca no menu de idioma. As recusas e os avisos automáticos do log vêm do servidor em
 * português, com o modelo e os valores, e são traduzidos aqui (`localizeServer`).
 */

export type Lang = "pt-BR" | "en" | "es";
export type { MessageKey };

/** Nome de cada idioma escrito nele mesmo (para quem não lê o atual achar o seu). */
export const LANGS: Record<Lang, string> = { "pt-BR": "Português", en: "English", es: "Español" };

const CATALOGS: Record<Lang, Partial<Messages>> = { "pt-BR": ptBR, en, es };
const KEY = "rpg.lang";

function detect(): Lang {
  try {
    const saved = localStorage.getItem(KEY);
    if (saved && saved in LANGS) return saved as Lang;
  } catch {
    // sem armazenamento: segue pelo navegador
  }
  for (const l of navigator.languages ?? [navigator.language]) {
    const base = l.toLowerCase().slice(0, 2);
    if (base === "pt") return "pt-BR";
    if (base === "en" || base === "es") return base;
  }
  return "pt-BR";
}

export const useLang = create<{ lang: Lang }>(() => ({ lang: detect() }));
document.documentElement.lang = useLang.getState().lang;

export function setLang(lang: Lang) {
  useLang.setState({ lang });
  document.documentElement.lang = lang;
  try {
    localStorage.setItem(KEY, lang);
  } catch {
    // vale só nesta aba
  }
}

/** Texto no idioma atual; `{nome}` vira `params.nome`. Fora de componentes (avisos, confirmações) também serve. */
export function t(key: MessageKey, params?: Record<string, string | number>): string {
  const msg = CATALOGS[useLang.getState().lang][key] ?? ptBR[key];
  return params ? msg.replace(/\{(\w+)\}/g, (m, name: string) => (name in params ? String(params[name]) : m)) : msg;
}

/** Em componentes: redesenha quando o idioma muda. */
export function useT() {
  useLang((s) => s.lang);
  return t;
}

/** O texto de uma chave em todos os idiomas (para reconhecer o que foi digitado em qualquer um). */
export function allLabels(key: MessageKey): string[] {
  return Object.values(CATALOGS).map((c) => c[key] ?? ptBR[key]);
}

/**
 * Texto do servidor (recusa ou aviso do log) no idioma de quem lê: o modelo (`key`, ou o próprio texto)
 * é procurado no catálogo e os valores que forem rótulos conhecidos ("Vida", "Mestre", "Caído") também são
 * traduzidos. Sem tradução, fica o texto em português que o servidor mandou.
 */
export function localizeServer(text: string, key?: string, params?: Record<string, string | number>): string {
  const lang = useLang.getState().lang;
  if (lang === "pt-BR") return text;
  const i = lang === "en" ? 0 : 1;
  const tr = (s: string) => SERVER_TEXT[s]?.[i];
  const msg = tr(key ?? text);
  if (!msg) return text;
  const values = params ?? {};
  return msg.replace(/\{(\w+)\}/g, (m, k: string) => {
    if (!(k in values)) return m;
    const v = values[k];
    return typeof v === "string" ? (tr(v) ?? v) : String(v);
  });
}

/** Recusa do servidor no idioma de quem lê. */
export function localizeError(res: { error: string; errorKey?: string; errorParams?: Record<string, string | number> }): string {
  return localizeServer(res.error, res.errorKey, res.errorParams);
}

/** Aviso automático do log no idioma de quem lê (logs antigos, sem modelo, ficam como vieram). */
export function logText(e: LogEntry): string {
  return localizeServer(e.text, e.textKey, e.textParams);
}

/** Rótulo da rolagem ("Reação · Ataque · Secreto") no idioma de quem lê, pedaço por pedaço. */
export function logLabel(e: LogEntry): string | undefined {
  if (!e.labelParts) return e.label;
  return e.labelParts.map((p) => localizeServer(fill(p.key, p.params), p.key, p.params)).join(" · ");
}

function fill(template: string, params?: Record<string, string | number>): string {
  return params ? template.replace(/\{(\w+)\}/g, (m, k: string) => (k in params ? String(params[k]) : m)) : template;
}
