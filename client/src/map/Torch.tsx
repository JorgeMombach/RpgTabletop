import Konva from "konva";
import { useEffect, useRef } from "react";
import { Circle, Group, Layer, Shape } from "react-konva";
import { sizeSpan, TORCH_BRIGHT_FEET, TORCH_FEET, type CombatantView, type LightId, type MapConfig } from "@rpg/shared";
import { useApp } from "../store";
import { cellCenter } from "./geometry";

/**
 * Tocha (G): selo com chama no token e brilho quente no mapa, os dois tremulando. A luz da noite
 * (WeatherOverlay) ganha um furo em volta de cada tocha: o círculo fica iluminado de verdade.
 */

/** Tremulação suave e diferente para cada tocha (soma de senos com fases do id). */
function flicker(t: number, seed: number): number {
  return Math.sin(t * 7.3 + seed) * 0.5 + Math.sin(t * 13.1 + seed * 2.7) * 0.3 + Math.sin(t * 23.7 + seed * 5.1) * 0.2;
}

function seedOf(id: string): number {
  let h = 0;
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) | 0;
  return (h % 1000) / 100;
}

/** Desenha uma chama (gota com a ponta para cima) de altura `h`, base no ponto (0, 0). */
function flame(ctx: Konva.Context, h: number, w: number, lean: number) {
  ctx.beginPath();
  ctx.moveTo(0, 0);
  ctx.bezierCurveTo(-w, -h * 0.05, -w * 0.9, -h * 0.55, lean, -h);
  ctx.bezierCurveTo(w * 0.9, -h * 0.55, w, -h * 0.05, 0, 0);
  ctx.closePath();
}

/** Centro do token no mapa (como o Token calcula). */
export function tokenCenter(c: CombatantView, grid: MapConfig) {
  const span = sizeSpan(c.size);
  const off = c.size === "tiny" ? grid.cellPx * 0.22 : ((span - 1) * grid.cellPx) / 2;
  const b = cellCenter(c.pos!, grid);
  return { x: b.x + off, y: b.y + off, span };
}

/** Selo da tocha no canto de baixo à direita do token: chama em camadas, tremulando. */
export function TorchBadge({ id, radius }: { id: string; radius: number }) {
  const ref = useRef<Konva.Shape>(null);
  const reduceFx = useApp((s) => s.reduceFx);
  const t = useRef(0);
  useEffect(() => {
    const node = ref.current;
    if (!node || reduceFx) return;
    const anim = new Konva.Animation((frame) => {
      if (!frame) return false;
      t.current = frame.time / 1000;
      return true;
    }, node.getLayer());
    anim.start();
    return () => {
      anim.stop();
    };
  }, [reduceFx]);
  const seed = seedOf(id);
  return (
    <Group listening={false}>
      <Circle radius={radius} fill="#141218" stroke="#e08a3c" strokeWidth={Math.max(1.5, radius * 0.16)} shadowColor="#ff9a40" shadowBlur={radius * 1.4} shadowOpacity={0.9} />
      <Shape
        ref={ref}
        sceneFunc={(ctx) => {
          const f = flicker(t.current, seed);
          const h = radius * 1.35 * (1 + f * 0.08);
          const w = radius * 0.62;
          const lean = f * radius * 0.12;
          ctx.save();
          ctx.translate(0, radius * 0.6);
          // Fora: laranja avermelhado; dentro: amarelo; miolo: quase branco.
          const layers: [number, string][] = [
            [1, "#e2551f"],
            [0.7, "#f59a2c"],
            [0.4, "#fff1b8"],
          ];
          for (const [k, color] of layers) {
            flame(ctx, h * k, w * k, lean * k);
            ctx.fillStyle = color;
            ctx.fill();
          }
          ctx.restore();
        }}
      />
    </Group>
  );
}

/** Quanto o brilho da tocha aparece com cada luz do clima (de dia quase nada). */
const GLOW: Record<LightId, number> = { day: 0.18, dusk: 0.32, moon: 0.42, night: 0.5 };

/**
 * Brilho quente das tochas no mapa: 20 ft de luz forte e mais 20 de meia-luz, tremulando. Camada
 * própria com mistura "screen" (clareia o mapa em vez de pintar laranja por cima).
 */
export function TorchGlowLayer({ tokens, grid, light }: { tokens: CombatantView[]; grid: MapConfig; light: LightId }) {
  const layerRef = useRef<Konva.Layer>(null);
  const reduceFx = useApp((s) => s.reduceFx);
  const t = useRef(0);
  const lit = tokens.filter((c) => c.torch && c.pos);

  useEffect(() => {
    const canvas = layerRef.current?.getCanvas()._canvas;
    if (canvas) canvas.style.mixBlendMode = "screen";
  });

  useEffect(() => {
    const layer = layerRef.current;
    if (!layer || reduceFx || lit.length === 0) return;
    let last = 0;
    const anim = new Konva.Animation((frame) => {
      if (!frame) return false;
      t.current = frame.time / 1000;
      if (frame.time - last < 40) return false;
      last = frame.time;
      return true;
    }, layer);
    anim.start();
    return () => {
      anim.stop();
    };
  }, [reduceFx, lit.length]);

  if (lit.length === 0) return null;
  const px = grid.cellPx / grid.feetPerCell;
  const strength = GLOW[light];
  return (
    <Layer ref={layerRef} listening={false}>
      {lit.map((c) => {
        const { x, y, span } = tokenCenter(c, grid);
        const seed = seedOf(c.id);
        const extra = (span * grid.cellPx) / 2;
        const outer = TORCH_FEET * px + extra;
        const bright = (TORCH_BRIGHT_FEET * px + extra) / outer;
        return (
          <Shape
            key={c.id}
            sceneFunc={(ctx) => {
              const f = flicker(t.current, seed);
              const r = outer * (1 + f * 0.035);
              const a = strength * (1 + f * 0.12);
              const g = ctx.createRadialGradient(x, y, 0, x, y, r);
              g.addColorStop(0, `rgba(255, 214, 140, ${a})`);
              g.addColorStop(bright * 0.5, `rgba(255, 170, 80, ${a * 0.8})`);
              g.addColorStop(bright, `rgba(240, 130, 50, ${a * 0.45})`);
              g.addColorStop(1, "rgba(200, 90, 30, 0)");
              ctx.fillStyle = g;
              ctx.beginPath();
              ctx.arc(x, y, r, 0, Math.PI * 2);
              ctx.fill();
            }}
          />
        );
      })}
    </Layer>
  );
}

/** Onde as tochas estão na tela (px) e o raio da luz: para o furo na luz da noite. */
export interface ScreenLight {
  x: number;
  y: number;
  r: number;
}

export function screenLights(tokens: CombatantView[], grid: MapConfig, view: { x: number; y: number; scale: number }): ScreenLight[] {
  const px = grid.cellPx / grid.feetPerCell;
  return tokens
    .filter((c) => c.torch && c.pos)
    .map((c) => {
      const { x, y, span } = tokenCenter(c, grid);
      return { x: view.x + x * view.scale, y: view.y + y * view.scale, r: (TORCH_FEET * px + (span * grid.cellPx) / 2) * view.scale };
    });
}
