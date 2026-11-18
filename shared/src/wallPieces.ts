import type { LightPoint } from "./light";
import {
  WALL_STYLES,
  WALL_THICKNESS,
  type GridPos,
  type Wall,
  type WallStyle,
} from "./types";
import { wallChains } from "./wallJoin";

/**
 * Paredes na placa de vídeo (docs/design/relevo.md, etapa 2; visual aprovado em `docs/design/paredes-gpu-a/b/c.html`).
 * O processador transforma as paredes em peças (trechos das cadeias, portas e janelas) com tudo o que o shader precisa,
 * e monta um índice por casa (que peças passam perto). Na placa, cada pixel olha só as peças da sua casa e calcula a
 * posição exata na vencedora: assim o veio e as juntas ficam nítidos em qualquer zoom.
 */

export type WallPieceKind = "wall" | "door" | "window";

export interface WallPiece {
  kind: WallPieceKind;
  /** Desenho resolvido (o da parede ou o da cena). */
  style: WallStyle;
  /** Pontas, em casas. Na porta, `a` é a dobradiça. */
  a: LightPoint;
  b: LightPoint;
  /** Espessura, em casas. */
  thickness: number;
  /** Comprimento da cadeia até `a` (casas): o veio continua de um trecho para o outro. */
  along: number;
  /** Quanto a peça passa de `a` e de `b` (casas). */
  reach: [number, number];
  /** De 0 a 1, da primeira parede da cadeia (ou da porta). */
  seed: number;
  door?: {
    open: boolean;
    swing: 1 | -1;
    double: boolean;
    locked: boolean;
    secret: boolean;
  };
  window?: { closed: boolean };
}

/** Semente a partir das pontas da parede (a mesma parede sai sempre igual, em qualquer tela). */
export function wallSeed(
  ax: number,
  ay: number,
  bx: number,
  by: number,
): number {
  let h = 2166136261;
  for (const n of [ax, ay, bx, by]) {
    h ^= Math.round(n * 100);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

/** Como a porta abre: dobradiça na ponta `to` em vez de `from` e para que lado a folha gira. */
export interface DoorLayout {
  hingeAtTo: boolean;
  swing: number;
}

const near = (p: GridPos, q: GridPos) =>
  Math.abs(p.col - q.col) < 0.02 && Math.abs(p.row - q.row) < 0.02;

/**
 * Portas duplas (L5): duas portas em linha que se encostam numa ponta. As dobradiças ficam nas pontas de
 * fora e as duas folhas giram para o mesmo lado, cada uma para a sua ponta. Porta sozinha: dobradiça em `from`.
 */
export function doorLayouts(walls: Wall[]): Map<string, DoorLayout> {
  const doors = walls.filter((w) => w.door);
  const out = new Map<string, DoorLayout>();
  for (let i = 0; i < doors.length; i++) {
    const a = doors[i];
    if (out.has(a.id)) continue;
    for (let j = i + 1; j < doors.length; j++) {
      const b = doors[j];
      if (out.has(b.id)) continue;
      const shared = [a.from, a.to].find(
        (p) => near(p, b.from) || near(p, b.to),
      );
      if (!shared) continue;
      // Em linha: as duas direções são paralelas.
      const da = { x: a.to.col - a.from.col, y: a.to.row - a.from.row };
      const db = { x: b.to.col - b.from.col, y: b.to.row - b.from.row };
      const cross = da.x * db.y - da.y * db.x;
      if (
        Math.abs(cross) >
        0.02 * Math.hypot(da.x, da.y) * Math.hypot(db.x, db.y)
      )
        continue;
      // A dobradiça é a ponta que não é a do meio; as direções (dobradiça → meio) são opostas, então os
      // giros têm sinais opostos para as folhas irem para o mesmo lado.
      out.set(a.id, { hingeAtTo: near(a.from, shared), swing: 1 });
      out.set(b.id, { hingeAtTo: near(b.from, shared), swing: -1 });
      break;
    }
  }
  return out;
}

/** Tira os pontos no meio de uma reta (os encontros em T por onde a parede passa): um trecho longo, uma peça só. */
export function straightenChain(
  points: LightPoint[],
  closed: boolean,
): LightPoint[] {
  const out = points.filter((point, index) => {
    if (!closed && (index === 0 || index === points.length - 1)) return true;
    const previous = points[(index - 1 + points.length) % points.length];
    const next = points[(index + 1) % points.length];
    const ax = point.x - previous.x;
    const ay = point.y - previous.y;
    const bx = next.x - point.x;
    const by = next.y - point.y;
    return (
      Math.abs(ax * by - ay * bx) >
        1e-6 * Math.hypot(ax, ay) * Math.hypot(bx, by) || ax * bx + ay * by < 0
    );
  });
  return out.length >= (closed ? 3 : 2) ? out : points;
}

/** Ponta solta passa um pouco da ponta (fração da espessura, como no desenho do canvas). */
const FREE_END = 0.12;

/** Peças das paredes, portas e janelas. O jogador nunca recebe a marca de trancada nem de secreta. */
export function wallPieces(
  walls: Wall[],
  sceneStyle: WallStyle,
  viewer: { gm: boolean },
): WallPiece[] {
  const pieces: WallPiece[] = [];
  for (const chain of wallChains(walls, sceneStyle)) {
    const points = straightenChain(chain.points, chain.closed);
    const first = chain.points[0];
    const second = chain.points[1] ?? first;
    const seed = wallSeed(first.x, first.y, second.x, second.y) / 2 ** 32;
    const segments = chain.closed ? points.length : points.length - 1;
    const half = chain.thickness / 2;
    const endReach = (end: 0 | 1) =>
      chain.ends[end] === "free"
        ? chain.thickness * FREE_END
        : chain.extend[end];
    let along = 0;
    for (let index = 0; index < segments; index++) {
      const a = points[index];
      const b = points[(index + 1) % points.length];
      const firstSegment = !chain.closed && index === 0;
      const lastSegment = !chain.closed && index === segments - 1;
      pieces.push({
        kind: "wall",
        style: chain.style,
        a,
        b,
        thickness: chain.thickness,
        along,
        reach: [
          firstSegment ? endReach(0) : half,
          lastSegment ? endReach(1) : half,
        ],
        seed,
      });
      along += Math.hypot(b.x - a.x, b.y - a.y);
    }
  }
  const layouts = doorLayouts(walls);
  for (const wall of walls) {
    if (!wall.door && !wall.window) continue;
    const layout = layouts.get(wall.id);
    const [hinge, end] = layout?.hingeAtTo
      ? [wall.to, wall.from]
      : [wall.from, wall.to];
    const piece: WallPiece = {
      kind: wall.door ? "door" : "window",
      style: wall.style ?? sceneStyle,
      a: { x: hinge.col, y: hinge.row },
      b: { x: end.col, y: end.row },
      thickness: wall.thickness ?? WALL_THICKNESS.default,
      along: 0,
      reach: [0, 0],
      seed:
        wallSeed(wall.from.col, wall.from.row, wall.to.col, wall.to.row) /
        2 ** 32,
    };
    if (wall.door) {
      piece.door = {
        open: wall.door.open,
        swing: (layout?.swing ?? 1) < 0 ? -1 : 1,
        double: layout !== undefined,
        locked: viewer.gm && !!wall.door.locked,
        secret: viewer.gm && !!wall.door.secret,
      };
    } else piece.window = { closed: !!wall.window?.closed };
    pieces.push(piece);
  }
  return pieces;
}

/** Casas além do eixo que a peça pode ocupar (sebe ondulada, esteios, muralha; a folha aberta gira o vão inteiro). */
export function pieceMargin(piece: WallPiece): number {
  if (piece.kind === "door")
    return (
      Math.hypot(piece.b.x - piece.a.x, piece.b.y - piece.a.y) + piece.thickness
    );
  return piece.thickness * 1.5 + 0.05;
}

/** Floats por peça na textura: quatro texels RGBA. */
export const PIECE_FLOATS = 16;
const KIND_CODE: Record<WallPieceKind, number> = {
  wall: 0,
  door: 1,
  window: 2,
};
/** Bandeiras somadas no último valor do terceiro texel. */
export const PIECE_FLAGS = {
  open: 1,
  double: 2,
  locked: 4,
  secret: 8,
  closedWindow: 16,
} as const;

/**
 * Peças em floats, `PIECE_FLOATS` cada: (a.x, a.y, b.x, b.y), (espessura, along, semente, desenho em `WALL_STYLES`),
 * (reach de a, reach de b, tipo 0 parede / 1 porta / 2 janela, bandeiras), (giro, 0, 0, 0).
 */
export function packPieces(pieces: WallPiece[]): Float32Array {
  const out = new Float32Array(pieces.length * PIECE_FLOATS);
  pieces.forEach((piece, index) => {
    let flags = 0;
    if (piece.door?.open) flags += PIECE_FLAGS.open;
    if (piece.door?.double) flags += PIECE_FLAGS.double;
    if (piece.door?.locked) flags += PIECE_FLAGS.locked;
    if (piece.door?.secret) flags += PIECE_FLAGS.secret;
    if (piece.window?.closed) flags += PIECE_FLAGS.closedWindow;
    out.set(
      [
        piece.a.x,
        piece.a.y,
        piece.b.x,
        piece.b.y,
        piece.thickness,
        piece.along,
        piece.seed,
        WALL_STYLES.indexOf(piece.style),
        piece.reach[0],
        piece.reach[1],
        KIND_CODE[piece.kind],
        flags,
        piece.door?.swing ?? 1,
        0,
        0,
        0,
      ],
      index * PIECE_FLOATS,
    );
  });
  return out;
}

/** Teto de peças candidatas por casa (ficam as mais perto do centro). */
export const CELL_CANDIDATES = 8;
/** Meia diagonal da casa: um ponto qualquer dela está a no máximo isso do centro. */
const HALF_DIAGONAL = 0.7072;

/**
 * Índice por casa, linha a linha, na caixa `col`, `row`, `cols`, `rows` (casas): `start` e `count` apontam para
 * `list`, os índices das peças que podem cobrir algum ponto da casa.
 */
export interface WallCellIndex {
  col: number;
  row: number;
  cols: number;
  rows: number;
  start: Uint32Array;
  count: Uint8Array;
  list: Uint32Array;
}

/** Distância do ponto ao segmento. */
function segmentDistance(
  x: number,
  y: number,
  a: LightPoint,
  b: LightPoint,
): number {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const lengthSquared = dx * dx + dy * dy;
  const k =
    lengthSquared > 0
      ? Math.min(
          1,
          Math.max(0, ((x - a.x) * dx + (y - a.y) * dy) / lengthSquared),
        )
      : 0;
  return Math.hypot(x - a.x - dx * k, y - a.y - dy * k);
}

/** Que peças passam perto de cada casa; `null` sem peças. */
export function wallCellIndex(pieces: WallPiece[]): WallCellIndex | null {
  if (pieces.length === 0) return null;
  const reachOf = pieces.map(
    (piece) => pieceMargin(piece) + Math.max(piece.reach[0], piece.reach[1]),
  );
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  pieces.forEach((piece, index) => {
    minX = Math.min(
      minX,
      piece.a.x - reachOf[index],
      piece.b.x - reachOf[index],
    );
    minY = Math.min(
      minY,
      piece.a.y - reachOf[index],
      piece.b.y - reachOf[index],
    );
    maxX = Math.max(
      maxX,
      piece.a.x + reachOf[index],
      piece.b.x + reachOf[index],
    );
    maxY = Math.max(
      maxY,
      piece.a.y + reachOf[index],
      piece.b.y + reachOf[index],
    );
  });
  const col = Math.floor(minX);
  const row = Math.floor(minY);
  const cols = Math.max(1, Math.ceil(maxX) - col);
  const rows = Math.max(1, Math.ceil(maxY) - row);
  const candidates: { piece: number; distance: number }[][] = Array.from(
    { length: cols * rows },
    () => [],
  );
  pieces.forEach((piece, index) => {
    const reach = reachOf[index] + HALF_DIAGONAL;
    const fromCol = Math.max(
      col,
      Math.floor(Math.min(piece.a.x, piece.b.x) - reach),
    );
    const toCol = Math.min(
      col + cols - 1,
      Math.floor(Math.max(piece.a.x, piece.b.x) + reach),
    );
    const fromRow = Math.max(
      row,
      Math.floor(Math.min(piece.a.y, piece.b.y) - reach),
    );
    const toRow = Math.min(
      row + rows - 1,
      Math.floor(Math.max(piece.a.y, piece.b.y) + reach),
    );
    for (let cellRow = fromRow; cellRow <= toRow; cellRow++) {
      for (let cellCol = fromCol; cellCol <= toCol; cellCol++) {
        const distance = segmentDistance(
          cellCol + 0.5,
          cellRow + 0.5,
          piece.a,
          piece.b,
        );
        if (distance <= reach)
          candidates[(cellRow - row) * cols + (cellCol - col)].push({
            piece: index,
            distance,
          });
      }
    }
  });
  const start = new Uint32Array(cols * rows);
  const count = new Uint8Array(cols * rows);
  const list: number[] = [];
  candidates.forEach((cell, at) => {
    const kept =
      cell.length > CELL_CANDIDATES
        ? [...cell]
            .sort((one, other) => one.distance - other.distance)
            .slice(0, CELL_CANDIDATES)
        : cell;
    start[at] = list.length;
    count[at] = kept.length;
    for (const entry of kept) list.push(entry.piece);
  });
  return { col, row, cols, rows, start, count, list: Uint32Array.from(list) };
}
