// Diário da campanha (Passo 14, docs/design/diario.md): o que chega do servidor e a marca de novidade do jogador.
import type { JournalEntry } from "@rpg/shared";
import { create } from "zustand";
import { t } from "./i18n";
import { toast } from "./notify";
import { useApp } from "./store";

const SEEN_KEY = "journal.seenAt";

function readSeen(): number {
  try {
    const n = Number(localStorage.getItem(SEEN_KEY));
    return Number.isFinite(n) ? n : 0;
  } catch {
    return 0;
  }
}

/** Até onde esta pessoa já leu o diário (maior `updatedAt` visto), guardado neste navegador. */
export const useJournalSeen = create<{ seenAt: number }>(() => ({ seenAt: readSeen() }));

/** Alguma entrada mudou depois da última leitura. */
export function hasNews(entries: JournalEntry[], seenAt: number): boolean {
  return entries.some((e) => e.updatedAt > seenAt);
}

/** Abriu o diário: tudo o que está nele conta como lido. */
export function markJournalRead(entries: JournalEntry[]): void {
  const seenAt = Math.max(useJournalSeen.getState().seenAt, ...entries.map((e) => e.updatedAt));
  useJournalSeen.setState({ seenAt });
  try {
    localStorage.setItem(SEEN_KEY, String(seenAt));
  } catch {
    // Sem armazenamento (janela anônima): a bolinha volta ao recarregar, nada mais.
  }
}

/** O que acabou de ser liberado ou mudou. Primeira chegada (entrar, reconectar) não conta: só a bolinha avisa. */
export function newlyShared(prev: JournalEntry[] | null, next: JournalEntry[]): JournalEntry[] {
  if (prev === null) return [];
  const before = new Map(prev.map((e) => [e.id, e.updatedAt]));
  return next.filter((e) => (before.get(e.id) ?? -1) < e.updatedAt);
}

/** Chegou o diário: guarda e, para o jogador, avisa o que é novo (até 3 avisos; mais que isso, um só). */
export function receiveJournal(entries: JournalEntry[]) {
  const { journalLoaded, journal: prev, state } = useApp.getState();
  useApp.setState({ journal: entries, journalLoaded: true });
  if (state?.self.role === "gm") return;
  const fresh = newlyShared(journalLoaded ? prev : null, entries);
  if (fresh.length > 3) toast({ kind: "info", text: t("journal.newsMany", { n: fresh.length }) });
  else for (const e of fresh) toast({ kind: "info", text: t("journal.news", { title: e.title }) });
}
