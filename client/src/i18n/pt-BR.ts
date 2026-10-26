/**
 * Catálogo em português: a fonte de todos os textos da interface. As chaves são agrupadas pelo lugar
 * da tela ("join.", "top."…). `{nome}` é trocado pelo valor passado a t(). Outros idiomas traduzem
 * estas mesmas chaves; o que faltar lá aparece em português.
 */
export const ptBR = {
  // Idioma
  "lang.label": "Idioma",
  "lang.tooltip": "Idioma da interface (só neste navegador)",

  // Geral
  "common.confirm": "Confirmar",
  "common.cancel": "Cancelar",
  "common.gm": "Mestre",
  "common.player": "Jogador",

  // Tela de entrada
  "join.tagline": "A mesa de combate do seu grupo",
  "join.connecting": "Conectando ao servidor…",
  "join.joiningAs": "Você vai entrar como",
  "join.roleGm": "Mestre (host)",
  "join.name": "Seu nome",
  "join.namePlaceholderGm": "Ex.: Mestre",
  "join.namePlaceholderPlayer": "Ex.: Ana",
  "join.submit": "Entrar",
  "join.error.invalidName": "Digite um nome.",
  "join.error.roomFull": "Sala cheia: o limite de jogadores foi atingido.",

  // Barra do topo
  "top.round": "Round {round}",
  "top.turnOf": " · vez de ",
  "top.yourTurn": "Sua vez!",
  "top.reconnecting": "Reconectando…",
  "top.clearField": "Limpar campo",
  "top.clearFieldTip": "Prepara o campo para a próxima batalha",
  "top.mobileLayout": "Tela de celular",
  "top.mobileLayoutTip": "Voltar para a tela de celular e tablet",
  "top.leave": "Sair",
  "top.leaveTip": "Sair da sessão ou trocar de nome. Ao voltar, você reencontra o seu personagem.",

  // Celular e tablet (E23)
  "mobile.tab.map": "Mapa",
  "mobile.tab.sheet": "Ficha",
  "mobile.tab.dice": "Dados",
  "mobile.tab.combat": "Combate",
  "mobile.sections": "Seções",
  "mobile.menu": "Menu",
  "mobile.desktopLayout": "Usar a tela de computador",

  // Atributos (siglas e nomes)
  "ability.str": "FOR",
  "ability.dex": "DES",
  "ability.con": "CON",
  "ability.int": "INT",
  "ability.wis": "SAB",
  "ability.cha": "CAR",
  "ability.str.name": "Força",
  "ability.dex.name": "Destreza",
  "ability.con.name": "Constituição",
  "ability.int.name": "Inteligência",
  "ability.wis.name": "Sabedoria",
  "ability.cha.name": "Carisma",

  // Formulário de combatente
  "form.name": "Nome",
  "form.hpMax": "Vida máx.",
  "form.hpMaxTitle": "Vida máxima (pontos de vida)",
  "form.ac": "CA",
  "form.acTitle": "Classe de armadura",
  "form.init": "Inic.",
  "form.initTitle": "Bônus de iniciativa (d20 + este valor). Com Destreza preenchida, acompanha o modificador dela até você mudar à mão.",
  "form.abilities": "Atributos (opcional)",
  "form.abilitiesHint": "Valor do atributo; o modificador aparece ao lado (10 = +0, 12 = +1, 20 = +5).",
  "form.color": "Cor",
  "form.animal": "Animal",
  "form.animalTip": "Mostra uma pata no token e na lista. O formato continua dizendo o lado (aliado, inimigo ou neutro).",
  "form.hidden": "Já entra oculto",
  "form.hiddenTip": "Só você vê (furtividade, sala escura); fica fora da iniciativa até você revelar",
  "form.notes": "Notas (opcional)",
  "form.size": "Tamanho",
  "form.sizeTip": "Quantas casas ocupa no mapa: Grande 2×2, Enorme 3×3, Imenso 4×4. Miúdo divide a casa com outros.",
  "size.tiny": "Miúdo (divide a casa)",
  "size.small": "Pequeno (1×1)",
  "size.medium": "Médio (1×1)",
  "size.large": "Grande (2×2)",
  "size.huge": "Enorme (3×3)",
  "size.gargantuan": "Imenso (4×4)",

  // Ficha: CA e atributos
  "stats.acTitle": "Classe de armadura",
  "stats.noAcTitle": "Classe de armadura ainda não informada: use Editar",
  "stats.roll": "Rolar teste de {ability}: d20 {mod}",
} as const;

export type MessageKey = keyof typeof ptBR;
export type Messages = Record<MessageKey, string>;
