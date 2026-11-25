import { geometryOf, type CellPoint, type GridGeometry } from "./gridGeometry";
import { PROP_DEFAULTS, seeThrough, type GridKind, type GridPos, type LightId, type MapProp, type Size, type Wall } from "./types";

/**
 * Névoa de guerra (G): casas reveladas, por linha, em intervalos de colunas `[início, fim)` ordenados
 * e sem sobreposição: `{ "3": [0, 5, 8, 10] }` = na linha 3, colunas 0–4 e 8–9. O resto está coberto.
 * Assim um salão inteiro revelado custa poucos números por linha (vai em todo envio de estado).
 */
export interface FogState {
  enabled: boolean;
  /** Revelado pelo mestre: visível de verdade (inimigos inclusive). */
  revealed: Record<string, number[]>;
  /** Visão dos personagens (parte 3): cada aliado no mapa revela em volta dele, com as paredes bloqueando. */
  vision: boolean;
  /** Já visto por algum aliado: fica escurecido e sem os inimigos de agora (mesmo formato de `revealed`). */
  explored: Record<string, number[]>;
  /** Inimigos que saíram da vista: onde foram vistos pela última vez (some quando alguém volta a ver o lugar). */
  lastSeen: LastSeen[];
  /**
   * Alcance da visão dos personagens nesta cena, em pés, igual para todos (mapa grande e aberto, grid
   * pequeno). `null` = pela luz do clima, com visão no escuro e tocha.
   */
  range: number | null;
  /** NPCs que o grupo já encontrou (com a visão ligada): continuam à vista, sem "?", até o mestre cobrir o lugar. */
  foundNpcs: string[];
}

/** Marca de "visto por último aqui": nome e lugar (casas ocupadas) de quando o grupo o perdeu de vista. */
export interface LastSeen {
  id: string;
  name: string;
  pos: GridPos;
  span: number;
}

/** Retângulo de casas: `w` × `h` a partir de `col`, `row`. */
export interface FogRect {
  col: number;
  row: number;
  w: number;
  h: number;
}

export function emptyFog(): FogState {
  return { enabled: false, revealed: {}, vision: false, explored: {}, lastSeen: [], range: null, foundNpcs: [] };
}

/** Junta `[s, e)` aos intervalos (mantendo ordenados e sem sobreposição). */
function addInterval(list: number[], s: number, e: number): number[] {
  const out: number[] = [];
  let placed = false;
  for (let i = 0; i < list.length; i += 2) {
    const a = list[i];
    const b = list[i + 1];
    if (b < s) out.push(a, b);
    else if (a > e) {
      if (!placed) out.push(s, e);
      placed = true;
      out.push(a, b);
    } else {
      // Encosta ou sobrepõe: vira um intervalo só.
      s = Math.min(s, a);
      e = Math.max(e, b);
    }
  }
  if (!placed) out.push(s, e);
  return out;
}

/** Tira `[s, e)` dos intervalos. */
function removeInterval(list: number[], s: number, e: number): number[] {
  const out: number[] = [];
  for (let i = 0; i < list.length; i += 2) {
    const a = list[i];
    const b = list[i + 1];
    if (b <= s || a >= e) out.push(a, b);
    else {
      if (a < s) out.push(a, s);
      if (b > e) out.push(e, b);
    }
  }
  return out;
}

/** Acrescenta (ou tira) um retângulo de casas num mapa de linhas. Altera `rows`. */
export function paintRows(rows: Record<string, number[]>, rect: FogRect, add: boolean) {
  for (let row = rect.row; row < rect.row + rect.h; row++) {
    const key = String(row);
    const list = rows[key] ?? [];
    const next = add ? addInterval(list, rect.col, rect.col + rect.w) : removeInterval(list, rect.col, rect.col + rect.w);
    if (next.length > 0) rows[key] = next;
    else delete rows[key];
  }
}

/** A casa está no mapa de linhas. */
export function inRows(rows: Record<string, number[]>, col: number, row: number): boolean {
  const list = rows[String(row)];
  if (!list) return false;
  for (let i = 0; i < list.length; i += 2) if (col >= list[i] && col < list[i + 1]) return true;
  return false;
}

/** Revela (ou cobre) um retângulo de casas. Cobrir apaga também o que já foi explorado. Altera `fog`. */
export function paintFog(fog: FogState, rect: FogRect, reveal: boolean) {
  paintRows(fog.revealed, rect, reveal);
  if (!reveal) paintRows(fog.explored, rect, false);
}

/** A casa está revelada pelo mestre (ou a névoa está desligada). */
export function isRevealed(fog: FogState, col: number, row: number): boolean {
  return !fog.enabled || inRows(fog.revealed, col, row);
}

/** Alguma das casas está visível. */
export function anyRevealed(fog: FogState, cells: GridPos[]): boolean {
  return !fog.enabled || cells.some((c) => isRevealed(fog, c.col, c.row));
}

/** As quatro casas em volta de um canto do grid (paredes e origens de área ficam nos cantos ou centros). */
export function cellsAroundPoint(col: number, row: number): GridPos[] {
  const c = Math.floor(col);
  const r = Math.floor(row);
  // Ponto no meio de uma casa: só ela.
  if (col !== c || row !== r) return [{ col: c, row: r }];
  return [
    { col: c - 1, row: r - 1 },
    { col: c, row: r - 1 },
    { col: c - 1, row: r },
    { col: c, row: r },
  ];
}

/**
 * Casas em volta de um ponto (origem de área, objeto): no quadrado, as de `cellsAroundPoint`; no hex (Passo 16),
 * a casa do ponto e as vizinhas cujo centro fica a até um raio de hex dele (num vértice, os 3 hexes).
 */
export function cellsAroundPointIn(point: CellPoint, kind: GridKind | undefined): GridPos[] {
  if (!kind || kind === "square") return cellsAroundPoint(point.x, point.y);
  const geometry = geometryOf(kind);
  const cell = geometry.cellAt(point);
  const reach = 1 / Math.sqrt(3) + 0.01;
  const near = geometry.neighbors(cell).filter((neighbor) => {
    const center = geometry.center(neighbor);
    return Math.hypot(center.x - point.x, center.y - point.y) <= reach;
  });
  return [cell, ...near];
}

/** Casas da caixa entre dois pontos (com uma de folga), para varrer uma região em qualquer grade. */
function cellsInBox(geometry: GridGeometry, minX: number, minY: number, maxX: number, maxY: number): GridPos[] {
  const corners = [
    geometry.cellAt({ x: minX, y: minY }),
    geometry.cellAt({ x: maxX, y: minY }),
    geometry.cellAt({ x: minX, y: maxY }),
    geometry.cellAt({ x: maxX, y: maxY }),
  ];
  const cols = corners.map((cell) => cell.col);
  const rows = corners.map((cell) => cell.row);
  const out: GridPos[] = [];
  for (let col = Math.min(...cols) - 1; col <= Math.max(...cols) + 1; col++)
    for (let row = Math.min(...rows) - 1; row <= Math.max(...rows) + 1; row++) out.push({ col, row });
  return out;
}

/** Casas cujo centro cai no retângulo entre os dois pontos (retângulo da névoa e *Revelar o mapa* no hex). */
export function cellsWithCenterIn(a: CellPoint, b: CellPoint, kind: GridKind): GridPos[] {
  const geometry = geometryOf(kind);
  const [minX, maxX] = [Math.min(a.x, b.x), Math.max(a.x, b.x)];
  const [minY, maxY] = [Math.min(a.y, b.y), Math.max(a.y, b.y)];
  return cellsInBox(geometry, minX, minY, maxX, maxY).filter((cell) => {
    const center = geometry.center(cell);
    return center.x >= minX && center.x <= maxX && center.y >= minY && center.y <= maxY;
  });
}

/** Parede ou porta que bloqueia a passagem: toda parede e porta fechada (inclusive a secreta). */
export function blocks(w: Wall): boolean {
  // Janela: só com a persiana fechada (docs/design/paredes.md), qualquer que seja o desenho da parede.
  if (w.window) return !!w.window.closed;
  // Cerca, grade, arame, sebe e muro baixo deixam ver, mesmo com o portão fechado.
  if (seeThrough(w.style)) return false;
  return !w.door || !w.door.open;
}

/**
 * Objetos que bloqueiam viram um octógono de "paredes" em volta do pé (raio do tipo × tamanho), para entrar na
 * conta da visão. Não entram no *Cômodo* da névoa (uma árvore não fecha uma sala).
 */
export function propOccluders(props: MapProp[]): Wall[] {
  const out: Wall[] = [];
  for (const p of props) {
    if (!p.blocks) continue;
    const r = PROP_DEFAULTS[p.kind].foot * p.size;
    const at = (k: number) => ({ col: p.col + Math.cos((k * Math.PI) / 4) * r, row: p.row + Math.sin((k * Math.PI) / 4) * r });
    for (let k = 0; k < 8; k++) out.push({ id: `${p.id}:${k}`, from: at(k), to: at(k + 1) });
  }
  return out;
}

type P = { x: number; y: number };

/** Os segmentos se cruzam de verdade (encostar na ponta não conta). */
/**
 * A linha de (ax, ay) a (bx, by) cruza a parede: a mesma conta de `crosses`, sem criar objetos (a visão roda isto para
 * cada casa e cada parede perto: criar dois pontos por teste deixava a conta 3 a 4 vezes mais lenta).
 */
function crossesWall(ax: number, ay: number, bx: number, by: number, w: Wall): boolean {
  const cx = w.from.col, cy = w.from.row, dx = w.to.col, dy = w.to.row;
  const abx = bx - ax, aby = by - ay;
  if (Math.sign(abx * (cy - ay) - aby * (cx - ax)) * Math.sign(abx * (dy - ay) - aby * (dx - ax)) >= 0) return false;
  const cdx = dx - cx, cdy = dy - cy;
  return Math.sign(cdx * (ay - cy) - cdy * (ax - cx)) * Math.sign(cdx * (by - cy) - cdy * (bx - cx)) < 0;
}

function crosses(a: P, b: P, c: P, d: P): boolean {
  const o = (p: P, q: P, r: P) => Math.sign((q.x - p.x) * (r.y - p.y) - (q.y - p.y) * (r.x - p.x));
  return o(a, b, c) * o(a, b, d) < 0 && o(c, d, a) * o(c, d, b) < 0;
}

/**
 * Pontos de referência das casas: o centro, deslocado um nadinha. Assim nenhuma linha entre casas passa
 * exatamente pela ponta de uma parede, e uma casa cortada por parede diagonal fica de um lado só.
 */
const NUDGE = { x: 0.5013, y: 0.5071 };

/** No hex (Passo 16), o mesmo empurrãozinho em volta do centro; o alvo da visão leva outro, para a linha nunca passar exata por um vértice. */
const NUDGE_HEX = { x: 0.0013, y: 0.0071 };
const TARGET_NUDGE_HEX = { x: 0.0031, y: -0.0023 };

/**
 * Casa vista em parte (decisão do dono, 2026-11-25): além do centro, pontos a esta fração do caminho do centro até cada
 * canto. Se qualquer um aparece, a casa é vista (a borda da visão na névoa sai lisa, sem degrau atrás da ponta das
 * paredes). Os pontos ficam dentro da casa: parede no lado dela continua escondendo a casa vizinha.
 */
const PARTIAL_TOWARD_CORNER = 0.7;

/** As 8 casas em volta, no quadrado (a beira da sombra pode ser na diagonal). */
const SQUARE_AROUND: [number, number][] = [[-1, -1], [0, -1], [1, -1], [-1, 0], [1, 0], [-1, 1], [0, 1], [1, 1]];

/** Os pontos da casa que contam para ela ser vista (o primeiro é o centro, que mede o alcance). */
function sightSamples(cell: GridPos, kind: GridKind | undefined): P[] {
  const center = referencePoint(cell, kind, TARGET_NUDGE_HEX);
  const corners = !kind || kind === "square"
    ? [{ x: cell.col, y: cell.row }, { x: cell.col + 1, y: cell.row }, { x: cell.col, y: cell.row + 1 }, { x: cell.col + 1, y: cell.row + 1 }]
    : geometryOf(kind).polygon(cell);
  return [center, ...corners.map((corner) => ({ x: center.x + (corner.x - center.x) * PARTIAL_TOWARD_CORNER, y: center.y + (corner.y - center.y) * PARTIAL_TOWARD_CORNER }))];
}

/** Ponto de referência da casa: no quadrado, o centro com `NUDGE`; no hex, o centro da geometria com o empurrão dado. */
function referencePoint(cell: GridPos, kind: GridKind | undefined, nudge = NUDGE_HEX): P {
  if (!kind || kind === "square") return { x: cell.col + NUDGE.x, y: cell.row + NUDGE.y };
  const center = geometryOf(kind).center(cell);
  return { x: center.x + nudge.x, y: center.y + nudge.y };
}

/** Dá para passar da casa `a` para a vizinha `b` sem atravessar nenhuma parede (`walls` já filtradas). */
export function canPass(a: GridPos, b: GridPos, walls: Wall[], kind?: GridKind): boolean {
  const pa = referencePoint(a, kind);
  const pb = referencePoint(b, kind);
  const minX = Math.min(pa.x, pb.x);
  const maxX = Math.max(pa.x, pb.x);
  const minY = Math.min(pa.y, pb.y);
  const maxY = Math.max(pa.y, pb.y);
  for (const w of walls) {
    // Parede longe: nem testa.
    if (Math.max(w.from.col, w.to.col) < minX || Math.min(w.from.col, w.to.col) > maxX) continue;
    if (Math.max(w.from.row, w.to.row) < minY || Math.min(w.from.row, w.to.row) > maxY) continue;
    if (crosses(pa, pb, { x: w.from.col, y: w.from.row }, { x: w.to.col, y: w.to.row })) return false;
  }
  return true;
}

/**
 * O cômodo de uma casa: todas as casas alcançáveis dela sem atravessar parede ou porta fechada
 * (andando para os lados, não na diagonal). `null` se passar de `max` casas: a área não fecha.
 */
export function roomCells(start: GridPos, walls: Wall[], max: number, kind?: GridKind): GridPos[] | null {
  // Janela, aberta ou fechada, segura o cômodo como a parede (o mesmo cômodo do telhado invisível).
  const solid = walls.filter((w) => blocks(w) || !!w.window);
  const key = (c: GridPos) => `${c.col},${c.row}`;
  const seen = new Set([key(start)]);
  const out: GridPos[] = [start];
  for (let i = 0; i < out.length; i++) {
    const c = out[i];
    const around = !kind || kind === "square" ? [[1, 0], [-1, 0], [0, 1], [0, -1]].map(([dc, dr]) => ({ col: c.col + dc, row: c.row + dr })) : geometryOf(kind).neighbors(c);
    for (const n of around) {
      const k = key(n);
      if (seen.has(k) || !canPass(c, n, solid, kind)) continue;
      seen.add(k);
      out.push(n);
      if (out.length > max) return null;
    }
  }
  return out;
}

/** Casas soltas viram retângulos de uma linha (trechos seguidos juntos), para pintar de uma vez. */
export function cellsToRects(cells: GridPos[]): FogRect[] {
  const byRow = new Map<number, number[]>();
  for (const c of cells) {
    const list = byRow.get(c.row) ?? [];
    list.push(c.col);
    byRow.set(c.row, list);
  }
  const out: FogRect[] = [];
  for (const [row, cols] of byRow) {
    cols.sort((a, b) => a - b);
    let s = cols[0];
    for (let i = 1; i <= cols.length; i++) {
      if (i < cols.length && cols[i] === cols[i - 1] + 1) continue;
      out.push({ col: s, row, w: cols[i - 1] - s + 1, h: 1 });
      s = cols[i];
    }
  }
  return out;
}

/**
 * Raio de visão (pés) pela luz do clima: de dia vê longe; à noite, a luz de uma tocha.
 * Visão no escuro garante 60 ft quando não é dia. O app não aplica regra nenhuma além disso (ADR-06).
 */
export const VISION_FEET: Record<LightId, number> = { day: 120, dusk: 60, moon: 30, night: 20 };
export const DARKVISION_FEET = 60;
/** Tocha: 20 ft de luz forte e mais 20 de meia-luz. */
export const TORCH_FEET = 40;
export const TORCH_BRIGHT_FEET = 20;

export function visionFeet(light: LightId, darkvision: boolean, torch = false): number {
  let feet = VISION_FEET[light];
  if (light !== "day" && darkvision) feet = Math.max(feet, DARKVISION_FEET);
  if (light !== "day" && torch) feet = Math.max(feet, TORCH_FEET);
  return feet;
}

/** Quem enxerga: onde está (canto de cima à esquerda), quantas casas ocupa e até onde vê (pés). */
export interface Viewer {
  pos: GridPos;
  span: number;
  feet: number;
  /** Só no hex (Passo 16): o tamanho, para a forma e o meio dela. */
  size?: Size;
  /** Só no hex: de onde a luz sai, quando não é o meio de uma casa (tocha fixa). */
  point?: CellPoint;
}

/**
 * Casas que os aliados veem agora: dentro do raio de cada um e sem parede ou porta fechada no caminho
 * entre o centro dele e o centro da casa. Os pontos levam um deslocamento mínimo (como no cômodo) para
 * a linha nunca passar exatamente pela ponta de uma parede.
 */
export function sightCells(viewers: Viewer[], walls: Wall[], feetPerCell: number, lights: Viewer[] = [], lightReachFeet = VISION_FEET.day, kind?: GridKind): GridPos[] {
  if (kind && kind !== "square") return hexSightCells(viewers, walls, feetPerCell, lights, lightReachFeet, kind);
  const solid = walls.filter(blocks);
  const seen = new Set<string>();
  const out: GridPos[] = [];
  const add = (col: number, row: number) => {
    const k = `${col},${row}`;
    if (seen.has(k)) return;
    seen.add(k);
    out.push({ col, row });
  };
  for (const v of viewers) {
    const r = v.feet / feetPerCell + v.span / 2;
    const o = { x: v.pos.col + v.span / 2 + 0.0013, y: v.pos.row + v.span / 2 + 0.0071 };
    // Só as paredes que chegam perto.
    const near = solid.filter(
      (w) =>
        Math.max(w.from.col, w.to.col) >= o.x - r - 1 &&
        Math.min(w.from.col, w.to.col) <= o.x + r + 1 &&
        Math.max(w.from.row, w.to.row) >= o.y - r - 1 &&
        Math.min(w.from.row, w.to.row) <= o.y + r + 1,
    );
    // A tocha fixa fica em qualquer ponto: conta a casa inteira onde ela cai.
    for (let dc = 0; dc < v.span; dc++) for (let dr = 0; dr < v.span; dr++) add(Math.floor(v.pos.col) + dc, Math.floor(v.pos.row) + dr);
    const hidden: GridPos[] = [];
    const blockedFrom = (point: P) => near.some((w) => crossesWall(o.x, o.y, point.x, point.y, w));
    for (let col = Math.floor(o.x - r); col <= Math.ceil(o.x + r); col++) {
      for (let row = Math.floor(o.y - r); row <= Math.ceil(o.y + r); row++) {
        const t = { x: col + NUDGE.x, y: row + NUDGE.y };
        if (Math.hypot(t.x - o.x, t.y - o.y) > r) continue;
        if (blockedFrom(t)) hidden.push({ col, row });
        else add(col, row);
      }
    }
    // Vista em parte: só uma casa na beira da sombra (vizinha de uma vista pelo centro) pode ter um canto à vista.
    for (const cell of hidden) {
      if (!SQUARE_AROUND.some(([dc, dr]) => seen.has(`${cell.col + dc},${cell.row + dr}`))) continue;
      if (sightSamples(cell, undefined).slice(1).some((point) => !blockedFrom(point))) add(cell.col, cell.row);
    }
  }
  // Luz de tochas (de qualquer um): a área iluminada aparece para quem tem linha de visão até ela,
  // até onde se enxerga de dia (ou o alcance da cena). Um inimigo com tocha no fim do corredor escuro é visto de longe.
  if (lights.length > 0 && viewers.length > 0) {
    const reach = lightReachFeet / feetPerCell;
    for (const c of sightCells(lights, walls, feetPerCell)) {
      if (seen.has(`${c.col},${c.row}`)) continue;
      const samples = sightSamples(c, undefined);
      const t = samples[0];
      const visible = viewers.some((v) => {
        const o = { x: v.pos.col + v.span / 2 + 0.0013, y: v.pos.row + v.span / 2 + 0.0071 };
        if (Math.hypot(t.x - o.x, t.y - o.y) > reach) return false;
        return samples.some((point) => !solid.some((w) => crossesWall(o.x, o.y, point.x, point.y, w)));
      });
      if (visible) add(c.col, c.row);
    }
  }
  return out;
}

/** Paredes que chegam perto do círculo de visão (as outras nem entram na conta). */
function wallsNear(solid: Wall[], origin: P, reach: number): Wall[] {
  return solid.filter(
    (w) =>
      Math.max(w.from.col, w.to.col) >= origin.x - reach - 1 &&
      Math.min(w.from.col, w.to.col) <= origin.x + reach + 1 &&
      Math.max(w.from.row, w.to.row) >= origin.y - reach - 1 &&
      Math.min(w.from.row, w.to.row) <= origin.y + reach + 1,
  );
}

/**
 * Visão no grid hex (Passo 16): a mesma conta do quadrado, com os centros da geometria. Quem vê olha do meio da
 * forma (ou do ponto exato da tocha fixa); cada casa conta pelo centro, com um empurrãozinho diferente do de quem vê.
 */
function hexSightCells(viewers: Viewer[], walls: Wall[], feetPerCell: number, lights: Viewer[], lightReachFeet: number, kind: GridKind): GridPos[] {
  const geometry = geometryOf(kind);
  const solid = walls.filter(blocks);
  const seen = new Set<string>();
  const out: GridPos[] = [];
  const add = (cell: GridPos) => {
    const k = `${cell.col},${cell.row}`;
    if (seen.has(k)) return;
    seen.add(k);
    out.push(cell);
  };
  const originOf = (v: Viewer): P => {
    const middle = v.point ?? geometry.shapeCenter(v.pos, v.size);
    return { x: middle.x + NUDGE_HEX.x, y: middle.y + NUDGE_HEX.y };
  };
  const blocked = (from: P, to: P, list: Wall[]) => list.some((w) => crossesWall(from.x, from.y, to.x, to.y, w));
  for (const v of viewers) {
    const origin = originOf(v);
    const reach = v.feet / feetPerCell + (v.point ? 0.5 : geometry.drawSpan(v.size) / 2);
    const near = wallsNear(solid, origin, reach);
    // As casas de quem vê (a da tocha fixa: onde ela cai) contam sempre.
    for (const own of v.point ? [geometry.cellAt(v.point)] : geometry.footprint(v.pos, v.size)) add(own);
    const hidden: GridPos[] = [];
    for (const cell of cellsInBox(geometry, origin.x - reach, origin.y - reach, origin.x + reach, origin.y + reach)) {
      const point = referencePoint(cell, kind, TARGET_NUDGE_HEX);
      if (Math.hypot(point.x - origin.x, point.y - origin.y) > reach) continue;
      if (blocked(origin, point, near)) hidden.push(cell);
      else add(cell);
    }
    // Vista em parte: só na beira da sombra (vizinha de uma vista pelo centro).
    for (const cell of hidden) {
      if (!geometry.neighbors(cell).some((next) => seen.has(`${next.col},${next.row}`))) continue;
      if (sightSamples(cell, kind).slice(1).some((sample) => !blocked(origin, sample, near))) add(cell);
    }
  }
  // Luz de tochas: a área iluminada aparece para quem tem linha de visão até ela (como no quadrado).
  if (lights.length > 0 && viewers.length > 0) {
    const reach = lightReachFeet / feetPerCell;
    for (const cell of hexSightCells(lights, walls, feetPerCell, [], lightReachFeet, kind)) {
      if (seen.has(`${cell.col},${cell.row}`)) continue;
      const samples = sightSamples(cell, kind);
      const point = samples[0];
      const visible = viewers.some((v) => {
        const origin = originOf(v);
        return Math.hypot(point.x - origin.x, point.y - origin.y) <= reach && samples.some((sample) => !blocked(origin, sample, solid));
      });
      if (visible) add(cell);
    }
  }
  return out;
}
