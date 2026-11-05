// Lote 6 das habilidades (Passo 12, fase C): Cavaleiro a Geleia Ocre. Formato em scripts/srd51/details.mjs.
import { ABYSSAL, amphibious, ANY_ONE, charge, coldSilver, FIRE_POISON, hearingSmell, holdBreath, magicRes, magicWeapons, multi, NONMAGICAL, pack, parry, POISON, SILVER, smell, spiderClimb, sunlight } from "./_comum.mjs";

const DEMON_RES = ["frio, fogo, elétrico; " + NONMAGICAL[0], "frío, fuego, relámpago; " + NONMAGICAL[1]];
const BRAVE = (pt, es) => ["Bravura", `${pt} tem vantagem em testes de resistência contra ficar amedrontado.`, "Valiente", `${es} tiene ventaja en las tiradas de salvación para no quedar asustado.`];
const SURE_FOOTED = (pt, es) => ["Passo Firme", `${pt} tem vantagem em testes de resistência de Força e Destreza contra efeitos que a derrubariam.`, "Pies firmes", `${es} tiene ventaja en las tiradas de salvación de Fuerza y Destreza contra efectos que la derribarían.`];
const TELEPORT = (pt, es) => ["Teletransporte", `${pt} se teletransporta magicamente, com todo o equipamento que veste ou carrega, até 120 ft para um espaço desocupado que possa ver.`, "Teletransporte", `${es} se teletransporta mágicamente, con todo el equipo que lleve puesto o encima, hasta 120 ft a un espacio desocupado que pueda ver.`];
const TRAMPLE = (pt, es, cd, golpePt, golpeEs) => [
  "Investida Atropeladora",
  `Se ${pt} se mover pelo menos 20 ft em linha reta até uma criatura e a acertar com um ataque de chifrada no mesmo turno, o alvo deve passar num teste de resistência de Força CD ${cd} ou cai. Se o alvo estiver caído, pode fazer um ataque de ${golpePt} contra ele como ação bônus.`,
  "Carga arrolladora",
  `Si ${es} se mueve al menos 20 ft en línea recta hacia una criatura y la impacta con un ataque de cornada en el mismo turno, el objetivo debe superar una tirada de salvación de Fuerza CD ${cd} o queda derribado. Si el objetivo está derribado, puede hacer un ataque de ${golpeEs} contra él como acción adicional.`,
];
/** Investida do minotauro e do esqueleto: empurra além de derrubar. */
const GORE_CHARGE = (pt, es) => [
  "Investida",
  `Se ${pt} se mover pelo menos 10 ft em linha reta até um alvo e o acertar com um ataque de chifrada no mesmo turno, o alvo sofre 9 (2d8) de dano perfurante extra. Se o alvo for uma criatura, deve passar num teste de resistência de Força CD 14 ou é empurrado até 10 ft e cai.`,
  "Carga",
  `Si ${es} se mueve al menos 10 ft en línea recta hacia un objetivo y lo impacta con un ataque de cornada en el mismo turno, el objetivo recibe 9 (2d8) de daño perforante adicional. Si es una criatura, debe superar una tirada de salvación de Fuerza CD 14 o es empujada hasta 10 ft y queda derribada.`,
];
const DREADFUL_GLARE = (pt, ptDe, es, esDe, cd, imunePt, imuneEs) => [
  "Olhar Pavoroso",
  `${pt} escolhe uma criatura que possa ver a até 60 ft. Se o alvo puder ver ${ptDe}, deve passar num teste de resistência de Sabedoria CD ${cd} contra esta magia ou fica amedrontado até o fim do próximo turno da múmia. Se falhar por 5 ou mais, também fica paralisado pelo mesmo tempo. Quem passar no teste fica imune ao Olhar Pavoroso de ${imunePt} pelas próximas 24 horas.`,
  "Mirada aterradora",
  `${es} elige a una criatura que pueda ver a 60 ft o menos. Si el objetivo puede ver ${esDe}, debe superar una tirada de salvación de Sabiduría CD ${cd} contra esta magia o queda asustado hasta el final del siguiente turno de la momia. Si falla por 5 o más, también queda paralizado durante el mismo tiempo. Quien supere la tirada es inmune a la Mirada aterradora de ${imuneEs} durante las siguientes 24 horas.`,
];
const MUMMY_MULTI = multi("A múmia pode usar o Olhar Pavoroso e faz um ataque de punho putrefato.", "La momia puede usar su Mirada aterradora y hace un ataque de puño putrefacto.");

export default {
  knight: {
    lang: ANY_ONE,
    t: { brave: BRAVE("O cavaleiro", "El caballero") },
    a: {
      leadership: [
        "Liderança",
        "Por 1 minuto, o cavaleiro pode gritar uma ordem ou um aviso especial sempre que uma criatura não hostil que ele possa ver a até 30 ft fizer uma jogada de ataque ou um teste de resistência. A criatura pode somar um d4 à jogada, desde que possa ouvir e entender o cavaleiro. Uma criatura só pode ter um dado de Liderança por vez. O efeito acaba se o cavaleiro ficar incapacitado.",
        "Liderazgo",
        "Durante 1 minuto, el caballero puede gritar una orden o advertencia especial cada vez que una criatura no hostil que pueda ver a 30 ft o menos haga una tirada de ataque o de salvación. La criatura puede sumar un d4 a su tirada, siempre que pueda oír y entender al caballero. Una criatura solo puede beneficiarse de un dado de Liderazgo a la vez. El efecto termina si el caballero queda incapacitado.",
      ],
      multiattack: multi("O cavaleiro faz dois ataques corpo a corpo.", "El caballero hace dos ataques cuerpo a cuerpo."),
      parry: parry("O cavaleiro", "El caballero", 2),
    },
  },
  kobold: {
    lang: ["Comum, Dracônico", "Común, dracónico"],
    t: { "pack-tactics": pack("O kobold", "do kobold", "El kobold", "del kobold"), "sunlight-sensitivity": sunlight("o kobold", "el kobold") },
  },
  kraken: {
    lang: ["entende Abissal, Celestial, Infernal e Primordial mas não fala; telepatia 120 ft", "entiende abisal, celestial, infernal y primordial pero no habla; telepatía 120 ft"],
    imm: ["elétrico; " + NONMAGICAL[0], "relámpago; " + NONMAGICAL[1]],
    t: {
      amphibious: amphibious("O kraken", "El kraken"),
      "freedom-of-movement": [
        "Liberdade de Movimento",
        "O kraken ignora terreno difícil, e efeitos mágicos não podem reduzir seu deslocamento nem deixá-lo impedido. Pode gastar 5 ft de deslocamento para escapar de amarras não mágicas ou de estar agarrado.",
        "Libertad de movimiento",
        "El kraken ignora el terreno difícil, y los efectos mágicos no pueden reducir su velocidad ni dejarlo apresado. Puede gastar 5 ft de movimiento para escapar de ataduras no mágicas o de estar agarrado.",
      ],
      "siege-monster": ["Monstro de Cerco", "O kraken causa o dobro de dano a objetos e estruturas.", "Monstruo de asedio", "El kraken inflige el doble de daño a objetos y estructuras."],
    },
    a: {
      fling: [
        "Arremessar",
        "Um objeto Grande ou menor que o kraken esteja segurando, ou uma criatura que esteja agarrando, é arremessado até 60 ft numa direção sorteada e cai. Se o alvo bater numa superfície sólida, sofre 3 (1d6) de dano de concussão a cada 10 ft que voou. Se for arremessado contra outra criatura, ela deve passar num teste de resistência de Destreza CD 18 ou sofre o mesmo dano e cai.",
        "Lanzar",
        "Un objeto Grande o más pequeño que el kraken sostenga, o una criatura que tenga agarrada, sale lanzado hasta 60 ft en una dirección al azar y queda derribado. Si el objetivo choca contra una superficie sólida, recibe 3 (1d6) de daño contundente por cada 10 ft que haya volado. Si es lanzado contra otra criatura, esta debe superar una tirada de salvación de Destreza CD 18 o recibe el mismo daño y queda derribada.",
      ],
      "ink-cloud": [
        "Nuvem de Tinta",
        "Debaixo d'água, o kraken solta uma nuvem de tinta num raio de 60 ft. A nuvem contorna esquinas, e a área fica densamente obscurecida para todos menos o kraken. Cada criatura além do kraken que termine o turno ali deve fazer um teste de resistência de Constituição CD 23. Se falhar, sofre 16 (3d10) de dano de veneno; se passar, metade. Uma correnteza forte dispersa a nuvem, que de outro modo some no fim do próximo turno do kraken.",
        "Nube de tinta",
        "Bajo el agua, el kraken expulsa una nube de tinta en un radio de 60 ft. La nube dobla las esquinas, y la zona queda muy oscurecida para todos salvo el kraken. Cada criatura que no sea el kraken y termine su turno allí debe hacer una tirada de salvación de Constitución CD 23. Si falla, recibe 16 (3d10) de daño de veneno; si la supera, la mitad. Una corriente fuerte dispersa la nube, que si no desaparece al final del siguiente turno del kraken.",
      ],
      "legendary-lightning-storm": ["Tempestade de Raios", "O kraken usa Tempestade de Raios.", "Tormenta de relámpagos", "El kraken usa Tormenta de relámpagos."],
      "lightning-storm": [
        "Tempestade de Raios",
        "O kraken cria magicamente três raios, cada um podendo atingir um alvo que ele possa ver a até 120 ft. O alvo deve fazer um teste de resistência de Destreza CD 23. Se falhar, sofre 22 (4d10) de dano elétrico; se passar, metade.",
        "Tormenta de relámpagos",
        "El kraken crea mágicamente tres relámpagos, cada uno de los cuales puede alcanzar a un objetivo que pueda ver a 120 ft o menos. El objetivo debe hacer una tirada de salvación de Destreza CD 23. Si falla, recibe 22 (4d10) de daño de relámpago; si la supera, la mitad.",
      ],
      multiattack: multi("O kraken faz três ataques de tentáculo; pode trocar cada um por um uso de Arremessar.", "El kraken hace tres ataques de tentáculo; puede sustituir cada uno por un uso de Lanzar."),
      "tentacle-attack-or-fling": ["Tentáculo ou Arremessar", "O kraken faz um ataque de tentáculo ou usa Arremessar.", "Tentáculo o Lanzar", "El kraken hace un ataque de tentáculo o usa Lanzar."],
    },
  },
  lamia: {
    lang: ["Abissal, Comum", "Abisal, común"],
    t: {
      "innate-spellcasting": [
        "Conjuração Inata",
        "A habilidade de conjuração inata da lâmia é Carisma (CD de resistência de magia 13). Ela pode conjurar as seguintes magias de forma inata, sem precisar de componentes materiais:\n\nÀ vontade: disfarçar-se (qualquer forma humanoide), imagem maior\n3/dia cada: enfeitiçar pessoa, imagem espelhada, vidência, sugestão\n1/dia: missão",
        "Lanzamiento de conjuros innato",
        "La aptitud mágica innata de la lamia es Carisma (CD de salvación de conjuros 13). Puede lanzar de forma innata los siguientes conjuros sin necesidad de componentes materiales:\n\nA voluntad: disfrazarse (cualquier forma humanoide), imagen mayor\n3/día cada uno: hechizar persona, imagen múltiple, escudriñamiento, sugestión\n1/día: geas",
      ],
    },
    a: { multiattack: multi("A lâmia faz dois ataques: um de garras e um de adaga ou Toque Inebriante.", "La lamia hace dos ataques: uno de garras y otro de daga o Toque embriagador.") },
  },
  lemure: {
    lang: ["entende Infernal mas não fala", "entiende infernal pero no habla"],
    res: ["frio", "frío"],
    imm: FIRE_POISON,
    t: {
      "devils-sight": ["Visão do Diabo", "A escuridão mágica não atrapalha a visão no escuro do lemure.", "Vista del diablo", "La oscuridad mágica no impide la visión en la oscuridad del lémur."],
      "hellish-rejuvenation": [
        "Rejuvenescer Infernal",
        "Um lemure que morre nos Nove Infernos volta à vida com todos os pontos de vida em 1d10 dias, a menos que seja morto por uma criatura de tendência boa sob a magia abençoar ou que seus restos sejam aspergidos com água benta.",
        "Rejuvenecimiento infernal",
        "Un lémur que muere en los Nueve Infiernos vuelve a la vida con todos sus puntos de golpe en 1d10 días, salvo que lo mate una criatura de alineamiento bueno bajo el conjuro bendecir o que sus restos se rocíen con agua bendita.",
      ],
    },
  },
  lich: {
    lang: ["Comum e até mais cinco idiomas", "Común y hasta otros cinco idiomas"],
    res: ["frio, elétrico, necrótico", "frío, relámpago, necrótico"],
    imm: ["veneno; " + NONMAGICAL[0], "veneno; " + NONMAGICAL[1]],
    t: {
      "legendary-resistance-3day": ["Resistência Lendária (3/dia)", "Se o lich falhar num teste de resistência, pode escolher passar.", "Resistencia legendaria (3/día)", "Si el liche falla una tirada de salvación, puede elegir superarla."],
      rejuvenation: [
        "Rejuvenescer",
        "Se tiver um filactério, um lich destruído ganha um corpo novo em 1d10 dias, recuperando todos os pontos de vida e voltando à ativa. O corpo novo aparece a até 5 ft do filactério.",
        "Rejuvenecimiento",
        "Si tiene una filacteria, un liche destruido obtiene un cuerpo nuevo en 1d10 días, recupera todos sus puntos de golpe y vuelve a estar activo. El cuerpo nuevo aparece a 5 ft o menos de la filacteria.",
      ],
      spellcasting: [
        "Conjuração",
        "O lich é um conjurador de 18º nível. Sua habilidade de conjuração é Inteligência (CD de resistência de magia 20, +12 para acertar com ataques de magia). Tem as seguintes magias de mago preparadas:\n\n* Truques (à vontade): mãos mágicas, prestidigitação, raio de gelo\n* 1º nível (4 espaços): detectar magia, mísseis mágicos, escudo arcano, onda trovejante\n* 2º nível (3 espaços): detectar pensamentos, invisibilidade, flecha ácida, imagem espelhada\n* 3º nível (3 espaços): animar mortos, contramágica, dissipar magia, bola de fogo\n* 4º nível (3 espaços): praga, porta dimensional\n* 5º nível (3 espaços): névoa mortal, vidência\n* 6º nível (1 espaço): desintegrar, globo de invulnerabilidade\n* 7º nível (1 espaço): dedo da morte, viagem planar\n* 8º nível (1 espaço): dominar monstro, palavra de poder atordoar\n* 9º nível (1 espaço): palavra de poder matar",
        "Lanzamiento de conjuros",
        "El liche es un lanzador de conjuros de nivel 18. Su aptitud mágica es Inteligencia (CD de salvación de conjuros 20, +12 al ataque con conjuros). Tiene preparados los siguientes conjuros de mago:\n\n* Trucos (a voluntad): mano de mago, prestidigitación, rayo de escarcha\n* Nivel 1 (4 espacios): detectar magia, proyectil mágico, escudo, onda atronadora\n* Nivel 2 (3 espacios): detectar pensamientos, invisibilidad, flecha ácida, imagen múltiple\n* Nivel 3 (3 espacios): animar a los muertos, contraconjuro, disipar magia, bola de fuego\n* Nivel 4 (3 espacios): marchitar, puerta dimensional\n* Nivel 5 (3 espacios): nube aniquiladora, escudriñamiento\n* Nivel 6 (1 espacio): desintegrar, globo de invulnerabilidad\n* Nivel 7 (1 espacio): dedo de la muerte, desplazamiento entre planos\n* Nivel 8 (1 espacio): dominar monstruo, palabra de poder: aturdir\n* Nivel 9 (1 espacio): palabra de poder: matar",
      ],
      "turn-resistance": ["Resistência à Expulsão", "O lich tem vantagem em testes de resistência contra qualquer efeito que expulse mortos-vivos.", "Resistencia a expulsión", "El liche tiene ventaja en las tiradas de salvación contra cualquier efecto que expulse muertos vivientes."],
    },
    a: {
      cantrip: ["Truque", "O lich conjura um truque.", "Truco", "El liche lanza un truco."],
      "disrupt-life": [
        "Romper a Vida",
        "Cada criatura que não seja morta-viva a até 20 ft do lich deve fazer um teste de resistência de Constituição CD 18 contra esta magia. Se falhar, sofre 21 (6d6) de dano necrótico; se passar, metade.",
        "Perturbar la vida",
        "Cada criatura que no sea un muerto viviente a 20 ft o menos del liche debe hacer una tirada de salvación de Constitución CD 18 contra esta magia. Si falla, recibe 21 (6d6) de daño necrótico; si la supera, la mitad.",
      ],
      "frightening-gaze": [
        "Olhar Assustador",
        "O lich fixa o olhar numa criatura que possa ver a até 10 ft. O alvo deve passar num teste de resistência de Sabedoria CD 18 contra esta magia ou fica amedrontado por 1 minuto. O alvo amedrontado pode repetir o teste ao fim de cada um dos seus turnos, encerrando o efeito em si mesmo se passar. Se passar ou o efeito acabar para ele, fica imune ao olhar do lich pelas próximas 24 horas.",
        "Mirada aterradora",
        "El liche clava la mirada en una criatura que pueda ver a 10 ft o menos. El objetivo debe superar una tirada de salvación de Sabiduría CD 18 contra esta magia o queda asustado durante 1 minuto. El objetivo asustado puede repetir la tirada al final de cada uno de sus turnos y termina el efecto sobre sí mismo si la supera. Si la supera o el efecto termina para él, es inmune a la mirada del liche durante las siguientes 24 horas.",
      ],
      "legendary-paralyzing-touch": ["Toque Paralisante", "O lich usa o Toque Paralisante.", "Toque paralizante", "El liche usa su Toque paralizante."],
    },
  },
  lion: {
    t: {
      "keen-smell": smell("O leão", "El león"),
      "pack-tactics": pack("O leão", "do leão", "El león", "del león"),
      pounce: [
        "Bote",
        "Se o leão se mover pelo menos 20 ft em linha reta até uma criatura e a acertar com um ataque de garras no mesmo turno, o alvo deve passar num teste de resistência de Força CD 13 ou cai. Se o alvo estiver caído, o leão pode fazer um ataque de mordida contra ele como ação bônus.",
        "Abalanzarse",
        "Si el león se mueve al menos 20 ft en línea recta hacia una criatura y la impacta con un ataque de garras en el mismo turno, el objetivo debe superar una tirada de salvación de Fuerza CD 13 o queda derribado. Si el objetivo está derribado, el león puede hacer un ataque de mordisco contra él como acción adicional.",
      ],
      "running-leap": ["Salto com Corrida", "Com 10 ft de corrida, o leão pode saltar até 25 ft em distância.", "Salto con carrerilla", "Con 10 ft de carrerilla, el león puede saltar hasta 25 ft de longitud."],
    },
  },
  lizard: {},
  lizardfolk: {
    lang: ["Dracônico", "Dracónico"],
    t: { "hold-breath": holdBreath("O povo-lagarto", "15 minutos", "El hombre lagarto", "15 minutos") },
    a: { multiattack: multi("O povo-lagarto faz dois ataques corpo a corpo, cada um com uma arma diferente.", "El hombre lagarto hace dos ataques cuerpo a cuerpo, cada uno con un arma distinta.") },
  },
  mage: {
    lang: ["quatro idiomas quaisquer", "cuatro idiomas cualesquiera"],
    t: {
      spellcasting: [
        "Conjuração",
        "O mago é um conjurador de 9º nível. Sua habilidade de conjuração é Inteligência (CD de resistência de magia 14, +6 para acertar com ataques de magia). Tem as seguintes magias de mago preparadas:\n\n* Truques (à vontade): raio de fogo, luz, mãos mágicas, prestidigitação\n* 1º nível (4 espaços): detectar magia, armadura arcana, mísseis mágicos, escudo arcano\n* 2º nível (3 espaços): passo nebuloso, sugestão\n* 3º nível (3 espaços): contramágica, bola de fogo, voo\n* 4º nível (3 espaços): invisibilidade maior, tempestade de gelo\n* 5º nível (1 espaço): cone de frio",
        "Lanzamiento de conjuros",
        "El mago es un lanzador de conjuros de nivel 9. Su aptitud mágica es Inteligencia (CD de salvación de conjuros 14, +6 al ataque con conjuros). Tiene preparados los siguientes conjuros de mago:\n\n* Trucos (a voluntad): descarga de fuego, luz, mano de mago, prestidigitación\n* Nivel 1 (4 espacios): detectar magia, armadura de mago, proyectil mágico, escudo\n* Nivel 2 (3 espacios): paso brumoso, sugestión\n* Nivel 3 (3 espacios): contraconjuro, bola de fuego, volar\n* Nivel 4 (3 espacios): invisibilidad mayor, tormenta de hielo\n* Nivel 5 (1 espacio): cono de frío",
      ],
    },
  },
  "magma-mephit": {
    lang: ["Ignan, Terran", "Ígneo, terrano"],
    imm: FIRE_POISON,
    vul: ["frio", "frío"],
    t: {
      "death-burst": [
        "Explosão Mortal",
        "Quando o mefite morre, explode numa rajada de lava. Cada criatura a até 5 ft dele deve fazer um teste de resistência de Destreza CD 11. Se falhar, sofre 7 (2d6) de dano de fogo; se passar, metade.",
        "Estallido mortal",
        "Cuando el mefítico muere, estalla en una ráfaga de lava. Cada criatura a 5 ft o menos de él debe hacer una tirada de salvación de Destreza CD 11. Si falla, recibe 7 (2d6) de daño de fuego; si la supera, la mitad.",
      ],
      "false-appearance": ["Falsa Aparência", "Enquanto fica imóvel, o mefite é indistinguível de um monte comum de magma.", "Apariencia falsa", "Mientras permanece inmóvil, el mefítico es indistinguible de un montón normal de magma."],
      "innate-spellcasting-1day": [
        "Conjuração Inata (1/dia)",
        "O mefite pode conjurar *esquentar metal* de forma inata (CD de resistência de magia 10), sem precisar de componentes materiais. Sua habilidade de conjuração inata é Carisma.",
        "Lanzamiento de conjuros innato (1/día)",
        "El mefítico puede lanzar *calentar metal* de forma innata (CD de salvación de conjuros 10), sin necesidad de componentes materiales. Su aptitud mágica innata es Carisma.",
      ],
    },
    a: {
      "fire-breath": [
        "Sopro de Fogo",
        "O mefite exala um cone de fogo de 15 ft. Cada criatura na área deve fazer um teste de resistência de Destreza CD 11. Se falhar, sofre 7 (2d6) de dano de fogo; se passar, metade.",
        "Aliento de fuego",
        "El mefítico exhala un cono de fuego de 15 ft. Cada criatura en esa área debe hacer una tirada de salvación de Destreza CD 11. Si falla, recibe 7 (2d6) de daño de fuego; si la supera, la mitad.",
      ],
    },
  },
  magmin: {
    lang: ["Ignan", "Ígneo"],
    res: NONMAGICAL,
    imm: ["fogo", "fuego"],
    t: {
      "death-burst": [
        "Explosão Mortal",
        "Quando o magmin morre, explode numa rajada de fogo e magma. Cada criatura a até 10 ft dele deve fazer um teste de resistência de Destreza CD 11. Se falhar, sofre 7 (2d6) de dano de fogo; se passar, metade. Objetos inflamáveis na área que ninguém esteja vestindo ou carregando pegam fogo.",
        "Estallido mortal",
        "Cuando el magmin muere, estalla en una ráfaga de fuego y magma. Cada criatura a 10 ft o menos de él debe hacer una tirada de salvación de Destreza CD 11. Si falla, recibe 7 (2d6) de daño de fuego; si la supera, la mitad. Los objetos inflamables de la zona que nadie lleve puestos o encima se prenden.",
      ],
      "ignited-illumination": [
        "Iluminação Flamejante",
        "Como ação bônus, o magmin pode se incendiar ou apagar as chamas. Em chamas, emite luz plena num raio de 10 ft e penumbra por mais 10 ft.",
        "Iluminación ígnea",
        "Como acción adicional, el magmin puede prenderse fuego o apagar sus llamas. Mientras arde, emite luz brillante en un radio de 10 ft y luz tenue 10 ft más allá.",
      ],
    },
  },
  mammoth: { t: { "trampling-charge": TRAMPLE("o mamute", "el mamut", 18, "pisotear", "pisotón") } },
  manticore: {
    t: { "tail-spike-regrowth": ["Espinhos que Crescem", "A mantícora tem vinte e quatro espinhos na cauda. Os espinhos usados crescem de novo quando ela termina um descanso longo.", "Púas que vuelven a crecer", "La mantícora tiene veinticuatro púas en la cola. Las púas usadas vuelven a crecer cuando termina un descanso largo."] },
    a: { multiattack: multi("A mantícora faz três ataques: um de mordida e dois de garras, ou três com os espinhos da cauda.", "La mantícora hace tres ataques: uno de mordisco y dos de garras, o tres con las púas de la cola.") },
  },
  marilith: {
    lang: ABYSSAL,
    res: DEMON_RES,
    imm: POISON,
    t: {
      "magic-resistance": magicRes("A marilith", "La marilith"),
      "magic-weapons": magicWeapons("da marilith", "de la marilith"),
      reactive: ["Reativa", "A marilith pode usar uma reação em cada turno do combate.", "Reactiva", "La marilith puede usar una reacción en cada turno del combate."],
    },
    a: {
      multiattack: multi("A marilith pode fazer sete ataques: seis de espada longa e um de cauda.", "La marilith puede hacer siete ataques: seis de espada larga y uno de cola."),
      parry: ["Aparar", "A marilith soma 5 à CA contra um ataque corpo a corpo que a acertaria. Para isso, precisa ver o atacante e estar empunhando uma arma corpo a corpo.", "Parada", "La marilith suma 5 a su CA contra un ataque cuerpo a cuerpo que la impactaría. Para ello, debe ver al atacante y empuñar un arma cuerpo a cuerpo."],
      teleport: TELEPORT("A marilith", "La marilith"),
    },
  },
  mastiff: { t: { "keen-hearing-and-smell": hearingSmell("O mastim", "El mastín") } },
  medusa: {
    lang: ["Comum", "Común"],
    t: {
      "petrifying-gaze": [
        "Olhar Petrificante",
        "Quando uma criatura que possa ver os olhos da medusa começa o turno a até 30 ft dela, a medusa pode forçá-la a fazer um teste de resistência de Constituição CD 14, se não estiver incapacitada e puder ver a criatura. Se falhar por 5 ou mais, a criatura é petrificada na hora. Se não, quem falhar começa a virar pedra e fica impedido. A criatura impedida deve repetir o teste ao fim do seu próximo turno: se falhar, é petrificada; se passar, o efeito acaba. A petrificação dura até a criatura ser libertada pela magia restauração maior ou outra magia.\nA menos que esteja surpresa, uma criatura pode desviar o olhar no início do turno para evitar o teste. Se fizer isso, não pode ver a medusa até o início do próximo turno, quando pode desviar o olhar de novo. Se olhar para a medusa nesse meio-tempo, deve fazer o teste na hora.\nSe a medusa vir o próprio reflexo numa superfície polida a até 30 ft, numa área de luz plena, ela é afetada pelo próprio olhar, por causa da maldição.",
        "Mirada petrificadora",
        "Cuando una criatura que pueda ver los ojos de la medusa empieza su turno a 30 ft o menos de ella, la medusa puede obligarla a hacer una tirada de salvación de Constitución CD 14, si no está incapacitada y puede ver a la criatura. Si falla por 5 o más, la criatura queda petrificada al instante. Si no, quien falle empieza a convertirse en piedra y queda apresado. La criatura apresada debe repetir la tirada al final de su siguiente turno: si falla, queda petrificada; si la supera, el efecto termina. La petrificación dura hasta que el conjuro restablecimiento mayor u otra magia libere a la criatura.\nSalvo que esté sorprendida, una criatura puede apartar la mirada al principio de su turno para evitar la tirada. Si lo hace, no puede ver a la medusa hasta el principio de su siguiente turno, cuando puede volver a apartar la mirada. Si mira a la medusa entretanto, debe hacer la tirada de inmediato.\nSi la medusa ve su reflejo en una superficie pulida a 30 ft o menos, en una zona de luz brillante, queda afectada por su propia mirada debido a su maldición.",
      ],
    },
    a: {
      multiattack: multi(
        "A medusa faz três ataques corpo a corpo (um com o cabelo de serpentes e dois com a espada curta) ou dois ataques à distância com o arco longo.",
        "La medusa hace tres ataques cuerpo a cuerpo (uno con su pelo de serpientes y dos con la espada corta) o dos ataques a distancia con el arco largo.",
      ),
    },
  },
  merfolk: { lang: ["Aquan, Comum", "Acuano, común"], t: { amphibious: amphibious("O sereiano", "El tritón") } },
  merrow: {
    lang: ["Abissal, Aquan", "Abisal, acuano"],
    t: { amphibious: amphibious("O merrow", "El merrow") },
    a: { multiattack: multi("O merrow faz dois ataques: um de mordida e um de garras ou arpão.", "El merrow hace dos ataques: uno de mordisco y otro de garras o arpón.") },
  },
  mimic: {
    imm: ["ácido", "ácido"],
    t: {
      "adhesive-object-form-only": [
        "Adesivo (só na forma de objeto)",
        "O mímico gruda em tudo o que o toca. Uma criatura Enorme ou menor grudada no mímico também fica agarrada por ele (CD 13 para escapar). Testes de habilidade para escapar dessa agarrada têm desvantagem.",
        "Adhesivo (solo en forma de objeto)",
        "El mímico se adhiere a todo lo que lo toque. Una criatura Enorme o más pequeña adherida al mímico también queda agarrada por él (CD 13 para escapar). Las pruebas de característica para escapar de esta presa tienen desventaja.",
      ],
      "false-appearance-object-form-only": ["Falsa Aparência (só na forma de objeto)", "Enquanto fica imóvel, o mímico é indistinguível de um objeto comum.", "Apariencia falsa (solo en forma de objeto)", "Mientras permanece inmóvil, el mímico es indistinguible de un objeto normal."],
      grappler: ["Agarrador", "O mímico tem vantagem nas jogadas de ataque contra qualquer criatura que esteja agarrando.", "Agarrador", "El mímico tiene ventaja en las tiradas de ataque contra cualquier criatura que tenga agarrada."],
      shapechanger: [
        "Metamorfo",
        "O mímico pode usar a ação para se transformar num objeto ou voltar à forma verdadeira, amorfa. As estatísticas são as mesmas em todas as formas. O equipamento que veste ou carrega não se transforma. Volta à forma verdadeira se morrer.",
        "Cambiaformas",
        "El mímico puede usar su acción para transformarse en un objeto o volver a su forma verdadera, amorfa. Sus estadísticas son las mismas en todas las formas. El equipo que lleve puesto o encima no se transforma. Vuelve a su forma verdadera si muere.",
      ],
    },
  },
  minotaur: {
    lang: ["Abissal", "Abisal"],
    t: {
      charge: GORE_CHARGE("o minotauro", "el minotauro"),
      "labyrinthine-recall": ["Memória do Labirinto", "O minotauro se lembra perfeitamente de qualquer caminho que já tenha percorrido.", "Memoria laberíntica", "El minotauro recuerda a la perfección cualquier camino que haya recorrido."],
      reckless: [
        "Imprudente",
        "No início do turno, o minotauro pode ganhar vantagem em todas as jogadas de ataque corpo a corpo com arma que fizer naquele turno, mas as jogadas de ataque contra ele têm vantagem até o início do seu próximo turno.",
        "Temerario",
        "Al principio de su turno, el minotauro puede obtener ventaja en todas las tiradas de ataque cuerpo a cuerpo con arma que haga ese turno, pero las tiradas de ataque contra él tienen ventaja hasta el principio de su siguiente turno.",
      ],
    },
  },
  "minotaur-skeleton": {
    lang: ["entende Abissal mas não fala", "entiende abisal pero no habla"],
    imm: POISON,
    vul: ["concussão", "contundente"],
    t: { charge: GORE_CHARGE("o esqueleto", "el esqueleto") },
  },
  mule: {
    t: {
      "beast-of-burden": ["Besta de Carga", "A mula conta como um animal Grande para calcular a capacidade de carga.", "Bestia de carga", "La mula cuenta como un animal Grande para calcular su capacidad de carga."],
      "sure-footed": SURE_FOOTED("A mula", "La mula"),
    },
  },
  mummy: {
    lang: ["os idiomas que conhecia em vida", "los idiomas que conocía en vida"],
    res: NONMAGICAL,
    imm: ["necrótico, veneno", "necrótico, veneno"],
    vul: ["fogo", "fuego"],
    a: {
      "dreadful-glare": DREADFUL_GLARE("A múmia", "a múmia", "La momia", "a la momia", 11, "todas as múmias (mas não dos senhores das múmias)", "todas las momias (pero no de los señores momia)"),
      multiattack: MUMMY_MULTI,
    },
  },
  "mummy-lord": {
    lang: ["os idiomas que conhecia em vida", "los idiomas que conocía en vida"],
    imm: ["necrótico, veneno; " + NONMAGICAL[0], "necrótico, veneno; " + NONMAGICAL[1]],
    vul: ["concussão", "contundente"],
    t: {
      "magic-resistance": magicRes("O senhor das múmias", "El señor momia"),
      rejuvenation: [
        "Rejuvenescer",
        "Um senhor das múmias destruído ganha um corpo novo em 24 horas se o seu coração estiver intacto, recuperando todos os pontos de vida e voltando à ativa. O corpo novo aparece a até 5 ft do coração.",
        "Rejuvenecimiento",
        "Un señor momia destruido obtiene un cuerpo nuevo en 24 horas si su corazón está intacto, recupera todos sus puntos de golpe y vuelve a estar activo. El cuerpo nuevo aparece a 5 ft o menos del corazón.",
      ],
      spellcasting: [
        "Conjuração",
        "O senhor das múmias é um conjurador de 10º nível. Sua habilidade de conjuração é Sabedoria (CD de resistência de magia 17, +9 para acertar com ataques de magia). Tem as seguintes magias de clérigo preparadas:\n\n* Truques (à vontade): chama sagrada, taumaturgia\n* 1º nível (4 espaços): comando, raio guiador, escudo da fé\n* 2º nível (3 espaços): imobilizar pessoa, silêncio, arma espiritual\n* 3º nível (3 espaços): animar mortos, dissipar magia\n* 4º nível (3 espaços): adivinhação, guardião da fé\n* 5º nível (2 espaços): contágio, praga de insetos\n* 6º nível (1 espaço): ferir",
        "Lanzamiento de conjuros",
        "El señor momia es un lanzador de conjuros de nivel 10. Su aptitud mágica es Sabiduría (CD de salvación de conjuros 17, +9 al ataque con conjuros). Tiene preparados los siguientes conjuros de clérigo:\n\n* Trucos (a voluntad): llama sagrada, taumaturgia\n* Nivel 1 (4 espacios): orden imperiosa, saeta guía, escudo de fe\n* Nivel 2 (3 espacios): inmovilizar persona, silencio, arma espiritual\n* Nivel 3 (3 espacios): animar a los muertos, disipar magia\n* Nivel 4 (3 espacios): adivinación, guardián de la fe\n* Nivel 5 (2 espacios): contagio, plaga de insectos\n* Nivel 6 (1 espacio): dañar",
      ],
    },
    a: {
      attack: ["Ataque", "O senhor das múmias faz um ataque de punho putrefato ou usa o Olhar Pavoroso.", "Ataque", "El señor momia hace un ataque de puño putrefacto o usa su Mirada aterradora."],
      "blasphemous-word": [
        "Palavra Blasfema",
        "O senhor das múmias diz uma palavra blasfema. Cada criatura que não seja morta-viva a até 10 ft dele e que possa ouvir a palavra mágica deve passar num teste de resistência de Constituição CD 16 ou fica atordoada até o fim do próximo turno do senhor das múmias.",
        "Palabra blasfema",
        "El señor momia pronuncia una palabra blasfema. Cada criatura que no sea un muerto viviente a 10 ft o menos de él y que pueda oír la palabra mágica debe superar una tirada de salvación de Constitución CD 16 o queda aturdida hasta el final del siguiente turno del señor momia.",
      ],
      "blinding-dust": [
        "Poeira Cegante",
        "Poeira e areia cegantes giram magicamente em volta do senhor das múmias. Cada criatura a até 5 ft dele deve passar num teste de resistência de Constituição CD 16 ou fica cega até o fim do seu próximo turno.",
        "Polvo cegador",
        "Polvo y arena cegadores giran mágicamente alrededor del señor momia. Cada criatura a 5 ft o menos de él debe superar una tirada de salvación de Constitución CD 16 o queda cegada hasta el final de su siguiente turno.",
      ],
      "channel-negative-energy": [
        "Canalizar Energia Negativa",
        "O senhor das múmias libera energia negativa magicamente. Criaturas a até 60 ft dele, inclusive atrás de barreiras e depois de esquinas, não podem recuperar pontos de vida até o fim do próximo turno do senhor das múmias.",
        "Canalizar energía negativa",
        "El señor momia libera mágicamente energía negativa. Las criaturas a 60 ft o menos de él, incluso tras barreras y doblando esquinas, no pueden recuperar puntos de golpe hasta el final del siguiente turno del señor momia.",
      ],
      "dreadful-glare": DREADFUL_GLARE("O senhor das múmias", "o senhor das múmias", "El señor momia", "al señor momia", 16, "todas as múmias e senhores das múmias", "todas las momias y señores momia"),
      multiattack: MUMMY_MULTI,
      "whirlwind-of-sand": [
        "Redemoinho de Areia",
        "O senhor das múmias se transforma magicamente num redemoinho de areia, se move até 60 ft e volta à forma normal. Na forma de redemoinho, é imune a todo dano e não pode ser agarrado, petrificado, derrubado, impedido nem atordoado. O equipamento que veste ou carrega continua com ele.",
        "Torbellino de arena",
        "El señor momia se transforma mágicamente en un torbellino de arena, se mueve hasta 60 ft y vuelve a su forma normal. En forma de torbellino, es inmune a todo daño y no puede ser agarrado, petrificado, derribado, apresado ni aturdido. El equipo que lleve puesto o encima sigue con él.",
      ],
    },
  },
  nalfeshnee: {
    lang: ABYSSAL,
    res: DEMON_RES,
    imm: POISON,
    t: { "magic-resistance": magicRes("O nalfeshnee", "El nalfeshnee") },
    a: {
      "horror-nimbus": [
        "Aura de Horror",
        "O nalfeshnee emite magicamente uma luz cintilante e multicolorida. Cada criatura a até 15 ft dele que possa ver a luz deve passar num teste de resistência de Sabedoria CD 15 ou fica amedrontada por 1 minuto. A criatura pode repetir o teste ao fim de cada um dos seus turnos, encerrando o efeito em si mesma se passar. Se passar ou o efeito acabar para ela, fica imune à Aura de Horror do nalfeshnee pelas próximas 24 horas.",
        "Nimbo de horror",
        "El nalfeshnee emite mágicamente una luz centelleante y multicolor. Cada criatura a 15 ft o menos de él que pueda ver la luz debe superar una tirada de salvación de Sabiduría CD 15 o queda asustada durante 1 minuto. La criatura puede repetir la tirada al final de cada uno de sus turnos y termina el efecto sobre sí misma si la supera. Si la supera o el efecto termina para ella, es inmune al Nimbo de horror del nalfeshnee durante las siguientes 24 horas.",
      ],
      multiattack: multi("O nalfeshnee usa a Aura de Horror, se puder. Depois faz três ataques: um de mordida e dois de garras.", "El nalfeshnee usa Nimbo de horror si puede. Después hace tres ataques: uno de mordisco y dos de garras."),
      teleport: TELEPORT("O nalfeshnee", "El nalfeshnee"),
    },
  },
  "night-hag": {
    lang: ["Abissal, Comum, Infernal, Primordial", "Abisal, común, infernal, primordial"],
    res: ["frio, fogo; " + SILVER[0], "frío, fuego; " + SILVER[1]],
    t: {
      "innate-spellcasting": [
        "Conjuração Inata",
        "A habilidade de conjuração inata da bruxa é Carisma (CD de resistência de magia 14, +6 para acertar com ataques de magia). Ela pode conjurar as seguintes magias de forma inata, sem precisar de componentes materiais:\n\nÀ vontade: detectar magia, mísseis mágicos\n2/dia cada: viagem planar (só ela mesma), raio do enfraquecimento, sono",
        "Lanzamiento de conjuros innato",
        "La aptitud mágica innata de la saga es Carisma (CD de salvación de conjuros 14, +6 al ataque con conjuros). Puede lanzar de forma innata los siguientes conjuros sin necesidad de componentes materiales:\n\nA voluntad: detectar magia, proyectil mágico\n2/día cada uno: desplazamiento entre planos (solo ella), rayo debilitador, dormir",
      ],
      "magic-resistance": magicRes("A bruxa", "La saga"),
    },
    a: {
      "change-shape": [
        "Mudar de Forma",
        "A bruxa se transforma magicamente numa humanoide feminina Pequena ou Média, ou volta à forma verdadeira. As estatísticas são as mesmas em todas as formas. O equipamento que veste ou carrega não se transforma. Volta à forma verdadeira se morrer.",
        "Cambiar de forma",
        "La saga se transforma mágicamente en una humanoide femenina Pequeña o Mediana, o vuelve a su forma verdadera. Sus estadísticas son las mismas en todas las formas. El equipo que lleve puesto o encima no se transforma. Vuelve a su forma verdadera si muere.",
      ],
      etherealness: [
        "Forma Etérea",
        "A bruxa entra magicamente no Plano Etéreo vindo do Plano Material, ou vice-versa. Para isso, precisa ter uma pedra-coração consigo.",
        "Forma etérea",
        "La saga entra mágicamente en el Plano Etéreo desde el Plano Material, o viceversa. Para ello, debe llevar encima una piedra corazón.",
      ],
      "nightmare-haunting": [
        "Assombro de Pesadelo",
        "No Plano Etéreo, a bruxa toca magicamente um humanoide adormecido no Plano Material. A magia proteção contra o bem e o mal no alvo impede esse contato, assim como um círculo mágico. Enquanto o contato durar, o alvo tem visões terríveis. Se as visões durarem pelo menos 1 hora, o alvo não ganha os benefícios do descanso, e seu máximo de pontos de vida cai 5 (1d10). Se isso reduzir o máximo a 0, o alvo morre e, se for maligno, sua alma fica presa na bolsa de almas da bruxa. A redução do máximo de pontos de vida dura até ser removida pela magia restauração maior ou magia parecida.",
        "Pesadilla acosadora",
        "En el Plano Etéreo, la saga toca mágicamente a un humanoide dormido en el Plano Material. El conjuro protección contra el bien y el mal sobre el objetivo impide este contacto, igual que un círculo mágico. Mientras dure el contacto, el objetivo tiene visiones terribles. Si duran al menos 1 hora, el objetivo no obtiene ningún beneficio de su descanso, y sus puntos de golpe máximos se reducen en 5 (1d10). Si esto reduce sus puntos de golpe máximos a 0, el objetivo muere y, si era malvado, su alma queda atrapada en la bolsa de almas de la saga. La reducción de los puntos de golpe máximos dura hasta que la elimine el conjuro restablecimiento mayor o una magia similar.",
      ],
    },
  },
  nightmare: {
    lang: ["entende Abissal, Comum e Infernal mas não fala", "entiende abisal, común e infernal pero no habla"],
    imm: ["fogo", "fuego"],
    t: {
      "confer-fire-resistance": ["Conceder Resistência ao Fogo", "O pesadelo pode dar resistência a dano de fogo a quem o estiver montando.", "Conferir resistencia al fuego", "La pesadilla puede conceder resistencia al daño de fuego a quien la monte."],
      illumination: ["Iluminação", "O pesadelo emite luz plena num raio de 10 ft e penumbra por mais 10 ft.", "Iluminación", "La pesadilla emite luz brillante en un radio de 10 ft y luz tenue 10 ft más allá."],
    },
    a: {
      "ethereal-stride": [
        "Passo Etéreo",
        "O pesadelo e até três criaturas voluntárias a até 5 ft dele entram magicamente no Plano Etéreo vindos do Plano Material, ou vice-versa.",
        "Zancada etérea",
        "La pesadilla y hasta tres criaturas voluntarias a 5 ft o menos de ella entran mágicamente en el Plano Etéreo desde el Plano Material, o viceversa.",
      ],
    },
  },
  noble: {
    lang: ["dois idiomas quaisquer", "dos idiomas cualesquiera"],
    a: { parry: parry("O nobre", "El noble", 2) },
  },
  "ochre-jelly": {
    res: ["ácido", "ácido"],
    imm: ["elétrico, cortante", "relámpago, cortante"],
    t: {
      amorphous: ["Amorfa", "A geleia pode passar por um espaço de apenas 2,5 cm de largura sem se espremer.", "Amorfa", "La jalea puede pasar por un espacio de solo 2,5 cm de ancho sin apretarse."],
      "spider-climb": spiderClimb("A geleia", "La jalea"),
    },
    a: {
      split: [
        "Dividir",
        "Quando uma geleia Média ou maior sofre dano elétrico ou cortante, ela se divide em duas geleias novas, se tiver pelo menos 10 pontos de vida. Cada geleia nova tem metade dos pontos de vida da original, arredondando para baixo, e é um tamanho menor que ela.",
        "Dividirse",
        "Cuando una jalea Mediana o más grande recibe daño de relámpago o cortante, se divide en dos jaleas nuevas, si tiene al menos 10 puntos de golpe. Cada jalea nueva tiene la mitad de los puntos de golpe de la original, redondeando hacia abajo, y es un tamaño más pequeña que ella.",
      ],
    },
  },
};
