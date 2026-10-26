import type { HandlerMap } from "./types";
import { combatantHandlers } from "./combatants";
import { conditionHandlers } from "./conditions";
import { diceHandlers } from "./dice";
import { drawingHandlers } from "./drawings";
import { effectHandlers } from "./effects";
import { initiativeHandlers } from "./initiative";
import { magicHandlers } from "./magic";
import { mapHandlers } from "./map";
import { sheetHandlers } from "./sheet";
import { soundHandlers } from "./sound";
import { weatherHandlers } from "./weather";

export const handlers: HandlerMap = {
  ...combatantHandlers,
  ...diceHandlers,
  ...mapHandlers,
  ...initiativeHandlers,
  ...magicHandlers,
  ...conditionHandlers,
  ...effectHandlers,
  ...drawingHandlers,
  ...soundHandlers,
  ...sheetHandlers,
  ...weatherHandlers,
};
