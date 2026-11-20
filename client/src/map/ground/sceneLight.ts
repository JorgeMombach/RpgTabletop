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

/** Troca de luz da cena: meio segundo (o chão, e a chuva e a neve escurecendo junto). */
export const SCENE_BLEND_SECONDS = 0.5;

export const SCENE_LIGHT: Record<LightId, SceneLight> = {
  day: { ambient: [0.62, 0.62, 0.6], sun: [0.5, 0.48, 0.44], sunDirection: [0.55, 0.83], shadowCells: 34 / 48, torch: 0.12 },
  dusk: { ambient: [0.36, 0.27, 0.32], sun: [0.78, 0.46, 0.24], sunDirection: [0.97, 0.25], shadowCells: 150 / 48, torch: 0.55 },
  night: { ambient: [0.08, 0.1, 0.19], sun: [0, 0, 0], sunDirection: [0.6, 0.8], shadowCells: 0, torch: 1 },
  moon: { ambient: [0.16, 0.2, 0.33], sun: [0.17, 0.21, 0.33], sunDirection: [0.45, 0.89], shadowCells: 60 / 48, torch: 1 },
};

/** Luz de dentro dos cômodos fechados (docs/design/paredes.md): a parte do sol que entra ("bem de leve"). */
export const INDOOR_SUN = 0.45;

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

/** Sombra do sol: um nível tem 1,4 casa e sobe 1/(sombra × 1,6) por casa (como o relevo). */
const LEVEL_SHADOW = 1.6;
const LEVEL_HEIGHT = 1.4;

/**
 * Luz da face para o relevo fino, as paredes e o chão (relativa ao chão plano): de onde vem a luz (z = altura), quanto
 * ela marca e o brilho do ambiente e do sol. Sem sol, uma luz fraca de mentira, só para o volume se ler.
 */
export function faceLight(scene: SceneLight): { direction: [number, number, number]; amount: number; ambientLum: number; sunLum: number } {
  const sunny = scene.shadowCells > 0.01;
  const [dx, dy] = sunny ? scene.sunDirection : [0.6, 0.8];
  const lift = sunny ? (1 / (scene.shadowCells * LEVEL_SHADOW)) * LEVEL_HEIGHT : 1;
  const length = Math.hypot(dx, dy, lift) || 1;
  const luminance = (rgb: [number, number, number]) => rgb[0] * 0.3 + rgb[1] * 0.59 + rgb[2] * 0.11;
  return {
    direction: [-dx / length, -dy / length, lift / length],
    amount: sunny ? 1 : 0.4,
    ambientLum: luminance(scene.ambient),
    sunLum: sunny ? luminance(scene.sun) : luminance(scene.ambient) * 0.5,
  };
}
