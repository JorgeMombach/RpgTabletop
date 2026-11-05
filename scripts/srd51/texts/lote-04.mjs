// Lote 4 das habilidades (Passo 12, fase C): Javali Gigante a Gnoll. Formato em scripts/srd51/details.mjs.
import { ABYSSAL, amphibious, ANY_ONE, charge, flyby, hearingSmell, holdBreath, keen, magicRes, multi, NONMAGICAL, pack, parry, POISON, rampage, sight, smell, spiderClimb, standingLeap, waterBreathing, webSense, webWalker } from "./_comum.mjs";

/** Engolir (sapo e sapo-boi gigantes). */
const swallow = (pt, es, tamPt, tamEs, dano) => [
  "Engolir",
  `${pt} faz um ataque de mordida contra um alvo ${tamPt} ou menor que esteja agarrando. Se acertar, o alvo é engolido e deixa de estar agarrado. O alvo engolido fica cego e impedido, tem cobertura total contra ataques e outros efeitos de fora, e sofre ${dano} de dano de ácido no início de cada turno de quem o engoliu. Só pode ter um alvo engolido por vez.\nSe morrer, a criatura engolida deixa de estar impedida e pode escapar do cadáver usando 5 ft de deslocamento, saindo caída.`,
  "Engullir",
  `${es} hace un ataque de mordisco contra un objetivo ${tamEs} o más pequeño al que esté agarrando. Si impacta, el objetivo es engullido y deja de estar agarrado. El objetivo engullido queda cegado y apresado, tiene cobertura total contra ataques y otros efectos del exterior, y recibe ${dano} de daño de ácido al principio de cada turno de quien lo engulló. Solo puede tener un objetivo engullido a la vez.\nSi muere, la criatura engullida deja de estar apresada y puede escapar del cadáver usando 5 ft de movimiento, y sale derribada.`,
];
const spider = (pt, es) => ({ "spider-climb": spiderClimb(pt, es), "web-sense": webSense(pt.toLowerCase(), es.toLowerCase()), "web-walker": webWalker(pt, es) });

export default {
  "giant-boar": {
    t: {
      charge: charge("o javali", "presa", "7 (2d6) de dano cortante", "el jabalí", "colmillo", "7 (2d6) de daño cortante", 13),
      "relentless-recharges-after-a-short-or-long-rest": [
        "Implacável (recarrega após descanso curto ou longo)",
        "Se o javali sofrer 10 de dano ou menos que o deixaria com 0 pontos de vida, ele fica com 1 ponto de vida.",
        "Implacable (se recarga tras un descanso corto o largo)",
        "Si el jabalí recibe 10 de daño o menos que lo dejaría a 0 puntos de golpe, se queda a 1 punto de golpe.",
      ],
    },
  },
  "giant-centipede": {},
  "giant-constrictor-snake": {},
  "giant-crab": { t: { amphibious: amphibious("O caranguejo", "El cangrejo") } },
  "giant-crocodile": {
    t: { "hold-breath": holdBreath("O crocodilo", "30 minutos", "El cocodrilo", "30 minutos") },
    a: { multiattack: multi("O crocodilo faz dois ataques: um de mordida e um de cauda.", "El cocodrilo hace dos ataques: uno de mordisco y otro de cola.") },
  },
  "giant-eagle": {
    lang: ["Águia Gigante; entende Comum e Auran mas não fala", "Águila gigante; entiende común y aurano pero no habla"],
    t: { "keen-sight": sight("A águia", "El águila") },
    a: { multiattack: multi("A águia faz dois ataques: um de bico e um de garras.", "El águila hace dos ataques: uno de pico y otro de garras.") },
  },
  "giant-elk": {
    lang: ["Alce Gigante; entende Comum, Élfico e Silvestre mas não fala", "Alce gigante; entiende común, élfico y silvano pero no habla"],
    t: { charge: charge("o alce", "investida", "7 (2d6) de dano", "el alce", "embestida", "7 (2d6) de daño", 14) },
  },
  "giant-fire-beetle": {
    t: { illumination: ["Iluminação", "O besouro emite luz plena num raio de 10 ft e penumbra por mais 10 ft.", "Iluminación", "El escarabajo emite luz brillante en un radio de 10 ft y luz tenue 10 ft más allá."] },
  },
  "giant-frog": {
    t: { amphibious: amphibious("O sapo", "La rana"), "standing-leap": standingLeap("do sapo", "de la rana", 20, 10) },
    a: { swallow: swallow("O sapo", "La rana", "Pequeno", "Pequeño", "5 (2d4)") },
  },
  "giant-goat": {
    t: {
      charge: charge("o bode", "cabeçada", "5 (2d4) de dano de concussão", "la cabra", "embestida", "5 (2d4) de daño contundente", 13),
      "sure-footed": [
        "Passo Firme",
        "O bode tem vantagem em testes de resistência de Força e Destreza contra efeitos que o derrubariam.",
        "Pies firmes",
        "La cabra tiene ventaja en las tiradas de salvación de Fuerza y Destreza contra efectos que la derribarían.",
      ],
    },
  },
  "giant-hyena": { t: { rampage: rampage("a hiena", "la hiena") } },
  "giant-lizard": {
    t: {
      "variant-hold-breath": [
        "Variante: Prender a Respiração",
        "O lagarto pode prender a respiração por 15 minutos. (Um lagarto com este traço também tem deslocamento de natação de 30 ft.)",
        "Variante: aguantar la respiración",
        "El lagarto puede aguantar la respiración durante 15 minutos. (Un lagarto con este rasgo también tiene velocidad nadando de 30 ft.)",
      ],
      "variant-spider-climb": ((v) => ["Variante: " + v[0], v[1], "Variante: " + v[2].toLowerCase(), v[3]])(spiderClimb("O lagarto", "El lagarto")),
    },
  },
  "giant-octopus": {
    t: {
      "hold-breath": ["Prender a Respiração", "Fora da água, o polvo pode prender a respiração por 1 hora.", "Aguantar la respiración", "Fuera del agua, el pulpo puede aguantar la respiración durante 1 hora."],
      "underwater-camouflage": ["Camuflagem Subaquática", "O polvo tem vantagem em testes de Destreza (Furtividade) feitos debaixo d'água.", "Camuflaje subacuático", "El pulpo tiene ventaja en las pruebas de Destreza (Sigilo) que haga bajo el agua."],
      "water-breathing": waterBreathing("O polvo", "El pulpo"),
    },
    a: {
      "ink-cloud": [
        "Nuvem de Tinta",
        "Se estiver debaixo d'água, uma nuvem de tinta de 20 ft de raio se espalha ao redor do polvo. A área fica densamente obscurecida por 1 minuto, mas uma correnteza forte pode dispersar a tinta. Depois de soltar a tinta, o polvo pode usar a ação Disparada como ação bônus.",
        "Nube de tinta",
        "Si está bajo el agua, una nube de tinta de 20 ft de radio se extiende alrededor del pulpo. La zona queda muy oscurecida durante 1 minuto, aunque una corriente fuerte puede dispersar la tinta. Tras soltar la tinta, el pulpo puede usar la acción de Correr como acción adicional.",
      ],
    },
  },
  "giant-owl": {
    lang: ["Coruja Gigante; entende Comum, Élfico e Silvestre mas não fala", "Búho gigante; entiende común, élfico y silvano pero no habla"],
    t: { flyby: flyby("A coruja", "El búho"), "keen-hearing-and-sight": keen("Audição e Visão Aguçadas", "Oído y vista agudos", "A coruja", "El búho", "da audição ou da visão", "del oído o de la vista") },
  },
  "giant-poisonous-snake": {},
  "giant-rat": { t: { "keen-smell": smell("O rato", "La rata"), "pack-tactics": pack("O rato", "do rato", "La rata", "de la rata") } },
  "giant-rat-diseased": {},
  "giant-scorpion": { a: { multiattack: multi("O escorpião faz três ataques: dois de garras e um de ferrão.", "El escorpión hace tres ataques: dos de pinzas y uno de aguijón.") } },
  "giant-sea-horse": {
    t: {
      charge: charge("o cavalo-marinho", "investida", "7 (2d6) de dano de concussão", "el caballito de mar", "embestida", "7 (2d6) de daño contundente", 11),
      "water-breathing": waterBreathing("O cavalo-marinho", "El caballito de mar"),
    },
  },
  "giant-shark": {
    t: {
      "blood-frenzy": ["Frenesi Sanguinário", "O tubarão tem vantagem nas jogadas de ataque corpo a corpo contra qualquer criatura que não esteja com todos os pontos de vida.", "Frenesí sanguinario", "El tiburón tiene ventaja en las tiradas de ataque cuerpo a cuerpo contra cualquier criatura que no tenga todos sus puntos de golpe."],
      "water-breathing": waterBreathing("O tubarão", "El tiburón"),
    },
  },
  "giant-spider": { t: spider("A aranha", "La araña") },
  "giant-toad": {
    t: { amphibious: amphibious("O sapo-boi", "El sapo"), "standing-leap": standingLeap("do sapo-boi", "del sapo", 20, 10) },
    a: { swallow: swallow("O sapo-boi", "El sapo", "Médio", "Mediano", "10 (3d6)") },
  },
  "giant-vulture": {
    lang: ["entende Comum mas não fala", "entiende común pero no habla"],
    t: {
      "keen-sight-and-smell": keen("Visão e Olfato Aguçados", "Vista y olfato agudos", "O abutre", "El buitre", "da visão ou do olfato", "de la vista o del olfato"),
      "pack-tactics": pack("O abutre", "do abutre", "El buitre", "del buitre"),
    },
    a: { multiattack: multi("O abutre faz dois ataques: um de bico e um de garras.", "El buitre hace dos ataques: uno de pico y otro de garras.") },
  },
  "giant-wasp": {},
  "giant-weasel": { t: { "keen-hearing-and-smell": hearingSmell("A doninha", "La comadreja") } },
  "giant-wolf-spider": { t: spider("A aranha", "La araña") },
  "gibbering-mouther": {
    t: {
      "aberrant-ground": [
        "Solo Aberrante",
        "O chão num raio de 10 ft ao redor da boca vira uma massa mole de terreno difícil. Cada criatura que comece o turno nessa área deve passar num teste de resistência de Força CD 10 ou fica com deslocamento 0 até o início do seu próximo turno.",
        "Suelo aberrante",
        "El suelo en un radio de 10 ft alrededor de la boca se vuelve una masa blanda de terreno difícil. Cada criatura que empiece su turno en esa zona debe superar una tirada de salvación de Fuerza CD 10 o su velocidad se reduce a 0 hasta el principio de su siguiente turno.",
      ],
      gibbering: [
        "Algaravia",
        "A boca balbucia sem nexo enquanto puder ver alguma criatura e não estiver incapacitada. Cada criatura que comece o turno a até 20 ft dela e possa ouvir a algaravia deve passar num teste de resistência de Sabedoria CD 10. Se falhar, não pode usar reações até o início do seu próximo turno e rola um d8 para ver o que faz no turno. Com 1 a 4, não faz nada. Com 5 ou 6, não usa ação nem ação bônus e usa todo o deslocamento para se mover numa direção sorteada. Com 7 ou 8, faz um ataque corpo a corpo contra uma criatura sorteada ao seu alcance, ou não faz nada se não puder.",
        "Farfulla",
        "La boca balbucea sin sentido mientras pueda ver a alguna criatura y no esté incapacitada. Cada criatura que empiece su turno a 20 ft o menos de ella y pueda oír la farfulla debe superar una tirada de salvación de Sabiduría CD 10. Si falla, no puede usar reacciones hasta el principio de su siguiente turno y tira un d8 para ver qué hace en su turno. Con 1 a 4, no hace nada. Con 5 o 6, no usa acción ni acción adicional y usa todo su movimiento para moverse en una dirección al azar. Con 7 u 8, hace un ataque cuerpo a cuerpo contra una criatura al azar a su alcance, o no hace nada si no puede.",
      ],
    },
    a: {
      "blinding-spittle": [
        "Cuspe Cegante",
        "A boca cospe uma bola de gosma química num ponto que possa ver a até 15 ft. A bola explode num clarão cegante ao bater. Cada criatura a até 5 ft do clarão deve passar num teste de resistência de Destreza CD 13 ou fica cega até o fim do próximo turno da boca.",
        "Escupitajo cegador",
        "La boca escupe un pegote químico a un punto que pueda ver a 15 ft o menos. El pegote estalla en un destello cegador al impactar. Cada criatura a 5 ft o menos del destello debe superar una tirada de salvación de Destreza CD 13 o queda cegada hasta el final del siguiente turno de la boca.",
      ],
      multiattack: multi("A boca faz um ataque de mordida e, se puder, usa Cuspe Cegante.", "La boca hace un ataque de mordisco y, si puede, usa Escupitajo cegador."),
    },
  },
  glabrezu: {
    lang: ABYSSAL,
    res: ["frio, fogo, elétrico; " + NONMAGICAL[0], "frío, fuego, relámpago; " + NONMAGICAL[1]],
    imm: POISON,
    t: {
      "innate-spellcasting": [
        "Conjuração Inata",
        "A habilidade de conjuração do glabrezu é Inteligência (CD de resistência de magia 16). Ele pode conjurar as seguintes magias de forma inata, sem precisar de componentes materiais:\nÀ vontade: escuridão, detectar magia, dissipar magia\n1/dia cada: confusão, voo, palavra de poder atordoar",
        "Lanzamiento de conjuros innato",
        "La aptitud mágica del glabrezu es Inteligencia (CD de salvación de conjuros 16). Puede lanzar de forma innata los siguientes conjuros sin necesidad de componentes materiales:\nA voluntad: oscuridad, detectar magia, disipar magia\n1/día cada uno: confusión, volar, palabra de poder: aturdir",
      ],
      "magic-resistance": magicRes("O glabrezu", "El glabrezu"),
    },
    a: {
      multiattack: multi(
        "O glabrezu faz quatro ataques: dois de pinça e dois de punho. Ou então faz dois ataques de pinça e conjura uma magia.",
        "El glabrezu hace cuatro ataques: dos de pinza y dos de puño. O bien hace dos ataques de pinza y lanza un conjuro.",
      ),
    },
  },
  gladiator: {
    lang: ANY_ONE,
    t: {
      brave: ["Bravura", "O gladiador tem vantagem em testes de resistência contra ficar amedrontado.", "Valiente", "El gladiador tiene ventaja en las tiradas de salvación para no quedar asustado."],
      brute: ["Bruto", "Uma arma corpo a corpo causa um dado extra do seu dano quando o gladiador acerta com ela (já incluído no ataque).", "Bruto", "Un arma cuerpo a cuerpo inflige un dado adicional de su daño cuando el gladiador impacta con ella (incluido en el ataque)."],
    },
    a: {
      multiattack: multi("O gladiador faz três ataques corpo a corpo ou dois ataques à distância.", "El gladiador hace tres ataques cuerpo a cuerpo o dos ataques a distancia."),
      parry: parry("O gladiador", "El gladiador", 3),
    },
  },
  gnoll: { lang: ["Gnoll", "Gnoll"], t: { rampage: rampage("o gnoll", "el gnoll") } },
};
