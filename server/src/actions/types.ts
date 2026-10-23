import type { ActionName, ActionPayloads } from "@rpg/shared";
import type { ServerPlayer, Store } from "../store";

/** Aplica uma ação ao estado. Lança `ActionError` para recusar; pode devolver ids criados. */
export type Handler<K extends ActionName> = (
  store: Store,
  player: ServerPlayer,
  payload: ActionPayloads[K],
) => string[] | void;

export type HandlerMap = { [K in ActionName]?: Handler<K> };
