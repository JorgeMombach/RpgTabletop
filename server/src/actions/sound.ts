import { GEN_SOUNDS, type SoundChannel, type SoundSource } from "@rpg/shared";
import { listSounds } from "../sounds";
import type { Store } from "../store";
import { fail, requireNumber } from "../validate";
import { requireGm } from "./combatants";
import type { HandlerMap } from "./types";

const CHANNELS: SoundChannel[] = ["music", "ambient"];

function channelOf(raw: unknown): SoundChannel {
  return CHANNELS.includes(raw as SoundChannel) ? (raw as SoundChannel) : fail("Canal de som inválido.");
}

/**
 * Valida a origem do som: arquivo que está na biblioteca ou som gerado pelo app.
 * `loop` = ambientes (música/ambiente); senão, efeitos de uma vez.
 */
export function soundSource(store: Store, raw: unknown, loop: boolean): SoundSource {
  const s = raw as SoundSource | undefined;
  if (s?.kind === "gen") {
    const ids = loop ? GEN_SOUNDS.ambient : GEN_SOUNDS.sfx;
    if (typeof s.id === "string" && s.id in ids) return { kind: "gen", id: s.id };
    fail("Som gerado desconhecido.");
  }
  if (s?.kind === "file" && typeof s.name === "string") {
    if (store.soundLibrary?.includes(s.name)) return { kind: "file", name: s.name };
    fail("Esse arquivo não está na pasta de sons. Atualize a lista.");
  }
  fail("Som inválido.");
}

/** Relê a pasta de sons (no começo e quando o mestre pede). */
export function refreshLibrary(store: Store) {
  store.soundLibrary = store.soundsDir ? listSounds(store.soundsDir) : null;
  // Arquivo que saiu da pasta para de tocar.
  for (const ch of CHANNELS) {
    const t = store.sound[ch];
    if (t?.source.kind === "file" && !store.soundLibrary?.includes(t.source.name)) store.sound[ch] = null;
  }
}

/** Som da mesa (E25): só o mestre escolhe o que toca e o volume de cada canal para todos. */
export const soundHandlers: HandlerMap = {
  "sound:play": (store, player, payload) => {
    requireGm(player);
    const channel = channelOf(payload?.channel);
    store.sound[channel] = { source: soundSource(store, payload.source, true), startedAt: Date.now() };
  },

  "sound:stop": (store, player, payload) => {
    requireGm(player);
    store.sound[channelOf(payload?.channel)] = null;
  },

  "sound:volume": (store, player, payload) => {
    requireGm(player);
    const channel = payload?.channel === "sfx" ? "sfx" : channelOf(payload?.channel);
    store.sound.volume[channel] = Math.round(requireNumber(payload.value, "Volume", 0, 1) * 100) / 100;
  },

  "sound:refresh": (store, player) => {
    requireGm(player);
    if (!store.soundsDir) fail("A pasta de sons não está configurada (opção --sounds-dir).");
    refreshLibrary(store);
  },
};
