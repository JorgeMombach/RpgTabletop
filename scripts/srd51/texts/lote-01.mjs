// Lote 1 das habilidades (Passo 12, fase C): Aboleth a Diabo Ósseo. Formato em scripts/srd51/details.mjs.
// t = traços, a = ações (inclusive reações e lendárias), pela chave da Open5e: [nome pt, texto pt, nome es, texto es].
const MAGIC_RES = (pt, es) => ["Resistência à Magia", `${pt} tem vantagem em testes de resistência contra magias e outros efeitos mágicos.`, "Resistencia mágica", `${es} tiene ventaja en las tiradas de salvación contra conjuros y otros efectos mágicos.`];
const MAGIC_WEAPONS = (pt, es) => ["Armas Mágicas", `Os ataques com arma ${pt} são mágicos.`, "Armas mágicas", `Los ataques con arma ${es} son mágicos.`];
const DEVIL_SIGHT = ["Visão do Diabo", "A escuridão mágica não atrapalha a visão no escuro do diabo.", "Vista del diablo", "La oscuridad mágica no impide la visión en la oscuridad del diablo."];
const PACK = (pt, ptDe, es, esDe) => ["Táticas de Matilha", `${pt} tem vantagem nas jogadas de ataque contra uma criatura se ao menos um aliado ${ptDe} estiver a até 5 ft dela e não estiver incapacitado.`, "Tácticas de manada", `${es} tiene ventaja en las tiradas de ataque contra una criatura si al menos un aliado ${esDe} está a 5 ft o menos de ella y no está incapacitado.`];
const NONMAGICAL = ["concussão, perfurante e cortante de ataques não mágicos", "contundente, perforante y cortante de ataques no mágicos"];
const SILVER = ["concussão, perfurante e cortante de ataques não mágicos feitos sem armas de prata", "contundente, perforante y cortante de ataques no mágicos hechos sin armas de plata"];
const INFERNAL = ["Infernal, telepatia 120 ft", "Infernal, telepatía 120 ft"];
const ANY_ONE = ["um idioma qualquer (geralmente Comum)", "un idioma cualquiera (normalmente común)"];
const CREATOR = ["um idioma que seu criador conheça", "un idioma que conozca su creador"];

export default {
  aboleth: {
    lang: ["Dialeto das Profundezas, telepatia 120 ft", "Habla profunda, telepatía 120 ft"],
    t: {
      amphibious: ["Anfíbio", "O aboleth pode respirar ar e água.", "Anfibio", "El aboleth puede respirar aire y agua."],
      "mucous-cloud": [
        "Nuvem de Muco",
        "Enquanto está submerso, o aboleth fica envolto num muco transformador. Uma criatura que toque o aboleth ou o acerte com um ataque corpo a corpo estando a até 5 ft dele deve fazer um teste de resistência de Constituição CD 14. Se falhar, a criatura fica doente por 1d4 horas. A criatura doente só consegue respirar debaixo d'água.",
        "Nube de mucosidad",
        "Mientras está bajo el agua, el aboleth está rodeado de una mucosidad transformadora. Una criatura que toque al aboleth o lo golpee con un ataque cuerpo a cuerpo estando a 5 ft o menos de él debe hacer una tirada de salvación de Constitución CD 14. Si falla, la criatura enferma durante 1d4 horas. La criatura enferma solo puede respirar bajo el agua.",
      ],
      "probing-telepathy": [
        "Telepatia Investigativa",
        "Se uma criatura se comunicar telepaticamente com o aboleth, o aboleth descobre os maiores desejos dela, se puder vê-la.",
        "Telepatía indagadora",
        "Si una criatura se comunica telepáticamente con el aboleth, el aboleth descubre sus mayores deseos, si puede verla.",
      ],
    },
    a: {
      multiattack: ["Ataques Múltiplos", "O aboleth faz três ataques de tentáculo.", "Ataque múltiple", "El aboleth hace tres ataques de tentáculo."],
      enslave: [
        "Escravizar",
        "O aboleth escolhe uma criatura que possa ver a até 30 ft. O alvo deve passar num teste de resistência de Sabedoria CD 14 ou fica magicamente enfeitiçado pelo aboleth até o aboleth morrer ou até estarem em planos de existência diferentes. O alvo enfeitiçado fica sob o controle do aboleth, não pode usar reações, e os dois podem se comunicar telepaticamente a qualquer distância.\nSempre que sofrer dano, o alvo enfeitiçado pode repetir o teste de resistência; se passar, o efeito acaba. No máximo uma vez a cada 24 horas, o alvo também pode repetir o teste quando estiver a pelo menos 1,5 km do aboleth.",
        "Esclavizar",
        "El aboleth elige una criatura que pueda ver a 30 ft o menos. El objetivo debe superar una tirada de salvación de Sabiduría CD 14 o queda hechizado mágicamente por el aboleth hasta que el aboleth muera o hasta que estén en planos de existencia distintos. El objetivo hechizado queda bajo el control del aboleth, no puede usar reacciones, y ambos pueden comunicarse telepáticamente a cualquier distancia.\nCada vez que recibe daño, el objetivo hechizado puede repetir la tirada de salvación; si la supera, el efecto termina. Como mucho una vez cada 24 horas, el objetivo también puede repetirla cuando esté a 1,5 km o más del aboleth.",
      ],
      detect: ["Detectar", "O aboleth faz um teste de Sabedoria (Percepção).", "Detectar", "El aboleth hace una prueba de Sabiduría (Percepción)."],
      "tail-swipe": ["Golpe de Cauda", "O aboleth faz um ataque de cauda.", "Coletazo", "El aboleth hace un ataque de cola."],
      "psychic-drain": [
        "Dreno Psíquico",
        "Uma criatura enfeitiçada pelo aboleth sofre 10 (3d6) de dano psíquico, e o aboleth recupera pontos de vida iguais ao dano sofrido.",
        "Drenaje psíquico",
        "Una criatura hechizada por el aboleth recibe 10 (3d6) de daño psíquico, y el aboleth recupera tantos puntos de golpe como el daño recibido.",
      ],
    },
  },
  acolyte: {
    lang: ANY_ONE,
    t: {
      spellcasting: [
        "Conjuração",
        "O acólito é um conjurador de 1º nível. Sua habilidade de conjuração é Sabedoria (CD de resistência de magia 12, +4 para acertar com ataques de magia). O acólito tem as seguintes magias de clérigo preparadas:\n\n* Truques (à vontade): luz, chama sagrada, taumaturgia\n* 1º nível (3 espaços): bênção, curar ferimentos, santuário",
        "Lanzamiento de conjuros",
        "El acólito es un lanzador de conjuros de nivel 1. Su aptitud mágica es Sabiduría (CD de salvación de conjuros 12, +4 al ataque con conjuros). El acólito tiene preparados los siguientes conjuros de clérigo:\n\n* Trucos (a voluntad): luz, llama sagrada, taumaturgia\n* Nivel 1 (3 espacios): bendición, curar heridas, santuario",
      ],
    },
  },
  "air-elemental": {
    lang: ["Auran", "Aurano"],
    res: ["elétrico, trovejante; concussão, perfurante e cortante de ataques não mágicos", "relámpago, trueno; contundente, perforante y cortante de ataques no mágicos"],
    imm: ["veneno", "veneno"],
    t: {
      "air-form": [
        "Forma de Ar",
        "O elemental pode entrar no espaço de uma criatura hostil e parar ali. Pode passar por um espaço de apenas 2,5 cm de largura sem se espremer.",
        "Forma de aire",
        "El elemental puede entrar en el espacio de una criatura hostil y detenerse allí. Puede pasar por un espacio de solo 2,5 cm de ancho sin apretarse.",
      ],
    },
    a: {
      multiattack: ["Ataques Múltiplos", "O elemental faz dois ataques de pancada.", "Ataque múltiple", "El elemental hace dos ataques de golpe."],
      whirlwind: [
        "Redemoinho",
        "Cada criatura no espaço do elemental deve fazer um teste de resistência de Força CD 13. Se falhar, sofre 15 (3d8 + 2) de dano de concussão e é arremessada 20 ft para longe do elemental, numa direção aleatória, e cai. Se o alvo arremessado bater num objeto, como uma parede ou o chão, sofre 3 (1d6) de dano de concussão a cada 10 ft que voou. Se for arremessado contra outra criatura, essa criatura deve passar num teste de resistência de Destreza CD 13 ou sofre o mesmo dano e cai.\nSe passar no teste de resistência, o alvo sofre metade do dano de concussão e não é arremessado nem derrubado.",
        "Torbellino",
        "Cada criatura en el espacio del elemental debe hacer una tirada de salvación de Fuerza CD 13. Si falla, recibe 15 (3d8 + 2) de daño contundente, sale despedida 20 ft en una dirección aleatoria y queda derribada. Si el objetivo choca contra un objeto, como una pared o el suelo, recibe 3 (1d6) de daño contundente por cada 10 ft que haya volado. Si sale despedido contra otra criatura, esa criatura debe superar una tirada de salvación de Destreza CD 13 o recibe el mismo daño y queda derribada.\nSi supera la tirada de salvación, el objetivo recibe la mitad del daño contundente y no sale despedido ni queda derribado.",
      ],
    },
  },
  androsphinx: {
    lang: ["Comum, Esfinge", "Común, esfinge"],
    imm: ["psíquico; concussão, perfurante e cortante de ataques não mágicos", "psíquico; contundente, perforante y cortante de ataques no mágicos"],
    t: {
      inscrutable: [
        "Inescrutável",
        "A esfinge é imune a qualquer efeito que perceba suas emoções ou leia seus pensamentos, e a qualquer magia de adivinhação que ela recuse. Testes de Sabedoria (Intuição) para descobrir as intenções ou a sinceridade da esfinge têm desvantagem.",
        "Inescrutable",
        "La esfinge es inmune a cualquier efecto que perciba sus emociones o lea sus pensamientos, y a cualquier conjuro de adivinación que rechace. Las pruebas de Sabiduría (Perspicacia) para averiguar sus intenciones o su sinceridad tienen desventaja.",
      ],
      "magic-weapons": MAGIC_WEAPONS("da esfinge", "de la esfinge"),
      spellcasting: [
        "Conjuração",
        "A esfinge é uma conjuradora de 12º nível. Sua habilidade de conjuração é Sabedoria (CD de resistência de magia 18, +10 para acertar com ataques de magia). Ela não precisa de componentes materiais para conjurar. A esfinge tem as seguintes magias de clérigo preparadas:\n\n* Truques (à vontade): chama sagrada, poupar os moribundos, taumaturgia\n* 1º nível (4 espaços): comando, detectar o bem e o mal, detectar magia\n* 2º nível (3 espaços): restauração menor, zona da verdade\n* 3º nível (3 espaços): dissipar magia, idiomas\n* 4º nível (3 espaços): banimento, liberdade de movimento\n* 5º nível (2 espaços): coluna de chamas, restauração maior\n* 6º nível (1 espaço): banquete de heróis",
        "Lanzamiento de conjuros",
        "La esfinge es una lanzadora de conjuros de nivel 12. Su aptitud mágica es Sabiduría (CD de salvación de conjuros 18, +10 al ataque con conjuros). No necesita componentes materiales para lanzar sus conjuros. La esfinge tiene preparados los siguientes conjuros de clérigo:\n\n* Trucos (a voluntad): llama sagrada, piedad con los moribundos, taumaturgia\n* Nivel 1 (4 espacios): orden imperiosa, detectar el bien y el mal, detectar magia\n* Nivel 2 (3 espacios): restablecimiento menor, zona de verdad\n* Nivel 3 (3 espacios): disipar magia, don de lenguas\n* Nivel 4 (3 espacios): destierro, libertad de movimiento\n* Nivel 5 (2 espacios): descarga flamígera, restablecimiento mayor\n* Nivel 6 (1 espacio): banquete de héroes",
      ],
    },
    a: {
      multiattack: ["Ataques Múltiplos", "A esfinge faz dois ataques de garra.", "Ataque múltiple", "La esfinge hace dos ataques de garra."],
      roar: [
        "Rugido",
        "A esfinge solta um rugido mágico. A cada vez que ruge antes de terminar um descanso longo, o rugido é mais alto e o efeito muda, como abaixo. Cada criatura a até 500 ft da esfinge que possa ouvir o rugido deve fazer um teste de resistência.\n**Primeiro Rugido.** Cada criatura que falhar num teste de resistência de Sabedoria CD 18 fica amedrontada por 1 minuto. A criatura amedrontada pode repetir o teste ao fim de cada um dos seus turnos, encerrando o efeito em si mesma se passar.\n**Segundo Rugido.** Cada criatura que falhar num teste de resistência de Sabedoria CD 18 fica surda e amedrontada por 1 minuto. A criatura amedrontada fica paralisada e pode repetir o teste ao fim de cada um dos seus turnos, encerrando o efeito em si mesma se passar.\n**Terceiro Rugido.** Cada criatura faz um teste de resistência de Constituição CD 18. Se falhar, sofre 44 (8d10) de dano trovejante e cai. Se passar, sofre metade do dano e não cai.",
        "Rugido",
        "La esfinge emite un rugido mágico. Cada vez que ruge antes de terminar un descanso largo, el rugido es más fuerte y el efecto cambia, como se detalla abajo. Cada criatura a 500 ft o menos de la esfinge que pueda oír el rugido debe hacer una tirada de salvación.\n**Primer rugido.** Cada criatura que falle una tirada de salvación de Sabiduría CD 18 queda asustada durante 1 minuto. La criatura asustada puede repetir la tirada al final de cada uno de sus turnos y termina el efecto sobre sí misma si la supera.\n**Segundo rugido.** Cada criatura que falle una tirada de salvación de Sabiduría CD 18 queda ensordecida y asustada durante 1 minuto. La criatura asustada queda paralizada y puede repetir la tirada al final de cada uno de sus turnos, terminando el efecto sobre sí misma si la supera.\n**Tercer rugido.** Cada criatura hace una tirada de salvación de Constitución CD 18. Si falla, recibe 44 (8d10) de daño de trueno y queda derribada. Si la supera, recibe la mitad del daño y no queda derribada.",
      ],
      "claw-attack": ["Ataque de Garra", "A esfinge faz um ataque de garra.", "Ataque de garra", "La esfinge hace un ataque de garra."],
      teleport: [
        "Teletransporte",
        "A esfinge se teletransporta magicamente, junto com o equipamento que veste ou carrega, até 120 ft para um espaço desocupado que possa ver.",
        "Teletransporte",
        "La esfinge se teletransporta mágicamente, junto con el equipo que lleve puesto o encima, hasta 120 ft a un espacio desocupado que pueda ver.",
      ],
      "cast-a-spell": [
        "Conjurar uma Magia",
        "A esfinge conjura uma magia da sua lista de magias preparadas, gastando um espaço de magia normalmente.",
        "Lanzar un conjuro",
        "La esfinge lanza un conjuro de su lista de conjuros preparados, gastando un espacio de conjuro de la forma habitual.",
      ],
    },
  },
  "animated-armor": {
    imm: ["veneno, psíquico", "veneno, psíquico"],
    t: {
      "antimagic-susceptibility": [
        "Suscetível à Antimagia",
        "A armadura fica incapacitada enquanto estiver na área de um campo antimagia. Se for alvo de dissipar magia, deve passar num teste de resistência de Constituição contra a CD de resistência de magia do conjurador ou fica inconsciente por 1 minuto.",
        "Susceptibilidad a la antimagia",
        "La armadura queda incapacitada mientras esté en el área de un campo antimagia. Si es objetivo de disipar magia, debe superar una tirada de salvación de Constitución contra la CD de salvación de conjuros del lanzador o queda inconsciente durante 1 minuto.",
      ],
      "false-appearance": [
        "Falsa Aparência",
        "Enquanto fica imóvel, a armadura é indistinguível de uma armadura comum.",
        "Apariencia falsa",
        "Mientras permanece inmóvil, la armadura es indistinguible de una armadura normal.",
      ],
    },
    a: { multiattack: ["Ataques Múltiplos", "A armadura faz dois ataques corpo a corpo.", "Ataque múltiple", "La armadura hace dos ataques cuerpo a cuerpo."] },
  },
  ankheg: {
    a: {
      "acid-spray": [
        "Jato de Ácido",
        "O ankheg cospe ácido numa linha de 30 ft de comprimento por 5 ft de largura, desde que não esteja agarrando nenhuma criatura. Cada criatura na linha deve fazer um teste de resistência de Destreza CD 13; sofre 10 (3d6) de dano de ácido se falhar, ou metade se passar.",
        "Rociada de ácido",
        "El ankheg escupe ácido en una línea de 30 ft de largo y 5 ft de ancho, siempre que no tenga a ninguna criatura agarrada. Cada criatura en la línea debe hacer una tirada de salvación de Destreza CD 13; recibe 10 (3d6) de daño de ácido si falla, o la mitad si la supera.",
      ],
    },
  },
  ape: { a: { multiattack: ["Ataques Múltiplos", "O macaco faz dois ataques de punho.", "Ataque múltiple", "El simio hace dos ataques de puño."] } },
  archmage: {
    lang: ["seis idiomas quaisquer", "seis idiomas cualesquiera"],
    res: ["dano de magias; concussão, perfurante e cortante não mágicos (de pele de pedra)", "daño de conjuros; contundente, perforante y cortante no mágicos (de piel pétrea)"],
    t: {
      "magic-resistance": MAGIC_RES("O arquimago", "El archimago"),
      spellcasting: [
        "Conjuração",
        "O arquimago é um conjurador de 18º nível. Sua habilidade de conjuração é Inteligência (CD de resistência de magia 17, +9 para acertar com ataques de magia). O arquimago pode conjurar disfarçar-se e invisibilidade à vontade e tem as seguintes magias de mago preparadas:\n\n* Truques (à vontade): raio de fogo, luz, mão mágica, prestidigitação, toque chocante\n* 1º nível (4 espaços): detectar magia, identificação, armadura arcana*, mísseis mágicos\n* 2º nível (3 espaços): detectar pensamentos, imagem espelhada, passo nebuloso\n* 3º nível (3 espaços): contramágica, voo, relâmpago\n* 4º nível (3 espaços): banimento, escudo de fogo, pele de pedra*\n* 5º nível (3 espaços): cone de frio, vidência, muralha de energia\n* 6º nível (1 espaço): globo de invulnerabilidade\n* 7º nível (1 espaço): teletransporte\n* 8º nível (1 espaço): mente em branco*\n* 9º nível (1 espaço): parar o tempo\n* O arquimago conjura essas magias em si mesmo antes do combate.",
        "Lanzamiento de conjuros",
        "El archimago es un lanzador de conjuros de nivel 18. Su aptitud mágica es Inteligencia (CD de salvación de conjuros 17, +9 al ataque con conjuros). El archimago puede lanzar disfrazarse e invisibilidad a voluntad y tiene preparados los siguientes conjuros de mago:\n\n* Trucos (a voluntad): descarga de fuego, luz, mano de mago, prestidigitación, agarre electrizante\n* Nivel 1 (4 espacios): detectar magia, identificar, armadura de mago*, proyectil mágico\n* Nivel 2 (3 espacios): detectar pensamientos, imagen múltiple, paso brumoso\n* Nivel 3 (3 espacios): contraconjuro, volar, relámpago\n* Nivel 4 (3 espacios): destierro, escudo de fuego, piel pétrea*\n* Nivel 5 (3 espacios): cono de frío, escudriñar, muro de fuerza\n* Nivel 6 (1 espacio): globo de invulnerabilidad\n* Nivel 7 (1 espacio): teletransporte\n* Nivel 8 (1 espacio): mente en blanco*\n* Nivel 9 (1 espacio): detener el tiempo\n* El archimago lanza estos conjuros sobre sí mismo antes del combate.",
      ],
    },
  },
  assassin: {
    lang: ["gíria de ladrão e mais dois idiomas quaisquer", "jerga de ladrones y otros dos idiomas cualesquiera"],
    res: ["veneno", "veneno"],
    t: {
      assassinate: [
        "Assassinar",
        "No seu primeiro turno, o assassino tem vantagem nas jogadas de ataque contra qualquer criatura que ainda não tenha jogado. Todo acerto do assassino contra uma criatura surpresa é um acerto crítico.",
        "Asesinar",
        "Durante su primer turno, el asesino tiene ventaja en las tiradas de ataque contra cualquier criatura que todavía no haya tenido su turno. Cualquier impacto del asesino contra una criatura sorprendida es un crítico.",
      ],
      evasion: [
        "Evasão",
        "Se o assassino for alvo de um efeito que permita um teste de resistência de Destreza para sofrer só metade do dano, ele não sofre dano nenhum se passar, e só metade se falhar.",
        "Evasión",
        "Si el asesino queda expuesto a un efecto que le permite una tirada de salvación de Destreza para recibir solo la mitad del daño, no recibe daño si la supera y solo la mitad si la falla.",
      ],
      "sneak-attack-1turn": [
        "Ataque Furtivo (1/turno)",
        "O assassino causa 13 (4d6) de dano extra ao acertar um alvo com um ataque com arma tendo vantagem na jogada de ataque, ou quando o alvo estiver a até 5 ft de um aliado do assassino que não esteja incapacitado e o assassino não tiver desvantagem na jogada.",
        "Ataque furtivo (1/turno)",
        "El asesino inflige 13 (4d6) de daño adicional cuando impacta a un objetivo con un ataque con arma teniendo ventaja en la tirada, o cuando el objetivo está a 5 ft o menos de un aliado del asesino que no está incapacitado y el asesino no tiene desventaja en la tirada.",
      ],
    },
    a: { multiattack: ["Ataques Múltiplos", "O assassino faz dois ataques de espada curta.", "Ataque múltiple", "El asesino hace dos ataques de espada corta."] },
  },
  "awakened-shrub": {
    lang: CREATOR,
    res: ["perfurante", "perforante"],
    vul: ["fogo", "fuego"],
    t: { "false-appearance": ["Falsa Aparência", "Enquanto fica imóvel, o arbusto é indistinguível de um arbusto comum.", "Apariencia falsa", "Mientras permanece inmóvil, el arbusto es indistinguible de un arbusto normal."] },
  },
  "awakened-tree": {
    lang: CREATOR,
    res: ["concussão, perfurante", "contundente, perforante"],
    vul: ["fogo", "fuego"],
    t: { "false-appearance": ["Falsa Aparência", "Enquanto fica imóvel, a árvore é indistinguível de uma árvore comum.", "Apariencia falsa", "Mientras permanece inmóvil, el árbol es indistinguible de un árbol normal."] },
  },
  "axe-beak": {},
  azer: {
    lang: ["Ignan", "Ígneo"],
    imm: ["fogo, veneno", "fuego, veneno"],
    t: {
      "heated-body": [
        "Corpo Incandescente",
        "Uma criatura que toque o azer ou o acerte com um ataque corpo a corpo estando a até 5 ft dele sofre 5 (1d10) de dano de fogo.",
        "Cuerpo candente",
        "Una criatura que toque al azer o lo golpee con un ataque cuerpo a cuerpo estando a 5 ft o menos de él recibe 5 (1d10) de daño de fuego.",
      ],
      "heated-weapons": [
        "Armas Incandescentes",
        "Quando o azer acerta com uma arma corpo a corpo de metal, causa 3 (1d6) de dano de fogo extra (já incluído no ataque).",
        "Armas candentes",
        "Cuando el azer impacta con un arma cuerpo a cuerpo de metal, inflige 3 (1d6) de daño de fuego adicional (incluido en el ataque).",
      ],
      illumination: [
        "Iluminação",
        "O azer emite luz plena num raio de 10 ft e penumbra por mais 10 ft.",
        "Iluminación",
        "El azer emite luz brillante en un radio de 10 ft y luz tenue 10 ft más allá.",
      ],
    },
  },
  baboon: { t: { "pack-tactics": PACK("O babuíno", "do babuíno", "El babuino", "del babuino") } },
  badger: { t: { "keen-smell": ["Olfato Aguçado", "O texugo tem vantagem em testes de Sabedoria (Percepção) que dependam do olfato.", "Olfato agudo", "El tejón tiene ventaja en las pruebas de Sabiduría (Percepción) que dependan del olfato."] } },
  balor: {
    lang: ["Abissal, telepatia 120 ft", "Abisal, telepatía 120 ft"],
    res: ["frio, elétrico; " + NONMAGICAL[0], "frío, relámpago; " + NONMAGICAL[1]],
    imm: ["fogo, veneno", "fuego, veneno"],
    t: {
      "death-throes": [
        "Agonia Mortal",
        "Quando o balor morre, ele explode, e cada criatura a até 30 ft dele deve fazer um teste de resistência de Destreza CD 20; sofre 70 (20d6) de dano de fogo se falhar, ou metade se passar. A explosão incendeia objetos inflamáveis na área que ninguém esteja vestindo ou carregando, e destrói as armas do balor.",
        "Estertores de muerte",
        "Cuando el balor muere, explota, y cada criatura a 30 ft o menos de él debe hacer una tirada de salvación de Destreza CD 20; recibe 70 (20d6) de daño de fuego si falla, o la mitad si la supera. La explosión prende fuego a los objetos inflamables del área que nadie lleve puestos o encima, y destruye las armas del balor.",
      ],
      "fire-aura": [
        "Aura de Fogo",
        "No início de cada turno do balor, cada criatura a até 5 ft dele sofre 10 (3d6) de dano de fogo, e objetos inflamáveis na aura que ninguém esteja vestindo ou carregando pegam fogo. Uma criatura que toque o balor ou o acerte com um ataque corpo a corpo estando a até 5 ft dele sofre 10 (3d6) de dano de fogo.",
        "Aura de fuego",
        "Al principio de cada turno del balor, cada criatura a 5 ft o menos de él recibe 10 (3d6) de daño de fuego, y los objetos inflamables del aura que nadie lleve puestos o encima prenden. Una criatura que toque al balor o lo golpee con un ataque cuerpo a cuerpo estando a 5 ft o menos de él recibe 10 (3d6) de daño de fuego.",
      ],
      "magic-resistance": MAGIC_RES("O balor", "El balor"),
      "magic-weapons": MAGIC_WEAPONS("do balor", "del balor"),
    },
    a: {
      multiattack: ["Ataques Múltiplos", "O balor faz dois ataques: um com a espada longa e um com o chicote.", "Ataque múltiple", "El balor hace dos ataques: uno con la espada larga y otro con el látigo."],
      teleport: [
        "Teletransporte",
        "O balor se teletransporta magicamente, junto com o equipamento que veste ou carrega, até 120 ft para um espaço desocupado que possa ver.",
        "Teletransporte",
        "El balor se teletransporta mágicamente, junto con el equipo que lleve puesto o encima, hasta 120 ft a un espacio desocupado que pueda ver.",
      ],
    },
  },
  bandit: { lang: ANY_ONE },
  "bandit-captain": {
    lang: ["dois idiomas quaisquer", "dos idiomas cualesquiera"],
    a: {
      multiattack: [
        "Ataques Múltiplos",
        "O capitão faz três ataques corpo a corpo: dois com a cimitarra e um com a adaga. Ou faz dois ataques à distância com as adagas.",
        "Ataque múltiple",
        "El capitán hace tres ataques cuerpo a cuerpo: dos con la cimitarra y uno con la daga. O hace dos ataques a distancia con las dagas.",
      ],
      parry: [
        "Aparar",
        "O capitão soma 2 à CA contra um ataque corpo a corpo que o acertaria. Para isso, precisa ver o atacante e estar empunhando uma arma corpo a corpo.",
        "Parada",
        "El capitán suma 2 a su CA contra un ataque cuerpo a cuerpo que lo impactaría. Para ello, debe ver al atacante y empuñar un arma cuerpo a cuerpo.",
      ],
    },
  },
  "barbed-devil": {
    lang: INFERNAL,
    res: ["frio; " + SILVER[0], "frío; " + SILVER[1]],
    imm: ["fogo, veneno", "fuego, veneno"],
    t: {
      "barbed-hide": [
        "Couro Farpado",
        "No início de cada um dos seus turnos, o diabo farpado causa 5 (1d10) de dano perfurante a qualquer criatura que o esteja agarrando.",
        "Piel espinosa",
        "Al principio de cada uno de sus turnos, el diablo espinoso inflige 5 (1d10) de daño perforante a cualquier criatura que lo esté agarrando.",
      ],
      "devils-sight": DEVIL_SIGHT,
      "magic-resistance": MAGIC_RES("O diabo", "El diablo"),
    },
    a: {
      multiattack: [
        "Ataques Múltiplos",
        "O diabo faz três ataques corpo a corpo: um com a cauda e dois com as garras. Ou pode usar Arremessar Chama duas vezes.",
        "Ataque múltiple",
        "El diablo hace tres ataques cuerpo a cuerpo: uno con la cola y dos con las garras. O puede usar Arrojar llama dos veces.",
      ],
    },
  },
  basilisk: {
    t: {
      "petrifying-gaze": [
        "Olhar Petrificante",
        "Se uma criatura começar o turno a até 30 ft do basilisco e os dois puderem se ver, o basilisco pode obrigá-la a fazer um teste de resistência de Constituição CD 12, se não estiver incapacitado. Se falhar, a criatura começa a virar pedra magicamente e fica impedida. Ela deve repetir o teste no fim do seu próximo turno: se passar, o efeito acaba; se falhar, fica petrificada até ser libertada pela magia restauração maior ou outra magia.\nUma criatura que não esteja surpresa pode desviar o olhar para evitar o teste no início do turno. Se fizer isso, não pode ver o basilisco até o início do seu próximo turno, quando pode desviar o olhar de novo. Se olhar para o basilisco nesse meio-tempo, deve fazer o teste na hora.\nSe o basilisco vir o próprio reflexo a até 30 ft sob luz plena, ele se confunde com um rival e usa o olhar em si mesmo.",
        "Mirada petrificante",
        "Si una criatura empieza su turno a 30 ft o menos del basilisco y ambos pueden verse, el basilisco puede obligarla a hacer una tirada de salvación de Constitución CD 12, si no está incapacitado. Si falla, la criatura empieza a convertirse en piedra mágicamente y queda apresada. Debe repetir la tirada al final de su siguiente turno: si la supera, el efecto termina; si falla, queda petrificada hasta que la libere el conjuro restablecimiento mayor u otra magia.\nUna criatura que no esté sorprendida puede apartar la mirada para evitar la tirada al principio de su turno. Si lo hace, no puede ver al basilisco hasta el principio de su siguiente turno, cuando puede volver a apartarla. Si mira al basilisco mientras tanto, debe hacer la tirada de inmediato.\nSi el basilisco ve su reflejo a 30 ft o menos bajo luz brillante, se confunde con un rival y usa la mirada contra sí mismo.",
      ],
    },
  },
  bat: {
    t: {
      echolocation: ["Ecolocalização", "O morcego não pode usar a percepção às cegas enquanto estiver surdo.", "Ecolocalización", "El murciélago no puede usar su vista ciega mientras esté ensordecido."],
      "keen-hearing": ["Audição Aguçada", "O morcego tem vantagem em testes de Sabedoria (Percepção) que dependam da audição.", "Oído agudo", "El murciélago tiene ventaja en las pruebas de Sabiduría (Percepción) que dependan del oído."],
    },
  },
  "bearded-devil": {
    lang: INFERNAL,
    res: ["frio; " + SILVER[0], "frío; " + SILVER[1]],
    imm: ["fogo, veneno", "fuego, veneno"],
    t: {
      "devils-sight": DEVIL_SIGHT,
      "magic-resistance": MAGIC_RES("O diabo", "El diablo"),
      steadfast: ["Inabalável", "O diabo não pode ficar amedrontado enquanto puder ver uma criatura aliada a até 30 ft.", "Firme", "El diablo no puede quedar asustado mientras pueda ver a una criatura aliada a 30 ft o menos."],
    },
    a: { multiattack: ["Ataques Múltiplos", "O diabo faz dois ataques: um com a barba e um com a glaive.", "Ataque múltiple", "El diablo hace dos ataques: uno con la barba y otro con la guja."] },
  },
  behir: {
    lang: ["Dracônico", "Dracónico"],
    imm: ["elétrico", "relámpago"],
    a: {
      multiattack: ["Ataques Múltiplos", "O behir faz dois ataques: um de mordida e um de constrição.", "Ataque múltiple", "El behir hace dos ataques: uno de mordisco y otro de constreñir."],
      "lightning-breath": [
        "Sopro Elétrico",
        "O behir exala uma linha de relâmpago de 20 ft de comprimento por 5 ft de largura. Cada criatura na linha deve fazer um teste de resistência de Destreza CD 16; sofre 66 (12d10) de dano elétrico se falhar, ou metade se passar.",
        "Aliento de relámpago",
        "El behir exhala una línea de relámpago de 20 ft de largo y 5 ft de ancho. Cada criatura en la línea debe hacer una tirada de salvación de Destreza CD 16; recibe 66 (12d10) de daño de relámpago si falla, o la mitad si la supera.",
      ],
      swallow: [
        "Engolir",
        "O behir faz um ataque de mordida contra um alvo Médio ou menor que esteja agarrando. Se acertar, o alvo também é engolido e deixa de estar agarrado. Engolido, o alvo fica cego e impedido, tem cobertura total contra ataques e efeitos de fora do behir, e sofre 21 (6d6) de dano de ácido no início de cada turno do behir. O behir só pode ter uma criatura engolida por vez.\nSe o behir sofrer 30 de dano ou mais num único turno vindo da criatura engolida, deve passar num teste de resistência de Constituição CD 14 no fim desse turno ou regurgita a criatura, que cai num espaço a até 10 ft do behir. Se o behir morrer, a criatura engolida deixa de estar impedida e pode sair do corpo usando 15 ft de deslocamento, saindo caída.",
        "Engullir",
        "El behir hace un ataque de mordisco contra un objetivo Mediano o más pequeño al que esté agarrando. Si impacta, el objetivo también es engullido y deja de estar agarrado. Mientras está engullido, el objetivo está cegado y apresado, tiene cobertura total contra ataques y efectos de fuera del behir, y recibe 21 (6d6) de daño de ácido al principio de cada turno del behir. El behir solo puede tener una criatura engullida a la vez.\nSi el behir recibe 30 de daño o más en un solo turno de la criatura engullida, debe superar una tirada de salvación de Constitución CD 14 al final de ese turno o regurgita a la criatura, que cae derribada en un espacio a 10 ft o menos del behir. Si el behir muere, la criatura engullida deja de estar apresada y puede salir del cadáver usando 15 ft de movimiento, quedando derribada.",
      ],
    },
  },
  berserker: {
    lang: ANY_ONE,
    t: {
      reckless: [
        "Imprudente",
        "No início do seu turno, o berserker pode ganhar vantagem em todas as jogadas de ataque corpo a corpo com arma nesse turno, mas as jogadas de ataque contra ele têm vantagem até o início do seu próximo turno.",
        "Temerario",
        "Al principio de su turno, el berserker puede obtener ventaja en todas las tiradas de ataque con arma cuerpo a cuerpo durante ese turno, pero las tiradas de ataque contra él tienen ventaja hasta el principio de su siguiente turno.",
      ],
    },
  },
  "black-bear": {
    t: { "keen-smell": ["Olfato Aguçado", "O urso tem vantagem em testes de Sabedoria (Percepção) que dependam do olfato.", "Olfato agudo", "El oso tiene ventaja en las pruebas de Sabiduría (Percepción) que dependan del olfato."] },
    a: { multiattack: ["Ataques Múltiplos", "O urso faz dois ataques: um de mordida e um de garras.", "Ataque múltiple", "El oso hace dos ataques: uno de mordisco y otro de garras."] },
  },
  "black-pudding": {
    imm: ["ácido, frio, elétrico, cortante", "ácido, frío, relámpago, cortante"],
    t: {
      amorphous: ["Amorfo", "O pudim pode passar por um espaço de apenas 2,5 cm de largura sem se espremer.", "Amorfo", "El pudin puede pasar por un espacio de solo 2,5 cm de ancho sin apretarse."],
      "corrosive-form": [
        "Forma Corrosiva",
        "Uma criatura que toque o pudim ou o acerte com um ataque corpo a corpo estando a até 5 ft dele sofre 4 (1d8) de dano de ácido. Qualquer arma não mágica de metal ou madeira que acerte o pudim é corroída: depois de causar o dano, recebe uma penalidade permanente e cumulativa de -1 nas jogadas de dano; se a penalidade chegar a -5, a arma é destruída. Munição não mágica de metal ou madeira que acerte o pudim é destruída depois de causar o dano. O pudim corrói 5 cm de madeira ou metal não mágicos em 1 rodada.",
        "Forma corrosiva",
        "Una criatura que toque al pudin o lo golpee con un ataque cuerpo a cuerpo estando a 5 ft o menos de él recibe 4 (1d8) de daño de ácido. Cualquier arma no mágica de metal o madera que impacte al pudin se corroe: tras infligir el daño, sufre un penalizador permanente y acumulativo de -1 a las tiradas de daño; si llega a -5, el arma se destruye. La munición no mágica de metal o madera que impacte al pudin se destruye tras infligir el daño. El pudin atraviesa 5 cm de madera o metal no mágicos en 1 asalto.",
      ],
      "spider-climb": [
        "Escalar como Aranha",
        "O pudim pode escalar superfícies difíceis, inclusive de cabeça para baixo no teto, sem precisar fazer teste de habilidade.",
        "Trepar cual arácnido",
        "El pudin puede trepar por superficies difíciles, incluso boca abajo por el techo, sin necesidad de hacer una prueba de característica.",
      ],
    },
    a: {
      split: [
        "Dividir",
        "Quando um pudim Médio ou maior sofre dano elétrico ou cortante, ele se divide em dois pudins novos, se tiver pelo menos 10 pontos de vida. Cada pudim novo tem metade dos pontos de vida do original, arredondado para baixo, e é um tamanho menor que ele.",
        "Dividirse",
        "Cuando un pudin Mediano o más grande recibe daño de relámpago o cortante, se divide en dos pudines nuevos si tiene al menos 10 puntos de golpe. Cada pudin nuevo tiene la mitad de los puntos de golpe del original, redondeando hacia abajo, y es una categoría de tamaño más pequeño.",
      ],
    },
  },
  "blink-dog": {
    lang: ["Cão Teleportador, entende Silvestre mas não fala", "Perro intermitente, entiende silvano pero no lo habla"],
    t: { "keen-hearing-and-smell": ["Audição e Olfato Aguçados", "O cão tem vantagem em testes de Sabedoria (Percepção) que dependam da audição ou do olfato.", "Oído y olfato agudos", "El perro tiene ventaja en las pruebas de Sabiduría (Percepción) que dependan del oído o del olfato."] },
    a: {
      teleport: [
        "Teletransporte",
        "O cão se teletransporta magicamente, junto com o equipamento que veste ou carrega, até 40 ft para um espaço desocupado que possa ver. Antes ou depois de se teletransportar, pode fazer um ataque de mordida.",
        "Teletransporte",
        "El perro se teletransporta mágicamente, junto con el equipo que lleve puesto o encima, hasta 40 ft a un espacio desocupado que pueda ver. Antes o después de teletransportarse, puede hacer un ataque de mordisco.",
      ],
    },
  },
  "blood-hawk": {
    t: {
      "keen-sight": ["Visão Aguçada", "O falcão tem vantagem em testes de Sabedoria (Percepção) que dependam da visão.", "Vista aguda", "El halcón tiene ventaja en las pruebas de Sabiduría (Percepción) que dependan de la vista."],
      "pack-tactics": PACK("O falcão", "do falcão", "El halcón", "del halcón"),
    },
  },
  boar: {
    t: {
      charge: [
        "Investida",
        "Se o javali se mover pelo menos 20 ft em linha reta até um alvo e o acertar com um ataque de presa no mesmo turno, o alvo sofre 3 (1d6) de dano cortante extra. Se o alvo for uma criatura, deve passar num teste de resistência de Força CD 11 ou cai.",
        "Carga",
        "Si el jabalí se mueve al menos 20 ft en línea recta hacia un objetivo y lo impacta con un ataque de colmillo en el mismo turno, el objetivo recibe 3 (1d6) de daño cortante adicional. Si el objetivo es una criatura, debe superar una tirada de salvación de Fuerza CD 11 o queda derribado.",
      ],
      "relentless-recharges-after-a-short-or-long-rest": [
        "Implacável (recarrega após descanso curto ou longo)",
        "Se o javali sofrer 7 de dano ou menos que o deixaria com 0 pontos de vida, ele fica com 1 ponto de vida em vez disso.",
        "Implacable (se recarga tras un descanso corto o largo)",
        "Si el jabalí recibe 7 de daño o menos que lo dejaría a 0 puntos de golpe, en su lugar queda con 1 punto de golpe.",
      ],
    },
  },
  "bone-devil": {
    lang: INFERNAL,
    res: ["frio; " + SILVER[0], "frío; " + SILVER[1]],
    imm: ["fogo, veneno", "fuego, veneno"],
    t: { "devils-sight": DEVIL_SIGHT, "magic-resistance": MAGIC_RES("O diabo", "El diablo") },
    a: { multiattack: ["Ataques Múltiplos", "O diabo faz três ataques: dois com as garras e um com o ferrão.", "Ataque múltiple", "El diablo hace tres ataques: dos con las garras y uno con el aguijón."] },
  },
};
