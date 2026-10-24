import Konva from "konva";
import { useEffect, useRef } from "react";
import { Circle, Group, Line, Text } from "react-konva";
import type { MapConfig, MapEffect } from "@rpg/shared";
import { areaPolygon } from "./AreaShape";
import { effectTexture, TILE } from "./effectTextures";

type Grid = Pick<MapConfig, "cellPx" | "offsetX" | "offsetY" | "feetPerCell">;

/** Movimento da textura (px do ladrilho por segundo) e tremulação, por efeito. */
const MOTION: Partial<Record<MapEffect["preset"], { dx: number; dy: number; flicker?: boolean }>> = {
  fire: { dx: 0, dy: 26, flicker: true },
  water: { dx: 8, dy: 3 },
  fog: { dx: 6, dy: 0 },
};

/**
 * Efeito persistente no mapa (E19): a área com a textura do efeito, abaixo dos tokens.
 * Desligado (só o mestre vê) aparece apagado e tracejado.
 */
export function EffectShape({ effect, grid, scale, casterName }: { effect: MapEffect; grid: Grid; scale: number; casterName?: string }) {
  const shapeRef = useRef<Konva.Shape>(null);
  const { area } = effect;
  const motion = effect.active ? MOTION[effect.preset] : undefined;

  useEffect(() => {
    const node = shapeRef.current;
    if (!node || !motion) return;
    const anim = new Konva.Animation((frame) => {
      if (!frame) return;
      const t = frame.time / 1000;
      // Offset positivo em y faz a textura "subir" (chamas).
      node.fillPatternOffset({ x: (t * motion.dx) % TILE, y: (t * motion.dy) % TILE });
      if (motion.flicker) node.opacity(0.82 + Math.sin(t * 9) * 0.06 + Math.sin(t * 23) * 0.04);
    }, node.getLayer());
    anim.start();
    return () => {
      anim.stop();
    };
  }, [motion]);

  const origin = { x: grid.offsetX + area.origin.col * grid.cellPx, y: grid.offsetY + area.origin.row * grid.cellPx };
  const round = area.kind === "sphere" || area.kind === "cylinder";
  const radius = (area.feet / grid.feetPerCell) * grid.cellPx;
  // Um ladrilho da textura cobre 2 quadrados do grid.
  const patternScale = (grid.cellPx * 2) / TILE;
  const style = {
    fillPatternImage: effectTexture(effect.preset, effect.color) as unknown as HTMLImageElement,
    fillPatternRepeat: "repeat",
    fillPatternScale: { x: patternScale, y: patternScale },
    // No círculo a textura parte do centro; no polígono, da origem do mapa (fica alinhada ao grid).
    fillPatternX: round ? -origin.x : 0,
    fillPatternY: round ? -origin.y : 0,
    stroke: effect.color,
    strokeWidth: 2 / scale,
    opacity: effect.active ? 0.85 : 0.3,
    dash: effect.active ? undefined : [8 / scale, 6 / scale],
    listening: false,
  };
  const fs = 12 / scale;
  const label = `${effect.name}${effect.rounds !== null ? ` (${effect.rounds})` : ""}${effect.concentration ? " ◆" : ""}${casterName ? ` · ${casterName}` : ""}`;

  return (
    <Group listening={false}>
      {round ? (
        <Circle ref={shapeRef as never} x={origin.x} y={origin.y} radius={radius} {...style} />
      ) : (
        <Line ref={shapeRef as never} points={areaPolygon(area, grid)} closed {...style} />
      )}
      <Text
        x={origin.x + 6 / scale}
        y={origin.y + 6 / scale}
        text={effect.active ? label : `${label} (desligado)`}
        fontSize={fs}
        fontStyle="bold"
        fill="#ffffff"
        stroke="#000000"
        strokeWidth={2.5 / scale}
        fillAfterStrokeEnabled
        opacity={effect.active ? 0.9 : 0.6}
      />
    </Group>
  );
}
