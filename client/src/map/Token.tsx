import { useEffect, useRef, useState } from "react";
import Konva from "konva";
import { Circle, Group, Path, Rect, RegularPolygon, Shape as KShape, Text } from "react-konva";
import { feetBetween, sizeSpan, type CombatantView, type GridPos, type MapConfig } from "@rpg/shared";
import { fmtCondition, hpLevel, hpRatio } from "../format";
import { cellAt, cellCenter, initials, sameCell } from "./geometry";
import { t } from "../i18n";
import { useApp } from "../store";
import { TorchBadge } from "./Torch";
import { drawNamePlate, drawNumberShield, drawSelection, drawTurnHalo, drawTurnRing, tokenArt, type FrameKind, type PlateStyle } from "./tokenArt";
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
  /** Mob repetido ("Goblin 2" entre vários goblins): a placa mostra só o número. */
  plateNumber?: number;
  draggable: boolean;
  onSelect: () => void;
  /** Devolve false se o servidor recusou (o token volta para o lugar). */
  onMove: (pos: GridPos) => Promise<boolean>;
}

/**
 * O que anima em volta do token (L3), desenhado ao vivo e leve: por baixo da imagem pronta, o halo da vez;
 * por cima, o contorno aceso da vez e o tracejado da seleção. Parado com *Reduzir o clima*.
 */
function TokenFx({ kind, boss, r, active, selected, over }: { kind: FrameKind; boss: boolean; r: number; active: boolean; selected: boolean; over: boolean }) {
  const ref = useRef<Konva.Shape>(null);
  const reduceFx = useApp((s) => s.reduceFx);
  const time = useRef(0);
  useEffect(() => {
    const node = ref.current;
    if (!node || reduceFx) return;
    let last = 0;
    const anim = new Konva.Animation((frame) => {
      if (!frame || frame.time - last < 33) return false;
      last = frame.time;
      time.current = frame.time / 1000;
      return true;
    }, node.getLayer());
    anim.start();
    return () => {
      anim.stop();
    };
  }, [reduceFx]);
  return (
    <KShape
      ref={ref}
      listening={false}
      sceneFunc={(kctx) => {
        const ctx = kctx._context;
        if (!over) {
          if (active) drawTurnHalo(ctx, r, time.current);
          return;
        }
        if (active) drawTurnRing(ctx, kind, boss, r, time.current);
        if (selected) drawSelection(ctx, kind, boss, r, time.current);
      }}
    />
  );
}

/** Aliados são círculos; mobs, quadrados arredondados (SPEC F4); NPCs, hexágonos (E15). Moldura do kit visual (L3). */
export function Token({ c, grid, selected, active, plateNumber, draggable, onSelect, onMove }: Props) {
  const avatar = useImage(c.avatar);
  const [hover, setHover] = useState(false);
  const [dragFeet, setDragFeet] = useState<number | null>(null);
  const dragStart = useRef<GridPos | null>(null);
  const groupRef = useRef<Konva.Group>(null);

  // As iniciais usam a Cinzel: quando ela termina de carregar, redesenha (a imagem do token é refeita com ela).
  useEffect(() => {
    let alive = true;
    void document.fonts?.ready.then(() => alive && groupRef.current?.getLayer()?.batchDraw());
    return () => {
      alive = false;
    };
  }, []);

  if (!c.pos) return null;
  // Tamanho (E26+): `pos` é a casa de cima à esquerda; o token cobre `span` × `span` casas.
  const span = sizeSpan(c.size);
  // Miúdo fica no canto de baixo à direita da casa: dividindo a casa, não esconde quem já está nela.
  const off = c.size === "tiny" ? grid.cellPx * 0.22 : ((span - 1) * grid.cellPx) / 2;
  const centerOf = (p: GridPos) => {
    const b = cellCenter(p, grid);
    return { x: b.x + off, y: b.y + off };
  };
  /** Casa de cima à esquerda para o token com centro em `p`. */
  const cornerAt = (p: { x: number; y: number }) => cellAt({ x: p.x - off, y: p.y - off }, grid);
  const center = centerOf(c.pos);
  // Conjurado: mesmo formato do lado de quem conjurou, um pouco menor e com selo (E21).
  const summon = !!c.summonerId;
  // Miúdo fica bem menor (divide a casa); conjurado, um pouco menor; grandes cobrem as casas todas.
  const size = grid.cellPx * span * (c.size === "tiny" ? 0.55 : summon ? 0.7 : 0.86);
  /** Referência para textos e selos: não crescem com o bicho. */
  const ref = Math.min(size, grid.cellPx * 0.86);
  const r = size / 2;
  const ring = Math.max(2, ref * 0.07);
  const isMob = c.type === "mob";
  const isNpc = c.type === "npc";
  // Hexágono com a mesma área visual do círculo: o raio até a ponta é um pouco maior.
  const hexR = r * 1.08;
  const down = c.hp !== undefined && c.hp <= 0;
  // Oculto (só o mestre recebe): translúcido e com contorno tracejado (E21).
  const hidden = c.hidden === true;
  const badgeR = Math.max(7, grid.cellPx * 0.86 * 0.17);
  const conditionText = c.conditions.map(fmtCondition).join(", ");

  const kind: FrameKind = isNpc ? "npc" : isMob ? "mob" : "ally";
  const boss = c.boss === true && c.type !== "ally";
  const art = { kind, boss, r, color: c.color, avatar, initials: initials(c.name), down };
  // A moldura de chefe é sempre quadrada (também no NPC chefe): halo e seleção acompanham.
  const fxKind: FrameKind = boss ? "mob" : kind;
  const plateStyle: PlateStyle = boss ? "boss" : summon ? "pet" : kind;
  const barH = Math.max(3, ref * 0.09);
  const hasBar = c.hp !== undefined && c.hpMax !== undefined;
  // A placa fica logo abaixo da barra de vida (ou do token, para quem não vê a vida).
  const plateY = hasBar ? r + ring * 1.7 + barH + ref * 0.07 : r + ref * 0.1;
  // Placa com o nome: só no hover, selecionado ou arrastando (tokens lado a lado não se cobrem); o chefe, sempre.
  const focused = hover || selected || dragFeet !== null;
  // Rótulo do hover: só o que a placa não mostra (oculto, distância, condições).
  const head = [hidden ? `(${t("kind.hidden")})` : null, dragFeet !== null ? `${dragFeet} ft` : null]
    .filter(Boolean)
    .join(" · ");
  const labelLines = [head, conditionText].filter(Boolean);
  const labelSize = Math.max(11, ref * 0.24);

  /** Área de clique: a forma do token. */
  const clip = (ctx: Konva.Context) => {
    ctx.beginPath();
    if (isNpc) {
      for (let i = 0; i < 6; i++) {
        const a = -Math.PI / 2 + (i * Math.PI) / 3;
        ctx.lineTo(Math.cos(a) * hexR, Math.sin(a) * hexR);
      }
    } else if (isMob) {
      const k = r * 0.36;
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
    const to = cornerAt(node.position());
    const snapped = centerOf(to);
    node.position(snapped);
    if (sameCell(from, to)) return;
    void onMove(to).then((ok) => {
      if (!ok && from) node.position(centerOf(from));
    });
  }

  return (
    <Group
      ref={groupRef}
      x={center.x}
      y={center.y}
      draggable={draggable}
      opacity={hidden ? 0.45 : 1}
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
        // Segundo dedo na tela (pinça, E23): é zoom, não arrastar o token. Volta para a casa de origem.
        const touches = (e.evt as unknown as TouchEvent).touches;
        if (touches && touches.length > 1 && dragStart.current) {
          e.target.position(centerOf(dragStart.current));
          e.target.stopDrag();
          return;
        }
        if (dragStart.current) setDragFeet(feetBetween(dragStart.current, cornerAt(e.target.position()), grid.feetPerCell));
      }}
      onDragEnd={handleDragEnd}
    >
      {active && <TokenFx kind={fxKind} boss={boss} r={r} active selected={false} over={false} />}

      <KShape
        sceneFunc={(kctx) => {
          // Pixels de tela por unidade do mapa (zoom do mapa × densidade da tela): a imagem sai nítida.
          const ctx = kctx._context;
          const m = ctx.getTransform();
          const img = tokenArt(art, Math.hypot(m.a, m.b));
          ctx.drawImage(img.canvas, -img.extent, -img.extent, img.extent * 2, img.extent * 2);
        }}
        hitFunc={(kctx, shape) => {
          clip(kctx);
          kctx.fillStrokeShape(shape);
        }}
      />

      {(active || selected) && <TokenFx kind={fxKind} boss={boss} r={r} active={!!active} selected={selected} over />}

      {hidden && RingShape(ring * 0.9, { stroke: "#ece4d4", strokeWidth: ring * 0.6, dash: [ring * 1.5, ring * 1.5], listening: false })}

      {hasBar && c.hp !== undefined && c.hpMax !== undefined && (
        <Group y={r + ring * 1.7} listening={false}>
          <Rect x={-r} width={size} height={Math.max(3, ref * 0.09)} fill="#00000099" cornerRadius={2} />
          <Rect
            x={-r}
            width={size * hpRatio(c.hp, c.hpMax + (c.tempHp ?? 0))}
            height={Math.max(3, ref * 0.09)}
            fill={HP_COLORS[hpLevel(c.hp, c.hpMax)]}
            cornerRadius={2}
          />
          {!!c.tempHp && (
            // Vida temporária: trecho claro logo depois da vida.
            <Rect
              x={-r + size * hpRatio(c.hp, c.hpMax + c.tempHp)}
              width={size * (c.tempHp / (c.hpMax + c.tempHp))}
              height={Math.max(3, ref * 0.09)}
              fill="#ece4d4"
              cornerRadius={2}
            />
          )}
        </Group>
      )}

      {c.conditions.length > 0 && (
        // Selo com o número de condições; os nomes aparecem no rótulo (hover/seleção).
        <Group x={r * 0.78} y={-r * 0.78} listening={false}>
          <Circle radius={badgeR} fill="#d8b47a" stroke="#141218" strokeWidth={Math.max(1.5, ref * 0.03)} />
          <Text
            text={String(c.conditions.length)}
            fontSize={Math.max(9, ref * 0.2)}
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
        // Selo de animal no canto oposto ao das condições (embaixo, se o de cima for do número do mob).
        <Group x={-r * 0.78} y={plateNumber !== undefined ? r * 0.78 : -r * 0.78} listening={false}>
          <Circle radius={badgeR} fill="#141218" stroke="#d8b47a" strokeWidth={Math.max(1.5, ref * 0.03)} />
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

      {c.torch && (
        <Group x={r * 0.78} y={r * 0.78} listening={false}>
          <TorchBadge id={c.id} radius={badgeR * 1.2} />
        </Group>
      )}

      {summon && (
        <Group x={-r * 0.78} y={r * 0.78} listening={false}>
          <Circle radius={badgeR} fill="#141218" stroke="#d8b47a" strokeWidth={Math.max(1.5, ref * 0.03)} />
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

      {plateNumber !== undefined && (
        // Mob repetido: escudinho com o número dentro do token, no canto de cima à esquerda (o da direita é das condições).
        <KShape
          x={-r * 0.78}
          y={-r * 0.78}
          listening={false}
          sceneFunc={(kctx) => {
            const u = (badgeR * 11) / 7.5;
            kctx._context.translate(0, -(u / 11) * 8.5);
            drawNumberShield(kctx._context, plateNumber, 0, u);
          }}
        />
      )}

      {(focused || boss) && (
        <KShape listening={false} sceneFunc={(kctx) => void drawNamePlate(kctx._context, c.name, plateStyle, plateY, ref * 0.26)} />
      )}

      {(hover || selected || dragFeet !== null) && labelLines.length > 0 && (
        <Group y={-(boss ? r * 1.3 : r) - ring * 2 - labelSize * 1.2 * labelLines.length} listening={false}>
          <Text
            text={labelLines.join("\n")}
            lineHeight={1.2}
            fontSize={labelSize}
            fill="#ffffff"
            stroke="#000000"
            strokeWidth={Math.max(2, ref * 0.05)}
            fillAfterStrokeEnabled
            align="center"
            width={Math.max(size, ref * 4)}
            x={-Math.max(size, ref * 4) / 2}
          />
        </Group>
      )}
    </Group>
  );
}
