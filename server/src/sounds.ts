import fs from "node:fs";
import path from "node:path";
import { LIMITS } from "@rpg/shared";
import { fail } from "./validate";

/**
 * Biblioteca de sons do mestre (E25): os arquivos de áudio de uma pasta da máquina dele
 * (no app, Documentos/Jamal's Tabletop/Sons). O app só lê a pasta e grava o que o mestre
 * adicionar por ele; nada do jogo vai para o disco (ADR-04).
 */

/** Formatos que os navegadores tocam. */
const AUDIO = new Map([
  [".mp3", "audio/mpeg"],
  [".ogg", "audio/ogg"],
  [".oga", "audio/ogg"],
  [".opus", "audio/ogg"],
  [".wav", "audio/wav"],
  [".m4a", "audio/mp4"],
  [".aac", "audio/aac"],
  [".webm", "audio/webm"],
  [".flac", "audio/flac"],
]);

export function audioType(name: string): string | undefined {
  return AUDIO.get(path.extname(name).toLowerCase());
}

/** Arquivos de áudio da pasta, em ordem alfabética. Pasta inexistente = biblioteca vazia. */
export function listSounds(dir: string): string[] {
  let entries: fs.Dirent[];
  try {
    entries = fs.readdirSync(dir, { withFileTypes: true });
  } catch {
    return [];
  }
  return entries
    .filter((e) => e.isFile() && audioType(e.name))
    .map((e) => e.name)
    .sort((a, b) => a.localeCompare(b, "pt-BR"))
    .slice(0, LIMITS.soundLibrary);
}

/**
 * Caminho de um arquivo da biblioteca, só se o nome for um arquivo de áudio direto da pasta
 * (sem "..", sem subpasta). Devolve `null` se não servir.
 */
export function soundPath(dir: string, name: string): string | null {
  if (!name || name !== path.basename(name) || name.startsWith(".") || !audioType(name)) return null;
  return path.join(dir, name);
}

/** Nome seguro para gravar: sem caracteres proibidos no Windows, sem pasta, sem repetir um existente. */
function safeName(dir: string, raw: string): string {
  const base = path.basename(raw).replace(/[<>:"/\\|?*\u0000-\u001f]/g, "_").trim().slice(0, LIMITS.soundName);
  const ext = path.extname(base);
  if (!audioType(base) || base.length === ext.length) fail("Use um arquivo de áudio (MP3, OGG, WAV, M4A, WEBM ou FLAC).");
  let name = base;
  for (let i = 2; fs.existsSync(path.join(dir, name)); i++) name = `${base.slice(0, -ext.length)} (${i})${ext}`;
  return name;
}

/** Grava um arquivo enviado pelo mestre na pasta de sons; devolve o nome final. */
export function saveSound(dir: string, rawName: unknown, data: unknown): string {
  if (typeof rawName !== "string") fail("Arquivo sem nome.");
  const bytes = Buffer.isBuffer(data) ? data : data instanceof ArrayBuffer ? Buffer.from(data) : fail("Arquivo inválido.");
  if (bytes.length === 0) fail("Arquivo vazio.");
  if (bytes.length > LIMITS.soundBytes) fail("Arquivo grande demais (máximo {mb} MB).", { mb: Math.round(LIMITS.soundBytes / 1024 / 1024) });
  fs.mkdirSync(dir, { recursive: true });
  const name = safeName(dir, rawName);
  fs.writeFileSync(path.join(dir, name), bytes);
  return name;
}
