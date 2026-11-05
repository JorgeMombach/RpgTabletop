// Mapa do Dungeondraft e similares (Passo 9): o formato aberto Universal VTT (`.dd2vtt`, `.uvtt`, `.df2vtt`).
// Tudo em casas, a partir de `resolution.map_origin`: imagem, paredes (linhas de visão), portas (portais) e luzes.
import { LIMITS } from "./events";
import type { GridPos } from "./types";

type Point = { x: number; y: number };

/** O que o app aproveita do arquivo, já em casas a partir do canto da imagem. */
export interface UvttScene {
  /** Imagem em base64 (sem o prefixo `data:`) e o tipo dela. */
  image: string;
  mime: "image/png" | "image/webp" | "image/jpeg";
  /** Tamanho do mapa em casas (largura × altura da imagem). */
  cols: number;
  rows: number;
  /** Paredes e portas, já simplificadas para caber no limite da cena. */
  walls: { from: GridPos; to: GridPos; door?: { open: boolean } }[];
  /** Luzes do arquivo (muitas são só enfeite: o mestre escolhe se viram tochas). */
  lights: { col: number; row: number }[];
}

/** Recusa com mensagem pronta (o cliente mostra como aviso). */
export class UvttError extends Error {}

const num = (v: unknown): v is number => typeof v === "number" && Number.isFinite(v);
const point = (v: unknown): Point | null => {
  const p = v as Point | null;
  return p && num(p.x) && num(p.y) ? { x: p.x, y: p.y } : null;
};

/** Tipo da imagem pelos primeiros bytes (o arquivo não diz). */
function mimeOf(b64: string): UvttScene["mime"] | null {
  if (b64.startsWith("iVBOR")) return "image/png";
  if (b64.startsWith("UklGR")) return "image/webp";
  if (b64.startsWith("/9j/")) return "image/jpeg";
  return null;
}

/** Distância de `p` à reta de `a` a `b` (Douglas–Peucker). */
function dist(p: Point, a: Point, b: Point): number {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const len = Math.hypot(dx, dy);
  if (len === 0) return Math.hypot(p.x - a.x, p.y - a.y);
  return Math.abs(dy * p.x - dx * p.y + b.x * a.y - b.y * a.x) / len;
}

/** Tira pontos que quase não mudam a linha (curvas de caverna têm centenas). */
function simplify(points: Point[], eps: number): Point[] {
  if (points.length < 3 || eps <= 0) return points;
  let far = 0;
  let idx = 0;
  for (let i = 1; i < points.length - 1; i++) {
    const d = dist(points[i], points[0], points[points.length - 1]);
    if (d > far) [far, idx] = [d, i];
  }
  if (far <= eps) return [points[0], points[points.length - 1]];
  return [...simplify(points.slice(0, idx + 1), eps).slice(0, -1), ...simplify(points.slice(idx), eps)];
}

const cent = (n: number) => Math.round(n * 100) / 100;

/** Segmentos de uma linha: curtos demais somem (um clique), longos demais viram partes. */
function segments(points: Point[]): { from: GridPos; to: GridPos }[] {
  const out: { from: GridPos; to: GridPos }[] = [];
  for (let i = 1; i < points.length; i++) {
    const a = points[i - 1];
    const b = points[i];
    const len = Math.max(Math.abs(b.x - a.x), Math.abs(b.y - a.y));
    if (len < 0.1) continue;
    const parts = Math.ceil(len / LIMITS.wallLength);
    for (let k = 0; k < parts; k++) {
      const p = (t: number) => ({ col: cent(a.x + (b.x - a.x) * t), row: cent(a.y + (b.y - a.y) * t) });
      out.push({ from: p(k / parts), to: p((k + 1) / parts) });
    }
  }
  return out;
}

/**
 * Lê o arquivo Universal VTT. As linhas de visão viram paredes, simplificadas até caber no limite de paredes
 * da cena (sem diferença visível: a tolerância começa em 0,05 casa); se nem assim couber, recusa.
 */
export function parseUvtt(raw: unknown): UvttScene {
  const f = raw as Record<string, unknown> | null;
  if (!f || typeof f !== "object") throw new UvttError("uvtt.notMap");
  const res = f.resolution as { map_origin?: unknown; map_size?: unknown; pixels_per_grid?: unknown } | undefined;
  const size = point(res?.map_size);
  if (!res || !size || size.x <= 0 || size.y <= 0 || !num(res.pixels_per_grid)) throw new UvttError("uvtt.notMap");
  const origin = point(res.map_origin) ?? { x: 0, y: 0 };
  const image = typeof f.image === "string" ? f.image.replace(/^data:[^,]*,/, "") : "";
  const mime = mimeOf(image);
  if (!mime) throw new UvttError("uvtt.noImage");

  const shift = (p: Point): Point => ({ x: p.x - origin.x, y: p.y - origin.y });
  const lines = [...(Array.isArray(f.line_of_sight) ? f.line_of_sight : []), ...(Array.isArray(f.objects_line_of_sight) ? f.objects_line_of_sight : [])]
    .map((l) => (Array.isArray(l) ? l.map(point).filter((p): p is Point => p !== null).map(shift) : []))
    .filter((l) => l.length >= 2);

  const doors = (Array.isArray(f.portals) ? f.portals : []).flatMap((raw) => {
    const p = raw as { bounds?: unknown[]; closed?: unknown };
    const a = point(p?.bounds?.[0]);
    const b = point(p?.bounds?.[1]);
    if (!a || !b) return [];
    return segments([shift(a), shift(b)]).map((s) => ({ ...s, door: { open: p.closed === false } }));
  });

  let walls: UvttScene["walls"] = [];
  for (const eps of [0.05, 0.15, 0.3, 0.6]) {
    walls = lines.flatMap((l) => segments(simplify(l, eps)));
    if (walls.length + doors.length <= LIMITS.walls) break;
  }
  if (walls.length + doors.length > LIMITS.walls) throw new UvttError("uvtt.tooManyWalls");

  const lights = (Array.isArray(f.lights) ? f.lights : []).flatMap((raw) => {
    const p = point((raw as { position?: unknown })?.position);
    return p ? [{ col: cent(p.x - origin.x), row: cent(p.y - origin.y) }] : [];
  });

  return { image, mime, cols: size.x, rows: size.y, walls: [...walls, ...doors], lights };
}
