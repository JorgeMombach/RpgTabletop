import { useRef, useState } from "react";
import type Konva from "konva";
import { Circle, Group, Image as KImage, Line, Rect, RegularPolygon, Text } from "react-konva";
import { feetBetween, type CombatantView, type GridPos, type MapConfig } from "@rpg/shared";
import { fmtCondition, hpLevel, hpRatio } from "../format";
import { cellAt, cellCenter, initials, sameCell } from "./geometry";
import { useImage } from "./useImage";

const HP_COLORS = { full: "#4cc38a", mid: "#e0a440", low: "#e5534b", zero: "#e5534b" };

interface Props {
  c: CombatantView;
  grid: MapConfig;
  selected: boolean;
  /** Turno atual (destacado para todos). */
  active?: boolean;
  draggable: boolean;
  onSelect: () => void;
  /** Devolve false se o servidor recusou (o token volta para o lugar). */
  onMove: (pos: GridPos) => Promise<boolean>;
}

/** Aliados são círculos; mobs, quadrados arredondados (SPEC F4); NPCs, hexágonos (E15). */
export function Token({ c, grid, selected, active, draggable, onSelect, onMove }: Props) {
  const avatar = useImage(c.avatar);
  const [hover, setHover] = useState(false);
  const [dragFeet, setDragFeet] = useState<number | null>(null);
  const dragStart = useRef<GridPos | null>(null);

  if (!c.pos) return null;
  const center = cellCenter(c.pos, grid);
  const size = grid.cellPx * 0.86;
  const r = size / 2;
  const ring = Math.max(2, size * 0.07);
  const isMob = c.type === "mob";
  const isNpc = c.type === "npc";
  // Hexágono com a mesma área visual do círculo: o raio até a ponta é um pouco maior.
  const hexR = r * 1.08;
  const down = c.hp !== undefined && c.hp <= 0;
  const conditionText = c.conditions.map(fmtCondition).join(", ");

  const clip = (ctx: Konva.Context) => {
    ctx.beginPath();
    if (isNpc) {
      for (let i = 0; i < 6; i++) {
        const a = -Math.PI / 2 + (i * Math.PI) / 3;
        ctx.lineTo(Math.cos(a) * hexR, Math.sin(a) * hexR);
      }
    } else if (isMob) {
      const k = size * 0.18;
      ctx.moveTo(-r + k, -r);
      ctx.arcTo(r, -r, r, r, k);
      ctx.arcTo(r, r, -r, r, k);
      ctx.arcTo(-r, r, -r, -r, k);
      ctx.arcTo(-r, -r, r, -r, k);
    } else {
      ctx.arc(0, 0, r, 0, Math.PI * 2);
    }
    ctx.closePath();
  };

  const Shape = (extra: Konva.ShapeConfig) =>
    isNpc ? (
      <RegularPolygon sides={6} radius={hexR} {...extra} />
    ) : isMob ? (
      <Rect x={-r} y={-r} width={size} height={size} cornerRadius={size * 0.18} {...extra} />
    ) : (
      <Circle radius={r} {...extra} />
    );

  /**
   * Contorno de seleção/turno, afastado `gap` da borda. Calculado em vez de escalar a forma:
   * o retângulo escala a partir do canto, e o contorno dos mobs ficava deslocado.
   */
  const RingShape = (gap: number, extra: Konva.ShapeConfig) =>
    isNpc ? (
      // Distância até a ponta = distância até o lado ÷ cos 30°.
      <RegularPolygon sides={6} radius={hexR + gap / Math.cos(Math.PI / 6)} {...extra} />
    ) : isMob ? (
      <Rect
        x={-r - gap}
        y={-r - gap}
        width={size + gap * 2}
        height={size + gap * 2}
        cornerRadius={size * 0.18 + gap}
        {...extra}
      />
    ) : (
      <Circle radius={r + gap} {...extra} />
    );

  function handleDragEnd(e: Konva.KonvaEventObject<DragEvent>) {
    const node = e.target;
    const from = dragStart.current;
    dragStart.current = null;
    setDragFeet(null);
    const to = cellAt(node.position(), grid);
    const snapped = cellCenter(to, grid);
    node.position(snapped);
    if (sameCell(from, to)) return;
    void onMove(to).then((ok) => {
      if (!ok && from) node.position(cellCenter(from, grid));
    });
  }

  return (
    <Group
      x={center.x}
      y={center.y}
      draggable={draggable}
      opacity={down ? 0.5 : 1}
      onMouseEnter={(e) => {
        setHover(true);
        const stage = e.target.getStage();
        if (stage) stage.container().style.cursor = draggable ? "grab" : "pointer";
      }}
      onMouseLeave={(e) => {
        setHover(false);
        const stage = e.target.getStage();
        if (stage) stage.container().style.cursor = "";
      }}
      onClick={onSelect}
      onTap={onSelect}
      onDragStart={(e) => {
        dragStart.current = c.pos;
        e.target.moveToTop();
        setDragFeet(0);
      }}
      onDragMove={(e) => {
        if (dragStart.current) setDragFeet(feetBetween(dragStart.current, cellAt(e.target.position(), grid), grid.feetPerCell));
      }}
      onDragEnd={handleDragEnd}
    >
      {(selected || active) &&
        RingShape(ring * 2, {
          stroke: active ? "#d4a24c" : "#e6e8ee",
          strokeWidth: ring,
          dash: selected && !active ? undefined : [ring * 2, ring],
          listening: false,
        })}

      {Shape({ fill: c.color, shadowColor: "black", shadowBlur: 6, shadowOpacity: 0.5 })}

      {avatar ? (
        <Group clipFunc={clip}>
          <KImage image={avatar} x={-r} y={-r} width={size} height={size} />
        </Group>
      ) : (
        <Text
          text={initials(c.name)}
          width={size}
          height={size}
          x={-r}
          y={-r}
          align="center"
          verticalAlign="middle"
          fontStyle="bold"
          fontSize={size * 0.34}
          fill="#ffffff"
          listening={false}
        />
      )}

      {Shape({ stroke: c.color, strokeWidth: ring, listening: false })}
      {/* Contorno escuro por fora do anel: o token se destaca sobre efeitos (fogo, graxa…) e mapas de qualquer cor. */}
      {RingShape(ring * 0.9, { stroke: "#0b0c10", strokeWidth: ring * 0.8, opacity: 0.9, listening: false })}

      {down && isMob && (
        <>
          <Line points={[-r * 0.6, -r * 0.6, r * 0.6, r * 0.6]} stroke="#e5534b" strokeWidth={ring * 1.4} listening={false} />
          <Line points={[r * 0.6, -r * 0.6, -r * 0.6, r * 0.6]} stroke="#e5534b" strokeWidth={ring * 1.4} listening={false} />
        </>
      )}

      {c.hp !== undefined && c.hpMax !== undefined && (
        <Group y={r + ring * 1.7} listening={false}>
          <Rect x={-r} width={size} height={Math.max(3, size * 0.09)} fill="#00000099" cornerRadius={2} />
          <Rect
            x={-r}
            width={size * hpRatio(c.hp, c.hpMax)}
            height={Math.max(3, size * 0.09)}
            fill={HP_COLORS[hpLevel(c.hp, c.hpMax)]}
            cornerRadius={2}
          />
        </Group>
      )}

      {c.conditions.length > 0 && (
        // Selo com o número de condições; os nomes aparecem no rótulo (hover/seleção).
        <Group x={r * 0.78} y={-r * 0.78} listening={false}>
          <Circle radius={Math.max(7, size * 0.17)} fill="#d4a24c" stroke="#1a1b1e" strokeWidth={Math.max(1.5, size * 0.03)} />
          <Text
            text={String(c.conditions.length)}
            fontSize={Math.max(9, size * 0.2)}
            fontStyle="bold"
            fill="#1a1b1e"
            align="center"
            verticalAlign="middle"
            width={size}
            height={size}
            x={-size / 2}
            y={-size / 2}
          />
        </Group>
      )}

      {(hover || selected || dragFeet !== null) && (
        <Group y={-r - ring * 2 - size * (conditionText ? 0.6 : 0.3)} listening={false}>
          <Text
            text={
              (dragFeet !== null ? `${c.name} · ${dragFeet} ft` : c.name) + (conditionText ? `\n${conditionText}` : "")
            }
            lineHeight={1.2}
            fontSize={Math.max(11, size * 0.24)}
            fill="#ffffff"
            stroke="#000000"
            strokeWidth={Math.max(2, size * 0.05)}
            fillAfterStrokeEnabled
            align="center"
            width={size * 4}
            x={-size * 2}
          />
        </Group>
      )}
    </Group>
  );
}
