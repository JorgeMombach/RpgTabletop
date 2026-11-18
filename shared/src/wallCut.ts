import type { GridPos, Wall } from "./types";

/**
 * Porta ou janela traçada por cima de parede (docs/design/paredes.md): as paredes comuns no mesmo alinhamento que o
 * vão cobre são cortadas; o que sobra delas fora do vão continua parede (mesmo desenho e espessura). Sem isso, a parede
 * de baixo continuaria segurando a visão com a porta aberta.
 */

/** Distância máxima da linha do vão (casas) para a parede contar como "no mesmo alinhamento". */
const ALIGN_TOLERANCE = 0.05;
/** Pedaço que sobra menor que isso (o mesmo mínimo de uma parede) some. */
const MIN_PIECE = 0.1;

/** Paredes comuns no mesmo alinhamento do vão (folga 0,05) que ele cobre, e o que sobra delas fora do vão (≥ 0,1 casa). */
export function cutUnder(opening: { from: GridPos; to: GridPos }, walls: Wall[]): { cut: Wall[]; pieces: Omit<Wall, "id">[] } {
  const ox = opening.from.col;
  const oy = opening.from.row;
  const dx = opening.to.col - ox;
  const dy = opening.to.row - oy;
  const length = Math.hypot(dx, dy);
  const cut: Wall[] = [];
  const pieces: Omit<Wall, "id">[] = [];
  if (length < 1e-9) return { cut, pieces };
  const ux = dx / length;
  const uy = dy / length;
  // Posição ao longo do vão (0 = início, `length` = fim) e distância até a linha dele.
  const along = (point: GridPos) => (point.col - ox) * ux + (point.row - oy) * uy;
  const off = (point: GridPos) => Math.abs((point.col - ox) * uy - (point.row - oy) * ux);
  for (const wall of walls) {
    if (wall.door || wall.window) continue;
    if (off(wall.from) > ALIGN_TOLERANCE || off(wall.to) > ALIGN_TOLERANCE) continue;
    const start = along(wall.from);
    const end = along(wall.to);
    const low = Math.min(start, end);
    const high = Math.max(start, end);
    // Precisa cobrir de fato um pedaço da parede (encostar na ponta não corta).
    if (Math.min(high, length) - Math.max(low, 0) < MIN_PIECE / 2) continue;
    cut.push(wall);
    const span = Math.hypot(wall.to.col - wall.from.col, wall.to.row - wall.from.row);
    const pointAt = (position: number): GridPos => {
      // Ponto da própria parede (não da linha do vão), na posição pedida.
      const k = (position - start) / (end - start);
      const cent = (value: number) => Math.round(value * 100) / 100;
      return { col: cent(wall.from.col + (wall.to.col - wall.from.col) * k), row: cent(wall.from.row + (wall.to.row - wall.from.row) * k) };
    };
    const keep = (from: number, to: number) => {
      if (((to - from) / Math.max(high - low, 1e-9)) * span < MIN_PIECE) return;
      pieces.push({ from: pointAt(from), to: pointAt(to), ...(wall.thickness !== undefined && { thickness: wall.thickness }), ...(wall.style && { style: wall.style }) });
    };
    keep(low, Math.max(low, 0));
    keep(Math.min(high, length), high);
  }
  return { cut, pieces };
}
