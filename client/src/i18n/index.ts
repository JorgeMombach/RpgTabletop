import { create } from "zustand";
import { en } from "./en";
import { es } from "./es";
import { ptBR, type MessageKey, type Messages } from "./pt-BR";

/**
 * Tradução da interface. O português é a fonte (pt-BR.ts); inglês e espanhol traduzem as mesmas
 * chaves e, no que faltar, aparece o português. O idioma é de cada navegador: começa no do sistema
 * e a pessoa troca no menu de idioma. Mensagens do servidor (erros, avisos no log) ainda vêm em português.
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
