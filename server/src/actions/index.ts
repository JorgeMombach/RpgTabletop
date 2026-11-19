import type { HandlerMap } from "./types";
import { combatantHandlers } from "./combatants";
import { conditionHandlers } from "./conditions";
import { diceHandlers } from "./dice";
import { drawingHandlers } from "./drawings";
import { currentHandlers } from "./currents";
import { effectHandlers } from "./effects";
import { initiativeHandlers } from "./initiative";
import { magicHandlers } from "./magic";
import { mapHandlers } from "./map";
import { sheetHandlers } from "./sheet";
import { sheetFileHandlers } from "./sheetFiles";
import { catalogHandlers } from "./catalog";
import { soundHandlers } from "./sound";
import { fogHandlers } from "./fog";
import { handoutHandlers } from "./handout";
import { ruleHandlers } from "./rules";
import { sceneHandlers } from "./scenes";
import { wallHandlers } from "./walls";
import { mapTorchHandlers } from "./mapTorches";
import { chestHandlers } from "./chests";
import { propHandlers } from "./props";
import { bridgeHandlers } from "./bridges";
import { weatherHandlers } from "./weather";
import { tableHandlers } from "./tables";
import { clockHandlers } from "./clock";
import { journalHandlers } from "./journal";
import { floorHandlers } from "./floor";
import { reliefHandlers } from "./relief";
import { terrainHandlers } from "./terrain";

export const handlers: HandlerMap = {
  ...terrainHandlers,
  ...reliefHandlers,
  ...floorHandlers,
  ...combatantHandlers,
  ...diceHandlers,
  ...mapHandlers,
  ...initiativeHandlers,
  ...magicHandlers,
  ...conditionHandlers,
  ...effectHandlers,
  ...drawingHandlers,
  ...currentHandlers,
  ...wallHandlers,
  ...sceneHandlers,
  ...handoutHandlers,
  ...fogHandlers,
  ...mapTorchHandlers,
  ...chestHandlers,
  ...propHandlers,
  ...bridgeHandlers,
  ...ruleHandlers,
  ...soundHandlers,
  ...sheetHandlers,
  ...sheetFileHandlers,
  ...catalogHandlers,
  ...weatherHandlers,
  ...tableHandlers,
  ...clockHandlers,
  ...journalHandlers,
};
