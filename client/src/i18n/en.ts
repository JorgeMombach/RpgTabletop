import type { Messages } from "./pt-BR";

/** Inglês. Chave que faltar aparece em português. */
export const en: Partial<Messages> = {
  "lang.label": "Language",
  "lang.tooltip": "Interface language (this browser only)",

  "common.confirm": "Confirm",
  "common.cancel": "Cancel",
  "common.gm": "Game Master",
  "common.player": "Player",

  "join.tagline": "Your group's combat table",
  "join.connecting": "Connecting to the server…",
  "join.joiningAs": "You will join as",
  "join.roleGm": "Game Master (host)",
  "join.name": "Your name",
  "join.namePlaceholderGm": "E.g.: Game Master",
  "join.namePlaceholderPlayer": "E.g.: Anna",
  "join.submit": "Join",
  "join.error.invalidName": "Type a name.",
  "join.error.roomFull": "The room is full: the player limit has been reached.",

  "top.round": "Round {round}",
  "top.turnOf": " · turn of ",
  "top.yourTurn": "Your turn!",
  "top.reconnecting": "Reconnecting…",
  "top.clearField": "Clear field",
  "top.clearFieldTip": "Gets the field ready for the next battle",
  "top.mobileLayout": "Phone layout",
  "top.mobileLayoutTip": "Back to the phone and tablet layout",
  "top.leave": "Leave",
  "top.leaveTip": "Leave the session or change your name. When you come back, your character is waiting.",

  "mobile.tab.map": "Map",
  "mobile.tab.sheet": "Sheet",
  "mobile.tab.dice": "Dice",
  "mobile.tab.combat": "Combat",
  "mobile.sections": "Sections",
  "mobile.menu": "Menu",
  "mobile.desktopLayout": "Use the desktop layout",
};
