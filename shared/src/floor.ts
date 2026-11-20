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

/** Uma área a varrer: a caixa (em casas) e o teste de cada ponto fino dentro dela. */
interface CoverArea {
  box: [number, number, number, number];
  covers: (x: number, y: number) => boolean;
}

/**
 * Áreas que a forma cobre. O pincel vira uma área por ponto (a caixinha do raio), para a conta crescer com o
 * caminho e não com a caixa da passada inteira; ponto coberto por duas áreas recebe o mesmo valor duas vezes.
 */
function shapeCover(
  shape: FloorShape,
  walls: Wall[],
  sceneStyle: WallStyle,
): CoverArea[] | null {
  if (shape.kind === "brush") {
    const { radius, points } = shape;
    const areas: CoverArea[] = [];
    for (let p = 0; p + 1 < points.length; p += 2) {
      const x = points[p];
      const y = points[p + 1];
      areas.push({
        box: [x - radius, y - radius, x + radius, y + radius],
        covers: (pointX, pointY) => Math.hypot(pointX - x, pointY - y) < radius,
      });
    }
    return areas;
  }
  if (shape.kind === "rect") {
    const x0 = Math.min(shape.from.x, shape.to.x);
    const x1 = Math.max(shape.from.x, shape.to.x);
    const y0 = Math.min(shape.from.y, shape.to.y);
    const y1 = Math.max(shape.from.y, shape.to.y);
    const near = (a: number, b: number) => a >= b - ON_EDGE;
    return [
      {
        box: [x0, y0, x1, y1],
        covers: (x, y) =>
          near(x, x0) && near(x1, x) && near(y, y0) && near(y1, y),
      },
    ];
  }
  const room = floorRoomAt(walls, shape.at, sceneStyle);
  if (!room) return null;
  const xs = room.outer.filter((_, index) => index % 2 === 0);
  const ys = room.outer.filter((_, index) => index % 2 === 1);
  return [
    {
      box: [Math.min(...xs), Math.min(...ys), Math.max(...xs), Math.max(...ys)],
      covers: (x, y) => {
        const point = { x, y };
        // Os pontos sobre o contorno de um buraco ficam com o salão (a parede cobre a emenda).
        return (
          insideOrOn(room.outer, point) &&
          !room.holes.some(
            (hole) =>
              strictlyInside(hole, point) &&
              edgeDistance(hole, point) >= ON_EDGE,
          )
        );
      },
    },
  ];
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
  const areas = shapeCover(stroke.shape, walls, sceneStyle);
  if (!areas) return null;
  const value =
    stroke.material === "erase"
      ? 0
      : encodeFloorPoint({
          material: stroke.material,
          vertical: stroke.vertical,
        });
  const working = new Map<string, Uint8Array>();
  /** Os pontos da caixa `[i0..i1] × [j0..j1]` (grade fina) cobertos pela área. */
  const paintBox = (
    area: (typeof areas)[number],
    i0: number,
    i1: number,
    j0: number,
    j1: number,
  ) => {
    for (let j = j0; j <= j1; j++) {
      for (let i = i0; i <= i1; i++) {
        if (!area.covers(i / TERRAIN_FINE, j / TERRAIN_FINE)) continue;
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
  };
  for (const area of areas) {
    const [x0, y0, x1, y1] = area.box;
    const i0 = Math.ceil(x0 * TERRAIN_FINE - ON_EDGE);
    const i1 = Math.floor(x1 * TERRAIN_FINE + ON_EDGE);
    const j0 = Math.ceil(y0 * TERRAIN_FINE - ON_EDGE);
    const j1 = Math.floor(y1 * TERRAIN_FINE + ON_EDGE);
    if (value !== 0) {
      paintBox(area, i0, i1, j0, j1);
      continue;
    }
    // Borracha: só os pedaços que já têm piso, cada um cortado pela caixa (uma caixa enorme não é varrida inteira).
    for (const key of Object.keys(chunks)) {
      const [cx, cy] = key.split(",").map(Number);
      paintBox(
        area,
        Math.max(i0, cx * TERRAIN_CHUNK_SIDE),
        Math.min(i1, (cx + 1) * TERRAIN_CHUNK_SIDE - 1),
        Math.max(j0, cy * TERRAIN_CHUNK_SIDE),
        Math.min(j1, (cy + 1) * TERRAIN_CHUNK_SIDE - 1),
      );
    }
  }
  for (const [key, bytes] of working) {
    if (bytes.every((byte) => byte === 0)) delete chunks[key];
    else chunks[key] = encodeLayer(bytes);
  }
  return [...working.keys()];
}

/** Caixa de um tapete (em casas): de borda a borda da área pintada (meio ponto fino além dos pontos). */
export interface CarpetBox {
  x0: number;
  y0: number;
  x1: number;
  y1: number;
}

/**
 * As caixas dos tapetes (cada grupo de pontos de tapete ligados por um lado é um tapete), para o desenho pôr o
 * medalhão no meio de cada um.
 */
export function floorCarpetBoxes(chunks: FloorChunks): CarpetBox[] {
  const carpet = FLOOR_MATERIALS.indexOf("carpet") + 1;
  const points = new Set<string>();
  for (const [key, text] of Object.entries(chunks)) {
    const bytes = decodeLayer(text);
    if (!bytes) continue;
    const [cx, cy] = key.split(",").map(Number);
    for (let index = 0; index < bytes.length; index++) {
      if ((bytes[index] & MATERIAL_MASK) !== carpet) continue;
      points.add(
        `${cx * TERRAIN_CHUNK_SIDE + (index % TERRAIN_CHUNK_SIDE)},${cy * TERRAIN_CHUNK_SIDE + Math.floor(index / TERRAIN_CHUNK_SIDE)}`,
      );
    }
  }
  const boxes: CarpetBox[] = [];
  const seen = new Set<string>();
  for (const start of points) {
    if (seen.has(start)) continue;
    seen.add(start);
    const queue = [start];
    let [x0, y0] = start.split(",").map(Number);
    let [x1, y1] = [x0, y0];
    while (queue.length > 0) {
      const [x, y] = (queue.pop() ?? "").split(",").map(Number);
      x0 = Math.min(x0, x);
      x1 = Math.max(x1, x);
      y0 = Math.min(y0, y);
      y1 = Math.max(y1, y);
      for (const [dx, dy] of [
        [1, 0],
        [-1, 0],
        [0, 1],
        [0, -1],
      ]) {
        const next = `${x + dx},${y + dy}`;
        if (points.has(next) && !seen.has(next)) {
          seen.add(next);
          queue.push(next);
        }
      }
    }
    const half = 0.5 / TERRAIN_FINE;
    boxes.push({
      x0: x0 / TERRAIN_FINE - half,
      y0: y0 / TERRAIN_FINE - half,
      x1: x1 / TERRAIN_FINE + half,
      y1: y1 / TERRAIN_FINE + half,
    });
  }
  return boxes;
}
