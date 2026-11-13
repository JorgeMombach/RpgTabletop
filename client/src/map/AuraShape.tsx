import { Circle, Group, Text } from "react-konva";
import { geometryOf, type CombatantView, type MapConfig } from "@rpg/shared";
import { shapeCenterAt } from "./geometry";
import { useDragOffset } from "./dragFollow";

/**
 * Alcance ou aura em volta do token: círculo leve na cor escolhida (ou a do token), medido a partir da borda do espaço que ocupa
 * (criatura grande cresce junto). Só visual: o app não confere quem está dentro (ADR-06).
 * Fica parado enquanto o token é arrastado: mostra de onde ele saiu (ataque de oportunidade).
 */
export function AuraShape({ c, grid }: { c: CombatantView; grid: MapConfig }) {
  // Anda junto com o token durante o arraste.
  const drag = useDragOffset(c.id);
  if (!c.pos || !c.aura) return null;
  const color = c.auraColor ?? c.color;
  const span = geometryOf(grid.grid).drawSpan(c.size);
  const middle = shapeCenterAt(c.pos, c.size, grid);
  const radius = (span * grid.cellPx) / 2 + (c.aura / grid.feetPerCell) * grid.cellPx;
  const font = Math.max(10, grid.cellPx * 0.22);

  return (
    <Group x={middle.x + drag.dx} y={middle.y + drag.dy} listening={false}>
      <Circle radius={radius} fill={color} opacity={0.1} />
      <Circle radius={radius} stroke={color} strokeWidth={Math.max(1.5, grid.cellPx * 0.03)} dash={[grid.cellPx * 0.15, grid.cellPx * 0.1]} opacity={0.7} />
      <Text
        text={`${c.aura} ft`}
        fontSize={font}
        fontStyle="bold"
        fill={color}
        opacity={0.9}
        width={radius * 2}
        x={-radius}
        y={-radius + font * 0.3}
        align="center"
      />
    </Group>
  );
}
