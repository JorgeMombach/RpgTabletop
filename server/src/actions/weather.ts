import { LIGHTS, LIMITS, WEATHERS, type LightId, type WeatherId, type WeatherState } from "@rpg/shared";
import { fail, requireNumber } from "../validate";
import { defaultWeather } from "../weather";
import { requireGm } from "./combatants";
import type { HandlerMap } from "./types";

function weatherKind(raw: unknown): WeatherId | null {
  if (raw === null) return null;
  return typeof raw === "string" && raw in WEATHERS ? (raw as WeatherId) : fail("Clima desconhecido.");
}

function lightOf(raw: unknown): LightId {
  return typeof raw === "string" && raw in LIGHTS ? (raw as LightId) : fail("Luz desconhecida.");
}

/** Clima vindo de arquivo de sessão (E18); arquivo antigo, sem clima, começa sem nenhum. */
export function weatherFromFile(raw: unknown): WeatherState {
  if (raw === undefined) return defaultWeather();
  const w = (raw ?? {}) as Record<string, unknown>;
  return {
    kind: weatherKind(w.kind),
    intensity: requireNumber(w.intensity, "Intensidade do clima", LIMITS.weatherIntensity.min, LIMITS.weatherIntensity.max),
    wind: requireNumber(w.wind, "Vento", LIMITS.weatherWind.min, LIMITS.weatherWind.max),
    light: lightOf(w.light),
    startedAt: typeof w.startedAt === "number" && Number.isFinite(w.startedAt) ? w.startedAt : 0,
  };
}

export const weatherHandlers: HandlerMap = {
  // Clima e luz do mapa (E26): só o mestre muda; todos veem igual.
  "weather:set": (store, player, payload) => {
    requireGm(player);
    const w = store.game.battle.weather;
    const next = { ...w };
    if (payload?.kind !== undefined) next.kind = weatherKind(payload.kind);
    if (payload?.intensity !== undefined) {
      next.intensity = requireNumber(payload.intensity, "Intensidade", LIMITS.weatherIntensity.min, LIMITS.weatherIntensity.max);
    }
    if (payload?.wind !== undefined) next.wind = Math.round(requireNumber(payload.wind, "Vento", LIMITS.weatherWind.min, LIMITS.weatherWind.max));
    if (payload?.light !== undefined) next.light = lightOf(payload.light);
    // Clima novo: relâmpagos com semente nova (a mesma para todos).
    if (next.kind !== w.kind) next.startedAt = Date.now();
    Object.assign(w, next);
  },
};
