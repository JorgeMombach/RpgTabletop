// Calendário e hora do jogo (Passo 15): o mestre liga, acerta e avança ("Dia 3, 14:00"); todos veem.
// Com "a luz acompanha a hora", a luz do clima da cena segue o relógio. Só registro: nada mais muda sozinho (ADR-06).
import { LIMITS, type GameClock, type LightId } from "@rpg/shared";
import type { Store } from "../store";
import { fail, requireInt } from "../validate";
import { requireGm } from "./combatants";
import { logSystem } from "./dice";
import type { HandlerMap } from "./types";

const DAY = 24 * 60;

/** Luz da hora: dia das 6h às 18h, entardecer no amanhecer (5h) e no fim da tarde (18h às 20h), noite no resto. */
export function lightFor(minutes: number): LightId {
  const h = Math.floor(minutes / 60);
  if (h >= 6 && h < 18) return "day";
  if (h === 5 || (h >= 18 && h < 20)) return "dusk";
  return "night";
}

export const clockTime = (minutes: number) => `${String(Math.floor(minutes / 60)).padStart(2, "0")}:${String(minutes % 60).padStart(2, "0")}`;

/** Hora do arquivo de sessão ou do mestre, conferida. */
export function parseClock(raw: unknown): GameClock | null {
  if (raw === null || raw === undefined) return null;
  const c = raw as Record<string, unknown>;
  const day = requireInt(c.day, "Dia", 1, LIMITS.clockDay);
  const minutes = requireInt(c.minutes, "Hora", 0, DAY - 1);
  return { day, minutes, ...(c.lightFollows === true && { lightFollows: true }) };
}

/** Com a luz acompanhando, põe na cena ativa a luz da hora (também ao trocar de cena). */
export function syncLight(store: Store) {
  const clock = store.game.clock;
  if (clock?.lightFollows) store.game.battle.weather.light = lightFor(clock.minutes);
}

export const clockHandlers: HandlerMap = {
  "clock:set": (store, player, payload) => {
    requireGm(player);
    store.game.clock = parseClock(payload?.clock);
    syncLight(store);
  },

  "clock:advance": (store, player, payload) => {
    requireGm(player);
    const minutes = requireInt(payload?.minutes, "Minutos", 1, LIMITS.clockAdvance);
    const clock = store.game.clock ?? fail("Ligue a hora do jogo antes de avançar.");
    const total = clock.minutes + minutes;
    clock.day = Math.min(clock.day + Math.floor(total / DAY), LIMITS.clockDay);
    clock.minutes = total % DAY;
    syncLight(store);
    logSystem(store, "Agora é dia {day}, {time}.", { day: clock.day, time: clockTime(clock.minutes) });
  },
};
