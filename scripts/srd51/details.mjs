// Gera server/src/catalog/srd51-details.ts: as habilidades de cada monstro (Passo 12, fase C) nos três idiomas.
//
// Uso: node scripts/srd51/details.mjs <pasta com Creature.json, CreatureAction.json e CreatureTrait.json>
// (mesma fonte do build.mjs: Open5e, SRD 5.1 sob CC BY 4.0).
//
// As linhas fixas (deslocamento, testes de resistência, perícias, sentidos, imunidade a condições) saem dos dados
// estruturados com o vocabulário abaixo. O texto livre (traços, ações, reações, lendárias) e as frases de idioma e
// de dano vêm dos lotes traduzidos em scripts/srd51/texts/. Monstro sem lote ainda: fica sem habilidades
// (o app mostra só a ficha). Monstro com lote incompleto: erro, com a lista do que falta.
import { readdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { pathToFileURL } from "node:url";

const dir = process.argv[2];
if (!dir) {
  console.error("Uso: node scripts/srd51/details.mjs <pasta da Open5e srd-2014>");
  process.exit(1);
}
const load = (f) => JSON.parse(readFileSync(join(dir, f), "utf8"));
const creatures = load("Creature.json");
const actions = load("CreatureAction.json");
const traits = load("CreatureTrait.json");

// Lotes traduzidos: { [pk]: { lang?, res?, imm?, vul?: [pt, es], t: { chave: [nomePt, textoPt, nomeEs, textoEs] }, a: {…} } }
const textsDir = new URL("./texts/", import.meta.url);
const batches = {};
for (const file of readdirSync(textsDir).filter((f) => f.endsWith(".mjs")).sort()) {
  Object.assign(batches, (await import(pathToFileURL(join(textsDir.pathname.replace(/^\/(\w:)/, "$1"), file)).href)).default);
}

const LANGS = ["pt-BR", "en", "es"];
/** Vocabulário das linhas fixas: [pt-BR, en, es]. */
const V = {
  speed: ["Deslocamento", "Speed", "Velocidad"],
  fly: ["voo", "fly", "volar"],
  swim: ["natação", "swim", "nadar"],
  climb: ["escalada", "climb", "trepar"],
  burrow: ["escavação", "burrow", "excavar"],
  hover: ["(pairar)", "(hover)", "(levitar)"],
  saves: ["Testes de resistência", "Saving Throws", "Tiradas de salvación"],
  skills: ["Perícias", "Skills", "Habilidades"],
  res: ["Resistência a dano", "Damage Resistances", "Resistencias al daño"],
  imm: ["Imunidade a dano", "Damage Immunities", "Inmunidades al daño"],
  vul: ["Vulnerabilidade a dano", "Damage Vulnerabilities", "Vulnerabilidades al daño"],
  cond: ["Imunidade a condição", "Condition Immunities", "Inmunidades a estados"],
  senses: ["Sentidos", "Senses", "Sentidos"],
  langs: ["Idiomas", "Languages", "Idiomas"],
  blindsight: ["percepção às cegas", "blindsight", "vista ciega"],
  darkvision: ["visão no escuro", "darkvision", "visión en la oscuridad"],
  tremorsense: ["sentido sísmico", "tremorsense", "sentido de la vibración"],
  truesight: ["visão verdadeira", "truesight", "visión verdadera"],
  passive: ["Percepção passiva", "passive Perception", "Percepción pasiva"],
  perDay: ["{n}/dia", "{n}/Day", "{n}/día"],
  recharge: ["recarga {n}–6", "Recharge {n}–6", "recarga {n}–6"],
  recharge6: ["recarga 6", "Recharge 6", "recarga 6"],
  cost: ["custa {n} ações", "Costs {n} Actions", "cuesta {n} acciones"],
};
const ABIL = {
  strength: ["FOR", "Str", "FUE"],
  dexterity: ["DES", "Dex", "DES"],
  constitution: ["CON", "Con", "CON"],
  intelligence: ["INT", "Int", "INT"],
  wisdom: ["SAB", "Wis", "SAB"],
  charisma: ["CAR", "Cha", "CAR"],
};
const SKILLS = {
  acrobatics: ["Acrobacia", "Acrobatics", "Acrobacias"],
  animal_handling: ["Lidar com Animais", "Animal Handling", "Trato con animales"],
  arcana: ["Arcanismo", "Arcana", "Conocimiento arcano"],
  athletics: ["Atletismo", "Athletics", "Atletismo"],
  deception: ["Enganação", "Deception", "Engaño"],
  history: ["História", "History", "Historia"],
  insight: ["Intuição", "Insight", "Perspicacia"],
  intimidation: ["Intimidação", "Intimidation", "Intimidación"],
  investigation: ["Investigação", "Investigation", "Investigación"],
  medicine: ["Medicina", "Medicine", "Medicina"],
  nature: ["Natureza", "Nature", "Naturaleza"],
  perception: ["Percepção", "Perception", "Percepción"],
  performance: ["Atuação", "Performance", "Interpretación"],
  persuasion: ["Persuasão", "Persuasion", "Persuasión"],
  religion: ["Religião", "Religion", "Religión"],
  sleight_of_hand: ["Prestidigitação", "Sleight of Hand", "Juego de manos"],
  stealth: ["Furtividade", "Stealth", "Sigilo"],
  survival: ["Sobrevivência", "Survival", "Supervivencia"],
};
const CONDITIONS = {
  blinded: ["cego", "blinded", "cegado"],
  charmed: ["enfeitiçado", "charmed", "hechizado"],
  deafened: ["surdo", "deafened", "ensordecido"],
  exhaustion: ["exaustão", "exhaustion", "agotamiento"],
  frightened: ["amedrontado", "frightened", "asustado"],
  grappled: ["agarrado", "grappled", "agarrado"],
  paralyzed: ["paralisado", "paralyzed", "paralizado"],
  petrified: ["petrificado", "petrified", "petrificado"],
  poisoned: ["envenenado", "poisoned", "envenenado"],
  prone: ["caído", "prone", "derribado"],
  restrained: ["impedido", "restrained", "apresado"],
  stunned: ["atordoado", "stunned", "aturdido"],
  unconscious: ["inconsciente", "unconscious", "inconsciente"],
};

const sign = (n) => (n >= 0 ? `+${n}` : String(n));
const SKIP = new Set(["srd_elf-drow", "srd_gnome-deep-svirfneblin"]);
const missing = [];
const out = {};

for (const c of creatures) {
  if (SKIP.has(c.pk)) continue;
  const pk = c.pk.replace(/^srd_/, "");
  const tr = batches[pk];
  if (!tr) continue;
  const f = c.fields;
  const need = (what, v) => {
    if (!v) missing.push(`${pk}: ${what}`);
    return v ?? ["", ""];
  };
  const details = {};
  LANGS.forEach((lang, li) => {
    const pick = (v) => v[li];
    // pt/es dos lotes: [pt, es]; o inglês vem da fonte.
    const frase = (en, pair) => (li === 1 ? en : pair[li === 0 ? 0 : 1]);
    const lines = [];
    const speeds = [`${f.walk ?? 0} ft`, ...["fly", "swim", "climb", "burrow"].filter((k) => f[k]).map((k) => `${pick(V[k])} ${f[k]} ft${k === "fly" && f.hover ? ` ${pick(V.hover)}` : ""}`)];
    lines.push({ label: pick(V.speed), text: speeds.join(", ") });
    const saves = Object.keys(ABIL).filter((k) => f[`saving_throw_${k}`] != null).map((k) => `${pick(ABIL[k])} ${sign(f[`saving_throw_${k}`])}`);
    if (saves.length) lines.push({ label: pick(V.saves), text: saves.join(", ") });
    const skills = Object.keys(SKILLS).filter((k) => f[`skill_bonus_${k}`] != null).map((k) => `${pick(SKILLS[k])} ${sign(f[`skill_bonus_${k}`])}`);
    if (skills.length) lines.push({ label: pick(V.skills), text: skills.join(", ") });
    for (const [key, field] of [["vul", "damage_vulnerabilities_display"], ["res", "damage_resistances_display"], ["imm", "damage_immunities_display"]]) {
      if (f[field]) lines.push({ label: pick(V[key]), text: frase(f[field], need(`frase ${key}`, tr[key])) });
    }
    if (f.condition_immunities.length) lines.push({ label: pick(V.cond), text: f.condition_immunities.map((k) => pick(CONDITIONS[k] ?? need(`condição ${k}`, null))).join(", ") });
    const senses = ["blindsight", "darkvision", "tremorsense", "truesight"].filter((k) => f[`${k}_range`]).map((k) => `${pick(V[k])} ${f[`${k}_range`]} ft`);
    senses.push(`${pick(V.passive)} ${f.passive_perception}`);
    lines.push({ label: pick(V.senses), text: senses.join(", ") });
    if (f.languages_desc) lines.push({ label: pick(V.langs), text: frase(f.languages_desc, need("idiomas", tr.lang)) });

    const block = (src, map, key) => {
      const t = map?.[key];
      if (!t) missing.push(`${pk}: ${key}`);
      const uses =
        src.fields.uses_type === "PER_DAY"
          ? pick(V.perDay).replace("{n}", src.fields.uses_param)
          : src.fields.uses_type === "RECHARGE_ON_ROLL"
            ? src.fields.uses_param === 6
              ? pick(V.recharge6)
              : pick(V.recharge).replace("{n}", src.fields.uses_param)
            : src.fields.legendary_action_cost > 1
              ? pick(V.cost).replace("{n}", src.fields.legendary_action_cost)
              : null;
      const name = li === 1 ? src.fields.name : (t?.[li === 0 ? 0 : 2] ?? "");
      return { name: uses ? `${name} (${uses})` : name, desc: li === 1 ? src.fields.desc : (t?.[li === 0 ? 1 : 3] ?? "") };
    };
    const keyOf = (x) => x.pk.slice(c.pk.length + 1);
    const mine = actions.filter((x) => x.fields.parent === c.pk && !/Attack:/.test(x.fields.desc)).sort((x, y) => x.fields.order_in_statblock - y.fields.order_in_statblock);
    const of = (type) => mine.filter((x) => x.fields.action_type === type).map((x) => block(x, tr.a, keyOf(x)));
    details[lang] = {
      lines,
      traits: traits.filter((x) => x.fields.parent === c.pk).map((x) => block(x, tr.t, keyOf(x))),
      actions: of("ACTION"),
      reactions: of("REACTION"),
      legendary: of("LEGENDARY_ACTION"),
    };
  });
  out[`srd:${pk}`] = details;
}

if (missing.length) {
  console.error(`Faltam traduções nos lotes:\n${[...new Set(missing)].join("\n")}`);
  process.exit(1);
}
const file = `// GERADO por scripts/srd51/details.mjs: não edite à mão (as traduções ficam em scripts/srd51/texts/).
// System Reference Document 5.1 (Wizards of the Coast LLC), CC BY 4.0. Dados extraídos da Open5e.
import type { CatalogDetails } from "@rpg/shared";

export const SRD51_DETAILS: Record<string, CatalogDetails> = ${JSON.stringify(out)};
`;
writeFileSync(new URL("../../server/src/catalog/srd51-details.ts", import.meta.url), file);
console.log(`${Object.keys(out).length} monstros com habilidades → server/src/catalog/srd51-details.ts (${Math.round(file.length / 1024)} KB)`);
