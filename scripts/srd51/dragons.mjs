// Lote 10 das habilidades (Passo 12, fase C): os 43 dragões (e tartaruga-dragão, veterano meio-dragão, pseudodragão).
// Os textos dos dragões repetem os mesmos modelos e só mudam os números (CD, dano, alcance), então este script lê o
// Open5e, encaixa cada texto num modelo e grava scripts/srd51/texts/lote-10.mjs. Texto fora dos modelos para o script.
// Uso: node scripts/srd51/dragons.mjs <pasta com Creature.json, CreatureAction.json, CreatureTrait.json>
import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const dir = process.argv[2];
if (!dir) throw new Error("Uso: node scripts/srd51/dragons.mjs <pasta dos dados do Open5e>");
const load = (f) => JSON.parse(readFileSync(join(dir, f), "utf8"));
const creatures = load("Creature.json").filter((c) => /dragon/.test(c.pk));
const actions = load("CreatureAction.json");
const traits = load("CreatureTrait.json");

const LANG = {
  "Common, Draconic": ["Comum, Dracônico", "Común, dracónico"],
  Draconic: ["Dracônico", "Dracónico"],
  "Aquan, Draconic": ["Aquan, Dracônico", "Acuano, dracónico"],
  "understands Common and Draconic but can't speak": ["entende Comum e Dracônico mas não fala", "entiende común y dracónico pero no habla"],
};
const DAMAGE = { fire: ["fogo", "fuego"], acid: ["ácido", "ácido"], cold: ["frio", "frío"], lightning: ["elétrico", "relámpago"], poison: ["veneno", "veneno"] };
const ABIL = { Dexterity: ["Destreza", "Destreza"], Constitution: ["Constituição", "Constitución"], Strength: ["Força", "Fuerza"] };
const BREATH = {
  "Fire Breath": ["Sopro de Fogo", "Aliento de fuego"],
  "Acid Breath": ["Sopro Ácido", "Aliento ácido"],
  "Lightning Breath": ["Sopro Elétrico", "Aliento de relámpago"],
  "Poison Breath": ["Sopro Venenoso", "Aliento venenoso"],
  "Cold Breath": ["Sopro Gélido", "Aliento gélido"],
  "Steam Breath": ["Sopro de Vapor", "Aliento de vapor"],
  "Sleep Breath": ["Sopro do Sono", "Aliento somnífero"],
  "Weakening Breath": ["Sopro Enfraquecedor", "Aliento debilitador"],
  "Repulsion Breath": ["Sopro Repulsor", "Aliento repulsor"],
  "Slowing Breath": ["Sopro Lentificador", "Aliento ralentizador"],
  "Paralyzing Breath": ["Sopro Paralisante", "Aliento paralizante"],
};
const STUFF = {
  fire: ["fogo", "fuego"],
  acid: ["ácido", "ácido"],
  lightning: ["relâmpagos", "relámpagos"],
  "poisonous gas": ["gás venenoso", "gas venenoso"],
  "an icy blast": ["uma rajada gélida", "una ráfaga gélida"],
  "an icy blast of hail": ["uma rajada gélida de granizo", "una ráfaga gélida de granizo"],
  "scalding steam": ["vapor escaldante", "vapor abrasador"],
};
// Sujeito do texto: [pt, es] com artigo, para o começo da frase.
const who = (pk) => (/turtle/.test(pk) ? ["A tartaruga-dragão", "La tortuga dragón"] : /veteran/.test(pk) ? ["O veterano", "El veterano"] : /pseudo/.test(pk) ? ["O pseudodragão", "El seudodragón"] : ["O dragão", "El dragón"]);
const low = (s) => s[0].toLowerCase() + s.slice(1);

// Normaliza as variações de grafia da fonte ("ft." x "feet", "an 90-foot", e o erro "a 1 5-foot" = 15).
const norm = (s) =>
  s
    .replace(/(\d+) ft\.( |$)/g, "$1 feet$2")
    .replace(/\ban (\d)/g, "a $1")
    .replace(/a (\d) (\d)-foot/g, "a $1$2-foot")
    .trim();

function fail(what, text) {
  throw new Error(`Texto fora dos modelos (${what}):\n${text}`);
}

/** Um sopro. Devolve [descPt, descEs] (sem o nome). */
function breath(text, [S, Se]) {
  const t = norm(text);
  let m = /^The (?:dragon|dragon turtle|veteran) exhales (.+?) in a (\d+)-foot (cone|line that is (\d+) feet wide)\. Each creature in that (?:area|line) must make a DC (\d+) (\w+) saving throw, taking (\d+ \(\d+d\d+\)) (\w+) damage on a failed save, or half as much damage on a successful one\.( Being underwater doesn't grant resistance against this damage\.)?$/.exec(t);
  if (m) {
    const [, stuff, len, , wide, dc, abil, dmg, type, under] = m;
    if (!STUFF[stuff] || !ABIL[abil] || !DAMAGE[type]) fail("sopro", t);
    const shapePt = wide ? `numa linha de ${len} ft de comprimento e ${wide} ft de largura` : `num cone de ${len} ft`;
    const shapeEs = wide ? `en una línea de ${len} ft de largo y ${wide} ft de ancho` : `en un cono de ${len} ft`;
    const area = wide ? ["na linha", "en esa línea"] : ["na área", "en esa área"];
    return [
      `${S} exala ${STUFF[stuff][0]} ${shapePt}. Cada criatura ${area[0]} deve fazer um teste de resistência de ${ABIL[abil][0]} CD ${dc}. Se falhar, sofre ${dmg} de dano ${type === "fire" ? "de fogo" : type === "cold" ? "de frio" : type === "acid" ? "de ácido" : type === "poison" ? "de veneno" : "elétrico"}; se passar, metade.${under ? " Estar debaixo d'água não dá resistência contra esse dano." : ""}`,
      `${Se} exhala ${STUFF[stuff][1]} ${shapeEs}. Cada criatura ${area[1]} debe hacer una tirada de salvación de ${ABIL[abil][1]} CD ${dc}. Si falla, recibe ${dmg} de daño de ${DAMAGE[type][1]}; si la supera, la mitad.${under ? " Estar bajo el agua no otorga resistencia contra este daño." : ""}`,
    ];
  }
  m = /^The dragon exhales sleep gas in a (\d+)-foot cone\. Each creature in that area must succeed on a DC (\d+) Constitution saving throw or fall unconscious for (\d+) minutes?\. This effect ends for a creature if the creature takes damage or someone uses an action to wake it\.$/.exec(t);
  if (m) {
    const [, len, dc, min] = m;
    const minPt = min === "1" ? "1 minuto" : `${min} minutos`;
    const minEs = min === "1" ? "1 minuto" : `${min} minutos`;
    return [
      `${S} exala gás do sono num cone de ${len} ft. Cada criatura na área deve passar num teste de resistência de Constituição CD ${dc} ou fica inconsciente por ${minPt}. O efeito acaba para a criatura se ela sofrer dano ou se alguém usar uma ação para acordá-la.`,
      `${Se} exhala gas somnífero en un cono de ${len} ft. Cada criatura en esa área debe superar una tirada de salvación de Constitución CD ${dc} o queda inconsciente durante ${minEs}. El efecto termina para la criatura si recibe daño o si alguien usa una acción para despertarla.`,
    ];
  }
  m = /^The dragon exhales gas in a (\d+)-foot cone\. Each creature in that area must succeed on a DC (\d+) Strength saving throw or have disadvantage on Strength-based attack rolls, Strength checks, and Strength saving throws for 1 minute\. A creature can repeat the saving throw at the end of each of its turns, ending the effect on itself on a success\.$/.exec(t);
  if (m) {
    const [, len, dc] = m;
    return [
      `${S} exala um gás num cone de ${len} ft. Cada criatura na área deve passar num teste de resistência de Força CD ${dc} ou tem desvantagem nas jogadas de ataque baseadas em Força, testes de Força e testes de resistência de Força por 1 minuto. A criatura pode repetir o teste ao fim de cada um dos seus turnos, encerrando o efeito em si mesma se passar.`,
      `${Se} exhala un gas en un cono de ${len} ft. Cada criatura en esa área debe superar una tirada de salvación de Fuerza CD ${dc} o tiene desventaja en las tiradas de ataque basadas en Fuerza, las pruebas de Fuerza y las tiradas de salvación de Fuerza durante 1 minuto. La criatura puede repetir la tirada al final de cada uno de sus turnos y termina el efecto sobre sí misma si la supera.`,
    ];
  }
  m = /^The dragon exhales repulsion energy in a (\d+)-foot cone\. Each creature in that area must succeed on a DC (\d+) Strength saving throw\. On a failed save, the creature is pushed (\d+) feet away from the dragon\.$/.exec(t);
  if (m) {
    const [, len, dc, push] = m;
    return [
      `${S} exala energia repulsora num cone de ${len} ft. Cada criatura na área deve passar num teste de resistência de Força CD ${dc}. Se falhar, é empurrada ${push} ft para longe do dragão.`,
      `${Se} exhala energía repulsora en un cono de ${len} ft. Cada criatura en esa área debe superar una tirada de salvación de Fuerza CD ${dc}. Si falla, es empujada ${push} ft lejos del dragón.`,
    ];
  }
  m = /^The dragon exhales gas in a (\d+)-foot cone\. Each creature in that area must succeed on a DC (\d+) Constitution saving throw\. On a failed save, the creature can't use reactions, its speed is halved, and it can't make more than one attack on its turn\. In addition, the creature can use either an action or a bonus action on its turn, but not both\. These effects last for 1 minute\. The creature can repeat the saving throw at the end of each of its turns, ending the effect on itself with a successful save\.$/.exec(t);
  if (m) {
    const [, len, dc] = m;
    return [
      `${S} exala um gás num cone de ${len} ft. Cada criatura na área deve passar num teste de resistência de Constituição CD ${dc}. Se falhar, não pode usar reações, seu deslocamento cai pela metade e não pode fazer mais de um ataque no turno. Além disso, no turno pode usar uma ação ou uma ação bônus, não as duas. Os efeitos duram 1 minuto. A criatura pode repetir o teste ao fim de cada um dos seus turnos, encerrando o efeito em si mesma se passar.`,
      `${Se} exhala un gas en un cono de ${len} ft. Cada criatura en esa área debe superar una tirada de salvación de Constitución CD ${dc}. Si falla, no puede usar reacciones, su velocidad se reduce a la mitad y no puede hacer más de un ataque en su turno. Además, en su turno puede usar una acción o una acción adicional, no ambas. Los efectos duran 1 minuto. La criatura puede repetir la tirada al final de cada uno de sus turnos y termina el efecto sobre sí misma si la supera.`,
    ];
  }
  m = /^The dragon exhales paralyzing gas in a (\d+)-foot cone\. Each creature in that area must succeed on a DC (\d+) Constitution saving throw or be paralyzed for 1 minute\. A creature can repeat the saving throw at the end of each of its turns, ending the effect on itself on a success\.$/.exec(t);
  if (m) {
    const [, len, dc] = m;
    return [
      `${S} exala gás paralisante num cone de ${len} ft. Cada criatura na área deve passar num teste de resistência de Constituição CD ${dc} ou fica paralisada por 1 minuto. A criatura pode repetir o teste ao fim de cada um dos seus turnos, encerrando o efeito em si mesma se passar.`,
      `${Se} exhala gas paralizante en un cono de ${len} ft. Cada criatura en esa área debe superar una tirada de salvación de Constitución CD ${dc} o queda paralizada durante 1 minuto. La criatura puede repetir la tirada al final de cada uno de sus turnos y termina el efecto sobre sí misma si la supera.`,
    ];
  }
  fail("sopro", t);
}

/** "Breath Weapons": cabeçalho e um parágrafo "**Nome.** texto" por sopro. */
function breathWeapons(text, S) {
  const lines = text.split("\n").map((l) => l.trim()).filter(Boolean);
  if (!/^The dragon uses one of the following breath weapons[.:]$/.test(lines[0])) fail("sopros", text);
  const pt = ["O dragão usa um dos seguintes sopros:"];
  const es = ["El dragón usa uno de los siguientes alientos:"];
  for (const line of lines.slice(1)) {
    const m = /^(?:- )?\*\*(.+?)\.\*\* (.+)$/.exec(line);
    if (!m || !BREATH[m[1]]) fail("sopro da lista", line);
    const [dp, de] = breath(m[2], S);
    pt.push(`**${BREATH[m[1]][0]}.** ${dp}`);
    es.push(`**${BREATH[m[1]][1]}.** ${de}`);
  }
  return [pt.join("\n"), es.join("\n")];
}

function trait(key, name, text, pk) {
  const [S, Se] = who(pk);
  const t = norm(text);
  if (key === "legendary-resistance-3day" && t === "If the dragon fails a saving throw, it can choose to succeed instead.")
    return ["Resistência Lendária (3/dia)", "Se o dragão falhar num teste de resistência, pode escolher passar.", "Resistencia legendaria (3/día)", "Si el dragón falla una tirada de salvación, puede elegir superarla."];
  if (key === "amphibious" && /^The dragon( turtle)? can breathe air and water\.$/.test(t)) return ["Anfíbio", `${S} pode respirar ar e água.`, "Anfibio", `${Se} puede respirar aire y agua.`];
  if (key === "ice-walk" && t === "The dragon can move across and climb icy surfaces without needing to make an ability check. Additionally, difficult terrain composed of ice or snow doesn't cost it extra movement.")
    return [
      "Andar no Gelo",
      "O dragão pode andar e escalar superfícies geladas sem precisar fazer teste de habilidade. Além disso, terreno difícil de gelo ou neve não lhe custa deslocamento extra.",
      "Caminar sobre el hielo",
      "El dragón puede moverse por superficies heladas y trepar por ellas sin necesidad de hacer una prueba de característica. Además, el terreno difícil de hielo o nieve no le cuesta movimiento adicional.",
    ];
  if (key === "magic-resistance" && /^The pseudodragon has advantage/.test(t))
    return ["Resistência à Magia", "O pseudodragão tem vantagem em testes de resistência contra magias e outros efeitos mágicos.", "Resistencia mágica", "El seudodragón tiene ventaja en las tiradas de salvación contra conjuros y otros efectos mágicos."];
  if (key === "keen-senses")
    return ["Sentidos Aguçados", "O pseudodragão tem vantagem em testes de Sabedoria (Percepção) que dependam da visão, da audição ou do olfato.", "Sentidos agudos", "El seudodragón tiene ventaja en las pruebas de Sabiduría (Percepción) que dependan de la vista, el oído o el olfato."];
  const m = key === "limited-telepathy" && /within (\d+) feet of it/.exec(t);
  if (m)
    return [
      "Telepatia Limitada",
      `O pseudodragão pode comunicar magicamente, por telepatia, ideias, emoções e imagens simples a qualquer criatura a até ${m[1]} ft que entenda algum idioma.`,
      "Telepatía limitada",
      `El seudodragón puede comunicar mágicamente por telepatía ideas, emociones e imágenes sencillas a cualquier criatura a ${m[1]} ft o menos que entienda algún idioma.`,
    ];
  fail(`traço ${key} de ${pk}`, t);
}

const CHANGE_SHAPE = [
  "Mudar de Forma",
  "O dragão se transforma magicamente num humanoide ou numa fera com nível de desafio não maior que o seu, ou volta à forma verdadeira. Volta à forma verdadeira se morrer. O equipamento que veste ou carrega é absorvido ou levado pela forma nova (à escolha do dragão).\nNa forma nova, o dragão mantém a tendência, os pontos de vida, os Dados de Vida, a capacidade de falar, as proficiências, a Resistência Lendária, as ações de covil e os valores de Inteligência, Sabedoria e Carisma, além desta ação. As outras estatísticas e capacidades são trocadas pelas da forma nova, exceto características de classe ou ações lendárias dessa forma.",
  "Cambiar de forma",
  "El dragón se transforma mágicamente en un humanoide o una bestia con un valor de desafío no superior al suyo, o vuelve a su forma verdadera. Vuelve a su forma verdadera si muere. El equipo que lleve puesto o encima es absorbido o llevado por la nueva forma (a elección del dragón).\nEn la nueva forma, el dragón conserva su alineamiento, sus puntos de golpe, sus Dados de Golpe, la capacidad de hablar, sus competencias, su Resistencia legendaria, sus acciones de guarida y sus puntuaciones de Inteligencia, Sabiduría y Carisma, además de esta acción. Sus demás estadísticas y capacidades se sustituyen por las de la nueva forma, salvo los rasgos de clase o las acciones legendarias de esa forma.",
];

function action(key, name, text, pk) {
  const S = who(pk);
  const t = norm(text);
  if (BREATH[name]) {
    const [p, e] = breath(t, S);
    return [BREATH[name][0], p, BREATH[name][1], e];
  }
  if (key === "breath-weapons") {
    const [p, e] = breathWeapons(text, S);
    return ["Armas de Sopro", p, "Armas de aliento", e];
  }
  if (key === "change-shape") {
    if (!t.startsWith("The dragon magically polymorphs into a humanoid or beast")) fail("mudar de forma", t);
    return CHANGE_SHAPE;
  }
  if (key === "detect" && t === "The dragon makes a Wisdom (Perception) check.") return ["Detectar", "O dragão faz um teste de Sabedoria (Percepção).", "Detectar", "El dragón hace una prueba de Sabiduría (Percepción)."];
  if (key === "tail-attack" && t === "The dragon makes a tail attack.") return ["Ataque de Cauda", "O dragão faz um ataque de cauda.", "Ataque de cola", "El dragón hace un ataque de cola."];
  let m = key === "wing-attack" && /^The dragon beats its wings\. Each creature within (\d+) feet of the dragon must succeed on a DC (\d+) Dexterity saving throw or take (\d+ \(\d+d\d+ \+ \d+\)) bludgeoning damage and be knocked prone\. The dragon can then fly up to half its flying speed\.$/.exec(t);
  if (m)
    return [
      "Ataque de Asas",
      `O dragão bate as asas. Cada criatura a até ${m[1]} ft dele deve passar num teste de resistência de Destreza CD ${m[2]} ou sofre ${m[3]} de dano de concussão e cai. Depois o dragão pode voar até metade do seu deslocamento de voo.`,
      "Ataque con las alas",
      `El dragón bate las alas. Cada criatura a ${m[1]} ft o menos de él debe superar una tirada de salvación de Destreza CD ${m[2]} o recibe ${m[3]} de daño contundente y queda derribada. Después el dragón puede volar hasta la mitad de su velocidad volando.`,
    ];
  m = key === "frightful-presence" && /^Each creature of the dragon's choice that is within (\d+) feet of the dragon and aware of it must succeed on a DC (\d+) Wisdom saving throw or become frightened for 1 minute\. A creature can repeat the saving throw at the end of each of its turns, ending the effect on itself on a success\. If a creature's saving throw is successful or the effect ends for it, the creature is immune to the dragon's Frightful Presence for the next 24 hours\.$/.exec(t);
  if (m)
    return [
      "Presença Aterradora",
      `Cada criatura à escolha do dragão a até ${m[1]} ft dele e que saiba que ele está ali deve passar num teste de resistência de Sabedoria CD ${m[2]} ou fica amedrontada por 1 minuto. A criatura pode repetir o teste ao fim de cada um dos seus turnos, encerrando o efeito em si mesma se passar. Se passar ou o efeito acabar para ela, fica imune à Presença Aterradora do dragão pelas próximas 24 horas.`,
      "Presencia aterradora",
      `Cada criatura que elija el dragón a ${m[1]} ft o menos de él y que sea consciente de su presencia debe superar una tirada de salvación de Sabiduría CD ${m[2]} o queda asustada durante 1 minuto. La criatura puede repetir la tirada al final de cada uno de sus turnos y termina el efecto sobre sí misma si la supera. Si la supera o el efecto termina para ella, es inmune a la Presencia aterradora del dragón durante las siguientes 24 horas.`,
    ];
  if (key === "multiattack") {
    const MULTI = {
      "The dragon can use its Frightful Presence. It then makes three attacks: one with its bite and two with its claws.": [
        "O dragão pode usar a Presença Aterradora. Depois faz três ataques: um de mordida e dois de garras.",
        "El dragón puede usar su Presencia aterradora. Después hace tres ataques: uno de mordisco y dos de garras.",
      ],
      "The dragon makes three attacks: one with its bite and two with its claws.": ["O dragão faz três ataques: um de mordida e dois de garras.", "El dragón hace tres ataques: uno de mordisco y dos de garras."],
      "The dragon turtle makes three attacks: one with its bite and two with its claws. It can make one tail attack in place of its two claw attacks.": [
        "A tartaruga-dragão faz três ataques: um de mordida e dois de garras. Pode fazer um ataque de cauda no lugar dos dois de garras.",
        "La tortuga dragón hace tres ataques: uno de mordisco y dos de garras. Puede hacer un ataque de cola en lugar de los dos de garras.",
      ],
      "The veteran makes two longsword attacks. If it has a shortsword drawn, it can also make a shortsword attack.": [
        "O veterano faz dois ataques de espada longa. Se tiver uma espada curta na mão, também pode fazer um ataque com ela.",
        "El veterano hace dos ataques de espada larga. Si tiene una espada corta desenvainada, también puede hacer un ataque con ella.",
      ],
    };
    if (!MULTI[t]) fail("ataques múltiplos", t);
    return ["Ataques Múltiplos", MULTI[t][0], "Ataque múltiple", MULTI[t][1]];
  }
  fail(`ação ${key} de ${pk}`, t);
}

const pair = (display, map) => {
  if (!display) return undefined;
  const parts = display.split(/,\s*/).map((d) => map[d] ?? fail("dano", display));
  return [parts.map((p) => p[0]).join(", "), parts.map((p) => p[1]).join(", ")];
};

const out = {};
for (const c of creatures.sort((a, b) => a.pk.localeCompare(b.pk))) {
  const f = c.fields;
  const entry = {};
  if (f.languages_desc) entry.lang = LANG[f.languages_desc] ?? fail("idiomas", f.languages_desc);
  const res = pair(f.damage_resistances_display, DAMAGE);
  const imm = pair(f.damage_immunities_display, DAMAGE);
  if (res) entry.res = res;
  if (imm) entry.imm = imm;
  const ts = traits.filter((x) => x.fields.parent === c.pk);
  if (ts.length) entry.t = Object.fromEntries(ts.map((x) => { const k = x.pk.slice(c.pk.length + 1); return [k, trait(k, x.fields.name, x.fields.desc, c.pk)]; }));
  const as = actions.filter((x) => x.fields.parent === c.pk && !/Attack:/.test(x.fields.desc));
  if (as.length) entry.a = Object.fromEntries(as.map((x) => { const k = x.pk.slice(c.pk.length + 1); return [k, action(k, x.fields.name, x.fields.desc, c.pk)]; }));
  out[c.pk.slice(4)] = entry;
}

const file = join(import.meta.dirname, "texts", "lote-10.mjs");
writeFileSync(
  file,
  `// Lote 10 das habilidades (Passo 12, fase C): os dragões. GERADO por scripts/srd51/dragons.mjs, não edite à mão.\nexport default ${JSON.stringify(out, null, 2)};\n`,
);
console.log(`${Object.keys(out).length} dragões → ${file}`);
