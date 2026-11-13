import {
  centeredOn as squareCenteredOn,
  cellDistance,
  footprint as squareFootprint,
  nearestCellOf as squareNearestCellOf,
  nearestFreeSpot,
  overlaps,
  sharesCell,
  sizeSpan,
} from "./grid";
import type { GridKind, GridPos, Size } from "./types";

/**
 * Geometria das três grades (Passo 16). Mapa, régua e servidor perguntam a ela em vez de fazer a
 * conta do quadrado à mão. Pontos em "unidades de casa": pixels do mapa ÷ `cellPx`, a partir do
 * deslocamento do grid. No hex, `cellPx` é a distância entre centros de hexes vizinhos.
 *
 * Contas do hex pelas fórmulas da Red Blob Games (redblobgames.com/grids/hexagons): posições
 * guardadas em offset (`col`, `row`) e convertidas para axial (`q`, `r`) só aqui dentro.
 */
export interface CellPoint {
  x: number;
  y: number;
}

export interface GridGeometry {
  kind: GridKind;
  /** Centro da casa. */
  center(pos: GridPos): CellPoint;
  /** Casa em que o ponto cai. */
  cellAt(point: CellPoint): GridPos;
  /** 4 vizinhos no quadrado (os lados), 6 no hex. */
  neighbors(pos: GridPos): GridPos[];
  /** Casas entre duas posições (quadrado: diagonal = 1; hex: número de hexes). */
  distance(a: GridPos, b: GridPos): number;
  /** Casas ocupadas por quem está em `pos` com este tamanho (miúdo: a própria casa). */
  footprint(pos: GridPos, size: Size | undefined): GridPos[];
  /** Onde o token é desenhado: o meio da forma. */
  shapeCenter(pos: GridPos, size: Size | undefined): CellPoint;
  /** Diâmetro do token, em casas. */
  drawSpan(size: Size | undefined): number;
  /** `pos` para a forma ficar sobre a casa `cell` (onde a pessoa clicou ou soltou). */
  centeredOn(cell: GridPos, size: Size | undefined): GridPos;
  /** Casa da forma mais perto de `target` (a régua mede da borda, não do centro). */
  nearestCellOf(pos: GridPos, size: Size | undefined, target: GridPos): GridPos;
  /** Contorno da casa. */
  polygon(pos: GridPos): CellPoint[];
  /** Quanto o desenho do grid leva para se repetir em x e y. */
  period: CellPoint;
  /** Distância horizontal entre centros de colunas vizinhas. */
  columnStep: number;
}

const square: GridGeometry = {
  kind: "square",
  center: (pos) => ({ x: pos.col + 0.5, y: pos.row + 0.5 }),
  cellAt: (point) => ({ col: Math.floor(point.x), row: Math.floor(point.y) }),
  neighbors: (pos) => [
    { col: pos.col + 1, row: pos.row },
    { col: pos.col, row: pos.row + 1 },
    { col: pos.col - 1, row: pos.row },
    { col: pos.col, row: pos.row - 1 },
  ],
  distance: cellDistance,
  footprint: (pos, size) => squareFootprint(pos, sizeSpan(size)),
  shapeCenter: (pos, size) => ({ x: pos.col + sizeSpan(size) / 2, y: pos.row + sizeSpan(size) / 2 }),
  drawSpan: sizeSpan,
  centeredOn: (cell, size) => squareCenteredOn(cell, sizeSpan(size)),
  nearestCellOf: (pos, size, target) => squareNearestCellOf(pos, sizeSpan(size), target),
  polygon: (pos) => [
    { x: pos.col, y: pos.row },
    { x: pos.col + 1, y: pos.row },
    { x: pos.col + 1, y: pos.row + 1 },
    { x: pos.col, y: pos.row + 1 },
  ],
  period: { x: 1, y: 1 },
  columnStep: 1,
};

// --- Hex de pontas para cima ("odd-r"). O de lado em cima é o mesmo espelhado na diagonal. ---

/** Raio do hex (centro a ponta) quando a distância entre centros vizinhos é 1. */
const HEX_RADIUS = 1 / Math.sqrt(3);
const ROW_STEP = 1.5 * HEX_RADIUS;

interface Axial {
  q: number;
  r: number;
}

/** Direções axiais: L, NE, NO, O, SO, SE. */
const DIRECTIONS: Axial[] = [
  { q: 1, r: 0 },
  { q: 1, r: -1 },
  { q: 0, r: -1 },
  { q: -1, r: 0 },
  { q: -1, r: 1 },
  { q: 0, r: 1 },
];

/** Grande: o hex de `pos`, o do leste e o do sudeste (triângulo). */
const LARGE_SHAPE: Axial[] = [
  { q: 0, r: 0 },
  { q: 1, r: 0 },
  { q: 0, r: 1 },
];

/** Raio da forma em volta de `pos` para Enorme (7 hexes) e Imenso (19). */
const RING_RADIUS: Partial<Record<Size, number>> = { huge: 1, gargantuan: 2 };
const HEX_DRAW_SPAN: Record<Size, number> = { tiny: 1, small: 1, medium: 1, large: 2, huge: 3, gargantuan: 5 };

function toAxial(pos: GridPos): Axial {
  return { q: pos.col - (pos.row - (pos.row & 1)) / 2, r: pos.row };
}

function toOffset(axial: Axial): GridPos {
  return { col: axial.q + (axial.r - (axial.r & 1)) / 2, row: axial.r };
}

function addAxial(a: Axial, b: Axial): Axial {
  return { q: a.q + b.q, r: a.r + b.r };
}

function axialDistance(a: Axial, b: Axial): number {
  const dq = a.q - b.q;
  const dr = a.r - b.r;
  return (Math.abs(dq) + Math.abs(dr) + Math.abs(dq + dr)) / 2;
}

/** Arredonda coordenadas axiais fracionárias para o hex que as contém (arredondamento cúbico). */
function roundAxial(q: number, r: number): Axial {
  const s = -q - r;
  let roundedQ = Math.round(q);
  let roundedR = Math.round(r);
  const roundedS = Math.round(s);
  const errorQ = Math.abs(roundedQ - q);
  const errorR = Math.abs(roundedR - r);
  const errorS = Math.abs(roundedS - s);
  if (errorQ > errorR && errorQ > errorS) roundedQ = -roundedR - roundedS;
  else if (errorR > errorS) roundedR = -roundedQ - roundedS;
  // `+ 0` evita -0 (que o deepEqual distingue de 0).
  return { q: roundedQ + 0, r: roundedR + 0 };
}

/** Hexes a distância exatamente `radius` de `center`, em volta (Red Blob: "ring"). */
function axialRing(center: Axial, radius: number): Axial[] {
  if (radius === 0) return [center];
  const ring: Axial[] = [];
  let cursor = addAxial(center, { q: DIRECTIONS[4].q * radius, r: DIRECTIONS[4].r * radius });
  for (const direction of DIRECTIONS) {
    for (let step = 0; step < radius; step++) {
      ring.push(cursor);
      cursor = addAxial(cursor, direction);
    }
  }
  return ring;
}

function axialShape(pos: GridPos, size: Size | undefined): Axial[] {
  const origin = toAxial(pos);
  if (size === "large") return LARGE_SHAPE.map((delta) => addAxial(origin, delta));
  const radius = size ? RING_RADIUS[size] : undefined;
  if (!radius) return [origin];
  const shape: Axial[] = [];
  for (let ring = 0; ring <= radius; ring++) shape.push(...axialRing(origin, ring));
  return shape;
}

function pointyCenter(pos: GridPos): CellPoint {
  return { x: pos.col + 0.5 + (pos.row & 1) * 0.5, y: HEX_RADIUS + pos.row * ROW_STEP };
}

const hexRows: GridGeometry = {
  kind: "hexRows",
  center: pointyCenter,
  cellAt: (point) => {
    // Relativo ao centro do hex (0, 0), que em axial também é (0, 0).
    const x = point.x - 0.5;
    const y = point.y - HEX_RADIUS;
    return toOffset(roundAxial(x - y * HEX_RADIUS, (2 / 3) * (y / HEX_RADIUS)));
  },
  neighbors: (pos) => DIRECTIONS.map((direction) => toOffset(addAxial(toAxial(pos), direction))),
  distance: (a, b) => axialDistance(toAxial(a), toAxial(b)),
  footprint: (pos, size) => axialShape(pos, size).map(toOffset),
  shapeCenter: (pos, size) => {
    // Só o Grande sai do hex de `pos`; Enorme e Imenso são anéis em volta dele.
    if (size !== "large") return pointyCenter(pos);
    const centers = axialShape(pos, size).map((axial) => pointyCenter(toOffset(axial)));
    return {
      x: centers.reduce((sum, point) => sum + point.x, 0) / centers.length,
      y: centers.reduce((sum, point) => sum + point.y, 0) / centers.length,
    };
  },
  drawSpan: (size) => HEX_DRAW_SPAN[size ?? "medium"],
  // A forma fica sobre a casa: Enorme e Imenso têm `pos` no meio; Grande, num canto do triângulo.
  centeredOn: (cell) => cell,
  nearestCellOf: (pos, size, target) => {
    const goal = toAxial(target);
    let best = toAxial(pos);
    for (const axial of axialShape(pos, size)) if (axialDistance(axial, goal) < axialDistance(best, goal)) best = axial;
    return toOffset(best);
  },
  polygon: (pos) => {
    const center = pointyCenter(pos);
    return Array.from({ length: 6 }, (_, corner) => {
      const angle = (Math.PI / 180) * (60 * corner - 30);
      return { x: center.x + HEX_RADIUS * Math.cos(angle), y: center.y + HEX_RADIUS * Math.sin(angle) };
    });
  },
  period: { x: 1, y: 2 * ROW_STEP },
  columnStep: 1,
};

// --- Hex de lado reto em cima ("odd-q"): o de pontas para cima trocando x↔y e col↔row. ---

const swapPos = (pos: GridPos): GridPos => ({ col: pos.row, row: pos.col });
const swapPoint = (point: CellPoint): CellPoint => ({ x: point.y, y: point.x });

const hexCols: GridGeometry = {
  kind: "hexCols",
  center: (pos) => swapPoint(hexRows.center(swapPos(pos))),
  cellAt: (point) => swapPos(hexRows.cellAt(swapPoint(point))),
  neighbors: (pos) => hexRows.neighbors(swapPos(pos)).map(swapPos),
  distance: (a, b) => hexRows.distance(swapPos(a), swapPos(b)),
  footprint: (pos, size) => hexRows.footprint(swapPos(pos), size).map(swapPos),
  shapeCenter: (pos, size) => swapPoint(hexRows.shapeCenter(swapPos(pos), size)),
  drawSpan: hexRows.drawSpan,
  centeredOn: (cell) => cell,
  nearestCellOf: (pos, size, target) => swapPos(hexRows.nearestCellOf(swapPos(pos), size, swapPos(target))),
  polygon: (pos) => hexRows.polygon(swapPos(pos)).map(swapPoint),
  period: swapPoint(hexRows.period),
  columnStep: ROW_STEP,
};

const GEOMETRIES: Record<GridKind, GridGeometry> = { square, hexRows, hexCols };

/** A geometria de uma grade (ausente = quadrado, como nos arquivos antigos). */
export function geometryOf(kind: GridKind | undefined): GridGeometry {
  return GEOMETRIES[kind ?? "square"];
}

/** A cena usa grid hexagonal (de qualquer orientação)? */
export function isHex(map: { grid?: GridKind }): boolean {
  return map.grid === "hexRows" || map.grid === "hexCols";
}

/** Casas que bloqueiam: a forma inteira de cada um, menos os miúdos (que dividem a casa). */
export function occupiedCells(list: { pos: GridPos | null; size?: Size }[], kind: GridKind | undefined): GridPos[] {
  const geometry = geometryOf(kind);
  return list.flatMap((combatant) =>
    combatant.pos && !sharesCell(combatant.size) ? geometry.footprint(combatant.pos, combatant.size) : [],
  );
}

/** Lugar livre mais perto de `start` onde a forma inteira cabe (busca em anéis); miúdo cabe em qualquer casa. */
export function freeSpotNear(
  start: GridPos,
  occupied: GridPos[],
  size: Size | undefined,
  kind: GridKind | undefined,
  maxRadius = 20,
): GridPos {
  if (!kind || kind === "square") return nearestFreeSpot(start, occupied, sizeSpan(size), sharesCell(size), maxRadius);
  if (sharesCell(size)) return start;
  const geometry = geometryOf(kind);
  const taken = new Set(occupied.map((cell) => `${cell.col},${cell.row}`));
  const fits = (pos: GridPos) => geometry.footprint(pos, size).every((cell) => !taken.has(`${cell.col},${cell.row}`));
  // Os anéis são calculados no hex de pontas para cima; o de lado em cima troca col↔row na ida e na volta.
  const toRows = kind === "hexCols" ? swapPos : (pos: GridPos) => pos;
  const origin = toAxial(toRows(start));
  for (let radius = 0; radius <= maxRadius; radius++) {
    for (const axial of axialRing(origin, radius)) {
      const candidate = toRows(toOffset(axial));
      if (fits(candidate)) return candidate;
    }
  }
  return start;
}

/** As duas formas têm alguma casa em comum? */
export function shapesOverlap(
  a: GridPos,
  aSize: Size | undefined,
  b: GridPos,
  bSize: Size | undefined,
  kind: GridKind | undefined,
): boolean {
  if (!kind || kind === "square") return overlaps(a, sizeSpan(aSize), b, sizeSpan(bSize));
  const geometry = geometryOf(kind);
  const cellsOfA = new Set(geometry.footprint(a, aSize).map((cell) => `${cell.col},${cell.row}`));
  return geometry.footprint(b, bSize).some((cell) => cellsOfA.has(`${cell.col},${cell.row}`));
}
