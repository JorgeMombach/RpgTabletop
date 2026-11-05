// Fichas em arquivo (Fase 4, docs/design/salvar-importar.md): baixar e importar personagens e monstros.
import {
  APP_VERSION,
  SHEET_FILE_FORMAT,
  characterSheet,
  sheetFileName,
  templateFromCombatant,
  templateSheet,
  type Combatant,
  type MobTemplate,
  type SheetCheckItem,
  type SheetCheckResult,
  type SheetFile,
  type SheetImportChoice,
  type SheetKind,
} from "@rpg/shared";
import { create } from "zustand";
import { act } from "./actions";
import { localizeError, t } from "./i18n";
import { toast } from "./notify";
import { saveJson } from "./sessionFile";
import { socket } from "./socket";

function fileOf(kind: SheetKind, items: SheetFile["items"]): SheetFile {
  return { app: "jamals-tabletop", kind, format: SHEET_FILE_FORMAT, appVersion: APP_VERSION, savedAt: new Date().toISOString(), items };
}

/** Baixa a ficha de personagens (aliados, invocações, pets). `gm`: com as notas do mestre. */
export async function downloadCharacters(list: Combatant[], label: string, gm: boolean) {
  await saveJson(sheetFileName(label), JSON.stringify(fileOf("characters", list.map((c) => characterSheet(c, gm)))));
}

/** Baixa monstros como modelos do bestiário (do bestiário ou mobs e NPCs do mapa). */
export async function downloadMonsters(list: (MobTemplate | Combatant)[], label: string) {
  const items = list.map((x) => ("type" in x ? templateFromCombatant(x) : templateSheet(x)));
  await saveJson(sheetFileName(label), JSON.stringify(fileOf("monsters", items)));
}

/** Arquivo conferido esperando a escolha na janela de importar. */
export interface PendingImport {
  file: unknown;
  kind: SheetKind;
  items: SheetCheckItem[];
}

export const useSheetImport = create<{ pending: PendingImport | null }>(() => ({ pending: null }));

/**
 * Lê o arquivo escolhido e confere com o servidor. Sem nada diferente da mesa, importa direto;
 * com diferenças, abre a janela (SheetImportModal) para escolher.
 */
export async function openSheetFile(f: File | null) {
  if (!f) return;
  let file: unknown;
  try {
    file = JSON.parse(await f.text());
  } catch {
    return toast({ kind: "error", text: t("sheetFile.notJson") });
  }
  let res: SheetCheckResult;
  try {
    res = await socket.timeout(30_000).emitWithAck("sheets:check", file);
  } catch {
    return toast({ kind: "error", text: t("common.noServer") });
  }
  if (!res.ok) return toast({ kind: "error", text: localizeError(res) });
  if (res.items.some((i) => i.status === "differs")) {
    useSheetImport.setState({ pending: { file, kind: res.kind, items: res.items } });
    return;
  }
  await importSheets(file, res.items, {});
}

/** Importa de fato e avisa o resultado. */
export async function importSheets(file: unknown, items: SheetCheckItem[], choices: Record<string, SheetImportChoice>): Promise<boolean> {
  const changed = items.filter((i) => i.status === "new" || (i.status === "differs" && choices[i.sheet.id] !== "skip")).length;
  if (changed === 0) {
    toast({ kind: "info", text: t(items.length === 1 ? "sheetFile.sameOne" : "sheetFile.sameAll", { name: items[0].sheet.name }) });
    return true;
  }
  const res = await act("sheets:import", { file, choices });
  if (!res.ok) return false;
  toast({ kind: "success", text: changed === 1 ? t("sheetFile.importedOne", { name: items.find((i) => i.status !== "same" && choices[i.sheet.id] !== "skip")!.sheet.name }) : t("sheetFile.importedMany", { n: changed }) });
  return true;
}
