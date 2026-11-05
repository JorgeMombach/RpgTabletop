// Importar fichas de arquivo (Fase 4, docs/design/salvar-importar.md): personagens (jogador e mestre) e monstros (mestre).
import { randomUUID } from "node:crypto";
import {
  CHARACTER_SHEET_KEYS,
  NAME_MAX_LENGTH,
  SPELL_LEVELS,
  blockedCells,
  footprint,
  nearestFreeSpot,
  sharesCell,
  sizeSpan,
  characterSheet,
  sameSheet,
  templateSheet,
  type CharacterSheet,
  type Combatant,
  type MobTemplate,
  type SheetCheckItem,
  type SheetCheckStatus,
  type SheetImportChoice,
  type SheetKind,
} from "@rpg/shared";
import { allCombatants } from "../combat";
import { parseSheetFile } from "../session-file";
import type { ServerPlayer, Store } from "../store";
import { fail } from "../validate";
import { requireGm } from "./combatants";
import { logSystem, whoIs } from "./dice";
import type { HandlerMap } from "./types";

/** Máximos da mesa (os mesmos do arquivo de sessão). */
const MAX_ALLIES = 200;
const MAX_TEMPLATES = 500;

type Planned =
  | { kind: "characters"; sheet: CharacterSheet; status: SheetCheckStatus; target?: Combatant; canCopy: boolean }
  | { kind: "monsters"; sheet: MobTemplate; status: SheetCheckStatus; target?: MobTemplate; canCopy: boolean };

/** Ids já usados por combatentes, em qualquer cena. */
function usedIds(store: Store): Set<string> {
  const { allies, battle, scenes } = store.game;
  return new Set([...allies, ...battle.mobs, ...battle.npcs, ...scenes.flatMap((sc) => (sc.stored ? [...sc.stored.mobs, ...sc.stored.npcs] : []))].map((c) => c.id));
}

/**
 * Compara cada ficha do arquivo com a mesa, sem alterar nada. Personagem: pelo id, se for de quem importa
 * (o mestre, qualquer um); o personagem principal do jogador bate com o dele mesmo com outro id.
 * Id de personagem de outro jogador conta como novo (entra com id novo).
 */
function plan(store: Store, player: ServerPlayer, raw: unknown): Planned[] {
  const parsed = parseSheetFile(raw);
  const gm = player.role === "gm";
  if (parsed.kind === "monsters") {
    requireGm(player);
    return parsed.items.map((sheet) => {
      const target = store.game.templates.find((t) => t.id === sheet.id);
      const status: SheetCheckStatus = !target ? "new" : sameSheet(templateSheet(target), sheet) ? "same" : "differs";
      return { kind: "monsters", sheet, status, target, canCopy: true };
    });
  }
  const { allies } = store.game;
  const main = gm ? undefined : allies.find((a) => a.ownerId === player.id && !a.summonerId);
  // Um personagem só por jogador (invocações não contam), como no "ally:create".
  if (!gm && (parsed.items as CharacterSheet[]).filter((i) => !i.summon).length > 1) fail("Você já tem um personagem: o arquivo traz mais de um.");
  let newMain = false;
  return (parsed.items as CharacterSheet[]).map((item) => {
    // Notas do mestre só entram pelo mestre (o jogador não escreve notas, ADR das permissões).
    const sheet = gm ? item : characterSheet(item, false);
    const own = allies.find((a) => a.id === sheet.id && (gm || a.ownerId === player.id));
    const target = own ?? (!gm && !sheet.summon ? main : undefined);
    if (target) {
      const status: SheetCheckStatus = sameSheet({ ...characterSheet(target, gm), summon: sheet.summon }, sheet) ? "same" : "differs";
      // Jogador não fica com dois personagens: o principal só substitui.
      return { kind: "characters", sheet, status, target, canCopy: gm || !!sheet.summon };
    }
    if (!gm) {
      if (sheet.summon && !main && !newMain) fail("Importe primeiro o seu personagem: a invocação fica ligada a ele.");
      if (!sheet.summon) newMain = true;
    }
    return { kind: "characters", sheet, status: "new", canCopy: true };
  });
}

/** Conferência para a janela de importar (`sheets:check`): o que é novo, igual ou diferente, com a ficha da mesa para mostrar a diferença. */
export function checkSheets(store: Store, player: ServerPlayer, raw: unknown): { kind: SheetKind; items: SheetCheckItem[] } {
  const items = plan(store, player, raw);
  const gm = player.role === "gm";
  return {
    kind: items[0].kind,
    items: items.map((p) => ({
      sheet: p.sheet,
      status: p.status,
      canCopy: p.canCopy,
      ...(p.target && { table: p.kind === "characters" ? characterSheet(p.target, gm) : templateSheet(p.target) }),
    })),
  };
}

/** "Thorin (2)", sem passar do tamanho do nome. */
function copyName(name: string): string {
  return `${name.slice(0, NAME_MAX_LENGTH - 4)} (2)`;
}

/** Personagem novo a partir da ficha: vida cheia, sem condições, fora do mapa. */
function allyFromSheet(sheet: CharacterSheet, id: string, ownerId: string, summonerId?: string): Combatant {
  const { summon: _summon, ...rest } = structuredClone(sheet);
  return { ...rest, id, type: "ally", ownerId, hp: rest.hpMax, pos: null, initiative: null, initRoll: null, conditions: [], ...(summonerId && { summonerId }) };
}

/**
 * Troca só a ficha: o estado de batalha continua (posição, condições, iniciativa), com a vida atual e os gastos
 * limitados aos máximos novos. `keepNotes`: as notas do mestre que já estavam ficam (jogador substituindo).
 */
function replaceSheet(store: Store, target: Combatant, sheet: CharacterSheet, keepNotes: boolean) {
  const { spellSlots: oldSlots, resources: oldResources, gmNotes, size: oldSize } = target;
  for (const key of CHARACTER_SHEET_KEYS) delete target[key];
  const { summon: _summon, id: _id, ...rest } = structuredClone(sheet);
  Object.assign(target, rest);
  if (keepNotes) {
    if (gmNotes) target.gmNotes = gmNotes;
    else delete target.gmNotes;
  }
  target.hp = Math.min(target.hp, target.hpMax);
  if (target.spellSlots && oldSlots) {
    for (const level of SPELL_LEVELS) target.spellSlots[level].used = Math.min(oldSlots[level]?.used ?? 0, target.spellSlots[level].max);
  }
  for (const r of target.resources ?? []) r.used = Math.min(oldResources?.find((o) => o.id === r.id)?.used ?? 0, r.max);
  // Cresceu no mapa e passaria a encostar em alguém: só ele vai para a casa livre mais próxima (ninguém é empurrado).
  if (target.pos && sizeSpan(target.size) > sizeSpan(oldSize) && !sharesCell(target.size)) {
    const others = blockedCells(allCombatants(store).filter((c) => c !== target));
    const taken = new Set(others.map((p) => `${p.col},${p.row}`));
    const span = sizeSpan(target.size);
    if (footprint(target.pos, span).some((c) => taken.has(`${c.col},${c.row}`))) target.pos = nearestFreeSpot(target.pos, others, span);
  }
}

export const sheetFileHandlers: HandlerMap = {
  "sheets:import": (store, player, payload) => {
    const items = plan(store, player, payload?.file);
    const choices = payload?.choices ?? {};
    // Tudo conferido antes de mexer: escolha faltando ou proibida recusa o arquivo inteiro.
    const picks = items.map((p): SheetImportChoice | "new" => {
      if (p.status === "same") return "skip";
      if (p.status === "new") return "new";
      const c = choices[p.sheet.id];
      if (c !== "replace" && c !== "copy" && c !== "skip") fail("Escolha o que fazer com {name}.", { name: p.sheet.name });
      if (c === "copy" && !p.canCopy) fail("Você já tem um personagem: {name} só pode substituir o seu.", { name: p.sheet.name });
      return c;
    });
    const adding = picks.filter((c) => c === "new" || c === "copy").length;
    const gm = player.role === "gm";
    const ids: string[] = [];

    if (items[0].kind === "monsters") {
      const { templates } = store.game;
      if (templates.length + adding > MAX_TEMPLATES) fail("O bestiário passaria de {n} modelos.", { n: MAX_TEMPLATES });
      items.forEach((p, i) => {
        const sheet = structuredClone(p.sheet as MobTemplate);
        const pick = picks[i];
        if (pick === "new") templates.push(sheet);
        else if (pick === "copy") templates.push({ ...sheet, id: randomUUID(), name: copyName(sheet.name) });
        else if (pick === "replace") templates[templates.indexOf(p.target as MobTemplate)] = sheet;
        else return;
        ids.push(pick === "copy" ? templates[templates.length - 1].id : sheet.id);
      });
      return ids;
    }

    const { allies } = store.game;
    if (allies.length + adding > MAX_ALLIES) fail("A mesa passaria de {n} personagens.", { n: MAX_ALLIES });
    const taken = usedIds(store);
    // Invocação do jogador fica ligada ao personagem dele (o que já tem ou o que entra agora).
    let mainId = gm ? undefined : allies.find((a) => a.ownerId === player.id && !a.summonerId)?.id;
    const created: { ally: Combatant; summon: boolean }[] = [];
    items.forEach((p, i) => {
      const sheet = p.sheet as CharacterSheet;
      const pick = picks[i];
      if (pick === "new" || pick === "copy") {
        // Fica com o id do arquivo (continua comparável depois), se estiver livre.
        const id = pick === "new" && !taken.has(sheet.id) ? sheet.id : randomUUID();
        taken.add(id);
        const ally = allyFromSheet(pick === "copy" ? { ...sheet, name: copyName(sheet.name) } : sheet, id, player.id);
        if (!gm && !sheet.summon) mainId = id;
        created.push({ ally, summon: !!sheet.summon });
        ids.push(id);
      } else if (pick === "replace") {
        const target = p.target as Combatant;
        if (!gm) {
          store.sheetUndo.set(target.id, characterSheet(target));
          logSystem(store, "{who} substituiu {name} pela ficha do arquivo.", { who: whoIs(store, player), name: target.name, id: target.id });
        }
        replaceSheet(store, target, sheet, !gm);
        ids.push(target.id);
      }
    });
    for (const { ally, summon } of created) {
      if (!gm && summon && mainId) ally.summonerId = mainId;
      allies.push(ally);
    }
    return ids;
  },

  "sheet:undo": (store, player, payload) => {
    requireGm(player);
    const id = payload?.id;
    const prev = (typeof id === "string" && store.sheetUndo.get(id)) || fail("Não há ficha anterior para voltar.");
    const ally = store.game.allies.find((a) => a.id === id) ?? fail("Personagem não encontrado.");
    replaceSheet(store, ally, prev, false);
    store.sheetUndo.delete(ally.id);
    logSystem(store, "O mestre voltou a ficha anterior de {name}.", { name: ally.name });
    return [ally.id];
  },
};
