import type { WeatherId, WeatherState } from "./types";

/**
 * Vento nas plantas (docs/design/vento.md): contas puras. Cada tela calcula pelo próprio relógio; nada vai pela
 * rede. Sempre há uma brisa; os climas de vento balançam mais forte, para o lado que o clima já define.
 */

/** Climas que trazem vento (as plantas balançam mais). */
const WINDY: ReadonlySet<WeatherId> = new Set<WeatherId>(["leaves", "blizzard", "sand", "storm"]);

export interface Wind {
  /** 1 = brisa; até 2 com clima de vento forte. */
  strength: number;
  /** Para onde a rajada anda: 1 = direita, -1 = esquerda. */
  direction: 1 | -1;
}

export function windOf(weather: WeatherState | null): Wind {
  const direction = weather && weather.wind < 0 ? -1 : 1;
  const strength = weather?.kind && WINDY.has(weather.kind) ? 1 + weather.intensity : 1;
  return { strength, direction };
}

/**
 * Rajada no ponto (em casas) no instante `t` (segundos), entre -0,9 e 0,9: soma de senos de ritmos diferentes.
 * O tempo de cada lugar é atrasado pela posição, então a rajada atravessa o mapa a 8 casas por segundo no sentido
 * do vento (vizinhas balançam quase juntas, como uma onda). A semente muda só os ritmos miúdos de cada planta.
 */
export function gust(t: number, col: number, row: number, seed: number, direction: 1 | -1): number {
  const travel = t - (direction * col) / 8 - row / 20;
  return Math.sin(travel * 0.9) * 0.55 + Math.sin(travel * 2.3 + seed) * 0.25 + Math.sin(travel * 4.1 + seed * 2) * 0.1;
}

/** Janela observada e o quadro que já conta como lento (abaixo de 20 por segundo). */
const WATCH_WINDOW_MS = 3000;
const WATCH_DECIDE_MS = 2500;
const SLOW_FRAME_MS = 50;
/** Quadro maior que isso é a aba voltando do segundo plano, não o aparelho engasgando. */
const IGNORE_FRAME_MS = 1000;

/**
 * Detector de aparelho que não aguenta: numa janela de 3 s de quadros, mais da metade lentos desliga o vento
 * de vez (até recarregar a página). Só decide com a janela quase cheia, para um começo pesado não contar.
 */
export class FrameWatch {
  private frames: number[] = [];
  private total = 0;
  private stalled = false;

  /** Registra a duração de um quadro; `false` = o vento deve parar (e continua parado). */
  tick(frameMs: number): boolean {
    if (this.stalled) return false;
    if (frameMs > IGNORE_FRAME_MS || frameMs <= 0) return true;
    this.frames.push(frameMs);
    this.total += frameMs;
    while (this.total > WATCH_WINDOW_MS && this.frames.length > 1) this.total -= this.frames.shift() ?? 0;
    if (this.total < WATCH_DECIDE_MS) return true;
    const slow = this.frames.filter((duration) => duration > SLOW_FRAME_MS).length;
    if (slow * 2 > this.frames.length) this.stalled = true;
    return !this.stalled;
  }
}
