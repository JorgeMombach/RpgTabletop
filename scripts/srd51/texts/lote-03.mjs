// Lote 3 das habilidades (Passo 12, fase C): Dretch a Morcego Gigante. Formato em scripts/srd51/details.mjs.
import { ADAMANTINE, amphibious, coldSilver, falseAppearance, FIRE_POISON, INFERNAL, magicRes, magicWeapons, multi, NONMAGICAL, POISON, sight, smell } from "./_comum.mjs";

const FEY_ANCESTRY = (pt, es) => ["Ancestralidade Feérica", `${pt} tem vantagem em testes de resistência contra ficar enfeitiçado, e magia não pode fazê-lo dormir.`, "Linaje feérico", `${es} tiene ventaja en las tiradas de salvación para no quedar hechizado, y la magia no puede dormirlo.`];
const SUNLIGHT = (pt, es) => ["Sensibilidade à Luz Solar", `Sob a luz do sol, ${pt} tem desvantagem nas jogadas de ataque e nos testes de Sabedoria (Percepção) que dependam da visão.`, "Sensibilidad a la luz solar", `Bajo la luz del sol, ${es} tiene desventaja en las tiradas de ataque y en las pruebas de Sabiduría (Percepción) que dependan de la vista.`];
const SPIDER_CLIMB = (pt, es) => ["Escalar como Aranha", `${pt} pode escalar superfícies difíceis, inclusive de cabeça para baixo no teto, sem precisar fazer teste de habilidade.`, "Trepar cual arácnido", `${es} puede trepar por superficies difíciles, incluso boca abajo por el techo, sin necesidad de hacer una prueba de característica.`];
const WEB_WALKER = (pt, es) => ["Andarilho das Teias", `${pt} ignora restrições de movimento causadas por teias.`, "Caminante de telarañas", `${es} ignora las restricciones de movimiento causadas por telarañas.`];
const DROW_SPELLS = (pt, es, attrPt, attrEs) => [
  "Conjuração Inata",
  `A habilidade de conjuração inata ${pt} é ${attrPt}. Pode conjurar as seguintes magias, sem precisar de componentes materiais:\nÀ vontade: luzes dançantes\n1/dia cada: escuridão, fogo das fadas`,
  "Lanzamiento de conjuros innato",
  `La aptitud mágica innata ${es} es ${attrEs}. Puede lanzar los siguientes conjuros sin necesidad de componentes materiales:\nA voluntad: luces danzantes\n1/día cada uno: oscuridad, fuego feérico`,
];
const BERSERK = (hp, extraPt, extraEs) => [
  "Fúria Desenfreada",
  `Sempre que o golem começar o turno com ${hp} pontos de vida ou menos, role um d6. Num 6, o golem entra em fúria. Em cada um dos seus turnos em fúria, ataca a criatura mais próxima que possa ver. Se nenhuma estiver perto o bastante para se mover até ela e atacar, ataca um objeto, de preferência menor que ele. Depois que entra em fúria, continua assim até ser destruído ou recuperar todos os pontos de vida.${extraPt}`,
  "Enloquecido",
  `Cada vez que el gólem empiece su turno con ${hp} puntos de golpe o menos, tira un d6. Con un 6, el gólem enloquece. En cada uno de sus turnos mientras está enloquecido, ataca a la criatura más cercana que pueda ver. Si ninguna está lo bastante cerca para moverse hasta ella y atacarla, ataca un objeto, preferiblemente más pequeño que él. Una vez enloquece, sigue así hasta ser destruido o recuperar todos sus puntos de golpe.${extraEs}`,
];
const ECHO = (pt, es) => ["Ecolocalização", `${pt} não pode usar a percepção às cegas enquanto estiver surdo.`, "Ecolocalización", `${es} no puede usar su vista ciega mientras esté ensordecido.`];
const HEARING = (pt, es) => ["Audição Aguçada", `${pt} tem vantagem em testes de Sabedoria (Percepção) que dependam da audição.`, "Oído agudo", `${es} tiene ventaja en las pruebas de Sabiduría (Percepción) que dependan del oído.`];

export default {
  dretch: {
    lang: ["Abissal, telepatia 60 ft (só com criaturas que entendam Abissal)", "Abisal, telepatía 60 ft (solo con criaturas que entiendan abisal)"],
    res: ["frio, fogo, elétrico", "frío, fuego, relámpago"],
    imm: POISON,
    a: {
      multiattack: multi("O dretch faz dois ataques: um de mordida e um de garras.", "El dretch hace dos ataques: uno de mordisco y otro de garras."),
      "fetid-cloud": [
        "Nuvem Fétida",
        "Um gás verde e nojento se espalha num raio de 10 ft a partir do dretch. O gás contorna esquinas, e a área fica levemente obscurecida. Dura 1 minuto ou até um vento forte dispersá-lo. Qualquer criatura que comece o turno na área deve passar num teste de resistência de Constituição CD 11 ou fica envenenada até o início do seu próximo turno. Envenenado assim, o alvo pode usar uma ação ou uma ação bônus no turno, não as duas, e não pode usar reações.",
        "Nube fétida",
        "Un gas verde y repugnante se extiende en un radio de 10 ft desde el dretch. El gas dobla las esquinas y su área está ligeramente oscurecida. Dura 1 minuto o hasta que un viento fuerte lo disperse. Cualquier criatura que empiece su turno en esa área debe superar una tirada de salvación de Constitución CD 11 o queda envenenada hasta el principio de su siguiente turno. Mientras está envenenado así, el objetivo puede usar una acción o una acción adicional en su turno, no ambas, y no puede usar reacciones.",
      ],
    },
  },
  drider: {
    lang: ["Élfico, Dialeto Subterrâneo", "Élfico, infracomún"],
    t: {
      "fey-ancestry": FEY_ANCESTRY("O drider", "El drider"),
      "innate-spellcasting": [
        "Conjuração Inata",
        "A habilidade de conjuração inata do drider é Sabedoria (CD de resistência de magia 13). Pode conjurar as seguintes magias, sem precisar de componentes materiais:\nÀ vontade: luzes dançantes\n1/dia cada: escuridão, fogo das fadas",
        "Lanzamiento de conjuros innato",
        "La aptitud mágica innata del drider es Sabiduría (CD de salvación de conjuros 13). Puede lanzar los siguientes conjuros sin necesidad de componentes materiales:\nA voluntad: luces danzantes\n1/día cada uno: oscuridad, fuego feérico",
      ],
      "spider-climb": SPIDER_CLIMB("O drider", "El drider"),
      "sunlight-sensitivity": SUNLIGHT("o drider", "el drider"),
      "web-walker": WEB_WALKER("O drider", "El drider"),
    },
    a: {
      multiattack: multi(
        "O drider faz três ataques, com a espada longa ou com o arco longo. Pode trocar um desses ataques por um ataque de mordida.",
        "El drider hace tres ataques, con la espada larga o con el arco largo. Puede sustituir uno de ellos por un ataque de mordisco.",
      ),
    },
  },
  drow: {
    lang: ["Élfico, Dialeto Subterrâneo", "Élfico, infracomún"],
    t: {
      "fey-ancestry": FEY_ANCESTRY("O drow", "El drow"),
      "innate-spellcasting": DROW_SPELLS("do drow", "del drow", "Carisma (CD de resistência de magia 11)", "Carisma (CD de salvación de conjuros 11)"),
      "sunlight-sensitivity": SUNLIGHT("o drow", "el drow"),
    },
  },
  druid: {
    lang: ["Druídico e mais dois idiomas quaisquer", "Druídico y otros dos idiomas cualesquiera"],
    t: {
      spellcasting: [
        "Conjuração",
        "O druida é um conjurador de 4º nível. Sua habilidade de conjuração é Sabedoria (CD de resistência de magia 12, +4 para acertar com ataques de magia). Ele tem as seguintes magias de druida preparadas:\n\n* Truques (à vontade): arte druídica, produzir chama, shillelagh\n* 1º nível (4 espaços): constrição, passos largos, falar com animais, onda trovejante\n* 2º nível (3 espaços): mensageiro animal, pele de árvore",
        "Lanzamiento de conjuros",
        "El druida es un lanzador de conjuros de nivel 4. Su aptitud mágica es Sabiduría (CD de salvación de conjuros 12, +4 al ataque con conjuros). Tiene preparados los siguientes conjuros de druida:\n\n* Trucos (a voluntad): druidismo, producir llama, garrote\n* Nivel 1 (4 espacios): enmarañar, zancada prodigiosa, hablar con los animales, onda atronadora\n* Nivel 2 (3 espacios): mensajero animal, piel robliza",
      ],
    },
  },
  dryad: {
    lang: ["Élfico, Silvestre", "Élfico, silvano"],
    t: {
      "innate-spellcasting": [
        "Conjuração Inata",
        "A habilidade de conjuração inata da dríade é Carisma (CD de resistência de magia 14). Ela pode conjurar as seguintes magias, sem precisar de componentes materiais:\n\nÀ vontade: arte druídica\n3/dia cada: constrição, bom fruto\n1/dia cada: pele de árvore, passos sem pegadas, shillelagh",
        "Lanzamiento de conjuros innato",
        "La aptitud mágica innata de la dríade es Carisma (CD de salvación de conjuros 14). Puede lanzar los siguientes conjuros sin necesidad de componentes materiales:\n\nA voluntad: druidismo\n3/día cada uno: enmarañar, bayas nutritivas\n1/día cada uno: piel robliza, pasar sin rastro, garrote",
      ],
      "magic-resistance": magicRes("A dríade", "La dríade"),
      "speak-with-beasts-and-plants": [
        "Falar com Feras e Plantas",
        "A dríade pode se comunicar com feras e plantas como se falassem a mesma língua.",
        "Hablar con bestias y plantas",
        "La dríade puede comunicarse con bestias y plantas como si compartieran un idioma.",
      ],
      "tree-stride": [
        "Passo de Árvore",
        "Uma vez no seu turno, a dríade pode usar 10 ft do deslocamento para entrar magicamente numa árvore viva ao seu alcance e sair de outra árvore viva a até 60 ft da primeira, surgindo num espaço desocupado a até 5 ft da segunda árvore. As duas árvores precisam ser Grandes ou maiores.",
        "Paso arbóreo",
        "Una vez en su turno, la dríade puede usar 10 ft de su movimiento para entrar mágicamente en un árbol vivo a su alcance y salir de otro árbol vivo a 60 ft o menos del primero, apareciendo en un espacio desocupado a 5 ft o menos del segundo árbol. Ambos árboles deben ser Grandes o mayores.",
      ],
    },
    a: {
      "fey-charm": [
        "Encanto Feérico",
        "A dríade escolhe um humanoide ou fera que possa ver a até 30 ft. Se o alvo puder ver a dríade, deve passar num teste de resistência de Sabedoria CD 14 ou fica magicamente enfeitiçado. A criatura enfeitiçada vê a dríade como uma amiga de confiança, a ser ouvida e protegida. Embora não esteja sob o controle da dríade, recebe os pedidos e as ações dela da forma mais favorável possível.\nSempre que a dríade ou seus aliados fizerem algo nocivo ao alvo, ele pode repetir o teste de resistência, encerrando o efeito em si mesmo se passar. Fora isso, o efeito dura 24 horas ou até a dríade morrer, estar num plano de existência diferente do alvo ou encerrar o efeito como ação bônus. Se o alvo passar no teste, fica imune ao Encanto Feérico da dríade pelas próximas 24 horas.\nA dríade pode ter no máximo um humanoide e até três feras enfeitiçados ao mesmo tempo.",
        "Encanto feérico",
        "La dríade elige un humanoide o bestia que pueda ver a 30 ft o menos. Si el objetivo puede ver a la dríade, debe superar una tirada de salvación de Sabiduría CD 14 o queda hechizado mágicamente. La criatura hechizada ve a la dríade como una amiga de confianza a la que escuchar y proteger. Aunque no está bajo el control de la dríade, interpreta sus peticiones y acciones de la forma más favorable posible.\nCada vez que la dríade o sus aliados hagan algo dañino al objetivo, este puede repetir la tirada de salvación y termina el efecto sobre sí mismo si la supera. Si no, el efecto dura 24 horas o hasta que la dríade muera, esté en un plano de existencia distinto del objetivo o termine el efecto como acción adicional. Si el objetivo supera la tirada, es inmune al Encanto feérico de la dríade durante las siguientes 24 horas.\nLa dríade puede tener hechizados como mucho a un humanoide y hasta tres bestias a la vez.",
      ],
    },
  },
  duergar: {
    lang: ["Anão, Dialeto Subterrâneo", "Enano, infracomún"],
    res: POISON,
    t: {
      "duergar-resilience": [
        "Resiliência Duergar",
        "O duergar tem vantagem em testes de resistência contra veneno, magias e ilusões, e para resistir a ficar enfeitiçado ou paralisado.",
        "Resiliencia duergar",
        "El duergar tiene ventaja en las tiradas de salvación contra el veneno, los conjuros y las ilusiones, y para no quedar hechizado ni paralizado.",
      ],
      "sunlight-sensitivity": SUNLIGHT("o duergar", "el duergar"),
    },
    a: {
      enlarge: [
        "Aumentar",
        "Por 1 minuto, o duergar aumenta magicamente de tamanho, junto com tudo o que veste ou carrega. Aumentado, ele fica Grande, dobra os dados de dano dos ataques com arma baseados em Força (já incluído nos ataques) e faz testes de Força e testes de resistência de Força com vantagem. Se não tiver espaço para ficar Grande, chega ao maior tamanho que couber.",
        "Agrandarse",
        "Durante 1 minuto, el duergar aumenta mágicamente de tamaño, junto con todo lo que lleve puesto o encima. Mientras está agrandado, es Grande, duplica los dados de daño de sus ataques con arma basados en Fuerza (incluido en los ataques) y hace las pruebas y tiradas de salvación de Fuerza con ventaja. Si no tiene sitio para volverse Grande, alcanza el mayor tamaño que quepa.",
      ],
      invisibility: [
        "Invisibilidade",
        "O duergar fica magicamente invisível até atacar, conjurar uma magia ou usar Aumentar, ou até a concentração ser interrompida, por até 1 hora (como se concentrasse numa magia). O equipamento que veste ou carrega fica invisível junto.",
        "Invisibilidad",
        "El duergar se vuelve invisible mágicamente hasta que ataca, lanza un conjuro o usa Agrandarse, o hasta que se rompe su concentración, hasta 1 hora (como si se concentrara en un conjuro). El equipo que lleve puesto o encima se vuelve invisible con él.",
      ],
    },
  },
  "dust-mephit": {
    lang: ["Auran, Terran", "Aurano, terrano"],
    imm: POISON,
    vul: ["fogo", "fuego"],
    t: {
      "death-burst": [
        "Explosão Mortal",
        "Quando o mefite morre, explode numa nuvem de poeira. Cada criatura a até 5 ft dele deve passar num teste de resistência de Constituição CD 10 ou fica cega por 1 minuto. A criatura cega pode repetir o teste em cada um dos seus turnos, encerrando o efeito em si mesma se passar.",
        "Estallido mortal",
        "Cuando el mefítico muere, estalla en una nube de polvo. Cada criatura a 5 ft o menos de él debe superar una tirada de salvación de Constitución CD 10 o queda cegada durante 1 minuto. La criatura cegada puede repetir la tirada en cada uno de sus turnos y termina el efecto sobre sí misma si la supera.",
      ],
      "innate-spellcasting-1day": [
        "Conjuração Inata (1/dia)",
        "O mefite pode conjurar *sono* de forma inata, sem precisar de componentes materiais. Sua habilidade de conjuração inata é Carisma.",
        "Lanzamiento de conjuros innato (1/día)",
        "El mefítico puede lanzar *dormir* de forma innata, sin necesidad de componentes materiales. Su aptitud mágica innata es Carisma.",
      ],
    },
    a: {
      "blinding-breath": [
        "Sopro Cegante",
        "O mefite exala um cone de 15 ft de poeira cegante. Cada criatura na área deve passar num teste de resistência de Destreza CD 10 ou fica cega por 1 minuto. A criatura pode repetir o teste ao fim de cada um dos seus turnos, encerrando o efeito em si mesma se passar.",
        "Aliento cegador",
        "El mefítico exhala un cono de 15 ft de polvo cegador. Cada criatura en esa área debe superar una tirada de salvación de Destreza CD 10 o queda cegada durante 1 minuto. La criatura puede repetir la tirada al final de cada uno de sus turnos y termina el efecto sobre sí misma si la supera.",
      ],
    },
  },
  eagle: { t: { "keen-sight": sight("A águia", "El águila") } },
  "earth-elemental": {
    lang: ["Terran", "Terrano"],
    res: NONMAGICAL,
    imm: POISON,
    vul: ["trovejante", "trueno"],
    t: {
      "earth-glide": [
        "Deslizar pela Terra",
        "O elemental pode escavar através de terra e pedra não mágicas e não trabalhadas. Fazendo isso, não perturba o material por onde passa.",
        "Deslizarse por la tierra",
        "El elemental puede excavar a través de tierra y piedra no mágicas y sin trabajar. Al hacerlo, no altera el material por el que se mueve.",
      ],
      "siege-monster": ["Monstro de Cerco", "O elemental causa o dobro de dano a objetos e estruturas.", "Monstruo de asedio", "El elemental inflige el doble de daño a objetos y estructuras."],
    },
    a: { multiattack: multi("O elemental faz dois ataques de pancada.", "El elemental hace dos ataques de golpe.") },
  },
  efreeti: {
    lang: ["Ignan", "Ígneo"],
    imm: ["fogo", "fuego"],
    t: {
      "elemental-demise": [
        "Fim Elemental",
        "Se o efreeti morrer, seu corpo se desfaz num clarão de fogo e numa nuvem de fumaça, deixando para trás só o equipamento que vestia ou carregava.",
        "Desaparición elemental",
        "Si el efreeti muere, su cuerpo se deshace en un destello de fuego y una nube de humo, y deja atrás solo el equipo que llevaba puesto o encima.",
      ],
      "innate-spellcasting": [
        "Conjuração Inata",
        "A habilidade de conjuração inata do efreeti é Carisma (CD de resistência de magia 15, +7 para acertar com ataques de magia). Ele pode conjurar as seguintes magias, sem precisar de componentes materiais:\n\nÀ vontade: detectar magia\n3/dia cada: aumentar/reduzir, idiomas\n1/dia cada: conjurar elemental (só elemental do fogo), forma gasosa, invisibilidade, imagem maior, viagem planar, muralha de fogo",
        "Lanzamiento de conjuros innato",
        "La aptitud mágica innata del efreeti es Carisma (CD de salvación de conjuros 15, +7 al ataque con conjuros). Puede lanzar los siguientes conjuros sin necesidad de componentes materiales:\n\nA voluntad: detectar magia\n3/día cada uno: agrandar/reducir, don de lenguas\n1/día cada uno: conjurar elemental (solo elemental de fuego), forma gaseosa, invisibilidad, imagen mayor, desplazamiento entre planos, muro de fuego",
      ],
    },
    a: { multiattack: multi("O efreeti faz dois ataques de cimitarra ou usa Arremessar Chama duas vezes.", "El efreeti hace dos ataques de cimitarra o usa Arrojar llama dos veces.") },
  },
  elephant: {
    t: {
      "trampling-charge": [
        "Investida Atropeladora",
        "Se o elefante se mover pelo menos 20 ft em linha reta até uma criatura e a acertar com um ataque de chifrada no mesmo turno, o alvo deve passar num teste de resistência de Força CD 12 ou cai. Se o alvo estiver caído, o elefante pode fazer um ataque de pisotear contra ele como ação bônus.",
        "Carga arrolladora",
        "Si el elefante se mueve al menos 20 ft en línea recta hacia una criatura y la impacta con un ataque de cornada en el mismo turno, el objetivo debe superar una tirada de salvación de Fuerza CD 12 o queda derribado. Si el objetivo está derribado, el elefante puede hacer un ataque de pisotón contra él como acción adicional.",
      ],
    },
  },
  elk: {
    t: {
      charge: [
        "Investida",
        "Se o alce se mover pelo menos 20 ft em linha reta até um alvo e o acertar com um ataque de investida no mesmo turno, o alvo sofre 7 (2d6) de dano extra. Se o alvo for uma criatura, deve passar num teste de resistência de Força CD 13 ou cai.",
        "Carga",
        "Si el alce se mueve al menos 20 ft en línea recta hacia un objetivo y lo impacta con un ataque de embestida en el mismo turno, el objetivo recibe 7 (2d6) de daño adicional. Si es una criatura, debe superar una tirada de salvación de Fuerza CD 13 o queda derribada.",
      ],
    },
  },
  erinyes: {
    lang: INFERNAL,
    res: coldSilver,
    imm: FIRE_POISON,
    t: {
      "hellish-weapons": [
        "Armas Infernais",
        "Os ataques com arma da erínia são mágicos e causam 13 (3d8) de dano de veneno extra ao acertar (já incluído nos ataques).",
        "Armas infernales",
        "Los ataques con arma de la erinia son mágicos e infligen 13 (3d8) de daño de veneno adicional al impactar (incluido en los ataques).",
      ],
      "magic-resistance": magicRes("A erínia", "La erinia"),
    },
    a: {
      multiattack: multi("A erínia faz três ataques.", "La erinia hace tres ataques."),
      "variant-rope-of-entanglement": [
        "Variante: Corda Enredante",
        "Algumas erínias carregam uma corda enredante (descrita no Guia do Mestre). Quando uma erínia assim usa Ataques Múltiplos, pode usar a corda no lugar de dois dos ataques.",
        "Variante: cuerda enredadora",
        "Algunas erinias llevan una cuerda enredadora (descrita en la Guía del Dungeon Master). Cuando una erinia así usa Ataque múltiple, puede usar la cuerda en lugar de dos de los ataques.",
      ],
      parry: [
        "Aparar",
        "A erínia soma 4 à CA contra um ataque corpo a corpo que a acertaria. Para isso, precisa ver o atacante e estar empunhando uma arma corpo a corpo.",
        "Parada",
        "La erinia suma 4 a su CA contra un ataque cuerpo a cuerpo que la impactaría. Para ello, debe ver al atacante y empuñar un arma cuerpo a cuerpo.",
      ],
    },
  },
  ettercap: {
    t: {
      "spider-climb": SPIDER_CLIMB("O ettercap", "El ettercap"),
      "web-sense": ["Sentir Teias", "Em contato com uma teia, o ettercap sabe a localização exata de qualquer outra criatura em contato com a mesma teia.", "Sentido arácnido", "Mientras está en contacto con una telaraña, el ettercap conoce la ubicación exacta de cualquier otra criatura en contacto con la misma telaraña."],
      "web-walker": WEB_WALKER("O ettercap", "El ettercap"),
    },
    a: { multiattack: multi("O ettercap faz dois ataques: um de mordida e um de garras.", "El ettercap hace dos ataques: uno de mordisco y otro de garras.") },
  },
  ettin: {
    lang: ["Gigante, Orc", "Gigante, orco"],
    t: {
      "two-heads": [
        "Duas Cabeças",
        "O ettin tem vantagem em testes de Sabedoria (Percepção) e em testes de resistência contra ficar cego, enfeitiçado, surdo, amedrontado, atordoado ou inconsciente.",
        "Dos cabezas",
        "El ettin tiene ventaja en las pruebas de Sabiduría (Percepción) y en las tiradas de salvación para no quedar cegado, hechizado, ensordecido, asustado, aturdido o inconsciente.",
      ],
      wakeful: ["Sempre Alerta", "Quando uma das cabeças do ettin está dormindo, a outra está acordada.", "Siempre alerta", "Cuando una de las cabezas del ettin está dormida, la otra está despierta."],
    },
    a: { multiattack: multi("O ettin faz dois ataques: um com o machado de batalha e um com a maça-estrela.", "El ettin hace dos ataques: uno con el hacha de batalla y otro con el lucero del alba.") },
  },
  "fire-elemental": {
    lang: ["Ignan", "Ígneo"],
    res: NONMAGICAL,
    imm: FIRE_POISON,
    t: {
      "fire-form": [
        "Forma de Fogo",
        "O elemental pode passar por um espaço de apenas 2,5 cm de largura sem se espremer. Uma criatura que o toque ou o acerte com um ataque corpo a corpo estando a até 5 ft dele sofre 5 (1d10) de dano de fogo. Além disso, o elemental pode entrar no espaço de uma criatura hostil e parar ali. Na primeira vez que entra no espaço de uma criatura num turno, ela sofre 5 (1d10) de dano de fogo e pega fogo; até alguém usar uma ação para apagar o fogo, a criatura sofre 5 (1d10) de dano de fogo no início de cada um dos seus turnos.",
        "Forma de fuego",
        "El elemental puede pasar por un espacio de solo 2,5 cm de ancho sin apretarse. Una criatura que lo toque o lo golpee con un ataque cuerpo a cuerpo estando a 5 ft o menos de él recibe 5 (1d10) de daño de fuego. Además, el elemental puede entrar en el espacio de una criatura hostil y detenerse allí. La primera vez que entra en el espacio de una criatura en un turno, esta recibe 5 (1d10) de daño de fuego y se prende; hasta que alguien use una acción para apagar el fuego, la criatura recibe 5 (1d10) de daño de fuego al principio de cada uno de sus turnos.",
      ],
      illumination: ["Iluminação", "O elemental emite luz plena num raio de 30 ft e penumbra por mais 30 ft.", "Iluminación", "El elemental emite luz brillante en un radio de 30 ft y luz tenue 30 ft más allá."],
      "water-susceptibility": [
        "Suscetível à Água",
        "A cada 5 ft que o elemental se move na água, ou a cada galão (cerca de 4 litros) de água jogado nele, sofre 1 de dano de frio.",
        "Susceptibilidad al agua",
        "Por cada 5 ft que el elemental se mueve en el agua, o por cada galón (unos 4 litros) de agua que le echen, recibe 1 de daño de frío.",
      ],
    },
    a: { multiattack: multi("O elemental faz dois ataques de toque.", "El elemental hace dos ataques de toque.") },
  },
  "fire-giant": { lang: ["Gigante", "Gigante"], imm: ["fogo", "fuego"], a: { multiattack: multi("O gigante faz dois ataques de espada grande.", "El gigante hace dos ataques de mandoble.") } },
  "flesh-golem": {
    lang: ["entende os idiomas do seu criador mas não fala", "entiende los idiomas de su creador pero no habla"],
    imm: ["elétrico, veneno; " + ADAMANTINE[0], "relámpago, veneno; " + ADAMANTINE[1]],
    t: {
      "aversion-of-fire": ["Aversão ao Fogo", "Se o golem sofrer dano de fogo, tem desvantagem nas jogadas de ataque e testes de habilidade até o fim do seu próximo turno.", "Aversión al fuego", "Si el gólem recibe daño de fuego, tiene desventaja en las tiradas de ataque y pruebas de característica hasta el final de su siguiente turno."],
      berserk: BERSERK(
        40,
        "\nO criador do golem, se estiver a até 60 ft dele em fúria, pode tentar acalmá-lo falando com firmeza e convicção. O golem precisa poder ouvir o criador, que deve usar uma ação para fazer um teste de Carisma (Persuasão) CD 15. Se passar, o golem sai da fúria. Se sofrer dano ainda com 40 pontos de vida ou menos, pode entrar em fúria de novo.",
        "\nEl creador del gólem, si está a 60 ft o menos del gólem enloquecido, puede intentar calmarlo hablándole con firmeza y convicción. El gólem debe poder oír a su creador, que debe usar una acción para hacer una prueba de Carisma (Persuasión) CD 15. Si la supera, el gólem deja de estar enloquecido. Si recibe daño mientras sigue con 40 puntos de golpe o menos, puede volver a enloquecer.",
      ),
      "immutable-form": ["Forma Imutável", "O golem é imune a qualquer magia ou efeito que alteraria sua forma.", "Forma inmutable", "El gólem es inmune a cualquier conjuro o efecto que fuera a alterar su forma."],
      "lightning-absorption": [
        "Absorção de Eletricidade",
        "Sempre que o golem sofreria dano elétrico, ele não sofre o dano e recupera pontos de vida iguais ao dano elétrico causado.",
        "Absorción de relámpagos",
        "Cada vez que el gólem fuera a recibir daño de relámpago, no recibe el daño y recupera tantos puntos de golpe como el daño de relámpago infligido.",
      ],
      "magic-resistance": magicRes("O golem", "El gólem"),
      "magic-weapons": magicWeapons("do golem", "del gólem"),
    },
    a: { multiattack: multi("O golem faz dois ataques de pancada.", "El gólem hace dos ataques de golpe.") },
  },
  "flying-snake": { t: { flyby: ["Voo Rasante", "A cobra não provoca ataques de oportunidade quando sai voando do alcance de um inimigo.", "Vuelo rasante", "La serpiente no provoca ataques de oportunidad cuando sale volando del alcance de un enemigo."] } },
  "flying-sword": {
    imm: ["veneno, psíquico", "veneno, psíquico"],
    t: {
      "antimagic-susceptibility": [
        "Suscetível à Antimagia",
        "A espada fica incapacitada enquanto estiver na área de um campo antimagia. Se for alvo de dissipar magia, deve passar num teste de resistência de Constituição contra a CD de resistência de magia do conjurador ou fica inconsciente por 1 minuto.",
        "Susceptibilidad a la antimagia",
        "La espada queda incapacitada mientras esté en el área de un campo antimagia. Si es objetivo de disipar magia, debe superar una tirada de salvación de Constitución contra la CD de salvación de conjuros del lanzador o queda inconsciente durante 1 minuto.",
      ],
      "false-appearance": ["Falsa Aparência", "Enquanto fica imóvel e sem voar, a espada é indistinguível de uma espada comum.", "Apariencia falsa", "Mientras permanece inmóvil y sin volar, la espada es indistinguible de una espada normal."],
    },
  },
  frog: {
    t: {
      amphibious: amphibious("O sapo", "La rana"),
      "standing-leap": ["Salto Parado", "O salto em distância do sapo é de até 10 ft e o salto em altura de até 5 ft, com ou sem corrida.", "Salto sin carrerilla", "El salto de longitud de la rana es de hasta 10 ft y el de altura de hasta 5 ft, con o sin carrerilla."],
    },
  },
  "frost-giant": { lang: ["Gigante", "Gigante"], imm: ["frio", "frío"], a: { multiattack: multi("O gigante faz dois ataques de machado grande.", "El gigante hace dos ataques de gran hacha.") } },
  gargoyle: {
    lang: ["Terran", "Terrano"],
    res: ADAMANTINE,
    imm: POISON,
    t: { "false-appearance": falseAppearance("a gárgula", "uma estátua inanimada", "la gárgola", "una estatua inanimada") },
    a: { multiattack: multi("A gárgula faz dois ataques: um de mordida e um de garras.", "La gárgola hace dos ataques: uno de mordisco y otro de garras.") },
  },
  "gelatinous-cube": {
    t: {
      "ooze-cube": [
        "Cubo de Limo",
        "O cubo ocupa todo o seu espaço. Outras criaturas podem entrar no espaço, mas quem fizer isso fica sujeito ao Engolfar do cubo, com desvantagem no teste de resistência.\nCriaturas dentro do cubo podem ser vistas, mas têm cobertura total.\nUma criatura a até 5 ft do cubo pode usar uma ação para puxar uma criatura ou objeto para fora dele. Isso exige passar num teste de Força CD 12, e quem tenta sofre 10 (3d6) de dano de ácido.\nO cubo comporta só uma criatura Grande ou até quatro Médias ou menores ao mesmo tempo.",
        "Cubo de cieno",
        "El cubo ocupa todo su espacio. Otras criaturas pueden entrar en él, pero la que lo haga queda expuesta a Envolver del cubo, con desventaja en la tirada de salvación.\nLas criaturas dentro del cubo pueden verse, pero tienen cobertura total.\nUna criatura a 5 ft o menos del cubo puede usar una acción para sacar a una criatura u objeto del cubo. Para ello debe superar una prueba de Fuerza CD 12, y quien lo intente recibe 10 (3d6) de daño de ácido.\nEl cubo puede contener solo una criatura Grande o hasta cuatro Medianas o más pequeñas a la vez.",
      ],
      transparent: [
        "Transparente",
        "Mesmo à vista, é preciso passar num teste de Sabedoria (Percepção) CD 15 para notar um cubo que não se moveu nem atacou. Uma criatura que tente entrar no espaço do cubo sem saber que ele está ali é surpreendida pelo cubo.",
        "Transparente",
        "Aunque esté a la vista, hace falta superar una prueba de Sabiduría (Percepción) CD 15 para ver un cubo que no se ha movido ni atacado. Una criatura que intente entrar en el espacio del cubo sin saber que está ahí queda sorprendida por él.",
      ],
    },
    a: {
      engulf: [
        "Engolfar",
        "O cubo se move até o seu deslocamento. Fazendo isso, pode entrar no espaço de criaturas Grandes ou menores. Sempre que entra no espaço de uma criatura, ela deve fazer um teste de resistência de Destreza CD 12.\nSe passar, a criatura pode escolher ser empurrada 5 ft para trás ou para o lado do cubo. Se escolher não ser empurrada, sofre as consequências de ter falhado.\nSe falhar, o cubo entra no espaço da criatura, que sofre 10 (3d6) de dano de ácido e é engolfada. A criatura engolfada não pode respirar, fica impedida e sofre 21 (6d6) de dano de ácido no início de cada turno do cubo. Quando o cubo se move, a criatura engolfada se move junto.\nUma criatura engolfada pode tentar escapar usando uma ação para fazer um teste de Força CD 12. Se passar, escapa e vai para um espaço à sua escolha a até 5 ft do cubo.",
        "Envolver",
        "El cubo se mueve hasta su velocidad. Al hacerlo, puede entrar en el espacio de criaturas Grandes o más pequeñas. Cada vez que entra en el espacio de una criatura, esta debe hacer una tirada de salvación de Destreza CD 12.\nSi la supera, la criatura puede elegir ser empujada 5 ft hacia atrás o hacia un lado del cubo. Si elige no ser empujada, sufre las consecuencias de haber fallado.\nSi falla, el cubo entra en el espacio de la criatura, que recibe 10 (3d6) de daño de ácido y queda envuelta. La criatura envuelta no puede respirar, está apresada y recibe 21 (6d6) de daño de ácido al principio de cada turno del cubo. Cuando el cubo se mueve, la criatura envuelta se mueve con él.\nUna criatura envuelta puede intentar escapar usando una acción para hacer una prueba de Fuerza CD 12. Si la supera, escapa y va a un espacio de su elección a 5 ft o menos del cubo.",
      ],
    },
  },
  ghast: {
    lang: ["Comum", "Común"],
    res: ["necrótico", "necrótico"],
    imm: POISON,
    t: {
      stench: [
        "Fedor",
        "Qualquer criatura que comece o turno a até 5 ft do lívido deve passar num teste de resistência de Constituição CD 10 ou fica envenenada até o início do seu próximo turno. Se passar, fica imune ao Fedor do lívido por 24 horas.",
        "Hedor",
        "Cualquier criatura que empiece su turno a 5 ft o menos del ghast debe superar una tirada de salvación de Constitución CD 10 o queda envenenada hasta el principio de su siguiente turno. Si la supera, es inmune al Hedor del ghast durante 24 horas.",
      ],
      "turn-defiance": [
        "Desafiar Expulsão",
        "O lívido e os carniçais a até 30 ft dele têm vantagem em testes de resistência contra efeitos que expulsam mortos-vivos.",
        "Resistencia a expulsión",
        "El ghast y los necrófagos a 30 ft o menos de él tienen ventaja en las tiradas de salvación contra efectos que expulsan muertos vivientes.",
      ],
    },
  },
  ghost: {
    lang: ["os idiomas que conhecia em vida", "los idiomas que conocía en vida"],
    res: ["ácido, fogo, elétrico, trovejante; " + NONMAGICAL[0], "ácido, fuego, relámpago, trueno; " + NONMAGICAL[1]],
    imm: ["frio, necrótico, veneno", "frío, necrótico, veneno"],
    t: {
      "ethereal-sight": ["Visão Etérea", "O fantasma pode ver 60 ft dentro do Plano Etéreo quando está no Plano Material, e vice-versa.", "Vista etérea", "El fantasma puede ver 60 ft en el Plano Etéreo cuando está en el Plano Material, y viceversa."],
      "incorporeal-movement": [
        "Movimento Incorpóreo",
        "O fantasma pode atravessar outras criaturas e objetos como se fossem terreno difícil. Sofre 5 (1d10) de dano de energia se terminar o turno dentro de um objeto.",
        "Movimiento incorpóreo",
        "El fantasma puede atravesar otras criaturas y objetos como si fueran terreno difícil. Recibe 5 (1d10) de daño de fuerza si termina su turno dentro de un objeto.",
      ],
    },
    a: {
      etherealness: [
        "Forma Etérea",
        "O fantasma passa do Plano Material para o Plano Etéreo, ou vice-versa. Ele fica visível no Plano Material enquanto está na Fronteira Etérea, e vice-versa, mas não pode afetar nem ser afetado por nada do outro plano.",
        "Forma etérea",
        "El fantasma pasa del Plano Material al Plano Etéreo, o viceversa. Es visible en el Plano Material mientras está en la Frontera Etérea, y viceversa, pero no puede afectar ni ser afectado por nada del otro plano.",
      ],
      "horrifying-visage": [
        "Visão Aterrorizante",
        "Cada criatura que não seja morta-viva a até 60 ft do fantasma e que possa vê-lo deve passar num teste de resistência de Sabedoria CD 13 ou fica amedrontada por 1 minuto. Se falhar por 5 ou mais, o alvo também envelhece 1d4 × 10 anos. O alvo amedrontado pode repetir o teste ao fim de cada um dos seus turnos, encerrando a condição em si mesmo se passar. Se passar no teste ou o efeito acabar para ele, fica imune à Visão Aterrorizante deste fantasma pelas próximas 24 horas. O envelhecimento pode ser revertido com a magia restauração maior, mas só nas 24 horas seguintes.",
        "Rostro aterrador",
        "Cada criatura que no sea un muerto viviente a 60 ft o menos del fantasma y que pueda verlo debe superar una tirada de salvación de Sabiduría CD 13 o queda asustada durante 1 minuto. Si falla por 5 o más, el objetivo también envejece 1d4 × 10 años. El objetivo asustado puede repetir la tirada al final de cada uno de sus turnos y termina el estado sobre sí mismo si la supera. Si la supera o el efecto termina para él, es inmune al Rostro aterrador de este fantasma durante las siguientes 24 horas. El envejecimiento se puede revertir con el conjuro restablecimiento mayor, pero solo en las 24 horas siguientes.",
      ],
      possession: [
        "Possessão",
        "Um humanoide que o fantasma possa ver a até 5 ft deve passar num teste de resistência de Carisma CD 13 ou é possuído pelo fantasma; o fantasma então some, e o alvo fica incapacitado e perde o controle do corpo. O fantasma passa a controlar o corpo, mas o alvo continua consciente. O fantasma não pode ser alvo de nenhum ataque, magia ou outro efeito, exceto os que expulsam mortos-vivos, e mantém sua tendência, Inteligência, Sabedoria, Carisma e a imunidade a ficar enfeitiçado e amedrontado. No resto, usa as estatísticas do alvo possuído, mas não ganha acesso aos conhecimentos, características de classe nem proficiências dele.\nA possessão dura até o corpo chegar a 0 pontos de vida, o fantasma encerrá-la como ação bônus, ou o fantasma ser expulso ou forçado a sair por um efeito como a magia dissipar o bem e o mal. Quando a possessão acaba, o fantasma reaparece num espaço desocupado a até 5 ft do corpo. O alvo fica imune à Possessão deste fantasma por 24 horas depois de passar no teste ou depois que a possessão acabar.",
        "Posesión",
        "Un humanoide que el fantasma pueda ver a 5 ft o menos debe superar una tirada de salvación de Carisma CD 13 o queda poseído por el fantasma; el fantasma desaparece, y el objetivo queda incapacitado y pierde el control de su cuerpo. El fantasma controla ahora el cuerpo, pero el objetivo sigue consciente. El fantasma no puede ser objetivo de ningún ataque, conjuro u otro efecto, salvo los que expulsan muertos vivientes, y conserva su alineamiento, Inteligencia, Sabiduría, Carisma y la inmunidad a quedar hechizado y asustado. Por lo demás, usa las estadísticas del objetivo poseído, pero no obtiene sus conocimientos, rasgos de clase ni competencias.\nLa posesión dura hasta que el cuerpo llega a 0 puntos de golpe, el fantasma la termina como acción adicional, o el fantasma es expulsado o forzado a salir por un efecto como el conjuro disipar el bien y el mal. Cuando la posesión termina, el fantasma reaparece en un espacio desocupado a 5 ft o menos del cuerpo. El objetivo es inmune a la Posesión de este fantasma durante 24 horas después de superar la tirada o de que termine la posesión.",
      ],
    },
  },
  ghoul: { lang: ["Comum", "Común"], imm: POISON },
  "giant-ape": { a: { multiattack: multi("O macaco faz dois ataques de punho.", "El simio hace dos ataques de puño.") } },
  "giant-badger": { t: { "keen-smell": smell("O texugo", "El tejón") }, a: { multiattack: multi("O texugo faz dois ataques: um de mordida e um de garras.", "El tejón hace dos ataques: uno de mordisco y otro de garras.") } },
  "giant-bat": { t: { echolocation: ECHO("O morcego", "El murciélago"), "keen-hearing": HEARING("O morcego", "El murciélago") } },
};
