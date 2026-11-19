import type { LightPoint } from "./light";
import {
  chunkKey,
  decodeLayer,
  encodeLayer,
  TERRAIN_CHUNK_SIDE,
  TERRAIN_FINE,
} from "./terrain";
import type { Wall, WallStyle } from "./types";
import { wallRooms } from "./wallJoin";

/**
 * Pisos (docs/design/pisos.md; visual aprovado em docs/design/pisos-teste.html): um byte por ponto da grade fina (4 por
 * casa), nos mesmos pedaços de 8 × 8 casas do terreno e do relevo. O byte guarda o material (4 bits de baixo; 0 = sem
 * piso) e o sentido (bit de valor 16: tábuas na vertical). Contas puras: o servidor aplica e o cliente mostra a prévia
 * com a mesma função.
 */

/** Materiais, na ordem do byte (1 a 6); ids estáveis (vão no arquivo de sessão). */
export const FLOOR_MATERIALS = [
  "plank",
  "plankWide",
  "flagstone",
  "tile",
  "mosaic",
  "carpet",
] as const;
export type FloorMaterial = (typeof FLOOR_MATERIALS)[number];

/** Pedaços com piso de uma cena, pela chave `"cx,cy"`: os 1024 bytes em base64. */
export type FloorChunks = Record<string, string>;

export interface FloorPoint {
  material: FloorMaterial | null;
  vertical: boolean;
}

/** Forma da passada: pincel (raio e pontos em casas), retângulo (cantos em casas) ou cômodo (um ponto dentro dele). */
export type FloorShape =
  | { kind: "brush"; radius: number; points: number[] }
  | {
      kind: "rect";
      from: { x: number; y: number };
      to: { x: number; y: number };
    }
  | { kind: "room"; at: { x: number; y: number } };

export interface FloorStroke {
  material: FloorMaterial | "erase";
  vertical: boolean;
  shape: FloorShape;
}

const MATERIAL_MASK = 15;
const VERTICAL_BIT = 16;

export function encodeFloorPoint(point: FloorPoint): number {
  if (!point.material) return 0;
  return (
    (FLOOR_MATERIALS.indexOf(point.material) + 1) |
    (point.vertical ? VERTICAL_BIT : 0)
  );
}

export function decodeFloorPoint(value: number): FloorPoint {
  const index = (value & MATERIAL_MASK) - 1;
  return {
    material:
      index >= 0 && index < FLOOR_MATERIALS.length
        ? FLOOR_MATERIALS[index]
        : null,
    vertical: (value & VERTICAL_BIT) !== 0,
  };
}

/** Byte válido: material de 0 a 6, o bit do sentido, e nada mais (os bits de 32, 64 e 128 são reservados). */
export function validFloorByte(value: number): boolean {
  return (
    Number.isInteger(value) &&
    value >= 0 &&
    (value & ~(MATERIAL_MASK | VERTICAL_BIT)) === 0 &&
    (value & MATERIAL_MASK) <= FLOOR_MATERIALS.length
  );
}

/** Material e sentido no ponto da grade fina `fineX, fineY` (4 por casa). */
export function floorAt(
  chunks: FloorChunks,
  fineX: number,
  fineY: number,
): FloorPoint {
  const cx = Math.floor(fineX / TERRAIN_CHUNK_SIDE);
  const cy = Math.floor(fineY / TERRAIN_CHUNK_SIDE);
  const text = chunks[chunkKey(cx, cy)];
  const bytes = text ? decodeLayer(text) : null;
  if (!bytes) return { material: null, vertical: false };
  return decodeFloorPoint(
    bytes[
      (fineY - cy * TERRAIN_CHUNK_SIDE) * TERRAIN_CHUNK_SIDE +
        (fineX - cx * TERRAIN_CHUNK_SIDE)
    ],
  );
}

/** Tolerância (casas) para um ponto contar como "sobre" o contorno. */
const ON_EDGE = 1e-6;

function polygonArea(polygon: number[]): number {
  let area = 0;
  for (let index = 0; index < polygon.length; index += 2) {
    const next = (index + 2) % polygon.length;
    area +=
      polygon[index] * polygon[next + 1] - polygon[next] * polygon[index + 1];
  }
  return Math.abs(area / 2);
}

/** Distância do ponto ao contorno do polígono. */
function edgeDistance(polygon: number[], point: LightPoint): number {
  let best = Infinity;
  for (let index = 0; index < polygon.length; index += 2) {
    const next = (index + 2) % polygon.length;
    const ax = polygon[index];
    const ay = polygon[index + 1];
    const dx = polygon[next] - ax;
    const dy = polygon[next + 1] - ay;
    const lengthSquared = dx * dx + dy * dy;
    const k =
      lengthSquared > 0
        ? Math.min(
            1,
            Math.max(
              0,
              ((point.x - ax) * dx + (point.y - ay) * dy) / lengthSquared,
            ),
          )
        : 0;
    best = Math.min(
      best,
      Math.hypot(point.x - ax - dx * k, point.y - ay - dy * k),
    );
  }
  return best;
}

/** Dentro do polígono (regra par-ímpar; os vai-e-vem de uma parede em T se cancelam), sem contar o contorno. */
function strictlyInside(polygon: number[], point: LightPoint): boolean {
  let inside = false;
  for (
    let index = 0, previous = polygon.length - 2;
    index < polygon.length;
    previous = index, index += 2
  ) {
    const xi = polygon[index];
    const yi = polygon[index + 1];
    const xj = polygon[previous];
    const yj = polygon[previous + 1];
    if (
      yi > point.y !== yj > point.y &&
      point.x < ((xj - xi) * (point.y - yi)) / (yj - yi) + xi
    )
      inside = !inside;
  }
  return inside;
}

/** Dentro ou sobre o contorno. */
function insideOrOn(polygon: number[], point: LightPoint): boolean {
  return (
    edgeDistance(polygon, point) < ON_EDGE || strictlyInside(polygon, point)
  );
}

/**
 * O lugar fechado que contém `at` (a menor face das paredes, portas e janelas de qualquer desenho que o contém) e os
 * lugares fechados inteiros dentro dele (buracos: são outro lugar); `null` fora de lugar fechado.
 */
export function floorRoomAt(
  walls: Wall[],
  at: { x: number; y: number },
  sceneStyle: WallStyle,
): { outer: number[]; holes: number[][] } | null {
  const faces = wallRooms(walls, sceneStyle, { allStyles: true });
  const containing = faces
    .filter((face) => insideOrOn(face, at))
    .sort((one, other) => polygonArea(one) - polygonArea(other));
  const outer = containing[0];
  if (!outer) return null;
  const holes = faces.filter((face) => {
    if (face === outer || insideOrOn(face, at)) return false;
    for (let index = 0; index < face.length; index += 2)
      if (!insideOrOn(outer, { x: face[index], y: face[index + 1] }))
        return false;
    return true;
  });
  return { outer, holes };
}

/** Pontos finos (i, j) que a forma cobre: a caixa a varrer e o teste de cada ponto (em casas). */
function shapeCover(
  shape: FloorShape,
  walls: Wall[],
  sceneStyle: WallStyle,
): {
  box: [number, number, number, number];
  covers: (x: number, y: number) => boolean;
} | null {
  if (shape.kind === "brush") {
    const { radius, points } = shape;
    let x0 = Infinity;
    let y0 = Infinity;
    let x1 = -Infinity;
    let y1 = -Infinity;
    for (let p = 0; p + 1 < points.length; p += 2) {
      x0 = Math.min(x0, points[p] - radius);
      x1 = Math.max(x1, points[p] + radius);
      y0 = Math.min(y0, points[p + 1] - radius);
      y1 = Math.max(y1, points[p + 1] + radius);
    }
    return {
      box: [x0, y0, x1, y1],
      covers: (x, y) => {
        for (let p = 0; p + 1 < points.length; p += 2)
          if (Math.hypot(x - points[p], y - points[p + 1]) < radius)
            return true;
        return false;
      },
    };
  }
  if (shape.kind === "rect") {
    const x0 = Math.min(shape.from.x, shape.to.x);
    const x1 = Math.max(shape.from.x, shape.to.x);
    const y0 = Math.min(shape.from.y, shape.to.y);
    const y1 = Math.max(shape.from.y, shape.to.y);
    const near = (a: number, b: number) => a >= b - ON_EDGE;
    return {
      box: [x0, y0, x1, y1],
      covers: (x, y) =>
        near(x, x0) && near(x1, x) && near(y, y0) && near(y1, y),
    };
  }
  const room = floorRoomAt(walls, shape.at, sceneStyle);
  if (!room) return null;
  const xs = room.outer.filter((_, index) => index % 2 === 0);
  const ys = room.outer.filter((_, index) => index % 2 === 1);
  return {
    box: [Math.min(...xs), Math.min(...ys), Math.max(...xs), Math.max(...ys)],
    covers: (x, y) => {
      const point = { x, y };
      // Os pontos sobre o contorno de um buraco ficam com o salão (a parede cobre a emenda).
      return (
        insideOrOn(room.outer, point) &&
        !room.holes.some(
          (hole) =>
            strictlyInside(hole, point) && edgeDistance(hole, point) >= ON_EDGE,
        )
      );
    },
  };
}

/**
 * Aplica a passada em `chunks` (muda o objeto) e devolve as chaves dos pedaços que mudaram; `null` se o cômodo pedido
 * não é um lugar fechado (nada muda). Pintar outro material troca; a borracha (`"erase"`) tira; pedaço vazio some.
 */
export function paintFloor(
  chunks: FloorChunks,
  stroke: FloorStroke,
  walls: Wall[],
  sceneStyle: WallStyle,
): string[] | null {
  const cover = shapeCover(stroke.shape, walls, sceneStyle);
  if (!cover) return null;
  const value =
    stroke.material === "erase"
      ? 0
      : encodeFloorPoint({
          material: stroke.material,
          vertical: stroke.vertical,
        });
  const [x0, y0, x1, y1] = cover.box;
  const working = new Map<string, Uint8Array>();
  for (
    let j = Math.ceil(y0 * TERRAIN_FINE - ON_EDGE);
    j <= Math.floor(y1 * TERRAIN_FINE + ON_EDGE);
    j++
  ) {
    for (
      let i = Math.ceil(x0 * TERRAIN_FINE - ON_EDGE);
      i <= Math.floor(x1 * TERRAIN_FINE + ON_EDGE);
      i++
    ) {
      if (!cover.covers(i / TERRAIN_FINE, j / TERRAIN_FINE)) continue;
      const cx = Math.floor(i / TERRAIN_CHUNK_SIDE);
      const cy = Math.floor(j / TERRAIN_CHUNK_SIDE);
      const key = chunkKey(cx, cy);
      let bytes = working.get(key);
      if (!bytes) {
        // Apagar onde nem há piso: nada a mudar (e não cria pedaço).
        if (value === 0 && !chunks[key]) continue;
        bytes =
          (chunks[key] ? decodeLayer(chunks[key]) : null) ??
          new Uint8Array(TERRAIN_CHUNK_SIDE * TERRAIN_CHUNK_SIDE);
        working.set(key, bytes);
      }
      bytes[
        (j - cy * TERRAIN_CHUNK_SIDE) * TERRAIN_CHUNK_SIDE +
          (i - cx * TERRAIN_CHUNK_SIDE)
      ] = value;
    }
  }
  for (const [key, bytes] of working) {
    if (bytes.every((byte) => byte === 0)) delete chunks[key];
    else chunks[key] = encodeLayer(bytes);
  }
  return [...working.keys()];
}
