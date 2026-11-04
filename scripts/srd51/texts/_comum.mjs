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
