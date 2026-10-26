import { randomUUID } from "node:crypto";
import {
  APP_VERSION,
  EFFECT_PRESETS,
  LIMITS,
  SESSION_FILE_APP,
  SESSION_FILE_FORMAT,
  SPELL_LEVELS,
  isColor,
  type Combatant,
  type CombatState,
  type Condition,
  type EffectPreset,
  type EffectState,
  type GameState,
  type GridPos,
  type LogEntry,
  type MapEffect,
  type MobTemplate,
  type OutsideRolls,
  type RollResult,
  type Role,
  type RollTerm,
  type SessionFile,
  type Spell,
  type SpellLevel,
  type SpellSlot,
} from "@rpg/shared";
import { weatherFromFile } from "./actions/weather";
import type { ServerPlayer, Store } from "./store";
import { fail, requireImage, requireInt, requireName, requireNumber, requireString, validArea } from "./validate";

/** Estado atual em formato de arquivo (ADR-17). Sem tokens nem chave de mestre. */
export function exportSession(store: Store): SessionFile {
  return {
    app: SESSION_FILE_APP,
    format: SESSION_FILE_FORMAT,
    appVersion: APP_VERSION,
    savedAt: new Date().toISOString(),
    players: [...store.players.values()].map((p) => ({ id: p.id, name: p.name, role: p.role })),
    mobCounters: Object.fromEntries(store.mobCounters),
    game: {
      ...store.game,
      // Pedido de rolagem e reações valem só para o turno em que estavam.
      battle: { ...store.game.battle, rolls: { request: null, reactions: [], outside: store.game.battle.rolls.outside } },
    },
  };
}

// ---------- Validação ----------
// O arquivo vem de fora: cada campo é conferido e copiado; nada do objeto original é reaproveitado.

type Obj = Record<string, unknown>;

function obj(raw: unknown, what: string): Obj {
  if (typeof raw !== "object" || raw === null || Array.isArray(raw)) fail(`Arquivo inválido: ${what}.`);
  return raw as Obj;
}

function list(raw: unknown, what: string, max: number): unknown[] {
  if (!Array.isArray(raw)) fail(`Arquivo inválido: ${what}.`);
  if (raw.length > max) fail(`Arquivo inválido: ${what} demais.`);
  return raw;
}

function text(raw: unknown, what: string, max: number): string {
  if (typeof raw !== "string") fail(`Arquivo inválido: ${what}.`);
  return raw.slice(0, max);
}

function optText(raw: unknown, what: string, max: number): string | undefined {
  return raw === undefined ? undefined : text(raw, what, max);
}

function outsideRolls(raw: unknown): OutsideRolls {
  if (raw === undefined) return "free";
  return raw === "free" || raw === "request" || raw === "locked" ? raw : fail("Arquivo inválido: modo das rolagens.");
}

function bool(raw: unknown, what: string): boolean {
  if (typeof raw !== "boolean") fail(`Arquivo inválido: ${what}.`);
  return raw;
}

function int(raw: unknown, what: string, min: number, max: number): number {
  if (typeof raw !== "number" || !Number.isInteger(raw)) fail(`Arquivo inválido: ${what}.`);
  return requireInt(raw, what, min, max);
}

function nullableInt(raw: unknown, what: string, min: number, max: number): number | null {
  return raw === null ? null : int(raw, what, min, max);
}

function pos(raw: unknown): GridPos | null {
  if (raw === null) return null;
  const p = obj(raw, "posição");
  const lim = LIMITS.gridCoord;
  return { col: int(p.col, "posição", -lim, lim), row: int(p.row, "posição", -lim, lim) };
}

function condition(raw: unknown): Condition {
  const k = obj(raw, "condição");
  const { min, max } = LIMITS.conditionRounds;
  return {
    id: requireString(k.id, "Condição"),
    name: text(k.name, "condição", LIMITS.conditionName) || fail("Arquivo inválido: condição sem nome."),
    rounds: nullableInt(k.rounds, "duração da condição", min, max),
  };
}

function spellSlots(raw: unknown): Record<SpellLevel, SpellSlot> {
  const s = obj(raw, "slots de magia");
  const out = {} as Record<SpellLevel, SpellSlot>;
  for (const level of SPELL_LEVELS) {
    const slot = obj(s[level], "slots de magia");
    const max = int(slot.max, "slots de magia", 0, LIMITS.slotMax);
    out[level] = { max, used: int(slot.used, "slots usados", 0, max) };
  }
  return out;
}

function spell(raw: unknown): Spell {
  const s = obj(raw, "magia");
  const out: Spell = {
    id: requireString(s.id, "Magia"),
    name: text(s.name, "magia", LIMITS.spellName) || fail("Arquivo inválido: magia sem nome."),
    level: int(s.level, "nível da magia", 0, 9),
  };
  const note = optText(s.note, "nota da magia", LIMITS.spellNote);
  if (note) out.note = note;
  return out;
}

function combatant(raw: unknown, type: Combatant["type"]): Combatant {
  const c = obj(raw, "combatente");
  if (c.type !== type) fail("Arquivo inválido: tipo de combatente.");
  const hpMax = int(c.hpMax, "vida máxima", LIMITS.hpMax.min, LIMITS.hpMax.max);
  const out: Combatant = {
    id: requireString(c.id, "Combatente"),
    name: requireName(c.name),
    type,
    hp: int(c.hp, "vida", 0, hpMax),
    hpMax,
    dexMod: int(c.dexMod, "mod. DES", LIMITS.dexMod.min, LIMITS.dexMod.max),
    color: isColor(c.color) ? c.color : fail("Arquivo inválido: cor."),
    pos: pos(c.pos),
    initiative: nullableInt(c.initiative, "iniciativa", LIMITS.initiative.min, LIMITS.initiative.max),
    initRoll: nullableInt(c.initRoll, "dado da iniciativa", 1, 20),
    conditions: list(c.conditions ?? [], "condições", LIMITS.conditions).map(condition),
  };
  if (c.ownerId !== undefined) out.ownerId = requireString(c.ownerId, "Dono");
  if (c.templateId !== undefined) out.templateId = requireString(c.templateId, "Template");
  if (c.avatar !== undefined) out.avatar = requireImage(c.avatar, "Avatar", LIMITS.avatarChars);
  if (c.spellSlots !== undefined) out.spellSlots = spellSlots(c.spellSlots);
  if (c.spells !== undefined) out.spells = list(c.spells, "magias", LIMITS.spells).map(spell);
  // Marcas do E21: arquivos da 2.0 não têm (ausente = não).
  if (c.animal !== undefined && bool(c.animal, "animal")) out.animal = true;
  if (c.hidden !== undefined && bool(c.hidden, "oculto") && type !== "ally") out.hidden = true;
  if (c.summonerId !== undefined) out.summonerId = requireString(c.summonerId, "Conjurador");
  if (c.summonConcentration !== undefined && bool(c.summonConcentration, "concentração do conjurado")) out.summonConcentration = true;
  if (c.summonRounds !== undefined) out.summonRounds = int(c.summonRounds, "duração do conjurado", LIMITS.conditionRounds.min, LIMITS.conditionRounds.max);
  return out;
}

function template(raw: unknown): MobTemplate {
  const t = obj(raw, "template");
  const out: MobTemplate = {
    id: requireString(t.id, "Template"),
    name: requireName(t.name),
    hpMax: int(t.hpMax, "vida máxima", LIMITS.hpMax.min, LIMITS.hpMax.max),
    dexMod: int(t.dexMod, "mod. DES", LIMITS.dexMod.min, LIMITS.dexMod.max),
    color: isColor(t.color) ? t.color : fail("Arquivo inválido: cor."),
  };
  if (t.avatar !== undefined) out.avatar = requireImage(t.avatar, "Avatar", LIMITS.avatarChars);
  const notes = optText(t.notes, "notas", LIMITS.notes);
  if (notes) out.notes = notes;
  if (t.animal !== undefined && bool(t.animal, "animal")) out.animal = true;
  return out;
}

function effect(raw: unknown, combatantIds: Set<string>): MapEffect {
  const e = obj(raw, "efeito");
  const out: MapEffect = {
    id: requireString(e.id, "Efeito"),
    ...effectState(e, combatantIds),
    area: validArea(e.area) ?? fail("Arquivo inválido: área do efeito."),
    active: bool(e.active, "efeito ligado"),
  };
  // Estado de antes de "Transformar" (E24); arquivos da 2.x anteriores não têm.
  if (e.revertTo !== undefined) out.revertTo = effectState(obj(e.revertTo, "efeito"), combatantIds);
  return out;
}

/** Tipo, nome, cor, dono, conjurador, duração e concentração de um efeito (o atual ou o de antes). */
function effectState(e: Obj, combatantIds: Set<string>): EffectState {
  if (typeof e.preset !== "string" || !(e.preset in EFFECT_PRESETS)) fail("Arquivo inválido: efeito.");
  const casterId = e.casterId === null ? null : requireString(e.casterId, "Conjurador");
  if (casterId && !combatantIds.has(casterId)) fail("Arquivo inválido: conjurador de efeito não existe.");
  const { min, max } = LIMITS.conditionRounds;
  return {
    name: text(e.name, "efeito", LIMITS.effectName) || fail("Arquivo inválido: efeito sem nome."),
    preset: e.preset as EffectPreset,
    color: isColor(e.color) ? e.color : fail("Arquivo inválido: cor do efeito."),
    ownerId: requireString(e.ownerId, "Dono do efeito"),
    casterId,
    rounds: nullableInt(e.rounds, "duração do efeito", min, max),
    concentration: bool(e.concentration, "concentração"),
  };
}

function rollTerm(raw: unknown): RollTerm {
  const t = obj(raw, "rolagem");
  const sign = t.sign === -1 ? -1 : t.sign === 1 ? 1 : fail("Arquivo inválido: rolagem.");
  if (t.kind === "const") return { kind: "const", sign, value: int(t.value, "rolagem", 0, LIMITS.dice.constant) };
  if (t.kind !== "dice") fail("Arquivo inválido: rolagem.");
  const faces = int(t.faces, "rolagem", 1, LIMITS.dice.faces.max);
  const rolls = list(t.rolls, "rolagem", LIMITS.dice.count).map((v) => int(v, "rolagem", 1, faces));
  const term: RollTerm = { kind: "dice", sign, count: int(t.count, "rolagem", 1, LIMITS.dice.count), faces, rolls };
  if (t.keptIndex !== undefined) term.keptIndex = int(t.keptIndex, "rolagem", 0, rolls.length - 1);
  return term;
}

function rollResult(raw: unknown): RollResult {
  const r = obj(raw, "rolagem");
  const mode = r.mode === "adv" || r.mode === "dis" || r.mode === "normal" ? r.mode : fail("Arquivo inválido: rolagem.");
  return {
    expr: text(r.expr, "rolagem", LIMITS.dice.exprLength),
    mode,
    terms: list(r.terms, "rolagem", LIMITS.dice.terms).map(rollTerm),
    total: requireNumber(r.total, "Rolagem", -1e9, 1e9),
  };
}

function logEntry(raw: unknown): LogEntry {
  const e = obj(raw, "log");
  const out: LogEntry = {
    id: requireString(e.id, "Log"),
    ts: requireNumber(e.ts, "Log", 0, 1e14),
    authorId: requireString(e.authorId, "Log"),
    author: text(e.author, "log", 64),
    text: text(e.text, "log", 500),
  };
  if (e.hidden === true) out.hidden = true;
  if (e.system === true) out.system = true;
  if (e.crit === true) out.crit = true;
  const label = optText(e.label, "log", 80);
  if (label) out.label = label;
  const as = optText(e.as, "log", 64);
  if (as) out.as = as;
  if (isColor(e.color)) out.color = e.color;
  if (e.kind === "attack" || e.kind === "damage") out.kind = e.kind;
  if (e.roll !== undefined) out.roll = rollResult(e.roll);
  if (e.turn !== undefined) {
    const t = obj(e.turn, "log");
    out.turn = { seq: int(t.seq, "log", 0, 1e9), round: int(t.round, "log", 0, 1e6), name: text(t.name, "log", 64) };
  }
  return out;
}

function combat(raw: unknown, combatantIds: Set<string>): CombatState {
  const c = obj(raw, "combate");
  const order = list(c.order, "ordem de iniciativa", 1000).map((id) => requireString(id, "Ordem"));
  if (order.some((id) => !combatantIds.has(id))) fail("Arquivo inválido: ordem de iniciativa com combatente que não existe.");
  return {
    active: bool(c.active, "combate"),
    round: int(c.round, "round", 0, 1e6),
    turnIndex: int(c.turnIndex, "vez", 0, Math.max(0, order.length - 1)),
    order,
    turn: int(c.turn, "turno", 0, 1e9),
  };
}

export interface ParsedSession {
  players: SessionFile["players"];
  mobCounters: Map<string, number>;
  game: GameState;
}

/** Lê e valida o arquivo inteiro. Lança `ActionError` (mensagem pronta) se algo não bater. */
export function parseSession(raw: unknown): ParsedSession {
  const f = obj(raw, "não é um objeto JSON");
  if (f.app !== SESSION_FILE_APP) fail("Este arquivo não é uma sessão do Jamal's Tabletop.");
  if (typeof f.format !== "number" || !Number.isInteger(f.format) || f.format < 1) fail("Arquivo inválido: versão do formato.");
  if (f.format > SESSION_FILE_FORMAT) {
    fail(`Este arquivo foi salvo por uma versão mais nova do app (formato ${f.format}). Atualize o Jamal's Tabletop para abrir.`);
  }

  const players = list(f.players, "jogadores", 1000).map((raw) => {
    const p = obj(raw, "jogador");
    const role: Role = p.role === "gm" ? "gm" : p.role === "player" ? "player" : fail("Arquivo inválido: papel do jogador.");
    return { id: requireString(p.id, "Jogador"), name: requireName(p.name), role };
  });

  const g = obj(f.game, "jogo");
  const b = obj(g.battle, "batalha");
  const m = obj(b.map, "mapa");
  const allies = list(g.allies, "aliados", 200).map((c) => combatant(c, "ally"));
  const mobs = list(b.mobs, "mobs", 500).map((c) => combatant(c, "mob"));
  const npcs = list(b.npcs ?? [], "NPCs", 500).map((c) => combatant(c, "npc"));
  const ids = new Set([...allies, ...mobs, ...npcs].map((c) => c.id));
  if (ids.size !== allies.length + mobs.length + npcs.length) fail("Arquivo inválido: combatentes repetidos.");
  // Conjurado (E21): o conjurador existe e é do mesmo lado.
  const all = [...allies, ...mobs, ...npcs];
  for (const c of all) {
    if (!c.summonerId) continue;
    const by = all.find((o) => o.id === c.summonerId);
    if (!by || by.type !== c.type || by.summonerId) fail("Arquivo inválido: conjurado sem conjurador.");
  }
  const rotation = int(m.rotation ?? 0, "rotação do mapa", 0, 270);
  if (rotation % 90 !== 0) fail("Arquivo inválido: rotação do mapa.");

  const game: GameState = {
    templates: list(g.templates, "templates", 500).map(template),
    allies,
    battle: {
      map: {
        image: m.image === null ? null : requireImage(m.image, "Mapa", LIMITS.mapImageChars),
        imageVersion: 0,
        showGrid: bool(m.showGrid, "grid"),
        cellPx: requireNumber(m.cellPx, "Tamanho do quadrado", LIMITS.cellPx.min, LIMITS.cellPx.max),
        offsetX: offsetOf(m.offsetX, "Deslocamento X"),
        offsetY: offsetOf(m.offsetY, "Deslocamento Y"),
        feetPerCell: requireNumber(m.feetPerCell, "Pés por quadrado", 1, 100),
        rotation,
        imageScale: requireNumber(m.imageScale ?? 1, "Escala do mapa", LIMITS.imageScale.min, LIMITS.imageScale.max),
      },
      mobs,
      npcs,
      // Oculto não fica na ordem de iniciativa (E21).
      combat: combat(b.combat, new Set([...allies, ...mobs, ...npcs].filter((c) => !c.hidden).map((c) => c.id))),
      rolls: { request: null, reactions: [], outside: outsideRolls(obj(b.rolls ?? {}, "rolagens").outside) },
      effects: list(b.effects ?? [], "efeitos", LIMITS.effects).map((e) => effect(e, ids)),
      weather: weatherFromFile(b.weather),
    },
    log: list(g.log, "log", LIMITS.logSize).map(logEntry),
  };

  const counters = obj(f.mobCounters ?? {}, "numeração dos mobs");
  const mobCounters = new Map<string, number>();
  for (const [tid, n] of Object.entries(counters)) mobCounters.set(tid, int(n, "numeração dos mobs", 0, 1e6));
  return { players, mobCounters, game };
}

function offsetOf(raw: unknown, label: string): number {
  return requireNumber(raw, label, -LIMITS.cellPx.max, LIMITS.cellPx.max);
}

/**
 * Troca o estado atual pelo do arquivo. Os donos são religados pelo nome:
 * mestre do arquivo → mestre atual; jogador com o mesmo nome já na sessão → ele;
 * os demais voltam como jogadores offline que o primeiro a entrar com aquele nome reassume.
 */
export function importSession(store: Store, gm: ServerPlayer, raw: unknown) {
  const parsed = parseSession(raw);
  const remap = new Map<string, string>();
  for (const p of parsed.players) {
    if (p.role === "gm") {
      remap.set(p.id, gm.id);
      continue;
    }
    const sameName = [...store.players.values()].find(
      (x) => x.role === "player" && x.name.toLocaleLowerCase("pt-BR") === p.name.toLocaleLowerCase("pt-BR"),
    );
    if (sameName) {
      remap.set(p.id, sameName.id);
    } else if (!store.players.has(p.id)) {
      store.players.set(p.id, { id: p.id, name: p.name, role: "player", token: randomUUID(), sockets: new Set(), claimByName: true });
    }
  }
  const owner = (id: string) => remap.get(id) ?? id;
  const { game } = parsed;
  for (const a of game.allies) if (a.ownerId) a.ownerId = owner(a.ownerId);
  for (const e of game.battle.effects) {
    e.ownerId = owner(e.ownerId);
    // O estado de antes de Transformar também tem dono: ao voltar a ele, continua com quem controlava.
    if (e.revertTo) e.revertTo.ownerId = owner(e.revertTo.ownerId);
  }
  for (const e of game.log) e.authorId = owner(e.authorId);

  // A versão nova faz o servidor reenviar a imagem do mapa a todos.
  game.battle.map.imageVersion = store.game.battle.map.imageVersion + 1;
  store.game = game;
  store.mobCounters = parsed.mobCounters;
  store.removedMobs.clear();
}
