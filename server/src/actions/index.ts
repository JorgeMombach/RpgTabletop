import type { HandlerMap } from "./types";
import { combatantHandlers } from "./combatants";
import { conditionHandlers } from "./conditions";
import { diceHandlers } from "./dice";
import { effectHandlers } from "./effects";
import { initiativeHandlers } from "./initiative";
import { magicHandlers } from "./magic";
import { mapHandlers } from "./map";

export const handlers: HandlerMap = {
  ...combatantHandlers,
  ...diceHandlers,
  ...mapHandlers,
  ...initiativeHandlers,
  ...magicHandlers,
  ...conditionHandlers,
  ...effectHandlers,
};
