import { EFFECT_PRESETS, geometryOf, isHex, type Area, type EffectPreset, type MapConfig, type MapEffect } from "@rpg/shared";

/**
 * Efeitos de área na placa de vídeo (docs/design/efeitos.md): a conta sem DOM (testada no servidor). O que cada tipo
 * faz com a luz, a forma da área em triângulos (em casas) e a cor do efeito.
 */

/** Largura da linha do 5e (pés). */
export const LINE_WIDTH_FT = 5;

/** A luz que o efeito acende (cor, força, alcance em volta e tremido) e se ele apaga a luz. */
export interface EffectLook {
  emit: { color: [number, number, number]; strength: number; reach: number; flicker: "calm" | "fire" | "spark" } | null;
  darkens: boolean;
}

/** Quem ilumina de verdade (o resto não mexe na luz). */
const EMITS: Partial<Record<EffectPreset, NonNullable<EffectLook["emit"]>>> = {
  fire: { color: [1, 0.55, 0.22], strength: 1.5, reach: 5, flicker: "fire" },
  holy: { color: [1, 0.86, 0.55], strength: 1.2, reach: 5, flicker: "calm" },
  electric: { color: [0.55, 0.8, 1], strength: 1.0, reach: 4, flicker: "spark" },
  toxic: { color: [0.55, 0.9, 0.3], strength: 0.25, reach: 2, flicker: "calm" },
  acid: { color: [0.7, 0.9, 0.25], strength: 0.25, reach: 2, flicker: "calm" },
};

/** A luz do efeito; desligado (só o mestre vê) não acende nem apaga nada. */
export function effectLook(effect: Pick<MapEffect, "preset" | "active">): EffectLook {
  if (!effect.active) return { emit: null, darkens: false };
  return { emit: EMITS[effect.preset] ?? null, darkens: effect.preset === "darkness" };
}

/** Número de cada tipo no shader (a ordem de `EFFECT_PRESETS`). */
export const EFFECT_KIND_INDEX = Object.fromEntries(Object.keys(EFFECT_PRESETS).map((preset, index) => [preset, index])) as Record<EffectPreset, number>;

/**
 * Contorno do cone, da linha e do cubo do 5e em casas (cone com a largura igual à distância; linha de 5 ft; cubo com a
 * origem no meio de uma face). Esfera e cilindro não têm contorno (são círculo): lista vazia.
 */
export function areaPolygonCells(area: Area, feetPerCell: number): number[] {
  const { x: ox, y: oy } = { x: area.origin.col, y: area.origin.row };
  const length = area.feet / feetPerCell;
  const d = { x: Math.cos(area.angle), y: Math.sin(area.angle) };
  const n = { x: -d.y, y: d.x };
  const at = (along: number, side: number) => [ox + d.x * along + n.x * side, oy + d.y * along + n.y * side];
  switch (area.kind) {
    case "cone":
      return [ox, oy, ...at(length, length / 2), ...at(length, -length / 2)];
    case "line": {
      const half = LINE_WIDTH_FT / feetPerCell / 2;
      return [...at(0, half), ...at(length, half), ...at(length, -half), ...at(0, -half)];
    }
    case "cube":
      return [...at(0, length / 2), ...at(length, length / 2), ...at(length, -length / 2), ...at(0, -length / 2)];
    default:
      return [];
  }
}

/** Triângulos (pares x, y em casas) da área do efeito: círculo, polígono do 5e ou as casas pintadas. */
export function effectTriangles(effect: Pick<MapEffect, "area" | "cells">, map: Pick<MapConfig, "feetPerCell" | "grid">): Float32Array {
  const points: number[] = [];
  const fan = (corners: { x: number; y: number }[]) => {
    for (let index = 1; index + 1 < corners.length; index++) points.push(corners[0].x, corners[0].y, corners[index].x, corners[index].y, corners[index + 1].x, corners[index + 1].y);
  };
  if (effect.cells) {
    const hex = isHex(map);
    const geometry = geometryOf(map.grid);
    for (let index = 0; index + 1 < effect.cells.length; index += 2) {
      const [col, row] = [effect.cells[index], effect.cells[index + 1]];
      if (hex) fan(geometry.polygon({ col, row }));
      else points.push(col, row, col + 1, row, col, row + 1, col, row + 1, col + 1, row, col + 1, row + 1);
    }
    return new Float32Array(points);
  }
  const { area } = effect;
  if (area.kind === "sphere" || area.kind === "cylinder") {
    const radius = area.feet / map.feetPerCell;
    const { col: x, row: y } = area.origin;
    for (let index = 0; index < 48; index++) {
      const a = (index / 48) * Math.PI * 2;
      const b = ((index + 1) / 48) * Math.PI * 2;
      points.push(x, y, x + Math.cos(a) * radius, y + Math.sin(a) * radius, x + Math.cos(b) * radius, y + Math.sin(b) * radius);
    }
    return new Float32Array(points);
  }
  const polygon = areaPolygonCells(area, map.feetPerCell);
  const corners: { x: number; y: number }[] = [];
  for (let index = 0; index + 1 < polygon.length; index += 2) corners.push({ x: polygon[index], y: polygon[index + 1] });
  fan(corners);
  return new Float32Array(points);
}

/** Caixa dos triângulos: canto de cima à esquerda e de baixo à direita (casas). */
export function effectBounds(points: Float32Array): [number, number, number, number] {
  let [x0, y0, x1, y1] = [Infinity, Infinity, -Infinity, -Infinity];
  for (let index = 0; index + 1 < points.length; index += 2) {
    x0 = Math.min(x0, points[index]);
    y0 = Math.min(y0, points[index + 1]);
    x1 = Math.max(x1, points[index]);
    y1 = Math.max(y1, points[index + 1]);
  }
  return [x0, y0, x1, y1];
}

/** A tinta do efeito: a cor padrão do tipo não tinge (a = 0); outra cor tinge; "personalizado" sempre. */
export function effectTint(effect: Pick<MapEffect, "preset" | "color">): [number, number, number, number] {
  const value = parseInt(effect.color.slice(1), 16);
  const rgb: [number, number, number] = [((value >> 16) & 255) / 255, ((value >> 8) & 255) / 255, (value & 255) / 255];
  const standard = EFFECT_PRESETS[effect.preset].color.toLowerCase() === effect.color.toLowerCase();
  if (standard && effect.preset !== "custom") return [1, 1, 1, 0];
  return [...rgb, 1];
}
