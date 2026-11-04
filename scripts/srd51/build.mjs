// Gera server/src/catalog/srd51-entries.ts a partir dos dados do SRD 5.1 da Open5e (Passo 12, fase B).
//
// Uso: node scripts/srd51/build.mjs <pasta com Creature.json e CreatureAction.json>
// Os arquivos vêm de https://github.com/open5e/open5e-api/tree/staging/data/v2/wizards-of-the-coast/srd-2014
// (o conteúdo é o SRD 5.1, CC BY 4.0; o código da Open5e é MIT e não cobre o SRD).
//
// Sai com erro se faltar a tradução de algum monstro ou ataque (nada vai em inglês sem querer).
import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { ATTACKS, nameOf } from "./translations.mjs";

const dir = process.argv[2];
if (!dir) {
  console.error("Uso: node scripts/srd51/build.mjs <pasta com Creature.json e CreatureAction.json>");
  process.exit(1);
}
const creatures = JSON.parse(readFileSync(join(dir, "Creature.json"), "utf8"));
const actions = JSON.parse(readFileSync(join(dir, "CreatureAction.json"), "utf8"));

/** Cópias com outro nome e ND 0 (erro da fonte): ficam de fora. */
const SKIP = new Set(["srd_elf-drow", "srd_gnome-deep-svirfneblin"]);

/**
 * Bônus e dano do texto do ataque. Vale o primeiro dano do "Hit:" e os que vêm com "plus" na mesma frase;
 * ficam de fora alternativas ("or ... with two hands"), dano de salvaguarda e o resto do texto (maldições etc.).
 * Dados iguais se juntam ("2d6 + 3 plus 3d6" → "5d6+3"). Dano fixo sem dado (1 de dano) fica sem fórmula.
 */
function attackOf(desc) {
  const hit = /([+-]\d+) to hit/.exec(desc);
  const sentence = (desc.split(/Hit:/)[1] ?? "").split(/\.(?:\s|$)/)[0];
  const faces = new Map();
  let flat = 0;
  let i = 0;
  for (const m of sentence.matchAll(/\((\d+)d(\d+)(?:\s*([+-])\s*(\d+))?\)/g)) {
    const before = sentence.slice(Math.max(0, m.index - 14), m.index);
    if (i++ > 0 && !/plus\s+\d+\s*$/.test(before)) continue;
    faces.set(m[2], (faces.get(m[2]) ?? 0) + Number(m[1]));
    if (m[3]) flat += (m[3] === "-" ? -1 : 1) * Number(m[4]);
  }
  const dice = [...faces].map(([f, n]) => `${n}d${f}`);
  const damage = dice.length ? dice.join("+") + (flat ? (flat > 0 ? `+${flat}` : `${flat}`) : "") : undefined;
  return { bonus: hit ? Number(hit[1]) : undefined, damage };
}

const crOf = (s) => ({ "0.125": "1/8", "0.250": "1/4", "0.500": "1/2" })[s] ?? String(Number(s));

const missing = [];
const entries = [];
for (const c of creatures) {
  if (SKIP.has(c.pk)) continue;
  const f = c.fields;
  const pk = c.pk.replace(/^srd_/, "");
  const name = nameOf(pk);
  if (!name) missing.push(`monstro ${pk} (${f.name})`);
  const attacks = actions
    .filter((a) => a.fields.parent === c.pk && /Attack:/.test(a.fields.desc) && !a.fields.name.startsWith("Variant:"))
    .sort((a, b) => a.fields.order_in_statblock - b.fields.order_in_statblock)
    .map((a) => {
      const tr = ATTACKS[a.fields.name];
      if (!tr) missing.push(`ataque ${a.fields.name}`);
      const { bonus, damage } = attackOf(a.fields.desc);
      return { name: { "pt-BR": tr?.[0], en: a.fields.name, es: tr?.[1] }, ...(bonus !== undefined && { bonus }), ...(damage && { damage }) };
    });
  entries.push({
    id: `srd:${pk}`,
    name: { "pt-BR": name?.[0], en: f.name, es: name?.[1] },
    type: f.type,
    size: f.size,
    cr: crOf(f.challenge_rating),
    hpMax: f.hit_points,
    ac: f.armor_class,
    abilities: {
      str: f.ability_score_strength,
      dex: f.ability_score_dexterity,
      con: f.ability_score_constitution,
      int: f.ability_score_intelligence,
      wis: f.ability_score_wisdom,
      cha: f.ability_score_charisma,
    },
    attacks,
  });
}
if (missing.length) {
  console.error(`Faltam traduções:\n${[...new Set(missing)].join("\n")}`);
  process.exit(1);
}

const out = `// GERADO por scripts/srd51/build.mjs: não edite à mão (mude as traduções em scripts/srd51/translations.mjs).
// System Reference Document 5.1 (Wizards of the Coast LLC), CC BY 4.0. Dados extraídos da Open5e.
import type { CatalogEntry } from "@rpg/shared";

export const SRD51_ENTRIES: CatalogEntry[] = ${JSON.stringify(entries)};
`;
writeFileSync(new URL("../../server/src/catalog/srd51-entries.ts", import.meta.url), out);
console.log(`${entries.length} monstros, ${entries.reduce((n, e) => n + e.attacks.length, 0)} ataques → server/src/catalog/srd51-entries.ts (${Math.round(out.length / 1024)} KB)`);
