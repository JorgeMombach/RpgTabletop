// Lote 8 das habilidades (Passo 12, fase C): Tapete Sufocante a Enxame de Centopeias. Formato em scripts/srd51/details.mjs.
import { ABYSSAL, ADAMANTINE, ALL_TELEPATHY, amphibious, ANY_ONE, falseAppearance, keen, magicRes, magicWeapons, multi, NONMAGICAL, POISON, smell, spiderClimb, sunlight, waterBreathing, webSense, webWalker } from "./_comum.mjs";

const CREATOR_LANG = ["entende os idiomas do seu criador mas não fala", "entiende los idiomas de su creador pero no habla"];
const SWARM_RES = ["concussão, perfurante, cortante", "contundente, perforante, cortante"];
const SWARM = (bichoPt, bichoEs) => [
  "Enxame",
  `O enxame pode ocupar o espaço de outra criatura e vice-versa, e pode passar por qualquer abertura grande o bastante para ${bichoPt} Miúdo. O enxame não pode recuperar pontos de vida nem ganhar pontos de vida temporários.`,
  "Enjambre",
  `El enjambre puede ocupar el espacio de otra criatura y viceversa, y puede pasar por cualquier abertura lo bastante grande para ${bichoEs} Diminuto. El enjambre no puede recuperar puntos de golpe ni obtener puntos de golpe temporales.`,
];
const POUNCE = (pt, es, cd) => [
  "Bote",
  `Se ${pt} se mover pelo menos 20 ft em linha reta até uma criatura e a acertar com um ataque de garras no mesmo turno, o alvo deve passar num teste de resistência de Força CD ${cd} ou cai. Se o alvo estiver caído, pode fazer um ataque de mordida contra ele como ação bônus.`,
  "Abalanzarse",
  `Si ${es} se mueve al menos 20 ft en línea recta hacia una criatura y la impacta con un ataque de garras en el mismo turno, el objetivo debe superar una tirada de salvación de Fuerza CD ${cd} o queda derribado. Si el objetivo está derribado, puede hacer un ataque de mordisco contra él como acción adicional.`,
];
const UNDEAD_RES = ["ácido, frio, fogo, elétrico, trovejante; " + NONMAGICAL[0], "ácido, frío, fuego, relámpago, trueno; " + NONMAGICAL[1]];
const NAGA_REJUV = ["Rejuvenescer", "Se morrer, a naga volta à vida em 1d6 dias e recupera todos os pontos de vida. Só a magia desejo pode impedir que este traço funcione.", "Rejuvenecimiento", "Si muere, la naga vuelve a la vida en 1d6 días y recupera todos sus puntos de golpe. Solo el conjuro deseo puede impedir que este rasgo funcione."];

export default {
  "rug-of-smothering": {
    imm: ["veneno, psíquico", "veneno, psíquico"],
    t: {
      "antimagic-susceptibility": [
        "Suscetível à Antimagia",
        "O tapete fica incapacitado enquanto estiver na área de um campo antimagia. Se for alvo de dissipar magia, deve passar num teste de resistência de Constituição contra a CD de resistência de magia do conjurador ou fica inconsciente por 1 minuto.",
        "Susceptibilidad a la antimagia",
        "La alfombra queda incapacitada mientras esté en el área de un campo antimagia. Si es objetivo de disipar magia, debe superar una tirada de salvación de Constitución contra la CD de salvación de conjuros del lanzador o queda inconsciente durante 1 minuto.",
      ],
      "damage-transfer": [
        "Transferir Dano",
        "Enquanto estiver agarrando uma criatura, o tapete sofre só metade do dano que recebe, e a criatura agarrada sofre a outra metade.",
        "Transferencia de daño",
        "Mientras tenga agarrada a una criatura, la alfombra solo recibe la mitad del daño que le infligen, y la criatura agarrada recibe la otra mitad.",
      ],
      "false-appearance": falseAppearance("o tapete", "um tapete comum", "la alfombra", "una alfombra normal"),
    },
  },
  "rust-monster": {
    t: {
      "iron-scent": ["Faro de Ferro", "O monstro da ferrugem consegue localizar pelo cheiro qualquer metal ferroso a até 30 ft.", "Olfato férreo", "El monstruo corrosivo puede localizar por el olor cualquier metal ferroso a 30 ft o menos."],
      "rust-metal": [
        "Enferrujar Metal",
        "Qualquer arma não mágica de metal que acerte o monstro da ferrugem é corroída. Depois de causar o dano, a arma sofre uma penalidade permanente e cumulativa de -1 nas jogadas de dano. Se a penalidade chegar a -5, a arma é destruída. Munição não mágica de metal que acerte o monstro é destruída depois de causar o dano.",
        "Oxidar metal",
        "Cualquier arma no mágica de metal que impacte al monstruo corrosivo se corroe. Tras infligir el daño, el arma sufre un penalizador permanente y acumulativo de -1 a las tiradas de daño. Si el penalizador llega a -5, el arma se destruye. La munición no mágica de metal que impacte al monstruo se destruye tras infligir el daño.",
      ],
    },
    a: {
      antennae: [
        "Antenas",
        "O monstro da ferrugem corrói um objeto não mágico de metal ferroso que possa ver a até 5 ft. Se ninguém estiver vestindo ou carregando o objeto, o toque destrói um cubo de 30 cm dele. Se uma criatura estiver vestindo ou carregando o objeto, ela pode fazer um teste de resistência de Destreza CD 11 para evitar o toque.\nSe o objeto tocado for uma armadura ou um escudo de metal em uso, sofre uma penalidade permanente e cumulativa de -1 na CA que oferece. Uma armadura reduzida a CA 10 ou um escudo reduzido a bônus +0 é destruído. Se o objeto tocado for uma arma de metal empunhada, ela enferruja como descrito em Enferrujar Metal.",
        "Antenas",
        "El monstruo corrosivo corroe un objeto no mágico de metal ferroso que pueda ver a 5 ft o menos. Si nadie lleva puesto ni encima el objeto, el toque destruye un cubo de 30 cm de él. Si una criatura lleva puesto o encima el objeto, puede hacer una tirada de salvación de Destreza CD 11 para evitar el toque.\nSi el objeto tocado es una armadura o un escudo de metal en uso, sufre un penalizador permanente y acumulativo de -1 a la CA que proporciona. Una armadura reducida a CA 10 o un escudo reducido a bonificador +0 se destruye. Si el objeto tocado es un arma de metal empuñada, se oxida como se describe en Oxidar metal.",
      ],
    },
  },
  "saber-toothed-tiger": { t: { "keen-smell": smell("O tigre", "El tigre"), pounce: POUNCE("o tigre", "el tigre", 14) } },
  sahuagin: {
    lang: ["Sahuagin", "Sahuagin"],
    t: {
      "blood-frenzy": ["Frenesi Sanguinário", "O sahuagin tem vantagem nas jogadas de ataque corpo a corpo contra qualquer criatura que não esteja com todos os pontos de vida.", "Frenesí sanguinario", "El sahuagin tiene ventaja en las tiradas de ataque cuerpo a cuerpo contra cualquier criatura que no tenga todos sus puntos de golpe."],
      "limited-amphibiousness": ["Anfíbio Limitado", "O sahuagin pode respirar ar e água, mas precisa ficar submerso pelo menos uma vez a cada 4 horas para não sufocar.", "Anfibio limitado", "El sahuagin puede respirar aire y agua, pero necesita sumergirse al menos una vez cada 4 horas para no asfixiarse."],
      "shark-telepathy": ["Telepatia com Tubarões", "O sahuagin pode comandar magicamente qualquer tubarão a até 120 ft, usando uma telepatia limitada.", "Telepatía con tiburones", "El sahuagin puede dar órdenes mágicamente a cualquier tiburón a 120 ft o menos, usando una telepatía limitada."],
    },
    a: { multiattack: multi("O sahuagin faz dois ataques corpo a corpo: um de mordida e um de garras ou lança.", "El sahuagin hace dos ataques cuerpo a cuerpo: uno de mordisco y otro de garras o lanza.") },
  },
  salamander: {
    lang: ["Ignan", "Ígneo"],
    res: NONMAGICAL,
    imm: ["fogo", "fuego"],
    vul: ["frio", "frío"],
    t: {
      "heated-body": ["Corpo Ardente", "Uma criatura que toque a salamandra ou a acerte com um ataque corpo a corpo estando a até 5 ft dela sofre 7 (2d6) de dano de fogo.", "Cuerpo ardiente", "Una criatura que toque a la salamandra o la impacte con un ataque cuerpo a cuerpo estando a 5 ft o menos de ella recibe 7 (2d6) de daño de fuego."],
      "heated-weapons": ["Armas Ardentes", "Qualquer arma corpo a corpo de metal empunhada pela salamandra causa 3 (1d6) de dano de fogo extra ao acertar (já incluído no ataque).", "Armas ardientes", "Cualquier arma cuerpo a cuerpo de metal que empuñe la salamandra inflige 3 (1d6) de daño de fuego adicional al impactar (incluido en el ataque)."],
    },
    a: { multiattack: multi("A salamandra faz dois ataques: um de lança e um de cauda.", "La salamandra hace dos ataques: uno de lanza y otro de cola.") },
  },
  satyr: {
    lang: ["Comum, Élfico, Silvestre", "Común, élfico, silvano"],
    t: { "magic-resistance": magicRes("O sátiro", "El sátiro") },
    a: {
      "variant-panpipes": [
        "Variante: Flauta de Pã",
        "O sátiro toca a flauta e escolhe um dos efeitos mágicos abaixo. Cada criatura a até 60 ft que possa ouvir a flauta deve passar num teste de resistência de Sabedoria CD 13 ou é afetada como descrito. A criatura afetada pode repetir o teste ao fim de cada um dos seus turnos, encerrando o efeito em si mesma se passar. Quem passar no teste fica imune ao efeito desta flauta por 24 horas.\n**Melodia Encantadora.** A criatura fica enfeitiçada pelo sátiro por 1 minuto. Se o sátiro ou um dos seus companheiros ferir a criatura, o efeito acaba na hora.\n**Toque Assustador.** A criatura fica amedrontada por 1 minuto.\n**Canção de Ninar.** A criatura adormece e fica inconsciente por 1 minuto. O efeito acaba se ela sofrer dano ou se alguém usar uma ação para sacudi-la e acordá-la.",
        "Variante: flauta de Pan",
        "El sátiro toca la flauta y elige uno de los efectos mágicos siguientes. Cada criatura a 60 ft o menos que pueda oír la flauta debe superar una tirada de salvación de Sabiduría CD 13 o queda afectada como se describe. La criatura afectada puede repetir la tirada al final de cada uno de sus turnos y termina el efecto sobre sí misma si la supera. Quien supere la tirada es inmune al efecto de esta flauta durante 24 horas.\n**Melodía hechizante.** La criatura queda hechizada por el sátiro durante 1 minuto. Si el sátiro o alguno de sus compañeros daña a la criatura, el efecto termina de inmediato.\n**Tonada aterradora.** La criatura queda asustada durante 1 minuto.\n**Nana suave.** La criatura se duerme y queda inconsciente durante 1 minuto. El efecto termina si recibe daño o si alguien usa una acción para sacudirla y despertarla.",
      ],
    },
  },
  scorpion: {},
  scout: {
    lang: ANY_ONE,
    t: { "keen-hearing-and-sight": keen("Audição e Visão Aguçadas", "Oído y vista agudos", "O batedor", "El explorador", "da audição ou da visão", "del oído o de la vista") },
    a: { multiattack: multi("O batedor faz dois ataques corpo a corpo ou dois ataques à distância.", "El explorador hace dos ataques cuerpo a cuerpo o dos ataques a distancia.") },
  },
  "sea-hag": {
    lang: ["Aquan, Comum, Gigante", "Acuano, común, gigante"],
    t: {
      amphibious: amphibious("A bruxa", "La saga"),
      "horrific-appearance": [
        "Aparência Horrenda",
        "Qualquer humanoide que comece o turno a até 30 ft da bruxa e possa ver a forma verdadeira dela deve fazer um teste de resistência de Sabedoria CD 11. Se falhar, fica amedrontado por 1 minuto. A criatura pode repetir o teste ao fim de cada um dos seus turnos, com desvantagem se a bruxa estiver na sua linha de visão, encerrando o efeito em si mesma se passar. Se passar ou o efeito acabar para ela, fica imune à Aparência Horrenda da bruxa pelas próximas 24 horas.\nA menos que esteja surpreso ou que a revelação da forma verdadeira seja repentina, o alvo pode desviar o olhar e evitar o primeiro teste. Até o início do seu próximo turno, quem desviar o olhar tem desvantagem nas jogadas de ataque contra a bruxa.",
        "Apariencia horrible",
        "Cualquier humanoide que empiece su turno a 30 ft o menos de la saga y pueda ver su forma verdadera debe hacer una tirada de salvación de Sabiduría CD 11. Si falla, queda asustado durante 1 minuto. La criatura puede repetir la tirada al final de cada uno de sus turnos, con desventaja si la saga está en su línea de visión, y termina el efecto sobre sí misma si la supera. Si la supera o el efecto termina para ella, es inmune a la Apariencia horrible de la saga durante las siguientes 24 horas.\nSalvo que esté sorprendido o que la revelación de la forma verdadera sea repentina, el objetivo puede apartar la mirada y evitar la primera tirada. Hasta el principio de su siguiente turno, quien aparte la mirada tiene desventaja en las tiradas de ataque contra la saga.",
      ],
    },
    a: {
      "death-glare": [
        "Olhar Mortal",
        "A bruxa escolhe uma criatura amedrontada que possa ver a até 30 ft. Se o alvo puder ver a bruxa, deve passar num teste de resistência de Sabedoria CD 11 contra esta magia ou cai a 0 pontos de vida.",
        "Mirada mortal",
        "La saga elige a una criatura asustada que pueda ver a 30 ft o menos. Si el objetivo puede ver a la saga, debe superar una tirada de salvación de Sabiduría CD 11 contra esta magia o cae a 0 puntos de golpe.",
      ],
      "illusory-appearance": [
        "Aparência Ilusória",
        "A bruxa cobre a si mesma e tudo o que veste ou carrega com uma ilusão mágica que a faz parecer uma criatura feia de tamanho parecido e forma humanoide. O efeito acaba se a bruxa usar uma ação bônus para encerrá-lo ou se morrer.\nAs mudanças não resistem a um exame físico. Por exemplo, a bruxa pode parecer não ter garras, mas quem tocar sua mão pode senti-las. Fora isso, uma criatura precisa usar uma ação para examinar a ilusão e passar num teste de Inteligência (Investigação) CD 16 para perceber que a bruxa está disfarçada.",
        "Apariencia ilusoria",
        "La saga se cubre a sí misma y todo lo que lleva puesto o encima con una ilusión mágica que la hace parecer una criatura fea de tamaño similar y forma humanoide. El efecto termina si la saga usa una acción adicional para terminarlo o si muere.\nLos cambios no resisten un examen físico. Por ejemplo, la saga puede parecer no tener garras, pero quien le toque la mano podría notarlas. Por lo demás, una criatura debe usar una acción para examinar la ilusión y superar una prueba de Inteligencia (Investigación) CD 16 para darse cuenta de que la saga está disfrazada.",
      ],
    },
  },
  "sea-horse": { t: { "water-breathing": waterBreathing("O cavalo-marinho", "El caballito de mar") } },
  shadow: {
    res: UNDEAD_RES,
    imm: ["necrótico, veneno", "necrótico, veneno"],
    vul: ["radiante", "radiante"],
    t: {
      amorphous: ["Amorfa", "A sombra pode passar por um espaço de apenas 2,5 cm de largura sem se espremer.", "Amorfa", "La sombra puede pasar por un espacio de solo 2,5 cm de ancho sin apretarse."],
      "shadow-stealth": ["Furtividade nas Sombras", "Na penumbra ou na escuridão, a sombra pode usar a ação Esconder como ação bônus.", "Sigilo sombrío", "Con luz tenue o en la oscuridad, la sombra puede usar la acción de Esconderse como acción adicional."],
      "sunlight-weakness": ["Fraqueza à Luz Solar", "Sob a luz do sol, a sombra tem desvantagem nas jogadas de ataque, testes de habilidade e testes de resistência.", "Debilidad a la luz solar", "Bajo la luz del sol, la sombra tiene desventaja en las tiradas de ataque, las pruebas de característica y las tiradas de salvación."],
    },
  },
  "shambling-mound": {
    res: ["frio, fogo", "frío, fuego"],
    imm: ["elétrico", "relámpago"],
    t: {
      "lightning-absorption": [
        "Absorção de Eletricidade",
        "Sempre que o monte ambulante sofreria dano elétrico, ele não sofre o dano e recupera pontos de vida iguais ao dano elétrico causado.",
        "Absorción de relámpagos",
        "Cada vez que el montículo andante fuera a recibir daño de relámpago, no recibe el daño y recupera tantos puntos de golpe como el daño de relámpago infligido.",
      ],
    },
    a: {
      engulf: [
        "Engolfar",
        "O monte ambulante engolfa uma criatura Média ou menor que esteja agarrando. O alvo engolfado fica cego, impedido e sem conseguir respirar, e deve passar num teste de resistência de Constituição CD 14 no início de cada turno do monte ou sofre 13 (2d8 + 4) de dano de concussão. Se o monte se mover, o alvo engolfado se move junto. O monte só pode ter uma criatura engolfada por vez.",
        "Envolver",
        "El montículo andante envuelve a una criatura Mediana o más pequeña que tenga agarrada. El objetivo envuelto queda cegado, apresado y sin poder respirar, y debe superar una tirada de salvación de Constitución CD 14 al principio de cada turno del montículo o recibe 13 (2d8 + 4) de daño contundente. Si el montículo se mueve, el objetivo envuelto se mueve con él. El montículo solo puede tener una criatura envuelta a la vez.",
      ],
      multiattack: multi(
        "O monte ambulante faz dois ataques de pancada. Se os dois acertarem um alvo Médio ou menor, o alvo fica agarrado (CD 14 para escapar) e o monte usa Engolfar nele.",
        "El montículo andante hace dos ataques de golpe. Si ambos impactan a un objetivo Mediano o más pequeño, el objetivo queda agarrado (CD 14 para escapar) y el montículo usa Envolver sobre él.",
      ),
    },
  },
  "shield-guardian": {
    lang: ["entende ordens dadas em qualquer idioma mas não fala", "entiende órdenes dadas en cualquier idioma pero no habla"],
    imm: POISON,
    t: {
      bound: [
        "Vinculado",
        "O guardião protetor está vinculado magicamente a um amuleto. Enquanto o guardião e o amuleto estiverem no mesmo plano de existência, quem usa o amuleto pode chamar o guardião por telepatia para ir até ele, e o guardião sabe a distância e a direção do amuleto. Se o guardião estiver a até 60 ft de quem usa o amuleto, metade de qualquer dano que essa pessoa sofra (arredondando para cima) é transferida para o guardião.",
        "Vinculado",
        "El guardián escudo está vinculado mágicamente a un amuleto. Mientras el guardián y su amuleto estén en el mismo plano de existencia, quien lleve el amuleto puede llamar telepáticamente al guardián para que acuda, y el guardián conoce la distancia y la dirección hasta el amuleto. Si el guardián está a 60 ft o menos de quien lleva el amuleto, la mitad de cualquier daño que este reciba (redondeando hacia arriba) se transfiere al guardián.",
      ],
      regeneration: ["Regeneração", "O guardião protetor recupera 10 pontos de vida no início do turno se tiver pelo menos 1 ponto de vida.", "Regeneración", "El guardián escudo recupera 10 puntos de golpe al principio de su turno si tiene al menos 1 punto de golpe."],
      "spell-storing": [
        "Armazenar Magia",
        "Um conjurador que use o amuleto do guardião pode fazê-lo armazenar uma magia de 4º nível ou menor. Para isso, deve conjurar a magia no guardião. A magia não tem efeito, mas fica guardada nele. Quando quem usa o amuleto mandar, ou quando acontecer uma situação definida antes pelo conjurador, o guardião conjura a magia armazenada com os parâmetros definidos pelo conjurador original, sem precisar de componentes. Quando a magia é conjurada ou outra é armazenada, a anterior se perde.",
        "Almacenar conjuro",
        "Un lanzador de conjuros que lleve el amuleto del guardián puede hacer que este almacene un conjuro de nivel 4 o inferior. Para ello, debe lanzar el conjuro sobre el guardián. El conjuro no tiene efecto, pero queda almacenado en él. Cuando quien lleva el amuleto se lo ordene, o cuando ocurra una situación definida de antemano por el lanzador, el guardián lanza el conjuro almacenado con los parámetros que fijó el lanzador original, sin necesidad de componentes. Cuando se lanza el conjuro o se almacena otro, el anterior se pierde.",
      ],
    },
    a: {
      multiattack: multi("O guardião faz dois ataques de punho.", "El guardián hace dos ataques de puño."),
      shield: [
        "Proteger",
        "Quando uma criatura ataca quem usa o amuleto do guardião, o guardião dá +2 de bônus na CA de quem usa o amuleto, se estiver a até 5 ft dele.",
        "Proteger",
        "Cuando una criatura ataca a quien lleva el amuleto del guardián, el guardián otorga un bonificador de +2 a la CA de quien lo lleva, si está a 5 ft o menos de él.",
      ],
    },
  },
  shrieker: {
    t: { "false-appearance": falseAppearance("o cogumelo", "um fungo comum", "el chillón", "un hongo normal") },
    a: {
      shriek: [
        "Grito",
        "Quando houver luz plena ou uma criatura a até 30 ft do cogumelo, ele solta um grito audível a até 300 ft. Continua gritando até a perturbação sair do alcance e por mais 1d4 turnos do cogumelo.",
        "Chillido",
        "Cuando haya luz brillante o una criatura a 30 ft o menos del chillón, este emite un chillido audible a 300 ft o menos. Sigue chillando hasta que la perturbación salga del alcance y durante 1d4 turnos más del chillón.",
      ],
    },
  },
  skeleton: {
    lang: ["entende os idiomas que conhecia em vida mas não fala", "entiende los idiomas que conocía en vida pero no habla"],
    imm: POISON,
    vul: ["concussão", "contundente"],
  },
  solar: {
    lang: ALL_TELEPATHY,
    res: ["radiante; " + NONMAGICAL[0], "radiante; " + NONMAGICAL[1]],
    imm: ["necrótico, veneno", "necrótico, veneno"],
    t: {
      "angelic-weapons": [
        "Armas Angelicais",
        "Os ataques com arma do solar são mágicos. Quando o solar acerta com qualquer arma, ela causa 6d8 de dano radiante extra (já incluído no ataque).",
        "Armas angélicas",
        "Los ataques con arma del solar son mágicos. Cuando el solar impacta con cualquier arma, esta inflige 6d8 de daño radiante adicional (incluido en el ataque).",
      ],
      "divine-awareness": ["Percepção Divina", "O solar sabe quando ouve uma mentira.", "Conciencia divina", "El solar sabe cuándo oye una mentira."],
      "innate-spellcasting": [
        "Conjuração Inata",
        "A habilidade de conjuração do solar é Carisma (CD de resistência de magia 25). Ele pode conjurar as seguintes magias de forma inata, sem precisar de componentes materiais:\nÀ vontade: detectar o bem e o mal, invisibilidade (só em si mesmo)\n3/dia cada: barreira de lâminas, dissipar o bem e o mal, ressurreição\n1/dia cada: comunhão, controlar o clima",
        "Lanzamiento de conjuros innato",
        "La aptitud mágica del solar es Carisma (CD de salvación de conjuros 25). Puede lanzar de forma innata los siguientes conjuros sin necesidad de componentes materiales:\nA voluntad: detectar el bien y el mal, invisibilidad (solo sobre sí mismo)\n3/día cada uno: barrera de cuchillas, disipar el bien y el mal, resurrección\n1/día cada uno: comunión, controlar el clima",
      ],
      "magic-resistance": magicRes("O solar", "El solar"),
    },
    a: {
      "blinding-gaze": [
        "Olhar Cegante",
        "O solar escolhe uma criatura que possa ver a até 30 ft. Se o alvo puder vê-lo, deve passar num teste de resistência de Constituição CD 15 ou fica cego até uma magia como restauração menor remover a cegueira.",
        "Mirada cegadora",
        "El solar elige a una criatura que pueda ver a 30 ft o menos. Si el objetivo puede verlo, debe superar una tirada de salvación de Constitución CD 15 o queda cegado hasta que una magia como el conjuro restablecimiento menor elimine la ceguera.",
      ],
      "flying-sword": [
        "Espada Voadora",
        "O solar solta a espada grande, que flutua magicamente num espaço desocupado a até 5 ft dele. Se puder ver a espada, o solar pode mandar mentalmente, como ação bônus, que ela voe até 50 ft e faça um ataque contra um alvo ou volte às suas mãos. Se a espada flutuante for alvo de algum efeito, considera-se que o solar a está segurando. A espada cai se o solar morrer.",
        "Espada voladora",
        "El solar suelta su mandoble, que flota mágicamente en un espacio desocupado a 5 ft o menos de él. Si puede ver la espada, el solar puede ordenarle mentalmente, como acción adicional, que vuele hasta 50 ft y haga un ataque contra un objetivo o vuelva a sus manos. Si la espada flotante es objetivo de algún efecto, se considera que el solar la está sosteniendo. La espada cae si el solar muere.",
      ],
      "healing-touch": [
        "Toque Curativo",
        "O solar toca outra criatura. O alvo recupera magicamente 40 (8d8 + 4) pontos de vida e fica livre de qualquer maldição, doença, veneno, cegueira ou surdez.",
        "Toque curativo",
        "El solar toca a otra criatura. El objetivo recupera mágicamente 40 (8d8 + 4) puntos de golpe y queda libre de cualquier maldición, enfermedad, veneno, ceguera o sordera.",
      ],
      multiattack: multi("O solar faz dois ataques de espada grande.", "El solar hace dos ataques de mandoble."),
      "searing-burst": [
        "Explosão Abrasadora",
        "O solar emite energia divina mágica. Cada criatura à sua escolha num raio de 10 ft deve fazer um teste de resistência de Destreza CD 23. Se falhar, sofre 14 (4d6) de dano de fogo mais 14 (4d6) de dano radiante; se passar, metade.",
        "Estallido abrasador",
        "El solar emite energía divina mágica. Cada criatura que elija en un radio de 10 ft debe hacer una tirada de salvación de Destreza CD 23. Si falla, recibe 14 (4d6) de daño de fuego más 14 (4d6) de daño radiante; si la supera, la mitad.",
      ],
      teleport: ["Teletransporte", "O solar se teletransporta magicamente, com todo o equipamento que veste ou carrega, até 120 ft para um espaço desocupado que possa ver.", "Teletransporte", "El solar se teletransporta mágicamente, con todo el equipo que lleve puesto o encima, hasta 120 ft a un espacio desocupado que pueda ver."],
    },
  },
  specter: {
    lang: ["entende os idiomas que conhecia em vida mas não fala", "entiende los idiomas que conocía en vida pero no habla"],
    res: UNDEAD_RES,
    imm: ["necrótico, veneno", "necrótico, veneno"],
    t: {
      "incorporeal-movement": [
        "Movimento Incorpóreo",
        "O espectro pode atravessar outras criaturas e objetos como se fossem terreno difícil. Sofre 5 (1d10) de dano de energia se terminar o turno dentro de um objeto.",
        "Movimiento incorpóreo",
        "El espectro puede atravesar otras criaturas y objetos como si fueran terreno difícil. Recibe 5 (1d10) de daño de fuerza si termina su turno dentro de un objeto.",
      ],
      "sunlight-sensitivity": sunlight("o espectro", "el espectro"),
    },
  },
  spider: { t: { "spider-climb": spiderClimb("A aranha", "La araña"), "web-sense": webSense("a aranha", "la araña"), "web-walker": webWalker("A aranha", "La araña") } },
  "spirit-naga": {
    lang: ["Abissal, Comum", "Abisal, común"],
    imm: POISON,
    t: {
      rejuvenation: NAGA_REJUV,
      spellcasting: [
        "Conjuração",
        "A naga é uma conjuradora de 10º nível. Sua habilidade de conjuração é Inteligência (CD de resistência de magia 14, +6 para acertar com ataques de magia), e ela só precisa de componentes verbais para conjurar. Tem as seguintes magias de mago preparadas:\n\n* Truques (à vontade): mãos mágicas, ilusão menor, raio de gelo\n* 1º nível (4 espaços): enfeitiçar pessoa, detectar magia, sono\n* 2º nível (3 espaços): detectar pensamentos, imobilizar pessoa\n* 3º nível (3 espaços): relâmpago, respirar na água\n* 4º nível (3 espaços): praga, porta dimensional\n* 5º nível (2 espaços): dominar pessoa",
        "Lanzamiento de conjuros",
        "La naga es una lanzadora de conjuros de nivel 10. Su aptitud mágica es Inteligencia (CD de salvación de conjuros 14, +6 al ataque con conjuros), y solo necesita componentes verbales para lanzar sus conjuros. Tiene preparados los siguientes conjuros de mago:\n\n* Trucos (a voluntad): mano de mago, ilusión menor, rayo de escarcha\n* Nivel 1 (4 espacios): hechizar persona, detectar magia, dormir\n* Nivel 2 (3 espacios): detectar pensamientos, inmovilizar persona\n* Nivel 3 (3 espacios): relámpago, respirar bajo el agua\n* Nivel 4 (3 espacios): marchitar, puerta dimensional\n* Nivel 5 (2 espacios): dominar persona",
      ],
    },
  },
  sprite: {
    lang: ["Comum, Élfico, Silvestre", "Común, élfico, silvano"],
    a: {
      "heart-sight": [
        "Ver o Coração",
        "O pixie toca uma criatura e sabe magicamente o estado emocional dela no momento. Se o alvo falhar num teste de resistência de Carisma CD 10, o pixie também sabe a tendência dele. Celestiais, corruptores e mortos-vivos falham automaticamente.",
        "Ver el corazón",
        "El duendecillo toca a una criatura y conoce mágicamente su estado emocional actual. Si el objetivo falla una tirada de salvación de Carisma CD 10, el duendecillo también conoce su alineamiento. Los celestiales, infernales y muertos vivientes fallan automáticamente.",
      ],
      invisibility: [
        "Invisibilidade",
        "O pixie fica magicamente invisível até atacar ou conjurar uma magia, ou até a concentração acabar (como se concentrasse numa magia). O equipamento que veste ou carrega fica invisível junto.",
        "Invisibilidad",
        "El duendecillo se vuelve invisible mágicamente hasta que ataca o lanza un conjuro, o hasta que termina su concentración (como si se concentrara en un conjuro). El equipo que lleve puesto o encima se vuelve invisible con él.",
      ],
    },
  },
  spy: {
    lang: ["dois idiomas quaisquer", "dos idiomas cualesquiera"],
    t: {
      "cunning-action": ["Ação Ardilosa", "Em cada um dos seus turnos, o espião pode usar uma ação bônus para Disparada, Desengajar ou Esconder.", "Acción astuta", "En cada uno de sus turnos, el espía puede usar una acción adicional para Correr, Destrabarse o Esconderse."],
      "sneak-attack-1turn": [
        "Ataque Furtivo (1/turno)",
        "O espião causa 7 (2d6) de dano extra quando acerta um alvo com um ataque com arma e tem vantagem na jogada, ou quando o alvo está a até 5 ft de um aliado do espião que não esteja incapacitado e o espião não tem desvantagem na jogada.",
        "Ataque furtivo (1/turno)",
        "El espía inflige 7 (2d6) de daño adicional cuando impacta a un objetivo con un ataque con arma y tiene ventaja en la tirada, o cuando el objetivo está a 5 ft o menos de un aliado del espía que no esté incapacitado y el espía no tiene desventaja en la tirada.",
      ],
    },
    a: { multiattack: multi("O espião faz dois ataques corpo a corpo.", "El espía hace dos ataques cuerpo a cuerpo.") },
  },
  "steam-mephit": {
    lang: ["Aquan, Ignan", "Acuano, ígneo"],
    imm: ["fogo, veneno", "fuego, veneno"],
    t: {
      "death-burst": [
        "Explosão Mortal",
        "Quando o mefite morre, explode numa nuvem de vapor. Cada criatura a até 5 ft dele deve passar num teste de resistência de Destreza CD 10 ou sofre 4 (1d8) de dano de fogo.",
        "Estallido mortal",
        "Cuando el mefítico muere, estalla en una nube de vapor. Cada criatura a 5 ft o menos de él debe superar una tirada de salvación de Destreza CD 10 o recibe 4 (1d8) de daño de fuego.",
      ],
      "innate-spellcasting-1day": [
        "Conjuração Inata (1/dia)",
        "O mefite pode conjurar *nublar* de forma inata, sem precisar de componentes materiais. Sua habilidade de conjuração inata é Carisma.",
        "Lanzamiento de conjuros innato (1/día)",
        "El mefítico puede lanzar *difuminar* de forma innata, sin necesidad de componentes materiales. Su aptitud mágica innata es Carisma.",
      ],
    },
    a: {
      "steam-breath": [
        "Sopro de Vapor",
        "O mefite exala um cone de 15 ft de vapor escaldante. Cada criatura na área deve fazer um teste de resistência de Destreza CD 10. Se falhar, sofre 4 (1d8) de dano de fogo; se passar, metade.",
        "Aliento de vapor",
        "El mefítico exhala un cono de 15 ft de vapor abrasador. Cada criatura en esa área debe hacer una tirada de salvación de Destreza CD 10. Si falla, recibe 4 (1d8) de daño de fuego; si la supera, la mitad.",
      ],
    },
  },
  stirge: {},
  "stone-giant": {
    lang: ["Gigante", "Gigante"],
    t: { "stone-camouflage": ["Camuflagem nas Pedras", "O gigante tem vantagem em testes de Destreza (Furtividade) para se esconder em terreno rochoso.", "Camuflaje en la piedra", "El gigante tiene ventaja en las pruebas de Destreza (Sigilo) para esconderse en terreno rocoso."] },
    a: {
      multiattack: multi("O gigante faz dois ataques de clava grande.", "El gigante hace dos ataques de gran garrote."),
      "rock-catching": [
        "Pegar Pedras",
        "Se uma pedra ou objeto parecido for arremessado no gigante, ele pode, passando num teste de resistência de Destreza CD 10, pegar o projétil e não sofrer dano de concussão dele.",
        "Atrapar rocas",
        "Si le lanzan al gigante una roca u objeto similar, puede, superando una tirada de salvación de Destreza CD 10, atrapar el proyectil y no recibir daño contundente de él.",
      ],
    },
  },
  "stone-golem": {
    lang: CREATOR_LANG,
    imm: ["veneno, psíquico; " + ADAMANTINE[0], "veneno, psíquico; " + ADAMANTINE[1]],
    t: {
      "immutable-form": ["Forma Imutável", "O golem é imune a qualquer magia ou efeito que alteraria sua forma.", "Forma inmutable", "El gólem es inmune a cualquier conjuro o efecto que fuera a alterar su forma."],
      "magic-resistance": magicRes("O golem", "El gólem"),
      "magic-weapons": magicWeapons("do golem", "del gólem"),
    },
    a: {
      multiattack: multi("O golem faz dois ataques de pancada.", "El gólem hace dos ataques de golpe."),
      slow: [
        "Lentidão",
        "O golem escolhe uma ou mais criaturas que possa ver a até 10 ft. Cada alvo deve fazer um teste de resistência de Sabedoria CD 17 contra esta magia. Se falhar, o alvo não pode usar reações, seu deslocamento cai pela metade e não pode fazer mais de um ataque no turno. Além disso, no turno pode usar uma ação ou uma ação bônus, não as duas. Os efeitos duram 1 minuto. O alvo pode repetir o teste ao fim de cada um dos seus turnos, encerrando o efeito em si mesmo se passar.",
        "Lentitud",
        "El gólem elige a una o más criaturas que pueda ver a 10 ft o menos. Cada objetivo debe hacer una tirada de salvación de Sabiduría CD 17 contra esta magia. Si falla, el objetivo no puede usar reacciones, su velocidad se reduce a la mitad y no puede hacer más de un ataque en su turno. Además, en su turno puede usar una acción o una acción adicional, no ambas. Los efectos duran 1 minuto. El objetivo puede repetir la tirada al final de cada uno de sus turnos y termina el efecto sobre sí mismo si la supera.",
      ],
    },
  },
  "storm-giant": {
    lang: ["Comum, Gigante", "Común, gigante"],
    res: ["frio", "frío"],
    imm: ["elétrico, trovejante", "relámpago, trueno"],
    t: {
      amphibious: amphibious("O gigante", "El gigante"),
      "innate-spellcasting": [
        "Conjuração Inata",
        "A habilidade de conjuração inata do gigante é Carisma (CD de resistência de magia 17). Ele pode conjurar as seguintes magias de forma inata, sem precisar de componentes materiais:\n\nÀ vontade: detectar magia, queda suave, levitação, luz\n3/dia cada: controlar o clima, respirar na água",
        "Lanzamiento de conjuros innato",
        "La aptitud mágica innata del gigante es Carisma (CD de salvación de conjuros 17). Puede lanzar de forma innata los siguientes conjuros sin necesidad de componentes materiales:\n\nA voluntad: detectar magia, caída de pluma, levitar, luz\n3/día cada uno: controlar el clima, respirar bajo el agua",
      ],
    },
    a: {
      "lightning-strike": [
        "Golpe de Raio",
        "O gigante arremessa um raio mágico num ponto que possa ver a até 500 ft. Cada criatura a até 10 ft desse ponto deve fazer um teste de resistência de Destreza CD 17. Se falhar, sofre 54 (12d8) de dano elétrico; se passar, metade.",
        "Golpe de relámpago",
        "El gigante lanza un relámpago mágico a un punto que pueda ver a 500 ft o menos. Cada criatura a 10 ft o menos de ese punto debe hacer una tirada de salvación de Destreza CD 17. Si falla, recibe 54 (12d8) de daño de relámpago; si la supera, la mitad.",
      ],
      multiattack: multi("O gigante faz dois ataques de espada grande.", "El gigante hace dos ataques de mandoble."),
    },
  },
  succubusincubus: {
    lang: ["Abissal, Comum, Infernal, telepatia 60 ft", "Abisal, común, infernal, telepatía 60 ft"],
    res: ["frio, fogo, elétrico, veneno; " + NONMAGICAL[0], "frío, fuego, relámpago, veneno; " + NONMAGICAL[1]],
    t: {
      shapechanger: [
        "Metamorfo",
        "O corruptor pode usar a ação para se transformar num humanoide Pequeno ou Médio, ou voltar à forma verdadeira. Sem asas, perde o deslocamento de voo. Fora o tamanho e o deslocamento, as estatísticas são as mesmas em todas as formas. O equipamento que veste ou carrega não se transforma. Volta à forma verdadeira se morrer.",
        "Cambiaformas",
        "El infernal puede usar su acción para transformarse en un humanoide Pequeño o Mediano, o volver a su forma verdadera. Sin alas, pierde su velocidad volando. Salvo el tamaño y la velocidad, sus estadísticas son las mismas en todas las formas. El equipo que lleve puesto o encima no se transforma. Vuelve a su forma verdadera si muere.",
      ],
      "telepathic-bond": [
        "Vínculo Telepático",
        "O corruptor ignora o limite de alcance da telepatia ao se comunicar com uma criatura que tenha enfeitiçado. Os dois nem precisam estar no mesmo plano de existência.",
        "Vínculo telepático",
        "El infernal ignora el límite de alcance de su telepatía al comunicarse con una criatura que tenga hechizada. Ni siquiera necesitan estar en el mismo plano de existencia.",
      ],
    },
    a: {
      charm: [
        "Enfeitiçar",
        "Um humanoide que o corruptor possa ver a até 30 ft deve passar num teste de resistência de Sabedoria CD 15 ou fica magicamente enfeitiçado por 1 dia. O alvo enfeitiçado obedece às ordens faladas ou telepáticas do corruptor. Se o alvo sofrer qualquer mal ou receber uma ordem suicida, pode repetir o teste, encerrando o efeito se passar. Se passar no teste, ou se o efeito acabar, fica imune ao Enfeitiçar deste corruptor pelas próximas 24 horas.\nO corruptor só pode ter um alvo enfeitiçado por vez. Se enfeitiçar outro, o efeito no anterior acaba.",
        "Hechizar",
        "Un humanoide que el infernal pueda ver a 30 ft o menos debe superar una tirada de salvación de Sabiduría CD 15 o queda hechizado mágicamente durante 1 día. El objetivo hechizado obedece las órdenes verbales o telepáticas del infernal. Si el objetivo sufre cualquier daño o recibe una orden suicida, puede repetir la tirada y termina el efecto si la supera. Si supera la tirada, o si el efecto termina, es inmune al Hechizar de este infernal durante las siguientes 24 horas.\nEl infernal solo puede tener un objetivo hechizado a la vez. Si hechiza a otro, el efecto sobre el anterior termina.",
      ],
      "draining-kiss": [
        "Beijo Drenante",
        "O corruptor beija uma criatura que tenha enfeitiçado ou uma criatura voluntária. O alvo deve fazer um teste de resistência de Constituição CD 15 contra esta magia. Se falhar, sofre 32 (5d10 + 5) de dano psíquico; se passar, metade. O máximo de pontos de vida do alvo cai na mesma quantidade do dano sofrido, até ele terminar um descanso longo. O alvo morre se isso reduzir o máximo a 0.",
        "Beso drenante",
        "El infernal besa a una criatura que tenga hechizada o a una criatura voluntaria. El objetivo debe hacer una tirada de salvación de Constitución CD 15 contra esta magia. Si falla, recibe 32 (5d10 + 5) de daño psíquico; si la supera, la mitad. Sus puntos de golpe máximos se reducen en la misma cantidad que el daño recibido, hasta que termine un descanso largo. El objetivo muere si esto reduce sus puntos de golpe máximos a 0.",
      ],
      etherealness: ["Forma Etérea", "O corruptor entra magicamente no Plano Etéreo vindo do Plano Material, ou vice-versa.", "Forma etérea", "El infernal entra mágicamente en el Plano Etéreo desde el Plano Material, o viceversa."],
    },
  },
  "swarm-of-bats": {
    res: SWARM_RES,
    t: {
      echolocation: ["Ecolocalização", "O enxame não pode usar a percepção às cegas enquanto estiver surdo.", "Ecolocalización", "El enjambre no puede usar su vista ciega mientras esté ensordecido."],
      "keen-hearing": keen("Audição Aguçada", "Oído agudo", "O enxame", "El enjambre", "da audição", "del oído"),
      swarm: SWARM("um morcego", "un murciélago"),
    },
  },
  "swarm-of-beetles": { res: SWARM_RES, t: { swarm: SWARM("um inseto", "un insecto") } },
  "swarm-of-centipedes": { res: SWARM_RES, t: { swarm: SWARM("um inseto", "un insecto") } },
};
