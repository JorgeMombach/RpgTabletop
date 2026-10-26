import { useRef, useState } from "react";
import type Konva from "konva";
import { Circle, Group, Image as KImage, Line, Path, Rect, RegularPolygon, Text } from "react-konva";
import { feetBetween, type CombatantView, type GridPos, type MapConfig } from "@rpg/shared";
import { fmtCondition, hpLevel, hpRatio } from "../format";
import { cellAt, cellCenter, initials, sameCell } from "./geometry";
import { useApp } from "../store";
import { useImage } from "./useImage";

// Mesmas faixas da barra de vida das listas (cobre → bronze → sangue).
const HP_COLORS = { full: "#4fae8c", mid: "#c19a62", low: "#c94a52", zero: "#c94a52" };

/** Varinha do Tabler (IconWand, MIT), 24 × 24: selo de conjurado, o mesmo das listas (E21). */
const WAND = "M6 21l15 -15l-3 -3l-15 15l3 3M15 6l3 3M9 3a2 2 0 0 0 2 2a2 2 0 0 0 -2 2a2 2 0 0 0 -2 -2a2 2 0 0 0 2 -2M19 13a2 2 0 0 0 2 2a2 2 0 0 0 -2 2a2 2 0 0 0 -2 -2a2 2 0 0 0 2 -2";

/** Pata do Tabler (IconPaw, MIT), em caixa de 24 × 24: o mesmo ícone das listas (E21). */
const PAW =
  "M14.7 13.5c-1.1 -2 -1.441 -2.5 -2.7 -2.5c-1.259 0 -1.736 .755 -2.836 2.747c-.942 1.703 -2.846 1.845 -3.321 3.291c-.097 .265 -.145 .677 -.143 .962c0 1.176 .787 2 1.8 2c1.259 0 3 -1 4.5 -1s3.241 1 4.5 1c1.013 0 1.8 -.823 1.8 -2c0 -.285 -.049 -.697 -.146 -.962c-.475 -1.451 -2.512 -1.835 -3.454 -3.538" +
  "M20.188 8.082a1.039 1.039 0 0 0 -.406 -.082h-.015c-.735 .012 -1.56 .75 -1.993 1.866c-.519 1.335 -.28 2.7 .538 3.052c.129 .055 .267 .082 .406 .082c.739 0 1.575 -.742 2.011 -1.866c.516 -1.335 .273 -2.7 -.54 -3.052l-.001 0" +
  "M9.474 9c.055 0 .109 0 .163 -.011c.944 -.128 1.533 -1.346 1.32 -2.722c-.203 -1.297 -1.047 -2.267 -1.932 -2.267c-.055 0 -.109 0 -.163 .011c-.944 .128 -1.533 1.346 -1.32 2.722c.204 1.293 1.048 2.267 1.933 2.267" +
  "M16.456 6.733c.214 -1.376 -.375 -2.594 -1.32 -2.722a1.164 1.164 0 0 0 -.162 -.011c-.885 0 -1.728 .97 -1.93 2.267c-.214 1.376 .375 2.594 1.32 2.722c.054 .007 .108 .011 .162 .011c.885 0 1.73 -.974 1.93 -2.267" +
  "M5.69 12.918c.816 -.352 1.054 -1.719 .536 -3.052c-.436 -1.124 -1.271 -1.866 -2.009 -1.866c-.14 0 -.277 .027 -.407 .082c-.816 .352 -1.054 1.719 -.536 3.052c.436 1.124 1.271 1.866 2.009 1.866c.14 0 .277 -.027 .407 -.082";

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
  // Conjurado: mesmo formato do lado de quem conjurou, um pouco menor e com selo (E21).
  const summon = !!c.summonerId;
  const size = grid.cellPx * (summon ? 0.7 : 0.86);
  const r = size / 2;
  const ring = Math.max(2, size * 0.07);
  const isMob = c.type === "mob";
  const isNpc = c.type === "npc";
  // Hexágono com a mesma área visual do círculo: o raio até a ponta é um pouco maior.
  const hexR = r * 1.08;
  const down = c.hp !== undefined && c.hp <= 0;
  // Oculto (só o mestre recebe): translúcido e com contorno tracejado (E21).
  const hidden = c.hidden === true;
  const badgeR = Math.max(7, grid.cellPx * 0.86 * 0.17);
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
      opacity={hidden ? 0.45 : down ? 0.5 : 1}
      onMouseEnter={(e) => {
        setHover(true);
        // O mapa desenha este token por último: o nome fica por cima dos vizinhos (E26).
        useApp.setState({ hoverId: c.id });
        const stage = e.target.getStage();
        if (stage) stage.container().style.cursor = draggable ? "grab" : "pointer";
      }}
      onMouseLeave={(e) => {
        setHover(false);
        if (useApp.getState().hoverId === c.id) useApp.setState({ hoverId: null });
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
          stroke: active ? "#d8b47a" : "#ece4d4",
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
      {hidden && RingShape(ring * 0.9, { stroke: "#ece4d4", strokeWidth: ring * 0.6, dash: [ring * 1.5, ring * 1.5], listening: false })}

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
          <Circle radius={badgeR} fill="#d8b47a" stroke="#141218" strokeWidth={Math.max(1.5, size * 0.03)} />
          <Text
            text={String(c.conditions.length)}
            fontSize={Math.max(9, size * 0.2)}
            fontStyle="bold"
            fill="#141218"
            align="center"
            verticalAlign="middle"
            width={size}
            height={size}
            x={-size / 2}
            y={-size / 2}
          />
        </Group>
      )}

      {c.animal && (
        // Selo de animal no canto oposto ao das condições.
        <Group x={-r * 0.78} y={-r * 0.78} listening={false}>
          <Circle radius={badgeR} fill="#141218" stroke="#d8b47a" strokeWidth={Math.max(1.5, size * 0.03)} />
          <Path
            data={PAW}
            x={-badgeR * 0.75}
            y={-badgeR * 0.75}
            scaleX={(badgeR * 1.5) / 24}
            scaleY={(badgeR * 1.5) / 24}
            stroke="#ece4d4"
            strokeWidth={2}
            lineCap="round"
            lineJoin="round"
          />
        </Group>
      )}

      {summon && (
        <Group x={-r * 0.78} y={r * 0.78} listening={false}>
          <Circle radius={badgeR} fill="#141218" stroke="#d8b47a" strokeWidth={Math.max(1.5, size * 0.03)} />
          <Path
            data={WAND}
            x={-badgeR * 0.75}
            y={-badgeR * 0.75}
            scaleX={(badgeR * 1.5) / 24}
            scaleY={(badgeR * 1.5) / 24}
            stroke="#ece4d4"
            strokeWidth={2}
            lineCap="round"
            lineJoin="round"
          />
        </Group>
      )}

      {(hover || selected || dragFeet !== null) && (
        <Group y={-r - ring * 2 - size * (conditionText ? 0.6 : 0.3)} listening={false}>
          <Text
            text={
              (dragFeet !== null ? `${c.name} · ${dragFeet} ft` : c.name) +
              (hidden ? " (oculto)" : "") +
              (conditionText ? `\n${conditionText}` : "")
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
