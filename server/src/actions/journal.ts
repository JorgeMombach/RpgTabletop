// Diário da campanha (Passo 14, docs/design/diario.md): o mestre cria, edita, libera e apaga entradas.
import { randomUUID } from "node:crypto";
import { JOURNAL_TAGS, LIMITS, type JournalEntry, type JournalTag } from "@rpg/shared";
import type { Store } from "../store";
import { fail, requireInt } from "../validate";
import { requireGm } from "./combatants";
import type { HandlerMap } from "./types";

/** Uma linha: espaços repetidos viram um. */
const line = (raw: unknown, max: number) => (typeof raw === "string" ? raw.replace(/\s+/g, " ").trim().slice(0, max + 1) : "");
/** Texto corrido: mantém as quebras de linha (no formato \n), tira o espaço das pontas. */
const block = (raw: unknown, max: number) => (typeof raw === "string" ? raw.replace(/\r\n?/g, "\n").trim().slice(0, max + 1) : "");

/** Confere uma entrada como o mestre a mandou (ação ou arquivo de sessão). Vazios e falsos ficam ausentes. */
export function parseJournalEntry(raw: unknown): Omit<JournalEntry, "id" | "updatedAt"> {
  const e = (raw ?? {}) as Record<string, unknown>;
  const title = line(e.title, LIMITS.journalTitle);
  if (!title) fail("Dê um título à entrada.");
  if (title.length > LIMITS.journalTitle) fail("Título: até {n} letras.", { n: LIMITS.journalTitle });
  if (!(JOURNAL_TAGS as readonly unknown[]).includes(e.tag)) fail("Etiqueta inválida.");
  const tag = e.tag as JournalTag;
  const text = block(e.text, LIMITS.journalText);
  if (text.length > LIMITS.journalText) fail("Texto: até {n} letras.", { n: LIMITS.journalText });
  const note = block(e.note, LIMITS.journalNote);
  if (note.length > LIMITS.journalNote) fail("Nota: até {n} letras.", { n: LIMITS.journalNote });
  if (e.done === true && tag !== "quest") fail("Só uma missão pode ser concluída.");
  const day = e.day === undefined || e.day === null ? undefined : requireInt(e.day, "Dia", 1, LIMITS.clockDay);
  return {
    title,
    tag,
    text,
    ...(note && { note }),
    ...(e.shared === true && { shared: true }),
    ...(e.done === true && { done: true }),
    ...(day !== undefined && { day }),
  };
}

export function findEntry(store: Store, id: unknown): JournalEntry {
  return store.game.journal.find((e) => e.id === id) ?? fail("Essa entrada do diário não existe mais.");
}

/** Marca a mudança: a entrada fica com a hora de agora e o diário é reenviado. */
function touch(store: Store, entry: JournalEntry) {
  entry.updatedAt = Date.now();
  store.journalVersion++;
}

export const journalHandlers: HandlerMap = {
  "journal:upsert": (store, player, payload) => {
    requireGm(player);
    const parsed = parseJournalEntry(payload);
    const current = payload.id === undefined ? undefined : findEntry(store, payload.id);
    if (current) {
      // Substitui por inteiro: o que veio vazio (nota, dia, liberada) deixa de existir.
      const edited: JournalEntry = { id: current.id, ...parsed, updatedAt: 0 };
      store.game.journal = store.game.journal.map((e) => (e === current ? edited : e));
      touch(store, edited);
      return [edited.id];
    }
    if (store.game.journal.length >= LIMITS.journal) fail("Limite de {n} entradas no diário.", { n: LIMITS.journal });
    const entry: JournalEntry = { id: randomUUID(), ...parsed, updatedAt: 0 };
    store.game.journal.push(entry);
    touch(store, entry);
    return [entry.id];
  },

  "journal:share": (store, player, payload) => {
    requireGm(player);
    const entry = findEntry(store, payload?.id);
    // Mesmo valor: nada muda (subir o updatedAt avisaria os jogadores de novo).
    if ((payload.shared === true) === (entry.shared === true)) return;
    if (payload.shared === true) entry.shared = true;
    else delete entry.shared;
    touch(store, entry);
  },

  "journal:remove": (store, player, payload) => {
    requireGm(player);
    const entry = findEntry(store, payload?.id);
    store.game.journal = store.game.journal.filter((e) => e !== entry);
    store.journalVersion++;
  },
};
