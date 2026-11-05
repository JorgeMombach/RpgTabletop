// Lote 7 das habilidades (Passo 12, fase C): Polvo a Roper. Formato em scripts/srd51/details.mjs.
import { ALL_TELEPATHY, charge, coldSilver, falseAppearance, FIRE_POISON, flyby, INFERNAL, keen, magicRes, magicWeapons, multi, NONMAGICAL, pack, POISON, sight, smell, spiderClimb, waterBreathing, webWalker } from "./_comum.mjs";

const BLOOD_FRENZY = (pt, es) => ["Frenesi Sanguinário", `${pt} tem vantagem nas jogadas de ataque corpo a corpo contra qualquer criatura que não esteja com todos os pontos de vida.`, "Frenesí sanguinario", `${es} tiene ventaja en las tiradas de ataque cuerpo a cuerpo contra cualquier criatura que no tenga todos sus puntos de golpe.`];

export default {
  octopus: {
    t: {
      "hold-breath": ["Prender a Respiração", "Fora da água, o polvo pode prender a respiração por 30 minutos.", "Aguantar la respiración", "Fuera del agua, el pulpo puede aguantar la respiración durante 30 minutos."],
      "underwater-camouflage": ["Camuflagem Subaquática", "O polvo tem vantagem em testes de Destreza (Furtividade) feitos debaixo d'água.", "Camuflaje subacuático", "El pulpo tiene ventaja en las pruebas de Destreza (Sigilo) que haga bajo el agua."],
      "water-breathing": waterBreathing("O polvo", "El pulpo"),
    },
    a: {
      "ink-cloud": [
        "Nuvem de Tinta",
        "Se estiver debaixo d'água, uma nuvem de tinta de 5 ft de raio se espalha ao redor do polvo. A área fica densamente obscurecida por 1 minuto, mas uma correnteza forte pode dispersar a tinta. Depois de soltar a tinta, o polvo pode usar a ação Disparada como ação bônus.",
        "Nube de tinta",
        "Si está bajo el agua, una nube de tinta de 5 ft de radio se extiende alrededor del pulpo. La zona queda muy oscurecida durante 1 minuto, aunque una corriente fuerte puede dispersar la tinta. Tras soltar la tinta, el pulpo puede usar la acción de Correr como acción adicional.",
      ],
    },
  },
  ogre: { lang: ["Comum, Gigante", "Común, gigante"] },
  "ogre-zombie": {
    lang: ["entende Comum e Gigante mas não fala", "entiende común y gigante pero no habla"],
    imm: POISON,
    t: {
      "undead-fortitude": [
        "Fortitude Morta-Viva",
        "Se um dano reduzir o zumbi a 0 pontos de vida, ele deve fazer um teste de resistência de Constituição com CD 5 + o dano sofrido, a menos que o dano seja radiante ou de um acerto crítico. Se passar, fica com 1 ponto de vida.",
        "Fortaleza de muerto viviente",
        "Si un daño reduce al zombi a 0 puntos de golpe, debe hacer una tirada de salvación de Constitución con CD 5 + el daño recibido, salvo que el daño sea radiante o de un crítico. Si la supera, se queda a 1 punto de golpe.",
      ],
    },
  },
  oni: {
    lang: ["Comum, Gigante", "Común, gigante"],
    t: {
      "innate-spellcasting": [
        "Conjuração Inata",
        "A habilidade de conjuração inata do oni é Carisma (CD de resistência de magia 13). Ele pode conjurar as seguintes magias de forma inata, sem precisar de componentes materiais:\n\nÀ vontade: escuridão, invisibilidade\n1/dia cada: enfeitiçar pessoa, cone de frio, forma gasosa, sono",
        "Lanzamiento de conjuros innato",
        "La aptitud mágica innata del oni es Carisma (CD de salvación de conjuros 13). Puede lanzar de forma innata los siguientes conjuros sin necesidad de componentes materiales:\n\nA voluntad: oscuridad, invisibilidad\n1/día cada uno: hechizar persona, cono de frío, forma gaseosa, dormir",
      ],
      "magic-weapons": magicWeapons("do oni", "del oni"),
      regeneration: ["Regeneração", "O oni recupera 10 pontos de vida no início do turno se tiver pelo menos 1 ponto de vida.", "Regeneración", "El oni recupera 10 puntos de golpe al principio de su turno si tiene al menos 1 punto de golpe."],
    },
    a: {
      "change-shape": [
        "Mudar de Forma",
        "O oni se transforma magicamente num humanoide Pequeno ou Médio, num gigante Grande, ou volta à forma verdadeira. Fora o tamanho, as estatísticas são as mesmas em todas as formas. O único equipamento que se transforma é a glaive, que encolhe para poder ser usada na forma humanoide. Se o oni morrer, volta à forma verdadeira, e a glaive volta ao tamanho normal.",
        "Cambiar de forma",
        "El oni se transforma mágicamente en un humanoide Pequeño o Mediano, en un gigante Grande, o vuelve a su forma verdadera. Salvo el tamaño, sus estadísticas son las mismas en todas las formas. El único equipo que se transforma es su guja, que encoge para poder empuñarla en forma humanoide. Si el oni muere, vuelve a su forma verdadera y su guja recupera su tamaño normal.",
      ],
      multiattack: multi("O oni faz dois ataques, com as garras ou com a glaive.", "El oni hace dos ataques, con las garras o con la guja."),
    },
  },
  orc: {
    lang: ["Comum, Orc", "Común, orco"],
    t: { aggressive: ["Agressivo", "Como ação bônus, o orc pode se mover até o seu deslocamento na direção de uma criatura hostil que possa ver.", "Agresivo", "Como acción adicional, el orco puede moverse hasta su velocidad hacia una criatura hostil que pueda ver."] },
  },
  otyugh: {
    lang: ["Otyugh", "Otyugh"],
    t: {
      "limited-telepathy": [
        "Telepatia Limitada",
        "O otyugh pode transmitir magicamente mensagens e imagens simples a qualquer criatura a até 120 ft que entenda algum idioma. Essa telepatia não permite que quem recebe responda telepaticamente.",
        "Telepatía limitada",
        "El otyugh puede transmitir mágicamente mensajes e imágenes sencillos a cualquier criatura a 120 ft o menos que entienda algún idioma. Esta telepatía no permite que quien la recibe responda telepáticamente.",
      ],
    },
    a: {
      multiattack: multi("O otyugh faz três ataques: um de mordida e dois de tentáculo.", "El otyugh hace tres ataques: uno de mordisco y dos de tentáculo."),
      "tentacle-slam": [
        "Esmagar com Tentáculos",
        "O otyugh bate as criaturas que estiver agarrando umas nas outras ou numa superfície sólida. Cada criatura deve passar num teste de resistência de Constituição CD 14 ou sofre 10 (2d6 + 3) de dano de concussão e fica atordoada até o fim do próximo turno do otyugh. Se passar, sofre metade do dano e não fica atordoada.",
        "Golpe de tentáculos",
        "El otyugh golpea a las criaturas que tenga agarradas unas contra otras o contra una superficie sólida. Cada criatura debe superar una tirada de salvación de Constitución CD 14 o recibe 10 (2d6 + 3) de daño contundente y queda aturdida hasta el final del siguiente turno del otyugh. Si la supera, recibe la mitad del daño y no queda aturdida.",
      ],
    },
  },
  owl: { t: { flyby: flyby("A coruja", "El búho"), "keen-hearing-and-sight": keen("Audição e Visão Aguçadas", "Oído y vista agudos", "A coruja", "El búho", "da audição ou da visão", "del oído o de la vista") } },
  owlbear: {
    t: { "keen-sight-and-smell": keen("Visão e Olfato Aguçados", "Vista y olfato agudos", "O urso-coruja", "El oso lechuza", "da visão ou do olfato", "de la vista o del olfato") },
    a: { multiattack: multi("O urso-coruja faz dois ataques: um de bico e um de garras.", "El oso lechuza hace dos ataques: uno de pico y otro de garras.") },
  },
  panther: {
    t: {
      "keen-smell": smell("A pantera", "La pantera"),
      pounce: [
        "Bote",
        "Se a pantera se mover pelo menos 20 ft em linha reta até uma criatura e a acertar com um ataque de garras no mesmo turno, o alvo deve passar num teste de resistência de Força CD 12 ou cai. Se o alvo estiver caído, a pantera pode fazer um ataque de mordida contra ele como ação bônus.",
        "Abalanzarse",
        "Si la pantera se mueve al menos 20 ft en línea recta hacia una criatura y la impacta con un ataque de garras en el mismo turno, el objetivo debe superar una tirada de salvación de Fuerza CD 12 o queda derribado. Si el objetivo está derribado, la pantera puede hacer un ataque de mordisco contra él como acción adicional.",
      ],
    },
  },
  pegasus: { lang: ["entende Celestial, Comum, Élfico e Silvestre mas não fala", "entiende celestial, común, élfico y silvano pero no habla"] },
  "phase-spider": {
    t: {
      "ethereal-jaunt": ["Salto Etéreo", "Como ação bônus, a aranha pode passar magicamente do Plano Material para o Plano Etéreo, ou vice-versa.", "Salto etéreo", "Como acción adicional, la araña puede pasar mágicamente del Plano Material al Plano Etéreo, o viceversa."],
      "spider-climb": spiderClimb("A aranha", "La araña"),
      "web-walker": webWalker("A aranha", "La araña"),
    },
  },
  "pit-fiend": {
    lang: INFERNAL,
    res: coldSilver,
    imm: FIRE_POISON,
    t: {
      "fear-aura": [
        "Aura de Medo",
        "Qualquer criatura hostil ao diabo do fosso que comece o turno a até 20 ft dele deve fazer um teste de resistência de Sabedoria CD 21, a menos que o diabo esteja incapacitado. Se falhar, fica amedrontada até o início do seu próximo turno. Se passar, fica imune à Aura de Medo do diabo do fosso pelas próximas 24 horas.",
        "Aura de miedo",
        "Cualquier criatura hostil al diablo de la fosa que empiece su turno a 20 ft o menos de él debe hacer una tirada de salvación de Sabiduría CD 21, salvo que el diablo esté incapacitado. Si falla, queda asustada hasta el principio de su siguiente turno. Si la supera, es inmune al Aura de miedo del diablo de la fosa durante las siguientes 24 horas.",
      ],
      "innate-spellcasting": [
        "Conjuração Inata",
        "A habilidade de conjuração do diabo do fosso é Carisma (CD de resistência de magia 21). Ele pode conjurar as seguintes magias de forma inata, sem precisar de componentes materiais:\nÀ vontade: detectar magia, bola de fogo\n3/dia cada: imobilizar monstro, muralha de fogo",
        "Lanzamiento de conjuros innato",
        "La aptitud mágica del diablo de la fosa es Carisma (CD de salvación de conjuros 21). Puede lanzar de forma innata los siguientes conjuros sin necesidad de componentes materiales:\nA voluntad: detectar magia, bola de fuego\n3/día cada uno: inmovilizar monstruo, muro de fuego",
      ],
      "magic-resistance": magicRes("O diabo do fosso", "El diablo de la fosa"),
      "magic-weapons": magicWeapons("do diabo do fosso", "del diablo de la fosa"),
    },
    a: { multiattack: multi("O diabo do fosso faz quatro ataques: um de mordida, um de garra, um de maça e um de cauda.", "El diablo de la fosa hace cuatro ataques: uno de mordisco, uno de garra, uno de maza y uno de cola.") },
  },
  planetar: {
    lang: ALL_TELEPATHY,
    res: ["radiante; " + NONMAGICAL[0], "radiante; " + NONMAGICAL[1]],
    t: {
      "angelic-weapons": [
        "Armas Angelicais",
        "Os ataques com arma do planetar são mágicos. Quando o planetar acerta com qualquer arma, ela causa 5d8 de dano radiante extra (já incluído no ataque).",
        "Armas angélicas",
        "Los ataques con arma del planetar son mágicos. Cuando el planetar impacta con cualquier arma, esta inflige 5d8 de daño radiante adicional (incluido en el ataque).",
      ],
      "divine-awareness": ["Percepção Divina", "O planetar sabe quando ouve uma mentira.", "Conciencia divina", "El planetar sabe cuándo oye una mentira."],
      "innate-spellcasting": [
        "Conjuração Inata",
        "A habilidade de conjuração do planetar é Carisma (CD de resistência de magia 20). Ele pode conjurar as seguintes magias de forma inata, sem precisar de componentes materiais:\nÀ vontade: detectar o bem e o mal, invisibilidade (só em si mesmo)\n3/dia cada: barreira de lâminas, dissipar o bem e o mal, coluna de chamas, reviver os mortos\n1/dia cada: comunhão, controlar o clima, praga de insetos",
        "Lanzamiento de conjuros innato",
        "La aptitud mágica del planetar es Carisma (CD de salvación de conjuros 20). Puede lanzar de forma innata los siguientes conjuros sin necesidad de componentes materiales:\nA voluntad: detectar el bien y el mal, invisibilidad (solo sobre sí mismo)\n3/día cada uno: barrera de cuchillas, disipar el bien y el mal, descarga flamígera, revivir a los muertos\n1/día cada uno: comunión, controlar el clima, plaga de insectos",
      ],
      "magic-resistance": magicRes("O planetar", "El planetar"),
    },
    a: {
      "healing-touch": [
        "Toque Curativo",
        "O planetar toca outra criatura. O alvo recupera magicamente 30 (6d8 + 3) pontos de vida e fica livre de qualquer maldição, doença, veneno, cegueira ou surdez.",
        "Toque curativo",
        "El planetar toca a otra criatura. El objetivo recupera mágicamente 30 (6d8 + 3) puntos de golpe y queda libre de cualquier maldición, enfermedad, veneno, ceguera o sordera.",
      ],
      multiattack: multi("O planetar faz dois ataques corpo a corpo.", "El planetar hace dos ataques cuerpo a cuerpo."),
    },
  },
  plesiosaurus: { t: { "hold-breath": ["Prender a Respiração", "O plesiossauro pode prender a respiração por 1 hora.", "Aguantar la respiración", "El plesiosaurio puede aguantar la respiración durante 1 hora."] } },
  "poisonous-snake": {},
  "polar-bear": {
    t: { "keen-smell": smell("O urso", "El oso") },
    a: { multiattack: multi("O urso faz dois ataques: um de mordida e um de garras.", "El oso hace dos ataques: uno de mordisco y otro de garras.") },
  },
  pony: {},
  priest: {
    lang: ["dois idiomas quaisquer", "dos idiomas cualesquiera"],
    t: {
      "divine-eminence": [
        "Eminência Divina",
        "Como ação bônus, o sacerdote pode gastar um espaço de magia para que seus ataques corpo a corpo com arma causem magicamente 10 (3d6) de dano radiante extra ao acertar. O benefício dura até o fim do turno. Se gastar um espaço de 2º nível ou maior, o dano extra aumenta 1d6 para cada nível acima do 1º.",
        "Eminencia divina",
        "Como acción adicional, el sacerdote puede gastar un espacio de conjuro para que sus ataques cuerpo a cuerpo con arma inflijan mágicamente 10 (3d6) de daño radiante adicional al impactar. El beneficio dura hasta el final del turno. Si gasta un espacio de nivel 2 o superior, el daño adicional aumenta en 1d6 por cada nivel por encima del 1.",
      ],
      spellcasting: [
        "Conjuração",
        "O sacerdote é um conjurador de 5º nível. Sua habilidade de conjuração é Sabedoria (CD de resistência de magia 13, +5 para acertar com ataques de magia). Tem as seguintes magias de clérigo preparadas:\n\n* Truques (à vontade): luz, chama sagrada, taumaturgia\n* 1º nível (4 espaços): curar ferimentos, raio guiador, santuário\n* 2º nível (3 espaços): restauração menor, arma espiritual\n* 3º nível (2 espaços): dissipar magia, guardiões espirituais",
        "Lanzamiento de conjuros",
        "El sacerdote es un lanzador de conjuros de nivel 5. Su aptitud mágica es Sabiduría (CD de salvación de conjuros 13, +5 al ataque con conjuros). Tiene preparados los siguientes conjuros de clérigo:\n\n* Trucos (a voluntad): luz, llama sagrada, taumaturgia\n* Nivel 1 (4 espacios): curar heridas, saeta guía, santuario\n* Nivel 2 (3 espacios): restablecimiento menor, arma espiritual\n* Nivel 3 (2 espacios): disipar magia, espíritus guardianes",
      ],
    },
  },
  "purple-worm": {
    t: { tunneler: ["Escavador", "O verme pode escavar rocha sólida com metade do deslocamento de escavação e deixa para trás um túnel de 10 ft de diâmetro.", "Excavador", "El gusano puede excavar roca sólida a la mitad de su velocidad excavando y deja tras de sí un túnel de 10 ft de diámetro."] },
    a: { multiattack: multi("O verme faz dois ataques: um de mordida e um de ferrão.", "El gusano hace dos ataques: uno de mordisco y otro de aguijón.") },
  },
  quasit: {
    lang: ["Abissal, Comum", "Abisal, común"],
    res: ["frio, fogo, elétrico; " + NONMAGICAL[0], "frío, fuego, relámpago; " + NONMAGICAL[1]],
    imm: POISON,
    t: {
      "magic-resistance": magicRes("O quasit", "El quasit"),
      shapechanger: [
        "Metamorfo",
        "O quasit pode usar a ação para se transformar numa fera parecida com um morcego (deslocamento 10 ft, voo 40 ft), uma centopeia (40 ft, escalada 40 ft) ou um sapo (40 ft, natação 40 ft), ou voltar à forma verdadeira. As estatísticas são as mesmas em todas as formas, exceto pelas mudanças de deslocamento. O equipamento que veste ou carrega não se transforma. Volta à forma verdadeira se morrer.",
        "Cambiaformas",
        "El quasit puede usar su acción para transformarse en una bestia parecida a un murciélago (velocidad 10 ft, volando 40 ft), un ciempiés (40 ft, trepando 40 ft) o un sapo (40 ft, nadando 40 ft), o volver a su forma verdadera. Sus estadísticas son las mismas en todas las formas, salvo los cambios de velocidad. El equipo que lleve puesto o encima no se transforma. Vuelve a su forma verdadera si muere.",
      ],
    },
    a: {
      invisibility: [
        "Invisibilidade",
        "O quasit fica magicamente invisível até atacar ou usar Assustar, ou até a concentração acabar (como se concentrasse numa magia). O equipamento que veste ou carrega fica invisível junto.",
        "Invisibilidad",
        "El quasit se vuelve invisible mágicamente hasta que ataca o usa Asustar, o hasta que termina su concentración (como si se concentrara en un conjuro). El equipo que lleve puesto o encima se vuelve invisible con él.",
      ],
      scare: [
        "Assustar",
        "Uma criatura à escolha do quasit a até 20 ft dele deve passar num teste de resistência de Sabedoria CD 10 ou fica amedrontada por 1 minuto. O alvo pode repetir o teste ao fim de cada um dos seus turnos, com desvantagem se o quasit estiver na sua linha de visão, encerrando o efeito em si mesmo se passar.",
        "Asustar",
        "Una criatura elegida por el quasit a 20 ft o menos de él debe superar una tirada de salvación de Sabiduría CD 10 o queda asustada durante 1 minuto. El objetivo puede repetir la tirada al final de cada uno de sus turnos, con desventaja si el quasit está en su línea de visión, y termina el efecto sobre sí mismo si la supera.",
      ],
    },
  },
  quipper: { t: { "blood-frenzy": BLOOD_FRENZY("A piranha", "La piraña"), "water-breathing": waterBreathing("A piranha", "La piraña") } },
  rakshasa: {
    lang: ["Comum, Infernal", "Común, infernal"],
    imm: NONMAGICAL,
    vul: ["perfurante de armas mágicas empunhadas por criaturas boas", "perforante de armas mágicas empuñadas por criaturas buenas"],
    t: {
      "innate-spellcasting": [
        "Conjuração Inata",
        "A habilidade de conjuração inata do rakshasa é Carisma (CD de resistência de magia 18, +10 para acertar com ataques de magia). Ele pode conjurar as seguintes magias de forma inata, sem precisar de componentes materiais:\n\nÀ vontade: detectar pensamentos, disfarçar-se, mãos mágicas, ilusão menor\n3/dia cada: enfeitiçar pessoa, detectar magia, invisibilidade, imagem maior, sugestão\n1/dia cada: dominar pessoa, voo, viagem planar, visão da verdade",
        "Lanzamiento de conjuros innato",
        "La aptitud mágica innata del rakshasa es Carisma (CD de salvación de conjuros 18, +10 al ataque con conjuros). Puede lanzar de forma innata los siguientes conjuros sin necesidad de componentes materiales:\n\nA voluntad: detectar pensamientos, disfrazarse, mano de mago, ilusión menor\n3/día cada uno: hechizar persona, detectar magia, invisibilidad, imagen mayor, sugestión\n1/día cada uno: dominar persona, volar, desplazamiento entre planos, visión verdadera",
      ],
      "limited-magic-immunity": [
        "Imunidade Limitada à Magia",
        "O rakshasa não pode ser afetado nem detectado por magias de 6º nível ou menor, a menos que queira. Tem vantagem em testes de resistência contra todas as outras magias e efeitos mágicos.",
        "Inmunidad mágica limitada",
        "Los conjuros de nivel 6 o inferior no pueden afectar ni detectar al rakshasa salvo que él quiera. Tiene ventaja en las tiradas de salvación contra todos los demás conjuros y efectos mágicos.",
      ],
    },
    a: { multiattack: multi("O rakshasa faz dois ataques de garras.", "El rakshasa hace dos ataques de garras.") },
  },
  rat: { t: { "keen-smell": smell("O rato", "La rata") } },
  raven: {
    t: {
      mimicry: [
        "Imitação",
        "O corvo pode imitar sons simples que já ouviu, como uma pessoa sussurrando, um bebê chorando ou um animal guinchando. Quem ouvir os sons percebe que são imitações se passar num teste de Sabedoria (Intuição) CD 10.",
        "Imitación",
        "El cuervo puede imitar sonidos sencillos que haya oído, como una persona susurrando, un bebé llorando o un animal chillando. Quien oiga los sonidos se da cuenta de que son imitaciones si supera una prueba de Sabiduría (Perspicacia) CD 10.",
      ],
    },
  },
  "reef-shark": { t: { "pack-tactics": pack("O tubarão", "do tubarão", "El tiburón", "del tiburón"), "water-breathing": waterBreathing("O tubarão", "El tiburón") } },
  remorhaz: {
    imm: ["frio, fogo", "frío, fuego"],
    t: {
      "heated-body": ["Corpo Ardente", "Uma criatura que toque o remorhaz ou o acerte com um ataque corpo a corpo estando a até 5 ft dele sofre 10 (3d6) de dano de fogo.", "Cuerpo ardiente", "Una criatura que toque al remorhaz o lo impacte con un ataque cuerpo a cuerpo estando a 5 ft o menos de él recibe 10 (3d6) de daño de fuego."],
    },
    a: {
      swallow: [
        "Engolir",
        "O remorhaz faz um ataque de mordida contra uma criatura Média ou menor que esteja agarrando. Se acertar, a criatura sofre o dano da mordida, é engolida e deixa de estar agarrada. Engolida, fica cega e impedida, tem cobertura total contra ataques e outros efeitos de fora do remorhaz, e sofre 21 (6d6) de dano de ácido no início de cada turno dele.\nSe o remorhaz sofrer 30 de dano ou mais num único turno de uma criatura dentro dele, deve passar num teste de resistência de Constituição CD 15 no fim desse turno ou regurgita todas as criaturas engolidas, que caem num espaço a até 10 ft dele. Se o remorhaz morrer, a criatura engolida deixa de estar impedida e pode escapar do cadáver usando 15 ft de deslocamento, saindo caída.",
        "Engullir",
        "El remorhaz hace un ataque de mordisco contra una criatura Mediana o más pequeña a la que esté agarrando. Si impacta, la criatura recibe el daño del mordisco, es engullida y deja de estar agarrada. Mientras está engullida, está cegada y apresada, tiene cobertura total contra ataques y otros efectos del exterior del remorhaz, y recibe 21 (6d6) de daño de ácido al principio de cada turno de este.\nSi el remorhaz recibe 30 de daño o más en un solo turno de una criatura que tenga dentro, debe superar una tirada de salvación de Constitución CD 15 al final de ese turno o regurgita a todas las criaturas engullidas, que caen derribadas en un espacio a 10 ft o menos de él. Si el remorhaz muere, la criatura engullida deja de estar apresada y puede escapar del cadáver usando 15 ft de movimiento, y sale derribada.",
      ],
    },
  },
  rhinoceros: { t: { charge: charge("o rinoceronte", "chifrada", "9 (2d8) de dano de concussão", "el rinoceronte", "cornada", "9 (2d8) de daño contundente", 15) } },
  "riding-horse": {},
  roc: {
    t: { "keen-sight": sight("A roca", "El roc") },
    a: { multiattack: multi("A roca faz dois ataques: um de bico e um de garras.", "El roc hace dos ataques: uno de pico y otro de garras.") },
  },
  roper: {
    t: {
      "false-appearance": falseAppearance("o roper", "uma formação comum de caverna, como uma estalagmite", "el cordelero", "una formación normal de caverna, como una estalagmita"),
      "grasping-tendrils": [
        "Filamentos Agarradores",
        "O roper pode ter até seis filamentos ao mesmo tempo. Cada filamento pode ser atacado (CA 20; 10 pontos de vida; imunidade a dano de veneno e psíquico). Destruir um filamento não causa dano ao roper, que pode soltar um novo no próximo turno. Um filamento também pode ser rompido se uma criatura usar uma ação e passar num teste de Força CD 15 contra ele.",
        "Zarcillos prensiles",
        "El cordelero puede tener hasta seis zarcillos a la vez. Cada zarcillo puede ser atacado (CA 20; 10 puntos de golpe; inmunidad al daño de veneno y psíquico). Destruir un zarcillo no inflige daño al cordelero, que puede sacar uno nuevo en su siguiente turno. Un zarcillo también puede romperse si una criatura usa una acción y supera una prueba de Fuerza CD 15 contra él.",
      ],
      "spider-climb": spiderClimb("O roper", "El cordelero"),
    },
    a: {
      multiattack: multi("O roper faz quatro ataques com os filamentos, usa Puxar e faz um ataque de mordida.", "El cordelero hace cuatro ataques con sus zarcillos, usa Recoger y hace un ataque de mordisco."),
      reel: ["Puxar", "O roper puxa cada criatura que estiver agarrando até 25 ft em linha reta na direção dele.", "Recoger", "El cordelero arrastra a cada criatura que tenga agarrada hasta 25 ft en línea recta hacia él."],
    },
  },
};
