// Lote 5 das habilidades (Passo 12, fase C): Bode a Orca. Formato em scripts/srd51/details.mjs.
import { ABYSSAL, ADAMANTINE, amphibious, ANY_ONE, charge, coldSilver, devilSight, FIRE_POISON, hearingSmell, holdBreath, INFERNAL, keen, magicRes, magicWeapons, multi, NONMAGICAL, pack, POISON, sight, SILVER, waterBreathing } from "./_comum.mjs";

const SURE_FOOTED = (pt, es) => ["Passo Firme", `${pt} tem vantagem em testes de resistência de Força e Destreza contra efeitos que o derrubariam.`, "Pies firmes", `${es} tiene ventaja en las tiradas de salvación de Fuerza y Destreza contra efectos que la derribarían.`];
const STONE_CAMO = (pt, es) => ["Camuflagem nas Pedras", `${pt} tem vantagem em testes de Destreza (Furtividade) para se esconder em terreno rochoso.`, "Camuflaje en la piedra", `${es} tiene ventaja en las pruebas de Destreza (Sigilo) para esconderse en terreno rocoso.`];
const BLOOD_FRENZY = ["Frenesi Sanguinário", "O tubarão tem vantagem nas jogadas de ataque corpo a corpo contra qualquer criatura que não esteja com todos os pontos de vida.", "Frenesí sanguinario", "El tiburón tiene ventaja en las tiradas de ataque cuerpo a cuerpo contra cualquier criatura que no tenga todos sus puntos de golpe."];
const ECHO = ["Ecolocalização", "A orca não pode usar a percepção às cegas enquanto estiver surda.", "Ecolocalización", "La orca no puede usar su vista ciega mientras esté ensordecida."];
const CREATOR_LANG = ["entende os idiomas do seu criador mas não fala", "entiende los idiomas de su creador pero no habla"];
const DEMON_RES = ["frio, fogo, elétrico; " + NONMAGICAL[0], "frío, fuego, relámpago; " + NONMAGICAL[1]];

export default {
  goat: {
    t: {
      charge: charge("o bode", "cabeçada", "2 (1d4) de dano de concussão", "la cabra", "embestida", "2 (1d4) de daño contundente", 10),
      "sure-footed": SURE_FOOTED("O bode", "La cabra"),
    },
  },
  goblin: {
    lang: ["Comum, Goblin", "Común, goblin"],
    t: { "nimble-escape": ["Fuga Ágil", "O goblin pode usar a ação Desengajar ou Esconder como ação bônus em cada um dos seus turnos.", "Huida ágil", "El goblin puede usar la acción de Destrabarse o Esconderse como acción adicional en cada uno de sus turnos."] },
  },
  gorgon: {
    t: {
      "trampling-charge": [
        "Investida Atropeladora",
        "Se a górgona se mover pelo menos 20 ft em linha reta até uma criatura e a acertar com um ataque de chifrada no mesmo turno, o alvo deve passar num teste de resistência de Força CD 16 ou cai. Se o alvo estiver caído, a górgona pode fazer um ataque de cascos contra ele como ação bônus.",
        "Carga arrolladora",
        "Si la gorgona se mueve al menos 20 ft en línea recta hacia una criatura y la impacta con un ataque de cornada en el mismo turno, el objetivo debe superar una tirada de salvación de Fuerza CD 16 o queda derribado. Si el objetivo está derribado, la gorgona puede hacer un ataque de pezuñas contra él como acción adicional.",
      ],
    },
    a: {
      "petrifying-breath": [
        "Sopro Petrificante",
        "A górgona exala um gás petrificante num cone de 30 ft. Cada criatura na área deve passar num teste de resistência de Constituição CD 13. Se falhar, o alvo começa a virar pedra e fica impedido. O alvo impedido deve repetir o teste ao fim do seu próximo turno. Se passar, o efeito acaba. Se falhar, fica petrificado até ser libertado pela magia restauração maior ou outra magia.",
        "Aliento petrificador",
        "La gorgona exhala gas petrificador en un cono de 30 ft. Cada criatura en esa área debe superar una tirada de salvación de Constitución CD 13. Si falla, el objetivo empieza a convertirse en piedra y queda apresado. El objetivo apresado debe repetir la tirada al final de su siguiente turno. Si la supera, el efecto termina. Si falla, queda petrificado hasta que lo libere el conjuro restablecimiento mayor u otra magia.",
      ],
    },
  },
  "gray-ooze": {
    res: ["ácido, frio, fogo", "ácido, frío, fuego"],
    t: {
      amorphous: ["Amorfo", "O limo pode passar por um espaço de apenas 2,5 cm de largura sem se espremer.", "Amorfo", "El cieno puede pasar por un espacio de solo 2,5 cm de ancho sin apretarse."],
      "corrode-metal": [
        "Corroer Metal",
        "Qualquer arma não mágica de metal que acerte o limo é corroída. Depois de causar o dano, a arma sofre uma penalidade permanente e cumulativa de -1 nas jogadas de dano. Se a penalidade chegar a -5, a arma é destruída. Munição não mágica de metal que acerte o limo é destruída depois de causar o dano.\nO limo consegue corroer 5 cm de metal não mágico em 1 rodada.",
        "Corroer metal",
        "Cualquier arma no mágica de metal que impacte al cieno se corroe. Tras infligir el daño, el arma sufre un penalizador permanente y acumulativo de -1 a las tiradas de daño. Si el penalizador llega a -5, el arma se destruye. La munición no mágica de metal que impacte al cieno se destruye tras infligir el daño.\nEl cieno puede corroer 5 cm de metal no mágico en 1 asalto.",
      ],
      "false-appearance": ["Falsa Aparência", "Enquanto fica imóvel, o limo é indistinguível de uma poça oleosa ou de uma pedra molhada.", "Apariencia falsa", "Mientras permanece inmóvil, el cieno es indistinguible de un charco aceitoso o de una roca mojada."],
    },
  },
  "green-hag": {
    lang: ["Comum, Dracônico, Silvestre", "Común, dracónico, silvano"],
    t: {
      amphibious: amphibious("A bruxa", "La saga"),
      "innate-spellcasting": [
        "Conjuração Inata",
        "A habilidade de conjuração inata da bruxa é Carisma (CD de resistência de magia 12). Ela pode conjurar as seguintes magias de forma inata, sem precisar de componentes materiais:\n\nÀ vontade: luzes dançantes, ilusão menor, zombaria viciosa",
        "Lanzamiento de conjuros innato",
        "La aptitud mágica innata de la saga es Carisma (CD de salvación de conjuros 12). Puede lanzar de forma innata los siguientes conjuros sin necesidad de componentes materiales:\n\nA voluntad: luces danzantes, ilusión menor, burla cruel",
      ],
      mimicry: ["Imitação", "A bruxa pode imitar sons de animais e vozes de humanoides. Quem ouvir os sons percebe que são imitações se passar num teste de Sabedoria (Intuição) CD 14.", "Imitación", "La saga puede imitar sonidos de animales y voces de humanoides. Quien oiga los sonidos se da cuenta de que son imitaciones si supera una prueba de Sabiduría (Perspicacia) CD 14."],
    },
    a: {
      "illusory-appearance": [
        "Aparência Ilusória",
        "A bruxa cobre a si mesma e tudo o que veste ou carrega com uma ilusão mágica que a faz parecer outra criatura de tamanho parecido e forma humanoide. A ilusão acaba se a bruxa usar uma ação bônus para encerrá-la ou se morrer.\nAs mudanças não resistem a um exame físico. Por exemplo, a bruxa pode parecer ter a pele lisa, mas quem a tocar sente a pele áspera. Fora isso, uma criatura precisa usar uma ação para examinar a ilusão e passar num teste de Inteligência (Investigação) CD 20 para perceber que a bruxa está disfarçada.",
        "Apariencia ilusoria",
        "La saga se cubre a sí misma y todo lo que lleva puesto o encima con una ilusión mágica que la hace parecer otra criatura de tamaño similar y forma humanoide. La ilusión termina si la saga usa una acción adicional para terminarla o si muere.\nLos cambios no resisten un examen físico. Por ejemplo, la saga puede parecer tener la piel lisa, pero quien la toque notará su piel áspera. Por lo demás, una criatura debe usar una acción para examinar la ilusión y superar una prueba de Inteligencia (Investigación) CD 20 para darse cuenta de que la saga está disfrazada.",
      ],
      "invisible-passage": [
        "Passagem Invisível",
        "A bruxa fica magicamente invisível até atacar ou conjurar uma magia, ou até a concentração acabar (como se concentrasse numa magia). Invisível, não deixa rastros físicos da passagem, então só pode ser rastreada por magia. O equipamento que veste ou carrega fica invisível junto.",
        "Paso invisible",
        "La saga se vuelve invisible mágicamente hasta que ataca o lanza un conjuro, o hasta que termina su concentración (como si se concentrara en un conjuro). Mientras es invisible, no deja rastro físico de su paso, así que solo se la puede rastrear con magia. El equipo que lleve puesto o encima se vuelve invisible con ella.",
      ],
    },
  },
  grick: {
    res: NONMAGICAL,
    t: { "stone-camouflage": STONE_CAMO("O grick", "El grick") },
    a: { multiattack: multi("O grick faz um ataque com os tentáculos. Se acertar, pode fazer um ataque de bico contra o mesmo alvo.", "El grick hace un ataque con sus tentáculos. Si impacta, puede hacer un ataque de pico contra el mismo objetivo.") },
  },
  griffon: {
    t: { "keen-sight": sight("O grifo", "El grifo") },
    a: { multiattack: multi("O grifo faz dois ataques: um de bico e um de garras.", "El grifo hace dos ataques: uno de pico y otro de garras.") },
  },
  grimlock: {
    lang: ["Dialeto Subterrâneo", "Infracomún"],
    t: {
      "blind-senses": ["Sentidos Cegos", "O grimlock não pode usar a percepção às cegas enquanto estiver surdo e sem olfato.", "Sentidos ciegos", "El grimlock no puede usar su vista ciega mientras esté ensordecido y sin olfato."],
      "keen-hearing-and-smell": hearingSmell("O grimlock", "El grimlock"),
      "stone-camouflage": STONE_CAMO("O grimlock", "El grimlock"),
    },
  },
  guard: { lang: ANY_ONE },
  "guardian-naga": {
    lang: ["Celestial, Comum", "Celestial, común"],
    imm: POISON,
    t: {
      rejuvenation: ["Rejuvenescer", "Se morrer, a naga volta à vida em 1d6 dias e recupera todos os pontos de vida. Só a magia desejo pode impedir que este traço funcione.", "Rejuvenecimiento", "Si muere, la naga vuelve a la vida en 1d6 días y recupera todos sus puntos de golpe. Solo el conjuro deseo puede impedir que este rasgo funcione."],
      spellcasting: [
        "Conjuração",
        "A naga é uma conjuradora de 11º nível. Sua habilidade de conjuração é Sabedoria (CD de resistência de magia 16, +8 para acertar com ataques de magia), e ela só precisa de componentes verbais para conjurar. Tem as seguintes magias de clérigo preparadas:\n\n* Truques (à vontade): consertar, chama sagrada, taumaturgia\n* 1º nível (4 espaços): comando, curar ferimentos, escudo da fé\n* 2º nível (3 espaços): acalmar emoções, imobilizar pessoa\n* 3º nível (3 espaços): rogar maldição, clarividência\n* 4º nível (3 espaços): banimento, movimentação livre\n* 5º nível (2 espaços): coluna de chamas, missão\n* 6º nível (1 espaço): visão da verdade",
        "Lanzamiento de conjuros",
        "La naga es una lanzadora de conjuros de nivel 11. Su aptitud mágica es Sabiduría (CD de salvación de conjuros 16, +8 al ataque con conjuros), y solo necesita componentes verbales para lanzar sus conjuros. Tiene preparados los siguientes conjuros de clérigo:\n\n* Trucos (a voluntad): reparar, llama sagrada, taumaturgia\n* Nivel 1 (4 espacios): orden imperiosa, curar heridas, escudo de fe\n* Nivel 2 (3 espacios): calmar emociones, inmovilizar persona\n* Nivel 3 (3 espacios): imponer maldición, clarividencia\n* Nivel 4 (3 espacios): destierro, libertad de movimiento\n* Nivel 5 (2 espacios): descarga flamígera, geas\n* Nivel 6 (1 espacio): visión verdadera",
      ],
    },
  },
  gynosphinx: {
    lang: ["Comum, Esfinge", "Común, esfinge"],
    res: NONMAGICAL,
    imm: ["psíquico", "psíquico"],
    t: {
      inscrutable: [
        "Inescrutável",
        "A esfinge é imune a qualquer efeito que perceba suas emoções ou leia seus pensamentos, e a qualquer magia de adivinhação que ela recuse. Testes de Sabedoria (Intuição) para descobrir as intenções ou a sinceridade da esfinge têm desvantagem.",
        "Inescrutable",
        "La esfinge es inmune a cualquier efecto que perciba sus emociones o lea sus pensamientos, y a cualquier conjuro de adivinación que rechace. Las pruebas de Sabiduría (Perspicacia) para averiguar las intenciones o la sinceridad de la esfinge tienen desventaja.",
      ],
      "magic-weapons": magicWeapons("da esfinge", "de la esfinge"),
      spellcasting: [
        "Conjuração",
        "A esfinge é uma conjuradora de 9º nível. Sua habilidade de conjuração é Inteligência (CD de resistência de magia 16, +8 para acertar com ataques de magia). Não precisa de componentes materiais para conjurar. Tem as seguintes magias de mago preparadas:\n\n* Truques (à vontade): mãos mágicas, ilusão menor, prestidigitação\n* 1º nível (4 espaços): detectar magia, identificação, escudo arcano\n* 2º nível (3 espaços): escuridão, localizar objeto, sugestão\n* 3º nível (3 espaços): dissipar magia, remover maldição, idiomas\n* 4º nível (3 espaços): banimento, invisibilidade maior\n* 5º nível (1 espaço): conhecimento lendário",
        "Lanzamiento de conjuros",
        "La esfinge es una lanzadora de conjuros de nivel 9. Su aptitud mágica es Inteligencia (CD de salvación de conjuros 16, +8 al ataque con conjuros). No necesita componentes materiales para lanzar sus conjuros. Tiene preparados los siguientes conjuros de mago:\n\n* Trucos (a voluntad): mano de mago, ilusión menor, prestidigitación\n* Nivel 1 (4 espacios): detectar magia, identificar, escudo\n* Nivel 2 (3 espacios): oscuridad, localizar objeto, sugestión\n* Nivel 3 (3 espacios): disipar magia, levantar maldición, don de lenguas\n* Nivel 4 (3 espacios): destierro, invisibilidad mayor\n* Nivel 5 (1 espacio): conocimiento de leyendas",
      ],
    },
    a: {
      "cast-a-spell": ["Conjurar Magia", "A esfinge conjura uma magia da sua lista de magias preparadas, gastando um espaço de magia normalmente.", "Lanzar un conjuro", "La esfinge lanza un conjuro de su lista de conjuros preparados, gastando un espacio de conjuro de la forma normal."],
      "claw-attack": ["Ataque de Garras", "A esfinge faz um ataque de garras.", "Ataque de garras", "La esfinge hace un ataque de garras."],
      multiattack: multi("A esfinge faz dois ataques de garras.", "La esfinge hace dos ataques de garras."),
      teleport: ["Teletransporte", "A esfinge se teletransporta magicamente, com todo o equipamento que veste ou carrega, até 120 ft para um espaço desocupado que possa ver.", "Teletransporte", "La esfinge se teletransporta mágicamente, con todo el equipo que lleve puesto o encima, hasta 120 ft a un espacio desocupado que pueda ver."],
    },
  },
  harpy: {
    lang: ["Comum", "Común"],
    a: {
      "luring-song": [
        "Canção Sedutora",
        "A harpia canta uma melodia mágica. Cada humanoide e gigante a até 300 ft da harpia que possa ouvir a canção deve passar num teste de resistência de Sabedoria CD 11 ou fica enfeitiçado até a canção acabar. A harpia precisa usar uma ação bônus nos turnos seguintes para continuar cantando. Pode parar quando quiser. A canção acaba se a harpia ficar incapacitada.\nEnfeitiçado pela harpia, o alvo fica incapacitado e ignora a canção de outras harpias. Se estiver a mais de 5 ft da harpia, deve se mover no seu turno na direção dela pelo caminho mais direto. Não evita ataques de oportunidade, mas antes de entrar em terreno que cause dano, como lava ou um fosso, e sempre que sofrer dano de algo que não seja a harpia, pode repetir o teste de resistência. Também pode repetir o teste ao fim de cada um dos seus turnos. Se passar, o efeito acaba para ele.\nQuem passar no teste fica imune à canção desta harpia pelas próximas 24 horas.",
        "Canción seductora",
        "La arpía canta una melodía mágica. Cada humanoide y gigante a 300 ft o menos de la arpía que pueda oír la canción debe superar una tirada de salvación de Sabiduría CD 11 o queda hechizado hasta que termine la canción. La arpía debe usar una acción adicional en sus turnos siguientes para seguir cantando. Puede dejar de cantar cuando quiera. La canción termina si la arpía queda incapacitada.\nMientras está hechizado por la arpía, el objetivo está incapacitado e ignora las canciones de otras arpías. Si está a más de 5 ft de la arpía, debe moverse en su turno hacia ella por el camino más directo. No evita los ataques de oportunidad, pero antes de entrar en terreno que inflija daño, como lava o un foso, y cada vez que reciba daño de algo que no sea la arpía, puede repetir la tirada de salvación. También puede repetirla al final de cada uno de sus turnos. Si la supera, el efecto termina para él.\nQuien supere la tirada es inmune a la canción de esta arpía durante las siguientes 24 horas.",
      ],
      multiattack: multi("A harpia faz dois ataques: um de garras e um de clava.", "La arpía hace dos ataques: uno de garras y otro de garrote."),
    },
  },
  hawk: { t: { "keen-sight": sight("O falcão", "El halcón") } },
  "hell-hound": {
    lang: ["entende Infernal mas não fala", "entiende infernal pero no lo habla"],
    imm: ["fogo", "fuego"],
    t: { "keen-hearing-and-smell": hearingSmell("O cão", "El perro"), "pack-tactics": pack("O cão", "do cão", "El perro", "del perro") },
    a: {
      "fire-breath": [
        "Sopro de Fogo",
        "O cão exala fogo num cone de 15 ft. Cada criatura na área deve fazer um teste de resistência de Destreza CD 12. Se falhar, sofre 21 (6d6) de dano de fogo; se passar, metade.",
        "Aliento de fuego",
        "El perro exhala fuego en un cono de 15 ft. Cada criatura en esa área debe hacer una tirada de salvación de Destreza CD 12. Si falla, recibe 21 (6d6) de daño de fuego; si la supera, la mitad.",
      ],
    },
  },
  hezrou: {
    lang: ABYSSAL,
    res: DEMON_RES,
    imm: POISON,
    t: {
      "magic-resistance": magicRes("O hezrou", "El hezrou"),
      stench: [
        "Fedor",
        "Qualquer criatura que comece o turno a até 10 ft do hezrou deve passar num teste de resistência de Constituição CD 14 ou fica envenenada até o início do seu próximo turno. Se passar, fica imune ao fedor do hezrou por 24 horas.",
        "Hedor",
        "Cualquier criatura que empiece su turno a 10 ft o menos del hezrou debe superar una tirada de salvación de Constitución CD 14 o queda envenenada hasta el principio de su siguiente turno. Si la supera, es inmune al hedor del hezrou durante 24 horas.",
      ],
    },
    a: { multiattack: multi("O hezrou faz três ataques: um de mordida e dois de garras.", "El hezrou hace tres ataques: uno de mordisco y dos de garras.") },
  },
  "hill-giant": { lang: ["Gigante", "Gigante"], a: { multiattack: multi("O gigante faz dois ataques de clava grande.", "El gigante hace dos ataques de gran garrote.") } },
  hippogriff: {
    t: { "keen-sight": sight("O hipogrifo", "El hipogrifo") },
    a: { multiattack: multi("O hipogrifo faz dois ataques: um de bico e um de garras.", "El hipogrifo hace dos ataques: uno de pico y otro de garras.") },
  },
  hobgoblin: {
    lang: ["Comum, Goblin", "Común, goblin"],
    t: {
      "martial-advantage": [
        "Vantagem Marcial",
        "Uma vez por turno, o hobgoblin pode causar 7 (2d6) de dano extra a uma criatura que acerte com um ataque com arma, se ela estiver a até 5 ft de um aliado do hobgoblin que não esteja incapacitado.",
        "Ventaja marcial",
        "Una vez por turno, el hobgoblin puede infligir 7 (2d6) de daño adicional a una criatura a la que impacte con un ataque con arma, si está a 5 ft o menos de un aliado del hobgoblin que no esté incapacitado.",
      ],
    },
  },
  homunculus: {
    lang: CREATOR_LANG,
    imm: POISON,
    t: {
      "telepathic-bond": [
        "Vínculo Telepático",
        "Enquanto estiver no mesmo plano de existência que o seu mestre, o homúnculo pode transmitir magicamente a ele o que percebe, e os dois podem se comunicar por telepatia.",
        "Vínculo telepático",
        "Mientras esté en el mismo plano de existencia que su amo, el homúnculo puede transmitirle mágicamente lo que percibe, y los dos pueden comunicarse telepáticamente.",
      ],
    },
  },
  "horned-devil": {
    lang: INFERNAL,
    res: coldSilver,
    imm: FIRE_POISON,
    t: { "devils-sight": devilSight, "magic-resistance": magicRes("O diabo", "El diablo") },
    a: {
      multiattack: multi(
        "O diabo faz três ataques corpo a corpo: dois de forcado e um de cauda. Pode usar Arremessar Chama no lugar de qualquer ataque corpo a corpo.",
        "El diablo hace tres ataques cuerpo a cuerpo: dos de horca y uno de cola. Puede usar Arrojar llama en lugar de cualquier ataque cuerpo a cuerpo.",
      ),
    },
  },
  "hunter-shark": { t: { "blood-frenzy": BLOOD_FRENZY, "water-breathing": waterBreathing("O tubarão", "El tiburón") } },
  hydra: {
    t: {
      "hold-breath": holdBreath("A hidra", "1 hora", "La hidra", "1 hora"),
      "multiple-heads": [
        "Várias Cabeças",
        "A hidra tem cinco cabeças. Enquanto tiver mais de uma, tem vantagem em testes de resistência contra ficar cega, enfeitiçada, surda, amedrontada, atordoada ou inconsciente.\nSempre que a hidra sofre 25 de dano ou mais num único turno, uma das cabeças morre. Se todas as cabeças morrerem, a hidra morre.\nNo fim do seu turno, nascem duas cabeças para cada uma que morreu desde o seu último turno, a menos que tenha sofrido dano de fogo desde o último turno. A hidra recupera 10 pontos de vida para cada cabeça que nasce assim.",
        "Múltiples cabezas",
        "La hidra tiene cinco cabezas. Mientras tenga más de una, tiene ventaja en las tiradas de salvación para no quedar cegada, hechizada, ensordecida, asustada, aturdida ni inconsciente.\nCada vez que la hidra recibe 25 de daño o más en un solo turno, una de sus cabezas muere. Si mueren todas, la hidra muere.\nAl final de su turno, le crecen dos cabezas por cada una que haya muerto desde su último turno, salvo que haya recibido daño de fuego desde su último turno. La hidra recupera 10 puntos de golpe por cada cabeza que le crezca así.",
      ],
      "reactive-heads": ["Cabeças Reativas", "Para cada cabeça além da primeira, a hidra ganha uma reação extra que só pode ser usada em ataques de oportunidade.", "Cabezas reactivas", "Por cada cabeza que tenga además de la primera, la hidra obtiene una reacción adicional que solo puede usar para ataques de oportunidad."],
      wakeful: ["Sempre Alerta", "Enquanto a hidra dorme, pelo menos uma das cabeças está acordada.", "Siempre alerta", "Mientras la hidra duerme, al menos una de sus cabezas está despierta."],
    },
    a: { multiattack: multi("A hidra faz tantos ataques de mordida quanto o número de cabeças que tem.", "La hidra hace tantos ataques de mordisco como cabezas tenga.") },
  },
  hyena: { t: { "pack-tactics": pack("A hiena", "da hiena", "La hiena", "de la hiena") } },
  "ice-devil": {
    lang: INFERNAL,
    res: SILVER,
    imm: FIRE_POISON,
    t: { "devils-sight": devilSight, "magic-resistance": magicRes("O diabo", "El diablo") },
    a: {
      multiattack: multi("O diabo faz três ataques: um de mordida, um de garras e um de cauda.", "El diablo hace tres ataques: uno de mordisco, otro de garras y otro de cola."),
      "wall-of-ice": [
        "Muralha de Gelo",
        "O diabo cria magicamente uma muralha opaca de gelo numa superfície sólida que possa ver a até 60 ft. A muralha tem 30 cm de espessura e até 30 ft de comprimento e 10 ft de altura, ou é uma cúpula de até 20 ft de diâmetro.\nQuando a muralha aparece, cada criatura no espaço dela é empurrada para fora pelo caminho mais curto. A criatura escolhe de que lado da muralha fica, a menos que esteja incapacitada. Depois faz um teste de resistência de Destreza CD 17. Se falhar, sofre 35 (10d6) de dano de frio; se passar, metade.\nA muralha dura 1 minuto ou até o diabo ficar incapacitado ou morrer. Ela pode ser danificada e rompida; cada seção de 10 ft tem CA 5, 30 pontos de vida, vulnerabilidade a dano de fogo e imunidade a dano de ácido, frio, necrótico, veneno e psíquico. Se uma seção for destruída, deixa no lugar uma camada de ar gelado. Sempre que uma criatura termina de atravessar o ar gelado num turno, por vontade própria ou não, deve fazer um teste de resistência de Constituição CD 17. Se falhar, sofre 17 (5d6) de dano de frio; se passar, metade. O ar gelado some quando o resto da muralha desaparece.",
        "Muro de hielo",
        "El diablo crea mágicamente un muro opaco de hielo sobre una superficie sólida que pueda ver a 60 ft o menos. El muro tiene 30 cm de grosor y hasta 30 ft de largo y 10 ft de alto, o es una cúpula de hasta 20 ft de diámetro.\nCuando el muro aparece, cada criatura en su espacio es empujada fuera de él por el camino más corto. La criatura elige a qué lado del muro queda, salvo que esté incapacitada. Después hace una tirada de salvación de Destreza CD 17. Si falla, recibe 35 (10d6) de daño de frío; si la supera, la mitad.\nEl muro dura 1 minuto o hasta que el diablo quede incapacitado o muera. Puede dañarse y romperse; cada sección de 10 ft tiene CA 5, 30 puntos de golpe, vulnerabilidad al daño de fuego e inmunidad al daño de ácido, frío, necrótico, veneno y psíquico. Si se destruye una sección, deja en su lugar una capa de aire gélido. Cada vez que una criatura termina de atravesar el aire gélido en un turno, voluntariamente o no, debe hacer una tirada de salvación de Constitución CD 17. Si falla, recibe 17 (5d6) de daño de frío; si la supera, la mitad. El aire gélido desaparece cuando se desvanece el resto del muro.",
      ],
    },
  },
  "ice-mephit": {
    lang: ["Aquan, Auran", "Acuano, aurano"],
    imm: ["frio, veneno", "frío, veneno"],
    vul: ["concussão, fogo", "contundente, fuego"],
    t: {
      "death-burst": [
        "Explosão Mortal",
        "Quando o mefite morre, explode numa rajada de gelo cortante. Cada criatura a até 5 ft dele deve fazer um teste de resistência de Destreza CD 10. Se falhar, sofre 4 (1d8) de dano cortante; se passar, metade.",
        "Estallido mortal",
        "Cuando el mefítico muere, estalla en una ráfaga de hielo afilado. Cada criatura a 5 ft o menos de él debe hacer una tirada de salvación de Destreza CD 10. Si falla, recibe 4 (1d8) de daño cortante; si la supera, la mitad.",
      ],
      "false-appearance": ["Falsa Aparência", "Enquanto fica imóvel, o mefite é indistinguível de um caco de gelo comum.", "Apariencia falsa", "Mientras permanece inmóvil, el mefítico es indistinguible de un fragmento de hielo normal."],
      "innate-spellcasting-1day": [
        "Conjuração Inata (1/dia)",
        "O mefite pode conjurar *névoa obscurecente* de forma inata, sem precisar de componentes materiais. Sua habilidade de conjuração inata é Carisma.",
        "Lanzamiento de conjuros innato (1/día)",
        "El mefítico puede lanzar *nube de niebla* de forma innata, sin necesidad de componentes materiales. Su aptitud mágica innata es Carisma.",
      ],
    },
    a: {
      "frost-breath": [
        "Sopro Gélido",
        "O mefite exala um cone de 15 ft de ar frio. Cada criatura na área deve fazer um teste de resistência de Destreza CD 10. Se falhar, sofre 5 (2d4) de dano de frio; se passar, metade.",
        "Aliento gélido",
        "El mefítico exhala un cono de 15 ft de aire frío. Cada criatura en esa área debe hacer una tirada de salvación de Destreza CD 10. Si falla, recibe 5 (2d4) de daño de frío; si la supera, la mitad.",
      ],
    },
  },
  imp: {
    lang: ["Infernal, Comum", "Infernal, común"],
    res: coldSilver,
    imm: FIRE_POISON,
    t: {
      "devils-sight": ["Visão do Diabo", "A escuridão mágica não atrapalha a visão no escuro do diabrete.", "Vista del diablo", "La oscuridad mágica no impide la visión en la oscuridad del diablillo."],
      "magic-resistance": magicRes("O diabrete", "El diablillo"),
      shapechanger: [
        "Metamorfo",
        "O diabrete pode usar a ação para se transformar numa fera parecida com um rato (deslocamento 20 ft), um corvo (20 ft, voo 60 ft) ou uma aranha (20 ft, escalada 20 ft), ou voltar à forma verdadeira. As estatísticas são as mesmas em todas as formas, exceto pelas mudanças de deslocamento. O equipamento que veste ou carrega não se transforma. Volta à forma verdadeira se morrer.",
        "Cambiaformas",
        "El diablillo puede usar su acción para transformarse en una bestia parecida a una rata (velocidad 20 ft), un cuervo (20 ft, volando 60 ft) o una araña (20 ft, trepando 20 ft), o volver a su forma verdadera. Sus estadísticas son las mismas en todas las formas, salvo los cambios de velocidad. El equipo que lleve puesto o encima no se transforma. Vuelve a su forma verdadera si muere.",
      ],
    },
    a: {
      invisibility: [
        "Invisibilidade",
        "O diabrete fica magicamente invisível até atacar ou até a concentração acabar (como se concentrasse numa magia). O equipamento que veste ou carrega fica invisível junto.",
        "Invisibilidad",
        "El diablillo se vuelve invisible mágicamente hasta que ataca o hasta que termina su concentración (como si se concentrara en un conjuro). El equipo que lleve puesto o encima se vuelve invisible con él.",
      ],
    },
  },
  "invisible-stalker": {
    lang: ["Auran; entende Comum mas não fala", "Aurano; entiende común pero no lo habla"],
    res: NONMAGICAL,
    imm: POISON,
    t: {
      "faultless-tracker": [
        "Rastreador Infalível",
        "Quem invoca o perseguidor lhe dá uma presa. O perseguidor sabe a direção e a distância até a presa enquanto os dois estiverem no mesmo plano de existência. Também sabe onde está quem o invocou.",
        "Rastreador infalible",
        "Quien invoca al acechador le asigna una presa. El acechador conoce la dirección y la distancia hasta su presa mientras ambos estén en el mismo plano de existencia. También sabe dónde está quien lo invocó.",
      ],
      invisibility: ["Invisibilidade", "O perseguidor é invisível.", "Invisibilidad", "El acechador es invisible."],
    },
    a: { multiattack: multi("O perseguidor faz dois ataques de pancada.", "El acechador hace dos ataques de golpe.") },
  },
  "iron-golem": {
    lang: CREATOR_LANG,
    imm: ["fogo, veneno, psíquico; " + ADAMANTINE[0], "fuego, veneno, psíquico; " + ADAMANTINE[1]],
    t: {
      "fire-absorption": [
        "Absorção de Fogo",
        "Sempre que o golem sofreria dano de fogo, ele não sofre o dano e recupera pontos de vida iguais ao dano de fogo causado.",
        "Absorción de fuego",
        "Cada vez que el gólem fuera a recibir daño de fuego, no recibe el daño y recupera tantos puntos de golpe como el daño de fuego infligido.",
      ],
      "immutable-form": ["Forma Imutável", "O golem é imune a qualquer magia ou efeito que alteraria sua forma.", "Forma inmutable", "El gólem es inmune a cualquier conjuro o efecto que fuera a alterar su forma."],
      "magic-resistance": magicRes("O golem", "El gólem"),
      "magic-weapons": magicWeapons("do golem", "del gólem"),
    },
    a: {
      multiattack: multi("O golem faz dois ataques corpo a corpo.", "El gólem hace dos ataques cuerpo a cuerpo."),
      "poison-breath": [
        "Sopro Venenoso",
        "O golem exala gás venenoso num cone de 15 ft. Cada criatura na área deve fazer um teste de resistência de Constituição CD 19. Se falhar, sofre 45 (10d8) de dano de veneno; se passar, metade.",
        "Aliento venenoso",
        "El gólem exhala gas venenoso en un cono de 15 ft. Cada criatura en esa área debe hacer una tirada de salvación de Constitución CD 19. Si falla, recibe 45 (10d8) de daño de veneno; si la supera, la mitad.",
      ],
    },
  },
  jackal: { t: { "keen-hearing-and-smell": hearingSmell("O chacal", "El chacal"), "pack-tactics": pack("O chacal", "do chacal", "El chacal", "del chacal") } },
  "killer-whale": {
    t: {
      echolocation: ECHO,
      "hold-breath": holdBreath("A orca", "30 minutos", "La orca", "30 minutos"),
      "keen-hearing": keen("Audição Aguçada", "Oído agudo", "A orca", "La orca", "da audição", "del oído"),
    },
  },
};
