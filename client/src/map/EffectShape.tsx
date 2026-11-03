import Konva from "konva";
import { useEffect, useMemo, useRef } from "react";
import { Circle, Group, Line, Shape } from "react-konva";
import type { MapConfig, MapEffect } from "@rpg/shared";
import { areaPolygon } from "./AreaShape";
import { drawFx, newFxState, type FxArea } from "./effectFx";
import { effectTexture, TILE } from "./effectTextures";
import { useDragOffset } from "./dragFollow";

type Grid = Pick<MapConfig, "cellPx" | "offsetX" | "offsetY" | "feetPerCell">;

/** Ponto dentro do polígono (pontos achatados x0, y0, x1, y1…), para sortear partículas só na área. */
function inPolygon(pts: number[], x: number, y: number): boolean {
  let inside = false;
  for (let i = 0, j = pts.length - 2; i < pts.length; j = i, i += 2) {
    const [xi, yi, xj, yj] = [pts[i], pts[i + 1], pts[j], pts[j + 1]];
    if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}

/** Largura da borda difusa, em quadrados: metade para dentro da área, metade para fora. */
const FEATHER = 0.5;
/** Resolução máxima da camada do efeito (px de tela por px do mapa) e lado máximo, para não pesar. */
const MAX_RES = 2;
const MAX_SIDE = 2048;

/** Camada fora da tela de um efeito: o desenho do quadro e a máscara borrada do formato da área. */
interface Layers {
  key: string;
  buffer: HTMLCanvasElement;
  mask: HTMLCanvasElement;
  res: number;
}

/**
 * Efeito persistente no mapa (E19), animado (E24): o desenho do efeito sai numa camada própria e passa
 * por uma máscara borrada do formato da área, então a borda se dissolve em vez de cortar seco.
 * Fica abaixo dos tokens. Desligado (só o mestre vê): textura parada, apagada e tracejada. O nome não fica escrito
 * no mapa: aparece ao passar o mouse (`EffectTipLayer`).
 */
export function EffectShape({ effect, grid, scale }: { effect: MapEffect; grid: Grid; scale: number }) {
  const fxRef = useRef<Konva.Shape>(null);
  const fxState = useRef(newFxState());
  const layers = useRef<Layers | null>(null);
  const { area } = effect;
  const animated = effect.active;
  // Efeito fixo num token: anda junto enquanto ele é arrastado.
  const drag = useDragOffset(effect.followId);

  const origin = { x: grid.offsetX + area.origin.col * grid.cellPx, y: grid.offsetY + area.origin.row * grid.cellPx };
  // Pintura do pincel: o formato são as casas pintadas (sem círculo nem polígono).
  const cells = effect.cells;
  const round = !cells && (area.kind === "sphere" || area.kind === "cylinder");
  const radius = (area.feet / grid.feetPerCell) * grid.cellPx;
  const points = useMemo(() => (round || cells ? [] : areaPolygon(area, grid)), [round, cells, area, grid]);
  const feather = grid.cellPx * FEATHER;

  /** Desenha o formato da área (círculo, polígono ou as casas pintadas) como caminho. */
  const tracePath = (ctx: Pick<CanvasRenderingContext2D, "beginPath" | "arc" | "moveTo" | "lineTo" | "rect" | "closePath">) => {
    ctx.beginPath();
    if (cells) {
      for (let i = 0; i + 1 < cells.length; i += 2) ctx.rect(grid.offsetX + cells[i] * grid.cellPx, grid.offsetY + cells[i + 1] * grid.cellPx, grid.cellPx, grid.cellPx);
      return;
    }
    if (round) ctx.arc(origin.x, origin.y, radius, 0, Math.PI * 2);
    else for (let i = 0; i < points.length; i += 2) ctx[i ? "lineTo" : "moveTo"](points[i], points[i + 1]);
    ctx.closePath();
  };

  const fxArea = useMemo<FxArea>(() => {
    let box: FxArea["box"];
    let inside: FxArea["inside"];
    if (cells) {
      const cols = cells.filter((_, i) => i % 2 === 0);
      const rows = cells.filter((_, i) => i % 2 === 1);
      const [c0, r0] = [Math.min(...cols), Math.min(...rows)];
      const set = new Set(cols.map((c, i) => `${c},${rows[i]}`));
      box = { x: grid.offsetX + c0 * grid.cellPx, y: grid.offsetY + r0 * grid.cellPx, w: (Math.max(...cols) - c0 + 1) * grid.cellPx, h: (Math.max(...rows) - r0 + 1) * grid.cellPx };
      inside = (x, y) => set.has(`${Math.floor((x - grid.offsetX) / grid.cellPx)},${Math.floor((y - grid.offsetY) / grid.cellPx)}`);
    } else if (round) {
      box = { x: origin.x - radius, y: origin.y - radius, w: radius * 2, h: radius * 2 };
      inside = (x, y) => (x - origin.x) ** 2 + (y - origin.y) ** 2 <= radius * radius;
    } else {
      const xs = points.filter((_, i) => i % 2 === 0);
      const ys = points.filter((_, i) => i % 2 === 1);
      box = { x: Math.min(...xs), y: Math.min(...ys), w: Math.max(...xs) - Math.min(...xs), h: Math.max(...ys) - Math.min(...ys) };
      inside = (x, y) => inPolygon(points, x, y);
    }
    // Folga em volta: a borda difusa passa um pouco da área.
    return { box: { x: box.x - feather, y: box.y - feather, w: box.w + feather * 2, h: box.h + feather * 2 }, inside };
  }, [cells, grid, round, origin.x, origin.y, radius, points, feather]);

  // Um quadro por frame só na camada dos efeitos (os tokens não redesenham).
  useEffect(() => {
    const node = fxRef.current;
    if (!node || !animated) return;
    const anim = new Konva.Animation(() => true, node.getLayer());
    anim.start();
    return () => {
      anim.stop();
    };
  }, [animated]);

  /** Camada e máscara do tamanho certo para a área e o zoom atuais (refaz só quando mudam). */
  function ensureLayers(): Layers {
    const { box } = fxArea;
    const res = Math.min(MAX_RES, scale * (window.devicePixelRatio || 1), MAX_SIDE / Math.max(box.w, box.h, 1));
    const key = `${box.x},${box.y},${box.w},${box.h},${res.toFixed(3)},${(cells ?? points).join(",")}`;
    if (layers.current?.key === key) return layers.current;
    const w = Math.max(1, Math.ceil(box.w * res));
    const h = Math.max(1, Math.ceil(box.h * res));
    const buffer = layers.current?.buffer ?? document.createElement("canvas");
    buffer.width = w;
    buffer.height = h;
    const mask = document.createElement("canvas");
    mask.width = w;
    mask.height = h;
    const m = mask.getContext("2d")!;
    m.setTransform(res, 0, 0, res, -box.x * res, -box.y * res);
    // Navegador sem filtro de canvas: borda nítida (funciona igual, só sem o esfumado).
    m.filter = `blur(${feather * res * 0.5}px)`;
    m.fillStyle = "#fff";
    tracePath(m);
    m.fill();
    layers.current = { key, buffer, mask, res };
    return layers.current;
  }

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
    opacity: 0.3,
    dash: [8 / scale, 6 / scale],
    listening: false,
  };

  return (
    <Group listening={false} x={drag.dx} y={drag.dy}>
      {animated ? (
        <>
          <Shape
            ref={fxRef as never}
            listening={false}
            sceneFunc={(kctx) => {
              const ctx = (kctx as unknown as { _context: CanvasRenderingContext2D })._context;
              const { buffer, mask, res } = ensureLayers();
              const { box } = fxArea;
              const b = buffer.getContext("2d")!;
              b.setTransform(1, 0, 0, 1, 0, 0);
              b.globalCompositeOperation = "source-over";
              b.clearRect(0, 0, buffer.width, buffer.height);
              b.setTransform(res, 0, 0, res, -box.x * res, -box.y * res);
              drawFx(b, effect.preset, effect.color, fxState.current, fxArea, grid.cellPx, performance.now());
              // Recorta pelo formato da área com a borda borrada.
              b.setTransform(1, 0, 0, 1, 0, 0);
              b.globalCompositeOperation = "destination-in";
              b.drawImage(mask, 0, 0);
              ctx.drawImage(buffer, box.x, box.y, buffer.width / res, buffer.height / res);
            }}
          />
          {/* Limite exato da área, bem discreto (a borda difusa passa um pouco dele). Na pintura, não: ficaria quadriculada. */}
          {cells ? null : round ? (
            <Circle x={origin.x} y={origin.y} radius={radius} stroke={effect.color} strokeWidth={1 / scale} opacity={0.3} listening={false} />
          ) : (
            <Line points={points} closed stroke={effect.color} strokeWidth={1 / scale} opacity={0.3} listening={false} />
          )}
        </>
      ) : cells ? (
        <Shape
          {...style}
          sceneFunc={(kctx, shape) => {
            tracePath(kctx);
            kctx.fillStrokeShape(shape);
          }}
        />
      ) : round ? (
        <Circle x={origin.x} y={origin.y} radius={radius} {...style} />
      ) : (
        <Line points={points} closed {...style} />
      )}
    </Group>
  );
}
