import type { LightPoint } from "./light";
import { seeThrough, WALL_THICKNESS, type Wall, type WallStyle } from "./types";

/**
 * Paredes emendadas (docs/design/paredes.md; teste aprovado em `docs/design/paredes-teste.html`). Só desenho: as
 * paredes guardadas continuam uma por traço e a visão, a névoa e a luz seguem a linha do meio de cada uma. Aqui, em
 * casas: as paredes são cortadas nos encontros, viram um grafo e os trechos que seguem um no outro viram cadeias
 * (desenhadas como uma peça só); as faces fechadas do grafo são os cômodos (o telhado invisível da luz).
 */

/** Ponta da cadeia: solta (passa um pouco da ponta), encostada em outra peça (termina no nó) ou cadeia fechada. */
export type ChainEnd = "free" | "butt" | "closed";

export interface WallChain {
  points: LightPoint[];
  closed: boolean;
  style: WallStyle;
  thickness: number;
  ends: [ChainEnd, ChainEnd];
  /**
   * Quanto cada ponta passa do nó (casas): numa quina sem parede seguindo reto (desenhos ou espessuras diferentes, porta
   * no canto), meia espessura da mais grossa das outras, para o canto de fora não ficar com um dente; senão 0.
   */
  extend: [number, number];
  /** Paredes guardadas que formam a cadeia (os cliques continuam por parede). */
  wallIds: string[];
}

/** Pontas que coincidem até um milésimo de casa são o mesmo nó. */
const NODE_PRECISION = 1000;
/** Diferença máxima de uma reta (rad) para duas paredes seguirem uma na outra num nó de três ou mais. */
const STRAIGHT_TOLERANCE = 0.35;
const EPSILON = 1e-6;

interface Edge {
  index: number;
  a: LightPoint;
  b: LightPoint;
  kind: "wall" | "door" | "window";
  style: WallStyle;
  /** O desenho guardado na parede (sem o da cena): é ele que diz se a parede é vazada. */
  ownStyle: WallStyle | undefined;
  thickness: number;
  wallId: string;
}

interface GraphNode {
  point: LightPoint;
  edges: Edge[];
}

const nodeKey = (point: LightPoint) => `${Math.round(point.x * NODE_PRECISION)},${Math.round(point.y * NODE_PRECISION)}`;
const cross = (ax: number, ay: number, bx: number, by: number) => ax * by - ay * bx;

/** Corta cada parede onde outra encosta, cruza ou se sobrepõe a ela, e junta os trechos repetidos. */
function splitWalls(walls: Wall[], sceneStyle: WallStyle): Edge[] {
  const canonical = new Map<string, LightPoint>();
  const snap = (point: LightPoint): LightPoint => {
    const key = nodeKey(point);
    const known = canonical.get(key);
    if (known) return known;
    canonical.set(key, point);
    return point;
  };
  const edges = new Map<string, Edge>();
  walls.forEach((wall, wallIndex) => {
    const px = wall.from.col;
    const py = wall.from.row;
    const rx = wall.to.col - px;
    const ry = wall.to.row - py;
    const cuts = [0, 1];
    walls.forEach((other, otherIndex) => {
      if (wallIndex === otherIndex) return;
      const qx = other.from.col;
      const qy = other.from.row;
      const sx = other.to.col - qx;
      const sy = other.to.row - qy;
      const denominator = cross(rx, ry, sx, sy);
      if (Math.abs(denominator) < 1e-9) {
        // Paralelas: só importa se estão no mesmo alinhamento (as pontas da outra cortam esta).
        if (Math.abs(cross(qx - px, qy - py, rx, ry)) > EPSILON) return;
        for (const end of [other.from, other.to]) {
          const along = ((end.col - px) * rx + (end.row - py) * ry) / (rx * rx + ry * ry);
          if (along > EPSILON && along < 1 - EPSILON) cuts.push(along);
        }
        return;
      }
      const along = cross(qx - px, qy - py, sx, sy) / denominator;
      const across = cross(qx - px, qy - py, rx, ry) / denominator;
      if (along > -EPSILON && along < 1 + EPSILON && across > -EPSILON && across < 1 + EPSILON) cuts.push(Math.min(1, Math.max(0, along)));
    });
    cuts.sort((first, second) => first - second);
    const kind = wall.door ? "door" : wall.window ? "window" : "wall";
    for (let index = 0; index < cuts.length - 1; index++) {
      if (cuts[index + 1] - cuts[index] < EPSILON) continue;
      const a = snap({ x: px + rx * cuts[index], y: py + ry * cuts[index] });
      const b = snap({ x: px + rx * cuts[index + 1], y: py + ry * cuts[index + 1] });
      if (a === b) continue;
      const id = [nodeKey(a), nodeKey(b)].sort().join("|");
      const known = edges.get(id);
      // Porta e janela valem mais que a parede por baixo delas.
      if (known && (known.kind !== "wall" || kind === "wall")) continue;
      edges.set(id, { index: 0, a, b, kind, style: wall.style ?? sceneStyle, ownStyle: wall.style, thickness: wall.thickness ?? WALL_THICKNESS.default, wallId: wall.id });
    }
  });
  return [...edges.values()].map((edge, index) => ({ ...edge, index }));
}

function buildGraph(edges: Edge[]): Map<string, GraphNode> {
  const nodes = new Map<string, GraphNode>();
  const nodeAt = (point: LightPoint) => {
    const key = nodeKey(point);
    const known = nodes.get(key);
    if (known) return known;
    const created = { point, edges: [] };
    nodes.set(key, created);
    return created;
  };
  for (const edge of edges) {
    nodeAt(edge.a).edges.push(edge);
    nodeAt(edge.b).edges.push(edge);
  }
  return nodes;
}

const otherEnd = (edge: Edge, key: string) => (nodeKey(edge.a) === key ? edge.b : edge.a);
const sameLook = (first: Edge, second: Edge) => first.style === second.style && first.thickness === second.thickness;

/** Em cada nó, que parede segue em qual: duas sozinhas no nó (mesmo desenho e espessura) ou as mais alinhadas. */
function pairings(nodes: Map<string, GraphNode>): Map<string, Edge> {
  const paired = new Map<string, Edge>();
  const pair = (key: string, first: Edge, second: Edge) => {
    paired.set(`${key}|${first.index}`, second);
    paired.set(`${key}|${second.index}`, first);
  };
  for (const [key, node] of nodes) {
    const walls = node.edges.filter((edge) => edge.kind === "wall");
    if (walls.length === 2 && node.edges.length === 2) {
      if (sameLook(walls[0], walls[1])) pair(key, walls[0], walls[1]);
      continue;
    }
    const angle = (edge: Edge) => {
      const end = otherEnd(edge, key);
      return Math.atan2(end.y - node.point.y, end.x - node.point.x);
    };
    const candidates: { gap: number; first: Edge; second: Edge }[] = [];
    for (let i = 0; i < walls.length; i++) {
      for (let j = i + 1; j < walls.length; j++) {
        let difference = Math.abs(angle(walls[i]) - angle(walls[j]));
        if (difference > Math.PI) difference = 2 * Math.PI - difference;
        if (Math.PI - difference < STRAIGHT_TOLERANCE && sameLook(walls[i], walls[j])) candidates.push({ gap: Math.PI - difference, first: walls[i], second: walls[j] });
      }
    }
    candidates.sort((x, y) => x.gap - y.gap);
    const used = new Set<Edge>();
    for (const { first, second } of candidates) {
      if (used.has(first) || used.has(second)) continue;
      used.add(first);
      used.add(second);
      pair(key, first, second);
    }
  }
  return paired;
}

/** Cadeias das paredes comuns (portas e janelas ficam fora e quebram a cadeia). `sceneStyle` = desenho de quem não tem. */
export function wallChains(walls: Wall[], sceneStyle: WallStyle): WallChain[] {
  const edges = splitWalls(walls, sceneStyle);
  const nodes = buildGraph(edges);
  const paired = pairings(nodes);
  const seen = new Set<Edge>();
  const chains: WallChain[] = [];
  const endOf = (point: LightPoint): ChainEnd => ((nodes.get(nodeKey(point))?.edges.length ?? 0) > 1 ? "butt" : "free");
  const extendAt = (point: LightPoint, own: Edge): number => {
    const key = nodeKey(point);
    const others = (nodes.get(key)?.edges ?? []).filter((edge) => edge !== own);
    // Alguém segue reto pelo nó: a ponta termina por baixo dele.
    if (others.length === 0 || others.some((edge) => paired.has(`${key}|${edge.index}`))) return 0;
    return Math.max(...others.map((edge) => edge.thickness)) / 2;
  };
  const walk = (start: Edge, from: LightPoint): WallChain => {
    const points = [from];
    const ids = new Set<string>();
    let current = start;
    let at = from;
    for (;;) {
      seen.add(current);
      ids.add(current.wallId);
      const next = otherEnd(current, nodeKey(at));
      points.push(next);
      const follow = paired.get(`${nodeKey(next)}|${current.index}`);
      if (!follow || seen.has(follow)) {
        const closed = follow === start && next === points[0];
        const shape = closed ? points.slice(0, -1) : points;
        const ends: [ChainEnd, ChainEnd] = closed ? ["closed", "closed"] : [endOf(shape[0]), endOf(shape[shape.length - 1])];
        const extend: [number, number] = closed ? [0, 0] : [extendAt(shape[0], start), extendAt(shape[shape.length - 1], current)];
        return { points: shape, closed, style: start.style, thickness: start.thickness, ends, extend, wallIds: [...ids] };
      }
      current = follow;
      at = next;
    }
  };
  // Começa pelas pontas que não continuam; o que sobrar depois são laços fechados.
  for (const edge of edges) {
    if (edge.kind !== "wall") continue;
    for (const end of [edge.a, edge.b]) if (!seen.has(edge) && !paired.has(`${nodeKey(end)}|${edge.index}`)) chains.push(walk(edge, end));
  }
  for (const edge of edges) if (edge.kind === "wall" && !seen.has(edge)) chains.push(walk(edge, edge.a));
  return chains;
}

/** Cômodos fechados (polígonos em casas, pares x, y): paredes sólidas, portas e janelas; vazadas não fecham. */
export function wallRooms(walls: Wall[]): number[][] {
  const edges = splitWalls(walls, "stone").filter((edge) => !seeThrough(edge.ownStyle));
  interface HalfEdge {
    from: LightPoint;
    to: LightPoint;
    angle: number;
  }
  const outgoing = new Map<string, HalfEdge[]>();
  const halves: HalfEdge[] = [];
  for (const edge of edges) {
    for (const [from, to] of [
      [edge.a, edge.b],
      [edge.b, edge.a],
    ]) {
      const half = { from, to, angle: Math.atan2(to.y - from.y, to.x - from.x) };
      halves.push(half);
      const key = nodeKey(from);
      outgoing.set(key, [...(outgoing.get(key) ?? []), half]);
    }
  }
  // Faces do desenho: de cada meia-aresta, segue para a próxima girando sempre para o mesmo lado.
  const used = new Set<HalfEdge>();
  const rooms: number[][] = [];
  for (const start of halves) {
    if (used.has(start)) continue;
    const polygon: number[] = [];
    let half = start;
    for (let guard = 0; !used.has(half) && guard <= halves.length; guard++) {
      used.add(half);
      polygon.push(half.from.x, half.from.y);
      const back = Math.atan2(half.from.y - half.to.y, half.from.x - half.to.x);
      let best = half;
      let bestTurn = Infinity;
      for (const option of outgoing.get(nodeKey(half.to)) ?? []) {
        let turn = (option.angle - back + 4 * Math.PI) % (2 * Math.PI);
        if (turn < 1e-9) turn = 2 * Math.PI;
        if (turn < bestTurn) {
          bestTurn = turn;
          best = option;
        }
      }
      half = best;
    }
    let area = 0;
    for (let index = 0; index < polygon.length; index += 2) {
      const next = (index + 2) % polygon.length;
      area += polygon[index] * polygon[next + 1] - polygon[next] * polygon[index + 1];
    }
    // Faces limitadas saem num sentido; a de fora de cada grupo de paredes, no outro.
    if (area / 2 < -0.01) rooms.push(polygon);
  }
  return rooms;
}

/**
 * Triângulos de um cômodo (pares x, y, três pontos por triângulo), para o telhado ser desenhado por cima sem depender
 * dos outros cômodos (um cômodo dentro de outro continua coberto). O contorno pode ir e voltar por uma parede em T
 * por dentro: esses vai-e-vem saem antes.
 */
export function triangulate(polygon: number[]): number[] {
  let points: LightPoint[] = [];
  for (let index = 0; index < polygon.length; index += 2) points.push({ x: polygon[index], y: polygon[index + 1] });
  const same = (a: LightPoint, b: LightPoint) => Math.abs(a.x - b.x) < 1e-9 && Math.abs(a.y - b.y) < 1e-9;
  const turn = (a: LightPoint, b: LightPoint, c: LightPoint) => (b.x - a.x) * (c.y - a.y) - (b.y - a.y) * (c.x - a.x);
  // Tira pontos repetidos, idas e voltas (a ponta do T) e pontos no meio de uma reta, até não sobrar nenhum.
  for (let changed = true; changed && points.length >= 3; ) {
    changed = false;
    for (let index = 0; index < points.length && points.length >= 3; index++) {
      const previous = points[(index - 1 + points.length) % points.length];
      const current = points[index];
      const next = points[(index + 1) % points.length];
      if (same(previous, current) || same(previous, next) || Math.abs(turn(previous, current, next)) < 1e-9) {
        points = same(previous, next) && !same(previous, current) ? points.filter((_, at) => at !== index && at !== (index + 1) % points.length) : points.filter((_, at) => at !== index);
        changed = true;
        break;
      }
    }
  }
  if (points.length < 3) return [];
  let area = 0;
  for (let index = 0; index < points.length; index++) {
    const next = points[(index + 1) % points.length];
    area += points[index].x * next.y - next.x * points[index].y;
  }
  const sign = Math.sign(area);
  const inside = (p: LightPoint, a: LightPoint, b: LightPoint, c: LightPoint) => turn(a, b, p) * sign >= 0 && turn(b, c, p) * sign >= 0 && turn(c, a, p) * sign >= 0;
  // Corta "orelhas" (canto convexo sem outro ponto dentro) até sobrar um triângulo.
  const triangles: number[] = [];
  const remaining = [...points];
  for (let guard = 0; remaining.length > 3 && guard < points.length * points.length; guard++) {
    let cut = false;
    for (let index = 0; index < remaining.length; index++) {
      const a = remaining[(index - 1 + remaining.length) % remaining.length];
      const b = remaining[index];
      const c = remaining[(index + 1) % remaining.length];
      if (turn(a, b, c) * sign <= 0) continue;
      if (remaining.some((p) => p !== a && p !== b && p !== c && inside(p, a, b, c))) continue;
      triangles.push(a.x, a.y, b.x, b.y, c.x, c.y);
      remaining.splice(index, 1);
      cut = true;
      break;
    }
    if (!cut) break;
  }
  if (remaining.length === 3) triangles.push(remaining[0].x, remaining[0].y, remaining[1].x, remaining[1].y, remaining[2].x, remaining[2].y);
  return triangles;
}
