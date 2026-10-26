import Konva from "konva";
import { useEffect, useRef } from "react";
import { Circle, Group, Text } from "react-konva";
import type { MapConfig, MapPoint } from "@rpg/shared";
import { PING_MS } from "../store";

/** Ondas que saem do ponto, uma atrás da outra. */
const WAVES = 3;

/**
 * Ping no mapa: ondas que se abrem a partir do ponto e somem, com o nome de quem pingou.
 * Tamanho fixo na tela (não depende do zoom), para chamar atenção mesmo de longe.
 */
export function PingShape({ at, name, color, grid, scale }: { at: MapPoint; name: string; color: string; grid: MapConfig; scale: number }) {
  const waves = useRef<(Konva.Circle | null)[]>([]);
  const dot = useRef<Konva.Circle>(null);
  const x = grid.offsetX + at.col * grid.cellPx;
  const y = grid.offsetY + at.row * grid.cellPx;
  const unit = 1 / scale;
  const maxR = 46 * unit;

  useEffect(() => {
    const layer = dot.current?.getLayer();
    if (!layer) return;
    const anim = new Konva.Animation((frame) => {
      const t = (frame?.time ?? 0) / PING_MS;
      waves.current.forEach((w, i) => {
        if (!w) return;
        // Cada onda começa um pouco depois da anterior e se abre em ~0,9 s.
        const k = ((t * PING_MS) / 900 - i * 0.35) % 1;
        const live = k >= 0 && t < 0.85;
        w.radius(Math.max(0, k) * maxR);
        w.opacity(live ? (1 - k) * 0.9 : 0);
      });
      dot.current?.opacity(t < 0.7 ? 1 : Math.max(0, 1 - (t - 0.7) / 0.3));
    }, layer);
    anim.start();
    return () => {
      anim.stop();
    };
  }, [maxR]);

  return (
    <Group x={x} y={y} listening={false}>
      {Array.from({ length: WAVES }, (_, i) => (
        <Circle
          key={i}
          ref={(el) => {
            waves.current[i] = el;
          }}
          radius={0}
          stroke={color}
          strokeWidth={3 * unit}
          opacity={0}
        />
      ))}
      <Circle ref={dot} radius={6 * unit} fill={color} stroke="#17141c" strokeWidth={1.5 * unit} />
      <Text
        text={name}
        fontSize={13 * unit}
        fontStyle="bold"
        fill={color}
        stroke="#17141c"
        strokeWidth={3 * unit}
        fillAfterStrokeEnabled
        width={200 * unit}
        x={-100 * unit}
        y={-30 * unit}
        align="center"
      />
    </Group>
  );
}
