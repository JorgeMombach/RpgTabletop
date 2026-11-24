import { geometryOf, isHex, lightPolygon, visionFeet, type GridKind, type GridPos, type LightId, type Segment, type Size } from "@rpg/shared";
import { fbm } from "../fogNoise";

/**
 * Névoa na placa de vídeo (docs/design/nevoa.md): a conta sem DOM (testada no servidor). Quem vê, com o centro e o
 * alcance do servidor (`updateSight`, `sightCells`), encolhido para o leque cair inteiro nas casas que ele manda; os
 * triângulos das casas e da linha de visão, em casas; e o ruído pronto da fumaça.
 */

/** Linha → pares de colunas [início, fim) (o formato de `fog.revealed`, `fog.explored` e da visão). */
export type FogRows = Record<string, number[]>;

/** Centro e alcance do leque de quem vê, em casas, já encolhido. */
export interface FogViewer {
  x: number;
  y: number;
  reach: number;
}

/** O que a conta usa de um aliado (o jogador recebe o aliado sem a vida; aqui só importa onde e como enxerga). */
export interface FogAlly {
  pos: GridPos | null;
  size?: Size;
  darkvision?: boolean;
  torch?: boolean;
}

export interface FogScene {
  kind: GridKind | undefined;
  feetPerCell: number;
  light: LightId;
  /** Alcance da cena (pés), o mesmo para todos; `null` = pela luz. */
  range: number | null;
  /** Visão dos personagens ligada (sem ela, só o pincel do mestre). */
  vision: boolean;
}

/** Meia diagonal da casa (quadrado) e o raio do hex: o leque encolhido cai inteiro em casas cujo centro o servidor vê. */
export const FOG_CELL_INSET = { square: 0.71, hex: 0.58 };

/** Quem vê: aliados no mapa, com o centro da forma e o alcance da visão (como o servidor), menos a meia casa. */
export function fogViewers(allies: FogAlly[], scene: FogScene): FogViewer[] {
  if (!scene.vision) return [];
  const geometry = geometryOf(scene.kind);
  const inset = isHex({ grid: scene.kind }) ? FOG_CELL_INSET.hex : FOG_CELL_INSET.square;
  return allies.flatMap((ally) => {
    if (!ally.pos) return [];
    const feet = scene.range ?? visionFeet(scene.light, !!ally.darkvision, !!ally.torch);
    const center = geometry.shapeCenter(ally.pos, ally.size);
    return [{ x: center.x, y: center.y, reach: feet / scene.feetPerCell + geometry.drawSpan(ally.size) / 2 - inset }];
  });
}

/** Triângulos (pares x, y em casas) das casas das linhas: no quadrado, um retângulo por trecho; no hex, cada casa. */
export function fogCellTriangles(rows: FogRows, kind: GridKind | undefined): Float32Array {
  const points: number[] = [];
  const hex = isHex({ grid: kind });
  const geometry = geometryOf(kind);
  for (const [key, runs] of Object.entries(rows)) {
    const row = Number(key);
    for (let index = 0; index + 1 < runs.length; index += 2) {
      const [start, end] = [runs[index], runs[index + 1]];
      if (!hex) {
        points.push(start, row, end, row, start, row + 1, start, row + 1, end, row, end, row + 1);
        continue;
      }
      for (let col = start; col < end; col++) {
        const corners = geometry.polygon({ col, row });
        for (let corner = 1; corner + 1 < corners.length; corner++) {
          points.push(corners[0].x, corners[0].y, corners[corner].x, corners[corner].y, corners[corner + 1].x, corners[corner + 1].y);
        }
      }
    }
  }
  return new Float32Array(points);
}

/** Triângulos (pares x, y em casas) do leque de cada um, parado nas paredes de `blockers` (sem elas: o círculo). */
export function fogSightTriangles(viewers: FogViewer[], blockers: Segment[]): Float32Array {
  const points: number[] = [];
  for (const viewer of viewers) {
    const origin = { x: viewer.x, y: viewer.y };
    const polygon = lightPolygon(origin, viewer.reach, blockers);
    for (let index = 0; index < polygon.length; index += 2) {
      const next = (index + 2) % polygon.length;
      points.push(origin.x, origin.y, polygon[index], polygon[index + 1], polygon[next], polygon[next + 1]);
    }
  }
  return new Float32Array(points);
}

/** Ruído pronto da fumaça: RGBA de lado `side`, duas nuvens (R e G) que emendam a cada `period` células. */
export function fogNoiseData(side: number, period: number): Uint8Array {
  const data = new Uint8Array(side * side * 4);
  // contraste puxado: a nuvem sai do cinza do meio
  const stretch = (value: number) => Math.round(Math.min(1, Math.max(0, (value - 0.5) * 1.45 + 0.5)) * 255);
  for (let y = 0; y < side; y++) {
    for (let x = 0; x < side; x++) {
      const at = (y * side + x) * 4;
      const u = (x / side) * period;
      const v = (y / side) * period;
      data[at] = stretch(fbm(u, v, 31, 5, period));
      data[at + 1] = stretch(fbm(u, v, 97, 5, period));
      data[at + 3] = 255;
    }
  }
  return data;
}
