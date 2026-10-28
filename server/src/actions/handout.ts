import { randomUUID } from "node:crypto";
import { LIMITS, type Handout } from "@rpg/shared";
import { fail, requireImage } from "../validate";
import { requireGm } from "./combatants";
import { logSystem } from "./dice";
import type { HandlerMap } from "./types";

function optLine(raw: unknown, max: number): string | undefined {
  if (raw === undefined || raw === null) return undefined;
  if (typeof raw !== "string") fail("Texto inválido.");
  return raw.trim().slice(0, max) || undefined;
}

/** Mostrar para a mesa: o mestre abre um cartão (título, texto e/ou imagem) na tela de todos. */
export const handoutHandlers: HandlerMap = {
  "handout:show": (store, player, payload) => {
    requireGm(player);
    const title = optLine(payload?.title, LIMITS.handoutTitle);
    // Texto pode ter várias linhas (carta): só apara as pontas.
    const text = optLine(payload?.text, LIMITS.handoutText);
    const image = payload?.image === undefined || payload.image === null ? undefined : requireImage(payload.image, "Imagem", LIMITS.mapImageChars);
    if (!title && !text && !image) fail("Escreva um texto ou escolha uma imagem para mostrar.");
    const handout: Handout = { id: randomUUID(), ...(title && { title }), ...(text && { text }), ...(image && { image }) };
    store.handout = handout;
    store.handoutVersion++;
    if (title) logSystem(store, "O mestre mostrou: {title}.", { title });
    else logSystem(store, "O mestre mostrou algo para a mesa.");
    return [handout.id];
  },

  "handout:close": (store, player) => {
    requireGm(player);
    if (!store.handout) return;
    store.handout = null;
    store.handoutVersion++;
  },
};
