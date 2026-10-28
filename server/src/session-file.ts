import { randomUUID } from "node:crypto";
import {
  emptyFog,
  ABILITIES,
  APP_VERSION,
  COINS,
  EFFECT_PRESETS,
  LIMITS,
  SESSION_FILE_APP,
  SESSION_FILE_FORMAT,
  SIZES,
  SPELL_LEVELS,
  TURN_ACTIONS,
  isColor,
  type Abilities,
  type Coins,
  type Combatant,
  type CombatState,
  type InventoryItem,
  type Recharge,
  type SavedAttack,
  type Condition,
  type EffectPreset,
  type EffectState,
  type GameState,
  type GridPos,
  type LogEntry,
  type MapEffect,
  type Scene,
  type SceneContent,
  type MobTemplate,
  type OutsideRolls,
  type RollResult,
  type Role,
  type RollTerm,
  type SessionFile,
  type TurnAction,
  type Size,
  type Spell,
  type SpellLevel,
  type SpellSlot,
  type FogState,
  type BossPhase,
  type TableRules,
} from "@rpg/shared";
import { parseDrawing } from "./actions/drawings";
import { parseWall } from "./actions/walls";
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

function tableRules(raw: unknown): TableRules {
  const r = obj(raw, "regras da mesa");
  return {
    moveOnTurn: bool(r.moveOnTurn ?? false, "regra da mesa"),
    summonOnTurn: bool(r.summonOnTurn ?? false, "regra da mesa"),
    darkReminder: bool(r.darkReminder ?? false, "regra da mesa"),
  };
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
  stats(out, c);
  sheet(out, c);
  if (c.turnUsed !== undefined) {
    const used = list(c.turnUsed, "ações do turno", TURN_ACTIONS.length);
    if (used.some((a) => !(TURN_ACTIONS as readonly unknown[]).includes(a))) fail("Arquivo inválido: ações do turno.");
    out.turnUsed = used as TurnAction[];
  }
  if (c.tempHp !== undefined) out.tempHp = int(c.tempHp, "vida temporária", 1, LIMITS.hpMax.max);
  if (c.aura !== undefined) out.aura = int(c.aura, "alcance", LIMITS.aura.min, LIMITS.aura.max);
  if (c.auraColor !== undefined) out.auraColor = isColor(c.auraColor) ? c.auraColor : fail("Arquivo inválido: cor do alcance.");
  if (c.deathSaves !== undefined) {
    const d = obj(c.deathSaves, "testes contra a morte");
    out.deathSaves = { successes: int(d.successes, "testes contra a morte", 0, 3), failures: int(d.failures, "testes contra a morte", 0, 3) };
  }
  if (c.ownerId !== undefined) out.ownerId = requireString(c.ownerId, "Dono");
  if (c.templateId !== undefined) out.templateId = requireString(c.templateId, "Template");
  if (c.avatar !== undefined) out.avatar = requireImage(c.avatar, "Avatar", LIMITS.avatarChars);
  if (c.spellSlots !== undefined) out.spellSlots = spellSlots(c.spellSlots);
  if (c.spells !== undefined) out.spells = list(c.spells, "magias", LIMITS.spells).map(spell);
  // Marcas do E21: arquivos da 2.0 não têm (ausente = não).
  if (c.animal !== undefined && bool(c.animal, "animal")) out.animal = true;
  if (c.darkvision !== undefined && bool(c.darkvision, "visão no escuro")) out.darkvision = true;
  if (c.phases !== undefined) out.phases = bossPhases(c.phases);
  if (c.phase !== undefined) out.phase = int(c.phase, "fase do chefe", 1, LIMITS.phases + 1);
  const description = optText(c.description, "descrição", LIMITS.description);
  if (description) out.description = description;
  const gmNotes = optText(c.gmNotes, "notas do mestre", LIMITS.notes);
  if (gmNotes) out.gmNotes = gmNotes;
  if (c.hidden !== undefined && bool(c.hidden, "oculto") && type !== "ally") out.hidden = true;
  if (c.summonerId !== undefined) out.summonerId = requireString(c.summonerId, "Invocador");
  if (c.summonConcentration !== undefined && bool(c.summonConcentration, "concentração do invocado")) out.summonConcentration = true;
  if (c.summonRounds !== undefined) out.summonRounds = int(c.summonRounds, "duração do invocado", LIMITS.conditionRounds.min, LIMITS.conditionRounds.max);
  return out;
}

/** Ficha pessoal: recursos, ataques salvos, inventário e moedas (arquivos de antes não têm). */
function sheet(out: Combatant, c: Obj) {
  const recharges = ["short", "long", "none", "turn", "dice"];
  if (c.resources !== undefined) {
    out.resources = list(c.resources, "recursos", LIMITS.resources).map((raw) => {
      const r = obj(raw, "recurso");
      const max = int(r.max, "recurso", 1, LIMITS.resourceMax);
      if (typeof r.recharge !== "string" || !recharges.includes(r.recharge)) fail("Arquivo inválido: recurso.");
      return {
        id: requireString(r.id, "Recurso"),
        name: text(r.name, "recurso", LIMITS.spellName) || fail("Arquivo inválido: recurso sem nome."),
        max,
        used: int(r.used, "recurso", 0, max),
        recharge: r.recharge as Recharge,
        ...(r.rechargeOn !== undefined && { rechargeOn: int(r.rechargeOn, "recarga", 2, 6) }),
      };
    });
  }
  if (c.attacks !== undefined) {
    out.attacks = list(c.attacks, "ataques", LIMITS.attacks).map((raw) => {
      const a = obj(raw, "ataque");
      const out: SavedAttack = { id: requireString(a.id, "Ataque"), name: text(a.name, "ataque", LIMITS.spellName) || fail("Arquivo inválido: ataque sem nome.") };
      if (a.bonus !== undefined) out.bonus = int(a.bonus, "ataque", -20, 40);
      const damage = optText(a.damage, "ataque", LIMITS.dice.exprLength);
      if (damage) out.damage = damage;
      return out;
    });
  }
  if (c.inventory !== undefined) {
    out.inventory = list(c.inventory, "inventário", LIMITS.items).map((raw) => {
      const i = obj(raw, "item");
      const out: InventoryItem = {
        id: requireString(i.id, "Item"),
        name: text(i.name, "item", LIMITS.spellName) || fail("Arquivo inválido: item sem nome."),
        qty: int(i.qty, "item", 0, LIMITS.itemQty),
      };
      const note = optText(i.note, "item", LIMITS.spellNote);
      if (note) out.note = note;
      return out;
    });
  }
  if (c.coins !== undefined) {
    const raw = obj(c.coins, "moedas");
    const coins: Coins = {};
    for (const k of COINS) if (raw[k] !== undefined) coins[k] = int(raw[k], "moedas", 0, LIMITS.coins);
    out.coins = coins;
  }
}

/** CA, atributos e tamanho; arquivos de antes não têm (ficam sem: médio). */
function stats(out: { ac?: number; abilities?: Abilities; size?: Size }, raw: Obj) {
  if (raw.size !== undefined) {
    if (typeof raw.size !== "string" || !(raw.size in SIZES)) fail("Arquivo inválido: tamanho.");
    if (raw.size !== "medium") out.size = raw.size as Size;
  }
  if (raw.ac !== undefined) out.ac = int(raw.ac, "CA", LIMITS.ac.min, LIMITS.ac.max);
  if (raw.abilities === undefined) return;
  const a = obj(raw.abilities, "atributos");
  const abilities: Abilities = {};
  for (const key of ABILITIES) if (a[key] !== undefined) abilities[key] = int(a[key], "atributo", LIMITS.abilityScore.min, LIMITS.abilityScore.max);
  if (Object.keys(abilities).length > 0) out.abilities = abilities;
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
  stats(out, t);
  if (t.avatar !== undefined) out.avatar = requireImage(t.avatar, "Avatar", LIMITS.avatarChars);
  const notes = optText(t.notes, "notas", LIMITS.notes);
  if (notes) out.notes = notes;
  if (t.animal !== undefined && bool(t.animal, "animal")) out.animal = true;
  const description = optText(t.description, "descrição", LIMITS.description);
  if (description) out.description = description;
  if (t.phases !== undefined) out.phases = bossPhases(t.phases);
  return out;
}

/** Fases de chefe (as próximas): vida, e nome e CA se tiverem. */
function bossPhases(raw: unknown): BossPhase[] {
  return list(raw, "fases do chefe", LIMITS.phases).map((r) => {
    const p = obj(r, "fase do chefe");
    const out: BossPhase = { hpMax: int(p.hpMax, "vida da fase", LIMITS.hpMax.min, LIMITS.hpMax.max) };
    if (p.name !== undefined) out.name = requireName(p.name);
    if (p.ac !== undefined) out.ac = int(p.ac, "CA da fase", LIMITS.ac.min, LIMITS.ac.max);
    return out;
  });
}

function effect(raw: unknown, combatantIds: Set<string>): MapEffect {
  const e = obj(raw, "efeito");
  const out: MapEffect = {
    id: requireString(e.id, "Efeito"),
    ...effectState(e, combatantIds),
    area: validArea(e.area) ?? fail("Arquivo inválido: área do efeito."),
    active: bool(e.active, "efeito ligado"),
  };
  // Efeito que anda com o token: se o combatente não existe mais, só fica parado.
  if (e.followId !== undefined && combatantIds.has(requireString(e.followId, "Efeito"))) out.followId = e.followId as string;
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
  const allies = list(g.allies, "aliados", 200).map((c) => combatant(c, "ally"));
  const active = sceneContent(b, allies);

  // Cenas (2.8+). Arquivo mais antigo: uma cena só, a do mapa salvo.
  const rawScenes = g.scenes === undefined ? null : list(g.scenes, "cenas", LIMITS.scenes);
  const sceneId = rawScenes ? requireString(g.sceneId, "Cena") : randomUUID();
  const allyIds = new Set(allies.map((a) => a.id));
  const scenes: Scene[] = rawScenes
    ? rawScenes.map((raw) => {
        const sc = obj(raw, "cena");
        const id = requireString(sc.id, "Cena");
        const name = text(sc.name, "cena", LIMITS.sceneName) || fail("Arquivo inválido: cena sem nome.");
        // A cena ativa é a que está em `battle`; só as outras vêm guardadas.
        if (id === sceneId) return { id, name };
        const st = obj(sc.stored, "cena guardada");
        return { id, name, stored: { ...sceneContent(st, allies), allyPos: allyPositions(st.allyPos, allyIds) } };
      })
    : [{ id: sceneId, name: "Cena 1" }];
  if (new Set(scenes.map((sc) => sc.id)).size !== scenes.length) fail("Arquivo inválido: cenas repetidas.");
  if (!scenes.some((sc) => sc.id === sceneId)) fail("Arquivo inválido: cena atual.");

  // Nenhum combatente se repete, nem de uma cena para outra.
  const everyone = [...allies, ...active.mobs, ...active.npcs, ...scenes.flatMap((sc) => (sc.stored ? [...sc.stored.mobs, ...sc.stored.npcs] : []))];
  if (new Set(everyone.map((c) => c.id)).size !== everyone.length) fail("Arquivo inválido: combatentes repetidos.");

  const game: GameState = {
    templates: list(g.templates, "templates", 500).map(template),
    allies,
    battle: {
      ...active,
      // Oculto não fica na ordem de iniciativa (E21).
      combat: combat(b.combat, new Set([...allies, ...active.mobs, ...active.npcs].filter((c) => !c.hidden).map((c) => c.id))),
      rolls: { request: null, reactions: [], outside: outsideRolls(obj(b.rolls ?? {}, "rolagens").outside) },
    },
    log: list(g.log, "log", LIMITS.logSize).map(logEntry),
    scenes,
    sceneId,
    // Arquivo de antes das regras da mesa: tudo desligado.
    rules: tableRules(g.rules ?? {}),
  };

  const counters = obj(f.mobCounters ?? {}, "numeração dos mobs");
  const mobCounters = new Map<string, number>();
  for (const [tid, n] of Object.entries(counters)) mobCounters.set(tid, int(n, "numeração dos mobs", 0, 1e6));
  return { players, mobCounters, game };
}

/** Conteúdo de uma cena (a ativa ou uma guardada), validado: mapa, mobs, NPCs, efeitos, desenhos, paredes e clima. */
function sceneContent(b: Obj, allies: Combatant[]): SceneContent {
  const m = obj(b.map, "mapa");
  const mobs = list(b.mobs, "mobs", 500).map((c) => combatant(c, "mob"));
  const npcs = list(b.npcs ?? [], "NPCs", 500).map((c) => combatant(c, "npc"));
  const all = [...allies, ...mobs, ...npcs];
  const ids = new Set(all.map((c) => c.id));
  if (ids.size !== all.length) fail("Arquivo inválido: combatentes repetidos.");
  // Conjurado (E21): o conjurador existe e é do mesmo lado.
  for (const c of all) {
    if (!c.summonerId) continue;
    const by = all.find((o) => o.id === c.summonerId);
    if (!by || by.type !== c.type || by.summonerId) fail("Arquivo inválido: invocado sem invocador.");
  }
  const rotation = int(m.rotation ?? 0, "rotação do mapa", 0, 270);
  if (rotation % 90 !== 0) fail("Arquivo inválido: rotação do mapa.");
  return {
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
    effects: list(b.effects ?? [], "efeitos", LIMITS.effects).map((e) => effect(e, ids)),
    // Arquivos anteriores à 2.8 não têm desenhos nem paredes.
    drawings: list(b.drawings ?? [], "desenhos", LIMITS.drawings).map((d) => ({ id: requireString(obj(d, "desenho").id, "Desenho"), ...parseDrawing(d) })),
    walls: list(b.walls ?? [], "paredes", LIMITS.walls).map((w) => ({ id: requireString(obj(w, "parede").id, "Parede"), ...parseWall(w) })),
    weather: weatherFromFile(b.weather),
    // Arquivos anteriores à névoa: sem névoa.
    fog: b.fog === undefined ? emptyFog() : fogFromFile(b.fog),
  };
}

/** Névoa da cena: intervalos de colunas por linha, conferidos (ordenados, sem sobreposição). */
function fogFromFile(raw: unknown): FogState {
  const f = obj(raw, "névoa");
  const rows = obj(f.revealed ?? {}, "névoa");
  const lim = LIMITS.gridCoord;
  const revealed: Record<string, number[]> = {};
  for (const [key, value] of Object.entries(rows)) {
    const row = Number(key);
    if (!Number.isInteger(row) || Math.abs(row) > lim) fail("Arquivo inválido: névoa.");
    const nums = list(value, "névoa", 2000).map((n) => int(n, "névoa", -lim, lim + 1));
    if (nums.length === 0 || nums.length % 2 !== 0) fail("Arquivo inválido: névoa.");
    for (let i = 1; i < nums.length; i++) if (nums[i] <= nums[i - 1]) fail("Arquivo inválido: névoa.");
    revealed[String(row)] = nums;
  }
  return { enabled: bool(f.enabled, "névoa"), revealed };
}

/** Onde cada aliado estava numa cena guardada (aliado que não existe mais é ignorado). */
function allyPositions(raw: unknown, allyIds: Set<string>): Record<string, GridPos> {
  const out: Record<string, GridPos> = {};
  for (const [id, p] of Object.entries(obj(raw ?? {}, "posições dos aliados"))) {
    const at = pos(p);
    if (allyIds.has(id) && at) out[id] = at;
  }
  return out;
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
  for (const e of [...game.battle.effects, ...game.scenes.flatMap((sc) => sc.stored?.effects ?? [])]) {
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
