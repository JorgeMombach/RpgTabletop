// Frases que se repetem entre monstros (a partir do lote 2). Sem `export default`: o details.mjs só lê os lotes.
// Cada função devolve [nome pt, texto pt, nome es, texto es]; `pt`/`es` é o sujeito ("O diabo", "El diablo").

export const magicRes = (pt, es) => ["Resistência à Magia", `${pt} tem vantagem em testes de resistência contra magias e outros efeitos mágicos.`, "Resistencia mágica", `${es} tiene ventaja en las tiradas de salvación contra conjuros y otros efectos mágicos.`];
export const magicWeapons = (ptDe, esDe) => ["Armas Mágicas", `Os ataques com arma ${ptDe} são mágicos.`, "Armas mágicas", `Los ataques con arma ${esDe} son mágicos.`];
export const devilSight = ["Visão do Diabo", "A escuridão mágica não atrapalha a visão no escuro do diabo.", "Vista del diablo", "La oscuridad mágica no impide la visión en la oscuridad del diablo."];
export const pack = (pt, ptDe, es, esDe) => ["Táticas de Matilha", `${pt} tem vantagem nas jogadas de ataque contra uma criatura se ao menos um aliado ${ptDe} estiver a até 5 ft dela e não estiver incapacitado.`, "Tácticas de manada", `${es} tiene ventaja en las tiradas de ataque contra una criatura si al menos un aliado ${esDe} está a 5 ft o menos de ella y no está incapacitado.`];
export const keen = (sentidoPt, sentidoEs, pt, es, quaisPt, quaisEs) => [`${sentidoPt}`, `${pt} tem vantagem em testes de Sabedoria (Percepção) que dependam ${quaisPt}.`, `${sentidoEs}`, `${es} tiene ventaja en las pruebas de Sabiduría (Percepción) que dependan ${quaisEs}.`];
export const smell = (pt, es) => keen("Olfato Aguçado", "Olfato agudo", pt, es, "do olfato", "del olfato");
export const hearingSmell = (pt, es) => keen("Audição e Olfato Aguçados", "Oído y olfato agudos", pt, es, "da audição ou do olfato", "del oído o del olfato");
export const sight = (pt, es) => keen("Visão Aguçada", "Vista aguda", pt, es, "da visão", "de la vista");
export const multi = (pt, es) => ["Ataques Múltiplos", pt, "Ataque múltiple", es];
export const amphibious = (pt, es) => ["Anfíbio", `${pt} pode respirar ar e água.`, "Anfibio", `${es} puede respirar aire y agua.`];
export const falseAppearance = (pt, ptComo, es, esComo) => ["Falsa Aparência", `Enquanto fica imóvel, ${pt} é indistinguível de ${ptComo}.`, "Apariencia falsa", `Mientras permanece inmóvil, ${es} es indistinguible de ${esComo}.`];

export const NONMAGICAL = ["concussão, perfurante e cortante de ataques não mágicos", "contundente, perforante y cortante de ataques no mágicos"];
export const SILVER = ["concussão, perfurante e cortante de ataques não mágicos feitos sem armas de prata", "contundente, perforante y cortante de ataques no mágicos hechos sin armas de plata"];
export const ADAMANTINE = ["concussão, perfurante e cortante de ataques não mágicos feitos sem armas de adamante", "contundente, perforante y cortante de ataques no mágicos hechos sin armas de adamantina"];
export const INFERNAL = ["Infernal, telepatia 120 ft", "Infernal, telepatía 120 ft"];
export const ABYSSAL = ["Abissal, telepatia 120 ft", "Abisal, telepatía 120 ft"];
export const ANY_ONE = ["um idioma qualquer (geralmente Comum)", "un idioma cualquiera (normalmente común)"];
export const ALL_TELEPATHY = ["todos, telepatia 120 ft", "todos, telepatía 120 ft"];
export const FIRE_POISON = ["fogo, veneno", "fuego, veneno"];
export const POISON = ["veneno", "veneno"];
export const coldSilver = ["frio; " + SILVER[0], "frío; " + SILVER[1]];

// A partir do lote 4 (as duas primeiras vieram do lote 3).
export const feyAncestry = (pt, es) => ["Ancestralidade Feérica", `${pt} tem vantagem em testes de resistência contra ficar enfeitiçado, e magia não pode fazê-lo dormir.`, "Linaje feérico", `${es} tiene ventaja en las tiradas de salvación para no quedar hechizado, y la magia no puede dormirlo.`];
export const sunlight = (pt, es) => ["Sensibilidade à Luz Solar", `Sob a luz do sol, ${pt} tem desvantagem nas jogadas de ataque e nos testes de Sabedoria (Percepção) que dependam da visão.`, "Sensibilidad a la luz solar", `Bajo la luz del sol, ${es} tiene desventaja en las tiradas de ataque y en las pruebas de Sabiduría (Percepción) que dependan de la vista.`];
export const spiderClimb = (pt, es) => ["Escalar como Aranha", `${pt} pode escalar superfícies difíceis, inclusive de cabeça para baixo no teto, sem precisar fazer teste de habilidade.`, "Trepar cual arácnido", `${es} puede trepar por superficies difíciles, incluso boca abajo por el techo, sin necesidad de hacer una prueba de característica.`];
export const webSense = (pt, es) => ["Sentir Teias", `Em contato com uma teia, ${pt} sabe a localização exata de qualquer outra criatura em contato com a mesma teia.`, "Sentido arácnido", `Mientras está en contacto con una telaraña, ${es} conoce la ubicación exacta de cualquier otra criatura en contacto con la misma telaraña.`];
export const webWalker = (pt, es) => ["Andarilho das Teias", `${pt} ignora restrições de movimento causadas por teias.`, "Caminante de telarañas", `${es} ignora las restricciones de movimiento causadas por telarañas.`];
export const waterBreathing = (pt, es) => ["Respiração Aquática", `${pt} só consegue respirar debaixo d'água.`, "Respiración acuática", `${es} solo puede respirar bajo el agua.`];
export const holdBreath = (pt, tempoPt, es, tempoEs) => ["Prender a Respiração", `${pt} pode prender a respiração por ${tempoPt}.`, "Aguantar la respiración", `${es} puede aguantar la respiración durante ${tempoEs}.`];
export const flyby = (pt, es) => ["Voo Rasante", `${pt} não provoca ataques de oportunidade quando sai voando do alcance de um inimigo.`, "Vuelo rasante", `${es} no provoca ataques de oportunidad cuando sale volando del alcance de un enemigo.`];
export const rampage = (pt, es) => ["Massacre", `Quando ${pt} reduz uma criatura a 0 pontos de vida com um ataque corpo a corpo no seu turno, pode usar uma ação bônus para se mover até metade do deslocamento e fazer um ataque de mordida.`, "Desenfreno", `Cuando ${es} reduce a una criatura a 0 puntos de golpe con un ataque cuerpo a cuerpo en su turno, puede usar una acción adicional para moverse hasta la mitad de su velocidad y hacer un ataque de mordisco.`];
export const parry = (pt, es, n) => ["Aparar", `${pt} soma ${n} à CA contra um ataque corpo a corpo que o acertaria. Para isso, precisa ver o atacante e estar empunhando uma arma corpo a corpo.`, "Parada", `${es} suma ${n} a su CA contra un ataque cuerpo a cuerpo que lo impactaría. Para ello, debe ver al atacante y empuñar un arma cuerpo a cuerpo.`];
/** Investida: `ataquePt`/`ataqueEs` = "chifrada"/"cornada"; `danoPt`/`danoEs` = "7 (2d6) de dano cortante". */
export const charge = (pt, ataquePt, danoPt, es, ataqueEs, danoEs, cd) => [
  "Investida",
  `Se ${pt} se mover pelo menos 20 ft em linha reta até um alvo e o acertar com um ataque de ${ataquePt} no mesmo turno, o alvo sofre ${danoPt} extra. Se o alvo for uma criatura, deve passar num teste de resistência de Força CD ${cd} ou cai.`,
  "Carga",
  `Si ${es} se mueve al menos 20 ft en línea recta hacia un objetivo y lo impacta con un ataque de ${ataqueEs} en el mismo turno, el objetivo recibe ${danoEs} adicional. Si es una criatura, debe superar una tirada de salvación de Fuerza CD ${cd} o queda derribada.`,
];
export const standingLeap = (pt, es, longe, alto) => ["Salto Parado", `O salto em distância ${pt} é de até ${longe} ft e o salto em altura de até ${alto} ft, com ou sem corrida.`, "Salto sin carrerilla", `El salto de longitud ${es} es de hasta ${longe} ft y el de altura de hasta ${alto} ft, con o sin carrerilla.`];
