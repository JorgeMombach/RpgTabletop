import type { LightId } from "@rpg/shared";

/**
 * Luz da cena (docs/design/luz.md), com os números do teste aprovado (`docs/design/luz-teste.html`): cor ambiente, sol
 * (ou lua) com a direção para onde as sombras caem e o comprimento delas em casas (o teste era a 48 px por casa), e a
 * força das tochas.
 */
export interface SceneLight {
  ambient: [number, number, number];
  sun: [number, number, number];
  /** Para onde as sombras caem (unitário, no plano do mapa). */
  sunDirection: [number, number];
  /** Comprimento da sombra de uma parede, em casas (0 = sem sol nem lua). */
  shadowCells: number;
  torch: number;
}

export const SCENE_LIGHT: Record<LightId, SceneLight> = {
  day: { ambient: [0.62, 0.62, 0.6], sun: [0.5, 0.48, 0.44], sunDirection: [0.55, 0.83], shadowCells: 34 / 48, torch: 0.12 },
  dusk: { ambient: [0.36, 0.27, 0.32], sun: [0.78, 0.46, 0.24], sunDirection: [0.97, 0.25], shadowCells: 150 / 48, torch: 0.55 },
  night: { ambient: [0.08, 0.1, 0.19], sun: [0, 0, 0], sunDirection: [0.6, 0.8], shadowCells: 0, torch: 1 },
  moon: { ambient: [0.16, 0.2, 0.33], sun: [0.17, 0.21, 0.33], sunDirection: [0.45, 0.89], shadowCells: 60 / 48, torch: 1 },
};

/** Brilho mínimo do mestre (docs/design/luz.md): o ambiente do luar, para dar para trabalhar à noite. */
export const GM_FLOOR: [number, number, number] = SCENE_LIGHT.moon.ambient;

const mix = (from: number, to: number, k: number) => from + (to - from) * k;
const mixTriple = (from: [number, number, number], to: [number, number, number], k: number): [number, number, number] => [mix(from[0], to[0], k), mix(from[1], to[1], k), mix(from[2], to[2], k)];

/** Um passo da troca suave entre duas luzes da cena (`k` de 0 a 1). */
export function blendSceneLight(from: SceneLight, to: SceneLight, k: number): SceneLight {
  const direction: [number, number] = [mix(from.sunDirection[0], to.sunDirection[0], k), mix(from.sunDirection[1], to.sunDirection[1], k)];
  const length = Math.hypot(direction[0], direction[1]) || 1;
  return {
    ambient: mixTriple(from.ambient, to.ambient, k),
    sun: mixTriple(from.sun, to.sun, k),
    sunDirection: [direction[0] / length, direction[1] / length],
    shadowCells: mix(from.shadowCells, to.shadowCells, k),
    torch: mix(from.torch, to.torch, k),
  };
}
