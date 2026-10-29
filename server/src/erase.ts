import type { Drawing, GridPos, Wall } from "@rpg/shared";

/**
 * Borracha (M): apaga só por onde passa. O caminho é uma linha de pontos com um raio em volta (uma "cápsula"
 * em cada trecho); o que cai dentro some. Traço livre e parede são cortados; seta, círculo e porta, inteiros.
 */

type P = { x: number; y: number };

/** Distância do ponto `p` ao trecho `a`–`b`. */
function toSegment(p: P, a: P, b: P): number {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const len2 = dx * dx + dy * dy;
  const t = len2 === 0 ? 0 : Math.max(0, Math.min(1, ((p.x - a.x) * dx + (p.y - a.y) * dy) / len2));
  return Math.hypot(p.x - (a.x + t * dx), p.y - (a.y + t * dy));
}

function crosses(a: P, b: P, c: P, d: P): boolean {
  const o = (p: P, q: P, r: P) => Math.sign((q.x - p.x) * (r.y - p.y) - (q.y - p.y) * (r.x - p.x));
  return o(a, b, c) * o(a, b, d) < 0 && o(c, d, a) * o(c, d, b) < 0;
}

/** Distância entre dois trechos. */
function segToSeg(a: P, b: P, c: P, d: P): number {
  if (crosses(a, b, c, d)) return 0;
  return Math.min(toSegment(a, c, d), toSegment(b, c, d), toSegment(c, a, b), toSegment(d, a, b));
}

/** Caminho da borracha em pontos (um clique só = um ponto, trecho de tamanho zero). */
export function pathOf(numbers: number[]): P[][] {
  const pts: P[] = [];
  for (let i = 0; i + 1 < numbers.length; i += 2) pts.push({ x: numbers[i], y: numbers[i + 1] });
  if (pts.length === 1) return [[pts[0], pts[0]]];
  const out: P[][] = [];
  for (let i = 0; i + 1 < pts.length; i++) out.push([pts[i], pts[i + 1]]);
  return out;
}

function nearPath(p: P, path: P[][], r: number): boolean {
  return path.some(([a, b]) => toSegment(p, a, b) <= r);
}

/** Resultado da borracha num desenho: igual (`null`), apagado (`[]`) ou os pedaços que sobraram (pontos). */
export function eraseDrawing(d: Drawing, path: P[][], radius: number, maxNumbers: number): number[][] | null {
  // Conta a espessura do traço: encostar na borda já apaga.
  const r = radius + d.width / 2;
  const [x0, y0, x1, y1] = d.points;
  if (d.kind === "arrow") {
    const a = { x: x0, y: y0 };
    const b = { x: x1, y: y1 };
    return path.some(([c, e]) => segToSeg(a, b, c, e) <= r) ? [] : null;
  }
  if (d.kind === "circle") {
    const center = { x: x0, y: y0 };
    const R = Math.hypot(x1 - x0, y1 - y0);
    // Encosta no aro: a parte do trecho mais perto do centro fica dentro e a mais longe, fora (com o raio).
    const hit = path.some(([a, b]) => {
      const near = toSegment(center, a, b);
      const far = Math.max(Math.hypot(a.x - center.x, a.y - center.y), Math.hypot(b.x - center.x, b.y - center.y));
      return near <= R + r && far >= R - r;
    });
    return hit ? [] : null;
  }
  // Traço livre: perto da borracha, os trechos ganham pontos a cada meio raio, para o corte cair no lugar certo.
  const pts: P[] = [];
  for (let i = 0; i + 1 < d.points.length; i += 2) pts.push({ x: d.points[i], y: d.points[i + 1] });
  const dense: P[] = [pts[0]];
  for (let i = 1; i < pts.length; i++) {
    const a = pts[i - 1];
    const b = pts[i];
    const len = Math.hypot(b.x - a.x, b.y - a.y);
    const close = path.some(([c, e]) => segToSeg(a, b, c, e) <= r);
    const steps = close ? Math.min(200, Math.ceil(len / Math.max(1, r / 2))) : 1;
    for (let k = 1; k <= steps; k++) dense.push({ x: a.x + ((b.x - a.x) * k) / steps, y: a.y + ((b.y - a.y) * k) / steps });
  }
  const keep = dense.map((p) => !nearPath(p, path, r));
  if (keep.every(Boolean)) return null;
  const pieces: number[][] = [];
  let cur: number[] = [];
  const flush = () => {
    // Pedaço com um ponto só não é traço.
    if (cur.length >= 4) pieces.push(cur.length > maxNumbers ? cur.slice(0, maxNumbers) : cur);
    cur = [];
  };
  dense.forEach((p, i) => {
    if (keep[i]) cur.push(Math.round(p.x * 2) / 2, Math.round(p.y * 2) / 2);
    else flush();
  });
  flush();
  return pieces;
}

/**
 * Resultado da borracha numa parede (em casas): igual (`null`), apagada (`[]`) ou os trechos que sobraram.
 * Porta tocada some inteira. O corte é medido a cada quarto do raio ao longo da parede.
 */
export function eraseWall(w: Wall, path: P[][], radius: number): { from: GridPos; to: GridPos }[] | null {
  const a = { x: w.from.col, y: w.from.row };
  const b = { x: w.to.col, y: w.to.row };
  if (!path.some(([c, e]) => segToSeg(a, b, c, e) <= radius)) return null;
  if (w.door) return [];
  const len = Math.hypot(b.x - a.x, b.y - a.y);
  const n = Math.min(4000, Math.max(2, Math.ceil(len / (radius / 4))));
  const at = (t: number) => ({ x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t });
  const out: { from: GridPos; to: GridPos }[] = [];
  let start: number | null = null;
  const cent = (v: number) => Math.round(v * 100) / 100;
  const close = (t0: number, t1: number) => {
    // Sobra menor que um décimo de casa: some junto.
    if ((t1 - t0) * len < 0.1) return;
    const p = at(t0);
    const q = at(t1);
    out.push({ from: { col: cent(p.x), row: cent(p.y) }, to: { col: cent(q.x), row: cent(q.y) } });
  };
  const inside = (t: number) => nearPath(at(t), path, radius);
  /** Ponto exato da borda da borracha entre duas medidas (uma dentro, outra fora). */
  const edge = (out: number, inn: number) => {
    for (let k = 0; k < 16; k++) {
      const mid = (out + inn) / 2;
      if (inside(mid)) inn = mid;
      else out = mid;
    }
    return out;
  };
  let prev = 0;
  for (let i = 0; i <= n; i++) {
    const t = i / n;
    const hit = inside(t);
    if (!hit && start === null) start = i === 0 ? 0 : edge(t, prev);
    if (hit && start !== null) {
      close(start, edge(prev, t));
      start = null;
    }
    prev = t;
  }
  // Encostou só de raspão, sem nenhuma medida dentro: fica como está.
  if (start === 0) return null;
  if (start !== null) close(start, 1);
  return out;
}
