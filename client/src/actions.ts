import type { ActionName, ActionPayloads, ActionResult } from "@rpg/shared";
import { socket } from "./socket";
import { localizeError, t } from "./i18n";
import { toast } from "./notify";

type AckEmitter = { emitWithAck(ev: string, payload: unknown): Promise<ActionResult> };

/** Envia uma ação ao servidor. Erros viram toast; o estado novo chega por `state:full`. */
export async function act<K extends ActionName>(name: K, payload: ActionPayloads[K]): Promise<ActionResult> {
  let res: ActionResult;
  try {
    res = await (socket.timeout(5000) as unknown as AckEmitter).emitWithAck(name, payload);
  } catch {
    res = { ok: false, error: t("common.noServer") };
  }
  if (!res.ok) {
    res = { ...res, error: localizeError(res) };
    toast({ kind: "error", text: res.error });
  }
  return res;
}
