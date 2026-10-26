import type { WeatherState } from "@rpg/shared";

/** Sem clima, de dia (E26): começo da sessão e campo limpo. */
export function defaultWeather(): WeatherState {
  return { kind: null, intensity: 0.6, wind: 0, light: "day", startedAt: 0 };
}
