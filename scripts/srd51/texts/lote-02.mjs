// Lote 2 das habilidades (Passo 12, fase C): Urso Pardo a Cavalo de Tração. Formato em scripts/srd51/details.mjs.
import { ADAMANTINE, ALL_TELEPATHY, amphibious, ANY_ONE, coldSilver, devilSight, falseAppearance, FIRE_POISON, hearingSmell, INFERNAL, magicRes, magicWeapons, multi, NONMAGICAL, pack, POISON, smell } from "./_comum.mjs";

const CHANGE_SHAPE = (pt, es, extraPt, extraEs) => [
  "Mudar de Forma",
  `${pt} se metamorfoseia magicamente num humanoide ou fera com nível de desafio igual ou menor que o seu, ou volta à forma verdadeira. Volta à forma verdadeira se morrer. O equipamento que veste ou carrega é absorvido ou levado pela nova forma (à sua escolha).\nNa nova forma, mantém suas estatísticas de jogo e a capacidade de falar, mas a CA, os modos de deslocamento, Força, Destreza e ${extraPt} são substituídos pelos da nova forma, e ganha as estatísticas e capacidades (exceto características de classe, ações lendárias e ações de covil) que a nova forma tem e que lhe faltam.`,
  "Cambiar de forma",
  `${es} se polimorfa mágicamente en un humanoide o bestia con un valor de desafío igual o inferior al suyo, o vuelve a su forma verdadera. Vuelve a su forma verdadera si muere. El equipo que lleve puesto o encima es absorbido o portado por la nueva forma (a su elección).\nEn la nueva forma conserva sus estadísticas de juego y la capacidad de hablar, pero su CA, sus modos de movimiento, Fuerza, Destreza y ${extraEs} se sustituyen por los de la nueva forma, y obtiene las estadísticas y capacidades (salvo rasgos de clase, acciones legendarias y acciones de guarida) que la nueva forma tenga y a él le falten.`,
];

export default {
  "brown-bear": { t: { "keen-smell": smell("O urso", "El oso") }, a: { multiattack: multi("O urso faz dois ataques: um de mordida e um de garras.", "El oso hace dos ataques: uno de mordisco y otro de garras.") } },
  bugbear: {
    lang: ["Comum, Goblin", "Común, goblin"],
    t: {
      brute: ["Bruto", "Uma arma corpo a corpo causa um dado extra do seu dano quando o bugbear acerta com ela (já incluído no ataque).", "Bruto", "Un arma cuerpo a cuerpo inflige un dado adicional de su daño cuando el osgo impacta con ella (incluido en el ataque)."],
      "surprise-attack": [
        "Ataque Surpresa",
        "Se o bugbear surpreender uma criatura e a acertar com um ataque na primeira rodada de combate, o alvo sofre 7 (2d6) de dano extra desse ataque.",
        "Ataque sorpresa",
        "Si el osgo sorprende a una criatura y la impacta con un ataque durante el primer asalto del combate, el objetivo recibe 7 (2d6) de daño adicional de ese ataque.",
      ],
    },
  },
  bulette: {
    t: {
      "standing-leap": ["Salto Parado", "O salto em distância do bulette é de até 30 ft e o salto em altura de até 15 ft, com ou sem corrida.", "Salto sin carrerilla", "El salto de longitud del bulette es de hasta 30 ft y el de altura de hasta 15 ft, con o sin carrerilla."],
    },
    a: {
      "deadly-leap": [
        "Salto Mortal",
        "Se o bulette saltar pelo menos 15 ft como parte do seu deslocamento, pode usar esta ação para cair de pé num espaço com uma ou mais criaturas. Cada uma delas deve passar num teste de resistência de Força ou Destreza CD 16 (à escolha do alvo) ou cai e sofre 14 (3d6 + 4) de dano de concussão mais 14 (3d6 + 4) de dano cortante. Se passar, sofre só metade do dano, não cai e é empurrada 5 ft para fora do espaço do bulette, para um espaço desocupado à sua escolha. Se não houver espaço desocupado ao alcance, a criatura cai no espaço do bulette.",
        "Salto mortal",
        "Si el bulette salta al menos 15 ft como parte de su movimiento, puede usar esta acción para caer de pie en un espacio con una o más criaturas. Cada una debe superar una tirada de salvación de Fuerza o Destreza CD 16 (a elección del objetivo) o queda derribada y recibe 14 (3d6 + 4) de daño contundente más 14 (3d6 + 4) de daño cortante. Si la supera, recibe solo la mitad del daño, no queda derribada y es empujada 5 ft fuera del espacio del bulette, a un espacio desocupado de su elección. Si no hay ningún espacio desocupado al alcance, la criatura cae derribada en el espacio del bulette.",
      ],
    },
  },
  camel: {},
  cat: { t: { "keen-smell": smell("O gato", "El gato") } },
  centaur: {
    lang: ["Élfico, Silvestre", "Élfico, silvano"],
    t: {
      charge: [
        "Investida",
        "Se o centauro se mover pelo menos 30 ft em linha reta até um alvo e o acertar com um ataque de pique no mesmo turno, o alvo sofre 10 (3d6) de dano perfurante extra.",
        "Carga",
        "Si el centauro se mueve al menos 30 ft en línea recta hacia un objetivo y lo impacta con un ataque de pica en el mismo turno, el objetivo recibe 10 (3d6) de daño perforante adicional.",
      ],
    },
    a: { multiattack: multi("O centauro faz dois ataques: um com o pique e um com os cascos, ou dois com o arco longo.", "El centauro hace dos ataques: uno con la pica y otro con los cascos, o dos con el arco largo.") },
  },
  "chain-devil": {
    lang: INFERNAL,
    res: coldSilver,
    imm: FIRE_POISON,
    t: { "devils-sight": devilSight, "magic-resistance": magicRes("O diabo", "El diablo") },
    a: {
      multiattack: multi("O diabo faz dois ataques com as correntes.", "El diablo hace dos ataques con las cadenas."),
      "animate-chains": [
        "Animar Correntes",
        "Até quatro correntes que o diabo possa ver a até 60 ft dele ganham magicamente farpas afiadas e se animam sob o controle do diabo, desde que ninguém as esteja vestindo ou carregando.\nCada corrente animada é um objeto com CA 20, 20 pontos de vida, resistência a dano perfurante e imunidade a dano psíquico e trovejante. Quando o diabo usa Ataques Múltiplos no seu turno, pode usar cada corrente animada para fazer um ataque de corrente adicional. Uma corrente animada pode agarrar uma criatura, mas não ataca enquanto agarra. Ela volta a ficar inanimada se chegar a 0 pontos de vida ou se o diabo ficar incapacitado ou morrer.",
        "Animar cadenas",
        "Hasta cuatro cadenas que el diablo pueda ver a 60 ft o menos de él se llenan mágicamente de púas afiladas y se animan bajo su control, siempre que nadie las lleve puestas o encima.\nCada cadena animada es un objeto con CA 20, 20 puntos de golpe, resistencia al daño perforante e inmunidad al daño psíquico y de trueno. Cuando el diablo usa Ataque múltiple en su turno, puede usar cada cadena animada para hacer un ataque de cadena adicional. Una cadena animada puede agarrar a una criatura, pero no puede atacar mientras agarra. Vuelve a quedar inanimada si se reduce a 0 puntos de golpe o si el diablo queda incapacitado o muere.",
      ],
      "unnerving-mask": [
        "Máscara Perturbadora",
        "Quando uma criatura que o diabo possa ver começa o turno a até 30 ft dele, o diabo pode criar a ilusão de que se parece com um ente querido falecido ou um inimigo mortal dessa criatura. Se a criatura puder ver o diabo, deve passar num teste de resistência de Sabedoria CD 14 ou fica amedrontada até o fim do seu turno.",
        "Máscara inquietante",
        "Cuando una criatura que el diablo pueda ver empieza su turno a 30 ft o menos de él, el diablo puede crear la ilusión de que se parece a un ser querido fallecido o a un enemigo acérrimo de esa criatura. Si la criatura puede ver al diablo, debe superar una tirada de salvación de Sabiduría CD 14 o queda asustada hasta el final de su turno.",
      ],
    },
  },
  chimera: {
    lang: ["entende Dracônico mas não fala", "entiende dracónico pero no lo habla"],
    a: {
      multiattack: multi(
        "A quimera faz três ataques: um de mordida, um de chifres e um de garras. Quando o sopro de fogo estiver disponível, pode usá-lo no lugar da mordida ou dos chifres.",
        "La quimera hace tres ataques: uno de mordisco, otro de cuernos y otro de garras. Cuando su aliento de fuego esté disponible, puede usarlo en lugar del mordisco o de los cuernos.",
      ),
      "fire-breath": [
        "Sopro de Fogo",
        "A cabeça de dragão exala fogo num cone de 15 ft. Cada criatura na área deve fazer um teste de resistência de Destreza CD 15; sofre 31 (7d8) de dano de fogo se falhar, ou metade se passar.",
        "Aliento de fuego",
        "La cabeza de dragón exhala fuego en un cono de 15 ft. Cada criatura en esa área debe hacer una tirada de salvación de Destreza CD 15; recibe 31 (7d8) de daño de fuego si falla, o la mitad si la supera.",
      ],
    },
  },
  chuul: {
    lang: ["entende Dialeto das Profundezas mas não fala", "entiende habla profunda pero no la habla"],
    imm: POISON,
    t: {
      amphibious: amphibious("O chuul", "El chuul"),
      "sense-magic": [
        "Sentir Magia",
        "O chuul percebe magia a até 120 ft à vontade. No resto, este traço funciona como a magia detectar magia, mas não é mágico.",
        "Percibir magia",
        "El chuul percibe la magia a 120 ft o menos a voluntad. Por lo demás, este rasgo funciona como el conjuro detectar magia, pero no es mágico.",
      ],
    },
    a: {
      multiattack: multi("O chuul faz dois ataques de pinça. Se estiver agarrando uma criatura, também pode usar os tentáculos uma vez.", "El chuul hace dos ataques de pinza. Si está agarrando a una criatura, también puede usar los tentáculos una vez."),
      tentacles: [
        "Tentáculos",
        "Uma criatura agarrada pelo chuul deve passar num teste de resistência de Constituição CD 13 ou fica envenenada por 1 minuto. Enquanto o veneno durar, o alvo fica paralisado. Ele pode repetir o teste ao fim de cada um dos seus turnos, encerrando o efeito em si mesmo se passar.",
        "Tentáculos",
        "Una criatura agarrada por el chuul debe superar una tirada de salvación de Constitución CD 13 o queda envenenada durante 1 minuto. Mientras dure el veneno, el objetivo está paralizado. Puede repetir la tirada al final de cada uno de sus turnos y termina el efecto sobre sí mismo si la supera.",
      ],
    },
  },
  "clay-golem": {
    lang: ["entende os idiomas do seu criador mas não fala", "entiende los idiomas de su creador pero no habla"],
    imm: ["ácido, veneno, psíquico; " + ADAMANTINE[0], "ácido, veneno, psíquico; " + ADAMANTINE[1]],
    t: {
      "acid-absorption": [
        "Absorção de Ácido",
        "Sempre que o golem sofreria dano de ácido, ele não sofre o dano e recupera pontos de vida iguais ao dano de ácido causado.",
        "Absorción de ácido",
        "Cada vez que el golem fuera a recibir daño de ácido, no recibe el daño y recupera tantos puntos de golpe como el daño de ácido infligido.",
      ],
      berserk: [
        "Fúria Desenfreada",
        "Sempre que o golem começar o turno com 60 pontos de vida ou menos, role um d6. Num 6, o golem entra em fúria. Em cada um dos seus turnos em fúria, ataca a criatura mais próxima que possa ver. Se nenhuma estiver perto o bastante para se mover até ela e atacar, ataca um objeto, de preferência menor que ele. Depois que entra em fúria, continua assim até ser destruído ou recuperar todos os pontos de vida.",
        "Enloquecido",
        "Cada vez que el gólem empiece su turno con 60 puntos de golpe o menos, tira un d6. Con un 6, el gólem enloquece. En cada uno de sus turnos mientras está enloquecido, ataca a la criatura más cercana que pueda ver. Si ninguna está lo bastante cerca para moverse hasta ella y atacarla, ataca un objeto, preferiblemente más pequeño que él. Una vez enloquece, sigue así hasta ser destruido o recuperar todos sus puntos de golpe.",
      ],
      "immutable-form": ["Forma Imutável", "O golem é imune a qualquer magia ou efeito que alteraria sua forma.", "Forma inmutable", "El gólem es inmune a cualquier conjuro o efecto que fuera a alterar su forma."],
      "magic-resistance": magicRes("O golem", "El gólem"),
      "magic-weapons": magicWeapons("do golem", "del gólem"),
    },
    a: {
      multiattack: multi("O golem faz dois ataques de pancada.", "El gólem hace dos ataques de golpe."),
      haste: [
        "Velocidade",
        "Até o fim do seu próximo turno, o golem ganha magicamente +2 na CA, tem vantagem em testes de resistência de Destreza e pode usar o ataque de pancada como ação bônus.",
        "Celeridad",
        "Hasta el final de su siguiente turno, el gólem obtiene mágicamente un +2 a la CA, tiene ventaja en las tiradas de salvación de Destreza y puede usar su ataque de golpe como acción adicional.",
      ],
    },
  },
  cloaker: {
    lang: ["Dialeto das Profundezas, Dialeto Subterrâneo", "Habla profunda, infracomún"],
    t: {
      "damage-transfer": [
        "Transferência de Dano",
        "Enquanto estiver preso a uma criatura, a capa assassina sofre só metade do dano que recebe (arredondado para baixo), e essa criatura sofre a outra metade.",
        "Transferencia de daño",
        "Mientras está adherido a una criatura, el acechador embozado recibe solo la mitad del daño que le infligen (redondeando hacia abajo), y esa criatura recibe la otra mitad.",
      ],
      "false-appearance": [
        "Falsa Aparência",
        "Enquanto fica imóvel e sem mostrar a parte de baixo, a capa assassina é indistinguível de uma capa de couro escuro.",
        "Apariencia falsa",
        "Mientras permanece inmóvil y sin mostrar su parte inferior, el acechador embozado es indistinguible de una capa de cuero oscuro.",
      ],
      "light-sensitivity": [
        "Sensibilidade à Luz",
        "Sob luz plena, a capa assassina tem desvantagem nas jogadas de ataque e nos testes de Sabedoria (Percepção) que dependam da visão.",
        "Sensibilidad a la luz",
        "Bajo luz brillante, el acechador embozado tiene desventaja en las tiradas de ataque y en las pruebas de Sabiduría (Percepción) que dependan de la vista.",
      ],
    },
    a: {
      multiattack: multi("A capa assassina faz dois ataques: um de mordida e um de cauda.", "El acechador embozado hace dos ataques: uno de mordisco y otro de cola."),
      moan: [
        "Gemido",
        "Cada criatura a até 60 ft da capa assassina que possa ouvir o gemido e que não seja uma aberração deve passar num teste de resistência de Sabedoria CD 13 ou fica amedrontada até o fim do próximo turno da capa. Se passar, fica imune ao gemido da capa assassina pelas próximas 24 horas.",
        "Gemido",
        "Cada criatura a 60 ft o menos del acechador embozado que pueda oír su gemido y que no sea una aberración debe superar una tirada de salvación de Sabiduría CD 13 o queda asustada hasta el final del siguiente turno del acechador. Si la supera, es inmune al gemido del acechador embozado durante las siguientes 24 horas.",
      ],
      phantasms: [
        "Fantasmas",
        "A capa assassina cria magicamente três cópias ilusórias de si mesma, se não estiver sob luz plena. As cópias se movem com ela e imitam suas ações, trocando de posição para que seja impossível saber qual é a verdadeira. Se a capa entrar numa área de luz plena, as cópias somem.\nSempre que uma criatura tenta atingir a capa com um ataque ou magia nociva enquanto restar alguma cópia, ela rola aleatoriamente para saber se mira a capa ou uma das cópias. Uma criatura que não enxerga ou que depende de outros sentidos que não a visão não é afetada por este efeito mágico.\nCada cópia tem a CA da capa e usa os testes de resistência dela. Se um ataque acertar uma cópia, ou se uma cópia falhar num teste de resistência contra um efeito que cause dano, ela some.",
        "Fantasmas",
        "El acechador embozado crea mágicamente tres duplicados ilusorios de sí mismo, si no está bajo luz brillante. Los duplicados se mueven con él e imitan sus acciones, cambiando de posición para que sea imposible saber cuál es el verdadero. Si el acechador entra en un área de luz brillante, los duplicados desaparecen.\nCada vez que una criatura elige como objetivo al acechador con un ataque o un conjuro dañino mientras quede algún duplicado, tira al azar para ver si apunta al acechador o a uno de los duplicados. Una criatura que no puede ver o que depende de sentidos distintos de la vista no se ve afectada por este efecto mágico.\nCada duplicado tiene la CA del acechador y usa sus tiradas de salvación. Si un ataque impacta a un duplicado, o si un duplicado falla una tirada de salvación contra un efecto que inflige daño, desaparece.",
      ],
    },
  },
  "cloud-giant": {
    lang: ["Comum, Gigante", "Común, gigante"],
    t: {
      "innate-spellcasting": [
        "Conjuração Inata",
        "A habilidade de conjuração inata do gigante é Carisma. Ele pode conjurar as seguintes magias, sem precisar de componentes materiais:\n\nÀ vontade: detectar magia, névoa obscurecente, luz\n3/dia cada: queda suave, voo, passo nebuloso, telecinésia\n1/dia cada: controlar o clima, forma gasosa",
        "Lanzamiento de conjuros innato",
        "La aptitud mágica innata del gigante es Carisma. Puede lanzar los siguientes conjuros sin necesidad de componentes materiales:\n\nA voluntad: detectar magia, nube de niebla, luz\n3/día cada uno: caída de pluma, volar, paso brumoso, telequinesis\n1/día cada uno: controlar el clima, forma gaseosa",
      ],
      "keen-smell": smell("O gigante", "El gigante"),
    },
    a: { multiattack: multi("O gigante faz dois ataques de maça-estrela.", "El gigante hace dos ataques de lucero del alba.") },
  },
  cockatrice: {},
  commoner: { lang: ANY_ONE },
  "constrictor-snake": {},
  couatl: {
    lang: ALL_TELEPATHY,
    res: ["radiante", "radiante"],
    imm: ["psíquico; " + NONMAGICAL[0], "psíquico; " + NONMAGICAL[1]],
    t: {
      "innate-spellcasting": [
        "Conjuração Inata",
        "A habilidade de conjuração do couatl é Carisma (CD de resistência de magia 14). Ele pode conjurar as seguintes magias de forma inata, precisando só de componentes verbais:\n\nÀ vontade: detectar o bem e o mal, detectar magia, detectar pensamentos\n3/dia cada: bênção, criar alimentos e água, curar ferimentos, restauração menor, proteção contra veneno, santuário, escudo arcano\n1/dia cada: sonho, restauração maior, vidência",
        "Lanzamiento de conjuros innato",
        "La aptitud mágica del couatl es Carisma (CD de salvación de conjuros 14). Puede lanzar de forma innata los siguientes conjuros, necesitando solo componentes verbales:\n\nA voluntad: detectar el bien y el mal, detectar magia, detectar pensamientos\n3/día cada uno: bendición, crear comida y agua, curar heridas, restablecimiento menor, protección contra el veneno, santuario, escudo\n1/día cada uno: sueño, restablecimiento mayor, escudriñar",
      ],
      "magic-weapons": magicWeapons("do couatl", "del couatl"),
      "shielded-mind": [
        "Mente Protegida",
        "O couatl é imune a vidência e a qualquer efeito que perceba suas emoções, leia seus pensamentos ou detecte sua localização.",
        "Mente protegida",
        "El couatl es inmune a escudriñar y a cualquier efecto que perciba sus emociones, lea sus pensamientos o detecte su ubicación.",
      ],
    },
    a: { "change-shape": CHANGE_SHAPE("O couatl", "El couatl", "as outras ações", "sus demás acciones") },
  },
  crab: { t: { amphibious: amphibious("O caranguejo", "El cangrejo") } },
  crocodile: { t: { "hold-breath": ["Prender a Respiração", "O crocodilo pode prender a respiração por 15 minutos.", "Contener la respiración", "El cocodrilo puede contener la respiración durante 15 minutos."] } },
  "cult-fanatic": {
    lang: ANY_ONE,
    t: {
      "dark-devotion": ["Devoção Sombria", "O fanático tem vantagem em testes de resistência contra ficar enfeitiçado ou amedrontado.", "Devoción oscura", "El fanático tiene ventaja en las tiradas de salvación para no quedar hechizado ni asustado."],
      spellcasting: [
        "Conjuração",
        "O fanático é um conjurador de 4º nível. Sua habilidade de conjuração é Sabedoria (CD de resistência de magia 11, +3 para acertar com ataques de magia). O fanático tem as seguintes magias de clérigo preparadas:\n\n* Truques (à vontade): luz, chama sagrada, taumaturgia\n* 1º nível (4 espaços): comando, infligir ferimentos, escudo da fé\n* 2º nível (3 espaços): imobilizar pessoa, arma espiritual",
        "Lanzamiento de conjuros",
        "El fanático es un lanzador de conjuros de nivel 4. Su aptitud mágica es Sabiduría (CD de salvación de conjuros 11, +3 al ataque con conjuros). El fanático tiene preparados los siguientes conjuros de clérigo:\n\n* Trucos (a voluntad): luz, llama sagrada, taumaturgia\n* Nivel 1 (4 espacios): orden imperiosa, infligir heridas, escudo de fe\n* Nivel 2 (3 espacios): inmovilizar persona, arma espiritual",
      ],
    },
    a: { multiattack: multi("O fanático faz dois ataques corpo a corpo.", "El fanático hace dos ataques cuerpo a cuerpo.") },
  },
  cultist: {
    lang: ANY_ONE,
    t: { "dark-devotion": ["Devoção Sombria", "O cultista tem vantagem em testes de resistência contra ficar enfeitiçado ou amedrontado.", "Devoción oscura", "El sectario tiene ventaja en las tiradas de salvación para no quedar hechizado ni asustado."] },
  },
  darkmantle: {
    t: {
      echolocation: ["Ecolocalização", "O manto sombrio não pode usar a percepção às cegas enquanto estiver surdo.", "Ecolocalización", "El manto oscuro no puede usar su vista ciega mientras esté ensordecido."],
      "false-appearance": falseAppearance("o manto sombrio", "uma formação de caverna, como uma estalactite ou estalagmite", "el manto oscuro", "una formación de cueva, como una estalactita o una estalagmita"),
    },
    a: {
      "darkness-aura": [
        "Aura de Escuridão",
        "Uma escuridão mágica de 15 ft de raio se espalha a partir do manto sombrio, se move com ele e contorna esquinas. Ela dura enquanto o manto mantiver a concentração, até 10 minutos (como se concentrasse numa magia). A visão no escuro não atravessa essa escuridão, e nenhuma luz natural a ilumina. Se parte da escuridão se sobrepuser a uma área de luz criada por uma magia de 2º nível ou menor, a magia que cria a luz é dissipada.",
        "Aura de oscuridad",
        "Una oscuridad mágica de 15 ft de radio se extiende desde el manto oscuro, se mueve con él y dobla las esquinas. Dura mientras el manto mantenga la concentración, hasta 10 minutos (como si se concentrara en un conjuro). La visión en la oscuridad no atraviesa esta oscuridad, y ninguna luz natural la ilumina. Si parte de la oscuridad se solapa con un área de luz creada por un conjuro de nivel 2 o inferior, el conjuro que crea la luz se disipa.",
      ],
    },
  },
  "death-dog": {
    t: {
      "two-headed": [
        "Duas Cabeças",
        "O cão tem vantagem em testes de Sabedoria (Percepção) e em testes de resistência contra ficar cego, enfeitiçado, surdo, amedrontado, atordoado ou inconsciente.",
        "Dos cabezas",
        "El perro tiene ventaja en las pruebas de Sabiduría (Percepción) y en las tiradas de salvación para no quedar cegado, hechizado, ensordecido, asustado, aturdido o inconsciente.",
      ],
    },
    a: { multiattack: multi("O cão faz dois ataques de mordida.", "El perro hace dos ataques de mordisco.") },
  },
  "deep-gnome-svirfneblin": {
    lang: ["Gnômico, Terran, Dialeto Subterrâneo", "Gnómico, terrano, infracomún"],
    t: {
      "gnome-cunning": ["Astúcia Gnômica", "O gnomo tem vantagem em testes de resistência de Inteligência, Sabedoria e Carisma contra magia.", "Astucia gnómica", "El gnomo tiene ventaja en las tiradas de salvación de Inteligencia, Sabiduría y Carisma contra la magia."],
      "innate-spellcasting": [
        "Conjuração Inata",
        "A habilidade de conjuração inata do gnomo é Inteligência (CD de resistência de magia 11). Ele pode conjurar as seguintes magias, sem precisar de componentes materiais:\nÀ vontade: indetectável (só em si mesmo)\n1/dia cada: cegueira/surdez, nublar, disfarçar-se",
        "Lanzamiento de conjuros innato",
        "La aptitud mágica innata del gnomo es Inteligencia (CD de salvación de conjuros 11). Puede lanzar los siguientes conjuros sin necesidad de componentes materiales:\nA voluntad: indetectable (solo sobre sí mismo)\n1/día cada uno: ceguera/sordera, desenfocar, disfrazarse",
      ],
      "stone-camouflage": ["Camuflagem de Pedra", "O gnomo tem vantagem em testes de Destreza (Furtividade) para se esconder em terreno rochoso.", "Camuflaje pétreo", "El gnomo tiene ventaja en las pruebas de Destreza (Sigilo) para esconderse en terreno rocoso."],
    },
  },
  deer: {},
  deva: {
    lang: ALL_TELEPATHY,
    res: ["radiante; " + NONMAGICAL[0], "radiante; " + NONMAGICAL[1]],
    t: {
      "angelic-weapons": [
        "Armas Angelicais",
        "Os ataques com arma do deva são mágicos. Quando o deva acerta com qualquer arma, ela causa 4d8 de dano radiante extra (já incluído no ataque).",
        "Armas angelicales",
        "Los ataques con arma del deva son mágicos. Cuando el deva impacta con cualquier arma, esta inflige 4d8 de daño radiante adicional (incluido en el ataque).",
      ],
      "innate-spellcasting": [
        "Conjuração Inata",
        "A habilidade de conjuração do deva é Carisma (CD de resistência de magia 17). O deva pode conjurar as seguintes magias de forma inata, precisando só de componentes verbais:\nÀ vontade: detectar o bem e o mal\n1/dia cada: comunhão, reviver os mortos",
        "Lanzamiento de conjuros innato",
        "La aptitud mágica del deva es Carisma (CD de salvación de conjuros 17). El deva puede lanzar de forma innata los siguientes conjuros, necesitando solo componentes verbales:\nA voluntad: detectar el bien y el mal\n1/día cada uno: comunión, revivir a los muertos",
      ],
      "magic-resistance": magicRes("O deva", "El deva"),
    },
    a: {
      multiattack: multi("O deva faz dois ataques corpo a corpo.", "El deva hace dos ataques cuerpo a cuerpo."),
      "healing-touch": [
        "Toque Curativo",
        "O deva toca outra criatura. O alvo recupera magicamente 20 (4d8 + 2) pontos de vida e se livra de qualquer maldição, doença, veneno, cegueira ou surdez.",
        "Toque sanador",
        "El deva toca a otra criatura. El objetivo recupera mágicamente 20 (4d8 + 2) puntos de golpe y se libra de cualquier maldición, enfermedad, veneno, ceguera o sordera.",
      ],
      "change-shape": CHANGE_SHAPE("O deva", "El deva", "os sentidos especiais", "sus sentidos especiales"),
    },
  },
  "dire-wolf": { t: { "keen-hearing-and-smell": hearingSmell("O lobo", "El lobo"), "pack-tactics": pack("O lobo", "do lobo", "El lobo", "del lobo") } },
  djinni: {
    lang: ["Auran", "Aurano"],
    imm: ["elétrico, trovejante", "relámpago, trueno"],
    t: {
      "elemental-demise": [
        "Fim Elemental",
        "Se o djinni morrer, seu corpo se desfaz numa brisa morna, deixando para trás só o equipamento que vestia ou carregava.",
        "Desaparición elemental",
        "Si el djinni muere, su cuerpo se deshace en una brisa cálida y deja atrás solo el equipo que llevaba puesto o encima.",
      ],
      "innate-spellcasting": [
        "Conjuração Inata",
        "A habilidade de conjuração inata do djinni é Carisma (CD de resistência de magia 17, +9 para acertar com ataques de magia). Ele pode conjurar as seguintes magias, sem precisar de componentes materiais:\n\nÀ vontade: detectar o bem e o mal, detectar magia, onda trovejante\n3/dia cada: criar alimentos e água (pode criar vinho no lugar da água), idiomas, caminhar no vento\n1/dia cada: conjurar elemental (só elemental do ar), criação, forma gasosa, invisibilidade, imagem maior, viagem planar",
        "Lanzamiento de conjuros innato",
        "La aptitud mágica innata del djinni es Carisma (CD de salvación de conjuros 17, +9 al ataque con conjuros). Puede lanzar los siguientes conjuros sin necesidad de componentes materiales:\n\nA voluntad: detectar el bien y el mal, detectar magia, onda atronadora\n3/día cada uno: crear comida y agua (puede crear vino en lugar de agua), don de lenguas, caminar con el viento\n1/día cada uno: conjurar elemental (solo elemental de aire), creación, forma gaseosa, invisibilidad, imagen mayor, desplazamiento entre planos",
      ],
    },
    a: {
      multiattack: multi("O djinni faz três ataques de cimitarra.", "El djinni hace tres ataques de cimitarra."),
      "create-whirlwind": [
        "Criar Redemoinho",
        "Um cilindro de ar girando, com 5 ft de raio e 30 ft de altura, se forma magicamente num ponto que o djinni possa ver a até 120 ft. O redemoinho dura enquanto o djinni mantiver a concentração (como se concentrasse numa magia). Qualquer criatura, exceto o djinni, que entre no redemoinho deve passar num teste de resistência de Força CD 18 ou fica impedida por ele. O djinni pode mover o redemoinho até 60 ft como ação, e as criaturas impedidas se movem junto. O redemoinho acaba se o djinni o perder de vista.\nUma criatura pode usar a ação para libertar uma criatura impedida pelo redemoinho, inclusive ela mesma, passando num teste de Força CD 18. Se passar, a criatura deixa de estar impedida e vai para o espaço mais próximo fora do redemoinho.",
        "Crear torbellino",
        "Un cilindro de aire arremolinado de 5 ft de radio y 30 ft de alto se forma mágicamente en un punto que el djinni pueda ver a 120 ft o menos. El torbellino dura mientras el djinni mantenga la concentración (como si se concentrara en un conjuro). Cualquier criatura, salvo el djinni, que entre en el torbellino debe superar una tirada de salvación de Fuerza CD 18 o queda apresada por él. El djinni puede mover el torbellino hasta 60 ft como acción, y las criaturas apresadas se mueven con él. El torbellino termina si el djinni lo pierde de vista.\nUna criatura puede usar su acción para liberar a una criatura apresada por el torbellino, incluida ella misma, superando una prueba de Fuerza CD 18. Si la supera, la criatura deja de estar apresada y va al espacio más cercano fuera del torbellino.",
      ],
    },
  },
  donkey: {},
  doppelganger: {
    lang: ["Comum", "Común"],
    t: {
      ambusher: ["Emboscador", "O doppelganger tem vantagem nas jogadas de ataque contra qualquer criatura que tenha surpreendido.", "Emboscador", "El doppelganger tiene ventaja en las tiradas de ataque contra cualquier criatura a la que haya sorprendido."],
      shapechanger: [
        "Metamorfo",
        "O doppelganger pode usar a ação para se metamorfosear num humanoide Pequeno ou Médio que já tenha visto, ou voltar à forma verdadeira. Suas estatísticas, exceto o tamanho, são as mesmas em todas as formas. O equipamento que veste ou carrega não se transforma. Volta à forma verdadeira se morrer.",
        "Cambiaformas",
        "El doppelganger puede usar su acción para polimorfarse en un humanoide Pequeño o Mediano que haya visto, o volver a su forma verdadera. Sus estadísticas, salvo el tamaño, son las mismas en todas las formas. El equipo que lleve puesto o encima no se transforma. Vuelve a su forma verdadera si muere.",
      ],
      "surprise-attack": [
        "Ataque Surpresa",
        "Se o doppelganger surpreender uma criatura e a acertar com um ataque na primeira rodada de combate, o alvo sofre 10 (3d6) de dano extra desse ataque.",
        "Ataque sorpresa",
        "Si el doppelganger sorprende a una criatura y la impacta con un ataque durante el primer asalto del combate, el objetivo recibe 10 (3d6) de daño adicional de ese ataque.",
      ],
    },
    a: {
      multiattack: multi("O doppelganger faz dois ataques corpo a corpo.", "El doppelganger hace dos ataques cuerpo a cuerpo."),
      "read-thoughts": [
        "Ler Pensamentos",
        "O doppelganger lê magicamente os pensamentos superficiais de uma criatura a até 60 ft. O efeito atravessa barreiras, mas é bloqueado por 90 cm de madeira ou terra, 60 cm de pedra, 5 cm de metal ou uma fina lâmina de chumbo. Enquanto o alvo estiver no alcance, o doppelganger pode continuar lendo seus pensamentos, desde que mantenha a concentração (como se concentrasse numa magia). Lendo a mente do alvo, tem vantagem em testes de Sabedoria (Intuição) e de Carisma (Enganação, Intimidação e Persuasão) contra ele.",
        "Leer pensamientos",
        "El doppelganger lee mágicamente los pensamientos superficiales de una criatura a 60 ft o menos. El efecto atraviesa barreras, pero lo bloquean 90 cm de madera o tierra, 60 cm de piedra, 5 cm de metal o una fina lámina de plomo. Mientras el objetivo esté al alcance, puede seguir leyendo sus pensamientos siempre que mantenga la concentración (como si se concentrara en un conjuro). Mientras lee la mente del objetivo, tiene ventaja en las pruebas de Sabiduría (Perspicacia) y de Carisma (Engaño, Intimidación y Persuasión) contra él.",
      ],
    },
  },
  "draft-horse": {},
};
