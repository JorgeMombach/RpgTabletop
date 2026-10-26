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
} as const;

export type MessageKey = keyof typeof ptBR;
export type Messages = Record<MessageKey, string>;
