// Lote 9 das habilidades (Passo 12, fase C): Enxame de Insetos a Zumbi, os últimos 40 sem ser dragão. Formato em scripts/srd51/details.mjs.
import { ABYSSAL, ANY_ONE, charge, falseAppearance, hearingSmell, keen, magicRes, magicWeapons, multi, NONMAGICAL, pack, POISON, SILVER, smell, spiderClimb, sunlight, waterBreathing, webSense, webWalker } from "./_comum.mjs";

const SWARM_RES = ["concussão, perfurante, cortante", "contundente, perforante, cortante"];
const SWARM = (bichoPt, bichoEs) => [
  "Enxame",
  `O enxame pode ocupar o espaço de outra criatura e vice-versa, e pode passar por qualquer abertura grande o bastante para ${bichoPt} Miúdo. O enxame não pode recuperar pontos de vida nem ganhar pontos de vida temporários.`,
  "Enjambre",
  `El enjambre puede ocupar el espacio de otra criatura y viceversa, y puede pasar por cualquier abertura lo bastante grande para ${bichoEs} Diminuto. El enjambre no puede recuperar puntos de golpe ni obtener puntos de golpe temporales.`,
];
const swarm = (bichoPt, bichoEs, t = {}) => ({ res: SWARM_RES, t: { ...t, swarm: SWARM(bichoPt, bichoEs) } });
const INSECT = ["um inseto", "un insecto"];
const POUNCE = (nomePt, pt, nomeEs, es, ft, cd) => [
  nomePt,
  `Se ${pt} se mover pelo menos ${ft} ft em linha reta até uma criatura e a acertar com um ataque de garras no mesmo turno, o alvo deve passar num teste de resistência de Força CD ${cd} ou cai. Se o alvo estiver caído, pode fazer um ataque de mordida contra ele como ação bônus.`,
  nomeEs,
  `Si ${es} se mueve al menos ${ft} ft en línea recta hacia una criatura y la impacta con un ataque de garras en el mismo turno, el objetivo debe superar una tirada de salvación de Fuerza CD ${cd} o queda derribado. Si el objetivo está derribado, puede hacer un ataque de mordisco contra él como acción adicional.`,
];
const TRAMPLE = (pt, es, cd, ataquePt, ataqueEs, golpePt, golpeEs) => [
  "Investida Atropeladora",
  `Se ${pt} se mover pelo menos 20 ft em linha reta até uma criatura e a acertar com um ataque de ${ataquePt} no mesmo turno, o alvo deve passar num teste de resistência de Força CD ${cd} ou cai. Se o alvo estiver caído, pode fazer ${golpePt} contra ele como ação bônus.`,
  "Carga arrolladora",
  `Si ${es} se mueve al menos 20 ft en línea recta hacia una criatura y la impacta con un ataque de ${ataqueEs} en el mismo turno, el objetivo debe superar una tirada de salvación de Fuerza CD ${cd} o queda derribado. Si el objetivo está derribado, puede hacer ${golpeEs} contra él como acción adicional.`,
];
const LEGENDARY_RES = (pt, es) => ["Resistência Lendária (3/dia)", `Se ${pt} falhar num teste de resistência, pode escolher passar.`, "Resistencia legendaria (3/día)", `Si ${es} falla una tirada de salvación, puede elegir superarla.`];
const SIEGE = (pt, es) => ["Monstro de Cerco", `${pt} causa o dobro de dano a objetos e estruturas.`, "Monstruo de asedio", `${es} inflige el doble de daño a objetos y estructuras.`];
const INCORPOREAL = (pt, es) => [
  "Movimento Incorpóreo",
  `${pt} pode atravessar outras criaturas e objetos como se fossem terreno difícil. Sofre 5 (1d10) de dano de energia se terminar o turno dentro de um objeto.`,
  "Movimiento incorpóreo",
  `${es} puede atravesar otras criaturas y objetos como si fueran terreno difícil. Recibe 5 (1d10) de daño de fuerza si termina su turno dentro de un objeto.`,
];
const LIFE_LANG = ["os idiomas que conhecia em vida", "los idiomas que conocía en vida"];
const UNDEAD_RES = ["ácido, frio, fogo, elétrico, trovejante; ", "ácido, frío, fuego, relámpago, trueno; "];
const VAMP_RES = ["necrótico; " + NONMAGICAL[0], "necrótico; " + NONMAGICAL[1]];
/** Licantropos: `formaPt`/`formaEs` = "um híbrido de urso e humanoide Grande ou um urso Grande"; `excetoPt` = "o tamanho e a CA". */
const WERE = (pt, es, formaPt, formaEs, excetoPt, excetoEs) => [
  "Metamorfo",
  `${pt} pode usar a ação para se transformar em ${formaPt}, ou voltar à forma verdadeira, que é humanoide. Fora ${excetoPt}, as estatísticas são as mesmas em todas as formas. O equipamento que veste ou carrega não se transforma. Volta à forma verdadeira se morrer.`,
  "Cambiaformas",
  `${es} puede usar su acción para transformarse en ${formaEs}, o volver a su forma verdadera, que es humanoide. Salvo ${excetoEs}, sus estadísticas son las mismas en todas las formas. El equipo que lleve puesto o encima no se transforma. Vuelve a su forma verdadera si muere.`,
];
const WERE_LANG = (bichoPt, bichoEs) => [`Comum (não fala na forma de ${bichoPt})`, `Común (no habla en forma de ${bichoEs})`];
const WERE_IMM = SILVER;
const VAMP_WEAK = (estacaPt, estacaEs) => [
  "Fraquezas de Vampiro",
  `O vampiro tem os seguintes defeitos:\n**Proibição.** O vampiro não pode entrar numa residência sem o convite de um dos moradores.\n**Ferido por Água Corrente.** O vampiro sofre 20 de dano de ácido se terminar o turno em água corrente.\n**Estaca no Coração.** ${estacaPt}\n**Hipersensibilidade à Luz Solar.** O vampiro sofre 20 de dano radiante quando começa o turno sob a luz do sol. Sob a luz do sol, tem desvantagem nas jogadas de ataque e testes de habilidade.`,
  "Debilidades de vampiro",
  `El vampiro tiene los siguientes defectos:\n**Prohibición.** El vampiro no puede entrar en una residencia sin la invitación de uno de sus ocupantes.\n**Dañado por el agua corriente.** El vampiro recibe 20 de daño de ácido si termina su turno en agua corriente.\n**Estaca en el corazón.** ${estacaEs}\n**Hipersensibilidad a la luz solar.** El vampiro recibe 20 de daño radiante cuando empieza su turno bajo la luz del sol. Bajo la luz del sol, tiene desventaja en las tiradas de ataque y las pruebas de característica.`,
];
const VAMP_REGEN = (n) => [
  "Regeneração",
  `O vampiro recupera ${n} pontos de vida no início do turno se tiver pelo menos 1 ponto de vida e não estiver sob a luz do sol nem em água corrente. Se sofrer dano radiante ou de água benta, este traço não funciona no início do seu próximo turno.`,
  "Regeneración",
  `El vampiro recupera ${n} puntos de golpe al principio de su turno si tiene al menos 1 punto de golpe y no está bajo la luz del sol ni en agua corriente. Si recibe daño radiante o de agua bendita, este rasgo no funciona al principio de su siguiente turno.`,
];
const VAMP_MULTI = multi("O vampiro faz dois ataques, e só um deles pode ser de mordida.", "El vampiro hace dos ataques, y solo uno de ellos puede ser de mordisco.");
const UNDEAD_FORT = [
  "Fortitude Morta-Viva",
  "Se um dano reduzir o zumbi a 0 pontos de vida, ele deve fazer um teste de resistência de Constituição com CD 5 + o dano sofrido, a menos que o dano seja radiante ou de um acerto crítico. Se passar, fica com 1 ponto de vida.",
  "Fortaleza de muerto viviente",
  "Si un daño reduce al zombi a 0 puntos de golpe, debe hacer una tirada de salvación de Constitución con CD 5 + el daño recibido, salvo que el daño sea radiante o de un crítico. Si la supera, se queda a 1 punto de golpe.",
];
const STONE_CAMO = (pt, es) => ["Camuflagem nas Pedras", `${pt} tem vantagem em testes de Destreza (Furtividade) para se esconder em terreno rochoso.`, "Camuflaje en la piedra", `${es} tiene ventaja en las pruebas de Destreza (Sigilo) para esconderse en terreno rocoso.`];
const WOLF = (pt, ptDe, es, esDe) => ({ "keen-hearing-and-smell": hearingSmell(pt, es), "pack-tactics": pack(pt, ptDe, es, esDe) });

export default {
  "swarm-of-insects": swarm(...INSECT),
  "swarm-of-poisonous-snakes": swarm("uma cobra", "una serpiente"),
  "swarm-of-quippers": swarm("uma piranha", "una piraña", {
    "blood-frenzy": ["Frenesi Sanguinário", "O enxame tem vantagem nas jogadas de ataque corpo a corpo contra qualquer criatura que não esteja com todos os pontos de vida.", "Frenesí sanguinario", "El enjambre tiene ventaja en las tiradas de ataque cuerpo a cuerpo contra cualquier criatura que no tenga todos sus puntos de golpe."],
    "water-breathing": waterBreathing("O enxame", "El enjambre"),
  }),
  "swarm-of-rats": swarm("um rato", "una rata", { "keen-smell": smell("O enxame", "El enjambre") }),
  "swarm-of-ravens": swarm("um corvo", "un cuervo"),
  "swarm-of-spiders": swarm(...INSECT, { "spider-climb": spiderClimb("O enxame", "El enjambre"), "web-sense": webSense("o enxame", "el enjambre"), "web-walker": webWalker("O enxame", "El enjambre") }),
  "swarm-of-wasps": swarm(...INSECT),
  tarrasque: {
    imm: ["fogo, veneno; " + NONMAGICAL[0], "fuego, veneno; " + NONMAGICAL[1]],
    t: {
      "legendary-resistance-3day": LEGENDARY_RES("o tarrasque", "la tarasca"),
      "magic-resistance": magicRes("O tarrasque", "La tarasca"),
      "reflective-carapace": [
        "Carapaça Refletora",
        "Sempre que o tarrasque for alvo da magia mísseis mágicos, de uma magia em linha ou de uma magia que exija jogada de ataque à distância, role um d6. Com 1 a 5, o tarrasque não é afetado. Com 6, não é afetado e o efeito volta contra o conjurador, como se viesse do tarrasque, e o conjurador vira o alvo.",
        "Caparazón reflectante",
        "Cada vez que la tarasca sea objetivo del conjuro proyectil mágico, de un conjuro en línea o de un conjuro que requiera una tirada de ataque a distancia, tira un d6. Con 1 a 5, la tarasca no se ve afectada. Con 6, no se ve afectada y el efecto rebota contra el lanzador, como si procediera de la tarasca, y el lanzador pasa a ser el objetivo.",
      ],
      "siege-monster": SIEGE("O tarrasque", "La tarasca"),
    },
    a: {
      attack: ["Ataque", "O tarrasque faz um ataque de garra ou de cauda.", "Ataque", "La tarasca hace un ataque de garra o de cola."],
      chomp: ["Abocanhar", "O tarrasque faz um ataque de mordida ou usa Engolir.", "Mordisco", "La tarasca hace un ataque de mordisco o usa Engullir."],
      "frightful-presence": [
        "Presença Aterradora",
        "Cada criatura à escolha do tarrasque a até 120 ft dele e que saiba que ele está ali deve passar num teste de resistência de Sabedoria CD 17 ou fica amedrontada por 1 minuto. A criatura pode repetir o teste ao fim de cada um dos seus turnos, com desvantagem se o tarrasque estiver na sua linha de visão, encerrando o efeito em si mesma se passar. Se passar ou o efeito acabar para ela, fica imune à Presença Aterradora do tarrasque pelas próximas 24 horas.",
        "Presencia aterradora",
        "Cada criatura que elija la tarasca a 120 ft o menos de ella y que sea consciente de su presencia debe superar una tirada de salvación de Sabiduría CD 17 o queda asustada durante 1 minuto. La criatura puede repetir la tirada al final de cada uno de sus turnos, con desventaja si la tarasca está en su línea de visión, y termina el efecto sobre sí misma si la supera. Si la supera o el efecto termina para ella, es inmune a la Presencia aterradora de la tarasca durante las siguientes 24 horas.",
      ],
      move: ["Mover", "O tarrasque se move até metade do deslocamento.", "Moverse", "La tarasca se mueve hasta la mitad de su velocidad."],
      multiattack: multi(
        "O tarrasque pode usar a Presença Aterradora. Depois faz cinco ataques: um de mordida, dois de garras, um de chifres e um de cauda. Pode usar Engolir no lugar da mordida.",
        "La tarasca puede usar su Presencia aterradora. Después hace cinco ataques: uno de mordisco, dos de garras, uno de cuernos y uno de cola. Puede usar Engullir en lugar del mordisco.",
      ),
      swallow: [
        "Engolir",
        "O tarrasque faz um ataque de mordida contra uma criatura Grande ou menor que esteja agarrando. Se acertar, o alvo sofre o dano da mordida, é engolido e deixa de estar agarrado. Engolida, a criatura fica cega e impedida, tem cobertura total contra ataques e outros efeitos de fora do tarrasque, e sofre 56 (16d6) de dano de ácido no início de cada turno dele.\nSe o tarrasque sofrer 60 de dano ou mais num único turno de uma criatura dentro dele, deve passar num teste de resistência de Constituição CD 20 no fim desse turno ou regurgita todas as criaturas engolidas, que caem num espaço a até 10 ft dele. Se o tarrasque morrer, a criatura engolida deixa de estar impedida e pode escapar do cadáver usando 30 ft de deslocamento, saindo caída.",
        "Engullir",
        "La tarasca hace un ataque de mordisco contra una criatura Grande o más pequeña a la que esté agarrando. Si impacta, el objetivo recibe el daño del mordisco, es engullido y deja de estar agarrado. Mientras está engullida, la criatura está cegada y apresada, tiene cobertura total contra ataques y otros efectos del exterior de la tarasca, y recibe 56 (16d6) de daño de ácido al principio de cada turno de esta.\nSi la tarasca recibe 60 de daño o más en un solo turno de una criatura que tenga dentro, debe superar una tirada de salvación de Constitución CD 20 al final de ese turno o regurgita a todas las criaturas engullidas, que caen derribadas en un espacio a 10 ft o menos de ella. Si la tarasca muere, la criatura engullida deja de estar apresada y puede escapar del cadáver usando 30 ft de movimiento, y sale derribada.",
      ],
    },
  },
  thug: {
    lang: ANY_ONE,
    t: { "pack-tactics": pack("O brutamontes", "do brutamontes", "El matón", "del matón") },
    a: { multiattack: multi("O brutamontes faz dois ataques corpo a corpo.", "El matón hace dos ataques cuerpo a cuerpo.") },
  },
  tiger: { t: { "keen-smell": smell("O tigre", "El tigre"), pounce: POUNCE("Bote", "o tigre", "Abalanzarse", "el tigre", 20, 13) } },
  treant: {
    lang: ["Comum, Druídico, Élfico, Silvestre", "Común, druídico, élfico, silvano"],
    res: ["concussão, perfurante", "contundente, perforante"],
    vul: ["fogo", "fuego"],
    t: { "false-appearance": falseAppearance("o ente", "uma árvore comum", "el ent", "un árbol normal"), "siege-monster": SIEGE("O ente", "El ent") },
    a: {
      "animate-trees": [
        "Animar Árvores",
        "O ente anima magicamente uma ou duas árvores que possa ver a até 60 ft. Essas árvores têm as mesmas estatísticas de um ente, exceto que têm Inteligência e Carisma 1, não falam e só têm a ação Pancada. Uma árvore animada age como aliada do ente. Ela continua animada por 1 dia ou até morrer, até o ente morrer ou ficar a mais de 120 ft dela, ou até o ente usar uma ação bônus para torná-la de novo uma árvore comum. A árvore então cria raízes, se puder.",
        "Animar árboles",
        "El ent anima mágicamente uno o dos árboles que pueda ver a 60 ft o menos. Estos árboles tienen las mismas estadísticas que un ent, salvo que tienen Inteligencia y Carisma 1, no pueden hablar y solo tienen la acción Golpe. Un árbol animado actúa como aliado del ent. Sigue animado durante 1 día o hasta que muera, hasta que el ent muera o esté a más de 120 ft de él, o hasta que el ent use una acción adicional para devolverlo a su estado de árbol normal. El árbol echa entonces raíces, si puede.",
      ],
      multiattack: multi("O ente faz dois ataques de pancada.", "El ent hace dos ataques de golpe."),
    },
  },
  "tribal-warrior": {
    lang: ["um idioma qualquer", "un idioma cualquiera"],
    t: { "pack-tactics": pack("O guerreiro", "do guerreiro", "El guerrero", "del guerrero") },
  },
  triceratops: { t: { "trampling-charge": TRAMPLE("o tricerátopo", "el triceratops", 13, "chifrada", "cornada", "um ataque de pisotear", "un ataque de pisotón") } },
  troll: {
    lang: ["Gigante", "Gigante"],
    t: {
      "keen-smell": smell("O troll", "El trol"),
      regeneration: [
        "Regeneração",
        "O troll recupera 10 pontos de vida no início do turno. Se sofrer dano de ácido ou de fogo, este traço não funciona no início do seu próximo turno. O troll só morre se começar o turno com 0 pontos de vida e não se regenerar.",
        "Regeneración",
        "El trol recupera 10 puntos de golpe al principio de su turno. Si recibe daño de ácido o de fuego, este rasgo no funciona al principio de su siguiente turno. El trol solo muere si empieza su turno con 0 puntos de golpe y no se regenera.",
      ],
    },
    a: { multiattack: multi("O troll faz três ataques: um de mordida e dois de garras.", "El trol hace tres ataques: uno de mordisco y dos de garras.") },
  },
  "tyrannosaurus-rex": {
    a: { multiattack: multi("O tiranossauro faz dois ataques: um de mordida e um de cauda. Não pode fazer os dois contra o mesmo alvo.", "El tiranosaurio hace dos ataques: uno de mordisco y otro de cola. No puede hacer ambos contra el mismo objetivo.") },
  },
  unicorn: {
    lang: ["Celestial, Élfico, Silvestre, telepatia 60 ft", "Celestial, élfico, silvano, telepatía 60 ft"],
    imm: POISON,
    t: {
      charge: charge("o unicórnio", "chifre", "9 (2d8) de dano perfurante", "el unicornio", "cuerno", "9 (2d8) de daño perforante", 15),
      "innate-spellcasting": [
        "Conjuração Inata",
        "A habilidade de conjuração inata do unicórnio é Carisma (CD de resistência de magia 14). Ele pode conjurar as seguintes magias de forma inata, sem precisar de componentes:\n\nÀ vontade: detectar o bem e o mal, arte druídica, passos sem pegadas\n1/dia cada: acalmar emoções, dissipar o bem e o mal, constrição",
        "Lanzamiento de conjuros innato",
        "La aptitud mágica innata del unicornio es Carisma (CD de salvación de conjuros 14). Puede lanzar de forma innata los siguientes conjuros sin necesidad de componentes:\n\nA voluntad: detectar el bien y el mal, druidismo, pasar sin rastro\n1/día cada uno: calmar emociones, disipar el bien y el mal, enmarañar",
      ],
      "magic-resistance": magicRes("O unicórnio", "El unicornio"),
      "magic-weapons": magicWeapons("do unicórnio", "del unicornio"),
    },
    a: {
      "heal-self": ["Curar a Si Mesmo", "O unicórnio recupera magicamente 11 (2d8 + 2) pontos de vida.", "Curarse", "El unicornio recupera mágicamente 11 (2d8 + 2) puntos de golpe."],
      "healing-touch": [
        "Toque Curativo",
        "O unicórnio toca outra criatura com o chifre. O alvo recupera magicamente 11 (2d8 + 2) pontos de vida. Além disso, o toque cura todas as doenças e neutraliza todos os venenos que afetam o alvo.",
        "Toque curativo",
        "El unicornio toca a otra criatura con su cuerno. El objetivo recupera mágicamente 11 (2d8 + 2) puntos de golpe. Además, el toque cura todas las enfermedades y neutraliza todos los venenos que afectan al objetivo.",
      ],
      "legendary-hooves": ["Cascos", "O unicórnio faz um ataque de cascos.", "Pezuñas", "El unicornio hace un ataque de pezuñas."],
      multiattack: multi("O unicórnio faz dois ataques: um de cascos e um de chifre.", "El unicornio hace dos ataques: uno de pezuñas y otro de cuerno."),
      "shimmering-shield": [
        "Escudo Cintilante",
        "O unicórnio cria um campo mágico cintilante em volta de si ou de outra criatura que possa ver a até 60 ft. O alvo ganha +2 de bônus na CA até o fim do próximo turno do unicórnio.",
        "Escudo centelleante",
        "El unicornio crea un campo mágico centelleante alrededor de sí mismo o de otra criatura que pueda ver a 60 ft o menos. El objetivo obtiene un bonificador de +2 a la CA hasta el final del siguiente turno del unicornio.",
      ],
      teleport: [
        "Teletransporte",
        "O unicórnio se teletransporta magicamente com até três criaturas voluntárias que possa ver a até 5 ft, junto com todo o equipamento que vestem ou carregam, para um lugar que conheça a até 1,5 km.",
        "Teletransporte",
        "El unicornio se teletransporta mágicamente junto con hasta tres criaturas voluntarias que pueda ver a 5 ft o menos, con todo el equipo que lleven puesto o encima, a un lugar que conozca a 1,5 km o menos.",
      ],
    },
  },
  vampire: {
    lang: LIFE_LANG,
    res: VAMP_RES,
    t: {
      "legendary-resistance-3day": LEGENDARY_RES("o vampiro", "el vampiro"),
      "misty-escape": [
        "Fuga em Névoa",
        "Quando chega a 0 pontos de vida fora do seu lugar de descanso, o vampiro se transforma numa nuvem de névoa (como no traço Metamorfo) em vez de cair inconsciente, desde que não esteja sob a luz do sol nem em água corrente. Se não puder se transformar, é destruído.\nCom 0 pontos de vida na forma de névoa, não pode voltar à forma de vampiro e precisa chegar ao lugar de descanso em até 2 horas ou é destruído. Lá, volta à forma de vampiro e fica paralisado até recuperar pelo menos 1 ponto de vida. Depois de passar 1 hora no lugar de descanso com 0 pontos de vida, recupera 1 ponto de vida.",
        "Huida neblinosa",
        "Cuando cae a 0 puntos de golpe fuera de su lugar de descanso, el vampiro se transforma en una nube de niebla (como en el rasgo Cambiaformas) en lugar de quedar inconsciente, siempre que no esté bajo la luz del sol ni en agua corriente. Si no puede transformarse, es destruido.\nCon 0 puntos de golpe en forma de niebla, no puede volver a su forma de vampiro y debe llegar a su lugar de descanso en 2 horas o menos o es destruido. Allí, vuelve a su forma de vampiro y queda paralizado hasta recuperar al menos 1 punto de golpe. Tras pasar 1 hora en su lugar de descanso con 0 puntos de golpe, recupera 1 punto de golpe.",
      ],
      regeneration: VAMP_REGEN(20),
      shapechanger: [
        "Metamorfo",
        "Se não estiver sob a luz do sol nem em água corrente, o vampiro pode usar a ação para se transformar num morcego Miúdo ou numa nuvem de névoa Média, ou voltar à forma verdadeira.\nNa forma de morcego, o vampiro não fala, tem deslocamento de 5 ft e voo de 30 ft. Fora o tamanho e o deslocamento, as estatísticas não mudam. O que veste se transforma junto, mas o que carrega não. Volta à forma verdadeira se morrer.\nNa forma de névoa, o vampiro não pode fazer nenhuma ação, falar nem manipular objetos. Não tem peso, tem voo de 20 ft, pode pairar e pode entrar no espaço de uma criatura hostil e parar ali. Além disso, se o ar passar por um espaço, a névoa também passa, sem se espremer, mas não atravessa água. Tem vantagem em testes de resistência de Força, Destreza e Constituição, e é imune a todo dano não mágico, exceto o que sofre da luz do sol.",
        "Cambiaformas",
        "Si no está bajo la luz del sol ni en agua corriente, el vampiro puede usar su acción para transformarse en un murciélago Diminuto o en una nube de niebla Mediana, o volver a su forma verdadera.\nEn forma de murciélago, el vampiro no puede hablar, tiene una velocidad de 5 ft y volando de 30 ft. Salvo el tamaño y la velocidad, sus estadísticas no cambian. Lo que lleva puesto se transforma con él, pero lo que lleva encima no. Vuelve a su forma verdadera si muere.\nEn forma de niebla, el vampiro no puede hacer ninguna acción, hablar ni manipular objetos. No pesa, tiene una velocidad volando de 20 ft, puede levitar y puede entrar en el espacio de una criatura hostil y detenerse allí. Además, si el aire puede pasar por un espacio, la niebla también, sin apretarse, pero no puede atravesar el agua. Tiene ventaja en las tiradas de salvación de Fuerza, Destreza y Constitución, y es inmune a todo daño no mágico, salvo el que recibe de la luz del sol.",
      ],
      "spider-climb": spiderClimb("O vampiro", "El vampiro"),
      "vampire-weaknesses": VAMP_WEAK(
        "Se uma arma perfurante de madeira for cravada no coração do vampiro enquanto ele estiver incapacitado no lugar de descanso, ele fica paralisado até a estaca ser removida.",
        "Si se clava un arma perforante de madera en el corazón del vampiro mientras está incapacitado en su lugar de descanso, queda paralizado hasta que se retire la estaca.",
      ),
    },
    a: {
      charm: [
        "Enfeitiçar",
        "O vampiro escolhe um humanoide que possa ver a até 30 ft. Se o alvo puder ver o vampiro, deve passar num teste de resistência de Sabedoria CD 17 contra esta magia ou fica enfeitiçado pelo vampiro. O alvo enfeitiçado vê o vampiro como um amigo de confiança, a ser ouvido e protegido. Embora não esteja sob o controle do vampiro, recebe os pedidos e as ações dele da forma mais favorável possível, e é um alvo voluntário para a mordida do vampiro.\nSempre que o vampiro ou seus companheiros fizerem algo nocivo ao alvo, ele pode repetir o teste, encerrando o efeito em si mesmo se passar. Fora isso, o efeito dura 24 horas ou até o vampiro ser destruído, estar num plano de existência diferente do alvo ou usar uma ação bônus para encerrá-lo.",
        "Hechizar",
        "El vampiro elige a un humanoide que pueda ver a 30 ft o menos. Si el objetivo puede ver al vampiro, debe superar una tirada de salvación de Sabiduría CD 17 contra esta magia o queda hechizado por el vampiro. El objetivo hechizado ve al vampiro como un amigo de confianza al que escuchar y proteger. Aunque no está bajo el control del vampiro, interpreta sus peticiones y acciones de la forma más favorable posible, y es un objetivo voluntario para el mordisco del vampiro.\nCada vez que el vampiro o sus compañeros hagan algo dañino al objetivo, este puede repetir la tirada y termina el efecto sobre sí mismo si la supera. Si no, el efecto dura 24 horas o hasta que el vampiro sea destruido, esté en un plano de existencia distinto del objetivo o use una acción adicional para terminarlo.",
      ],
      "children-of-the-night": [
        "Filhos da Noite",
        "O vampiro chama magicamente 2d4 enxames de morcegos ou de ratos, desde que o sol não esteja no céu. Ao ar livre, pode chamar 3d6 lobos no lugar. As criaturas chegam em 1d4 rodadas, agem como aliadas do vampiro e obedecem às suas ordens faladas. As feras ficam por 1 hora, até o vampiro morrer ou até ele dispensá-las como ação bônus.",
        "Hijos de la noche",
        "El vampiro llama mágicamente a 2d4 enjambres de murciélagos o de ratas, siempre que no haya salido el sol. Al aire libre, puede llamar a 3d6 lobos en su lugar. Las criaturas llegan en 1d4 asaltos, actúan como aliadas del vampiro y obedecen sus órdenes verbales. Las bestias se quedan durante 1 hora, hasta que el vampiro muera o hasta que las despida como acción adicional.",
      ],
      "legendary-bite": ["Mordida", "O vampiro faz um ataque de mordida.", "Mordisco", "El vampiro hace un ataque de mordisco."],
      "legendary-unarmed-strike": ["Ataque Desarmado", "O vampiro faz um ataque desarmado.", "Ataque sin armas", "El vampiro hace un ataque sin armas."],
      move: ["Mover", "O vampiro se move até o seu deslocamento sem provocar ataques de oportunidade.", "Moverse", "El vampiro se mueve hasta su velocidad sin provocar ataques de oportunidad."],
      multiattack: VAMP_MULTI,
    },
  },
  "vampire-spawn": {
    lang: LIFE_LANG,
    res: VAMP_RES,
    t: {
      regeneration: VAMP_REGEN(10),
      "spider-climb": spiderClimb("O vampiro", "El vampiro"),
      "vampire-weaknesses": VAMP_WEAK(
        "O vampiro é destruído se uma arma perfurante de madeira for cravada no seu coração enquanto ele estiver incapacitado no lugar de descanso.",
        "El vampiro es destruido si se clava un arma perforante de madera en su corazón mientras está incapacitado en su lugar de descanso.",
      ),
    },
    a: { multiattack: VAMP_MULTI },
  },
  veteran: {
    lang: ANY_ONE,
    a: { multiattack: multi("O veterano faz dois ataques de espada longa. Se tiver uma espada curta na mão, também pode fazer um ataque com ela.", "El veterano hace dos ataques de espada larga. Si tiene una espada corta desenvainada, también puede hacer un ataque con ella.") },
  },
  "violet-fungus": {
    t: { "false-appearance": falseAppearance("o fungo violeta", "um fungo comum", "el hongo violeta", "un hongo normal") },
    a: { multiattack: multi("O fungo faz 1d4 ataques de Toque Putrefato.", "El hongo hace 1d4 ataques de Toque putrefacto.") },
  },
  vrock: {
    lang: ABYSSAL,
    res: ["frio, fogo, elétrico; " + NONMAGICAL[0], "frío, fuego, relámpago; " + NONMAGICAL[1]],
    imm: POISON,
    t: { "magic-resistance": magicRes("O vrock", "El vrock") },
    a: {
      multiattack: multi("O vrock faz dois ataques: um de bico e um de garras.", "El vrock hace dos ataques: uno de pico y otro de garras."),
      spores: [
        "Esporos",
        "Uma nuvem de esporos tóxicos de 15 ft de raio se espalha a partir do vrock. Os esporos contornam esquinas. Cada criatura na área deve passar num teste de resistência de Constituição CD 14 ou fica envenenada. Envenenado assim, o alvo sofre 5 (1d10) de dano de veneno no início de cada um dos seus turnos. Pode repetir o teste ao fim de cada um dos seus turnos, encerrando o efeito em si mesmo se passar. Derramar um frasco de água benta no alvo também encerra o efeito.",
        "Esporas",
        "Una nube de esporas tóxicas de 15 ft de radio se extiende desde el vrock. Las esporas doblan las esquinas. Cada criatura en esa zona debe superar una tirada de salvación de Constitución CD 14 o queda envenenada. Mientras está envenenado así, el objetivo recibe 5 (1d10) de daño de veneno al principio de cada uno de sus turnos. Puede repetir la tirada al final de cada uno de sus turnos y termina el efecto sobre sí mismo si la supera. Vaciar un vial de agua bendita sobre el objetivo también termina el efecto.",
      ],
      "stunning-screech": [
        "Guincho Atordoante",
        "O vrock solta um guincho horrível. Cada criatura a até 20 ft dele que possa ouvi-lo e que não seja um demônio deve passar num teste de resistência de Constituição CD 14 ou fica atordoada até o fim do próximo turno do vrock.",
        "Chillido aturdidor",
        "El vrock emite un chillido horrible. Cada criatura a 20 ft o menos de él que pueda oírlo y que no sea un demonio debe superar una tirada de salvación de Constitución CD 14 o queda aturdida hasta el final del siguiente turno del vrock.",
      ],
    },
  },
  vulture: {
    t: {
      "keen-sight-and-smell": keen("Visão e Olfato Aguçados", "Vista y olfato agudos", "O abutre", "El buitre", "da visão ou do olfato", "de la vista o del olfato"),
      "pack-tactics": pack("O abutre", "do abutre", "El buitre", "del buitre"),
    },
  },
  warhorse: { t: { "trampling-charge": TRAMPLE("o cavalo", "el caballo", 14, "cascos", "pezuñas", "outro ataque de cascos", "otro ataque de pezuñas") } },
  "warhorse-skeleton": { imm: POISON, vul: ["concussão", "contundente"] },
  "water-elemental": {
    lang: ["Aquan", "Acuano"],
    res: ["ácido; " + NONMAGICAL[0], "ácido; " + NONMAGICAL[1]],
    imm: POISON,
    t: {
      freeze: ["Congelar", "Se o elemental sofrer dano de frio, congela em parte; seu deslocamento cai 20 ft até o fim do seu próximo turno.", "Congelarse", "Si el elemental recibe daño de frío, se congela en parte; su velocidad se reduce en 20 ft hasta el final de su siguiente turno."],
      "water-form": ["Forma de Água", "O elemental pode entrar no espaço de uma criatura hostil e parar ali. Pode passar por um espaço de apenas 2,5 cm de largura sem se espremer.", "Forma de agua", "El elemental puede entrar en el espacio de una criatura hostil y detenerse allí. Puede pasar por un espacio de solo 2,5 cm de ancho sin apretarse."],
    },
    a: {
      multiattack: multi("O elemental faz dois ataques de pancada.", "El elemental hace dos ataques de golpe."),
      whelm: [
        "Submergir",
        "Cada criatura no espaço do elemental deve fazer um teste de resistência de Força CD 15. Se falhar, sofre 13 (2d8 + 4) de dano de concussão. Se for Grande ou menor, também fica agarrada (CD 14 para escapar). Enquanto estiver agarrado assim, o alvo fica impedido e não consegue respirar, a menos que respire debaixo d'água. Se passar no teste, o alvo é empurrado para fora do espaço do elemental.\nO elemental pode agarrar uma criatura Grande ou até duas Médias ou menores ao mesmo tempo. No início de cada turno do elemental, cada alvo agarrado por ele sofre 13 (2d8 + 4) de dano de concussão. Uma criatura a até 5 ft do elemental pode puxar uma criatura ou objeto para fora dele usando uma ação e passando num teste de Força CD 14.",
        "Sumergir",
        "Cada criatura en el espacio del elemental debe hacer una tirada de salvación de Fuerza CD 15. Si falla, recibe 13 (2d8 + 4) de daño contundente. Si es Grande o más pequeña, también queda agarrada (CD 14 para escapar). Mientras está agarrado así, el objetivo está apresado y no puede respirar, salvo que pueda respirar bajo el agua. Si supera la tirada, el objetivo es empujado fuera del espacio del elemental.\nEl elemental puede agarrar a una criatura Grande o hasta dos Medianas o más pequeñas a la vez. Al principio de cada turno del elemental, cada objetivo agarrado por él recibe 13 (2d8 + 4) de daño contundente. Una criatura a 5 ft o menos del elemental puede sacar a una criatura u objeto de él usando una acción y superando una prueba de Fuerza CD 14.",
      ],
    },
  },
  weasel: { t: { "keen-hearing-and-smell": hearingSmell("A doninha", "La comadreja") } },
  werebear: {
    lang: WERE_LANG("urso", "oso"),
    imm: WERE_IMM,
    t: {
      "keen-smell": smell("O urso licantropo", "El hombre oso"),
      shapechanger: WERE("O urso licantropo", "El hombre oso", "um híbrido de urso e humanoide Grande ou num urso Grande", "un híbrido de oso y humanoide Grande o en un oso Grande", "o tamanho e a CA", "el tamaño y la CA"),
    },
    a: {
      multiattack: multi(
        "Na forma de urso, faz dois ataques de garras. Na forma humanoide, faz dois ataques de machado grande. Na forma híbrida, pode atacar como urso ou como humanoide.",
        "En forma de oso, hace dos ataques de garras. En forma humanoide, hace dos ataques de gran hacha. En forma híbrida, puede atacar como oso o como humanoide.",
      ),
    },
  },
  wereboar: {
    lang: WERE_LANG("javali", "jabalí"),
    imm: WERE_IMM,
    t: {
      "charge-boar-or-hybrid-form-only": [
        "Investida (só nas formas de javali ou híbrida)",
        "Se o javali licantropo se mover pelo menos 15 ft em linha reta até um alvo e o acertar com as presas no mesmo turno, o alvo sofre 7 (2d6) de dano cortante extra. Se o alvo for uma criatura, deve passar num teste de resistência de Força CD 13 ou cai.",
        "Carga (solo en forma de jabalí o híbrida)",
        "Si el hombre jabalí se mueve al menos 15 ft en línea recta hacia un objetivo y lo impacta con los colmillos en el mismo turno, el objetivo recibe 7 (2d6) de daño cortante adicional. Si es una criatura, debe superar una tirada de salvación de Fuerza CD 13 o queda derribada.",
      ],
      "relentless-recharges-after-a-short-or-long-rest": [
        "Implacável (recarrega após descanso curto ou longo)",
        "Se o javali licantropo sofrer 14 de dano ou menos que o deixaria com 0 pontos de vida, ele fica com 1 ponto de vida.",
        "Implacable (se recarga tras un descanso corto o largo)",
        "Si el hombre jabalí recibe 14 de daño o menos que lo dejaría a 0 puntos de golpe, se queda a 1 punto de golpe.",
      ],
      shapechanger: WERE("O javali licantropo", "El hombre jabalí", "um híbrido de javali e humanoide ou num javali", "un híbrido de jabalí y humanoide o en un jabalí", "a CA", "la CA"),
    },
    a: { multiattack: multi("O javali licantropo faz dois ataques, e só um deles pode ser com as presas.", "El hombre jabalí hace dos ataques, y solo uno de ellos puede ser con los colmillos.") },
  },
  wererat: {
    lang: WERE_LANG("rato", "rata"),
    imm: WERE_IMM,
    t: {
      "keen-smell": smell("O rato licantropo", "El hombre rata"),
      shapechanger: WERE("O rato licantropo", "El hombre rata", "um híbrido de rato e humanoide ou num rato gigante", "un híbrido de rata y humanoide o en una rata gigante", "o tamanho", "el tamaño"),
    },
    a: { multiattack: multi("O rato licantropo faz dois ataques, e só um deles pode ser de mordida.", "El hombre rata hace dos ataques, y solo uno de ellos puede ser de mordisco.") },
  },
  weretiger: {
    lang: WERE_LANG("tigre", "tigre"),
    imm: WERE_IMM,
    t: {
      "keen-hearing-and-smell": hearingSmell("O tigre licantropo", "El hombre tigre"),
      "pounce-tiger-or-hybrid-form-only": POUNCE("Bote (só nas formas de tigre ou híbrida)", "o tigre licantropo", "Abalanzarse (solo en forma de tigre o híbrida)", "el hombre tigre", 15, 14),
      shapechanger: WERE("O tigre licantropo", "El hombre tigre", "um híbrido de tigre e humanoide ou num tigre", "un híbrido de tigre y humanoide o en un tigre", "o tamanho", "el tamaño"),
    },
    a: {
      multiattack: multi(
        "Na forma humanoide, faz dois ataques de cimitarra ou dois de arco longo. Na forma híbrida, pode atacar como humanoide ou fazer dois ataques de garras.",
        "En forma humanoide, hace dos ataques de cimitarra o dos de arco largo. En forma híbrida, puede atacar como humanoide o hacer dos ataques de garras.",
      ),
    },
  },
  werewolf: {
    lang: WERE_LANG("lobo", "lobo"),
    imm: WERE_IMM,
    t: {
      "keen-hearing-and-smell": hearingSmell("O lobisomem", "El hombre lobo"),
      shapechanger: WERE("O lobisomem", "El hombre lobo", "um híbrido de lobo e humanoide ou num lobo", "un híbrido de lobo y humanoide o en un lobo", "a CA", "la CA"),
    },
    a: {
      multiattack: multi(
        "O lobisomem faz dois ataques: dois de lança (forma humanoide) ou um de mordida e um de garras (forma híbrida).",
        "El hombre lobo hace dos ataques: dos de lanza (forma humanoide) o uno de mordisco y otro de garras (forma híbrida).",
      ),
    },
  },
  wight: {
    lang: LIFE_LANG,
    imm: ["necrótico; " + SILVER[0], "necrótico; " + SILVER[1]],
    t: { "sunlight-sensitivity": sunlight("o inumano", "el tumulario") },
    a: {
      multiattack: multi(
        "O inumano faz dois ataques de espada longa ou dois de arco longo. Pode usar Drenar Vida no lugar de um ataque de espada longa.",
        "El tumulario hace dos ataques de espada larga o dos de arco largo. Puede usar Drenar vida en lugar de un ataque de espada larga.",
      ),
    },
  },
  "will-o-wisp": {
    lang: LIFE_LANG,
    res: [UNDEAD_RES[0].replace("elétrico, ", "necrótico, ") + NONMAGICAL[0], UNDEAD_RES[1].replace("relámpago, ", "necrótico, ") + NONMAGICAL[1]],
    imm: ["elétrico, veneno", "relámpago, veneno"],
    t: {
      "consume-life": [
        "Consumir Vida",
        "Como ação bônus, o fogo-fátuo pode escolher uma criatura que possa ver a até 5 ft, com 0 pontos de vida e ainda viva. O alvo deve passar num teste de resistência de Constituição CD 10 contra esta magia ou morre. Se o alvo morrer, o fogo-fátuo recupera 10 (3d6) pontos de vida.",
        "Consumir vida",
        "Como acción adicional, el fuego fatuo puede elegir a una criatura que pueda ver a 5 ft o menos, con 0 puntos de golpe y aún viva. El objetivo debe superar una tirada de salvación de Constitución CD 10 contra esta magia o muere. Si el objetivo muere, el fuego fatuo recupera 10 (3d6) puntos de golpe.",
      ],
      ephemeral: ["Efêmero", "O fogo-fátuo não pode vestir nem carregar nada.", "Efímero", "El fuego fatuo no puede llevar puesto ni encima nada."],
      "incorporeal-movement": INCORPOREAL("O fogo-fátuo", "El fuego fatuo"),
      "variable-illumination": [
        "Iluminação Variável",
        "O fogo-fátuo emite luz plena num raio de 5 a 20 ft e penumbra por mais uma distância igual ao raio escolhido. Pode mudar o raio como ação bônus.",
        "Iluminación variable",
        "El fuego fatuo emite luz brillante en un radio de 5 a 20 ft y luz tenue en una distancia adicional igual al radio elegido. Puede cambiar el radio como acción adicional.",
      ],
    },
    a: {
      invisibility: [
        "Invisibilidade",
        "O fogo-fátuo e sua luz ficam magicamente invisíveis até ele atacar ou usar Consumir Vida, ou até a concentração acabar (como se concentrasse numa magia).",
        "Invisibilidad",
        "El fuego fatuo y su luz se vuelven invisibles mágicamente hasta que ataca o usa Consumir vida, o hasta que termina su concentración (como si se concentrara en un conjuro).",
      ],
    },
  },
  "winter-wolf": {
    lang: ["Comum, Gigante, Lobo do Inverno", "Común, gigante, lobo invernal"],
    imm: ["frio", "frío"],
    t: {
      ...WOLF("O lobo", "do lobo", "El lobo", "del lobo"),
      "snow-camouflage": ["Camuflagem na Neve", "O lobo tem vantagem em testes de Destreza (Furtividade) para se esconder em terreno com neve.", "Camuflaje en la nieve", "El lobo tiene ventaja en las pruebas de Destreza (Sigilo) para esconderse en terreno nevado."],
    },
    a: {
      "cold-breath": [
        "Sopro Gélido",
        "O lobo exala uma rajada de vento congelante num cone de 15 ft. Cada criatura na área deve fazer um teste de resistência de Destreza CD 12. Se falhar, sofre 18 (4d8) de dano de frio; se passar, metade.",
        "Aliento gélido",
        "El lobo exhala una ráfaga de viento helado en un cono de 15 ft. Cada criatura en esa área debe hacer una tirada de salvación de Destreza CD 12. Si falla, recibe 18 (4d8) de daño de frío; si la supera, la mitad.",
      ],
    },
  },
  wolf: { t: WOLF("O lobo", "do lobo", "El lobo", "del lobo") },
  worg: { lang: ["Goblin, Worg", "Goblin, huargo"], t: { "keen-hearing-and-smell": hearingSmell("O worg", "El huargo") } },
  wraith: {
    lang: LIFE_LANG,
    res: [UNDEAD_RES[0] + SILVER[0], UNDEAD_RES[1] + SILVER[1]],
    imm: ["necrótico, veneno", "necrótico, veneno"],
    t: { "incorporeal-movement": INCORPOREAL("A aparição", "El espectro aullante"), "sunlight-sensitivity": sunlight("a aparição", "el espectro aullante") },
    a: {
      "create-specter": [
        "Criar Espectro",
        "A aparição escolhe um humanoide a até 10 ft que tenha morrido de forma violenta há no máximo 1 minuto. O espírito do alvo se ergue como um espectro no espaço do cadáver ou no espaço desocupado mais próximo. O espectro fica sob o controle da aparição. A aparição pode controlar no máximo sete espectros ao mesmo tempo.",
        "Crear espectro",
        "El espectro aullante elige a un humanoide a 10 ft o menos que haya muerto de forma violenta hace 1 minuto o menos. El espíritu del objetivo se alza como un espectro en el espacio del cadáver o en el espacio desocupado más cercano. El espectro queda bajo el control del espectro aullante, que puede controlar como mucho a siete espectros a la vez.",
      ],
    },
  },
  wyvern: {
    a: { multiattack: multi("A serpe faz dois ataques: um de mordida e um de ferrão. Voando, pode usar as garras no lugar de um dos outros ataques.", "El guiverno hace dos ataques: uno de mordisco y otro de aguijón. Mientras vuela, puede usar las garras en lugar de uno de los otros ataques.") },
  },
  xorn: {
    lang: ["Terran", "Terrano"],
    res: ["perfurante e cortante de ataques não mágicos feitos sem armas de adamante", "perforante y cortante de ataques no mágicos hechos sin armas de adamantina"],
    t: {
      "earth-glide": [
        "Deslizar pela Terra",
        "O xorn pode escavar através de terra e pedra não mágicas e não trabalhadas. Fazendo isso, não perturba o material por onde passa.",
        "Deslizarse por la tierra",
        "El xorn puede excavar a través de tierra y piedra no mágicas y sin trabajar. Al hacerlo, no altera el material por el que se mueve.",
      ],
      "stone-camouflage": STONE_CAMO("O xorn", "El xorn"),
      "treasure-sense": ["Faro de Tesouro", "O xorn consegue localizar pelo cheiro metais e pedras preciosas, como moedas e gemas, a até 60 ft.", "Olfato para tesoros", "El xorn puede localizar por el olor metales y piedras preciosos, como monedas y gemas, a 60 ft o menos."],
    },
    a: { multiattack: multi("O xorn faz três ataques de garra e um de mordida.", "El xorn hace tres ataques de garra y uno de mordisco.") },
  },
  zombie: {
    lang: ["entende os idiomas que conhecia em vida mas não fala", "entiende los idiomas que conocía en vida pero no habla"],
    t: { "undead-fortitude": UNDEAD_FORT },
  },
};
