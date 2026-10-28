import { groupRange, type ClientState, type CombatantView, type Condition, type LogEntry, type TableRules } from "@rpg/shared";
import { allLabels, t, type MessageKey } from "./i18n";

export function fmtMod(n: number): string {
  return n >= 0 ? `+${n}` : `${n}`;
}

export function hpRatio(hp: number, hpMax: number): number {
  return hpMax > 0 ? Math.max(0, Math.min(1, hp / hpMax)) : 0;
}

/** Faixa de cor da barra de vida. */
export function hpLevel(hp: number, hpMax: number): "full" | "mid" | "low" | "zero" {
  if (hp <= 0) return "zero";
  const r = hpRatio(hp, hpMax);
  return r > 0.5 ? "full" : r > 0.25 ? "mid" : "low";
}

/** Todos os combatentes da sessão: aliados, mobs e NPCs. */
export function allCombatants(state: ClientState): CombatantView[] {
  return [...state.allies, ...state.battle.mobs, ...state.battle.npcs];
}

/** Quem está na vez: o combatente da vez ou, num grupo de mobs iguais, todos eles (agem juntos). */
export function currentGroup(state: ClientState): CombatantView[] {
  const { combat } = state.battle;
  if (!combat.active || combat.order.length === 0) return [];
  const byId = new Map(allCombatants(state).map((c) => [c.id, c]));
  const [start, end] = groupRange(combat.order, combat.turnIndex, (id) => byId.get(id));
  return combat.order.slice(start, end).flatMap((id) => byId.get(id) ?? []);
}

/**
 * Regra da mesa travando esta pessoa agora: em combate, com a regra ligada, fora da vez dela
 * (a vez do personagem ou de um invocado dele). O mestre nunca é travado. O servidor confere de novo.
 */
export function turnLocked(state: ClientState, rule: keyof TableRules): boolean {
  if (state.self.role === "gm" || !state.rules[rule] || !state.battle.combat.active) return false;
  return !currentGroup(state).some((c) => c.ownerId === state.self.id);
}

/**
 * Lembrete de escuridão (regra da mesa): com a luz em Noite ou Luar, os personagens (não invocados)
 * sem visão no escuro. Vazio = nada a lembrar. Só informa: o app não aplica efeito nenhum (ADR-06).
 */
export function inTheDark(state: ClientState): CombatantView[] {
  const { light } = state.battle.weather;
  if (!state.rules.darkReminder || (light !== "night" && light !== "moon")) return [];
  return state.allies.filter((a) => !a.summonerId && !a.darkvision);
}

/** Quem rolou, no padrão da mesa (E26): "Thorin (Jorge)", "Goblin 2 (Mestre)", "Mestre". */
export function rollerName(e: LogEntry): string {
  return e.as ? `${e.as} (${e.author})` : e.author;
}

/** Condições da lista: o nome gravado é o em português (o servidor reconhece a Concentração por ele). */
const CONDITION_KEYS: Record<string, MessageKey> = {
  "Agarrado": "condition.grappled",
  "Amedrontado": "condition.frightened",
  "Atordoado": "condition.stunned",
  "Caído": "condition.prone",
  "Cego": "condition.blinded",
  "Concentração": "condition.concentration",
  "Contido": "condition.restrained",
  "Enfeitiçado": "condition.charmed",
  "Envenenado": "condition.poisoned",
  "Exausto": "condition.exhaustion",
  "Incapacitado": "condition.incapacitated",
  "Inconsciente": "condition.unconscious",
  "Invisível": "condition.invisible",
  "Paralisado": "condition.paralyzed",
  "Petrificado": "condition.petrified",
  "Surdo": "condition.deafened",
};

/** Nome da condição no idioma de quem lê (texto livre fica como foi escrito). */
export function conditionLabel(name: string): string {
  const key = CONDITION_KEYS[name];
  return key ? t(key) : name;
}

/** Do que a pessoa escolheu ou digitou (em qualquer idioma) para o nome gravado. */
export function conditionName(typed: string): string {
  const clean = typed.trim().toLocaleLowerCase();
  for (const [pt, key] of Object.entries(CONDITION_KEYS)) {
    if (pt.toLocaleLowerCase() === clean || allLabels(key).some((l) => l.toLocaleLowerCase() === clean)) return pt;
  }
  return typed;
}

/** "Atordoado (2)" ou só "Envenenado" (sem duração). */
export function fmtCondition(k: Condition): string {
  const name = conditionLabel(k.name);
  return k.rounds === null ? name : `${name} (${k.rounds})`;
}
