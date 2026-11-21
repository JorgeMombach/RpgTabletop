// Salvar a sessão em arquivo (E18) e o controle de "alterações não salvas", usados pelo painel Sessão
// e pelo aviso ao fechar o app do mestre (E12).
import type { ClientState, JournalEntry, SessionExportResult } from "@rpg/shared";
import { localizeError, t } from "./i18n";
import { socket } from "./socket";
import { useApp } from "./store";

/** Ponte do app do mestre (Electron, `desktop/src/preload.ts`); `undefined` no navegador. */
export interface DesktopBridge {
  guardClose(onRequest: () => void): void;
  confirmClose(): void;
  saveSession(json: string, fileName: string): Promise<{ ok: boolean }>;
  openSoundsFolder(): void;
}

export const desktop = (window as unknown as { desktop?: DesktopBridge }).desktop;

/** "jamals-tabletop-2026-10-24-2130.json" */
export function sessionFileName(date = new Date()) {
  const p = (n: number) => String(n).padStart(2, "0");
  return `jamals-tabletop-${date.getFullYear()}-${p(date.getMonth() + 1)}-${p(date.getDate())}-${p(date.getHours())}${p(date.getMinutes())}.json`;
}

/**
 * O que vai para o arquivo; jogadores entrando e saindo não contam como alteração. O diário chega à parte (Passo 14).
 * Campo novo do jogo que vai no arquivo de sessão e chega ao mestre entra aqui também, senão mexer só nele não acende o "Não salvo".
 */
function snapshot(s: ClientState | null, journal: JournalEntry[]): string {
  if (!s) return "";
  return JSON.stringify([s.templates, s.allies, s.battle, s.log, s.sceneId, s.scenes, s.rules, s.lootSeconds, s.tables, s.clock, journal]);
}

/** Nada que valha salvar ainda (mesa vazia). */
function empty(s: ClientState | null, journal: JournalEntry[]): boolean {
  return !s || (s.allies.length + s.templates.length + s.battle.mobs.length + s.battle.npcs.length + s.tables.length + journal.length === 0 && !s.battle.map.hasImage);
}

export function isUnsaved(state: ClientState | null, journal: JournalEntry[], savedSnapshot: string | null): boolean {
  return !empty(state, journal) && snapshot(state, journal) !== savedSnapshot;
}

/** O estado que está na mesa agora conta como salvo (depois de salvar ou carregar um arquivo). */
export function markSaved(at = new Date()) {
  useApp.setState((s) => ({ savedSnapshot: snapshot(s.state, s.journal), savedAt: at }));
}

function download(name: string, content: string) {
  const url = URL.createObjectURL(new Blob([content], { type: "application/json" }));
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  a.click();
  URL.revokeObjectURL(url);
}

/** Grava um JSON: no app do mestre, pelo "Salvar como" do sistema; no navegador, como download. `false` se cancelou. */
export async function saveJson(name: string, json: string): Promise<boolean> {
  if (desktop) return (await desktop.saveSession(json, name)).ok;
  download(name, json);
  return true;
}

/**
 * Pede o arquivo ao servidor e grava: no app do mestre, pelo "Salvar como" do sistema; no navegador, como download.
 * Devolve `false` se o mestre cancelar. Lança `Error` com mensagem pronta se o servidor recusar ou não responder.
 */
export async function saveSessionFile(): Promise<boolean> {
  let res: SessionExportResult;
  try {
    res = await socket.timeout(30_000).emitWithAck("session:export");
  } catch {
    throw new Error(t("common.noServer"));
  }
  if (!res.ok) throw new Error(localizeError(res));
  const json = JSON.stringify(res.file);
  const name = sessionFileName();
  if (desktop) {
    if (!(await desktop.saveSession(json, name)).ok) return false;
  } else {
    download(name, json);
  }
  markSaved();
  return true;
}
