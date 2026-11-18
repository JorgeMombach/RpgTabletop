import { chunkKey, decodeLayer, encodeLayer, TERRAIN_CHUNK_SIDE, TERRAIN_FINE } from "./terrain";

/**
 * Relevo (docs/design/relevo.md): na mesma grade fina do terreno (4 pontos por casa, pedaços de 8 × 8 casas), cada
 * ponto guarda um nível de −2 a +3 (0 = chão) e o tipo de borda: escarpa (penhasco de rocha) ou suave (morro, monte).
 * Só visual: não muda régua, visão nem névoa. Um byte por ponto: `(nível + 2) | (suave ? 8 : 0)`; pedaço que ficou
 * todo "chão escarpa" sai (sem pedaço = chão).
 */

export const RELIEF_LEVELS = { min: -2, max: 3 };
/** Pedaços com relevo de uma cena, pela chave `"cx,cy"`: os 1024 bytes em base64. */
export type ReliefChunks = Record<string, string>;

/** Uma passada do pincel: nível e tipo pintados, raio em casas e os pontos do traço (`x, y` achatados, em casas). */
export interface ReliefStroke {
  level: number;
  soft: boolean;
  radius: number;
  points: number[];
}

export interface ReliefPoint {
  level: number;
  soft: boolean;
}

const SOFT_BIT = 8;
/** O byte do chão (nível 0, escarpa): o que vale onde não há pedaço. */
export const RELIEF_GROUND = 2;

export function encodeReliefPoint(point: ReliefPoint): number {
  return (point.level + 2) | (point.soft ? SOFT_BIT : 0);
}

export function decodeReliefPoint(value: number): ReliefPoint {
  return { level: (value & 7) - 2, soft: (value & SOFT_BIT) !== 0 };
}

/** Byte válido: nível de −2 a +3, com ou sem o bit de suave, e nada mais. */
export function validReliefByte(value: number): boolean {
  const level = (value & 7) - 2;
  return (value & ~(7 | SOFT_BIT)) === 0 && level >= RELIEF_LEVELS.min && level <= RELIEF_LEVELS.max;
}

/** Nível e tipo no ponto da grade fina `fineX, fineY` (4 por casa). */
export function reliefAt(chunks: ReliefChunks, fineX: number, fineY: number): ReliefPoint {
  const cx = Math.floor(fineX / TERRAIN_CHUNK_SIDE);
  const cy = Math.floor(fineY / TERRAIN_CHUNK_SIDE);
  const text = chunks[chunkKey(cx, cy)];
  const bytes = text ? decodeLayer(text) : null;
  if (!bytes) return decodeReliefPoint(RELIEF_GROUND);
  return decodeReliefPoint(bytes[(fineY - cy * TERRAIN_CHUNK_SIDE) * TERRAIN_CHUNK_SIDE + (fineX - cx * TERRAIN_CHUNK_SIDE)]);
}

/**
 * Aplica a passada em `chunks` (muda o objeto) e devolve as chaves dos pedaços que mudaram: todo ponto da grade
 * dentro do raio de algum ponto do traço fica com o nível e o tipo pintados (pincel duro: o patamar tem borda).
 */
export function paintRelief(chunks: ReliefChunks, stroke: ReliefStroke): string[] {
  const value = encodeReliefPoint({ level: stroke.level, soft: stroke.soft });
  const working = new Map<string, Uint8Array>();
  for (let p = 0; p + 1 < stroke.points.length; p += 2) {
    const x = stroke.points[p];
    const y = stroke.points[p + 1];
    for (let j = Math.ceil((y - stroke.radius) * TERRAIN_FINE); j <= Math.floor((y + stroke.radius) * TERRAIN_FINE); j++) {
      for (let i = Math.ceil((x - stroke.radius) * TERRAIN_FINE); i <= Math.floor((x + stroke.radius) * TERRAIN_FINE); i++) {
        if (Math.hypot(i / TERRAIN_FINE - x, j / TERRAIN_FINE - y) >= stroke.radius) continue;
        const cx = Math.floor(i / TERRAIN_CHUNK_SIDE);
        const cy = Math.floor(j / TERRAIN_CHUNK_SIDE);
        const key = chunkKey(cx, cy);
        let bytes = working.get(key);
        if (!bytes) {
          // Aplainar onde nem há relevo: nada a mudar (e não cria pedaço).
          if (value === RELIEF_GROUND && !chunks[key]) continue;
          bytes = (chunks[key] ? decodeLayer(chunks[key]) : null) ?? new Uint8Array(TERRAIN_CHUNK_SIDE * TERRAIN_CHUNK_SIDE).fill(RELIEF_GROUND);
          working.set(key, bytes);
        }
        bytes[(j - cy * TERRAIN_CHUNK_SIDE) * TERRAIN_CHUNK_SIDE + (i - cx * TERRAIN_CHUNK_SIDE)] = value;
      }
    }
  }
  for (const [key, bytes] of working) {
    if (bytes.every((byte) => byte === RELIEF_GROUND)) delete chunks[key];
    else chunks[key] = encodeLayer(bytes);
  }
  return [...working.keys()];
}
